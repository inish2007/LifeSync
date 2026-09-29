import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { reminderDb, publicAccount, type AccountRow } from '@/lib/server/database';
import { constantTimeEqual, passwordHash, passwordMatches, randomToken, readSession, sessionCookie, sha256, validSignature } from '@/lib/server/security';
import { dispatchMessages, queueMessage, receiveMessage, runReminderSweep, userTasks, whatsappMode } from '@/lib/server/whatsapp';
import { botReply, normalizeIndianPhone } from '@/lib/reminder-rules';

const credentials = z.object({ email: z.string().email().max(200).transform(s => s.toLowerCase().trim()), password: z.string().min(10).max(128) });
const signup = credentials.extend({ name: z.string().trim().min(1).max(80), phone: z.string().max(30), consent: z.boolean() });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => { const d = new Date(s); return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === s; });
const taskSchema = z.object({ id: z.string().min(1).max(150), title: z.string().min(1).max(300), dueDate: date, status: z.enum(['confirmed','waiting','completed','pending_review']), followUpDate: date.optional() });
const json = (body: unknown, status = 200, cookie?: string) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) } });
async function session(db: D1Database, request: Request) {
  const token = readSession(request); if (!token) return null;
  return db.prepare('SELECT u.* FROM loop_users u JOIN loop_sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?').bind(await sha256(token), Date.now()).first<AccountRow>();
}
async function limit(db: D1Database, key: string, max: number, windowMs: number) {
  const now = Date.now();
  await db.prepare('INSERT INTO loop_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<? THEN 1 ELSE count+1 END, expires_at=CASE WHEN expires_at<? THEN ? ELSE expires_at END').bind(key, now+windowMs, now, now, now+windowMs).run();
  const row = await db.prepare('SELECT count FROM loop_limits WHERE key=?').bind(key).first<{count:number}>();
  return (row?.count || 0) <= max;
}

export async function GET(request: Request) {
  const url = new URL(request.url); const action = url.pathname.split('/').pop();
  if (action === 'webhook') {
    if (env.WHATSAPP_VERIFY_TOKEN && url.searchParams.get('hub.mode') === 'subscribe' && constantTimeEqual(url.searchParams.get('hub.verify_token') || '', env.WHATSAPP_VERIFY_TOKEN)) return new Response(url.searchParams.get('hub.challenge') || '');
    return new Response('Verification failed', { status: 403 });
  }
  try {
    const db = await reminderDb(env); const user = await session(db, request);
    if (action === 'session') return json({ user: user ? publicAccount(user) : null, mode: whatsappMode(env), businessNumber: /^\d{8,15}$/.test(env.WHATSAPP_BUSINESS_NUMBER || '') ? env.WHATSAPP_BUSINESS_NUMBER : null });
    if (!user) return json({ error: 'Sign in to continue.' }, 401);
    if (action === 'messages') {
      const result = await db.prepare('SELECT id,body,direction,state,created_at AS createdAt FROM loop_messages WHERE user_id=? ORDER BY created_at DESC LIMIT 50').bind(user.id).all();
      return json({ messages: result.results.reverse(), consent: !!user.consent, verified: !!user.verified });
    }
    return json({ error: 'Not found.' }, 404);
  } catch { return json({ error: 'Account storage is unavailable. You can still explore the local demo.' }, 503); }
}

export async function POST(request: Request) {
  const url = new URL(request.url); const action = url.pathname.split('/').pop();
  try {
    if (action === 'cron') {
      if (!env.CRON_SECRET || !constantTimeEqual(request.headers.get('authorization') || '', `Bearer ${env.CRON_SECRET}`)) return json({ error: 'Unauthorized.' }, 401);
      await runReminderSweep(env); return json({ ok: true });
    }
    if (action === 'webhook') {
      const body = await request.text();
      if (body.length > 256000 || !await validSignature(body, request.headers.get('x-hub-signature-256') || '', env.WHATSAPP_APP_SECRET || '')) return json({ error: 'Invalid signature.' }, 401);
      const payload = JSON.parse(body) as { entry?: {changes?: {value?: {metadata?: {phone_number_id?: string}; messages?: {id?:string;from?:string;timestamp?:string;text?:{body?:string}}[]; statuses?:{id?:string;status?:string}[]}}[]}[] };
      const db = await reminderDb(env);
      for (const entry of payload.entry || []) for (const change of entry.changes || []) {
        const value = change.value;
        if (value?.metadata?.phone_number_id !== env.WHATSAPP_TEST_PHONE_NUMBER_ID) continue;
        for (const message of value?.messages || []) {
          if (message.from && message.id && message.text?.body && message.timestamp && Math.abs(Date.now()-Number(message.timestamp)*1000)<86400000) await receiveMessage(db, env, message.from, message.text.body, message.id);
        }
        for (const status of value?.statuses || []) if (status.id && ['delivered','read','failed'].includes(status.status || '')) await db.prepare("UPDATE loop_messages SET state=? WHERE provider_id=? AND (state IN ('accepted','sending') OR (state='delivered' AND ?='read'))").bind(status.status!, status.id, status.status!).run();
      }
      return json({ ok: true });
    }
    // Cookie-authenticated mutations require a same-origin request, including login/logout.
    if (request.headers.get('origin') !== url.origin) return json({ error: 'Invalid request origin.' }, 403);
    const raw = await request.text(); if (raw.length > 128000) return json({ error: 'Request too large.' }, 413);
    const input = JSON.parse(raw || '{}');
    const db = await reminderDb(env);
    if (action === 'signup' || action === 'login') {
      const key = `auth:${request.headers.get('cf-connecting-ip') || 'local'}`;
      if (!await limit(db, key, 15, 900000)) return json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);
      const data = action === 'signup' ? signup.parse(input) : credentials.parse(input);
      let user = await db.prepare('SELECT * FROM loop_users WHERE email=?').bind(data.email).first<AccountRow>();
      if (action === 'signup') {
        const profile = signup.parse(input); const phone = normalizeIndianPhone(profile.phone);
        if (!phone) return json({ error: 'Enter a valid Indian WhatsApp number (+91 and 10 digits).' }, 400);
        if (user) return json({ error: 'Unable to create this account. Try signing in.' }, 409);
        const id = randomToken();
        await db.prepare('INSERT INTO loop_users (id,email,name,phone,password,consent,created_at) VALUES (?,?,?,?,?,?,?)').bind(id, data.email, profile.name, phone, await passwordHash(data.password), profile.consent ? 1 : 0, Date.now()).run();
        user = await db.prepare('SELECT * FROM loop_users WHERE id=?').bind(id).first<AccountRow>();
      } else {
        // Hash even unknown accounts to avoid a fast account-enumeration path.
        const valid = user ? await passwordMatches(data.password, user.password) : (await passwordHash(data.password), false);
        if (!valid) return json({ error: 'Incorrect email or password.' }, 401);
      }
      const token = randomToken();
      await db.prepare('INSERT INTO loop_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await sha256(token), user!.id, Date.now()+604800000).run();
      return json({ user: publicAccount(user!) }, 200, sessionCookie(token, url.protocol === 'https:'));
    }
    const user = await session(db, request); if (!user) return json({ error: 'Sign in to continue.' }, 401);
    if (action === 'logout') { await db.prepare('DELETE FROM loop_sessions WHERE token_hash=?').bind(await sha256(readSession(request))).run(); return json({ ok: true }, 200, sessionCookie('', url.protocol === 'https:', true)); }
    if (!await limit(db, `action:${user.id}`, 100, 60000)) return json({ error: 'Please wait a minute and try again.' }, 429);
    if (action === 'profile') {
      const data = z.object({ consent:z.boolean(), phone:z.string().max(30) }).parse(input); const phone = normalizeIndianPhone(data.phone);
      if (!phone) return json({ error: 'Enter a valid Indian WhatsApp number.' }, 400);
      await db.prepare('UPDATE loop_users SET phone=?,consent=?,verified=CASE WHEN phone=? THEN verified ELSE 0 END,last_inbound=CASE WHEN phone=? THEN last_inbound ELSE NULL END,link_hash=NULL,link_expires=NULL WHERE id=?').bind(phone,data.consent?1:0,phone,phone,user.id).run();
      if (!data.consent || phone !== user.phone) await db.prepare("UPDATE loop_messages SET state='cancelled' WHERE user_id=? AND state='queued'").bind(user.id).run();
      return json({ user:publicAccount((await db.prepare('SELECT * FROM loop_users WHERE id=?').bind(user.id).first<AccountRow>())!) });
    }
    if (action === 'link') {
      if (whatsappMode(env) !== 'test' || !env.WHATSAPP_BUSINESS_NUMBER) return json({ error:'Live WhatsApp is not configured. The free in-app preview is available.' }, 409);
      const token = randomToken(); await db.prepare('UPDATE loop_users SET link_hash=?,link_expires=? WHERE id=?').bind(await sha256(token),Date.now()+600000,user.id).run();
      return json({ url:`https://wa.me/${env.WHATSAPP_BUSINESS_NUMBER}?text=${encodeURIComponent(`LINK ${token}`)}` });
    }
    if (action === 'tasks') {
      const tasks = z.array(taskSchema).max(200).parse(input.tasks);
      if (new Set(tasks.map(t=>t.id)).size !== tasks.length) return json({ error:'Duplicate task identifiers.' },400);
      await db.batch([db.prepare('DELETE FROM loop_tasks WHERE user_id=?').bind(user.id), ...tasks.map(t=>db.prepare('INSERT INTO loop_tasks (user_id,id,title,due_date,status,follow_up) VALUES (?,?,?,?,?,?)').bind(user.id,t.id,t.title,t.dueDate,t.status,t.followUpDate || null))]);
      return json({ ok:true });
    }
    if (action === 'run') { await runReminderSweep(env,user.id); return json({ ok:true, mode:whatsappMode(env) }); }
    if (action === 'chat') {
      if (whatsappMode(env) !== 'preview') return json({ error:'Use WhatsApp to chat with the connected test bot.' },409);
      const command = z.string().trim().min(1).max(500).parse(input.message);
      await db.prepare('INSERT INTO loop_messages (id,user_id,dedupe_key,body,direction,state,created_at) VALUES (?,?,?,?,?,?,?)').bind(randomToken(),user.id,randomToken(),command,'inbound','preview',Date.now()).run();
      const upper = command.toUpperCase();
      if (upper === 'STOP' || upper === 'START') await db.prepare('UPDATE loop_users SET consent=? WHERE id=?').bind(upper === 'START'?1:0,user.id).run();
      if (upper === 'STOP') await db.prepare("UPDATE loop_messages SET state='cancelled' WHERE user_id=? AND state='queued'").bind(user.id).run();
      // Explicit preview chats respond locally even when reminders are paused.
      await queueMessage(db,user,botReply(command,await userTasks(db,user.id)),`chat:${randomToken()}`);
      await dispatchMessages(db,env,{...user,consent:1});
      return json({ ok:true });
    }
    return json({ error:'Not found.' },404);
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error:'Check the form fields and try again. Passwords need at least 10 characters.' },400);
    return json({ error:'Could not complete the request. Please try again; no delivery is being claimed.' },500);
  }
}

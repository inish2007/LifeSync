import { botReply, planReminders, type ReminderTask } from '../reminder-rules';
import { reminderDb, type AccountRow } from './database';
import { randomToken, sha256 } from './security';

export function whatsappMode(env: Cloudflare.Env) {
  return env.WHATSAPP_MODE === 'test' && env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_TEST_PHONE_NUMBER_ID && env.WHATSAPP_APP_SECRET && env.WHATSAPP_VERIFY_TOKEN && /^v\d+\.\d+$/.test(env.WHATSAPP_API_VERSION || '') ? 'test' : 'preview';
}
export async function userTasks(db: D1Database, id: string): Promise<ReminderTask[]> {
  const result = await db.prepare('SELECT id,title,due_date AS dueDate,status,follow_up AS followUpDate FROM loop_tasks WHERE user_id=?').bind(id).all<ReminderTask>();
  return result.results;
}
export async function queueMessage(db: D1Database, user: AccountRow, text: string, key: string, taskId: string | null = null) {
  await db.prepare('INSERT OR IGNORE INTO loop_messages (id,user_id,dedupe_key,task_id,body,direction,state,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(randomToken(), user.id, `${user.id}:${key}`, taskId, text, 'outbound', 'queued', Date.now()).run();
}
export async function dispatchMessages(db: D1Database, env: Cloudflare.Env, user: AccountRow) {
  const mode = whatsappMode(env);
  if (!user.consent) return;
  if (mode === 'test' && (!user.verified || !user.last_inbound || Date.now() - user.last_inbound > 23 * 60 * 60 * 1000 || !(env.WHATSAPP_TEST_RECIPIENTS || '').split(',').map(s => s.trim()).includes(user.phone))) return;
  // Preview rows are never promoted into real sends when test mode is enabled later.
  const pending = await db.prepare("SELECT id,body FROM loop_messages WHERE user_id=? AND state='queued' ORDER BY created_at LIMIT 10").bind(user.id).all<{id: string; body: string}>();
  for (const row of pending.results) {
    const claim = await db.prepare("UPDATE loop_messages SET state=? WHERE id=? AND state='queued'").bind(mode === 'preview' ? 'preview' : 'sending', row.id).run();
    if (!claim.meta.changes || mode === 'preview') continue;
    try {
      const response = await fetch(`https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_TEST_PHONE_NUMBER_ID}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to: user.phone, type: 'text', text: { body: row.body } }), signal: AbortSignal.timeout(12000) });
      const payload = await response.json() as { messages?: {id: string}[] };
      const id = payload.messages?.[0]?.id;
      await db.prepare('UPDATE loop_messages SET state=?,provider_id=? WHERE id=?').bind(response.ok && id ? 'accepted' : 'failed', id || null, row.id).run();
    } catch {
      // Ambiguous requests must not be retried automatically: they may already have been accepted.
      await db.prepare("UPDATE loop_messages SET state='unknown' WHERE id=?").bind(row.id).run();
    }
  }
}
export async function runReminderSweep(env: Cloudflare.Env, onlyUser?: string) {
  const db = await reminderDb(env);
  const query = onlyUser ? db.prepare('SELECT * FROM loop_users WHERE consent=1 AND id=?').bind(onlyUser) : db.prepare('SELECT * FROM loop_users WHERE consent=1 LIMIT 100');
  const users = await query.all<AccountRow>();
  for (const user of users.results) {
    // Drop reminders that are now completed/deleted, expired, or opted out before dispatch.
    await db.prepare("UPDATE loop_messages SET state='cancelled' WHERE user_id=? AND state='queued' AND (created_at<? OR (task_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM loop_tasks t WHERE t.user_id=loop_messages.user_id AND t.id=loop_messages.task_id AND t.status IN ('confirmed','waiting'))))").bind(user.id, Date.now() - 86400000).run();
    for (const reminder of planReminders(await userTasks(db, user.id))) await queueMessage(db, user, reminder.text, reminder.key, reminder.taskId);
    await dispatchMessages(db, env, user);
  }
}

export async function receiveMessage(db: D1Database, env: Cloudflare.Env, from: string, text: string, messageId: string) {
  const claim = await db.prepare('INSERT OR IGNORE INTO loop_webhooks (id,created_at) VALUES (?,?)').bind(messageId, Date.now()).run();
  if (!claim.meta.changes) return;
  const link = /^LINK\s+([a-f0-9]{64})$/i.exec(text.trim());
  if (link) {
    const user = await db.prepare('SELECT * FROM loop_users WHERE phone=? AND link_hash=? AND link_expires>?').bind(from, await sha256(link[1]), Date.now()).first<AccountRow>();
    if (!user) return;
    await db.prepare('UPDATE loop_users SET verified=1,last_inbound=?,link_hash=NULL,link_expires=NULL WHERE id=?').bind(Date.now(), user.id).run();
    if (user.consent) { await queueMessage(db, user, 'WhatsApp connected. Send TODAY for tasks, or STOP to pause reminders.', `link:${messageId}`); await dispatchMessages(db, env, { ...user, verified: 1, last_inbound: Date.now() }); }
    return;
  }
  const user = await db.prepare('SELECT * FROM loop_users WHERE phone=? AND verified=1').bind(from).first<AccountRow>();
  if (!user) return;
  const command = text.trim().toUpperCase();
  const consent = command === 'STOP' ? 0 : command === 'START' ? 1 : user.consent;
  await db.prepare('UPDATE loop_users SET last_inbound=?,consent=? WHERE id=?').bind(Date.now(), consent, user.id).run();
  if (!consent) { await db.prepare("UPDATE loop_messages SET state='cancelled' WHERE user_id=? AND state='queued'").bind(user.id).run(); return; }
  await queueMessage(db, user, botReply(command, await userTasks(db, user.id)), `reply:${messageId}`);
  await dispatchMessages(db, env, { ...user, consent, last_inbound: Date.now() });
}

const schema = [
  `CREATE TABLE IF NOT EXISTS loop_users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, password TEXT NOT NULL, consent INTEGER NOT NULL DEFAULT 0, verified INTEGER NOT NULL DEFAULT 0, last_inbound INTEGER, link_hash TEXT, link_expires INTEGER, created_at INTEGER NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS verified_phone ON loop_users(phone) WHERE verified = 1`,
  `CREATE TABLE IF NOT EXISTS loop_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS loop_tasks (user_id TEXT NOT NULL, id TEXT NOT NULL, title TEXT NOT NULL, due_date TEXT NOT NULL, status TEXT NOT NULL, follow_up TEXT, PRIMARY KEY(user_id,id))`,
  `CREATE TABLE IF NOT EXISTS loop_messages (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, dedupe_key TEXT UNIQUE NOT NULL, task_id TEXT, body TEXT NOT NULL, direction TEXT NOT NULL, state TEXT NOT NULL, provider_id TEXT, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS loop_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS loop_webhooks (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL)`,
];
export async function reminderDb(env: Cloudflare.Env): Promise<D1Database> {
  if (!env.DB) throw new Error('Account storage is not configured. Use the local demo or configure the DB binding.');
  await env.DB.batch(schema.map(sql => env.DB!.prepare(sql)));
  return env.DB;
}
export interface AccountRow { id: string; email: string; name: string; phone: string; password: string; consent: number; verified: number; last_inbound: number | null; link_hash: string | null; link_expires: number | null }
export function publicAccount(user: AccountRow) { return { id: user.id, name: user.name, email: user.email, phone: user.phone, consent: !!user.consent, verified: !!user.verified }; }

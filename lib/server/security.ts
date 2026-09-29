const encoder = new TextEncoder();
export function randomToken(): string { return Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join(''); }
export async function sha256(value: string): Promise<string> { return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value))); }
function hex(value: ArrayBuffer) { return Array.from(new Uint8Array(value), n => n.toString(16).padStart(2, '0')).join(''); }
export function constantTimeEqual(a: string, b: string): boolean { if (a.length !== b.length) return false; let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); return diff === 0; }
export async function passwordHash(password: string, salt = randomToken()): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
  return `${salt}:${hex(bits)}`;
}
export async function passwordMatches(password: string, stored: string) { return constantTimeEqual(await passwordHash(password, stored.split(':')[0]), stored); }
export function sessionCookie(token: string, secure: boolean, clear = false): string { return `lifeloop_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : 604800}${secure ? '; Secure' : ''}`; }
export function readSession(request: Request): string { return request.headers.get('cookie')?.match(/(?:^|;\s*)lifeloop_session=([a-f0-9]{64})(?:;|$)/)?.[1] || ''; }
export async function validSignature(body: string, signature: string, secret: string): Promise<boolean> {
  if (!secret || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return constantTimeEqual(`sha256=${hex(await crypto.subtle.sign('HMAC', key, encoder.encode(body)))}`, signature);
}

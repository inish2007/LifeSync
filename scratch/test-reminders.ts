import assert from 'node:assert/strict';
import { botReply, indiaToday, normalizeIndianPhone, planReminders } from '../lib/reminder-rules';
import { passwordHash, passwordMatches, validSignature } from '../lib/server/security';
import { inrOnly } from '../lib/currency';

async function main(){
  assert.equal(normalizeIndianPhone('+91 98765 43210'),'919876543210');
  assert.equal(normalizeIndianPhone('9876543210'),'919876543210');
  assert.equal(normalizeIndianPhone('+1 555 123 4567'),null);
  assert.equal(indiaToday(new Date('2026-09-29T20:00:00Z')),'2026-09-30');
  const tasks=[{id:'a',title:'Water bill',dueDate:'2026-09-30',status:'confirmed'},{id:'b',title:'Inspection',dueDate:'2026-09-29',status:'completed'},{id:'c',title:'Response',dueDate:'2026-10-10',status:'waiting',followUpDate:'2026-09-29'}];
  const reminders=planReminders(tasks,'2026-09-29');
  assert.equal(reminders.length,2);assert.equal(reminders[0].kind,'upcoming');assert.equal(reminders[1].kind,'follow-up');assert.deepEqual(planReminders(tasks,'2026-09-29'),reminders);
  assert.ok(botReply('STOP',tasks).includes('paused'));
  assert.equal(inrOnly('Pay $123.00 or USD 15'),'Pay [enter INR amount] or [enter INR amount]');
  const hash=await passwordHash('a-long-test-password');assert.ok(await passwordMatches('a-long-test-password',hash));assert.equal(await passwordMatches('wrong-password',hash),false);
  const body='{"test":true}',secret='local-test-only';const encoder=new TextEncoder();const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const signed=await crypto.subtle.sign('HMAC',key,encoder.encode(body));const signature='sha256='+Array.from(new Uint8Array(signed),n=>n.toString(16).padStart(2,'0')).join('');
  assert.ok(await validSignature(body,signature,secret));assert.equal(await validSignature(body+' ',signature,secret),false);assert.equal(await validSignature(body,signature,''),false);
  console.log('PASS: INR handling, Indian phone validation, IST reminders, deterministic keys, commands, password hashing and webhook signatures.');
}
void main();

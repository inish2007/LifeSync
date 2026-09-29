import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';
const email=`lifeloop-test-${Date.now()}@example.invalid`;
let cookie='';
async function request(path,body,authenticated=true,origin=base){
  const response=await fetch(`${base}/api/lifeloop/${path}`,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json','Origin':origin}),...(authenticated&&cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await response.text(); let data; try { data=JSON.parse(text); } catch { data={error:text}; } return {response,data};
}
const signed=await request('signup',{name:'Local API Test',email,password:'local-test-password-123',phone:'9876543210',consent:true});
assert.equal(signed.response.status,200,JSON.stringify(signed.data));cookie=signed.response.headers.get('set-cookie').split(';')[0];assert.ok(signed.response.headers.get('set-cookie').includes('HttpOnly'));assert.equal(signed.data.user.phone,'919876543210');assert.equal(signed.data.user.password,undefined);
assert.equal((await request('tasks',{tasks:[]},false)).response.status,401);
assert.equal((await request('profile',{phone:'9876543210',consent:false},true,'https://wrong.example')).response.status,403);
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
assert.equal((await request('tasks',{tasks:[{id:'test-water',title:'Test water bill',dueDate:today,status:'confirmed'}]})).response.status,200);
await request('run',{});await request('run',{});
let history=await request('messages');assert.equal(history.data.messages.length,1);assert.equal(history.data.messages[0].state,'preview');
await request('chat',{message:'STOP'});assert.equal((await request('messages')).data.consent,false);
await request('tasks',{tasks:[{id:'test-second',title:'Paused reminder',dueDate:today,status:'confirmed'}]});await request('run',{});
history=await request('messages');assert.ok(!history.data.messages.some(m=>m.body.includes('Paused reminder')));
assert.equal((await request('link',{})).response.status,409);
assert.equal((await request('cron',{},false)).response.status,401);
assert.equal((await request('webhook',{},false)).response.status,401);
await request('logout',{});assert.equal((await request('messages')).response.status,401);
const login=await request('login',{email,password:'local-test-password-123'},false);assert.equal(login.response.status,200);cookie=login.response.headers.get('set-cookie').split(';')[0];
assert.equal((await request('session')).data.user.email,email);await request('logout',{});
console.log('PASS: signup, private session, login/logout, CSRF, authenticated task sync, reminder dedupe, STOP, preview-only dispatch, missing live setup, webhook rejection and cron authorization. Test account retained only in local DB.');

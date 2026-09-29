'use client';
import { useEffect, useState } from 'react';
import { accountApi, type Account } from '@/lib/account-client';
import { botReply, planReminders } from '@/lib/reminder-rules';
import type { Obligation } from '@/lib/types';

type Message={id:string;body:string;direction:string;state:string;createdAt:number};
export default function WhatsAppReminders({account,tasks,onAccountUpdated}:{account:Account|null;tasks:Obligation[];onAccountUpdated:(user:Account)=>void}){
  const [messages,setMessages]=useState<Message[]>([]);
  const [phone,setPhone]=useState(account?.phone || '');
  const [consent,setConsent]=useState(account?.consent || false);
  const [mode,setMode]=useState('preview');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [link,setLink]=useState('');
  const [status,setStatus]=useState('');
  useEffect(()=>{
    if(!account)return;
    let cancelled=false;
    const refresh=async()=>{try{const [data,session]=await Promise.all([accountApi('messages'),accountApi('session')]);if(!cancelled){setMessages(data.messages);setMode(session.mode);setConsent(data.consent);}}catch(err){if(!cancelled)setError(err instanceof Error?err.message:'Connection unavailable.');}};
    void refresh();const timer=setInterval(refresh,15000);return()=>{cancelled=true;clearInterval(timer);};
  },[account?.id]);
  async function action(fn:()=>Promise<void>){setBusy(true);setError('');setStatus('');try{await fn();}catch(err){setError(err instanceof Error?err.message:'Please try again.');}finally{setBusy(false);}}
  async function refresh(){const data=await accountApi('messages');setMessages(data.messages);setConsent(data.consent);}
  async function sync(){await accountApi('tasks',{tasks:tasks.map(({id,title,dueDate,status,followUpDate})=>({id,title,dueDate,status,followUpDate}))});}
  const preview=(body:string,direction='outbound')=>({id:crypto.randomUUID(),body,direction,state:'preview',createdAt:Date.now()});
  return <section className="panel reminder-panel"><div className="row spread"><div><div className="eyebrow">A nudge when it matters</div><h2>WhatsApp reminders</h2></div><span className="badge green">{mode==='preview'?'₹0 · In-app preview':'Meta test connection'}</span></div>
    <p className="helper">{mode==='preview'?'Try the bot here. No WhatsApp messages are sent and no payment is needed.':'Test recipients only. Messages require a recent WhatsApp conversation.'}</p>
    {account?<details className="quiet-details"><summary>Number & reminder settings</summary><form onSubmit={e=>{e.preventDefault();void action(async()=>{const data=await accountApi('profile',{phone,consent});onAccountUpdated(data.user);setStatus('Preferences saved.');});}}><label className="field">WhatsApp number<input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} required/></label><label className="consent-line"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Send deadline and follow-up reminders</label><p className="helper">Only task titles, deadlines, and status sync for reminders. Documents and proof stay in this browser.</p><button className="secondary" disabled={busy}>Save preferences</button></form>{mode==='test'&&<button className="secondary" disabled={busy} onClick={()=>void action(async()=>{const data=await accountApi('link',{});setLink(data.url);})}>Verify my number</button>}{link&&<p><a href={link} target="_blank" rel="noreferrer">Open WhatsApp and send the connection code</a></p>}</details>:<p className="helper">Exploring locally. Create an account to save your number and reminder history.</p>}
    <div className="chat-preview" aria-label="Reminder conversation" aria-live="polite"><div className="chat-title">LifeLoop <small>{mode==='preview'?'Demo bot · not a real WhatsApp chat':'Test bot activity'}</small></div>{!messages.length&&<p className="helper">Send TODAY to see your next reminders.</p>}{messages.map(message=><div className={`chat-bubble ${message.direction==='inbound'?'chat-user':''}`} key={message.id}><p>{message.body}</p><small>{message.state==='preview'?'Preview · not sent':message.state} · {new Date(message.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</small></div>)}</div>
    <div className="row">{['TODAY','HELP','STOP','START'].map(command=><button disabled={busy || mode==='test'} className="secondary" key={command} onClick={()=>void action(async()=>{if(account){await sync();await accountApi('chat',{message:command});await refresh();}else{setMessages(prev=>[...prev,preview(command,'inbound'),preview(botReply(command,tasks))]);if(command==='STOP')setConsent(false);if(command==='START')setConsent(true);}})}>{command}</button>)}<button className="primary" disabled={busy} onClick={()=>void action(async()=>{if(account){await sync();await accountApi('run',{});await refresh();setStatus(consent?'Reminder check complete.':'Reminders are paused. Enable them in settings.');}else{setMessages(prev=>{const existing=new Set(prev.map(m=>m.id));return [...prev,...planReminders(tasks).filter(r=>!existing.has(r.key)).map(r=>({...preview(r.text),id:r.key}))];});setStatus('Preview generated. No external messages sent.');}})}>Check reminders</button></div>
    {error&&<p className="notice error" role="alert">{error}</p>}{status&&<p role="status" className="helper">{status}</p>}
    <details className="quiet-details"><summary>How to enable live WhatsApp later</summary><p className="helper">Configure a Meta developer test number, server credentials, a public webhook, and a scheduler. Then verify your number by sending the connection code. Setup instructions are in WHATSAPP-SETUP.md. Unlimited production WhatsApp alerts are not guaranteed free.</p></details>
  </section>;
}

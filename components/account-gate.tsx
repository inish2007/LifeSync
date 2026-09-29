'use client';
import { useEffect, useState } from 'react';
import { accountApi, type Account } from '@/lib/account-client';
import { setStorageAccount } from '@/lib/storage';
import LifeLoop from '@/app/lifeloop';

export default function AccountGate() {
  const [user,setUser]=useState<Account|null>(null);
  const [demo,setDemo]=useState(false);
  const [loading,setLoading]=useState(true);
  const [register,setRegister]=useState(false);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{ accountApi('session').then(data=>{setStorageAccount(data.user?.id || null);setUser(data.user);}).catch(err=>setError(err.message)).finally(()=>setLoading(false)); },[]);
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError('');
    const fields=new FormData(event.currentTarget);
    try { const data=await accountApi(register?'signup':'login',{email:fields.get('email'),password:fields.get('password'),name:fields.get('name'),phone:fields.get('phone'),consent:fields.get('consent')==='on'});setStorageAccount(data.user.id);setUser(data.user); }
    catch(err){setError(err instanceof Error?err.message:'Unable to sign in.');}finally{setBusy(false);}
  }
  async function logout(){try{if(user)await accountApi('logout',{});setUser(null);setDemo(false);setStorageAccount(null);}catch(err){setError(err instanceof Error?err.message:'Sign-out failed.');}}
  if(loading)return <main className="auth-shell"><p role="status">Opening your space…</p></main>;
  if(user||demo)return <><div className="account-strip"><span>{demo?'Local demo':user?.name} · {demo?'No messages sent':'Private workspace'}</span><button className="linkbutton" onClick={logout}>Sign out</button>{error&&<span role="alert">{error}</span>}</div><LifeLoop account={user} onAccountUpdated={setUser}/></>;
  return <main className="auth-shell"><section className="auth-intro"><div className="eyebrow">LifeLoop · the life admin edit</div><h1>Less to remember.<br/><em>More room to live.</em></h1><p>Bills, deadlines, and the next small step. All in one calm space.</p><span className="badge green">₹0 reminder preview included</span></section><section className="panel auth-card"><h2>{register?'Make it your space.':'Welcome back.'}</h2><p className="helper">{register?'Add your WhatsApp number for reminder setup.':'Sign in to your LifeLoop account.'}</p><form onSubmit={submit}>
    {register&&<label className="field">Name<input name="name" autoComplete="name" maxLength={80} required/></label>}
    <label className="field">Email<input name="email" type="email" autoComplete="email" maxLength={200} required/></label>
    <label className="field">Password<input name="password" type="password" autoComplete={register?'new-password':'current-password'} minLength={10} maxLength={128} required/><small className="helper">At least 10 characters</small></label>
    {register&&<><label className="field">WhatsApp number<input name="phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" required/></label><label className="consent-line"><input name="consent" type="checkbox"/>I want deadline and follow-up reminders. I can pause them anytime.</label><p className="helper">Demo messages stay in LifeLoop. Real WhatsApp delivery needs a verified connection.</p></>}
    {error&&<p role="alert" className="notice error">{error}</p>}<button disabled={busy} className="primary wide">{busy?'Please wait…':register?'Create account':'Sign in'}</button></form><div className="row" style={{marginTop:20}}><button className="linkbutton" onClick={()=>{setRegister(!register);setError('');}}>{register?'Already have an account? Sign in':'New here? Create account'}</button><button className="secondary" onClick={()=>{setStorageAccount(null);setDemo(true);setError('');}}>Explore demo</button></div></section></main>;
}

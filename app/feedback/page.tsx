'use client';
import { useState } from 'react';
import Link from 'next/link';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import SettingsButton from '@/components/SettingsButton';
import { useAuth } from '@/lib/auth';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { isSampleMode } from '@/lib/sample-mode';
import { feedbackText,validFeedback,type FeedbackInput } from '@/lib/product-feedback';
import { downloadFile } from '@/lib/file-delivery';
import styles from '@/components/SampleExperience.module.css';

type Ticket={id:string;title:string;kind:string;details:string;createdAt:string;role:string;sample:boolean;path:string};
export default function FeedbackPage(){
  const {user,role}=useAuth();const [kind,setKind]=useState<'bug'|'feature'>('bug'),[title,setTitle]=useState(''),[details,setDetails]=useState(''),[path,setPath]=useState('/'),[agree,setAgree]=useState(false),[busy,setBusy]=useState(false),[receipt,setReceipt]=useState(''),[error,setError]=useState(''),[tickets,setTickets]=useState<Ticket[]|null>(null);
  const [id,setId]=useState('');
  function input():FeedbackInput{const key=id||crypto.randomUUID();if(!id)setId(key);return {id:key,kind,title,details,path,sample:isSampleMode()};}
  async function send(){if(!user||!agree||busy||receipt)return;const data=input();if(!validFeedback(data)){setError('Add a title, details and a page path without a query or personal information.');return;}setBusy(true);setError('');try{
    const response=await fetch('/api/product-feedback',{method:'POST',headers:{...await paidApiHeaders(user),'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await response.json();if(!response.ok||!result.saved)throw Error(result.error||'Delivery not confirmed.');setReceipt(result.reference);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function inbox(){setBusy(true);setError('');try{const response=await fetch('/api/product-feedback',{headers:await paidApiHeaders(user)});const result=await response.json();if(!response.ok)throw Error(result.error);setTickets(result.tickets);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <main className={styles.page}><div className={styles.wrap}><header className={styles.header}><MenuButton/><BackButton fallback="/account"/><SettingsButton/></header><h1>Report a bug or suggest a feature</h1><p>Tell the developer what happened or what would help. Please leave out passwords, identity numbers, private survey answers and other people’s personal information.</p>
    {receipt?<section className={styles.card}><h2>Received</h2><p>Saved in the private developer inbox. Reference: {receipt}</p><button onClick={()=>{setReceipt('');setId('');setTitle('');setDetails('');setAgree(false);}}>Write another</button></section>:<form onSubmit={e=>{e.preventDefault();void send();}} className={styles.card}><fieldset disabled={busy} style={{minWidth:0}}><label>What would you like to send?<select value={kind} onChange={e=>setKind(e.target.value as 'bug'|'feature')}><option value="bug">Report a bug</option><option value="feature">Request a feature</option></select></label><label>Title<input required minLength={3} maxLength={160} value={title} onChange={e=>{setTitle(e.target.value);setId('');}}/></label><label>{kind==='bug'?'What did you do, what happened, and what did you expect?':'What would you like to do, and why would it help?'}<textarea required minLength={10} maxLength={4000} value={details} onChange={e=>{setDetails(e.target.value);setId('');}}/></label><label>App page (optional)<input value={path} maxLength={200} placeholder="/mentor" onChange={e=>{setPath(e.target.value||'/');setId('');}}/></label><p className={styles.meta}>Only the form, your account identifier and organisation/role are sent. No screenshot, GPS position or farm record is attached automatically.</p><label className={styles.check}><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)}/>Send this feedback to the real developer inbox, including when I am in a sample.</label><div className={styles.actions}><button className={styles.primary} disabled={!user||!agree||busy} type="submit">{busy?'Sending…':'Send to developer'}</button><button type="button" onClick={()=>{const data=input();if(!validFeedback(data)){setError('Please add a title, details and a valid page path first.');return;}downloadFile(new Blob([feedbackText(data)],{type:'text/plain'}),'ImbewuField-feedback.txt');}}>Download a copy</button></div>{!user&&<p><Link href="/login?from=%2Ffeedback">Sign in</Link> to send, or download your draft first. Signing in may reload this page.</p>}</fieldset></form>}
    {error&&<p role="alert" className={styles.notice}>{error}</p>}
    {role==='admin'&&<section className={styles.card}><h2>Developer inbox</h2><button disabled={busy} onClick={()=>void inbox()}>Load latest 100 submissions</button>{tickets?.length===0&&<p>No feedback yet.</p>}{tickets?.map(t=><article className={styles.card} key={t.id}><span className={styles.meta}>{t.kind} · {t.role||'account'} · {t.createdAt} · {t.sample?'from sample':'live app'}</span><h2>{t.title}</h2><p style={{whiteSpace:'pre-wrap'}}>{t.details}</p><p>Page: {t.path}</p></article>)}</section>}
  </div></main>;
}

'use client';
import { useState } from 'react';
import Link from 'next/link';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import SettingsButton from '@/components/SettingsButton';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { useAppLevel } from '@/lib/app-level';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { isSampleMode } from '@/lib/sample-mode';
import { feedbackText,validFeedback,type FeedbackInput } from '@/lib/product-feedback';
import { downloadFile } from '@/lib/file-delivery';
import styles from '@/components/SampleExperience.module.css';

type Ticket={id:string;title:string;kind:string;details:string;createdAt:string;role:string;sample:boolean;path:string};
export default function FeedbackPage(){
  const {user,role}=useAuth();const {lang}=useLanguage();const simple=useAppLevel()==='simple';const [kind,setKind]=useState<'bug'|'feature'>('bug'),[title,setTitle]=useState(''),[details,setDetails]=useState(''),[path,setPath]=useState('/'),[agree,setAgree]=useState(false),[busy,setBusy]=useState(false),[receipt,setReceipt]=useState(''),[error,setError]=useState(''),[tickets,setTickets]=useState<Ticket[]|null>(null);
  const label=(en:string,zu:string)=>lang==='zu'?zu:en;
  // Keep exact English visible for decisions about sending personal information.
  const paired=(en:string,zu:string)=>lang==='zu'?`${zu} / ${en}`:en;
  const [id,setId]=useState('');
  // Simple has no separate Title field, so the single "Tell us" box drives both — the title is
  // just the start of what was typed, silently kept valid for validFeedback's 3-char floor.
  function tellUs(value:string){setDetails(value);setTitle(value.trim().slice(0,160)||'Feedback');setId('');}
  function input():FeedbackInput{const key=id||crypto.randomUUID();if(!id)setId(key);return {id:key,kind,title,details,path,sample:isSampleMode()};}
  async function send(){if(!user||!agree||busy||receipt)return;const data=input();if(!validFeedback(data)){setError(paired('Add a title, details and a page path without a query or personal information.','Faka isihloko, imininingwane nendlela yekhasi engenawo umbuzo noma imininingwane yomuntu siqu.'));return;}setBusy(true);setError('');try{
    const response=await fetch('/api/product-feedback',{method:'POST',headers:{...await paidApiHeaders(user),'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await response.json();if(!response.ok||!result.saved)throw Error(result.error||'Delivery not confirmed.');setReceipt(result.reference);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function inbox(){setBusy(true);setError('');try{const response=await fetch('/api/product-feedback',{headers:await paidApiHeaders(user)});const result=await response.json();if(!response.ok)throw Error(result.error);setTickets(result.tickets);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <main className={styles.page}><div className={styles.wrap}>
    <header className={styles.header}><MenuButton/><BackButton fallback="/account"/><SettingsButton/></header>
    <h1>{label('Report a bug or suggest a feature','Bika inkinga noma phakamisa isici esisha')}</h1>
    {lang==='zu'&&<p role="note">UMBHALO WESIZULU USALUHLAKA — Le nguqulo ayikabuyekezwa umuntu okhuluma kahle isiZulu. / ISIZULU DRAFT — This translation has not been reviewed by a fluent isiZulu speaker.</p>}
    <p>{paired('Tell the developer what happened or what would help. Please leave out passwords, identity numbers, private survey answers and other people’s personal information.','Tshela umthuthukisi okwenzekile noma okungasiza. Ungafaki amagama ayimfihlo, izinombolo zomazisi, izimpendulo eziyimfihlo zezinhlolovo noma imininingwane yomuntu siqu yabanye abantu.')}</p>
    {receipt?<section className={styles.card}>
      <h2>{label('Received','Kwamukelwe')}</h2>
      <p>{paired('Saved in the private developer inbox. Reference:','Kulondolozwe ebhokisini eliyimfihlo lomthuthukisi. Inombolo yokubhekisela:')} {receipt}</p>
      <button onClick={()=>{setReceipt('');setId('');setTitle('');setDetails('');setAgree(false);}}>{label('Write another','Bhala okunye')}</button>
    </section>:<form onSubmit={e=>{e.preventDefault();void send();}} className={styles.card}><fieldset disabled={busy} style={{minWidth:0}}>
      {simple?<label>{label('Tell us','Sitshele')}<textarea required minLength={10} maxLength={4000} value={details} onChange={e=>tellUs(e.target.value)}/></label>:<>
      <label>{label('What would you like to send?','Ufuna ukuthumela ini?')}<select value={kind} onChange={e=>setKind(e.target.value as 'bug'|'feature')}>
        <option value="bug">{label('Report a bug','Bika inkinga')}</option><option value="feature">{label('Request a feature','Cela isici esisha')}</option>
      </select></label>
      <label>{label('Title','Isihloko')}<input required minLength={3} maxLength={160} value={title} onChange={e=>{setTitle(e.target.value);setId('');}}/></label>
      <label>{kind==='bug'?label('What did you do, what happened, and what did you expect?','Wenzeni, kwenzekeni, futhi ubulindeleni?'):label('What would you like to do, and why would it help?','Ufuna ukwenzani, futhi kungasiza ngani?')}<textarea required minLength={10} maxLength={4000} value={details} onChange={e=>{setDetails(e.target.value);setId('');}}/></label>
      </>}
      <label>{label('App page (optional)','Ikhasi lohlelo (ungalikhetha)')}<input value={path} maxLength={200} placeholder="/mentor" onChange={e=>{setPath(e.target.value||'/');setId('');}}/></label>
      <p className={styles.meta}>{paired('Only the form, your account identifier and organisation/role are sent. No screenshot, GPS position or farm record is attached automatically.','Kuthunyelwa leli fomu kuphela, isihlonzi se-akhawunti yakho, inhlangano nendima yakho. Akunamathiselwa isithombe sesikrini, indawo ye-GPS noma irekhodi lepulazi ngokuzenzakalelayo.')}</p>
      <label className={styles.check}><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)}/>{paired('Send this feedback to the real developer inbox, including from a practice view.','Thumela lo mbiko ebhokisini langempela lomthuthukisi, ngisho nasendaweni yokuzijwayeza.')}</label>
      <div className={styles.actions}>
        <button className={styles.primary} disabled={!user||!agree||busy} type="submit">{busy?label('Sending…','Kuyathunyelwa…'):paired('Send to developer','Thumela kumthuthukisi')}</button>
        <button type="button" onClick={()=>{const data=input();if(!validFeedback(data)){setError(paired('Please add a title, details and a valid page path first.','Qala ngokufaka isihloko, imininingwane nendlela yekhasi evumelekile.'));return;}downloadFile(new Blob([feedbackText(data)],{type:'text/plain'}),'ImbewuField-feedback.txt');}}>{label('Download a copy','Landa ikhophi')}</button>
      </div>
      {!user&&<p><Link href="/login?from=%2Ffeedback">{label('Sign in','Ngena ngemvume')}</Link> {paired('to send, or download your draft first. Signing in may reload this page.','ukuze uthumele, noma landa uhlaka lwakho kuqala. Ukungena ngemvume kungase kulayishe leli khasi kabusha.')}</p>}
    </fieldset></form>}
    {error&&<p role="alert" className={styles.notice}>{lang==='zu'?'Iphutha / Error: ':''}{error}</p>}
    {role==='admin'&&<section className={styles.card}>
      <h2>{label('Developer inbox','Ibhokisi lomthuthukisi')}</h2>
      <button disabled={busy} onClick={()=>void inbox()}>{label('Load latest 100 submissions','Layisha imibiko eyi-100 yakamuva')}</button>
      {tickets?.length===0&&<p>{label('No feedback yet.','Akukabi bikho mibiko.')}</p>}
      {tickets?.map(t=><article className={styles.card} key={t.id}>
        <span className={styles.meta}>{t.kind} · {t.role||label('account','i-akhawunti')} · {t.createdAt} · {t.sample?label('from practice view','ivela endaweni yokuzijwayeza'):label('live app','uhlelo olusebenzayo')}</span>
        <h2>{t.title}</h2><p style={{whiteSpace:'pre-wrap'}}>{t.details}</p><p>{label('Page:','Ikhasi:')} {t.path}</p>
      </article>)}
    </section>}
  </div></main>;
}

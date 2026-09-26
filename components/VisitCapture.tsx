'use client';
import { useEffect, useRef, useState } from 'react';
import { resizeForStorage } from '@/lib/site-evidence';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { disabledAiFeatures } from '@/lib/ai-preferences';
import { useAuth } from '@/lib/auth';
import { getFirebase } from '@/lib/firebase/init';
import { isSampleMode } from '@/lib/sample-mode';
import { validVisitPhotos, type VisitPhoto } from '@/lib/field-teams';
import { useLanguage } from '@/lib/i18n-context';
export type VisitCaptureValue = { notes: string; originalNotes?: string; photos?: VisitPhoto[] };
export default function VisitCapture({ value, onChange, disabled=false, notesRequired=true, onBusyChange }: { value: VisitCaptureValue; onChange: (value:VisitCaptureValue)=>void; disabled?:boolean; notesRequired?:boolean; onBusyChange?: (busy:boolean)=>void }) {
  const { lang } = useLanguage();
  const ui = (en: string, zu: string) => lang === 'zu' ? `${zu} · ${en}` : en;
  const {user,profile}=useAuth();
  const alive=useRef(true),scopeRef=useRef('');
  scopeRef.current=[user?.uid??'',profile?.org_id??'',profile?.role??''].join('|');
  const currentScope=()=>`${scopeRef.current}|${isSampleMode()?'sample':getFirebase()?.auth.currentUser?.uid??''}`;
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [suggestion,setSuggestion]=useState('');
  useEffect(()=>{onBusyChange?.(busy);},[busy,onBusyChange]);
  const original=useRef('');
  const text=useRef<HTMLTextAreaElement>(null);
  async function photos(files:FileList|null) {
    if(!files || disabled)return;
    const scope=currentScope();
    setBusy(true);setError('');
    try {
      const existing=value.photos??[];
      if(existing.length+files.length>3)throw Error(ui('Attach up to three photos per visit.', 'Namathisela izithombe ezifika kwezintathu ekuvakasheni ngakunye.'));
      const added:VisitPhoto[]=[];
      for(const file of Array.from(files)) {
        if(file.size>15*1024*1024)throw Error(ui('Choose a photo smaller than 15 MB.', 'Khetha isithombe esingaphansi kuka-15 MB.'));
        let image=await resizeForStorage(file,800);
        if(image.length>150000)image=await resizeForStorage(file,500);
        added.push({image,caption:''});
      }
      if(!validVisitPhotos(added))throw Error(ui('One photo is too large. Choose a smaller image.', 'Isithombe esisodwa sikhulu kakhulu. Khetha isithombe esincane.'));
      if(alive.current&&scope===currentScope())onChange({...value,photos:[...existing,...added]});
    }catch(e){if(alive.current&&scope===currentScope())setError((e as Error).message);}finally{if(alive.current&&scope===currentScope())setBusy(false);}
  }
  async function clean() {
    if(disabled)return;
    const scope=currentScope(),actor=user;
    setError('');setSuggestion('');
    if(disabledAiFeatures().includes('notes')){setError(ui('Visit-note AI is off in Settings. You can still edit or dictate your notes.', 'I-AI yokulungisa amanothi okuvakasha icishiwe kuzilungiselelo. Usengawahlela noma uwasho amanothi akho.'));return;}
    if(isSampleMode()){setError(ui('AI cleanup is available for your signed-in visits. Practise typing or dictating here without a charge.', 'Ukuhlanzwa kwamanothi nge-AI kuyatholakala ekuvakasheni okungene ku-akhawunti yakho. Zilolonge ukubhala noma ukusho amanothi lapha mahhala.'));return;}
    original.current=value.notes;setBusy(true);
    try {
      if(!actor || getFirebase()?.auth.currentUser?.uid!==actor.uid)throw Error(ui('Sign in again before cleaning up these notes.', 'Ngena futhi ngaphambi kokulungisa la manothi.'));
      const headers=await paidApiHeaders(actor);
      if(!alive.current||scope!==currentScope()||isSampleMode())return;
      const response=await fetch('/api/visit-notes',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({notes:value.notes})});
      const result=await response.json();if(!response.ok)throw Error(result.error);
      if(alive.current&&scope===currentScope())setSuggestion(result.notes);
    }catch(e){if(alive.current&&scope===currentScope())setError((e as Error).message);}finally{if(alive.current&&scope===currentScope())setBusy(false);}
  }
  return <fieldset disabled={disabled||busy} style={{border:0,padding:0,margin:'16px 0'}}>
    {lang === 'zu' && <p role="note" style={{fontSize:12,lineHeight:1.5}}>{ui('isiZulu wording is an unreviewed draft. User-entered notes are kept as written.', 'Umbhalo wesiZulu uwuhlaka olungakabuyekezwa. Amanothi owafakayo agcinwa njengoba ewabhalile.')}</p>}
    <details style={{marginBottom:16}}><summary style={{minHeight:44,cursor:'pointer'}}>{ui('Speak your visit notes on your phone', 'Shono amanothi okuvakasha ngocingo lwakho')}</summary><ol style={{paddingLeft:24,lineHeight:1.7}}><li>{ui('Tap the notes box, then the microphone on your phone’s keyboard.', 'Thepha ibhokisi lamanothi, bese uthinta imakrofoni kukhibhodi yocingo.')}</li><li>{ui('Say what you saw, what you did, any measurements, and what needs attention.', 'Shono okubonile, okwenzile, izilinganiso ozithathile nokudinga ukunakwa.')}</li><li>{ui('Finish with who will do what and the follow-up date. Check names and numbers before saving.', 'Qeda ngokuthi ubani ozokwenza ini nosuku lokulandelela. Hlola amagama nezinombolo ngaphambi kokugcina.')}</li></ol><p>{ui('No app AI charge for keyboard dictation. Your phone may need dictation enabled and an internet connection.', 'Ukusho usebenzisa ikhibhodi akukhokhisi i-AI yohlelo lokusebenza. Ucingo lungadinga ukuvulwa kokubizela umbhalo noxhumano lwe-inthanethi.')}</p><button type="button" onClick={()=>text.current?.focus()} style={{minHeight:44}}>{ui('Start in the notes box', 'Qala ebhokisini lamanothi')}</button></details>
    <label>{ui('Visit outcome and follow-up', 'Umphumela wokuvakasha nokulandelela')}<textarea ref={text} required={notesRequired} maxLength={4000} value={value.notes} onChange={e=>{onChange({...value,notes:e.target.value});setSuggestion('');}} placeholder={ui('Observed… Work completed… Measurements… Support needed… Next action, owner and date…', 'Okubonile… Umsebenzi oqediwe… Izilinganiso… Usizo oludingekayo… Isinyathelo esilandelayo, umenzi nosuku…')} style={{minHeight:140}}/></label>
    <button type="button" disabled={!value.notes.trim()} onClick={()=>void clean()} style={{minHeight:44}}>{ui('Clean up my notes · optional AI', 'Lungisa amanothi ami · i-AI ongayikhetha')}</button><p style={{fontSize:13}}>{ui('Only your notes are sent for cleanup. Review the suggestion before using it; photos are not sent.', 'Amanothi akho kuphela athunyelwa ukuyolungiswa. Buyekeza isiphakamiso ngaphambi kokusisebenzisa; izithombe azithunyelwa.')}</p>
    {suggestion&&<section style={{margin:'16px 0',padding:16,border:'1px solid var(--border)',borderRadius:12}}><h3>{ui('Review the suggested wording', 'Buyekeza umbhalo ophakanyisiwe')}</h3><p style={{whiteSpace:'pre-wrap'}}>{suggestion}</p><button type="button" onClick={()=>{onChange({...value,notes:suggestion,originalNotes:original.current});setSuggestion('');}} style={{minHeight:44}}>{ui('Use this wording', 'Sebenzisa lo mbhalo')}</button><button type="button" onClick={()=>setSuggestion('')} style={{minHeight:44}}>{ui('Keep original', 'Gcina owokuqala')}</button></section>}
    <label style={{display:'block',marginTop:16}}>{ui('Visit photos · up to 3', 'Izithombe zokuvakasha · kufika kwezintathu')}<input type="file" accept="image/*" capture="environment" onChange={e=>{void photos(e.target.files);e.target.value='';}}/></label>
    <label style={{display:'block'}}>{ui('Choose existing photos', 'Khetha izithombe ezikhona')}<input type="file" accept="image/*" multiple onChange={e=>{void photos(e.target.files);e.target.value='';}}/></label>
    <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>{(value.photos??[]).map((photo,index)=><figure key={index} style={{width:180}}><img src={photo.image} alt={ui(`Visit photo ${index+1}`, `Isithombe sokuvakasha ${index+1}`)} style={{width:180,height:130,objectFit:'cover',borderRadius:10}}/><input aria-label={ui(`Caption for photo ${index+1}`, `Incazelo yesithombe ${index+1}`)} required maxLength={200} value={photo.caption} onChange={e=>onChange({...value,photos:value.photos?.map((p,i)=>i===index?{...p,caption:e.target.value}:p)})} placeholder={ui('What does this show?', 'Sibonisani lesi sithombe?')}/><button type="button" onClick={()=>onChange({...value,photos:value.photos?.filter((_,i)=>i!==index)})} style={{minHeight:44}}>{ui('Remove photo', 'Susa isithombe')}</button></figure>)}</div>
    {busy&&<p role="status">{ui('Preparing…', 'Kuyalungiselelwa…')}</p>}{error&&<p role="alert">{error}</p>}
  </fieldset>;
}

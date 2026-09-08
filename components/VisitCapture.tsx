'use client';
import { useEffect, useRef, useState } from 'react';
import { resizeForStorage } from '@/lib/site-evidence';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { disabledAiFeatures } from '@/lib/ai-preferences';
import { isSampleMode } from '@/lib/sample-mode';
import { validVisitPhotos, type VisitPhoto } from '@/lib/field-teams';
export type VisitCaptureValue = { notes: string; originalNotes?: string; photos?: VisitPhoto[] };
export default function VisitCapture({ value, onChange, disabled=false, onBusyChange }: { value: VisitCaptureValue; onChange: (value:VisitCaptureValue)=>void; disabled?:boolean; onBusyChange?: (busy:boolean)=>void }) {
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [suggestion,setSuggestion]=useState('');
  useEffect(()=>{onBusyChange?.(busy);},[busy,onBusyChange]);
  const original=useRef('');
  const text=useRef<HTMLTextAreaElement>(null);
  async function photos(files:FileList|null) {
    if(!files)return;
    setBusy(true);setError('');
    try {
      const existing=value.photos??[];
      if(existing.length+files.length>3)throw Error('Attach up to three photos per visit.');
      const next=[...existing];
      for(const file of Array.from(files)) {
        if(file.size>15*1024*1024)throw Error('Choose a photo smaller than 15 MB.');
        let image=await resizeForStorage(file,800);
        if(image.length>150000)image=await resizeForStorage(file,500);
        next.push({image,caption:''});
      }
      if(!validVisitPhotos(next))throw Error('One photo is too large. Choose a smaller image.');
      onChange({...value,photos:next});
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function clean() {
    setError('');setSuggestion('');
    if(disabledAiFeatures().includes('notes')){setError('Visit-note AI is off in Settings. You can still edit or dictate your notes.');return;}
    if(isSampleMode()){setError('AI cleanup is available for your signed-in visits. Practise typing or dictating here without a charge.');return;}
    original.current=value.notes;setBusy(true);
    try {
      const response=await fetch('/api/visit-notes',{method:'POST',headers:{...(await paidApiHeaders()),'Content-Type':'application/json'},body:JSON.stringify({notes:value.notes})});
      const result=await response.json();if(!response.ok)throw Error(result.error);
      setSuggestion(result.notes);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <fieldset disabled={disabled||busy} style={{border:0,padding:0,margin:'16px 0'}}>
    <details style={{marginBottom:16}}><summary style={{minHeight:44,cursor:'pointer'}}>Speak your visit notes on your phone</summary><ol style={{paddingLeft:24,lineHeight:1.7}}><li>Tap the notes box, then the microphone on your phone’s keyboard.</li><li>Say what you saw, what you did, any measurements, and what needs attention.</li><li>Finish with who will do what and the follow-up date. Check names and numbers before saving.</li></ol><p>No app AI charge for keyboard dictation. Your phone may need dictation enabled and an internet connection.</p><button type="button" onClick={()=>text.current?.focus()} style={{minHeight:44}}>Start in the notes box</button></details>
    <label>Visit outcome and follow-up<textarea ref={text} required maxLength={4000} value={value.notes} onChange={e=>{onChange({...value,notes:e.target.value});setSuggestion('');}} placeholder="Observed… Work completed… Measurements… Support needed… Next action, owner and date…" style={{minHeight:140}}/></label>
    <button type="button" disabled={!value.notes.trim()} onClick={()=>void clean()} style={{minHeight:44}}>Clean up my notes · optional AI</button><p style={{fontSize:13}}>Only your notes are sent for cleanup. Review the suggestion before using it; photos are not sent.</p>
    {suggestion&&<section style={{margin:'16px 0',padding:16,border:'1px solid var(--border)',borderRadius:12}}><h3>Review the suggested wording</h3><p style={{whiteSpace:'pre-wrap'}}>{suggestion}</p><button type="button" onClick={()=>{onChange({...value,notes:suggestion,originalNotes:original.current});setSuggestion('');}} style={{minHeight:44}}>Use this wording</button><button type="button" onClick={()=>setSuggestion('')} style={{minHeight:44}}>Keep original</button></section>}
    <label style={{display:'block',marginTop:16}}>Visit photos · up to 3<input type="file" accept="image/*" capture="environment" onChange={e=>{void photos(e.target.files);e.target.value='';}}/></label>
    <label style={{display:'block'}}>Choose existing photos<input type="file" accept="image/*" multiple onChange={e=>{void photos(e.target.files);e.target.value='';}}/></label>
    <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>{(value.photos??[]).map((photo,index)=><figure key={index} style={{width:180}}><img src={photo.image} alt={`Visit photo ${index+1}`} style={{width:180,height:130,objectFit:'cover',borderRadius:10}}/><input aria-label={`Caption for photo ${index+1}`} maxLength={200} value={photo.caption} onChange={e=>onChange({...value,photos:value.photos?.map((p,i)=>i===index?{...p,caption:e.target.value}:p)})} placeholder="What does this show?"/><button type="button" onClick={()=>onChange({...value,photos:value.photos?.filter((_,i)=>i!==index)})} style={{minHeight:44}}>Remove photo</button></figure>)}</div>
    {busy&&<p role="status">Preparing…</p>}{error&&<p role="alert">{error}</p>}
  </fieldset>;
}

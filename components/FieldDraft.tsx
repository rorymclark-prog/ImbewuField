'use client';
import { useEffect, useState } from 'react';
import { fieldDeviceStore } from '@/lib/field-device-store';
import { fieldIdentity, fieldScope } from '@/lib/field-session';
import { isSampleMode } from '@/lib/sample-mode';
import { useAuth } from '@/lib/auth';
function draftKey(name: string) { const identity=fieldIdentity(); if(!identity||isSampleMode())return null;const scope=fieldScope(identity);return {scope,key:`${scope}|draft|${name}`}; }
export async function clearFieldDraft(name: string) { const identity=draftKey(name);if(identity)await fieldDeviceStore.change(identity.key,()=>undefined); }
export default function FieldDraft<T>({ name, value, onRestore }: { name:string;value:T|null;onRestore:(value:T)=>void }) {
  const {user,profile}=useAuth(); const [stored,setStored]=useState<T|null>(null),[storedKey,setStoredKey]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{let alive=true;setStored(null);setMessage('');const id=draftKey(name);if(id)void fieldDeviceStore.get(id.key).then(row=>{if(alive){setStored(row?.value??null);setStoredKey(id.key);}}).catch(()=>{});return()=>{alive=false;};},[name,user?.uid,profile?.org_id,profile?.role]);
  if(isSampleMode()||!user)return null;
  async function save(){const id=draftKey(name);if(!id||!value)return;setBusy(true);try{await fieldDeviceStore.change(id.key,()=>({ ...id,kind:'draft',value }));if(draftKey(name)?.key===id.key){setStored(value);setStoredKey(id.key);setMessage('Draft saved on this device, including photos and signatures. Submit the completed record when ready.');}}catch{setMessage('Draft could not be saved. Keep this form open.');}finally{setBusy(false);}}
  return <div style={{margin:'12px 0',fontSize:14}}>{value&&<button type="button" disabled={busy} onClick={()=>void save()} style={{minHeight:44}}>Save unfinished draft on this device</button>}{stored&&storedKey===draftKey(name)?.key&&<button type="button" disabled={busy} onClick={()=>{if(storedKey!==draftKey(name)?.key)return;onRestore(stored);setMessage('Saved draft restored. Check it before submitting.');}} style={{minHeight:44}}>Restore saved draft</button>}{message&&<p role="status">{message}</p>}</div>;
}

'use client';
import { useEffect,useState } from 'react';
import { currentFieldClient } from '@/lib/field-api';
import { FIELD_CHANGED } from '@/lib/field-request-model';
import { useAuth } from '@/lib/auth';
import { isSampleMode } from '@/lib/sample-mode';
export default function FieldSyncBadge(){
  const {user,profile}=useAuth();const [online,setOnline]=useState(true),[count,setCount]=useState(0);
  useEffect(()=>{let alive=true;const update=()=>{setOnline(navigator.onLine);if(!user||isSampleMode()){setCount(0);return;}try{void currentFieldClient().writes().then(rows=>{if(alive)setCount(rows.length);}).catch(()=>{});}catch{setCount(0);}};update();window.addEventListener('online',update);window.addEventListener('offline',update);window.addEventListener(FIELD_CHANGED,update);return()=>{alive=false;window.removeEventListener('online',update);window.removeEventListener('offline',update);window.removeEventListener(FIELD_CHANGED,update);};},[user?.uid,profile?.org_id,profile?.role]);
  if(online&&!count)return null;
  return <a href="/offline" style={{minHeight:44,display:'inline-flex',alignItems:'center',padding:'4px 8px',fontSize:13,fontWeight:700,color:'var(--text-primary)',border:'1px solid var(--border)',borderRadius:12}}>{!online?'Offline':`${count} waiting`}</a>;
}

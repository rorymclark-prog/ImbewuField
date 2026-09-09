'use client';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { currentFieldClient } from '@/lib/field-api';
import { isSampleMode, SAMPLE_MODE_EVENT } from '@/lib/sample-mode';
export default function FieldSyncRunner() {
  const {user,profile}=useAuth();
  useEffect(()=>{
    let alive=true,running=false;
    const sync=async()=>{if(!alive||running||!navigator.onLine||!user||isSampleMode())return;running=true;try{await currentFieldClient().sync();}catch{/* Entries remain on the device; Offline & sync exposes the reason. */}finally{running=false;}};
    void sync();const interval=setInterval(()=>void sync(),30000);
    window.addEventListener('online',sync);window.addEventListener('focus',sync);window.addEventListener(SAMPLE_MODE_EVENT,sync);
    return()=>{alive=false;clearInterval(interval);window.removeEventListener('online',sync);window.removeEventListener('focus',sync);window.removeEventListener(SAMPLE_MODE_EVENT,sync);};
  },[user?.uid,profile?.org_id,profile?.role]);
  return null;
}

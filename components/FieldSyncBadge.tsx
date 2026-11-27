'use client';
import { useEffect,useRef,useState } from 'react';
import { currentFieldClient } from '@/lib/field-api';
import { FIELD_CHANGED } from '@/lib/field-request-model';
import { useAuth } from '@/lib/auth';
import { isSampleMode } from '@/lib/sample-mode';
import { useLanguage } from '@/lib/i18n';
import { sampleWorkspaceText } from '@/lib/sample-tour-localization';
import styles from './FieldSyncBadge.module.css';

// How long the "synced" tick stays after the last waiting entry has gone out.
const SYNCED_HOLD_MS = 2400;
// The outgoing label stays this long underneath the incoming one while they cross-fade.
const CROSS_FADE_MS = 220;
const cx=(...names:Array<string|undefined|false>)=>names.filter(Boolean).join(' ');

export default function FieldSyncBadge(){
  const {t,lang}=useLanguage();
  const {user,profile}=useAuth();const [online,setOnline]=useState(true),[count,setCount]=useState(0);
  useEffect(()=>{let alive=true;const update=()=>{setOnline(navigator.onLine);if(!user||isSampleMode()){setCount(0);return;}try{void currentFieldClient().writes().then(rows=>{if(alive)setCount(rows.length);}).catch(()=>{});}catch{setCount(0);}};update();window.addEventListener('online',update);window.addEventListener('offline',update);window.addEventListener(FIELD_CHANGED,update);return()=>{alive=false;window.removeEventListener('online',update);window.removeEventListener('offline',update);window.removeEventListener(FIELD_CHANGED,update);};},[user?.uid,profile?.org_id,profile?.role]);

  // "Synced" appears once, only when the real queue goes from some waiting entries to none while
  // online. It is never shown on first load, and it is not a spinner: it holds, then leaves.
  const previousCount=useRef(0);
  const [synced,setSynced]=useState(false);
  useEffect(()=>{
    const was=previousCount.current;previousCount.current=count;
    if(!online||count>0){setSynced(false);return;}
    if(was>0){setSynced(true);const timer=setTimeout(()=>setSynced(false),SYNCED_HOLD_MS);return()=>clearTimeout(timer);}
  },[count,online]);

  const kind=!online?'offline':count>0?'waiting':synced?'synced':null;
  const label=kind==='offline'?t('offlineBadgeOffline'):kind==='waiting'?t('offlineBadgeWaiting').replace('{count}',String(count)):kind==='synced'?sampleWorkspaceText(lang,'Synced','Kuvumelanisiwe'):null;

  // The label that was showing a moment ago sits under the new one and fades out. It is drawn from
  // a data attribute, so it is never read out and never counts as the badge's text.
  const lastLabel=useRef<string|null>(null);
  const [leaving,setLeaving]=useState<string|null>(null);
  useEffect(()=>{
    const before=lastLabel.current;lastLabel.current=label;
    if(!before||!label||before===label){setLeaving(null);return;}
    setLeaving(before);const timer=setTimeout(()=>setLeaving(null),CROSS_FADE_MS);return()=>clearTimeout(timer);
  },[label]);

  if(!kind||!label)return null;
  return <a lang={lang} href="/offline" aria-live="polite" className={cx(styles.badge,styles[kind])} style={{minHeight:44,display:'inline-flex',alignItems:'center',padding:'4px 8px',fontSize:13,fontWeight:700,color:'var(--text-primary)',border:'1px solid var(--border)',borderRadius:12}}>
    <span className={styles.stack}>
      {leaving&&<span className={styles.leaving} data-label={leaving} aria-hidden="true"/>}
      <span key={label} className={styles.enter}>
        {kind==='synced'&&<svg className={styles.tick} viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M3 8.4l3.2 3.2L13 4.8" pathLength={1}/></svg>}
        {label}
      </span>
    </span>
  </a>;
}

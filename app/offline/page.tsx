'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import { useAuth } from '@/lib/auth';
import { fieldApi,currentFieldClient } from '@/lib/field-api';
import { fieldDeviceStore,type DeviceRow } from '@/lib/field-device-store';
import { FIELD_CHANGED,FIELD_SYNCED,type FieldWrite } from '@/lib/field-request-model';
import { fieldIdentity,fieldScope } from '@/lib/field-session';
import { FIELD_PAGE_NAMES,fieldPageDownloads,type FieldPageStatus } from '@/lib/field-page-downloads';
import { canSeeNavLink } from '@/lib/role-access';
import { isSampleMode } from '@/lib/sample-mode';
import { translate, useLanguage } from '@/lib/i18n';

const PAGE_NAME_KEYS: Record<string, string> = {
  '/home': 'offlinePageHome', '/offline': 'offlinePageOffline', '/farmer': 'offlinePageFarmer',
  '/student': 'offlinePageLessons', '/records': 'offlinePageRecords', '/invoice': 'offlinePageInvoices',
  '/journal': 'offlinePageJournal', '/facilitator/crops': 'offlinePageCropPlan', '/cropplan': 'offlinePageGardenTasks',
  '/reports': 'offlinePageReports', '/design': 'offlinePageDesign', '/calendar': 'offlinePageCalendar',
  '/assessments': 'offlinePageAssessments', '/mentor': 'offlinePageMentor', '/ngo': 'offlinePageOrganisation',
  '/funder': 'offlinePageFunder', '/network': 'offlinePagePortfolio',
};

const OFFLINE_ERROR_KEYS: Record<string, string> = {
  'This browser cannot prepare the app for offline use.': 'offlineErrorUnsupportedBrowser',
  'The app is still preparing its first offline start. Keep it open with a connection and try again.': 'offlineErrorFirstStart',
  'Preparation timed out. Keep the app open with a connection and retry.': 'offlineErrorPrepareTimeout',
  'The workspace changed. Prepare again in the current account.': 'offlineErrorWorkspaceChanged',
  'This entry is sending. Wait before removing it.': 'offlineErrorEntrySending',
  'This service is not available for device saving.': 'offlineErrorServiceUnavailable',
  'Sign in and open your workspace before saving fieldwork on this device.': 'offlineErrorSignInRequired',
  'The account or organisation changed. Reopen your workspace.': 'offlineErrorAccountChanged',
  'Connection timed out.': 'offlineErrorConnectionTimeout',
};
const WRITE_LABEL_KEYS: Record<string, string> = {
  'Training register': 'offlineLabelTrainingRegister',
  'Programme indicator': 'offlineLabelProgrammeIndicator',
  'Garden observation': 'offlineLabelGardenObservation',
  'Assessment response': 'offlineLabelAssessmentResponse',
};
const OFFLINE_PROGRESS_KEYS = ['offlinePreparingPages','offlineSavingFieldwork','offlinePreparationGaps','offlinePreparationComplete','offlineSyncComplete'];

export default function OfflinePage(){
  const { t, lang } = useLanguage();
  const {user,profile,role}=useAuth();
  const [online,setOnline]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const [pages,setPages]=useState<Record<string,FieldPageStatus>>({}),[rows,setRows]=useState<DeviceRow[]>([]),[confirmDiscard,setConfirmDiscard]=useState('');
  const paths=Object.keys(FIELD_PAGE_NAMES).filter(path=>canSeeNavLink(role,path));
  const showError = (message: string) => {
    const key = OFFLINE_ERROR_KEYS[message];
    return key ? t(key) : message;
  };
  const source = (key: string) => lang==='zu' ? <details style={{marginTop:6}}><summary style={{minHeight:32,cursor:'pointer'}}>English source</summary><p style={{margin:'4px 0'}}>{translate('en',key)}</p></details> : null;
  const actionLabel = (key: string) => lang==='zu' ? `${t(key)} (${translate('en',key)})` : t(key);
  const englishError = lang==='zu' ? Object.entries(OFFLINE_ERROR_KEYS).find(([,key])=>t(key)===error)?.[0] : undefined;
  const messageKey = OFFLINE_PROGRESS_KEYS.find(key=>t(key)===message);
  const pageName = (path: string) => t(PAGE_NAME_KEYS[path] ?? 'offlineUnknownPage');
  const writeLabel = (label: string) => {
    const visitDate = label.match(/^Visit · (.*)$/);
    if (visitDate) return `${t('offlineLabelVisit')}${visitDate[1] ? ` · ${visitDate[1]}` : ''}`;
    return WRITE_LABEL_KEYS[label] ? t(WRITE_LABEL_KEYS[label]) : label;
  };
  async function refresh(){const identity=fieldIdentity();if(!identity||isSampleMode()){setRows([]);return;}const scope=fieldScope(identity);const result=await fieldDeviceStore.all(scope);if(fieldIdentity()&&fieldScope(fieldIdentity()!)===scope)setRows(result);}
  useEffect(()=>{let alive=true;const update=()=>{setOnline(navigator.onLine);void refresh().catch(e=>{if(alive)setError(showError(e.message));});};update();void fieldPageDownloads(false,paths,p=>{if(alive)setPages(current=>({...current,[p.path]:p}));}).catch(()=>{});window.addEventListener('online',update);window.addEventListener('offline',update);window.addEventListener(FIELD_CHANGED,update);return()=>{alive=false;window.removeEventListener('online',update);window.removeEventListener('offline',update);window.removeEventListener(FIELD_CHANGED,update);};},[user?.uid,profile?.org_id,role]); // eslint-disable-line react-hooks/exhaustive-deps
  async function prepare(){
    setBusy(true);setError('');setMessage(t('offlinePreparingPages'));
    const failed:string[]=[];
    const started=fieldIdentity(),scopeAtStart=started?fieldScope(started):null,sampleAtStart=isSampleMode();
    const assertScope=()=>{const current=fieldIdentity();if((current?fieldScope(current):null)!==scopeAtStart||isSampleMode()!==sampleAtStart)throw Error('The workspace changed. Prepare again in the current account.');};
    try{
      await fieldPageDownloads(true,paths,p=>{setPages(current=>({...current,[p.path]:p}));setMessage(t('offlinePreparingNamedPage').replace('{page}',pageName(p.path)));if(!p.ready||p.error)failed.push(pageName(p.path));});
      assertScope();
      if(user&&!isSampleMode()){
        setMessage(t('offlineSavingFieldwork'));
        let orgs:{id:string}[]=profile?.org_id?[{id:profile.org_id}]:[];
        try{const response=await fieldApi('/api/network/orgs');orgs=response.orgs??orgs;}catch{/* Farmer/mentor accounts may not have this portfolio endpoint. */}
        for(const org of orgs){
          assertScope();
          const q=`?org=${encodeURIComponent(org.id)}`;
          if(['ngo','admin','funder'].includes(role??''))try{await fieldApi(`/api/network/farmers?org_id=${encodeURIComponent(org.id)}`);}catch{failed.push(t('offlinePortfolio'));}
          const urls=role==='mentor'?['/api/field-teams','/api/programme-evidence','/api/assessments']:role==='farmer'||role==='student'?['/api/assessments']:['/api/field-teams','/api/programme-evidence','/api/assessments','/api/production-sites'];
          for(const path of urls)try{
            assertScope();
            let data=await fieldApi(path+q);
            // Download every available visit page and its evidence. Do not call one page
            // a complete field pack. The server still checks each organisation/assignment.
            if(path==='/api/field-teams'){
              const visits=[...(data.visits??[])];let cursor=data.visitCursor;
              while(cursor){data=await fieldApi(path+q+`&cursor=${encodeURIComponent(cursor)}`);visits.push(...data.visits);cursor=data.visitCursor;}
              for(const v of new Map(visits.map(v=>[v.id,v])).values())if(v.photoCount)await fieldApi(path+q+`&mode=photos&id=${encodeURIComponent(v.id)}`);
            }
            if(path==='/api/programme-evidence')for(const s of data.sessions??[])if(s.photoCount)await fieldApi(path+q+`&mode=photos&id=${encodeURIComponent(s.id)}`);
          }catch{failed.push(pageName(path));}
        }
      }
      await navigator.storage?.persist?.().catch(()=>false);await refresh();
      setMessage(failed.length?t('offlinePreparationGaps'):t('offlinePreparationComplete'));
      if(failed.length)setError(failed.join('\n'));
    }catch(e){setError(showError((e as Error).message));}finally{setBusy(false);}
  }
  async function sync(){setBusy(true);setError('');try{await currentFieldClient().sync();await refresh();setMessage(t('offlineSyncComplete'));}catch(e){setError(showError((e as Error).message));}finally{setBusy(false);}}
  function download(row:DeviceRow){const blob=new Blob([JSON.stringify(row.value,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`imbewu-unsent-${row.value.operationId??'draft'}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function discard(row:DeviceRow){const id=fieldIdentity();if(!id||row.scope!==fieldScope(id))return;await fieldDeviceStore.change(row.key,current=>{if(current?.value.state==='sending'&&current.value.leaseUntil>Date.now())throw Error('This entry is sending. Wait before removing it.');return undefined;});setConfirmDiscard('');await refresh();window.dispatchEvent(new Event(FIELD_CHANGED));window.dispatchEvent(new Event(FIELD_SYNCED));}
  const identity=fieldIdentity(),activeScope=identity?fieldScope(identity):null;
  const writes=rows.filter(row=>row.scope===activeScope&&row.kind==='write'),cached=rows.filter(row=>row.scope===activeScope&&row.kind==='cache');
  const card={border:'1px solid var(--border)',borderRadius:16,padding:20,marginTop:18,background:'var(--bg-1)'};
  const button={minHeight:44,padding:'8px 14px',border:'1px solid var(--border)',borderRadius:10,marginRight:8};
  return <main style={{height:'100%',overflowY:'auto',background:'var(--bg-0)',color:'var(--text-primary)'}}><div style={{maxWidth:880,margin:'0 auto',padding:'18px 18px 90px'}}>
    {lang==='zu'&&<p role="note" style={{...card,marginTop:0,background:'var(--bg-2)'}}>{t('offlineZuluDraftNotice')}</p>}
    <header style={{display:'flex',alignItems:'center',gap:12}}><MenuButton/><BackButton/><h1 style={{fontSize:28,margin:0}}>{t('offlineTitle')}</h1></header>
    <div role="status"><strong>{online?(lang==='zu'?`${t('offlineConnected')} (Connected)`:t('offlineConnected')):t('offlineUsingSavedCopies')}</strong>{!online&&source('offlineUsingSavedCopies')}{writes.length?<> · {t('offlineEntriesWaiting').replace('{count}',String(writes.length))}{source('offlineEntriesWaiting')}</>:''}</div>
    <section style={card}><h2>{t('offlineBeforeLeavingSignal')}</h2><p>{t('offlinePrepareDescription')}</p>{source('offlinePrepareDescription')}<button style={button} disabled={!online||busy} onClick={()=>void prepare()}>{busy?actionLabel('offlineWorking'):actionLabel('offlinePrepareButton')}</button><p>{t('offlineLessonDownloads')} <Link href="/student">{actionLabel('offlineStudyLink')}</Link>. {t('offlineOpenToolsOnce')}</p>{source('offlineLessonDownloads')}{source('offlineOpenToolsOnce')}
      <details><summary style={{minHeight:44,cursor:'pointer'}}>{t('offlinePageReadiness').replace('{ready}',String(paths.filter(path=>pages[path]?.ready).length)).replace('{total}',String(paths.length))}</summary><ul>{paths.map(path=><li key={path}><a href={path}>{pageName(path)}</a> — {pages[path]?.ready?t('offlineStartupFilesSaved'):t('offlineNotConfirmed')}{source(pages[path]?.ready?'offlineStartupFilesSaved':'offlineNotConfirmed')}</li>)}</ul><p>{t('offlineReadinessLimit')}</p>{source('offlineReadinessLimit')}</details>
    </section>
    <section style={card}><h2>{t('offlineSavedEntriesTitle')}</h2>{source('offlineSavedEntriesTitle')}<p>{t('offlineSavedEntriesDescription')}</p>{source('offlineSavedEntriesDescription')}<button style={button} disabled={!online||busy||!user||isSampleMode()} onClick={()=>void sync()}>{actionLabel('offlineSyncNow')}</button>{!writes.length&&<><p>{t('offlineQueueEmpty')}</p>{source('offlineQueueEmpty')}</>}
      {writes.map(row=>{const w=row.value as FieldWrite;const stateKey=w.state==='review'?'offlineNeedsReview':w.state==='sending'?'offlineSending':'offlineWaitingToSend';const errorSource=Object.entries(OFFLINE_ERROR_KEYS).find(([message])=>message===w.error)?.[1];return <article key={row.key} style={{borderTop:'1px solid var(--border)',marginTop:16,paddingTop:12}}><h3>{writeLabel(w.label)}</h3><p>{t(stateKey)}</p>{source(stateKey)}{w.error&&<><p>{showError(w.error)}</p>{errorSource&&source(errorSource)}</>}<button style={button} onClick={()=>download(row)}>{actionLabel('offlineDownloadCopy')}</button>{confirmDiscard===row.key?<><p>{t('offlineRemoveConfirm')}</p>{source('offlineRemoveConfirm')}<button style={button} onClick={()=>void discard(row).catch(e=>setError(showError(e.message)))}>{actionLabel('offlineRemoveQueuedChange')}</button><button style={button} onClick={()=>setConfirmDiscard('')}>{actionLabel('offlineKeepEntry')}</button></>:<button style={button} onClick={()=>setConfirmDiscard(row.key)}>{actionLabel('offlineReviewRemove')}</button>}{w.state==='review'&&<><p>{t('offlineConflictHelp')}</p>{source('offlineConflictHelp')}</>}</article>;})}
    </section>
    <section style={card}><h2>{t('offlineAvailableTitle')}</h2><p>{t('offlineCachedCount').replace('{count}',String(cached.length))}</p>{source('offlineCachedCount')}<p>{t('offlineAvailableDescription')}</p>{source('offlineAvailableDescription')}<p>{t('offlineDeviceSafety')}</p>{source('offlineDeviceSafety')}</section>
    {message&&<><p role="status" style={card}>{message}</p>{messageKey&&source(messageKey)}</>}{error&&<div role="alert" style={{...card,whiteSpace:'pre-wrap'}}>{error}{englishError&&source(OFFLINE_ERROR_KEYS[englishError])}</div>}
  </div></main>;
}

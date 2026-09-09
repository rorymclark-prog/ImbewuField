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

export default function OfflinePage(){
  const {user,profile,role}=useAuth();
  const [online,setOnline]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const [pages,setPages]=useState<Record<string,FieldPageStatus>>({}),[rows,setRows]=useState<DeviceRow[]>([]),[confirmDiscard,setConfirmDiscard]=useState('');
  const paths=Object.keys(FIELD_PAGE_NAMES).filter(path=>canSeeNavLink(role,path));
  async function refresh(){const identity=fieldIdentity();if(!identity||isSampleMode()){setRows([]);return;}const scope=fieldScope(identity);const result=await fieldDeviceStore.all(scope);if(fieldIdentity()&&fieldScope(fieldIdentity()!)===scope)setRows(result);}
  useEffect(()=>{let alive=true;const update=()=>{setOnline(navigator.onLine);void refresh().catch(e=>{if(alive)setError(e.message);});};update();void fieldPageDownloads(false,paths,p=>{if(alive)setPages(current=>({...current,[p.path]:p}));}).catch(()=>{});window.addEventListener('online',update);window.addEventListener('offline',update);window.addEventListener(FIELD_CHANGED,update);return()=>{alive=false;window.removeEventListener('online',update);window.removeEventListener('offline',update);window.removeEventListener(FIELD_CHANGED,update);};},[user?.uid,profile?.org_id,role]); // eslint-disable-line react-hooks/exhaustive-deps
  async function prepare(){
    setBusy(true);setError('');setMessage('Preparing app pages…');
    const failed:string[]=[];
    const started=fieldIdentity(),scopeAtStart=started?fieldScope(started):null,sampleAtStart=isSampleMode();
    const assertScope=()=>{const current=fieldIdentity();if((current?fieldScope(current):null)!==scopeAtStart||isSampleMode()!==sampleAtStart)throw Error('The workspace changed. Prepare again in the current account.');};
    try{
      await fieldPageDownloads(true,paths,p=>{setPages(current=>({...current,[p.path]:p}));setMessage(`Preparing ${FIELD_PAGE_NAMES[p.path]??p.path}…`);if(!p.ready||p.error)failed.push(FIELD_PAGE_NAMES[p.path]??p.path);});
      assertScope();
      if(user&&!isSampleMode()){
        setMessage('Saving authorised fieldwork information…');
        let orgs:{id:string}[]=profile?.org_id?[{id:profile.org_id}]:[];
        try{const response=await fieldApi('/api/network/orgs');orgs=response.orgs??orgs;}catch{/* Farmer/mentor accounts may not have this portfolio endpoint. */}
        for(const org of orgs){
          assertScope();
          const q=`?org=${encodeURIComponent(org.id)}`;
          if(['ngo','admin','funder'].includes(role??''))try{await fieldApi(`/api/network/farmers?org_id=${encodeURIComponent(org.id)}`);}catch(e){failed.push(`Portfolio: ${(e as Error).message}`);}
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
          }catch(e){failed.push(`${path.split('/').pop()}: ${(e as Error).message}`);}
        }
      }
      await navigator.storage?.persist?.().catch(()=>false);await refresh();
      setMessage(failed.length?'Preparation finished with gaps. Read the list below before leaving signal.':'Pages and available fieldwork records are saved on this device. Test reopening without signal before travelling.');
      if(failed.length)setError(failed.join('\n'));
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function sync(){setBusy(true);setError('');try{await currentFieldClient().sync();await refresh();setMessage('Sync attempt finished. Any entries still listed below remain on this device.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  function download(row:DeviceRow){const blob=new Blob([JSON.stringify(row.value,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`imbewu-unsent-${row.value.operationId??'draft'}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function discard(row:DeviceRow){const id=fieldIdentity();if(!id||row.scope!==fieldScope(id))return;await fieldDeviceStore.change(row.key,current=>{if(current?.value.state==='sending'&&current.value.leaseUntil>Date.now())throw Error('This entry is sending. Wait before removing it.');return undefined;});setConfirmDiscard('');await refresh();window.dispatchEvent(new Event(FIELD_CHANGED));window.dispatchEvent(new Event(FIELD_SYNCED));}
  const identity=fieldIdentity(),activeScope=identity?fieldScope(identity):null;
  const writes=rows.filter(row=>row.scope===activeScope&&row.kind==='write'),cached=rows.filter(row=>row.scope===activeScope&&row.kind==='cache');
  const card={border:'1px solid var(--border)',borderRadius:16,padding:20,marginTop:18,background:'var(--bg-1)'};
  const button={minHeight:44,padding:'8px 14px',border:'1px solid var(--border)',borderRadius:10,marginRight:8};
  return <main style={{height:'100%',overflowY:'auto',background:'var(--bg-0)',color:'var(--text-primary)'}}><div style={{maxWidth:880,margin:'0 auto',padding:'18px 18px 90px'}}>
    <header style={{display:'flex',alignItems:'center',gap:12}}><MenuButton/><BackButton/><h1 style={{fontSize:28,margin:0}}>Offline & sync</h1></header>
    <p role="status"><strong>{online?'Connected':'Offline — using this device’s saved copies'}</strong>{writes.length?` · ${writes.length} entries waiting to send`:''}</p>
    <section style={card}><h2>Before you leave signal</h2><p>Prepare the pages and authorised records you need, including visit and training photos. This uses data and device storage. Stay signed in on this device.</p><button style={button} disabled={!online||busy} onClick={()=>void prepare()}>{busy?'Working…':'Prepare fieldwork on this device'}</button><p>Download lesson slides, narration and clips separately under <Link href="/student">Study offline</Link>. Open your saved designs, crop plans and reports online once so their additional tools and images are available.</p>
      <details><summary style={{minHeight:44,cursor:'pointer'}}>Page readiness · {paths.filter(path=>pages[path]?.ready).length} of {paths.length}</summary><ul>{paths.map(path=><li key={path}><a href={path}>{FIELD_PAGE_NAMES[path]}</a> — {pages[path]?.ready?'Startup files saved':'Not confirmed on this device'}</li>)}</ul><p>These checks cover startup files. They do not promise fresh map imagery, every report image, or every optional tool.</p></details>
    </section>
    <section style={card}><h2>Saved entries waiting to send</h2><p>Completed visits, training registers, signatures, feedback, photographs, garden observations and assessment responses can wait here. Sync runs when the app is open and a connection returns.</p><button style={button} disabled={!online||busy||!user||isSampleMode()} onClick={()=>void sync()}>Sync now</button>{!writes.length&&<p>No entries in this fieldwork queue. The money book uses its own sync system.</p>}
      {writes.map(row=>{const w=row.value as FieldWrite;return <article key={row.key} style={{borderTop:'1px solid var(--border)',marginTop:16,paddingTop:12}}><h3>{w.label}</h3><p>{w.state==='review'?'Needs review — server save not confirmed':w.state==='sending'?'Sending / awaiting confirmation':'Saved on this device — waiting to send'}</p>{w.error&&<p>{w.error}</p>}<button style={button} onClick={()=>download(row)}>Download a copy</button>{confirmDiscard===row.key?<><p>Remove this device’s queued change? This cannot be undone here. Download a copy first if you need to keep it. The server record is not deleted.</p><button style={button} onClick={()=>void discard(row).catch(e=>setError(e.message))}>Remove queued change</button><button style={button} onClick={()=>setConfirmDiscard('')}>Keep it</button></>:<button style={button} onClick={()=>setConfirmDiscard(row.key)}>Review / remove</button>}{w.state==='review'&&<p>For a conflict, keep a downloaded copy, remove this queued change, reconnect and reopen the current record. Compare the versions before saving your corrections. Permission or validation errors must be resolved before resubmitting.</p>}</article>;})}
    </section>
    <section style={card}><h2>What stays available</h2><p>{cached.length} authorised information requests saved on this device. Their contents reflect the last successful download, plus your unsent changes.</p><p>Local crop planning, journal notes and downloaded lessons can work without signal. AI chat, AI reports, transcription, receipt scanning, new sign-in and fresh online maps still need a connection. The map offers an Offline canvas for saved drawings and pins without satellite or terrain layers. Receipt originals in the money book remain on their original device.</p><p>Use a normal browser window. Clearing site data removes downloads and unsent fieldwork. Keep this device protected, especially where it holds attendance signatures or photographs.</p></section>
    {message&&<p role="status" style={card}>{message}</p>}{error&&<p role="alert" style={{...card,whiteSpace:'pre-wrap'}}>{error}</p>}
  </div></main>;
}

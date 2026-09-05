'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { isSampleMode } from '@/lib/sample-mode';
import { sampleRead, sampleWrite } from '@/lib/sample-operations';
import { readSampleProgramme } from './SampleProgramme';
import { freshFieldWorkspace, projectFieldWorkspace } from '@/lib/field-teams';
import { sampleAssessments } from '@/lib/sample-programme';
import { resizeLogoForStorage } from '@/lib/invoice-logo';
import { freshEvidenceData, milestoneAt, publishedTraining, trainingTotals, validTrainingRecord, validProgrammeMilestone, type EvidenceData, type TrainingRecord, type ProgrammeMilestone } from '@/lib/programme-evidence';
import ReportComposer from './ReportComposer';
import styles from './MelDashboard.module.css';

type Tab = 'progress' | 'training' | 'targets' | 'branding';
const today=()=>new Date().toISOString().slice(0,10);
const emptySession=():TrainingRecord=>({id:crypto.randomUUID(),project:'',title:'',date:today(),venue:'',latitude:null,longitude:null,facilitator:'',ownerId:'',attendance:[],presentCount:0,registeredCount:0,report:'',nextSteps:'',assessmentId:'',published:false,photos:[],photoCount:0,updatedAt:''});
const emptyTarget=():ProgrammeMilestone=>({id:crypto.randomUUID(),project:'',title:'',unit:'sessions',baseline:null,target:1,due:today(),owner:'',method:'',published:false,observations:[],updatedAt:''});
export default function ProgrammeEvidence({ funder=false, mentor=false, initialTab='progress' }: { funder?:boolean; mentor?:boolean; initialTab?:Tab }) {
  const {user,profile}=useAuth();
  const requestVersion=useRef(0);
  const [data,setData]=useState<EvidenceData|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [org,setOrg]=useState(''),[orgs,setOrgs]=useState<{id:string;name:string}[]>([]),[tab,setTab]=useState<Tab>(initialTab),[asOf,setAsOf]=useState(today()),[project,setProject]=useState('');
  const [session,setSession]=useState<TrainingRecord|null>(null),[target,setTarget]=useState<ProgrammeMilestone|null>(null),[reviewed,setReviewed]=useState(false),[photosBusy,setPhotosBusy]=useState(false);
  const [guestCode,setGuestCode]=useState(''),[guestName,setGuestName]=useState('');
  const [observation,setObservation]=useState({date:today(),actual:'',evidence:''});
  async function request(body?:unknown,query='') {
    if(isSampleMode()) throw Error('This action must remain in the sample.');
    const res=await fetch(`/api/programme-evidence?org=${encodeURIComponent(org)}${query}`,{method:body?'POST':'GET',headers:{...(await paidApiHeaders()),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    const d=await res.json();if(!res.ok)throw Error(d.error);return d;
  }
  async function reload() {
    const version=++requestVersion.current; setError('');
    try {
      if(isSampleMode()) {
        const d=sampleRead('programme-evidence',freshEvidenceData);
        if(mentor && !readSampleProgramme().people.find(p=>p.id==='sample-mentor')?.training) throw Error('Training access is off for the sample mentor. Enable it in Organisation → People & access.');
        if(funder && !readSampleProgramme().funderAccess) throw Error('The sample organisation has switched off funder access.');
        const workspace=projectFieldWorkspace(sampleRead('field-teams',freshFieldWorkspace),'sample-mentor',!mentor);
        setData({...d,assessments:funder?[]:sampleAssessments(readSampleProgramme()).map(a=>({id:a.assessment.id,title:a.assessment.title})),sessions:funder?d.sessions.filter(s=>s.published).map(publishedTraining):mentor?d.sessions.filter(s=>s.ownerId==='sample-mentor'):d.sessions,milestones:funder?d.milestones.filter(m=>m.published):d.milestones,people:funder?[]:workspace.people.filter(p=>['farmer','student'].includes(p.role)).map(p=>({id:p.id,name:p.name})),canManage:!funder&&!mentor,canRecord:!funder&&(!mentor||readSampleProgramme().people.find(p=>p.id==='sample-mentor')?.training===true),canBrand:!funder&&!mentor});
      } else {const result=await request();if(version===requestVersion.current)setData(result);}
    } catch(e){if(version===requestVersion.current){setData(null);setError((e as Error).message);}}
  }
  useEffect(()=>{let cancelled=false;if(isSampleMode()){setOrgs([{id:'sample-ngo',name:'Sample organisation'}]);setOrg('sample-ngo');return;}if(!user)return;if(profile?.role==='mentor'&&profile.org_id){setOrg(profile.org_id);return;}void (async()=>{try{const res=await fetch('/api/network/orgs',{headers:await paidApiHeaders()});const d=await res.json();if(!res.ok)throw Error(d.error);if(!cancelled){setOrgs(d.orgs);setOrg(d.orgs[0]?.id??'');}}catch(e){if(!cancelled)setError((e as Error).message);}})();return()=>{cancelled=true;};},[user,profile]);
  useEffect(()=>{setData(null);setSession(null);setTarget(null);if(org)void reload();return()=>{requestVersion.current++;};},[org,funder,mentor]); // eslint-disable-line react-hooks/exhaustive-deps
  async function save(action:'session'|'milestone'|'branding') {
    if(!data||busy)return;const version=requestVersion.current;setBusy(true);setError('');setNotice('');
    try{
      const now=new Date().toISOString();
      const s=session ? {...session,id:session.id||crypto.randomUUID(),ownerId:session.ownerId||(mentor?'sample-mentor':'sample-organisation'),presentCount:session.attendance.filter(a=>a.present).length,registeredCount:session.attendance.length,photoCount:session.photos.length} : null;
      const m=target ? {...target,id:target.id||crypto.randomUUID()} : null;
      if(action==='milestone' && m && (observation.actual.trim() || observation.evidence.trim())) {
        if(!observation.actual.trim() || !observation.evidence.trim())throw Error('Complete the pending observation total and evidence reference, or clear both.');
        m.observations=[...m.observations.filter(o=>o.date!==observation.date),{date:observation.date,actual:+observation.actual,evidence:observation.evidence.trim(),recordedAt:now}];
      }
      if(action==='session'&&(!validTrainingRecord(s,today())||s?.published&&!reviewed))throw Error('Check the session and confirm the shared content before publishing.');
      if(action==='milestone'&&!validProgrammeMilestone(m,today()))throw Error('Check the target, dates, units and evidence notes.');
      if(isSampleMode()){
        const all=sampleRead('programme-evidence',freshEvidenceData);
        if(action==='session' && (!data.canRecord || mentor && !readSampleProgramme().people.find(p=>p.id==='sample-mentor')?.training))throw Error('Training access is not enabled.');
        if(action==='session' && s?.attendance.some(a=>!a.id.startsWith('guest-')&&!data.people.some(p=>p.id===a.id)))throw Error('Use members of your current assigned group.');
        sampleWrite('programme-evidence',action==='session'?{...all,sessions:[...all.sessions.filter(r=>r.id!==s!.id),{...s!,updatedAt:now}]}:action==='milestone'?{...all,milestones:[...all.milestones.filter(r=>r.id!==m!.id),{...m!,updatedAt:now}]}:{...all,branding:data.branding});
      }else{if(data.sample)throw Error('This sample ended. Reopen the workspace.');await request({action,session:s,milestone:m,branding:data.branding,reviewed,expectedUpdatedAt:action==='session'?session?.updatedAt:target?.updatedAt});}
      if(version!==requestVersion.current)return;setNotice('Saved. Reports now include the updated record.');setSession(null);setTarget(null);await reload();
    }catch(e){if(version===requestVersion.current)setError((e as Error).message);}finally{setBusy(false);}
  }
  async function editSession(s:TrainingRecord){const version=requestVersion.current;setError('');setPhotosBusy(true);setReviewed(false);try{const photos=data?.sample?s.photos:(await request(undefined,`&mode=photos&id=${encodeURIComponent(s.id)}`)).photos;if(version===requestVersion.current)setSession({...s,photos,published:data?.canRecord&&!data.canManage?false:s.published});}catch(e){setError((e as Error).message);}finally{setPhotosBusy(false);}}
  const sessions=data?.sessions.filter(s=>!project||s.project===project)??[],targets=data?.milestones.filter(m=>!project||m.project===project)??[];
  const totals=trainingTotals(sessions,asOf,!funder), dated=sessions.filter(s=>s.date<=asOf);
  const dates=[...new Set([today(),...sessions.map(s=>s.date),...targets.flatMap(m=>m.observations.map(o=>o.date))])].sort();
  const projects=[...new Set([...(data?.sessions.map(s=>s.project)??[]),...(data?.milestones.map(m=>m.project)??[])])].sort();
  const setS=(key:keyof TrainingRecord,value:unknown)=>setSession(s=> { if (!s) return s; const next={...s,[key]:value}; return {...next,presentCount:next.attendance.filter(a=>a.present).length,registeredCount:next.attendance.length}; });
  const setM=(key:keyof ProgrammeMilestone,value:unknown)=>setTarget(m=>m?{...m,[key]:value}:m);
  const logoUpload=async(key:'organisation'|'garden'|'funder',file?:File)=>{if(!file||!data)return;setBusy(true);try{const image=await resizeLogoForStorage(file);setData(d=>d?{...d,branding:{...d.branding,[key]:{...d.branding[key],image}}}:d);}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
  return <section className={styles.root} style={initialTab==='branding'?{padding:0,background:'transparent'}:undefined}><div className={styles.wrap}>
    {initialTab!=='branding'&&<div className={styles.hero}><h1>{funder?'Project progress & evidence':'Training, evidence & progress'}</h1><p>Attendance, session records and dated deliverables in one place. Print a progress report whenever you need it.</p></div>}
    {orgs.length>1&&<label>Organisation<select disabled={busy||photosBusy} value={org} onChange={e=>setOrg(e.target.value)}>{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
    {error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status" className={styles.notice}>{notice}</p>}
    {!data&&!error&&<p>Loading authorised programme evidence…</p>}
    {data&&<>
      {data.sample&&<p className={styles.notice}>Fictional demonstration records. Changes stay in this sample session.</p>}
      {initialTab!=='branding'&&<div className={styles.row}>{((data.brandingOnly?['branding']:['progress','training',...(!funder?['targets']:[]),...(data.canBrand?['branding']:[])]) as Tab[]).map(t=><button key={t} aria-pressed={tab===t} disabled={busy||photosBusy} onClick={()=>setTab(t)}>{{progress:'Progress report',training:'Training register',targets:'Milestones',branding:'Names & logos'}[t]}</button>)}</div>}
      {tab!=='branding'&&!data.brandingOnly&&<label>Project<select value={project} onChange={e=>setProject(e.target.value)}><option value="">All visible projects</option>{projects.map(p=><option key={p}>{p}</option>)}</select></label>}
      {!data.brandingOnly&&tab==='progress'&&<>
        <div className={styles.card}><label>Progress as of<input type="date" value={asOf} max={today()} onChange={e=>{if(e.target.value)setAsOf(e.target.value);}} /></label><label>Timeline · recorded dates<input aria-label="Progress timeline" style={{accentColor:'#285c3e'}} type="range" min={0} max={Math.max(0,dates.length-1)} value={Math.max(0,dates.findLastIndex(d=>d<=asOf))} onChange={e=>setAsOf(dates[+e.target.value])} /></label><p>Shows observations dated on or before {asOf}, using the latest corrected records. This is not a reconstruction of what had been entered at that time.</p></div>
        <div className={styles.grid}>{[['Sessions delivered',totals.sessions],['Attendances',totals.attendances],['Distinct participants',totals.uniqueParticipants??'Not included in funder projection']].map(([l,n])=><article className={styles.card} key={l}><h2>{l}</h2><strong className={styles.stat}>{n}</strong></article>)}</div>
        <p>Repeat attendance counts as another attendance, not another person. Attendance and satisfaction are delivery evidence; they do not alone establish skills gained or impact.</p>
        <div className={styles.grid}>{targets.map(m=>{const v=milestoneAt(m,asOf);return <article className={styles.card} key={m.id}><span className={styles.tag}>{v.status}</span><h2>{m.title}</h2><strong className={styles.stat}>{v.actual??'—'} / {m.target} {m.unit}</strong><progress aria-label={m.title} value={Math.min(100,v.percent??0)} max={100} style={{width:'100%',accentColor:'#285c3e'}} /><p>{v.percent===null?'No observation yet':`${Math.round(v.percent)}% of target · ${v.remaining} ${m.unit} remaining`}</p><p>Due {m.due} · baseline {m.baseline??'not recorded'}</p><p>{v.evidence}</p></article>;})}</div>
        <ReportComposer title="Project progress report" sample={data.sample} branding={data.branding} sections={[
          {title:'Reporting scope',lines:[project||'All visible projects',`As of ${asOf}. Generated from the latest available records. ${funder?'Published records only.':'Includes internal records.'}`]},
          {title:'Training delivery',lines:[`${totals.sessions} sessions; ${totals.attendances} attendances.`,totals.uniqueParticipants===null?'Distinct participant identities are excluded from this funder view.':`${totals.uniqueParticipants} distinct participants.`,...dated.map(s=>`${s.date}: ${s.title} | ${s.venue} | ${s.presentCount} present of ${s.registeredCount} registered.`)]},
          {title:'Deliverable milestones',lines:targets.map(m=>{const v=milestoneAt(m,asOf);return `${m.title}: ${v.actual??'not recorded'} / ${m.target} ${m.unit}; baseline ${m.baseline??'not recorded'}; due ${m.due}. ${v.status}. Evidence: ${v.evidence}`;})},
          {title:'Session reports',lines:dated.map(s=>`${s.title}: ${s.report}`)},
          {title:'Follow-up actions',lines:funder?['Internal follow-up notes and named attendance registers are excluded.']:dated.map(s=>`${s.title}: ${s.nextSteps||'No next step recorded.'}`)},
        ]}/>
      </>}
      {!data.brandingOnly&&tab==='training'&&<>
        {data.canRecord&&<button className={styles.primary} disabled={busy||photosBusy} onClick={()=>{setSession({...emptySession(),project,attendance:data.people.map(p=>({...p,present:false})),facilitator:profile?.full_name??(data.sample?'Sample mentor':'')});setReviewed(false);}}>Record a training session</button>}
        {photosBusy&&<p>Loading session photos…</p>}
        {sessions.map(s=><article key={s.id} className={styles.card} style={{marginTop:16}}><h2>{s.title}</h2><p>{s.date} · {s.project} · {s.venue}</p><p>{s.presentCount} present / {s.registeredCount} registered · {s.photoCount} venue photos · {s.published?'Shared with funders':'Internal'}</p><p>{s.report}</p><button disabled={busy||photosBusy} onClick={()=>void editSession(s)}>{data.canRecord?'Open register / edit':'Open session report'}</button></article>)}
        {session&&<form className={styles.card} style={{marginTop:20}} onSubmit={e=>{e.preventDefault();void save('session');}}>
          <h2>{data.canRecord?'Session record & attendance':'Published session report'}</h2>
          <fieldset disabled={!data.canRecord||busy||photosBusy} style={{minWidth:0}}>
            <div className={styles.grid}>{(['project','title','venue','facilitator'] as const).map(k=><label key={k}>{{project:'Project / cohort',title:'Session title',venue:'Training venue',facilitator:'Facilitator'}[k]}<input required maxLength={k==='project'||k==='facilitator'?120:160} value={session[k]} onChange={e=>setS(k,e.target.value)} /></label>)}<label>Training date<input type="date" required max={today()} value={session.date} onChange={e=>setS('date',e.target.value)}/></label></div>
            {!funder&&<div className={styles.row}><label>Venue latitude (optional)<input type="number" min={-90} max={90} step="any" value={session.latitude??''} onChange={e=>setS('latitude',e.target.value===''?null:+e.target.value)}/></label><label>Venue longitude (optional)<input type="number" min={-180} max={180} step="any" value={session.longitude??''} onChange={e=>setS('longitude',e.target.value===''?null:+e.target.value)}/></label></div>}
            {!funder&&<><h3>Attendance register</h3><p>Keep only the people expected at this session on the register, then tick Present for those who attended. Reuse guest codes across sessions so each person counts once.</p>{session.attendance.map(p=><div key={p.id} className={styles.row}><label className={styles.option}><input type="checkbox" checked={p.present} onChange={e=>setS('attendance',session.attendance.map(a=>a.id===p.id?{...a,present:e.target.checked}:a))}/>{p.name} · Present</label><button type="button" aria-label={`Remove ${p.name} from register`} onClick={()=>setS('attendance',session.attendance.filter(a=>a.id!==p.id))}>Remove from register</button></div>)}<label>Add an enrolled participant<select value="" onChange={e=>{const p=data.people.find(p=>p.id===e.target.value);if(p)setS('attendance',[...session.attendance,{...p,present:false}]);}}><option value="">Choose a participant</option>{data.people.filter(p=>!session.attendance.some(a=>a.id===p.id)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <div className={styles.row}><label>Guest code<input value={guestCode} placeholder="same code each visit" onChange={e=>setGuestCode(e.target.value)}/></label><label>Guest name<input value={guestName} maxLength={120} onChange={e=>setGuestName(e.target.value)}/></label><button type="button" onClick={()=>{if(!/^[\w-]{1,90}$/.test(guestCode)||!guestName.trim()){setError('Enter a guest name and a stable code using letters, numbers or dashes.');return;}const id='guest-'+guestCode;setS('attendance',[...session.attendance.filter(a=>a.id!==id),{id,name:guestName.trim(),present:true}]);setGuestName('');setGuestCode('');}}>Add guest</button></div>
            <label>Linked assessment<select value={session.assessmentId} onChange={e=>setS('assessmentId',e.target.value)}><option value="">No assessment linked</option>{data.assessments.map(a=><option key={a.id} value={a.id}>{a.title}</option>)}</select></label><p>Create and manage course feedback in Assessments. Linking records does not invent survey responses.</p></>}
            <label>Mini report · suitable for funders<textarea required maxLength={4000} value={session.report} onChange={e=>setS('report',e.target.value)} placeholder="Topics covered, activities completed and evidence. Leave private participant information out."/></label>
            {!funder&&<label>Internal follow-up<textarea maxLength={2000} value={session.nextSteps} onChange={e=>setS('nextSteps',e.target.value)}/></label>}
            <h3>Training venue photos</h3><div className={styles.grid}>{session.photos.map((p,i)=><figure key={i}><img src={p.image} alt={p.caption} style={{width:'100%',maxHeight:220,objectFit:'contain',borderRadius:12}}/>{data.canRecord?<><input aria-label={`Photo ${i+1} caption`} required maxLength={240} value={p.caption} onChange={e=>setS('photos',session.photos.map((p,j)=>j===i?{...p,caption:e.target.value}:p))}/><button type="button" onClick={()=>setS('photos',session.photos.filter((_,j)=>j!==i))}>Remove photo</button></>:<figcaption>{p.caption}</figcaption>}</figure>)}</div>
            {data.canRecord&&session.photos.length<2&&<label>Add venue photo (up to two)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;const sessionId=session.id;setPhotosBusy(true);try{const image=await resizeLogoForStorage(file,640);setSession(s=>s?.id===sessionId?{...s,photos:[...s.photos,{image,caption:''}]}:s);}catch(e){setError((e as Error).message);}finally{setPhotosBusy(false);}}}/></label>}
            {data.canManage&&<><label className={styles.option}><input type="checkbox" checked={session.published} onChange={e=>setS('published',e.target.checked)}/>Share this session summary and venue photos with linked funders</label>{session.published&&<label className={styles.option}><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>I reviewed the summary and photos for sharing. Attendance names and internal notes stay private.</label>}</>}
            {data.canRecord&&<button className={styles.primary} disabled={busy||photosBusy}>Save session</button>}
          </fieldset>
          <button type="button" disabled={busy||photosBusy} onClick={()=>setSession(null)}>Close record</button>
          <p>{data.canRecord?'This preview includes your current edits. Save the session to update project progress reports.':'Published summary; named attendance remains with the organisation.'}</p>
          <ReportComposer title="Training session report" sample={data.sample} branding={data.branding} photos={session.photos} sections={[{title:session.title,lines:[`${session.date} | ${session.project} | ${session.venue}`,`${session.presentCount} recorded attendances`,session.report]},{title:funder?'Attendance summary':'Attendance register',lines:funder?[`${session.presentCount} present of ${session.registeredCount} registered.`]:session.attendance.map(a=>`${a.name} | ${a.id} | ${a.present?'Present':'Absent'}`)},{title:'Assessment & follow-up',lines:[session.assessmentId?`Linked assessment: ${session.assessmentId}`:'No linked assessment.',...(funder?[]:[session.nextSteps||'No follow-up recorded.'])]}]}/>
        </form>}
      </>}
      {!data.brandingOnly&&tab==='targets'&&<>
        <p>Track a cumulative total against a target. Enter the total observed by each date, not an increment to add again.</p>
        {data.canManage&&<button onClick={()=>{setTarget({...emptyTarget(),project});setObservation({date:today(),actual:'',evidence:''});}}>Add a deliverable milestone</button>}
        {targets.map(m=><article key={m.id} className={styles.card} style={{marginTop:16}}><h2>{m.title}</h2><p>Target {m.target} {m.unit} · due {m.due}</p><p>{m.method}</p>{data.canManage&&<button onClick={()=>{setTarget(m);setObservation({date:today(),actual:'',evidence:''});}}>Update target / record progress</button>}</article>)}
        {target&&data.canManage&&<form className={styles.card} style={{marginTop:20}} onSubmit={e=>{e.preventDefault();void save('milestone');}}><fieldset disabled={busy} style={{minWidth:0}}><h2>Deliverable and measurement</h2><div className={styles.grid}>{(['project','title','unit','owner'] as const).map(k=><label key={k}>{{project:'Project',title:'Deliverable',unit:'Unit',owner:'Responsible person'}[k]}<input required value={target[k]} onChange={e=>setM(k,e.target.value)}/></label>)}<label>Baseline (leave blank if unknown)<input type="number" min="0" step="any" value={target.baseline??''} onChange={e=>setM('baseline',e.target.value===''?null:+e.target.value)}/></label><label>Target total<input type="number" required min="0.001" step="any" value={target.target} onChange={e=>setM('target',+e.target.value)}/></label><label>Due date<input required type="date" value={target.due} onChange={e=>setM('due',e.target.value)}/></label></div><label>Definition, source and measurement frequency<textarea required maxLength={1000} value={target.method} onChange={e=>setM('method',e.target.value)}/></label>
          <h3>Dated observations</h3>{target.observations.map(o=><p key={o.date}>{o.date} · {o.actual} {target.unit} · {o.evidence}</p>)}<div className={styles.grid}><label>Observation date<input type="date" max={today()} value={observation.date} onChange={e=>setObservation({...observation,date:e.target.value})}/></label><label>Total achieved by this date<input type="number" min="0" step="any" value={observation.actual} onChange={e=>setObservation({...observation,actual:e.target.value})}/></label></div><label>Evidence / record reference<textarea maxLength={1500} value={observation.evidence} onChange={e=>setObservation({...observation,evidence:e.target.value})}/></label><button type="button" onClick={()=>{if(!observation.actual.trim()||!observation.evidence.trim()){setError('Enter an observed total and evidence reference.');return;}setM('observations',[...target.observations.filter(o=>o.date!==observation.date),{...observation,actual:+observation.actual,recordedAt:new Date().toISOString()}]);setObservation({date:today(),actual:'',evidence:''});}}>Add / replace dated observation</button>
          <label className={styles.option}><input type="checkbox" checked={target.published} onChange={e=>setM('published',e.target.checked)}/>Share this milestone and its evidence notes with linked funders</label><button className={styles.primary}>Save milestone</button><button type="button" onClick={()=>setTarget(null)}>Cancel</button></fieldset></form>}
      </>}
      {(tab==='branding'||data.brandingOnly)&&data.canBrand&&<div className={styles.card}><h2>Organisation, garden & funder identity</h2><p>These are the default partner identities for this organisation’s programme reports. Use a programme-wide community name when several gardens are included. Upload logos you are authorised to use.</p><div className={styles.grid}>{(['organisation','garden','funder'] as const).map(key=><div key={key}><h3>{key==='organisation'?'Implementing organisation':key==='garden'?'Community garden / project':'Funding partner'}</h3>{data.branding[key].image&&<img src={data.branding[key].image} alt={`${key} logo`} style={{width:120,height:90,objectFit:'contain'}}/>}<label>Display name<input maxLength={120} value={data.branding[key].label} onChange={e=>setData({...data,branding:{...data.branding,[key]:{...data.branding[key],label:e.target.value}}})}/></label><label>Upload logo<input disabled={busy} type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void logoUpload(key,e.target.files?.[0])}/></label><button onClick={()=>setData({...data,branding:{...data.branding,[key]:{...data.branding[key],image:''}}})}>Remove logo</button></div>)}</div><button className={styles.primary} disabled={busy} onClick={()=>void save('branding')}>Save names & logos</button><ReportComposer title="Branded report preview" sample={data.sample} branding={data.branding} sections={[{title:'Programme identity',lines:['The saved names and logos are used on training and progress reports.']}]} /></div>}
    </>}
  </div></section>;
}

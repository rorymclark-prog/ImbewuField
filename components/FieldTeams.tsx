'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { fieldApi } from '@/lib/field-api';
import { DEVICE_SAVE_NOTICE } from '@/lib/field-request-model';
import { useFieldSync } from '@/lib/use-field-sync';
import FieldDraft, { clearFieldDraft } from './FieldDraft';
import { getFirebase } from '@/lib/firebase/init';
import { isSampleMode } from '@/lib/sample-mode';
import { sampleRead, sampleWrite } from '@/lib/sample-operations';
import { FIELD_FOCUS, FIELD_PROGRAMMES, summariseFieldWork, completeSampleFieldWorkspace, fieldVisitReportLines, freshFieldWorkspace, projectFieldWorkspace, validFieldTeam, validFieldVisit, type FieldFocus, type FieldProgramme, type FieldTeam, type FieldVisit, type FieldWorkspace } from '@/lib/field-teams';
import VisitCapture from './VisitCapture';
import VenueLocation from './VenueLocation';
import workStyles from './FieldWork.module.css';
import type { VisitPhoto } from '@/lib/field-teams';
import { CalendarClock, ClipboardCheck, Users } from 'lucide-react';
import ProfileAvatar from './ProfileAvatar';
import FieldVisitGuide from './FieldVisitGuide';
import ReportComposer from './ReportComposer';
import styles from './MelDashboard.module.css';
import FieldDataStatus from './FieldDataStatus';
import { prepareFieldVisitDraft, fieldVisitDraftHasPhotos } from '@/lib/field-visit-draft';

const emptyVisit=():FieldVisit=>({id:'',mentorId:'',farmerId:'',date:new Date().toISOString().slice(0,10),notes:'',supportRequested:'',observations:'',agreedAction:'',responsiblePerson:'',followUpDate:'',location:'',photos:[],photoCount:0});

export default function FieldTeams({ organisation = false, initialFarmerId, onStartTraining }: { organisation?: boolean; initialFarmerId?: string; onStartTraining?:()=>void }) {
  const { user, profile } = useAuth();
  const [data, setData] = useState<FieldWorkspace | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<FieldTeam>({ mentorId: '', location: '', farmerIds: [], guidance: '', updatedAt: '' });
  const [visit, setVisit] = useState<FieldVisit>(emptyVisit), [notice, setNotice] = useState('');
  const [visitPhotos,setVisitPhotos]=useState<Record<string,VisitPhoto[]>>({});
  const [captureBusy,setCaptureBusy]=useState(false);
  const [panel,setPanel]=useState<'overview'|'people'|'visits'|'report'>('overview');
  const [peopleSearch,setPeopleSearch]=useState('');
  const [from,setFrom]=useState(''),[to,setTo]=useState('');
  const [visibleCount,setVisibleCount]=useState(10);
  const initialOpened=useRef('');
  const [visitReport,setVisitReport]=useState<FieldVisit|null>(null);
  const [visitOpen,setVisitOpen]=useState(false),[photosBusy,setPhotosBusy]=useState(false),[photosReady,setPhotosReady]=useState(true),[farmerFilter,setFarmerFilter]=useState('');
  const requestVersion=useRef(0),visitForm=useRef<HTMLElement>(null);
  const [org, setOrg] = useState('');
  const scopeRef=useRef('');
  scopeRef.current=[user?.uid??'',profile?.org_id??'',profile?.role??'',org,organisation].join('|');
  const currentScope=()=>`${scopeRef.current}|${isSampleMode()?'sample':`account:${getFirebase()?.auth.currentUser?.uid??''}`}`;
  const request = async (body?: unknown, query='',expectedScope=currentScope()) => {
    if (isSampleMode()) throw Error('Sample requests must stay in the demo.');
    const actor=user,version=requestVersion.current;
    if(!actor || expectedScope!==currentScope() || getFirebase()?.auth.currentUser?.uid!==actor.uid)throw Error('The workspace changed. Reopen field teams.');

    // Authentication can finish after an account or organisation switch. Never
    // send an old draft using whichever account happens to be current then.
    if(version!==requestVersion.current || expectedScope!==currentScope() || isSampleMode() || getFirebase()?.auth.currentUser?.uid!==actor.uid)throw Error('The workspace changed. Reopen field teams.');
    const result = await fieldApi(`/api/field-teams?${org ? `org=${encodeURIComponent(org)}` : ''}${query}`,body);
    if(version!==requestVersion.current || expectedScope!==currentScope())throw Error('The workspace changed. Reopen field teams.');
    return result;
  };
  async function reload(expectedScope=currentScope(),version=requestVersion.current) {
    setError('');
    try {
      const result=isSampleMode() ? projectFieldWorkspace(completeSampleFieldWorkspace(sampleRead('field-teams', freshFieldWorkspace)), organisation ? 'sample-organisation' : 'sample-mentor', organisation) : await request(undefined,'',expectedScope);
      if(version===requestVersion.current && expectedScope===currentScope())setData(result);
    }
    catch (e) { if(version===requestVersion.current && expectedScope===currentScope()){setData(null); setError((e as Error).message);} }
  }
  useEffect(() => { requestVersion.current++;setVisitOpen(false);setVisit(emptyVisit());setVisitReport(null);setVisitPhotos({});setCaptureBusy(false);setFarmerFilter('');setFrom('');setTo('');setPanel('overview');initialOpened.current='';setData(null);setError('');setBusy(false);setPhotosBusy(false);if(isSampleMode()||user)void reload();return()=>{requestVersion.current++;}; }, [user,profile?.org_id,profile?.role,org,organisation]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{if(visitOpen)visitForm.current?.scrollIntoView({block:'start',behavior:'smooth'});},[visitOpen,visit.id]);
  const canRecordVisits=!!data && !organisation && data.teams.some(team=>team.mentorId===data.selfId);
  const readOnlyVisit=!canRecordVisits || !!visit.mentorId && visit.mentorId!==data?.selfId;
  function newVisit(farmerId=''){
    requestVersion.current++;setError('');setNotice('');setPhotosReady(true);setPhotosBusy(false);
    setVisit({...emptyVisit(),id:crypto.randomUUID(),mentorId:data?.selfId??'',farmerId,location:data?.people.find(p=>p.id===farmerId)?.gardenName??'',focus:[],skillResult:'not-assessed'});setVisitReport(null);setVisitOpen(true);
  }
  useEffect(()=>{
    if(initialFarmerId && canRecordVisits && initialOpened.current!==initialFarmerId && data?.teams.some(team=>team.mentorId===data.selfId&&team.farmerIds.includes(initialFarmerId))){initialOpened.current=initialFarmerId;newVisit(initialFarmerId);}
  },[initialFarmerId,data,canRecordVisits]); // eslint-disable-line react-hooks/exhaustive-deps
  function closeVisit(){requestVersion.current++;setVisitOpen(false);setPhotosBusy(false);setVisit(emptyVisit());setVisitReport(null);}
  async function openVisit(record:FieldVisit){
    if(!data)return;
    const version=++requestVersion.current,sample=data.sample,scope=currentScope();
    setError('');setVisit({...emptyVisit(),...record});setVisitReport(null);setVisitOpen(true);setPhotosReady(false);setPhotosBusy(true);
    try{
      const photos=sample ? record.photos??[] : (record.photoCount??0)>0 ? (await request(undefined,`&mode=photos&id=${encodeURIComponent(record.id)}`,scope)).photos : [];
      if(version===requestVersion.current && scope===currentScope()){setVisit({...emptyVisit(),...record,photos});setVisitReport({...record,photos});setVisitPhotos(previous=>({...previous,[record.id]:photos}));setPhotosReady(true);}
    }catch(e){if(version===requestVersion.current && scope===currentScope())setError((e as Error).message);}
    finally{if(version===requestVersion.current && scope===currentScope())setPhotosBusy(false);}
  }
  async function save(team: boolean) {
    if(busy||photosBusy||captureBusy||!data)return;
    const scope=currentScope(),version=requestVersion.current;
    setBusy(true); setError(''); setNotice('');
    try {
      const nextVisit={...visit,mentorId:data.selfId,photoCount:visit.photos?.length??0};
      let confirmedVisit:FieldVisit|undefined; let queued=false;
      if(!team && (!canRecordVisits || !photosReady || !validFieldVisit(nextVisit,new Date().toISOString().slice(0,10),data.sample)))throw Error('Check the farmer, observations, follow-up date and photo captions. A named person or follow-up date needs an agreed action.');
      if (isSampleMode()) {
        if(!data.sample)throw Error('The workspace changed. Reopen field teams.');
        const all = completeSampleFieldWorkspace(sampleRead('field-teams', freshFieldWorkspace));
        if (team) { if (!data.canManage || !validFieldTeam(draft)) throw Error('Choose a mentor, location and unique farmer assignments.'); const next = { ...draft, updatedAt: new Date().toISOString() }; sampleWrite('field-teams', { ...all, teams: [...all.teams.filter(t => t.mentorId !== next.mentorId), next] }); }
        else { if (!all.teams.some(t => t.mentorId===data.selfId && t.farmerIds.includes(nextVisit.farmerId))) throw Error('Choose an assigned farmer.'); confirmedVisit={...nextVisit,updatedAt:new Date().toISOString()};sampleWrite('field-teams', { ...all, visits: [...all.visits.filter(v => v.id !== nextVisit.id), confirmedVisit] }); }
      } else { if (data.sample) throw Error('This sample has ended. Reopen the workspace.'); const result=await request(team ? { action: 'team', team: draft } : { action: 'visit', ...nextVisit,expectedUpdatedAt:visit.updatedAt },'',scope);queued=result.queued===true;if(!team)confirmedVisit=result.visit; }
      if(scope!==currentScope() || version!==requestVersion.current)return;
      if(!team&&!confirmedVisit)throw Error('The saved record was not returned. Reopen visit records to confirm the change.');
      setNotice(queued ? DEVICE_SAVE_NOTICE : team ? 'Team and guidance saved. The mentor will see this in their workspace.' : 'Visit recorded.');
      if(!team)void clearFieldDraft(`visit:${org}`).catch(()=>{});
      if(!team){
        if(!confirmedVisit)throw Error('The saved record was not returned. Reopen visit records to confirm the change.');
        const saved=confirmedVisit;
        setData(current=>current?{...current,visits:[...current.visits.filter(v=>v.id!==saved.id),saved]}:current);
        setPanel('visits');setFrom('');setTo('');setFarmerFilter(saved.farmerId);
        setVisitPhotos(previous=>({...previous,[saved.id]:saved.photos??[]}));closeVisit();
      }else await reload(scope,requestVersion.current);
    } catch (e) { if(scope===currentScope() && version===requestVersion.current)setError((e as Error).message); } finally { if(scope===currentScope())setBusy(false); }
  }
  async function loadMoreVisits(){
    if(!data?.visitCursor||busy)return;
    const scope=currentScope(),version=requestVersion.current,cursor=data.visitCursor;
    setBusy(true);setError('');
    try{const next=await request(undefined,`&cursor=${encodeURIComponent(cursor)}`,scope) as FieldWorkspace;
      if(scope===currentScope()&&version===requestVersion.current)setData(current=>projectFieldWorkspace(current?{...next,visits:[...new Map([...current.visits,...next.visits].map(v=>[v.id,v])).values()]}:next,next.selfId,next.canManage));
    }catch(e){if(scope===currentScope()&&version===requestVersion.current)setError((e as Error).message);}
    finally{if(scope===currentScope()&&version===requestVersion.current)setBusy(false);}
  }
  useFieldSync(()=>void reload(),!busy&&!visitOpen);
  const name = (id: string) => data?.people.find(p => p.id === id)?.name ?? 'Former team member';
  const portrait = (id: string, size = 52) => {
    const person = data?.people.find(p => p.id === id);
    return <ProfileAvatar id={id} name={name(id)} photoUrl={person?.photoUrl} sample={!!person && data?.sample} size={size} preview={size>=44}/>;
  };
  const garden = (id: string) => data?.people.find(p => p.id === id)?.gardenName || data?.teams.find(t => t.farmerIds.includes(id))?.location;
  const assigned = [...new Set(data?.teams.flatMap(t => t.farmerIds) ?? [])];
  const captureScope=currentScope(),captureVersion=requestVersion.current;
  const today=new Date().toISOString().slice(0,10);
  const summary=data?summariseFieldWork(data,from,to,farmerFilter,today):null;
  const recordedVisits=summary?.visits??[];
  const scopeValid=!from||!to||from<=to;
  const actProgramme=data?.teams.some(team=>team.programme==='act-sef-food-security');
  const programmeNames=[...new Set(data?.teams.filter(t=>!farmerFilter||t.farmerIds.includes(farmerFilter)).map(t=>FIELD_PROGRAMMES[t.programme??'general'])??[])];
  const programmeLabel=programmeNames.length?programmeNames.join(' / '):'Garden mentoring';
  const scopeLabel=`${farmerFilter?name(farmerFilter):'All assigned participants'} · ${from||recordedVisits.at(-1)?.date||'First recorded visit'} to ${to||recordedVisits[0]?.date||'Latest recorded visit'}`;
  const actionLabel=(record:FieldVisit)=>record.actionCompletedOn?'Completed':record.followUpDate?record.followUpDate<today?'Follow-up overdue':record.followUpDate===today?'Follow up today':'Follow-up scheduled':'Date needed';
  const filteredPeople=data?.people.filter(person=>assigned.includes(person.id)&&(!farmerFilter||person.id===farmerFilter)&&`${person.name} ${person.gardenName??''}`.toLowerCase().includes(peopleSearch.toLowerCase()))??[];
  return <section className={`${styles.root} ${workStyles.workspace}`}><div className={styles.wrap}>
    <FieldDataStatus data={data} />
    <FieldDraft name={`visit:${org}`} value={prepareFieldVisitDraft(visit,{open:visitOpen,photosReady,photosBusy,captureBusy,saving:busy,readOnly:readOnlyVisit})} onRestore={value=>{
      // Abandon a previous photo load before restoring a different saved draft.
      requestVersion.current++;setPhotosBusy(false);setCaptureBusy(false);setVisitReport(null);
      const complete=fieldVisitDraftHasPhotos(value);
      setVisit(value);setVisitOpen(true);setPhotosReady(complete);
      setError(complete?'':'This draft is missing saved visit photos. Keep your notes, then reopen the original visit with a connection before submitting changes.');
    }} />
    <div className={workStyles.hero}>
      <div><p className={workStyles.eyebrow}>{organisation?'Programme coordination':programmeLabel}</p><h1>{organisation?'Mentor teams & guidance':'My fieldwork'}</h1><p>{organisation?'Give each mentor a clear group, programme focus and current instructions.':'Support the garden. Build practical skills. Follow through on agreed actions.'}</p></div>
      {!organisation&&<div className={workStyles.heroActions}><button className={styles.primary} disabled={!canRecordVisits||busy||photosBusy||captureBusy} onClick={()=>newVisit()}>Record a field visit</button>{onStartTraining&&<button onClick={onStartTraining}>Training & attendance</button>}</div>}
    </div>
    {profile?.role === 'admin' && !isSampleMode() && <label>Organisation ID<input value={org} onChange={e => setOrg(e.target.value)} placeholder="Select the organisation you administer" /></label>}
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status" className={styles.notice}>{notice}</p>}
    {!data && !error && <p>Loading field team…</p>}
    {data && <>
      <nav className={workStyles.tabs} aria-label="Fieldwork views">{([['overview','Priorities'],['people','People & gardens'],['visits','Visit records'],['report','Field report']] as const).map(([key,label])=><button key={key} aria-pressed={panel===key} onClick={()=>setPanel(key)}>{label}</button>)}</nav>
      <details className={workStyles.scope}><summary>Record scope · {scopeLabel}</summary><div className={styles.grid}>
        <label>Participant<select value={farmerFilter} onChange={e=>{setFarmerFilter(e.target.value);setVisibleCount(10);}}><option value="">All assigned participants</option>{assigned.map(id=><option key={id} value={id}>{name(id)}</option>)}</select></label>
        <label>From date<input type="date" max={to||today} value={from} onChange={e=>setFrom(e.target.value)}/></label>
        <label>To date<input type="date" min={from} max={today} value={to} onChange={e=>setTo(e.target.value)}/></label>
      </div><button onClick={()=>{setFrom('');setTo('');setFarmerFilter('');}}>Clear filters</button><p>These filters apply to visit figures, follow-ups and the field report. Assignments describe your current team.</p></details>
      {data.visitCursor&&<div className={styles.notice}><p>{data.visits.length} visit records loaded. More history is available. Load it before viewing complete coverage figures or preparing the field report.</p><button disabled={busy||captureBusy||photosBusy} onClick={()=>void loadMoreVisits()}>{busy?'Loading…':'Load more visit history'}</button></div>}
      {!scopeValid&&<p className={styles.error} role="alert">Choose an end date on or after the start date.</p>}
      {panel==='overview'&&summary&&scopeValid&&!data.visitCursor&&<>
        <div className={workStyles.metrics}>
          <div className={workStyles.metric}><span>Assigned participants</span><strong>{summary.assigned.length}</strong><div className={workStyles.avatarStack}>{summary.assigned.slice(0,4).map(id=><span key={id}>{portrait(id,32)}</span>)}</div><small>Current field team</small></div>
          <div className={workStyles.metric}><span>Participants visited</span><strong>{summary.visited} / {summary.assigned.length}</strong><div className={workStyles.coverage} role="img" aria-label={`${summary.visited} visited; ${summary.unvisited} without a visit in this period`}><i style={{width:`${summary.assigned.length ? summary.visited/summary.assigned.length*100 : 0}%`}}/></div><small>{summary.unvisited} still to visit in this period</small></div>
          <div className={workStyles.metric}><span>Follow-ups due</span><strong>{summary.due.length}</strong><div className={workStyles.avatarStack}><CalendarClock size={28} className={workStyles.metricIcon} aria-hidden="true"/></div><small>Open actions due by today</small></div>
          <div className={workStyles.metric}><span>Visits recorded</span><strong>{summary.visits.length}</strong><div className={workStyles.avatarStack}><ClipboardCheck size={28} className={workStyles.metricIcon} aria-hidden="true"/></div><small>Within the selected period</small></div>
        </div>
        <div className={workStyles.columns}>
          <section className={styles.card}><div className={styles.row}><h2>What needs attention</h2><span className={styles.tag}>{summary.open.length} open actions</span></div>
            {!summary.open.length&&<p>No open actions recorded in this selection. Check visits and agree the next support needed.</p>}
            {[...summary.due,...summary.open.filter(v=>!summary.due.includes(v))].slice(0,4).map(record=><article key={record.id} className={workStyles.action}><div className={workStyles.actionHeader}><div className={workStyles.personHeading}>{portrait(record.farmerId)}<div><strong>{name(record.farmerId)}</strong><p className={workStyles.personGarden}>{garden(record.farmerId)}</p></div></div><span className={record.followUpDate&&record.followUpDate<=today?workStyles.due:styles.tag}>{actionLabel(record)}</span></div><p>{record.agreedAction}</p><small>{record.responsiblePerson||'Owner needed'} · {record.followUpDate||'Agree a follow-up date'}</small><button disabled={busy||captureBusy||photosBusy} onClick={()=>void openVisit(record)}>Review action</button></article>)}
            {summary.open.length>4&&<button onClick={()=>setPanel('visits')}>View all visit actions</button>}
          </section>
          <aside className={styles.card}><FieldVisitGuide actProgramme={!!actProgramme}/></aside>
        </div>
        <section className={styles.card}><div className={styles.row}><Users size={28} aria-hidden="true"/><h2>Plan the next garden visit</h2><span className={styles.tag}>{summary.unvisited} participants without a visit in this period</span></div><p>Search your assigned group, open their recent records, or start a visit with their name already selected.</p><button onClick={()=>setPanel('people')}>Open people & gardens</button></section>
      </>}
      {visitOpen&&<section ref={visitForm} className={styles.card} style={{margin:'16px 0'}} aria-label="Visit details">
        <div className={styles.row}><h2>{readOnlyVisit?'Field visit details':data.visits.some(v=>v.id===visit.id)?'Edit field visit':'Record a field visit'}</h2><button type="button" disabled={busy||captureBusy} onClick={closeVisit}>Close visit</button></div>
        {photosBusy&&<p role="status">Preparing visit photos…</p>}
        {!photosReady&&!photosBusy&&<p role="alert">Visit photos could not be loaded. Close and reopen this visit before editing it.</p>}
        <form onSubmit={e=>{e.preventDefault();void save(false);}}>
          <fieldset disabled={readOnlyVisit||busy||photosBusy||captureBusy||!photosReady} style={{border:0,padding:0,minWidth:0}}>
            <div className={styles.grid}>
              <label>Participant<select required value={visit.farmerId} onChange={e=>setVisit({...visit,farmerId:e.target.value,location:data.people.find(p=>p.id===e.target.value)?.gardenName??'',latitude:null,longitude:null})}><option value="">Choose a participant</option>{[...new Set([...assigned,...(visit.farmerId?[visit.farmerId]:[])])].map(id=><option key={id} value={id}>{name(id)}</option>)}</select></label>
              <label>Visit date<input required type="date" max={new Date().toISOString().slice(0,10)} value={visit.date} onChange={e=>setVisit({...visit,date:e.target.value})}/></label>
            </div>
            <label>Site location (optional)<input maxLength={240} value={visit.location??''} placeholder="Garden name, meeting point or directions" onChange={e=>setVisit({...visit,location:e.target.value})}/></label>
            <details><summary>Location, map & directions</summary><VenueLocation key={`${visit.id}|${visit.farmerId}`} latitude={visit.latitude??null} longitude={visit.longitude??null} sample={data.sample} recordKind="visit" venue={visit.location} onChange={point=>{if(captureScope===currentScope()&&captureVersion===requestVersion.current)setVisit(current=>({...current,...point}));}}/></details>
            <fieldset className={workStyles.focus}><legend>Support areas covered</legend><div>{Object.entries(FIELD_FOCUS).map(([key,label])=><label key={key}><input type="checkbox" checked={visit.focus?.includes(key as FieldFocus)??false} onChange={e=>setVisit({...visit,focus:e.target.checked?[...(visit.focus??[]),key as FieldFocus]:(visit.focus??[]).filter(f=>f!==key)})}/>{label}</label>)}</div></fieldset>
            <label>Support requested<textarea maxLength={2000} value={visit.supportRequested??''} placeholder="Water, tools, inputs, crop care, records or other support requested" onChange={e=>setVisit({...visit,supportRequested:e.target.value})}/></label>
            <label>Observations and issues<textarea required={!visit.notes.trim()} maxLength={4000} value={visit.observations??''} placeholder="Describe the garden condition and what you checked. Include quantities and units when measured." onChange={e=>setVisit({...visit,observations:e.target.value})}/></label>
            <label>Agreed action<textarea maxLength={2000} value={visit.agreedAction??''} placeholder="What will happen next?" onChange={e=>setVisit({...visit,agreedAction:e.target.value})}/></label>
            <div className={styles.grid}>
              <label>Responsible person<input maxLength={120} value={visit.responsiblePerson??''} placeholder="Who will carry out the action?" onChange={e=>setVisit({...visit,responsiblePerson:e.target.value})}/></label>
              <label>Follow-up date<input type="date" min={visit.date} value={visit.followUpDate??''} onChange={e=>setVisit({...visit,followUpDate:e.target.value})}/></label>
            </div>
            <details className={workStyles.additional}><summary>Practical skill check</summary><p>Record a skill demonstrated in the garden separately from course completion or attendance.</p><label>Skill observed<input maxLength={240} value={visit.practicalSkill??''} placeholder="e.g. weigh and record a harvest" onChange={e=>setVisit({...visit,practicalSkill:e.target.value})}/></label><label>Observation result<select value={visit.skillResult||'not-assessed'} onChange={e=>setVisit({...visit,skillResult:e.target.value as FieldVisit['skillResult']})}><option value="not-assessed">Not assessed</option><option value="demonstrated">Demonstrated during this visit</option><option value="needs-support">Needs further support</option></select></label></details>
            {visit.agreedAction?.trim()&&<details className={workStyles.additional} open={!!visit.actionCompletedOn}><summary>Close out this action</summary><p>Mark completion only after checking what changed. Leave the date blank while the action is open.</p><label>Completed on<input type="date" min={visit.date} max={today} value={visit.actionCompletedOn??''} onChange={e=>setVisit({...visit,actionCompletedOn:e.target.value})}/></label><label>Completion evidence<textarea required={!!visit.actionCompletedOn} maxLength={2000} value={visit.actionOutcome??''} placeholder="What was completed, and how did you check it?" onChange={e=>setVisit({...visit,actionOutcome:e.target.value})}/></label></details>}
            <VisitCapture key={`${captureScope}|${visit.id}|${captureVersion}`} value={visit} notesRequired={!visit.observations?.trim()} disabled={readOnlyVisit||busy||photosBusy||!photosReady} onBusyChange={setCaptureBusy} onChange={value=>{if(captureScope===currentScope()&&captureVersion===requestVersion.current)setVisit(current=>({...current,...value}));}}/>
            {visit.originalNotes&&<details><summary>Original notes before AI cleanup</summary><p style={{whiteSpace:'pre-wrap'}}>{visit.originalNotes}</p></details>}
            {!readOnlyVisit&&<p className={styles.muted}>Visit notes and photos are visible to the assigned mentor and authorised organisation staff.</p>}
            {!readOnlyVisit&&<button className={styles.primary} disabled={busy||photosBusy||captureBusy||!photosReady}>{busy?'Saving…':'Save visit'}</button>}
          </fieldset>
        </form>
        {visitReport&&<><p className={styles.muted}>This report uses the saved visit. Save any edits to update it.</p><ReportComposer deviceData={data} title="Field visit report" sample={data.sample} orgId={org||undefined} photos={visitReport.photos??[]} photoHeading="Visit photographs" sections={[{title:'Visit details',lines:fieldVisitReportLines(visitReport,name(visitReport.farmerId),name(visitReport.mentorId))}]}/></>}
      </section>}
      {panel==='visits'&&scopeValid&&<section className={styles.card} style={{margin:'16px 0'}} aria-label="Recorded field visits">
        <h2>Recorded visits</h2><p className={styles.muted}>{scopeLabel}</p>
        {!recordedVisits.length&&<p>No visits recorded for this selection.</p>}
        {recordedVisits.slice(0,visibleCount).map(record=><article key={record.id} className={styles.metric}><div className={workStyles.actionHeader}><div className={workStyles.personHeading}>{portrait(record.farmerId)}<div><h3 style={{marginBottom:0}}>{name(record.farmerId)}</h3><p className={workStyles.personGarden}>{garden(record.farmerId)}</p></div></div><span className={styles.tag}>{record.date}</span></div><p>{record.observations||record.notes}</p>{record.agreedAction&&<p><strong>{record.actionCompletedOn?'Completed action:':'Next action:'}</strong> {record.agreedAction}<br/><strong>Responsible:</strong> {record.responsiblePerson||'Not yet assigned'} · <strong>Follow-up:</strong> {record.followUpDate||'Not yet scheduled'}{record.actionCompletedOn&&<><br/><strong>Completed:</strong> {record.actionCompletedOn} · {record.actionOutcome}</>}</p>}{(record.photoCount??record.photos?.length??0)>0&&<p>{record.photoCount??record.photos?.length} visit photos</p>}<button disabled={busy||photosBusy||captureBusy} onClick={()=>void openVisit(record)}>{canRecordVisits&&record.mentorId===data.selfId?'View / edit visit':'View visit'}</button></article>)}
        {recordedVisits.length>visibleCount&&<button onClick={()=>setVisibleCount(n=>n+10)}>Show more visits ({recordedVisits.length-visibleCount} remaining)</button>}
      </section>}
      {panel==='people'&&<><label>Find a participant or garden<input type="search" value={peopleSearch} onChange={e=>setPeopleSearch(e.target.value)} placeholder="Search names or gardens"/></label><div className={workStyles.people}>
      {filteredPeople.map(person=>{const latest=data.visits.filter(v=>v.farmerId===person.id).sort((a,b)=>b.date.localeCompare(a.date))[0];return <article className={styles.card} key={person.id}><div className={workStyles.personHeading}>{portrait(person.id)}<h3>{person.name}</h3></div><p>{person.gardenName||data.teams.find(t=>t.farmerIds.includes(person.id))?.location||'Garden location to be recorded'}</p>{person.gardenAreaM2!=null&&<p className={styles.muted}>{person.gardenType} · {Math.round(person.gardenAreaM2).toLocaleString('en-ZA')} m²</p>}<p className={styles.muted}>{latest?`${data.visitCursor?'Most recent loaded visit':'Last recorded visit'} · ${latest.date}`:data.visitCursor?'No visit in the history loaded so far':'No visit recorded yet'}</p><div className={styles.row}>{canRecordVisits&&<button disabled={busy||captureBusy||photosBusy} onClick={()=>newVisit(person.id)}>Record visit</button>}{latest&&<button disabled={busy||captureBusy||photosBusy} onClick={()=>void openVisit(latest)}>Latest visit</button>}</div></article>;})}
      {!filteredPeople.length&&<p>No participants match this selection.</p>}</div></>}
      {!data.teams.length && <p className={styles.card}>No field team assigned yet. Your organisation can assign one in Control centre → Mentor teams.</p>}
      {(panel==='people'||organisation)&&data.teams.map(t => <article key={t.mentorId} className={styles.card} style={{ marginBottom: 16 }}><h2>{t.location}</h2><p style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{portrait(t.mentorId,64)}<span>Mentor: {name(t.mentorId)} · updated {t.updatedAt.slice(0, 10)}</span></p><h3>Organisation guidance</h3><p style={{ whiteSpace: 'pre-wrap' }}>{t.guidance || 'No guidance posted yet.'}</p><p>{t.farmerIds.length} assigned participants · {FIELD_PROGRAMMES[t.programme??'general']}</p>{data.canManage && <button onClick={() => setDraft(t)}>Edit team & guidance</button>}</article>)}
      {data.canManage && <form className={styles.card} onSubmit={e => { e.preventDefault(); void save(true); }}><h2>Assign or update a team</h2><label>Mentor<select required value={draft.mentorId} onChange={e => setDraft(data.teams.find(t => t.mentorId === e.target.value) ?? { ...draft, mentorId: e.target.value, farmerIds: [], guidance: '', location: '' })}><option value="">Choose a mentor</option>{data.people.filter(p => p.role === 'mentor').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Service location<input required maxLength={160} value={draft.location} onChange={e => setDraft({ ...draft, location: e.target.value })} /></label><label>Programme focus<select value={draft.programme??'general'} onChange={e=>setDraft({...draft,programme:e.target.value as FieldProgramme})}>{Object.entries(FIELD_PROGRAMMES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><h3>Participant group</h3><div className={styles.scroll}>{data.people.filter(p => ['farmer', 'student'].includes(p.role)).map(p => <label key={p.id} className={styles.option}><input type="checkbox" checked={draft.farmerIds.includes(p.id)} onChange={e => setDraft({ ...draft, farmerIds: e.target.checked ? [...draft.farmerIds, p.id] : draft.farmerIds.filter(id => id !== p.id) })} />{p.name}</label>)}</div><label>Guidance for this mentor<textarea maxLength={4000} value={draft.guidance} onChange={e => setDraft({ ...draft, guidance: e.target.value })} /></label><button className={styles.primary} disabled={busy}>Save team & guidance</button></form>}
      {panel==='report'&&summary&&scopeValid&&!data.visitCursor&&<><p className={styles.notice}>Internal mentor report · Includes private visit notes. Use the organisation’s published programme report when sharing with funders.</p><ReportComposer deviceData={data} orgId={org||undefined} photos={summary.visits.flatMap(v=>(visitPhotos[v.id]??v.photos??[]).map(p=>({image:p.image,caption:`${v.date} · ${name(v.farmerId)} · ${p.caption}`})))} photoHeading="Visit photographs opened for this report" title={organisation ? 'Field implementation report' : 'Mentor field report'} sample={data.sample}
      metrics={[{label:'Visits recorded',value:String(summary.visits.length)},{label:'Participants visited',value:`${summary.visited} / ${summary.assigned.length}`},{label:'Open actions',value:String(summary.open.length)},{label:'Completed actions',value:String(summary.completed.length)}]}
      chart={summary.focus.length?{title:'Support delivered · visits by area (a visit may cover several areas)',rows:summary.focus}:undefined} sections={[
        { title: 'Report scope', lines: [scopeLabel,`Programme focus: ${programmeLabel}. Prepared ${today}.`,`${summary.assigned.length} currently assigned participants; ${summary.visited} with a recorded visit in this period. This counts participants, not distinct garden sites.`,`Actions are shown at their latest recorded status, checked ${today}; they are not a historical status snapshot.`] },
        { title: 'Assignments & guidance', lines: data.teams.filter(t=>!farmerFilter||t.farmerIds.includes(farmerFilter)).map(t => `${t.location}: ${name(t.mentorId)}. ${t.guidance || 'No guidance recorded.'}`) },
        { title: 'Open follow-up actions', lines: summary.open.map(v=>`${name(v.farmerId)}: ${v.agreedAction} | ${v.responsiblePerson||'Owner needed'} | ${v.followUpDate||'Date needed'}`) },
        { title: 'Completed actions', lines: summary.completed.map(v=>`${name(v.farmerId)} | ${v.actionCompletedOn}: ${v.actionOutcome}`) },
        { title: 'Visit log', lines: summary.visits.map(v => fieldVisitReportLines(v,name(v.farmerId),name(v.mentorId)).join(' · ')) },
        { title: 'Evidence & interpretation', lines: ['Only visits recorded in this field-team workspace appear here. Service delivery does not by itself establish garden outcomes, employment attendance or payroll approval.','Training attendance, certificates of attendance and observed practical skills are separate evidence. Private visit notes are for the organisation and assigned mentor.',`Photographs available for selection: ${summary.visits.reduce((n,v)=>n+(visitPhotos[v.id]??v.photos??[]).length,0)} loaded of ${summary.visits.reduce((n,v)=>n+(v.photoCount??v.photos?.length??0),0)} recorded. Open each saved visit to load its photographs before including them.`] },
      ]} /></>}
    </>}
  </div></section>;
}

'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { getFirebase } from '@/lib/firebase/init';
import { isSampleMode } from '@/lib/sample-mode';
import { sampleRead, sampleWrite } from '@/lib/sample-operations';
import { completeSampleFieldWorkspace, fieldVisitReportLines, freshFieldWorkspace, projectFieldWorkspace, validFieldTeam, validFieldVisit, type FieldTeam, type FieldVisit, type FieldWorkspace } from '@/lib/field-teams';
import VisitCapture from './VisitCapture';
import type { VisitPhoto } from '@/lib/field-teams';
import { samplePortrait } from '@/lib/sample-media';
import ReportComposer from './ReportComposer';
import styles from './MelDashboard.module.css';

const emptyVisit=():FieldVisit=>({id:'',mentorId:'',farmerId:'',date:new Date().toISOString().slice(0,10),notes:'',supportRequested:'',observations:'',agreedAction:'',responsiblePerson:'',followUpDate:'',location:'',photos:[],photoCount:0});

export default function FieldTeams({ organisation = false }: { organisation?: boolean }) {
  const { user, profile } = useAuth();
  const [data, setData] = useState<FieldWorkspace | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<FieldTeam>({ mentorId: '', location: '', farmerIds: [], guidance: '', updatedAt: '' });
  const [visit, setVisit] = useState<FieldVisit>(emptyVisit), [notice, setNotice] = useState('');
  const [visitPhotos,setVisitPhotos]=useState<Record<string,VisitPhoto[]>>({});
  const [captureBusy,setCaptureBusy]=useState(false);
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
    const headers=await paidApiHeaders(actor);
    // Authentication can finish after an account or organisation switch. Never
    // send an old draft using whichever account happens to be current then.
    if(version!==requestVersion.current || expectedScope!==currentScope() || isSampleMode() || getFirebase()?.auth.currentUser?.uid!==actor.uid)throw Error('The workspace changed. Reopen field teams.');
    const res = await fetch(`/api/field-teams?${org ? `org=${encodeURIComponent(org)}` : ''}${query}`, { method: body ? 'POST' : 'GET', headers: { ...headers, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await res.json();
    if(version!==requestVersion.current || expectedScope!==currentScope())throw Error('The workspace changed. Reopen field teams.');
    if (!res.ok) throw Error(result.error); return result;
  };
  async function reload(expectedScope=currentScope(),version=requestVersion.current) {
    setError('');
    try {
      const result=isSampleMode() ? projectFieldWorkspace(completeSampleFieldWorkspace(sampleRead('field-teams', freshFieldWorkspace)), organisation ? 'sample-organisation' : 'sample-mentor', organisation) : await request(undefined,'',expectedScope);
      if(version===requestVersion.current && expectedScope===currentScope())setData(result);
    }
    catch (e) { if(version===requestVersion.current && expectedScope===currentScope()){setData(null); setError((e as Error).message);} }
  }
  useEffect(() => { requestVersion.current++;setVisitOpen(false);setVisit(emptyVisit());setVisitReport(null);setVisitPhotos({});setCaptureBusy(false);setFarmerFilter('');setData(null);setError('');setBusy(false);setPhotosBusy(false);if(isSampleMode()||user)void reload();return()=>{requestVersion.current++;}; }, [user,profile?.org_id,profile?.role,org,organisation]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{if(visitOpen)visitForm.current?.scrollIntoView({block:'start',behavior:'smooth'});},[visitOpen]);
  const canRecordVisits=!!data && !organisation && data.teams.some(team=>team.mentorId===data.selfId);
  const readOnlyVisit=!canRecordVisits || !!visit.mentorId && visit.mentorId!==data?.selfId;
  function newVisit(){
    requestVersion.current++;setError('');setNotice('');setPhotosReady(true);setPhotosBusy(false);
    setVisit({...emptyVisit(),id:crypto.randomUUID(),mentorId:data?.selfId??''});setVisitReport(null);setVisitOpen(true);
  }
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
      if(!team && (!canRecordVisits || !photosReady || !validFieldVisit(nextVisit,new Date().toISOString().slice(0,10),data.sample)))throw Error('Check the farmer, observations, follow-up date and photo captions. A named person or follow-up date needs an agreed action.');
      if (isSampleMode()) {
        if(!data.sample)throw Error('The workspace changed. Reopen field teams.');
        const all = completeSampleFieldWorkspace(sampleRead('field-teams', freshFieldWorkspace));
        if (team) { if (!data.canManage || !validFieldTeam(draft)) throw Error('Choose a mentor, location and unique farmer assignments.'); const next = { ...draft, updatedAt: new Date().toISOString() }; sampleWrite('field-teams', { ...all, teams: [...all.teams.filter(t => t.mentorId !== next.mentorId), next] }); }
        else { if (!all.teams.some(t => t.mentorId===data.selfId && t.farmerIds.includes(nextVisit.farmerId))) throw Error('Choose an assigned farmer.'); sampleWrite('field-teams', { ...all, visits: [...all.visits.filter(v => v.id !== nextVisit.id), {...nextVisit,updatedAt:new Date().toISOString()}] }); }
      } else { if (data.sample) throw Error('This sample has ended. Reopen the workspace.'); await request(team ? { action: 'team', team: draft } : { action: 'visit', ...nextVisit,expectedUpdatedAt:visit.updatedAt },'',scope); }
      if(scope!==currentScope() || version!==requestVersion.current)return;
      setNotice(team ? 'Team and guidance saved. The mentor will see this in their workspace.' : 'Visit recorded.');
      if(!team){setVisitPhotos(previous=>({...previous,[nextVisit.id]:nextVisit.photos??[]}));closeVisit();}await reload(scope,requestVersion.current);
    } catch (e) { if(scope===currentScope() && version===requestVersion.current)setError((e as Error).message); } finally { if(scope===currentScope())setBusy(false); }
  }
  const name = (id: string) => data?.people.find(p => p.id === id)?.name ?? 'Former team member';
  const assigned = [...new Set(data?.teams.flatMap(t => t.farmerIds) ?? [])];
  const captureScope=currentScope(),captureVersion=requestVersion.current;
  const recordedVisits=(data?.visits??[]).filter(v=>!farmerFilter||v.farmerId===farmerFilter).slice().sort((a,b)=>b.date.localeCompare(a.date));
  return <section className={styles.root}><div className={styles.wrap}>
    <div className={styles.hero}><h1>{organisation ? 'Mentor teams & guidance' : 'My field team'}</h1><details className={styles.about}><summary>About this view</summary><p>{organisation ? 'Assign a mentor, service location and farmer group. Keep their current instructions in one place.' : 'Your assigned farmers, location, organisation guidance and visit records.'}</p></details></div>
    {profile?.role === 'admin' && !isSampleMode() && <label>Organisation ID<input value={org} onChange={e => setOrg(e.target.value)} placeholder="Select the organisation you administer" /></label>}
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status" className={styles.notice}>{notice}</p>}
    {!data && !error && <p>Loading field team…</p>}
    {data && <>
      <div className={styles.statsGrid}>{[['Groups', data.teams.length], ['Farmers', assigned.length], ['Visits', data.visits.length]].map(([label, n]) => <div key={label} className={styles.card}>{label}<strong className={styles.stat}>{n}</strong></div>)}</div>
      {canRecordVisits&&<button className={styles.primary} disabled={busy||photosBusy||captureBusy} onClick={newVisit}>Record a field visit</button>}
      {visitOpen&&<section ref={visitForm} className={styles.card} style={{margin:'16px 0'}} aria-label="Visit details">
        <div className={styles.row}><h2>{readOnlyVisit?'Field visit details':visit.updatedAt?'Edit field visit':'Record a field visit'}</h2><button type="button" disabled={busy||captureBusy} onClick={closeVisit}>Close visit</button></div>
        {photosBusy&&<p role="status">Preparing visit photos…</p>}
        {!photosReady&&!photosBusy&&<p role="alert">Visit photos could not be loaded. Close and reopen this visit before editing it.</p>}
        <form onSubmit={e=>{e.preventDefault();void save(false);}}>
          <fieldset disabled={readOnlyVisit||busy||photosBusy||captureBusy||!photosReady} style={{border:0,padding:0,minWidth:0}}>
            <div className={styles.grid}>
              <label>Farmer<select required value={visit.farmerId} onChange={e=>setVisit({...visit,farmerId:e.target.value})}><option value="">Choose a farmer</option>{[...new Set([...assigned,...(visit.farmerId?[visit.farmerId]:[])])].map(id=><option key={id} value={id}>{name(id)}</option>)}</select></label>
              <label>Visit date<input required type="date" max={new Date().toISOString().slice(0,10)} value={visit.date} onChange={e=>setVisit({...visit,date:e.target.value})}/></label>
            </div>
            <label>Site location (optional)<input maxLength={240} value={visit.location??''} placeholder="Garden name, meeting point or directions" onChange={e=>setVisit({...visit,location:e.target.value})}/></label>
            <label>Support requested<textarea maxLength={2000} value={visit.supportRequested??''} placeholder="What does the farmer want help with?" onChange={e=>setVisit({...visit,supportRequested:e.target.value})}/></label>
            <label>Observations and issues<textarea required={!visit.notes.trim()} maxLength={4000} value={visit.observations??''} placeholder="What did you observe during the visit?" onChange={e=>setVisit({...visit,observations:e.target.value})}/></label>
            <label>Agreed action<textarea maxLength={2000} value={visit.agreedAction??''} placeholder="What will happen next?" onChange={e=>setVisit({...visit,agreedAction:e.target.value})}/></label>
            <div className={styles.grid}>
              <label>Responsible person<input maxLength={120} value={visit.responsiblePerson??''} placeholder="Who will carry out the action?" onChange={e=>setVisit({...visit,responsiblePerson:e.target.value})}/></label>
              <label>Follow-up date<input type="date" min={visit.date} value={visit.followUpDate??''} onChange={e=>setVisit({...visit,followUpDate:e.target.value})}/></label>
            </div>
            <VisitCapture key={`${captureScope}|${visit.id}|${captureVersion}`} value={visit} notesRequired={!visit.observations?.trim()} disabled={readOnlyVisit||busy||photosBusy||!photosReady} onBusyChange={setCaptureBusy} onChange={value=>{if(captureScope===currentScope()&&captureVersion===requestVersion.current)setVisit(current=>({...current,...value}));}}/>
            {visit.originalNotes&&<details><summary>Original notes before AI cleanup</summary><p style={{whiteSpace:'pre-wrap'}}>{visit.originalNotes}</p></details>}
            {!readOnlyVisit&&<p className={styles.muted}>Visit notes and photos are visible to the assigned mentor and authorised organisation staff.</p>}
            {!readOnlyVisit&&<button className={styles.primary} disabled={busy||photosBusy||captureBusy||!photosReady}>{busy?'Saving…':'Save visit'}</button>}
          </fieldset>
        </form>
        {visitReport&&<><p className={styles.muted}>This report uses the saved visit. Save any edits to update it.</p><ReportComposer title="Field visit report" sample={data.sample} orgId={org||undefined} photos={visitReport.photos??[]} photoHeading="Visit photographs" sections={[{title:'Visit details',lines:fieldVisitReportLines(visitReport,name(visitReport.farmerId),name(visitReport.mentorId))}]}/></>}
      </section>}
      <section className={styles.card} style={{margin:'16px 0'}} aria-label="Recorded field visits">
        <h2>Recorded visits</h2><label>Filter by farmer<select value={farmerFilter} onChange={e=>setFarmerFilter(e.target.value)}><option value="">All visible farmers</option>{[...new Set(data.visits.map(v=>v.farmerId))].map(id=><option key={id} value={id}>{name(id)}</option>)}</select></label>
        {!recordedVisits.length&&<p>No visits recorded for this selection.</p>}
        {recordedVisits.map(record=><article key={record.id} className={styles.metric}><div className={styles.row}><h3 style={{marginBottom:0}}>{name(record.farmerId)}</h3><span className={styles.tag}>{record.date}</span></div><p>{record.observations||record.notes}</p>{record.agreedAction&&<p><strong>Next action:</strong> {record.agreedAction}<br/><strong>Responsible:</strong> {record.responsiblePerson||'Not yet assigned'} · <strong>Follow-up:</strong> {record.followUpDate||'Not yet scheduled'}</p>}{(record.photoCount??record.photos?.length??0)>0&&<p>{record.photoCount??record.photos?.length} visit photos</p>}<button disabled={busy||photosBusy||captureBusy} onClick={()=>void openVisit(record)}>{canRecordVisits&&record.mentorId===data.selfId?'View / edit visit':'View visit'}</button></article>)}
      </section>
      {!data.teams.length && <p className={styles.card}>No field team assigned yet. Your organisation can assign one in Control centre → Mentor teams.</p>}
      {data.teams.map(t => <article key={t.mentorId} className={styles.card} style={{ marginBottom: 16 }}><h2>{t.location}</h2><p style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{data.sample && <img data-photo-preview src={samplePortrait(t.mentorId)} alt="Fictional mentor portrait" width={72} height={72} style={{ borderRadius: '50%', objectFit: 'cover' }} />}<span>Mentor: {name(t.mentorId)} · updated {t.updatedAt.slice(0, 10)}</span></p><h3>Organisation guidance</h3><p style={{ whiteSpace: 'pre-wrap' }}>{t.guidance || 'No guidance posted yet.'}</p><h3>Assigned farmers and learners</h3>{t.farmerIds.map(id => <p key={id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{data.sample && <img data-photo-preview src={samplePortrait(id)} alt="Fictional profile portrait" width={52} height={52} style={{ borderRadius: '50%' }} />}<span>{name(id)}{data.people.find(p => p.id === id)?.gardenName && <small style={{ display: 'block', fontSize: 13, color: '#526454' }}>{data.people.find(p => p.id === id)?.gardenName} · {Math.round(data.people.find(p => p.id === id)?.gardenAreaM2 ?? 0).toLocaleString()} m²</small>}</span></p>)}{data.canManage && <button onClick={() => setDraft(t)}>Edit team & guidance</button>}</article>)}
      {data.canManage && <form className={styles.card} onSubmit={e => { e.preventDefault(); void save(true); }}><h2>Assign or update a team</h2><label>Mentor<select required value={draft.mentorId} onChange={e => setDraft(data.teams.find(t => t.mentorId === e.target.value) ?? { ...draft, mentorId: e.target.value, farmerIds: [], guidance: '', location: '' })}><option value="">Choose a mentor</option>{data.people.filter(p => p.role === 'mentor').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Service location<input required maxLength={160} value={draft.location} onChange={e => setDraft({ ...draft, location: e.target.value })} /></label><h3>Farmer group</h3><div className={styles.scroll}>{data.people.filter(p => ['farmer', 'student'].includes(p.role)).map(p => <label key={p.id} className={styles.option}><input type="checkbox" checked={draft.farmerIds.includes(p.id)} onChange={e => setDraft({ ...draft, farmerIds: e.target.checked ? [...draft.farmerIds, p.id] : draft.farmerIds.filter(id => id !== p.id) })} />{p.name}</label>)}</div><label>Guidance for this mentor<textarea maxLength={4000} value={draft.guidance} onChange={e => setDraft({ ...draft, guidance: e.target.value })} /></label><button className={styles.primary} disabled={busy}>Save team & guidance</button></form>}
      <ReportComposer photos={data.visits.flatMap(v=>(visitPhotos[v.id]??v.photos??[]).map(p=>({image:p.image,caption:`${v.date} · ${name(v.farmerId)} · ${p.caption}`})))} photoHeading="Visit photographs opened for this report" title={organisation ? 'Field implementation report' : 'Mentor field report'} sample={data.sample} sections={[
        { title: 'Assignments', lines: data.teams.map(t => `${t.location}: ${name(t.mentorId)}; ${t.farmerIds.length} assigned farmers / learners.`) },
        { title: 'Organisation guidance', lines: data.teams.map(t => `${t.location}: ${t.guidance || 'No guidance recorded.'}`) },
        { title: 'Visit log', lines: data.visits.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(v => fieldVisitReportLines(v,name(v.farmerId),organisation?name(v.mentorId):undefined).join(' · ')) },
        { title: 'Coverage', lines: ['Only visits recorded in this field-team workspace appear here. This is a service delivery record; it does not by itself establish farm outcomes. Private visit notes are for the organisation and assigned mentor.'] },
      ]} />
    </>}
  </div></section>;
}

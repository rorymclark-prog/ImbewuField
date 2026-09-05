'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { isSampleMode } from '@/lib/sample-mode';
import { sampleRead, sampleWrite } from '@/lib/sample-operations';
import { freshFieldWorkspace, projectFieldWorkspace, validFieldTeam, type FieldTeam, type FieldWorkspace } from '@/lib/field-teams';
import { samplePortrait } from '@/lib/sample-media';
import ReportComposer from './ReportComposer';
import styles from './MelDashboard.module.css';

export default function FieldTeams({ organisation = false }: { organisation?: boolean }) {
  const { user, profile } = useAuth();
  const [data, setData] = useState<FieldWorkspace | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<FieldTeam>({ mentorId: '', location: '', farmerIds: [], guidance: '', updatedAt: '' });
  const [visit, setVisit] = useState({ id: '', farmerId: '', date: new Date().toISOString().slice(0, 10), notes: '' }), [notice, setNotice] = useState('');
  const [org, setOrg] = useState('');
  const request = async (body?: unknown) => {
    if (isSampleMode()) throw Error('Sample requests must stay in the demo.');
    const res = await fetch(`/api/field-teams${org ? `?org=${encodeURIComponent(org)}` : ''}`, { method: body ? 'POST' : 'GET', headers: { ...(await paidApiHeaders()), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await res.json(); if (!res.ok) throw Error(result.error); return result;
  };
  async function reload() {
    setError('');
    try { if (isSampleMode()) { setData(projectFieldWorkspace(sampleRead('field-teams', freshFieldWorkspace), organisation ? 'sample-organisation' : 'sample-mentor', organisation)); } else { setData(await request()); } }
    catch (e) { setData(null); setError((e as Error).message); }
  }
  useEffect(() => { let cancelled = false; setData(null); setError(''); if (isSampleMode()) { setData(projectFieldWorkspace(sampleRead('field-teams', freshFieldWorkspace), organisation ? 'sample-organisation' : 'sample-mentor', organisation)); return; } if (!user) return; void request().then(d => { if (!cancelled) setData(d); }).catch(e => { if (!cancelled) setError(e.message); }); return () => { cancelled = true; }; }, [user, org, organisation]); // eslint-disable-line react-hooks/exhaustive-deps
  async function save(team: boolean) {
    setBusy(true); setError(''); setNotice('');
    try {
      if (isSampleMode()) {
        const all = sampleRead('field-teams', freshFieldWorkspace);
        if (team) { if (!validFieldTeam(draft)) throw Error('Choose a mentor, location and unique farmer assignments.'); const next = { ...draft, updatedAt: new Date().toISOString() }; sampleWrite('field-teams', { ...all, teams: [...all.teams.filter(t => t.mentorId !== next.mentorId), next] }); }
        else { if (!data?.teams.some(t => t.farmerIds.includes(visit.farmerId))) throw Error('Choose an assigned farmer.'); sampleWrite('field-teams', { ...all, visits: [...all.visits.filter(v => v.id !== visit.id), { ...visit, mentorId: 'sample-mentor' }] }); }
      } else { if (data?.sample) throw Error('This sample has ended. Reopen the workspace.'); await request(team ? { action: 'team', team: draft } : { action: 'visit', ...visit }); }
      setNotice(team ? 'Team and guidance saved. The mentor will see this in their workspace.' : 'Visit recorded.');
      setVisit({ id: '', farmerId: '', date: new Date().toISOString().slice(0, 10), notes: '' }); await reload();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const name = (id: string) => data?.people.find(p => p.id === id)?.name ?? 'Former team member';
  const assigned = [...new Set(data?.teams.flatMap(t => t.farmerIds) ?? [])];
  return <section className={styles.root}><div className={styles.wrap}>
    <div className={styles.hero}><h1>{organisation ? 'Mentor teams & guidance' : 'My field team'}</h1><p>{organisation ? 'Assign a mentor, service location and farmer group. Keep their current instructions in one place.' : 'Your assigned farmers, location, organisation guidance and visit records.'}</p></div>
    {profile?.role === 'admin' && !isSampleMode() && <label>Organisation ID<input value={org} onChange={e => setOrg(e.target.value)} placeholder="Select the organisation you administer" /></label>}
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status" className={styles.notice}>{notice}</p>}
    {!data && !error && <p>Loading field team…</p>}
    {data && <>{data.sample && <p className={styles.notice}>Fictional practice workspace. Changes stay in this sample. No notifications are sent.</p>}
      <div className={styles.grid}>{[['Assigned groups', data.teams.length], ['Distinct farmers / learners', assigned.length], ['Visits recorded here', data.visits.length]].map(([label, n]) => <div key={label} className={styles.card}>{label}<strong className={styles.stat}>{n}</strong></div>)}</div>
      {!data.teams.length && <p className={styles.card}>No field team assigned yet. Your organisation can assign one in Control centre → Mentor teams.</p>}
      {data.teams.map(t => <article key={t.mentorId} className={styles.card} style={{ marginBottom: 16 }}><h2>{t.location}</h2><p style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{data.sample && <img data-photo-preview src={samplePortrait(t.mentorId)} alt="Fictional mentor portrait" width={72} height={72} style={{ borderRadius: '50%', objectFit: 'cover' }} />}<span>Mentor: {name(t.mentorId)} · updated {t.updatedAt.slice(0, 10)}</span></p><h3>Organisation guidance</h3><p style={{ whiteSpace: 'pre-wrap' }}>{t.guidance || 'No guidance posted yet.'}</p><h3>Assigned farmers and learners</h3>{t.farmerIds.map(id => <p key={id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{data.sample && <img data-photo-preview src={samplePortrait(id)} alt="Fictional profile portrait" width={52} height={52} style={{ borderRadius: '50%' }} />}<span>{name(id)}{data.people.find(p => p.id === id)?.gardenName && <small style={{ display: 'block', fontSize: 13, color: '#526454' }}>{data.people.find(p => p.id === id)?.gardenName} · {Math.round(data.people.find(p => p.id === id)?.gardenAreaM2 ?? 0).toLocaleString()} m² · fictional</small>}</span></p>)}{data.canManage && <button onClick={() => setDraft(t)}>Edit team & guidance</button>}</article>)}
      {data.canManage && <form className={styles.card} onSubmit={e => { e.preventDefault(); void save(true); }}><h2>Assign or update a team</h2><label>Mentor<select required value={draft.mentorId} onChange={e => setDraft(data.teams.find(t => t.mentorId === e.target.value) ?? { ...draft, mentorId: e.target.value, farmerIds: [], guidance: '', location: '' })}><option value="">Choose a mentor</option>{data.people.filter(p => p.role === 'mentor').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Service location<input required maxLength={160} value={draft.location} onChange={e => setDraft({ ...draft, location: e.target.value })} /></label><h3>Farmer group</h3><div className={styles.scroll}>{data.people.filter(p => ['farmer', 'student'].includes(p.role)).map(p => <label key={p.id} className={styles.option}><input type="checkbox" checked={draft.farmerIds.includes(p.id)} onChange={e => setDraft({ ...draft, farmerIds: e.target.checked ? [...draft.farmerIds, p.id] : draft.farmerIds.filter(id => id !== p.id) })} />{p.name}</label>)}</div><label>Guidance for this mentor<textarea maxLength={4000} value={draft.guidance} onChange={e => setDraft({ ...draft, guidance: e.target.value })} /></label><button className={styles.primary} disabled={busy}>Save team & guidance</button></form>}
      {!organisation && assigned.length > 0 && <form className={styles.card} onSubmit={e => { e.preventDefault(); void save(false); }}><h2>Record a field visit</h2><label>Farmer<select required value={visit.farmerId} onChange={e => setVisit({ ...visit, id: visit.id || crypto.randomUUID(), farmerId: e.target.value })}><option value="">Choose a farmer</option>{assigned.map(id => <option key={id} value={id}>{name(id)}</option>)}</select></label><label>Visit date<input required type="date" max={new Date().toISOString().slice(0, 10)} value={visit.date} onChange={e => setVisit({ ...visit, date: e.target.value })} /></label><label>Visit outcome and follow-up<textarea required maxLength={4000} value={visit.notes} onChange={e => setVisit({ ...visit, notes: e.target.value })} /></label><button className={styles.primary} disabled={busy}>Save visit</button></form>}
      <ReportComposer title={organisation ? 'Field implementation report' : 'Mentor field report'} sample={data.sample} sections={[
        { title: 'Assignments', lines: data.teams.map(t => `${t.location}: ${name(t.mentorId)}; ${t.farmerIds.length} assigned farmers / learners.`) },
        { title: 'Organisation guidance', lines: data.teams.map(t => `${t.location}: ${t.guidance || 'No guidance recorded.'}`) },
        { title: 'Visit log', lines: data.visits.map(v => `${v.date} | ${name(v.farmerId)} | ${v.notes}`) },
        { title: 'Coverage', lines: ['Only visits recorded in this field-team workspace appear here. This is a service delivery record; it does not by itself establish farm outcomes. Private visit notes are for the organisation and assigned mentor.'] },
      ]} />
    </>}
  </div></section>;
}

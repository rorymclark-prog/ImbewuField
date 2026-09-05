'use client';
import { useEffect, useState } from 'react';
import { isSampleMode } from '@/lib/sample-mode';
import { analyseAssessment } from '@/lib/mel';
import { MEL_TEMPLATES } from '@/lib/mel-templates';
import { buildSampleAssessments, freshSampleProgramme, samplePublishedAssessments, type SampleProgrammeControls } from '@/lib/sample-programme';
import { MelMetrics } from '@/components/MelDashboard';
import styles from './MelDashboard.module.css';
const KEY = 'imbewu-sample-programme';
export function readSampleProgramme(): SampleProgrammeControls {
  if (!isSampleMode()) return freshSampleProgramme();
  try { const saved = window.localStorage.getItem(KEY); if (saved) return JSON.parse(saved); } catch { /* reset to fixture */ }
  return freshSampleProgramme();
}
export default function SampleProgramme({ funder = false, accessOnly = false, compact = false }: { funder?: boolean; accessOnly?: boolean; compact?: boolean }) {
  const [controls, setControls] = useState(freshSampleProgramme);
  const [selected, setSelected] = useState('sample-baseline');
  const [zu, setZu] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => { setControls(readSampleProgramme()); }, []);
  function update(next: SampleProgrammeControls) {
    if (!isSampleMode()) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(next)); setControls(next); setNotice('Sample updated. Switch to the funder sample to see what is shared.'); }
    catch { setNotice('Could not update the sample. Reset and try again.'); }
  }
  const data = buildSampleAssessments();
  const chosen = data.find(x => x.assessment.id === selected)!;
  const assigned = data.reduce((n, x) => n + x.assessment.participantIds.length, 0);
  const completed = data.reduce((n, x) => n + x.rows.length, 0);
  if (compact) return <div className={styles.compact}><strong>Sample assessments</strong><span>{assigned} assignments · {completed} completed</span><span>{controls.published.length} summaries shared</span></div>;
  if (accessOnly) return <div className={styles.card}>
    <h2>People & access · sample</h2><p className={styles.notice}>Practise with fictional members. These switches affect this sample only, never a real person.</p>
    <label className={styles.option}><input type="checkbox" checked={controls.funderAccess} onChange={e => update({ ...controls, funderAccess: e.target.checked })} />Allow linked funders to view our dashboards</label>
    <p>Member roles choose the workspace. Assessment permissions let the NGO delegate specific work. Farmer consent and publication checks still apply.</p>
    {controls.people.map(p => <div key={p.id} className={styles.metric}><h3>{p.name}</h3><label>App role<select value={p.role} onChange={e => update({ ...controls, people: controls.people.map(x => x.id === p.id ? { ...x, role: e.target.value as typeof p.role, manage: false, analyse: false, people: false } : x) })}>{['farmer', 'student', 'mentor', 'ngo'].map(role => <option key={role}>{role}</option>)}</select></label>
      {(['manage', 'analyse', 'people'] as const).map(key => <label key={key} className={styles.option}><input type="checkbox" checked={p[key]} disabled={key === 'people' ? p.role !== 'ngo' : !['ngo', 'mentor'].includes(p.role)} onChange={e => update({ ...controls, people: controls.people.map(x => x.id === p.id ? { ...x, [key]: e.target.checked } : x) })} />{{ manage: 'Manage assessments', analyse: 'Read private analysis', people: 'Manage people' }[key]}</label>)}
    </div>)}{notice && <p role="status">{notice}</p>}
  </div>;
  const published = samplePublishedAssessments(controls);
  if (funder) return <><p className={styles.notice}>Fictional sample results · only summaries shared by the sample NGO appear here.</p>{!controls.funderAccess ? <p className={styles.card}>The sample NGO has switched off funder access.</p> : !published.length ? <p className={styles.card}>The sample NGO has not shared any summaries.</p> : published.map(a => <details key={a.id} className={styles.card} style={{ margin: '16px 0' }}><summary>{a.title} · {a.completed}/{a.assigned} completed</summary><MelMetrics metrics={a.metrics} /><p>Example responses, not measured project outcomes. Private feedback is excluded.</p></details>)}</>;
  return <>
    <p className={styles.notice}>Fictional sample learning cohort · 16 example participants. Counts are assignments, not messages sent or unique farmers. Missing numerical answers remain unknown.</p>
    <div className={styles.grid}>{[['Assigned', assigned], ['Completed', completed], ['Awaiting responses', assigned - completed], ['Shared summaries', controls.published.length]].map(([label, value]) => <div key={label} className={styles.card}>{label}<strong className={styles.stat}>{value}</strong></div>)}</div>
    <div className={styles.row}><button onClick={() => setZu(false)} aria-pressed={!zu}>English</button><button onClick={() => setZu(true)} aria-pressed={zu}>isiZulu</button></div>
    <div className={styles.grid}>{data.map(({ assessment: a, rows }) => <button key={a.id} onClick={() => setSelected(a.id)} aria-pressed={a.id === selected}>{zu ? MEL_TEMPLATES[a.stage].zu : a.title}<p>{a.state} · {rows.length}/{a.participantIds.length} completed</p></button>)}</div>
    <article className={styles.card}><h2>{zu ? MEL_TEMPLATES[chosen.assessment.stage].zu : chosen.assessment.title}</h2>
      {chosen.assessment.state === 'draft' ? <p>This draft demonstrates the next stage. No participants are assigned yet.</p> : <MelMetrics metrics={analyseAssessment(chosen.assessment, MEL_TEMPLATES[chosen.assessment.stage], chosen.rows).metrics} zu={zu} />}
      {chosen.assessment.state === 'closed' && <label className={styles.option}><input type="checkbox" checked={controls.published.includes(selected)} onChange={e => update({ ...controls, published: e.target.checked ? [...controls.published, selected] : controls.published.filter(id => id !== selected) })} />Share this sample summary with funders</label>}
      <details><summary>Review questions</summary>{MEL_TEMPLATES[chosen.assessment.stage].questions.map(q => <p key={q.id}>{zu ? q.zu : q.en}</p>)}</details>
      {notice && <p role="status">{notice}</p>}
    </article>
  </>;
}

/** Mirrors the live organisation sharing gate without contacting its API. */
export function SampleFunderGate({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => { setAllowed(!isSampleMode() || readSampleProgramme().funderAccess); }, []);
  if (allowed === null) return null;
  return allowed ? children : <section className={styles.root}><h1>Sample funder access is off</h1><p>The sample NGO has hidden its dashboards. Switch to NGO → People & access to turn sharing back on, or reset the sample.</p></section>;
}

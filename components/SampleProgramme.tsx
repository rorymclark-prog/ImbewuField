'use client';
import { useEffect, useState } from 'react';
import { isSampleMode } from '@/lib/sample-mode';
import { analyseAssessment, MEL_STAGES, type MelStage } from '@/lib/mel';
import { MEL_TEMPLATES } from '@/lib/mel-templates';
import { buildSampleAssessments, sampleAssessments, changeSampleAssessment, freshSampleProgramme, samplePublishedAssessments, type SampleProgrammeControls } from '@/lib/sample-programme';
import { MelMetrics } from '@/components/MelDashboard';
import styles from './MelDashboard.module.css';
const KEY = 'imbewu-sample-programme';
export function readSampleProgramme(): SampleProgrammeControls {
  if (!isSampleMode()) return freshSampleProgramme();
  try { const saved = window.localStorage.getItem(KEY); if (saved) return JSON.parse(saved); } catch { /* reset to fixture */ }
  return freshSampleProgramme();
}
export default function SampleProgramme({ funder = false, accessOnly = false, compact = false, language }: { funder?: boolean; accessOnly?: boolean; compact?: boolean; language?: boolean }) {
  const [controls, setControls] = useState(freshSampleProgramme);
  const [selected, setSelected] = useState('sample-baseline');
  const [localZu, setZu] = useState(false);
  const zu = language ?? localZu;
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState({ title: '', project: "Community garden learning cohort", stage: 'baseline' as MelStage, due: '' });
  const [chosenPeople, setChosenPeople] = useState<string[]>([]);
  const [funderPreview, setFunderPreview] = useState(false);
  useEffect(() => { const saved=readSampleProgramme();setControls(saved);const id=new URLSearchParams(window.location.search).get('assessment');if(id&&sampleAssessments(saved).some(a=>a.assessment.id===id))setSelected(id); }, []);
  function update(next: SampleProgrammeControls) {
    if (!isSampleMode()) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(next)); setControls(next); setNotice('Changes saved.'); }
    catch { setNotice('Could not save the changes. Try again.'); }
  }
  const data = sampleAssessments(controls);
  const chosen = data.find(x => x.assessment.id === selected)!;
  const assigned = data.reduce((n, x) => n + x.assessment.participantIds.length, 0);
  const completed = data.reduce((n, x) => n + x.rows.length, 0);
  if (compact) return <div className={styles.compact}><strong>Assessments</strong><span>{assigned} assignments · {completed} completed</span><span>{controls.published.length} summaries shared</span></div>;
  if (accessOnly) return <div className={styles.card}>
    <h2>People &amp; access</h2>
    <label className={styles.option}><input type="checkbox" checked={controls.funderAccess} onChange={e => update({ ...controls, funderAccess: e.target.checked })} />Allow linked funders to view our dashboards</label>
    <p>Member roles choose the workspace. Assessment permissions let the organisation delegate specific work. Farmer consent and publication checks still apply.</p>
    {controls.people.map(p => <div key={p.id} className={styles.metric}><h3>{p.name}</h3><label>App role<select value={p.role} onChange={e => update({ ...controls, people: controls.people.map(x => x.id === p.id ? { ...x, role: e.target.value as typeof p.role, manage: false, analyse: false, people: false, training: false } : x) })}>{['farmer', 'student', 'mentor', 'ngo'].map(role => <option key={role} value={role}>{role === 'ngo' ? 'Organisation' : role[0].toUpperCase() + role.slice(1)}</option>)}</select></label>
      {(['manage', 'analyse', 'training', 'people'] as const).map(key => <label key={key} className={styles.option}><input type="checkbox" checked={p[key] ?? false} disabled={key === 'people' ? p.role !== 'ngo' : !['ngo', 'mentor'].includes(p.role)} onChange={e => update({ ...controls, people: controls.people.map(x => x.id === p.id ? { ...x, [key]: e.target.checked } : x) })} />{{ manage: 'Manage assessments', analyse: 'Read private analysis', training: 'Record training & attendance', people: 'Manage people' }[key]}</label>)}
    </div>)}{notice && <p role="status">{notice}</p>}
  </div>;
  const published = samplePublishedAssessments(controls);
  if (funder) return <><h2>Shared assessments</h2><p>Summaries shared by the organisation. Private feedback remains restricted.</p>{!controls.funderAccess ? <p className={styles.card}>The organisation has switched off funder access.</p> : !published.length ? <p className={styles.card}>The organisation has not shared any summaries.</p> : published.map(a => <details key={a.id} className={styles.card} style={{ margin: '16px 0' }}><summary>{a.title} · {a.completed}/{a.assigned} completed</summary><MelMetrics metrics={a.metrics} /></details>)}</>;
  return <>
    <details><summary>About these counts</summary><p>Counts show assessment assignments and responses. A participant may appear in several assessments. Missing numerical answers remain unknown.</p></details>
    <div className={styles.grid}>{[['Assigned', assigned], ['Completed', completed], ['Awaiting responses', assigned - completed], ['Shared summaries', controls.published.length]].map(([label, value]) => <div key={label} className={styles.card}>{label}<strong className={styles.stat}>{value}</strong></div>)}</div>
    {language === undefined && <div className={styles.row}><button onClick={() => setZu(false)} aria-pressed={!zu}>English</button><button onClick={() => setZu(true)} aria-pressed={zu}>isiZulu</button></div>}
    <details className={styles.card}><summary>Create an assessment</summary>
      <label>Stage<select value={draft.stage} onChange={e => setDraft({ ...draft, stage: e.target.value as MelStage })}>{MEL_STAGES.map(s => <option key={s} value={s}>{MEL_TEMPLATES[s].en}</option>)}</select></label>
      <label>Project / course cohort<input value={draft.project} onChange={e => setDraft({ ...draft, project: e.target.value })} /></label>
      <label>Assessment title<input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
      <label>Due date<input type="date" value={draft.due} onChange={e => setDraft({ ...draft, due: e.target.value })} /></label>
      <button disabled={!draft.title.trim() || !draft.project.trim() || !draft.due} onClick={() => { const id = `sample-custom-${Date.now()}`; const base = buildSampleAssessments()[0].assessment; update({ ...controls, assessments: [...data, { assessment: { ...base, ...draft, id, state: 'draft', published: false, participantIds: [] }, rows: [] }] }); setSelected(id); setChosenPeople([]); setDraft({ ...draft, title: '' }); }}>Save draft</button>
    </details>
    <div className={styles.grid}>{data.map(({ assessment: a, rows }) => <button key={a.id} onClick={() => { setSelected(a.id); setChosenPeople([]); setFunderPreview(false); }} aria-pressed={a.id === selected}>{zu ? MEL_TEMPLATES[a.stage].zu : a.title}<p>{a.state} · {rows.length}/{a.participantIds.length} completed</p></button>)}</div>
    <article className={styles.card}><h2>{zu ? MEL_TEMPLATES[chosen.assessment.stage].zu : chosen.assessment.title}</h2>
      {chosen.assessment.state === 'draft' ? <div><p>Choose participants for this assessment.</p>{Array.from({ length: 16 }, (_, i) => `sample-person-${i + 1}`).map((id, i) => <label key={id} className={styles.option}><input type="checkbox" checked={chosenPeople.includes(id)} onChange={e => setChosenPeople(e.target.checked ? [...chosenPeople, id] : chosenPeople.filter(x => x !== id))} />Participant {i + 1}</label>)}<button disabled={!chosenPeople.length} onClick={() => update(changeSampleAssessment(controls, selected, { state: 'open', participantIds: chosenPeople }))}>Open for {chosenPeople.length} participants</button></div> : <MelMetrics metrics={analyseAssessment(chosen.assessment, MEL_TEMPLATES[chosen.assessment.stage], chosen.rows, funderPreview).metrics} zu={zu} />}
      {chosen.assessment.state !== 'draft' && <div className={styles.row}><button aria-pressed={!funderPreview} onClick={() => setFunderPreview(false)}>Private organisation analysis</button><button aria-pressed={funderPreview} onClick={() => setFunderPreview(true)}>Preview funder summary</button>{chosen.assessment.state === 'open' && <button onClick={() => update(changeSampleAssessment(controls, selected, { state: 'closed' }))}>Close assessment</button>}</div>}
      <details style={{ marginTop: 20 }}><summary>Learning action · what will we change?</summary>
        <label>Action<textarea value={chosen.assessment.action ?? ''} onChange={e => update(changeSampleAssessment(controls, selected, { action: e.target.value }))} /></label>
        <label>Responsible person<input value={chosen.assessment.actionOwner ?? ''} onChange={e => update(changeSampleAssessment(controls, selected, { actionOwner: e.target.value }))} /></label>
        <label>Due<input type="date" value={chosen.assessment.actionDue ?? ''} onChange={e => update(changeSampleAssessment(controls, selected, { actionDue: e.target.value }))} /></label>
        <label className={styles.option}><input type="checkbox" checked={chosen.assessment.actionDone ?? false} onChange={e => update(changeSampleAssessment(controls, selected, { actionDone: e.target.checked }))} />Completed</label><p className={styles.muted}>Changes save as you go.</p>
      </details>
      {chosen.assessment.state === 'closed'  && <label className={styles.option}><input type="checkbox" checked={controls.published.includes(selected)} onChange={e => update({ ...controls, published: e.target.checked ? [...controls.published, selected] : controls.published.filter(id => id !== selected) })} />Share this summary with funders</label>}
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
  return allowed ? children : <section className={styles.root}><h1>Funder access is off</h1><p>The organisation has hidden its dashboards. Switch to Organisation → Control centre → People & permissions to turn sharing back on.</p></section>;
}

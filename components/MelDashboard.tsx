'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { isSampleMode } from '@/lib/sample-mode';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { MEL_TEMPLATES } from '@/lib/mel-templates';
import { MEL_STAGES, analyseAssessment, type MelAssessment, type MelMetric, type MelPermission, type MelResponse, type MelStage } from '@/lib/mel';
import type { UserRole } from '@/lib/db/types';
import styles from './MelDashboard.module.css';
import SampleProgramme from './SampleProgramme';

export async function melRequest(query = '', body?: unknown) {
  const response = await fetch(`/api/assessments${query}`, { method: body ? 'POST' : 'GET', headers: { ...await paidApiHeaders(), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Could not load assessments.');
  return data;
}
const TIMING_ZU: Record<MelStage, string> = {
  baseline: 'Ngaphambi kokuthi kuqale usizo lwephrojekthi. Uma sekuqalile, bhala ukuthi izimpendulo zibheka emuva.',
  course_before: 'Ekuqaleni kwesifundo, ngaphambi kokufundisa.',
  course_after: 'Ngosuku lokugcina. Lawa amakhono abikwa umfundi; hlola nomsebenzi awenzayo ngokoqobo.',
  midpoint: 'Maphakathi nephrojekthi, kusenesikhathi sokuthuthukisa usizo.',
  closeout: 'Ekupheleni kwephrojekthi, kusetshenziswa izikhathi ezifanayo nezasekuqaleni.',
  app_midpoint: 'Ngesikhathi sokubuyekeza maphakathi, njengefomu elihlukile lokuzithandela.',
  app_closeout: 'Phinda ekupheleni ukuze ubone ukuthi izinguquko zisizile yini.',
};
type Listed = MelAssessment & { assigned: number; completed: number; response?: MelResponse | null };
type Person = { id: string; name: string; role: UserRole; permissions: MelPermission | null };
type Analysis = ReturnType<typeof analyseAssessment> & { comments: { question: string; text: string }[]; comparison: { id: string; en: string; n: number; change: number | null }[] | null; funderPreview: ReturnType<typeof analyseAssessment> };

export function MelMetrics({ metrics, zu = false }: { metrics: MelMetric[]; zu?: boolean }) {
  return <div>{metrics.map(m => <div className={styles.metric} key={m.id}>
    <strong>{zu ? m.zu : m.en}</strong>
    {m.suppressed ? <p className={styles.muted}>{zu ? 'Kugodliwe ukuvikela iqembu elincane.' : 'Withheld to protect a small group.'}</p> : <>
      <p className={styles.muted}>{m.n} {zu ? 'baphendulile' : 'answered'} · {m.missing} {zu ? 'beqile' : 'skipped'}</p>
      {m.mean !== undefined && <p>{zu ? 'Isilinganiso' : 'Average'}: <strong>{m.mean.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}</strong></p>}
      {m.choices?.map(o => <div key={o.value}><div className={styles.row}><span>{zu ? o.zu : o.en}</span><strong>{o.count}</strong></div><div className={styles.bar}><span style={{ width: `${m.n ? 100 * o.count / m.n : 0}%` }} /></div></div>)}
    </>}
  </div>)}</div>;
}

export default function MelDashboard({ compact = false, accessOnly = false }: { compact?: boolean; accessOnly?: boolean }) {
  const { user, role } = useAuth();
  // A different account must never inherit an in-flight private analysis or form.
  return <MelDashboardBody key={`${user?.uid ?? 'guest'}:${role}`} compact={compact} accessOnly={accessOnly} />;
}
function MelDashboardBody({ compact = false, accessOnly = false }: { compact?: boolean; accessOnly?: boolean }) {
  const { user, role, loading: authLoading } = useAuth();
  const [sample, setSample] = useState(false);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [org, setOrg] = useState('');
  const request = useCallback((query = '', body?: unknown) => melRequest(org ? `${query}${query.includes('?') ? '&' : '?'}org=${encodeURIComponent(org)}` : query, body), [org]);
  useEffect(() => {
    let cancelled = false;
    if (role !== 'admin' || !user || isSampleMode()) return;
    void (async () => {
      try { const r = await fetch('/api/network/orgs', { headers: await paidApiHeaders() }); const d = await r.json(); if (!r.ok) throw new Error(d.error); if (!cancelled) { setOrgs(d.orgs); setOrg(d.orgs[0]?.id ?? ''); } }
      catch (e) { if (!cancelled) setError((e as Error).message); }
    })();
    return () => { cancelled = true; };
  }, [role, user]);
  const [list, setList] = useState<Listed[]>([]);
  const [permissions, setPermissions] = useState<MelPermission>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<Listed | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [publishedPreview, setPublishedPreview] = useState(false);
  const [stage, setStage] = useState<MelStage>('baseline');
  const [project, setProject] = useState('');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [zu, setZu] = useState(false);
  const t = (en: string, zulu: string) => zu ? zulu : en;
  const requestVersion = useRef(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [accessView, setAccessView] = useState(false);
  const [funderAccess, setFunderAccess] = useState(true);
  const [participants, setParticipants] = useState<{ id: string; name: string }[]>([]);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [action, setAction] = useState('');
  const [owner, setOwner] = useState('');
  const [actionDue, setActionDue] = useState('');
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => { setSample(isSampleMode()); }, []);
  const reload = useCallback(async () => {
    if (!user || isSampleMode() || (role === 'admin' && !org)) { setReady(true); return; }
    const version = ++requestVersion.current;
    try { const data = await request(); if (version !== requestVersion.current) return; setList(data.assessments); setPermissions(data.permissions); setReady(true); }
    catch (e) { if (version === requestVersion.current) { setError((e as Error).message); setReady(true); } }
  }, [user, role, org, request]);
  useEffect(() => { setList([]); setSelected(null); setAnalysis(null); setPermissions({}); setError(''); setPeople([]); setAccessView(false); setReady(false); void reload(); return () => { requestVersion.current++; }; }, [reload]);
  async function perform(body: unknown, message: string) {
    setBusy(true); setError(''); setNotice('');
    try { await request('', body); await reload(); if (accessOnly) { const d = await request('?mode=people'); setPeople(d.people); setFunderAccess(d.funderAccess); } setNotice(message); setSelected(null); setAnalysis(null); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function open(a: Listed) {
    setBusy(true);
    setSelected(a); setAnalysis(null); setAssigned([]); setParticipants([]); setAnswers(a.response?.answers ?? {}); setConsent(false); setNotice(''); setError('');
    setAction(a.action ?? ''); setOwner(a.actionOwner ?? ''); setActionDue(a.actionDue ?? ''); setDone(a.actionDone ?? false); setPublishedPreview(false);
    try {
      if (permissions.analyse) setAnalysis(await request(`?mode=analysis&id=${a.id}`));
      if (permissions.manage && a.state === 'draft') setParticipants((await request('?mode=participants')).people);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!accessOnly || sample || !permissions.people) return;
    let cancelled = false;
    void request('?mode=people').then(d => { if (!cancelled) { setPeople(d.people); setFunderAccess(d.funderAccess); setAccessView(true); } }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [accessOnly, sample, permissions.people, request]);
  const staff = permissions.manage || permissions.analyse;
  const completed = list.reduce((s, a) => s + (a.completed ?? 0), 0);
  const assignedCount = list.reduce((s, a) => s + (a.assigned ?? 0), 0);
  const overdue = list.filter(a => a.state === 'open' && a.due < new Date().toISOString().slice(0, 10)).reduce((s, a) => s + Math.max(0, a.assigned - a.completed), 0);
  if (compact && sample) return <SampleProgramme compact />;
  if (compact) return <div className={styles.compact}><strong>Assessments & learning</strong>{sample ? <span>Explore the assessment templates in the organisation Assessments tab.</span> : error ? <span>{error}</span> : !ready ? <span>Loading…</span> : <><span>{assignedCount} assignments</span><span>{completed} completed</span><span>{overdue} overdue</span><a href="/assessments">Open assessments →</a></>}</div>;
  if (authLoading) return <p className={styles.root}>Loading your account…</p>;
  if (!user && !sample) return <div className={styles.root}><h1>Project assessments</h1><p><a href="/login">Sign in</a> to see assessments assigned by your organisation.</p></div>;

  return <section className={styles.root}><div className={styles.wrap}>
    {!accessOnly && <div className={styles.hero}><span>IMBEWUFIELD · PROJECT LEARNING</span><h1>{accessOnly ? 'People & access' : zu ? 'Ukuhlola nokufunda' : 'Assessments & learning'}</h1><p>{t('Listen to farmers. Follow progress. Record what we change.', 'Lalela abalimi. Landela intuthuko. Bhala esikushintshayo.')}</p><div className={styles.row}><button onClick={() => setZu(false)} aria-pressed={!zu}>English</button><button onClick={() => setZu(true)} aria-pressed={zu}>isiZulu</button><a href="/ngo" style={{ color: 'white' }}>{t('Organisation dashboard', 'Ideshibhodi ye-NGO')}</a></div></div>}
    {role === 'admin' && !sample && <label>Organisation<select value={org} onChange={e => { setOrg(e.target.value); setSelected(null); setAnalysis(null); }}>{orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status" className={styles.notice}>{notice}</p>}
    {accessOnly && <div className={styles.card} style={{ marginBottom: 16 }}><h2>People & access</h2><p>Set member roles, delegate assessments and control funder sharing for this organisation.</p><p>These controls cover the permissions listed below. They do not yet provide a separate on/off switch for every app feature. Platform administrator and funder accounts remain platform-managed.</p></div>}
    {sample ? <SampleProgramme accessOnly={accessOnly} language={zu} /> : <>

      {!ready && <p>Loading assessments…</p>}
      {staff && !accessOnly && <>
        <div className={styles.grid}>{[['Assigned', assignedCount], ['Completed', completed], ['Overdue', overdue], ['Published summaries', list.filter(a => a.published).length]].map(([label, n]) => <div className={styles.card} key={label}><span className={styles.muted}>{label}</span><strong className={styles.stat}>{n}</strong></div>)}</div>
        <p className={styles.muted}>Counts are assessment assignments, not unique people. Assigned means available in the app; it does not mean a WhatsApp, email or SMS was sent.</p>
      </>}
      {permissions.people && !accessOnly && <button onClick={async () => { try { const d = await request('?mode=people'); setPeople(d.people); setFunderAccess(d.funderAccess); setAccessView(!accessView); } catch (e) { setError((e as Error).message); } }}>People & funder access</button>}
      {accessView && <div className={styles.card} style={{ marginTop: 16 }}><h2>Organisation access</h2><p>Assign app roles within your organisation. Platform administrators, funder identities and organisation transfers are managed by the platform administrator. Role changes apply to the next server request; the member may need to refresh their screen.</p>
        <label className={styles.option}><input type="checkbox" checked={funderAccess} onChange={e => setFunderAccess(e.target.checked)} />Allow linked funders to view our dashboards</label><button disabled={busy} onClick={() => void perform({ action: 'sharing', funderAccess }, 'Funder access updated.')}>Save funder access</button>
        <p className={styles.muted}>Farmer consent still applies. Assessment summaries remain private until published individually. Previously exported files cannot be recalled.</p>
        {people.filter(p => ['farmer', 'student', 'mentor', 'ngo'].includes(p.role)).map(p => <div className={styles.metric} key={p.id}><strong>{p.name}{p.id === user?.uid ? ' (you)' : ''}</strong><div className={styles.row}>
          <label>App role<select disabled={p.id === user?.uid} value={p.role} onChange={e => setPeople(people.map(x => x.id === p.id ? { ...x, role: e.target.value as UserRole } : x))}>{(['farmer', 'student', 'mentor', 'ngo'] as const).map(r => <option key={r} value={r}>{r === 'ngo' ? 'Organisation' : r[0].toUpperCase() + r.slice(1)}</option>)}</select></label>
          {(['manage', 'analyse', 'training', 'people'] as const).map(key => <label key={key} className={styles.option}><input type="checkbox" disabled={p.id === user?.uid || !['ngo', 'mentor'].includes(p.role) || (key === 'people' && p.role !== 'ngo')} checked={p.permissions?.[key] ?? p.role === 'ngo'} onChange={e => setPeople(people.map(x => x.id === p.id ? { ...x, permissions: { ...x.permissions, [key]: e.target.checked } } : x))} />{({ manage: 'Manage assessments', analyse: 'Read private analysis', training: 'Record training & attendance', people: 'Manage people' })[key]}</label>)}
          <button disabled={busy || p.id === user?.uid} onClick={() => void perform({ action: 'person', id: p.id, role: p.role, permissions: { training: p.permissions?.training ?? p.role === 'ngo', manage: p.permissions?.manage ?? p.role === 'ngo', analyse: p.permissions?.analyse ?? p.role === 'ngo', people: p.permissions?.people ?? p.role === 'ngo' } }, `Access updated for ${p.name}.`)}>Save access</button>
        </div></div>)}
      </div>}
      {accessOnly && ready && !permissions.people && <p className={styles.notice}>Your account cannot manage people here. Ask an organisation administrator to grant Manage people access.</p>}
      {!accessOnly && <>
      {permissions.manage && !selected && <details className={styles.card} style={{ marginTop: 16 }}><summary>Create an assessment</summary><label>Stage<select value={stage} onChange={e => setStage(e.target.value as MelStage)}>{MEL_STAGES.map(s => <option key={s} value={s}>{MEL_TEMPLATES[s].en}</option>)}</select></label><p>{zu ? TIMING_ZU[stage] : MEL_TEMPLATES[stage].timing}</p><label>Project / course cohort<input value={project} maxLength={160} onChange={e => setProject(e.target.value)} placeholder="Use the same name throughout this assessment cycle" /></label><label>Assessment title<input value={title} maxLength={160} onChange={e => setTitle(e.target.value)} /></label><label>Due date<input type="date" value={due} onChange={e => setDue(e.target.value)} /></label><details><summary>Review the questions · English and isiZulu</summary>{MEL_TEMPLATES[stage].questions.map(q => <p key={q.id}><strong>{q.en}</strong><br />{q.zu}</p>)}</details><button className={styles.primary} disabled={busy || !project.trim() || !title.trim() || !due} onClick={() => void perform({ action: 'create', project, title, stage, due }, 'Draft created. Choose its participants before opening it.')}>Save draft</button></details>}
      {!selected && <div className={styles.grid}>{list.map(a => <article className={styles.card} key={a.id}><span className={styles.tag}>{a.state}{a.published ? ' · published' : ''}</span><h2 style={{ marginTop: 12 }}>{a.title}</h2><p>{a.project} · {zu ? MEL_TEMPLATES[a.stage]?.zu : MEL_TEMPLATES[a.stage]?.en}</p><p className={styles.muted}>Due {a.due}{staff ? ` · ${a.completed}/${a.assigned} completed` : a.response ? ' · completed' : ''}</p><button disabled={busy} onClick={() => void open(a)}>{staff ? t('Open assessment', 'Vula ukuhlola') : a.response ? t('View my response', 'Buka izimpendulo zami') : t('Answer assessment', 'Phendula ukuhlola')}</button></article>)}</div>}
      {ready && !list.length && !sample && <p className={styles.card}>{t('No assessments yet.', 'Akukho ukuhlola okwamanje.')} {permissions.manage ? t('Create a draft using the questions above.', 'Dala uhlaka usebenzisa imibuzo engenhla.') : t('Your organisation will assign assessments here.', 'I-NGO yakho izokwabela ukuhlola lapha.')}</p>}
      {selected && <div className={styles.card} style={{ marginTop: 20 }}><button disabled={busy} onClick={() => { setSelected(null); setAnalysis(null); }}>{t('← All assessments', '← Konke ukuhlola')}</button><h2 style={{ marginTop: 20 }}>{selected.title}</h2><p>{selected.project} · {selected.due}</p>
        {staff ? <>
          {selected.state === 'draft' && permissions.manage && <><h3>Choose participants</h3><p>Only selected farmers and students can answer. No external messages will be sent.</p><div className={styles.scroll}>{participants.map(p => <label key={p.id} className={styles.option}><input type="checkbox" checked={assigned.includes(p.id)} onChange={e => setAssigned(e.target.checked ? [...assigned, p.id] : assigned.filter(id => id !== p.id))} />{p.name}</label>)}</div><button disabled={busy || !assigned.length} className={styles.primary} onClick={() => void perform({ action: 'open', id: selected.id, participantIds: assigned }, 'Assessment opened for the selected participants.')}>Open for {assigned.length} participants</button></>}
          {selected.state === 'open' && permissions.manage && <button disabled={busy} onClick={() => void perform({ action: 'close', id: selected.id }, 'Assessment closed. Responses are now read-only.')}>Close assessment</button>}
          {analysis && <><div className={styles.row} style={{ marginTop: 20 }}><button aria-pressed={!publishedPreview} onClick={() => setPublishedPreview(false)}>Private NGO analysis</button><button aria-pressed={publishedPreview} onClick={() => setPublishedPreview(true)}>Preview funder summary</button></div><p>{analysis.completed} completed / {analysis.assigned} assigned · {analysis.responseRate === null ? 'No response rate yet' : `${Math.round(analysis.responseRate * 100)}% response rate`}</p>
            <MelMetrics metrics={(publishedPreview ? analysis.funderPreview : analysis).metrics} zu={zu} />
            {!publishedPreview && <><h3 style={{ marginTop: 22 }}>Compare with an earlier assessment</h3><select aria-label="Earlier assessment" defaultValue="" onChange={async e => { if (e.target.value) try { setAnalysis(await request(`?mode=analysis&id=${selected.id}&compare=${e.target.value}`)); } catch (err) { setError((err as Error).message); } }}><option value="">Choose a matching baseline</option>{list.filter(a => a.id !== selected.id && a.project === selected.project && ((a.stage === 'baseline' && ['midpoint', 'closeout'].includes(selected.stage)) || (a.stage === 'course_before' && selected.stage === 'course_after') || (a.stage === 'app_midpoint' && selected.stage === 'app_closeout'))).map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select>{analysis.comparison?.map(q => <p key={q.id}>{q.en}<br /><strong>{q.change === null ? 'No matched answers' : `${q.change > 0 ? '+' : ''}${q.change.toFixed(2)} average change`}</strong> · {q.n} matched participants</p>)}<p className={styles.muted}>Changes describe respondents with both measurements. They do not prove that the project caused the change. Self-reported garden area is not verified production hectares.</p><h3>Private written feedback</h3>{analysis.comments.length ? analysis.comments.map((x, i) => <blockquote key={i}><strong>{x.question}</strong><p>{x.text}</p></blockquote>) : <p>No written feedback yet.</p>}</>}
            {publishedPreview && <p className={styles.notice}>Funders see these aggregate figures only after publication. Written feedback and staff ratings are excluded. Small groups and small response categories are withheld.</p>}
          </>}
          {permissions.manage && selected.state === 'closed' && <button disabled={busy || (!selected.published && !publishedPreview)} className={styles.primary} onClick={() => void perform({ action: 'publish', id: selected.id, published: !selected.published }, selected.published ? 'Summary withdrawn from funder view.' : 'Summary published for linked funders.')}>{selected.published ? 'Withdraw funder summary' : 'Publish reviewed summary'}</button>}
          {permissions.manage && <details style={{ marginTop: 24 }}><summary>Learning action · what will we change?</summary><label>Action<textarea value={action} maxLength={2000} onChange={e => setAction(e.target.value)} /></label><label>Responsible person<input value={owner} maxLength={160} onChange={e => setOwner(e.target.value)} /></label><label>Due<input type="date" value={actionDue} onChange={e => setActionDue(e.target.value)} /></label><label className={styles.option}><input type="checkbox" checked={done} onChange={e => setDone(e.target.checked)} />Completed</label><button disabled={busy} onClick={() => void perform({ action: 'learning', id: selected.id, text: action, owner, due: actionDue, done }, 'Learning action saved.')}>Save learning action</button></details>}
        </> : <>
          <p className={styles.notice}>{zu ? 'Ukuphendula kungukuzithandela. Ungeqa noma yimuphi umbuzo. Izimpendulo zixhunywe ku-akhawunti yakho ukuze kuqhathaniswe intuthuko. Ithimba eligunyaziwe le-NGO lingazifunda; abaxhasi babona izifinyezo ezigunyaziwe kuphela. Ungafaki izinombolo zikamazisi noma amagama abanye abantu.' : 'Answering is voluntary. You may skip any question. Responses are linked to your account to compare progress. Authorised NGO analysts can read them; funders see approved summaries only. Do not include ID numbers or other people’s names.'}</p>
          {MEL_TEMPLATES[selected.stage].questions.map(q => <label key={q.id}>{zu ? q.zu : q.en}{q.kind === 'choice' ? <select disabled={selected.state !== 'open'} value={answers[q.id] ?? ''} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}><option value="">{zu ? 'Yeqa / khetha impendulo' : 'Skip / choose an answer'}</option>{q.options?.map(o => <option key={o.value} value={o.value}>{zu ? o.zu : o.en}</option>)}</select> : q.kind === 'number' ? <input disabled={selected.state !== 'open'} type="number" min="0" max={q.max} step="any" value={answers[q.id] ?? ''} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })} /> : <textarea disabled={selected.state !== 'open'} value={answers[q.id] ?? ''} maxLength={1200} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })} />}</label>)}
          {selected.response && <button disabled={busy} onClick={() => void perform({ action: 'withdraw', id: selected.id }, zu ? 'Izimpendulo zisusiwe.' : 'Your response has been withdrawn.')}>{zu ? 'Susa izimpendulo zami' : 'Withdraw my response'}</button>}
          {selected.state === 'open' && <><label className={styles.option}><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />{zu ? 'Ngifundile noma ngichazelwe lokhu futhi ngiyavuma ukuphendula.' : 'I have read or had this notice explained and agree to take part.'}</label><button className={styles.primary} disabled={busy || !consent} onClick={() => void perform({ action: 'respond', id: selected.id, answers, consent, language: zu ? 'zu' : 'en' }, zu ? 'Izimpendulo zigciniwe.' : 'Your response is saved.')}>{zu ? 'Gcina izimpendulo' : 'Save response'}</button></>}
        </>}
      </div>}
      </>}
    </>}
  </div></section>;
}

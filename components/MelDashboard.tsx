'use client';
import { numberLabel } from '@/lib/format-figures';
import MelCoverage from './MelCoverage';
import MelOverview from './MelOverview';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { isSampleMode } from '@/lib/sample-mode';
import { fieldApi } from '@/lib/field-api';
import { DEVICE_SAVE_NOTICE } from '@/lib/field-request-model';
import { useFieldSync } from '@/lib/use-field-sync';
import { MEL_TEMPLATES, MEL_TIMING_ZU } from '@/lib/mel-templates';
import { MEL_STAGES, analyseAssessment, type MelAssessment, type MelMetric, type MelPermission, type MelResponse, type MelStage } from '@/lib/mel';
import type { UserRole } from '@/lib/db/types';
import styles from './MelDashboard.module.css';
import FieldDataStatus from './FieldDataStatus';
import SampleProgramme from './SampleProgramme';
import { useLanguage } from '@/lib/i18n';
import SurveyZuluDraftPair from './SurveyZuluDraftPair';

export async function melRequest(query = '', body?: unknown) {
  return fieldApi(`/api/assessments${query}`,body);
}
type Listed = MelAssessment & { assigned: number; completed: number; response?: MelResponse | null };
type Person = { id: string; name: string; role: UserRole; permissions: MelPermission | null };
type Analysis = ReturnType<typeof analyseAssessment> & { comments: { question: string; text: string }[]; comparison: { id: string; en: string; n: number; change: number | null }[] | null; funderPreview: ReturnType<typeof analyseAssessment> };

export function MelMetrics({ metrics, zu = false }: { metrics: MelMetric[]; zu?: boolean }) {
  return <div>{metrics.map(m => <div className={styles.metric} key={m.id}>
    <strong>{zu ? <SurveyZuluDraftPair english={m.en}>{m.zu}</SurveyZuluDraftPair> : m.en}</strong>
    {m.suppressed ? <p className={styles.muted}>{zu ? <SurveyZuluDraftPair english="Withheld to protect a small group.">Kugodliwe ukuvikela iqembu elincane.</SurveyZuluDraftPair> : 'Withheld to protect a small group.'}</p> : <>
      <p className={styles.muted}>{m.n} {zu ? <SurveyZuluDraftPair english="answered">baphendulile</SurveyZuluDraftPair> : 'answered'} · {m.missing} {zu ? <SurveyZuluDraftPair english="skipped">beqile</SurveyZuluDraftPair> : 'skipped'}</p>
      {m.mean !== undefined && <p>{zu ? <SurveyZuluDraftPair english="Average">Isilinganiso</SurveyZuluDraftPair> : 'Average'}: <strong>{numberLabel(m.mean, 2)}</strong></p>}
      {m.choices?.map(o => <div key={o.value}><div className={styles.row}><span>{zu ? <SurveyZuluDraftPair english={o.en}>{o.zu}</SurveyZuluDraftPair> : o.en}</span><strong>{o.count}</strong></div><div className={styles.bar}><span style={{ width: `${m.n ? 100 * o.count / m.n : 0}%` }} /></div></div>)}
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
  const { lang: appLang } = useLanguage();
  const [sample, setSample] = useState(false);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [org, setOrg] = useState('');
  const request = useCallback((query = '', body?: unknown) => melRequest(org ? `${query}${query.includes('?') ? '&' : '?'}org=${encodeURIComponent(org)}` : query, body), [org]);
  useEffect(() => {
    let cancelled = false;
    if (role !== 'admin' || !user || isSampleMode()) return;
    void (async () => {
      try { const d = await fieldApi('/api/network/orgs'); if (!cancelled) { setOrgs(d.orgs); const linkedOrg=new URLSearchParams(window.location.search).get('org'); setOrg(d.orgs.find((o:{id:string})=>o.id===linkedOrg)?.id??d.orgs[0]?.id??''); } }
      catch (e) { if (!cancelled) setError((e as Error).message); }
    })();
    return () => { cancelled = true; };
  }, [role, user]);
  const [source,setSource]=useState<unknown>(null);
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
  useEffect(() => { if (!accessOnly) setZu(appLang === 'zu'); }, [accessOnly, appLang]);
  const isZulu = accessOnly ? appLang === 'zu' : zu;
  const t = (en: string, zulu: string) => isZulu ? zulu : en;
  const requestVersion = useRef(0);
  const linkedOpened=useRef('');
  const detailRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (selected) detailRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }, [selected]);
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
    try { const data = await request(); if (version !== requestVersion.current) return; setSource(data);setList(data.assessments); setPermissions(data.permissions); setReady(true); }
    catch (e) { if (version === requestVersion.current) { setError((e as Error).message); setReady(true); } }
  }, [user, role, org, request]);
  useEffect(() => { setList([]); setSelected(null); setAnalysis(null); setPermissions({}); setError(''); setPeople([]); setAccessView(false); setReady(false); void reload(); return () => { requestVersion.current++; }; }, [reload]);
  async function perform(body: unknown, message: string) {
    setBusy(true); setError(''); setNotice('');
    try { const result=await request('', body); await reload(); if (accessOnly) { const d = await request('?mode=people'); setPeople(d.people); setFunderAccess(d.funderAccess); } setNotice(result.queued?DEVICE_SAVE_NOTICE:message); setSelected(null); setAnalysis(null); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  useFieldSync(()=>void reload(),!busy&&!selected);
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
    if (!ready || sample || accessOnly || !list.length) return;
    const id=new URLSearchParams(window.location.search).get('assessment');
    const key=`${org}:${id}`;
    if(!id||linkedOpened.current===key)return;
    linkedOpened.current=key;
    const found=list.find(a=>a.id===id);
    if(found)void open(found);
    else setNotice('The linked assessment is not available in this account. Choose an assessment below.');
  }, [ready,sample,accessOnly,list,org]); // eslint-disable-line react-hooks/exhaustive-deps
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
  if (compact) return <div className={styles.compact}><strong>{t('Assessments & learning','Ukuhlola nokufunda')}</strong>{sample ? <span>{t('Explore the assessment templates in the organisation Assessments tab.','Buka izifanekiso zokuhlola kuthebhu ethi Ukuhlola yenhlangano.')}</span> : error ? <span>{error}</span> : !ready ? <span>{t('Loading…','Kusalayishwa…')}</span> : <><span>{assignedCount} {t('assignments','izabelo')}</span><span>{completed} {t('completed','kuqediwe')}</span><span>{overdue} {t('overdue','okudlulelwe isikhathi')}</span><a href="/assessments">{t('Open assessments →','Vula ukuhlola →')}</a></>}</div>;
  if (authLoading) return <p className={styles.root}>{t('Loading your account…','Kulayishwa i-akhawunti yakho…')}</p>;
  if (!user && !sample) return <div className={styles.root}><h1>{t('Project assessments','Ukuhlola kwephrojekthi')}</h1><p><a href="/login">{t('Sign in','Ngena ngemvume')}</a> {t('to see assessments assigned by your organisation.','ukuze ubone ukuhlola okwabelwe yinhlangano yakho.')}</p></div>;

  return <section className={styles.root}><div className={styles.wrap}>
    {!accessOnly && <div className={styles.hero}><span>IMBEWUFIELD · PROJECT LEARNING</span><h1>{accessOnly ? 'People & access' : zu ? 'Ukuhlola nokufunda' : 'Assessments & learning'}</h1><p>{t('Listen to farmers. Follow progress. Record what we change.', 'Lalela abalimi. Landela intuthuko. Bhala esikushintshayo.')}</p><div className={styles.row}><button onClick={() => setZu(false)} aria-pressed={!zu}>English</button><button onClick={() => setZu(true)} aria-pressed={zu}>isiZulu</button><a href="/ngo" style={{ color: 'white' }}>{t('Organisation dashboard', 'Ideshibhodi ye-NGO')}</a></div></div>}
    {role === 'admin' && !sample && <label>{t('Organisation','Inhlangano')}<select value={org} onChange={e => { setOrg(e.target.value); setSelected(null); setAnalysis(null); }}>{orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
    <FieldDataStatus data={source} />{isZulu && <p role="status" className={styles.notice}>Umbhalo wesiZulu ekuhloleni awukabuyekezwa isikhulumi sesiZulu esinekhono. Ungakuthathi njengokuhunyushwe nokugunyazwa ngokugcwele.</p>}{error && <p role="alert" className={styles.error}>{isZulu && <>{'Kube nenkinga. Imininingwane yephutha iboniswa ngesiNgisi: '}</>}{error}</p>}{notice && <p role="status" className={styles.notice}>{notice}</p>}
    {accessOnly && <div className={styles.card} style={{ marginBottom: 16 }}><h2>{t('People & access','Abantu nokufinyelela')}</h2><p>{t('Set member roles, delegate assessments and control funder sharing for this organisation.','Hlela izindima zamalungu, yabela abantu ukuhlola, futhi ulawule ukwabelana nabaxhasi kule nhlangano.')}</p><p>{t('These controls cover the permissions listed below. They do not yet provide a separate on/off switch for every app feature. Platform administrator and funder accounts remain platform-managed.','Lezi zilawuli zisebenza ezimvumeni ezibalwe ngezansi. Azikakwazi ukuvula noma ukuvala isici ngasinye sohlelo ngokwehlukana. Ama-akhawunti abaphathi bohlelo nabaxhasi aqhubeka elawulwa umphathi wohlelo.')}</p></div>}
    {sample ? <SampleProgramme accessOnly={accessOnly} language={isZulu} /> : <>

      {!ready && <p role="status">{t('Loading assessments…','Kulayishwa ukuhlola…')}</p>}
      {staff && !accessOnly && <>
      {ready && <MelOverview items={list} zu={isZulu} selectedId={selected?.id} busy={busy} onOpen={id => { const a = list.find(a => a.id === id); if (a) void open(a); }} />}
        <details className={styles.about}><summary>{t(`About these counts · ${overdue} overdue responses`,`Mayelana nalezi zibalo · izimpendulo ezingu-${overdue} ezidlulelwe isikhathi`)}</summary><p>{t('Counts are assessment assignments, not unique people. Assigned means available in the app; it does not mean a WhatsApp, email or SMS was sent. Awaiting review means closed but not shared; it is not a separate recorded approval status.','Lezi zibalo zibalela izabelo zokuhlola, hhayi abantu abahlukene. Okunikiwe kusho ukuthi ukuhlola kuyatholakala ohlelweni; akusho ukuthi kuthunyelwe umyalezo we-WhatsApp, i-imeyili noma i-SMS. Okulindele ukubuyekezwa kusho ukuthi kuvaliwe kodwa akukabiwa; akusona isimo esihlukile sokugunyazwa esirekhodiwe.')}</p></details>
      </>}
      {permissions.people && !accessOnly && <button onClick={async () => { try { const d = await request('?mode=people'); setPeople(d.people); setFunderAccess(d.funderAccess); setAccessView(!accessView); } catch (e) { setError((e as Error).message); } }}>{t('People & funder access','Abantu nokufinyelela kwabaxhasi')}</button>}
      {accessView && <div className={styles.card} style={{ marginTop: 16 }}><h2>{t('Organisation access','Ukufinyelela kwenhlangano')}</h2><p>{t('Assign app roles within your organisation. Platform administrators, funder identities and organisation transfers are managed by the platform administrator. Role changes apply to the next server request; the member may need to refresh their screen.','Yabela amalungu izindima zohlelo ngaphakathi kwenhlangano yakho. Umphathi wohlelo ulawula abaphathi bohlelo, ama-akhawunti abaxhasi nokudluliselwa kwezinhlangano. Izinguquko zezindima zisebenza esicelweni esilandelayo kuseva; ilungu lingase lidinge ukuvuselela isikrini.')}</p>
        <label className={styles.option}><input type="checkbox" checked={funderAccess} onChange={e => setFunderAccess(e.target.checked)} />{t('Allow linked funders to view our dashboards','Vumela abaxhasi abaxhunyiwe babuke amadeshibhodi ethu')}</label><button disabled={busy} onClick={() => void perform({ action: 'sharing', funderAccess }, t('Funder access updated.','Ukufinyelela kwabaxhasi kubuyekeziwe.'))}>{t('Save funder access','Londoloza ukufinyelela kwabaxhasi')}</button>
        <p className={styles.muted}>{t('Farmer consent still applies. Assessment summaries remain private until published individually. Previously exported files cannot be recalled.','Imvume yomlimi isasebenza. Izifinyezo zokuhlola zihlala ziyimfihlo kuze kushicilelwe ngasinye. Amafayela asevele ekhishiwe awakwazi ukubuyiswa.')}</p>
        {people.filter(p => ['farmer', 'student', 'mentor', 'ngo'].includes(p.role)).map(p => <div className={styles.metric} key={p.id}><strong>{p.name}{p.id === user?.uid ? t(' (you)',' (wena)') : ''}</strong><div className={styles.row}>
          <label>{t('App role','Indima ohlelweni')}<select disabled={p.id === user?.uid} value={p.role} onChange={e => setPeople(people.map(x => x.id === p.id ? { ...x, role: e.target.value as UserRole } : x))}>{(['farmer', 'student', 'mentor', 'ngo'] as const).map(r => <option key={r} value={r}>{({farmer:t('Farmer','Umlimi'),student:t('Student','Umfundi'),mentor:t('Mentor','Umeluleki'),ngo:t('Organisation','Inhlangano')})[r]}</option>)}</select></label>
          {(['manage', 'analyse', 'training', 'people'] as const).map(key => <label key={key} className={styles.option}><input type="checkbox" disabled={p.id === user?.uid || !['ngo', 'mentor'].includes(p.role) || (key === 'people' && p.role !== 'ngo')} checked={p.permissions?.[key] ?? p.role === 'ngo'} onChange={e => setPeople(people.map(x => x.id === p.id ? { ...x, permissions: { ...x.permissions, [key]: e.target.checked } } : x))} />{({ manage: t('Manage assessments','Phatha ukuhlolwa'), analyse: t('Read private analysis','Funda ukuhlaziywa okuyimfihlo'), training: t('Record training & attendance','Rekhoda ukuqeqeshwa nokuba khona'), people: t('Manage people','Phatha abantu') })[key]}</label>)}
          <button disabled={busy || p.id === user?.uid} onClick={() => void perform({ action: 'person', id: p.id, role: p.role, permissions: { training: p.permissions?.training ?? p.role === 'ngo', manage: p.permissions?.manage ?? p.role === 'ngo', analyse: p.permissions?.analyse ?? p.role === 'ngo', people: p.permissions?.people ?? p.role === 'ngo' } }, t(`Access updated for ${p.name}.`,`Ukufinyelela kuka-${p.name} kubuyekeziwe.`))}>{t('Save access','Londoloza izimvume')}</button>
        </div></div>)}
      </div>}
      {accessOnly && ready && !permissions.people && <p className={styles.notice}>{t('Your account cannot manage people here. Ask an organisation administrator to grant Manage people access.','I-akhawunti yakho ayikwazi ukuphatha abantu lapha. Cela umphathi wenhlangano akunike imvume yokuphatha abantu.')}</p>}
      {!accessOnly && <>
      {permissions.manage && !selected && <details className={styles.card} style={{ marginTop: 16 }}><summary>{t('Create an assessment','Dala ukuhlola')}</summary><label>{t('Stage','Isigaba')}<select value={stage} onChange={e => setStage(e.target.value as MelStage)}>{MEL_STAGES.map(s => <option key={s} value={s}>{zu ? MEL_TEMPLATES[s].zu : MEL_TEMPLATES[s].en}</option>)}</select></label><p>{zu ? <SurveyZuluDraftPair english={MEL_TEMPLATES[stage].timing}>{MEL_TIMING_ZU[stage]}</SurveyZuluDraftPair> : MEL_TEMPLATES[stage].timing}</p><label>{t('Project / course cohort','Iqoqo lephrojekthi / lesifundo')}<input value={project} maxLength={160} onChange={e => setProject(e.target.value)} placeholder={t('Use the same name throughout this assessment cycle','Sebenzisa igama elifanayo kulo lonke lolu hlelo lokuhlola')} /></label><label>{t('Assessment title','Isihloko sokuhlola')}<input value={title} maxLength={160} onChange={e => setTitle(e.target.value)} /></label><label>{t('Due date','Umnqamulajuqu')}<input type="date" value={due} onChange={e => setDue(e.target.value)} /></label><details><summary>{t('Review the questions · English and isiZulu','Bheka imibuzo · ngesiNgisi nangesiZulu')}</summary>{MEL_TEMPLATES[stage].questions.map(q => <p key={q.id}>{zu ? <SurveyZuluDraftPair english={q.en}>{q.zu}</SurveyZuluDraftPair> : <strong>{q.en}</strong>}{q.options?.map(o => <span key={o.value} style={{ display: 'block' }}>{zu ? <SurveyZuluDraftPair english={o.en}>{o.zu}</SurveyZuluDraftPair> : o.en}</span>)}</p>)}</details><button className={styles.primary} disabled={busy || !project.trim() || !title.trim() || !due} onClick={() => void perform({ action: 'create', project, title, stage, due }, t('Draft created. Choose its participants before opening it.','Uhlaka lwenziwe. Khetha abahlanganyeli ngaphambi kokuluvula.'))}>{t('Save draft','Londoloza uhlaka')}</button></details>}
      {!selected && !staff && <div className={styles.grid}>{list.map(a => <article className={styles.card} key={a.id}><span className={styles.tag}>{t(a.state, a.state === 'draft' ? 'uhlaka' : a.state === 'open' ? 'kuvuliwe' : 'kuvaliwe')}{a.published ? ` · ${t('published','kushicilelwe')}` : ''}</span><h2 style={{ marginTop: 12 }}>{a.title}</h2><p>{a.project} · {zu ? MEL_TEMPLATES[a.stage]?.zu : MEL_TEMPLATES[a.stage]?.en}</p><p className={styles.muted}>{t('Due','Umnqamulajuqu')} {a.due}{a.response ? ` · ${t('completed','kuqediwe')}` : ''}</p><button disabled={busy} onClick={() => void open(a)}>{a.response ? t('View my response', 'Buka izimpendulo zami') : t('Answer assessment', 'Phendula ukuhlola')}</button></article>)}</div>}
      {ready && !list.length && !sample && <p className={styles.card}>{t('No assessments yet.', 'Akukho ukuhlola okwamanje.')} {permissions.manage ? t('Create a draft using the questions above.', 'Dala uhlaka usebenzisa imibuzo engenhla.') : t('Your organisation will assign assessments here.', 'I-NGO yakho izokwabela ukuhlola lapha.')}</p>}
      {selected && <div ref={detailRef} className={styles.card} style={{ marginTop: 20 }}><button disabled={busy} onClick={() => { setSelected(null); setAnalysis(null); }}>{t('← All assessments', '← Konke ukuhlola')}</button><h2 style={{ marginTop: 20 }}>{selected.title}</h2><p>{selected.project} · {selected.due}</p>
        {staff ? <>
          {selected.state === 'draft' && permissions.manage && <><h3>{t('Choose participants','Khetha abahlanganyeli')}</h3><p>{t('Only selected farmers and students can answer. No external messages will be sent.','Abalimi nabafundi abakhethiwe kuphela abangaphendula. Akukho miyalezo ezothunyelwa ngaphandle kohlelo.')}</p><div className={styles.scroll}>{participants.map(p => <label key={p.id} className={styles.option}><input type="checkbox" checked={assigned.includes(p.id)} onChange={e => setAssigned(e.target.checked ? [...assigned, p.id] : assigned.filter(id => id !== p.id))} />{p.name}</label>)}</div><button disabled={busy || !assigned.length} className={styles.primary} onClick={() => void perform({ action: 'open', id: selected.id, participantIds: assigned }, t('Assessment opened for the selected participants.','Ukuhlola kuvulelwe abahlanganyeli abakhethiwe.'))}>{t(`Open for ${assigned.length} participants`,`Vulela abahlanganyeli abangu-${assigned.length}`)}</button></>}
          {selected.state === 'open' && permissions.manage && <button disabled={busy} onClick={() => void perform({ action: 'close', id: selected.id }, t('Assessment closed. Responses are now read-only.','Ukuhlola kuvaliwe. Izimpendulo manje zingafundwa kuphela.'))}>{t('Close assessment','Vala ukuhlola')}</button>}
          {analysis && <><div className={styles.row} style={{ marginTop: 20 }}><button aria-pressed={!publishedPreview} onClick={() => setPublishedPreview(false)}>{t('Private NGO analysis','Ukuhlaziywa okuyimfihlo kwe-NGO')}</button><button aria-pressed={publishedPreview} onClick={() => setPublishedPreview(true)}>{t('Preview funder summary','Buka isifinyezo sabaxhasi')}</button></div><p>{analysis.completed} {t('completed','kuqediwe')} / {analysis.assigned} {t('assigned','kunikiwe')} · {analysis.responseRate === null ? t('No response rate yet','Alikabi khona izinga lezimpendulo') : `${Math.round(analysis.responseRate * 100)}% ${t('response rate','izinga lezimpendulo')}`}</p>
            <MelMetrics metrics={(publishedPreview ? analysis.funderPreview : analysis).metrics} zu={zu} />
            {isZulu && !publishedPreview && <p className={styles.notice}>Imibuzo yokuqhathanisa nezincazelo zokuhlaziywa ezingezansi zisaboniswa ngesiNgisi. Izimpendulo ezibhaliwe ziboniswa njengoba abahlanganyeli bezifakile.</p>}
            {!publishedPreview && <><h3 style={{ marginTop: 22 }}>{t('Compare with an earlier assessment','Qhathanisa nokuhlola kwangaphambilini')}</h3><select aria-label={t('Earlier assessment','Ukuhlola kwangaphambilini')} defaultValue="" onChange={async e => { if (e.target.value) try { setAnalysis(await request(`?mode=analysis&id=${selected.id}&compare=${e.target.value}`)); } catch (err) { setError((err as Error).message); } }}><option value="">{t('Choose a matching baseline','Khetha isilinganiso sokuqala esihambisanayo')}</option>{list.filter(a => a.id !== selected.id && a.project === selected.project && ((a.stage === 'baseline' && ['midpoint', 'closeout'].includes(selected.stage)) || (a.stage === 'course_before' && selected.stage === 'course_after') || (a.stage === 'app_midpoint' && selected.stage === 'app_closeout'))).map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select>{analysis.comparison?.map(q => { const sourceQuestion = MEL_TEMPLATES[selected.stage].questions.find(item => item.id === q.id); return <p key={q.id}>{zu && sourceQuestion ? <SurveyZuluDraftPair english={q.en}>{sourceQuestion.zu}</SurveyZuluDraftPair> : q.en}<br /><strong>{q.change === null ? t('No matched answers','Azikho izimpendulo ezihambisanayo') : `${q.change > 0 ? '+' : ''}${q.change.toFixed(2)} ${t('average change','ushintsho olumaphakathi')}`}</strong> · {q.n} {t('matched participants','abahlanganyeli abahambisanayo')}</p>; })}<p className={styles.muted}>{t('Changes describe respondents with both measurements. They do not prove that the project caused the change. Self-reported garden area is not verified production hectares.','Izinguquko zichaza abaphendulile abanezilinganiso zombili. Azifakazeli ukuthi iphrojekthi iyona ebangele ushintsho. Indawo yengadi ebikwe ngumhlanganyeli ayiqinisekisiwe njengendawo ekhiqizayo ngamahektha.')}</p><h3>{t('Private written feedback','Impendulo ebhaliwe eyimfihlo')}</h3>{analysis.comments.length ? analysis.comments.map((x, i) => <blockquote key={i}><strong>{x.question}</strong><p>{x.text}</p></blockquote>) : <p>{t('No written feedback yet.','Akukabi khona impendulo ebhaliwe.')}</p>}</>}
            {publishedPreview && <p className={styles.notice}>{t('Funders see these aggregate figures only after publication. Written feedback and staff ratings are excluded. Small groups and small response categories are withheld.','Abaxhasi babona lezi zibalo ezihlanganisiwe kuphela ngemva kokushicilelwa. Impendulo ebhaliwe nezilinganiso zabasebenzi akufakwa. Amaqembu amancane nezimpendulo zezigaba ezinenani elincane kuyafihlwa.')}</p>}
          </>}
          {permissions.manage && selected.state === 'closed' && <button disabled={busy || (!selected.published && !publishedPreview)} className={styles.primary} onClick={() => void perform({ action: 'publish', id: selected.id, published: !selected.published }, selected.published ? t('Summary withdrawn from funder view.','Isifinyezo sisusiwe ekubukweni kwabaxhasi.') : t('Summary published for linked funders.','Isifinyezo sishicilelwe ukuze sibonwe abaxhasi abaxhunyiwe.'))}>{selected.published ? t('Withdraw funder summary','Susa isifinyezo sabaxhasi') : t('Publish reviewed summary','Shicilela isifinyezo esibuyekeziwe')}</button>}
          {permissions.manage && <details style={{ marginTop: 24 }}><summary>{t('Learning action · what will we change?','Isenzo sokufunda · yini esizoyishintsha?')}</summary><label>{t('Action','Isenzo')}<textarea value={action} maxLength={2000} onChange={e => setAction(e.target.value)} /></label><label>{t('Responsible person','Umuntu onesibopho')}<input value={owner} maxLength={160} onChange={e => setOwner(e.target.value)} /></label><label>{t('Due','Umnqamulajuqu')}<input type="date" value={actionDue} onChange={e => setActionDue(e.target.value)} /></label><label className={styles.option}><input type="checkbox" checked={done} onChange={e => setDone(e.target.checked)} />{t('Completed','Kuqediwe')}</label><button disabled={busy} onClick={() => void perform({ action: 'learning', id: selected.id, text: action, owner, due: actionDue, done }, t('Learning action saved.','Isenzo sokufunda silondoloziwe.'))}>{t('Save learning action','Londoloza isenzo sokufunda')}</button></details>}
        </> : <>
          <p className={styles.notice}>{zu ? <SurveyZuluDraftPair english="Answering is voluntary. You may skip any question. Responses are linked to your account to compare progress. Authorised NGO analysts can read them; funders see approved summaries only. Do not include ID numbers or other people’s names.">Ukuphendula kungukuzithandela. Ungeqa noma yimuphi umbuzo. Izimpendulo zixhunywe ku-akhawunti yakho ukuze kuqhathaniswe intuthuko. Ithimba eligunyaziwe le-NGO lingazifunda; abaxhasi babona izifinyezo ezigunyaziwe kuphela. Ungafaki izinombolo zikamazisi noma amagama abanye abantu.</SurveyZuluDraftPair> : 'Answering is voluntary. You may skip any question. Responses are linked to your account to compare progress. Authorised NGO analysts can read them; funders see approved summaries only. Do not include ID numbers or other people’s names.'}</p>
          {zu && <p className={styles.muted} lang="zu"><SurveyZuluDraftPair english="Some isiZulu translations in this assessment are unreviewed drafts; English source text is shown below them.">Ezinye izinguqulo zesiZulu kulokhu kuhlola ziwuhlaka olungakabuyekezwa; umbhalo wesiNgisi oqondene nazo uboniswe ngezansi kwazo.</SurveyZuluDraftPair></p>}
          {MEL_TEMPLATES[selected.stage].questions.map(q => <label key={q.id}>{zu ? <SurveyZuluDraftPair english={q.en}>{q.zu}</SurveyZuluDraftPair> : q.en}{q.kind === 'choice' ? <select disabled={selected.state !== 'open'} value={answers[q.id] ?? ''} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}><option value="">{zu ? 'Yeqa / khetha impendulo · Skip / choose an answer' : 'Skip / choose an answer'}</option>{q.options?.map(o => <option key={o.value} value={o.value}>{zu ? `${o.zu} · ${o.en}` : o.en}</option>)}</select> : q.kind === 'number' ? <input disabled={selected.state !== 'open'} type="number" min="0" max={q.max} step="any" value={answers[q.id] ?? ''} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })} /> : <textarea disabled={selected.state !== 'open'} value={answers[q.id] ?? ''} maxLength={1200} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })} />}</label>)}
          {selected.response && <button disabled={busy} onClick={() => void perform({ action: 'withdraw', id: selected.id }, zu ? 'Izimpendulo zisusiwe.' : 'Your response has been withdrawn.')}>{zu ? <SurveyZuluDraftPair english="Withdraw my response">Susa izimpendulo zami</SurveyZuluDraftPair> : 'Withdraw my response'}</button>}
          {selected.state === 'open' && <><label className={styles.option}><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />{zu ? <SurveyZuluDraftPair english="I have read or had this notice explained and agree to take part.">Ngifundile noma ngichazelwe lokhu futhi ngiyavuma ukuphendula.</SurveyZuluDraftPair> : 'I have read or had this notice explained and agree to take part.'}</label><button className={styles.primary} disabled={busy || !consent} onClick={() => void perform({ action: 'respond', id: selected.id, expectedSubmittedAt:selected.response?.submittedAt??'', answers, consent, language: zu ? 'zu' : 'en' }, zu ? 'Izimpendulo zigciniwe.' : 'Your response is saved.')}>{zu ? <SurveyZuluDraftPair english="Save response">Gcina izimpendulo</SurveyZuluDraftPair> : 'Save response'}</button></>}
        </>}
      </div>}
      </>}
    </>}
    {!accessOnly && <MelCoverage zu={zu} />}
  </div></section>;
}

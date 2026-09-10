'use client';

import { useState } from 'react';
import { ClipboardList, CheckCircle2, Eye, Share2, Flag, BookOpen, GraduationCap, Milestone, Smartphone, ArrowRight, Clock3 } from 'lucide-react';
import { MEL_STAGES, type MelAssessment, type MelStage } from '@/lib/mel';
import { MEL_TEMPLATES } from '@/lib/mel-templates';
import styles from './MelDashboard.module.css';

export type OverviewAssessment = Pick<MelAssessment, 'id' | 'title' | 'project' | 'stage' | 'state' | 'published' | 'due' | 'action' | 'actionOwner' | 'actionDue' | 'actionDone'> & { assigned: number; completed: number };
const icons = { baseline: Flag, course_before: BookOpen, course_after: GraduationCap, midpoint: Milestone, closeout: CheckCircle2, app_midpoint: Smartphone, app_closeout: Smartphone };
const shortNames = { baseline: 'Baseline', course_before: 'Before training', course_after: 'After training', midpoint: 'Midpoint', closeout: 'Closeout', app_midpoint: 'App midpoint', app_closeout: 'App closeout' };

/** Only counts already authorised for this viewer enter this presentation component. */
export default function MelOverview({ items, onOpen, selectedId, busy = false, zu = false }: { items: OverviewAssessment[]; onOpen: (id: string) => void; selectedId?: string; busy?: boolean; zu?: boolean }) {
  const [filter, setFilter] = useState<'all' | 'completed' | 'review' | 'shared'>('all');
  const [stage, setStage] = useState<MelStage | null>(null);
  const assigned = items.reduce((sum, a) => sum + a.assigned, 0);
  const completed = items.reduce((sum, a) => sum + a.completed, 0);
  const review = items.filter(a => a.state === 'closed' && !a.published);
  const shared = items.filter(a => a.published);
  const actions = items.filter(a => a.action && !a.actionDone);
  const visible = items.filter(a => (!stage || a.stage === stage) && (filter === 'all' || (filter === 'completed' && a.completed > 0) || (filter === 'review' && a.state === 'closed' && !a.published) || (filter === 'shared' && a.published)));
  const stats = [
    { key: 'all' as const, label: zu ? 'Kwabelwe' : 'Assigned', count: assigned, unit: zu ? 'izabelo' : 'assignments', Icon: ClipboardList },
    { key: 'completed' as const, label: zu ? 'Kuqediwe' : 'Completed', count: completed, unit: zu ? 'izimpendulo' : 'responses', Icon: CheckCircle2 },
    { key: 'review' as const, label: zu ? 'Kuzobuyekezwa' : 'Awaiting review', count: review.length, unit: zu ? 'kuvaliwe, akukabiwa' : 'closed, not shared', Icon: Eye },
    { key: 'shared' as const, label: zu ? 'Kwabiwe' : 'Shared', count: shared.length, unit: zu ? 'izifinyezo' : 'summaries', Icon: Share2 },
  ];
  return <div className={styles.overview}>
    <div className={styles.overviewStats}>{stats.map(({ key, label, count, unit, Icon }) => <button key={key} className={styles.summaryCard} aria-pressed={filter === key} onClick={() => { setFilter(key); setStage(null); }}><span className={styles.statIcon}><Icon size={22} aria-hidden="true" /></span><span>{label}<strong className={styles.stat}>{count}</strong><small>{unit}</small></span><ArrowRight size={17} aria-hidden="true" /></button>)}</div>
    <div className={styles.overviewPanels}>
      <section className={styles.card}><div className={styles.row}><CheckCircle2 size={22} aria-hidden="true" /><h2>{zu ? 'Izimpendulo eziqediwe' : 'Response coverage'}</h2></div><div className={styles.coverageValue}><strong>{assigned ? `${Math.round(completed / assigned * 100)}%` : '—'}</strong><span>{completed} / {assigned} {zu ? 'izabelo ziphenduliwe' : 'assignments answered'}</span></div><div className={styles.coverageTrack} aria-hidden="true"><span style={{ width: `${assigned ? Math.min(100, completed / assigned * 100) : 0}%` }} /></div><p className={styles.muted}>{zu ? 'Izabelo, hhayi abantu abahlukene. Umuntu angaphendula ukuhlola okuningi.' : 'Assignments, not unique people. One person may answer several assessments.'}</p></section>
      <section className={`${styles.card} ${styles.attention}`}><div className={styles.row}><Clock3 size={22} aria-hidden="true" /><h2>{zu ? 'Okudinga ukunakwa' : 'Needs attention'}</h2></div><button onClick={() => { setFilter('review'); setStage(null); }}><strong>{review.length}</strong><span>{zu ? 'Izifinyezo ezivaliwe ezingakabiwa' : 'Closed assessments not yet shared'}</span><ArrowRight size={18} /></button>{actions.length ? actions.slice(0, 2).map(a => <button key={a.id} disabled={busy} onClick={() => onOpen(a.id)}><Flag size={18} /><span><strong>{a.action}</strong><small>{a.actionOwner || (zu ? 'Akukabelwa muntu' : 'Owner not assigned')}{a.actionDue ? ` · ${a.actionDue}` : ''}</small></span><ArrowRight size={18} /></button>) : <p className={styles.muted}>{zu ? 'Azikho izinyathelo zokufunda ezivulekile ezirekhodiwe.' : 'No open learning actions recorded. Add the next action inside an assessment.'}</p>}</section>
    </div>
    <section className={styles.cyclePanel} aria-label={zu ? 'Umjikelezo wokuhlola' : 'Assessment cycle'}><div className={styles.row}><h2>{zu ? 'Umjikelezo wokuhlola' : 'Follow the assessment cycle'}</h2>{stage && <button onClick={() => setStage(null)}>{zu ? 'Bonisa konke' : 'Show all stages'}</button>}</div>
      {[false, true].map(app => <div key={String(app)}><h3 className={styles.cycleLabel}>{app ? (zu ? 'Impendulo ngohlelo lokusebenza · ngokuzithandela' : 'App feedback · optional') : (zu ? 'Iphrojekthi nokuqeqeshwa' : 'Project & training')}</h3><div className={app ? styles.appStages : styles.cycleStages}>{MEL_STAGES.filter(s => s.startsWith('app_') === app).map(s => { const rows = items.filter(a => a.stage === s); const n = rows.reduce((v, a) => v + a.assigned, 0); const c = rows.reduce((v, a) => v + a.completed, 0); const Icon = icons[s]; return <button key={s} aria-pressed={stage === s} onClick={() => { setStage(stage === s ? null : s); setFilter('all'); }}><Icon size={23} aria-hidden="true" /><strong>{zu ? MEL_TEMPLATES[s].zu : shortNames[s]}</strong><span>{n ? `${c} / ${n}` : rows.length ? (zu ? 'Uhlaka' : 'Not assigned') : (zu ? 'Akukaqalwa' : 'Not started')}</span><div className={styles.bar} aria-hidden="true"><span style={{ width: `${n ? Math.min(100, c / n * 100) : 0}%` }} /></div></button>; })}</div></div>)}
    </section>
    <div className={styles.row}><h2>{zu ? 'Ukuhlola' : 'Assessments'} <span className={styles.muted}>({visible.length})</span></h2>{(filter !== 'all' || stage) && <button onClick={() => { setFilter('all'); setStage(null); }}>{zu ? 'Susa izihlungi' : 'Clear filters'}</button>}</div>
    <div className={styles.assessmentCards}>{visible.map(a => { const Icon = icons[a.stage]; return <button key={a.id} className={styles.assessmentCard} aria-pressed={selectedId === a.id} disabled={busy} onClick={() => onOpen(a.id)}><span className={styles.statIcon}><Icon size={24} aria-hidden="true" /></span><span className={styles.assessmentText}><span className={styles.tag}>{a.state}{a.published ? ' · shared' : ''}</span><strong>{zu ? MEL_TEMPLATES[a.stage].zu : a.title}</strong><span>{a.project}</span><small>{zu ? 'Kufanele' : 'Due'} {a.due} · {a.completed}/{a.assigned} {zu ? 'kuqediwe' : 'completed'}</small><div className={styles.bar} aria-hidden="true"><span style={{ width: `${a.assigned ? Math.min(100, a.completed / a.assigned * 100) : 0}%` }} /></div></span><ArrowRight size={20} aria-hidden="true" /></button>; })}</div>
    {!visible.length && <p className={styles.card}>{zu ? 'Akukho ukuhlola okufana nalokhu.' : 'No assessments match this view.'}</p>}
  </div>;
}

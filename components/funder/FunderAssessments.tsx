'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { translate, useLanguage } from '@/lib/i18n';
import { UserFacingError, userFacingMessage } from '@/lib/user-facing-error';
import { isSampleMode } from '@/lib/sample-mode';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { MelMetrics, melRequest } from '@/components/MelDashboard';
import type { MelMetric } from '@/lib/mel';
import styles from '@/components/MelDashboard.module.css';
import { formatStaffDate } from '@/lib/format-figures';
import MelCoverage from '@/components/MelCoverage';
import SampleProgramme from '@/components/SampleProgramme';
import { inlineTemplate, inlineText } from '@/lib/xh-inline';

type Summary = { id: string; title: string; project: string; due: string; completed: number; assigned: number; metrics: MelMetric[] };
export default function FunderAssessments() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const tx = (en: string) => inlineText(lang, en);
  const failure = (e: unknown) => inlineText(lang, userFacingMessage(e, translate(lang, 'networkFailed'), k => translate(lang, k)));
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [org, setOrg] = useState('');
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sample, setSample] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setSample(isSampleMode()); setSummaries([]); setOrgs([]); setOrg(''); setError('');
    if (!user || isSampleMode()) return;
    void (async () => {
      try {
        const res = await fetch('/api/network/orgs', { headers: await paidApiHeaders() });
        const body = await res.json(); if (!res.ok) throw new UserFacingError(typeof body.error === 'string' ? body.error : translate(lang, 'networkFailed'));
        if (!cancelled) { setOrgs(body.orgs); setOrg(body.orgs[0]?.id ?? ''); }
      } catch (e) { if (!cancelled) setError(failure(e)); }
    })();
    return () => { cancelled = true; };
  }, [user]);
  useEffect(() => {
    let cancelled = false; setSummaries([]); setError('');
    if (!org) return;
    setLoading(true);
    void melRequest(`?mode=published&org=${encodeURIComponent(org)}`).then(d => { if (!cancelled) setSummaries(d.assessments); }).catch(e => { if (!cancelled) setError(failure(e)); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [org]);
  return <section className={styles.root}><div className={styles.wrap}><div className={styles.hero}><h1>{tx('Assessments & learning')}</h1><p>{tx('Assessment summaries reviewed and shared by the organisation.')}</p></div>
    <MelCoverage/>
    {sample ? <SampleProgramme funder /> : <>
      <label>{tx('Organisation')}<select value={org} onChange={e => setOrg(e.target.value)}>{orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
      {error && <p role="alert" className={styles.error}>{error}</p>}{loading && <p>{tx('Loading approved summaries…')}</p>}
      {!loading && !error && !summaries.length && <p className={styles.card}>{tx('No approved assessment summaries are available here yet.')}</p>}
      {/* sdesk-14: these report cards used to stack full-width in a single column at 1280px;
          styles.grid (MelDashboard.module.css) now puts 2-3 side by side at lg+. staff-13: the
          due date was a raw 'YYYY-MM-DD' string. */}
      <div className={styles.grid}>{summaries.map(s => <details className={styles.card} key={s.id}><summary><strong>{s.title}</strong> · {s.project}</summary><p>{inlineTemplate(lang, 'Due {date} · {completed} completed / {assigned} assigned', null, { date: formatStaffDate(s.due, 'en'), completed: s.completed, assigned: s.assigned })}</p><MelMetrics metrics={s.metrics} /><p className={styles.muted}>{tx('Survey responses are self-reported. Small groups are withheld; these figures alone do not establish project impact.')}</p></details>)}</div>
    </>}
  </div></section>;
}

'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { isSampleMode } from '@/lib/sample-mode';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { MelMetrics, melRequest } from '@/components/MelDashboard';
import type { MelMetric } from '@/lib/mel';
import styles from '@/components/MelDashboard.module.css';

type Summary = { id: string; title: string; project: string; due: string; completed: number; assigned: number; metrics: MelMetric[] };
export default function FunderAssessments() {
  const { user } = useAuth();
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
        const body = await res.json(); if (!res.ok) throw new Error(body.error);
        if (!cancelled) { setOrgs(body.orgs); setOrg(body.orgs[0]?.id ?? ''); }
      } catch (e) { if (!cancelled) setError((e as Error).message); }
    })();
    return () => { cancelled = true; };
  }, [user]);
  useEffect(() => {
    let cancelled = false; setSummaries([]); setError('');
    if (!org) return;
    setLoading(true);
    void melRequest(`?mode=published&org=${encodeURIComponent(org)}`).then(d => { if (!cancelled) setSummaries(d.assessments); }).catch(e => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [org]);
  return <section className={styles.root}><div className={styles.wrap}><div className={styles.hero}><h1>Learning from the project</h1><p>Assessment summaries reviewed and shared by the NGO.</p></div>
    {sample ? <p className={styles.card}>Sample mode · no assessment results have been published. The NGO chooses which completed assessments to share. Private staff feedback and written responses stay with authorised NGO analysts.</p> : <>
      <label>Organisation<select value={org} onChange={e => setOrg(e.target.value)}>{orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
      {error && <p role="alert" className={styles.error}>{error}</p>}{loading && <p>Loading approved summaries…</p>}
      {!loading && !error && !summaries.length && <p className={styles.card}>No approved assessment summaries are available here yet.</p>}
      {summaries.map(s => <details className={styles.card} key={s.id} style={{ margin: '16px 0' }}><summary><strong>{s.title}</strong> · {s.project}</summary><p>Due {s.due} · {s.completed} completed / {s.assigned} assigned</p><MelMetrics metrics={s.metrics} /><p className={styles.muted}>Survey responses are self-reported. Small groups are withheld; these figures alone do not establish project impact.</p></details>)}
    </>}
  </div></section>;
}

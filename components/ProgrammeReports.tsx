'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNetworkPortfolio } from '@/lib/use-network-portfolio';
import { portfolioTotals } from '@/lib/network';
import ReportComposer, { type ReportSection } from './ReportComposer';
import styles from './MelDashboard.module.css';

export default function ProgrammeReports({ funder = false }: { funder?: boolean }) {
  const { user } = useAuth();
  const portfolio = useNetworkPortfolio(Boolean(user));
  const [kind, setKind] = useState<'overview' | 'production' | 'training'>('overview');
  const totals = portfolioTotals(portfolio.rows);
  const number = (n: number | null, suffix = '') => n === null ? 'Not available' : `${n.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}${suffix}`;
  const sections: ReportSection[] = [
    { title: 'Reporting coverage', lines: [`${totals.farmerCount} farmers visible in this portfolio; ${totals.reportingCount} have readable production or sales records.`, `${portfolio.withheldForConsent} enrolled farmers are withheld for consent.`, 'Figures reflect the available cumulative portfolio records, not a selected month or a verified impact evaluation. Missing values are not zero.'] },
  ];
  if (kind !== 'training') sections.push({ title: 'Production & recorded finances', lines: [`Harvest logged: ${number(totals.producedKg, ' kg')}`, `Sold: ${number(totals.soldKg, ' kg')}`, `Recorded sales: ${number(totals.incomeZar, ' ZAR')}`, `Recorded costs: ${number(totals.expensesZar, ' ZAR')}`, 'Sales and costs may have different reporting coverage. No profitability claim is inferred from missing costs.'] });
  if (kind !== 'production') sections.push({ title: 'Learning & delivery', lines: [`Average recorded training completion: ${number(totals.averageTrainingPct, '%')}`, `${totals.cohortCount} cohorts represented.`, `${totals.activeLast90Days} farmers with recorded activity in the last 90 days.`, 'Training completion measures recorded progress, not independently demonstrated competence.'] });
  sections.push({ title: 'Farmer record detail', lines: portfolio.rows.map(r => `${r.farmer.name}: ${kind === 'training' ? `training ${number(r.metrics.trainingPct, '%')}` : `harvest ${number(r.metrics.producedKg, ' kg')}; sales ${number(r.metrics.incomeZar, ' ZAR')}`}`) });
  return <section className={styles.root}><div className={styles.wrap}><div className={styles.hero}><h1>{funder ? 'Funder reports' : 'Organisation reports'}</h1><p>Choose a report, review its coverage and export a clear, economical PDF.</p></div>
    {portfolio.orgs.length > 0 && <label>Organisation<select value={portfolio.orgId ?? ''} onChange={e => portfolio.setOrgId(e.target.value)}>{portfolio.orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
    <div className={styles.grid}>{([['overview', 'Programme overview', 'Coverage, production and learning.'], ['production', 'Production & sales', 'Recorded harvests and money with coverage notes.'], ['training', 'Training & participation', 'Learning progress and recorded activity.']] as const).map(([key, label, desc]) => <button key={key} className={styles.card} aria-pressed={key === kind} onClick={() => setKind(key)}><h2>{label}</h2><p>{desc}</p></button>)}</div>
    {portfolio.error ? <p role="alert" className={styles.error}>{portfolio.error}</p> : portfolio.loading ? <p>Loading authorised report data…</p> : <ReportComposer key={`${kind}:${portfolio.orgId}:${portfolio.isDemo}`} title={{ overview: 'Programme overview', production: 'Production and sales', training: 'Training and participation' }[kind]} sample={portfolio.isDemo} sections={sections} />}
  </div></section>;
}

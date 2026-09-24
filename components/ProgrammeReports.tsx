'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useNetworkPortfolio } from '@/lib/use-network-portfolio';
import { portfolioTotals } from '@/lib/network';
import ReportComposer, { type ReportSection } from './ReportComposer';
import styles from './MelDashboard.module.css';
import { useLanguage } from '@/lib/i18n';

export default function ProgrammeReports({ funder = false }: { funder?: boolean }) {
  const { lang } = useLanguage();
  const ui = (en: string, zu: string) => lang === 'zu' ? zu : en;
  const { user } = useAuth();
  const portfolio = useNetworkPortfolio(Boolean(user));
  const [kind, setKind] = useState<'overview' | 'production' | 'training'>('overview');
  const totals = portfolioTotals(portfolio.rows);
  const number = (n: number | null, suffix = '') => n === null ? ui('Not available', 'Akutholakali') : `${n.toLocaleString(lang === 'zu' ? 'zu-ZA' : 'en-ZA', { maximumFractionDigits: 2 })}${suffix}`;
  const sections: ReportSection[] = [
    { title: 'Reporting coverage', lines: [`${totals.farmerCount} farmers visible in this portfolio; ${totals.reportingCount} have readable production or sales records.`, `${portfolio.withheldForConsent} enrolled farmers are withheld for consent.`, 'Figures reflect the available cumulative portfolio records, not a selected month or a verified impact evaluation. Missing values are not zero.'] },
  ];
  if (kind !== 'training') sections.push({ title: 'Production & recorded finances', lines: [`Harvest logged: ${number(totals.producedKg, ' kg')}`, `Sold: ${number(totals.soldKg, ' kg')}`, `Recorded sales: ${number(totals.incomeZar, ' ZAR')}`, `Recorded costs: ${number(totals.expensesZar, ' ZAR')}`, 'Sales and costs may have different reporting coverage. No profitability claim is inferred from missing costs.'] });
  if (kind !== 'production') sections.push({ title: 'Learning & delivery', lines: [`Average recorded training completion: ${number(totals.averageTrainingPct, '%')}`, `${totals.cohortCount} cohorts represented.`, `${totals.activeLast90Days} farmers with recorded activity in the last 90 days.`, 'Training completion measures recorded progress, not independently demonstrated competence.'] });
  sections.push({ title: 'Farmer record detail', lines: portfolio.rows.map(r => `${r.farmer.name}: ${kind === 'training' ? `training ${number(r.metrics.trainingPct, '%')}` : `harvest ${number(r.metrics.producedKg, ' kg')}; sales ${number(r.metrics.incomeZar, ' ZAR')}`}`) });
  const reportChoices = [
    ['overview', ui('Programme overview', 'Uhlolojikelele lohlelo'), ui('Coverage, production and learning.', 'Ukuhlanganiswa kwemininingwane, ukukhiqiza nokufunda.')],
    ['production', ui('Production & sales', 'Ukukhiqiza nokuthengisa'), ui('Recorded harvests and money with coverage notes.', 'Izivuno nemali eqoshiwe kanye namanothi okuhlanganiswa kwemininingwane.')],
    ['training', ui('Training & participation', 'Ukuqeqeshwa nokubamba iqhaza'), ui('Learning progress and recorded activity.', 'Inqubekelaphambili yokufunda nemisebenzi eqoshiwe.')],
  ] as const;
  const reportTitle = { overview: ui('Programme overview', 'Uhlolojikelele lohlelo'), production: ui('Production and sales', 'Ukukhiqiza nokuthengisa'), training: ui('Training and participation', 'Ukuqeqeshwa nokubamba iqhaza') }[kind];
  return <section className={styles.root}><div className={styles.wrap}><div className={styles.hero}><h1>{funder ? ui('Funder reports', 'Imibiko yabaxhasi') : ui('Organisation reports', 'Imibiko yenhlangano')}</h1><p>{ui('Choose a report, review its coverage and export a clear, economical PDF.', 'Khetha umbiko, ubuyekeze imininingwane yawo, bese uwukhipha njenge-PDF ecacile nefushane.')}</p></div>
    {lang === 'zu' && <p role="note">Izihloko nezilawuli zalapha zisesiZulu. Umbhalo nobufakazi obungaphakathi ku-PDF kuzohlala kunjengoba kuqoshwe, futhi kungase kube ngesiNgisi.</p>}
    {portfolio.orgs.length > 0 && <label>{ui('Organisation', 'Inhlangano')}<select value={portfolio.orgId ?? ''} onChange={e => portfolio.setOrgId(e.target.value)}>{portfolio.orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
    <div className={styles.grid}>{reportChoices.map(([key, label, desc]) => <button key={key} className={styles.card} aria-pressed={key === kind} onClick={() => setKind(key)}><h2>{label}</h2><p>{desc}</p></button>)}</div>
    {portfolio.error ? <p role="alert" className={styles.error}>{portfolio.error}</p> : portfolio.loading ? <p>{ui('Loading authorised report data…', 'Kusalayishwa idatha yemibiko egunyaziwe…')}</p> : <ReportComposer key={`${kind}:${portfolio.orgId}:${portfolio.isDemo}`} title={reportTitle} sample={portfolio.isDemo} orgId={portfolio.orgId} sections={sections}
      metrics={[{label:ui('Farmers','Abalimi'),value:String(totals.farmerCount),detail:`${totals.reportingCount} ${ui('with readable records','abanamarekhodi afundekayo')}`},
        ...(kind==='training'?[{label:ui('Training completion','Ukuqedwa kokuqeqeshwa'),value:number(totals.averageTrainingPct,'%'),detail:ui('Recorded progress','Inqubekelaphambili eqoshiwe')},{label:ui('Active growers','Abalimi abasebenzayo'),value:String(totals.activeLast90Days),detail:ui('Activity in the last 90 days','Umsebenzi wezinsuku ezingu-90 ezedlule')}]:[{label:ui('Harvest logged','Isivuno esiqoshiwe'),value:number(totals.producedKg,' kg'),detail:ui('Available cumulative records','Amarekhodi aqoqiwe atholakalayo')},{label:ui('Recorded sales','Ukuthengisa okuqoshiwe'),value:totals.incomeZar===null?ui('Not available','Akutholakali'):`R${number(totals.incomeZar)}`,detail:ui('Available cumulative records','Amarekhodi aqoqiwe atholakalayo')}]),
        {label:ui('Cohorts','Amaqembu'),value:String(totals.cohortCount),detail:ui('Represented in this portfolio','Akhona kule phothifoliyo')}]}
      chart={{title:kind==='training'?'Recorded learning progress by farmer':'Harvest logged by farmer',suffix:kind==='training'?'%':' kg',minimumScale:kind==='training'?100:undefined,rows:portfolio.rows.flatMap(r=>{const value=kind==='training'?r.metrics.trainingPct:r.metrics.producedKg;return value===null?[]:[{label:r.farmer.name,value}];})}} />}
  </div></section>;
}

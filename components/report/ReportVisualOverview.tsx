'use client';
import { reportChartSvg, REPORT_COLOURS, type ReportChart, type ReportVisuals } from '@/lib/report-visuals';
import styles from './VisualReport.module.css';

export function ReportChartCard({ chart, ink = false }: { chart: ReportChart; ink?: boolean }) {
  const art = reportChartSvg(chart, ink);
  const maximum = Math.max(...chart.rows.map(row => row.value), 1);
  return <figure className={styles.chart}>
    <figcaption><span className={styles.kicker}>{chart.unit || 'JAN – DEC'}</span><h3>{chart.title}</h3></figcaption>
    {chart.kind === 'bars' ? <div className={styles.bars}>{chart.rows.length ? chart.rows.map((row, i) => <div key={`${row.label}-${i}`}>
      <div className={styles.barLabel}><span>{row.label}</span><strong>{row.value.toLocaleString('en-ZA', { maximumFractionDigits: 1 })} {chart.unit}</strong></div>
      <div className={styles.track}><span style={{ width: `${row.value / maximum * 100}%`, background: ink ? '#333' : REPORT_COLOURS[i % REPORT_COLOURS.length] }} /></div>
      {row.detail && <small>{row.detail}</small>}
    </div>) : <p>No priced or measured values available.</p>}</div> : <div className={`${styles.chartScroll} ${chart.kind === 'calendar' ? styles.calendarScroll : ''}`} tabIndex={chart.kind === 'calendar' || chart.kind === 'months' ? 0 : undefined} aria-label={chart.title}>
      <img className={chart.kind === 'months' ? styles.months : chart.kind === 'calendar' ? styles.calendar : styles.progress} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(art.svg)}`} alt={`${chart.title}. ${chart.rows.map(r => `${r.label}: ${chart.kind === 'calendar' ? (r.months ?? []).map(m => ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m]).join(', ') : `${r.value} ${chart.unit}`}`).join('; ')}`} width={art.width} height={art.height} />
    </div>}
    <p className={styles.caption}>{chart.note}</p>
  </figure>;
}

export default function ReportVisualOverview({ visuals, image, imageCaption, ink = false, compact = false, stamp, children }: { visuals: ReportVisuals; image?: string; imageCaption?: string; ink?: boolean; compact?: boolean; stamp?: string; children?: React.ReactNode }) {
  return <div className={`${styles.visual} ${ink ? styles.ink : ''}`} data-report-visuals>
    <header className={styles.hero}>
      <div className={styles.heroCopy}><div className={styles.edition}><span>IMBEWUFIELD / SITE REPORT</span>{stamp && <time>{stamp}</time>}</div><h1>{visuals.title}</h1><p>{visuals.subtitle}</p></div>
      {!ink && image && <figure className={styles.heroFigure}><img data-photo-preview src={image} alt={imageCaption ?? visuals.title} /><figcaption>{imageCaption}</figcaption></figure>}
    </header>
    <div className={styles.metrics}>{visuals.metrics.map(metric => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.note}</small></div>)}</div>
    <p className={styles.basis}>{visuals.basis}</p>
    {!compact && <><div className={styles.sectionIntro}><span>01</span><div><h2>{visuals.overviewTitle ?? 'The site at a glance'}</h2><p>{visuals.overviewNote ?? 'Space, seasons and the resources behind the plan.'}</p></div></div><div className={styles.charts}>{visuals.charts.filter(c => c.kind !== 'calendar').map(chart => <ReportChartCard key={chart.id} chart={chart} ink={ink} />)}</div>{visuals.charts.filter(c => c.kind === 'calendar').map(chart => <ReportChartCard key={chart.id} chart={chart} ink={ink} />)}</>}
    {children}
  </div>;
}

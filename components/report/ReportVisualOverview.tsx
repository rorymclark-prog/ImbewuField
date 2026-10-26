'use client';
import { numberLabel } from '@/lib/format-figures';
import { reportChartSvg, reportChartAlt, reportVisualText, reportYearRange, REPORT_COLOURS, type ReportChart, type ReportVisuals } from '@/lib/report-visuals';
import { Maximize2 } from 'lucide-react';
import SidewaysScroller from './SidewaysScroller';
import styles from './VisualReport.module.css';

export type OpenReportImage = (label: string, image: string) => void;

export function ReportChartCard({ chart, ink = false, slideHint, onOpenImage, viewLabel, language = chart.language ?? 'en' }: { chart: ReportChart; ink?: boolean; slideHint?: string; onOpenImage?: OpenReportImage; viewLabel?: string; language?: string }) {
  const ui = (en: string, zu: string) => reportVisualText(en, language, {}, zu);
  const fullSizeLabel = viewLabel ?? reportVisualText('View full size', language);
  const hint = slideHint ?? reportVisualText('Slide to see more', language);
  const localChart = { ...chart, language };
  const art = reportChartSvg(localChart, ink);
  const maximum = Math.max(...chart.rows.map(row => row.value), 1);
  return <figure lang={language} className={`${styles.chart} ${chart.id === 'cost' ? styles.wideChart : ''}`}>
    <figcaption><div><span className={styles.kicker}>{chart.unit || reportYearRange(language)}</span><h3>{chart.title}</h3></div>{onOpenImage && <button type="button" className={`${styles.enlarge} no-print`} onClick={() => onOpenImage(chart.title, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(art.svg)}`)}><Maximize2 size={16} aria-hidden="true"/>{fullSizeLabel}</button>}</figcaption>
    {chart.kind === 'bars' ? <div className={styles.bars}>{chart.rows.length ? chart.rows.map((row, i) => <div key={`${row.label}-${i}`}>
      <div className={styles.barLabel}><span>{row.label}</span><strong>{numberLabel(row.value, 1)} {chart.unit}</strong></div>
      <div className={styles.track}><span style={{ width: `${row.value / maximum * 100}%`, background: ink ? '#333' : REPORT_COLOURS[i % REPORT_COLOURS.length] }} /></div>
      {row.detail && <small>{row.detail}</small>}
    </div>) : <p>{ui('No priced or measured values available.','Alukho ulwazi lwamanani noma lwezilinganiso olutholakalayo.')}</p>}</div> : chart.kind === 'figure' && chart.figure ? <SidewaysScroller className={styles.chartScroll} label={chart.title} hint={hint}>
      <img className={styles.figure} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(art.svg)}`} alt={chart.figure.alt} width={art.width} height={art.height} />
    </SidewaysScroller> : chart.kind === 'calendar' || chart.kind === 'months' ? <SidewaysScroller className={`${styles.chartScroll} ${chart.kind === 'calendar' ? styles.calendarScroll : ''}`} label={chart.title} hint={hint}>
      <img className={chart.kind === 'months' ? styles.months : styles.calendar} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(art.svg)}`} alt={reportChartAlt(localChart)} width={art.width} height={art.height} />
    </SidewaysScroller> : <div className={styles.chartScroll} aria-label={chart.title}>
      <img className={styles.progress} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(art.svg)}`} alt={reportChartAlt(localChart)} width={art.width} height={art.height} />
    </div>}
    <p className={styles.caption}>{chart.note}</p>
  </figure>;
}

export default function ReportVisualOverview({ visuals, image, imageCaption, imageKind = 'map', ink = false, compact = false, stamp, children, onOpenImage, viewLabel, language = visuals.language ?? 'en' }: { onOpenImage?: OpenReportImage; viewLabel?: string; visuals: ReportVisuals; image?: string; imageCaption?: string; imageKind?: 'photo' | 'map'; ink?: boolean; compact?: boolean; stamp?: string; children?: React.ReactNode; language?: string }) {
  const ui = (en: string, zu: string) => reportVisualText(en, language, {}, zu);
  const translatedViewLabel = viewLabel ?? ui('View full size','Buka ngosayizi ogcwele');
  // Full-width cards: month charts, calendars and drawn figures. The figures that open the list
  // (the site plan, what the land is used for, built / planned) lead the section; the rest follow the grid.
  const wide = (chart: ReportChart) => chart.kind === 'months' || chart.kind === 'calendar' || chart.kind === 'figure';
  const firstPlain = visuals.charts.findIndex(chart => chart.kind !== 'figure');
  const lead = visuals.charts.filter((chart, i) => chart.kind === 'figure' && (firstPlain < 0 || i < firstPlain));
  const grid = visuals.charts.filter(chart => !wide(chart));
  const tail = visuals.charts.filter(chart => wide(chart) && !lead.includes(chart));
  return <div lang={language} className={`${styles.visual} ${ink ? styles.ink : ''}`} data-report-visuals>
    <header className={styles.hero}>
      <div className={styles.heroCopy}><div className={styles.edition}><span>{ui('IMBEWUFIELD / SITE REPORT','IMBEWUFIELD / UMBIKO WESIZA')}</span>{stamp && <time>{stamp}</time>}</div><h1>{visuals.title}</h1>{visuals.subtitle && <p>{visuals.subtitle}</p>}</div>
      {!ink && image && <figure className={`${styles.heroFigure} ${imageKind === 'photo' ? styles.heroPhoto : ''}`}><img data-photo-preview src={image} alt={imageCaption ?? visuals.title} /><figcaption>{imageCaption}</figcaption></figure>}
    </header>
    <div className={styles.metrics}>{visuals.metrics.map(metric => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.note}</small></div>)}</div>
    <p className={styles.basis}>{visuals.basis}</p>
    {!compact && <><div className={styles.sectionIntro}><span>01</span><div><h2>{visuals.overviewTitle ?? ui('The site at a glance','Indawo le njengoba injalo')}</h2><p>{visuals.overviewNote ?? ui('Space, seasons and the resources behind the plan.','Indawo, izinkathi nezinsiza ezisekela uhlelo.')}</p></div></div>{lead.map(chart => <ReportChartCard key={chart.id} chart={chart} slideHint={visuals.slideHint} ink={ink} onOpenImage={onOpenImage} viewLabel={translatedViewLabel} language={language} />)}{grid.length > 0 && <div className={styles.charts}>{grid.map(chart => <ReportChartCard key={chart.id} chart={chart} slideHint={visuals.slideHint} ink={ink} onOpenImage={onOpenImage} viewLabel={translatedViewLabel} language={language} />)}</div>}{tail.map(chart => <ReportChartCard key={chart.id} chart={chart} slideHint={visuals.slideHint} ink={ink} onOpenImage={onOpenImage} viewLabel={translatedViewLabel} language={language} />)}</>}
    {children}
  </div>;
}

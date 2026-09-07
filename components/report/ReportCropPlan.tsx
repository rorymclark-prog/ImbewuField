'use client';
import { useEffect, useState } from 'react';
import type { FactCropPlan } from '@/lib/report-site-facts';
import { captureReportCropPlan, reportCropCalendar, reportCropMapSvg, reportCropMonths, reportCropRows, reportCropSignature, reportCropWorkingInput } from '@/lib/report-crop-plan';
import { loadCropPlan, CROP_PLAN_CHANGED_EVENT } from '@/lib/crop-plan';
import { loadCanvasState, DESIGN_CANVAS_CHANGED_EVENT } from '@/lib/design-canvas';
import { CROPS, cropByKey } from '@/lib/crop-catalog';
import { getCropArt } from '@/lib/crop-art';
import { buildCropPlanPdf, cropPlanPdfFilename } from '@/lib/crop-export-pdf';
import { deliverPdf } from '@/lib/report-pdf';
import { ReportChartCard } from './ReportVisualOverview';
import type { ReportChart } from '@/lib/report-visuals';
import styles from './ReportCropPlan.module.css';

export default function ReportCropPlan({ crop, siteName, month, onMonth, includeWorking, onIncludeWorking, legacyCharts, language = 'en' }: { crop: FactCropPlan; language?: string; legacyCharts: ReportChart[]; siteName: string; month: number; onMonth: (month: number) => void; includeWorking: boolean; onIncludeWorking: (value: boolean) => void }) {
  const tr = (en: string, zu: string) => language === 'zu' ? zu : en;
  const status = (value: string) => language !== 'zu' ? value : ({ 'In nursery': 'Kusenkulisa', 'Recorded as growing': 'Kubhalwe njengokukhulayo', 'First season only': 'Isizini yokuqala kuphela', 'Planned annual sowing': 'Ukuhlwanyela okuhleliwe minyaka yonke', 'Planned': 'Kuhleliwe' }[value] ?? value);
  const s = crop.snapshot;
  const [changed, setChanged] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const refresh = () => {
      if (!s) { setChanged(false); return; }
      const canvas = loadCanvasState(s.siteId);
      setChanged(!!canvas && reportCropSignature(captureReportCropPlan(canvas, loadCropPlan(), s.siteId)) !== reportCropSignature(s));
    };
    refresh();
    window.addEventListener(CROP_PLAN_CHANGED_EVENT, refresh);
    window.addEventListener(DESIGN_CANVAS_CHANGED_EVENT, refresh);
    return () => { window.removeEventListener(CROP_PLAN_CHANGED_EVENT, refresh); window.removeEventListener(DESIGN_CANVAS_CHANGED_EVENT, refresh); };
  }, [s]);
  const rows = reportCropRows(crop);
  const calendar = s ? reportCropCalendar(s) : [];
  const months = s ? reportCropMonths(s) : [];
  const map = s ? reportCropMapSvg(s, month) : null;
  async function exportWorking() {
    if (!s) return;
    setExporting(true); setError('');
    try { await deliverPdf(await buildCropPlanPdf(reportCropWorkingInput(s, siteName)), cropPlanPdfFilename(siteName, new Date(s.capturedAt))); }
    catch { setError('Could not export the crop plan. Please try again.'); }
    finally { setExporting(false); }
  }
  return <section className={styles.section} aria-label="Crop plan summary">
    <h2>{tr('Crop plan', 'Uhlelo lwezitshalo')}</h2>
    <p>{s ? `Plan recorded ${new Date(s.capturedAt).toLocaleDateString('en-ZA')}. The drawing, planting rows and working export use this report’s saved plan.` : 'This older report has crop totals, but no saved bed-by-month detail. Its original crop summary is shown below.'}</p>
    {changed && <p className={styles.notice}>The crop planner has changed since this report. This report keeps its saved plan. Generate a new site report when you want to include the changes.</p>}
    {s && <div className={styles.controls}>
      <a href={`/facilitator/crops?canvasSite=${encodeURIComponent(s.siteId)}`}>{tr('Open current crop planner', 'Vula uhlelo lwezitshalo lwamanje')}</a>
      <button onClick={exportWorking} disabled={exporting}>{exporting ? tr('Preparing…', 'Kuyalungiswa…') : tr('Download saved working plan (English)', 'Landa uhlelo lomsebenzi olugciniwe (isiNgisi)')}</button>
      <label><input type="checkbox" checked={includeWorking} onChange={e => onIncludeWorking(e.target.checked)} /> {tr('Include working plan appendix in full report PDF (English)', 'Faka isithasiselo sohlelo lomsebenzi ku-PDF egcwele (isiNgisi)')}</label>
    </div>}
    {error && <p role="alert">{error}</p>}
    <div className={styles.rows}>
      <div className={styles.head}><span>{tr('Crop / variety', 'Isitshalo / uhlobo')}</span><span>{tr('Bed or plot', 'Umbhede noma isiza')}</span><span>{tr('Sowing', 'Ukuhlwanyela')}</span><span>{tr('Status', 'Isimo')}</span></div>
      {rows.map(row => {
        const def = row.cropKey ? cropByKey(row.cropKey) : CROPS.find(c => c.name === row.name);
        const art = def ? getCropArt(def.key) : undefined;
        return <article key={row.key} className={styles.row}>
          <div className={styles.crop}>{art && <img src={art} alt="" width={44} height={44} loading="lazy" />}<div><strong>{row.name}</strong>{row.variety !== 'Not recorded' && <span>{row.variety}</span>}</div></div>
          <div><small>{tr('Bed / plot', 'Umbhede / isiza')}</small>{row.where}</div><div><small>{tr('Sowing', 'Ukuhlwanyela')}</small>{row.sow}</div><div><small>{tr('Status', 'Isimo')}</small>{status(row.status)}</div>
        </article>;
      })}
    </div>
    <p className={styles.note}>Variety is shown only where recorded. Sowing dates may refer to nursery work; field occupancy below includes reserved transplant space. Planned dates need checking on the ground.</p>
    {!s && legacyCharts.map(chart => <ReportChartCard key={chart.id} chart={chart} />)}
    {s && <>
      <div className={styles.controls}><h3>{tr('Growing spaces', 'Izindawo zokutshala')}</h3><label>{tr('Month shown', 'Inyanga ekhonjisiwe')} <select value={month} onChange={e => onMonth(Number(e.target.value))}>{months.map((m, i) => <option key={m} value={i}>{m}</option>)}</select></label></div>
      <div className={styles.mapLayout}>
        {map ? <img className={styles.map} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(map)}`} alt={`Saved bed and plot outlines for ${months[month]}; numbered key alongside`} /> : <p>No bed outlines were saved.</p>}
        <ol className={styles.key}>{calendar.map(b => <li key={b.bedId}><strong>{b.label}</strong><span>{b.cells[month].length ? b.cells[month].map(c => `${cropByKey(c.cropKey)?.name ?? c.cropKey} (${c.share})`).join('; ') : tr('No scheduled crop', 'Akukho sitshalo esihleliwe')}</span></li>)}</ol>
      </div>
      <p className={styles.note}>Numbers match the saved bed outlines. Crops listed for {months[month]} include growing, harvest and reserved field space. This drawing shows planned occupancy, not confirmed planting or a construction plan.</p>
      <h3>{tr('Seasonal bed calendar', 'Ikhalenda lemibhede lezinkathi zonyaka')}</h3>
      <p className={styles.note}>Read across each bed. Codes identify crops; * marks a planned harvest period. Blank means no verified timing is scheduled. Scroll across on a phone.</p>
      <div className={styles.calendar} tabIndex={0} aria-label="Seasonal bed calendar"><table><thead><tr><th>{tr('Bed / plot', 'Umbhede / isiza')}</th>{months.map(m => <th key={m}>{m}</th>)}</tr></thead><tbody>{calendar.map(b => <tr key={b.bedId}><th>{b.label}</th>{b.cells.map((cell, i) => <td key={i}>{cell.map((c, n) => <span key={n}>{c.abbr}{c.harvesting ? '*' : ''}{c.share !== 'Full' ? ` ${c.share}` : ''}</span>)}</td>)}</tr>)}</tbody></table></div>
      <p className={styles.note}>{[...new Map(calendar.flatMap(b => b.cells.flat().map(c => [c.cropKey, `${c.abbr} = ${cropByKey(c.cropKey)?.name ?? c.cropKey}`]))).values()].join(' · ')}</p>
    </>}
  </section>;
}

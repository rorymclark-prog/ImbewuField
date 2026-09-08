'use client';
import { useEffect, useState } from 'react';
import type { FactCropPlan } from '@/lib/report-site-facts';
import { captureReportCropPlan, reportSowingCalendar, reportCropSignature, reportCropWorkingInput } from '@/lib/report-crop-plan';
import { loadCropPlan, CROP_PLAN_CHANGED_EVENT } from '@/lib/crop-plan';
import { loadCanvasState, DESIGN_CANVAS_CHANGED_EVENT } from '@/lib/design-canvas';
import { getCropArt } from '@/lib/crop-art';
import { buildCropPlanPdf, cropPlanPdfFilename, type CropPlanSection } from '@/lib/crop-export-pdf';
import { deliverPdf } from '@/lib/report-pdf';
import type { ReportChart } from '@/lib/report-visuals';
import styles from './ReportCropPlan.module.css';

export default function ReportCropPlan({ crop, siteName, includeWorking, onIncludeWorking, language = 'en' }: {
  crop: FactCropPlan; siteName: string; includeWorking: boolean; onIncludeWorking: (v: boolean) => void;
  language?: string; month?: number; onMonth?: (v: number) => void; legacyCharts?: ReportChart[];
}) {
  const tr = (en: string, zu: string) => language === 'zu' ? zu : en;
  const s = crop.snapshot;
  const [changed, setChanged] = useState(false), [exporting, setExporting] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    const refresh = () => {
      if (!s) { setChanged(false); return; }
      const canvas = loadCanvasState(s.siteId);
      setChanged(!!canvas && reportCropSignature(captureReportCropPlan(canvas, loadCropPlan(), s.siteId)) !== reportCropSignature(s));
    };
    refresh();
    window.addEventListener(CROP_PLAN_CHANGED_EVENT, refresh); window.addEventListener(DESIGN_CANVAS_CHANGED_EVENT, refresh); window.addEventListener('focus', refresh);
    return () => { window.removeEventListener(CROP_PLAN_CHANGED_EVENT, refresh); window.removeEventListener(DESIGN_CANVAS_CHANGED_EVENT, refresh); window.removeEventListener('focus', refresh); };
  }, [s]);
  async function exportWorking(quick: boolean) {
    if (!s) return;
    setExporting(true); setError('');
    try {
      const input = reportCropWorkingInput(s, siteName);
      await deliverPdf(await buildCropPlanPdf({ ...input, ...(quick ? { sections: ['calendar', 'taskSummary'] as CropPlanSection[] } : {}) }), cropPlanPdfFilename(siteName, new Date(s.capturedAt), quick ? 'quick-print-a4' : undefined));
    } catch { setError(tr('Could not export the crop plan. Please try again.', 'Uhlelo lwezitshalo alukhiphekanga. Zama futhi.')); }
    finally { setExporting(false); }
  }
  const calendar = s ? reportSowingCalendar(s) : null;
  const symbol = (cell: { sow: boolean; transplant: boolean }) => `${cell.sow ? 'S' : ''}${cell.sow && cell.transplant ? ' / ' : ''}${cell.transplant ? 'T' : ''}`;
  const title = (cell: { sow: boolean; transplant: boolean }) => [cell.sow ? tr('Sow seed', 'Hlwanyela imbewu') : '', cell.transplant ? tr('Check seedlings; transplant when ready', 'Hlola izithombo; tshala uma sezilungile') : ''].filter(Boolean).join('; ');
  return <section className={styles.section} aria-label="Sowing calendar">
    <h2>{tr('Seasonal sowing calendar', 'Ikhalenda lokuhlwanyela lezinkathi zonyaka')}</h2>
    <p className={styles.note}>{s ? `${tr('Saved plan', 'Uhlelo olugciniwe')} · ${new Date(s.capturedAt).toLocaleDateString('en-ZA')}` : tr('This older report has a crop summary without dated planting records.', 'Lo mbiko omdala unesifinyezo sezitshalo ngaphandle kwamarekhodi anezinsuku.')}</p>
    {changed && <p className={styles.notice}>{tr('The current crop plan has changed. This calendar keeps the plan saved with this report.', 'Uhlelo lwamanje lushintshile. Leli khalenda ligcina uhlelo olwalugcinwe nalo mbiko.')}</p>}
    {calendar ? <>
      <p className={styles.note}>{tr('S = sow seed (in trays for transplant crops). T = check seedlings and transplant when ready. These are planned tasks; check water and field conditions.', 'S = hlwanyela imbewu. T = hlola izithombo bese utshala uma sezilungile. Hlola amanzi nezimo zendawo.')}</p>
      <div className={styles.calendar} tabIndex={0}><table><thead><tr><th scope="col">{tr('Crop', 'Isitshalo')}</th>{calendar.months.map(m => <th scope="col" key={m}>{m.split(' ')[0]}<small>{m.split(' ').slice(1).join(' ')}</small></th>)}</tr></thead><tbody>
        {calendar.rows.map(row => <tr key={row.cropKey}><th scope="row"><span className={styles.crop}>{getCropArt(row.cropKey) && <img src={getCropArt(row.cropKey)} alt="" width={28} height={28} loading="lazy" />}{row.name}</span></th>{row.cells.map((cell, i) => <td key={i} title={title(cell)}>{symbol(cell) && <span className={cell.sow ? styles.sow : styles.transplant}>{symbol(cell)}</span>}</td>)}</tr>)}
      </tbody></table></div>
      <div className={styles.mobileMonths}>{calendar.months.map((month, i) => {
        const crops = calendar.rows.filter(row => row.cells[i].sow || row.cells[i].transplant);
        return <div key={month}><strong>{month}</strong><p>{crops.length ? crops.map(row => `${row.name} (${symbol(row.cells[i])})`).join(' · ') : tr('No sowing or transplant task scheduled', 'Akukho ukuhlwanyela noma ukutshala okuhleliwe')}</p></div>;
      })}</div>
      {!!calendar.unscheduled.length && <p className={styles.note}>{tr('No new sowing/transplant task in this period:', 'Akukho ukuhlwanyela noma ukutshala okusha kulesi sikhathi:')} {calendar.unscheduled.join(', ')}. {tr('See the working plan for crops already growing and undated records.', 'Bheka uhlelo lomsebenzi ngezitshalo ezikhulayo namarekhodi angenazinsuku.')}</p>}
    </> : <ul>{crop.crops.map(c => <li key={c.name}>{c.name} · {c.sowMonths.join(', ') || tr('Sowing not recorded', 'Ukuhlwanyela akubhalwanga')}</li>)}</ul>}
    {s?.planNotes?.length ? <details className={styles.notes}><summary>{tr('Saved plan choices and checks', 'Ukukhetha nokuhlola uhlelo olugciniwe')}</summary><ul>{s.planNotes.map((note, i) => <li key={i}>{note.text}</li>)}</ul></details> : null}
    {s && <div className={styles.controls}>
      <button onClick={() => { void exportWorking(false); }} disabled={exporting}>{tr('Full crop-plan report (English)', 'Umbiko ophelele wohlelo lwezitshalo (isiNgisi)')}</button>
      <button onClick={() => { void exportWorking(true); }} disabled={exporting}>{tr('Quick-print summary (English)', 'Isifinyezo sokuphrinta (isiNgisi)')}</button>
      <a href={`/facilitator/crops?canvasSite=${encodeURIComponent(s.siteId)}`} target="_blank" rel="noopener noreferrer">{tr('Open current crop planner', 'Vula uhlelo lwezitshalo lwamanje')} →</a>
      <label><input type="checkbox" checked={includeWorking} onChange={e => onIncludeWorking(e.target.checked)} />{tr('Attach full working plan to PDF (English)', 'Faka uhlelo lomsebenzi oluphelele ku-PDF (isiNgisi)')}</label>
    </div>}
    {exporting && <p role="status">{tr('Preparing crop-plan report…', 'Kulungiswa umbiko wohlelo lwezitshalo…')}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}

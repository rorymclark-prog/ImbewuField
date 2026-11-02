'use client';
import { useLanguage } from '@/lib/i18n';
import { reportUiText, reportUiDate, reportUiMonth } from '@/lib/report-localisation';
import { useEffect, useState } from 'react';
import type { FactCropPlan } from '@/lib/report-site-facts';
import { captureReportCropPlan, reportSowingCalendar, reportCropSignature, reportCropWorkingInput, currentReportCropSupport, reportCropRows } from '@/lib/report-crop-plan';
import { loadCropPlan, CROP_PLAN_CHANGED_EVENT } from '@/lib/crop-plan';
import { loadCanvasState, DESIGN_CANVAS_CHANGED_EVENT } from '@/lib/design-canvas';
import { getCropArt } from '@/lib/crop-art';
import { buildCropPlanPdf, cropPlanPdfFilename, type CropPlanSection } from '@/lib/crop-export-pdf';
import { deliverPdf } from '@/lib/report-pdf';
import type { ReportChart } from '@/lib/report-visuals';
import styles from './ReportCropPlan.module.css';
import ProductionYearOverview from './ProductionYearOverview';

export default function ReportCropPlan({ crop, siteName, siteId = null, includeWorking, onIncludeWorking, language = 'en' }: {
  crop: FactCropPlan; siteName: string; siteId?: string | null; includeWorking: boolean; onIncludeWorking: (v: boolean) => void;
  language?: string; month?: number; onMonth?: (v: number) => void; legacyCharts?: ReportChart[];
}) {
  const { lang: uiLanguage, t: appT } = useLanguage();
  const tr = (en: string, zu?: string) => reportUiText(en, uiLanguage, appT, zu);
  const s = crop.snapshot;
  const [changed, setChanged] = useState(false), [exporting, setExporting] = useState(false), [error, setError] = useState('');
  const [support, setSupport] = useState(() => currentReportCropSupport(s, siteId));
  useEffect(() => {
    const refresh = () => {
      const current = currentReportCropSupport(s, siteId);
      setSupport(current);
      if (!current.allowCataloguePlanning) { setChanged(false); return; }
      if (!s) { setChanged(false); return; }
      const canvas = loadCanvasState(s.siteId);
      setChanged(!!canvas && reportCropSignature(captureReportCropPlan(canvas, loadCropPlan(), s.siteId)) !== reportCropSignature(s));
    };
    refresh();
    window.addEventListener(CROP_PLAN_CHANGED_EVENT, refresh); window.addEventListener(DESIGN_CANVAS_CHANGED_EVENT, refresh); window.addEventListener('focus', refresh); window.addEventListener('storage', refresh); window.addEventListener('permamap-places-changed', refresh);
    return () => { window.removeEventListener(CROP_PLAN_CHANGED_EVENT, refresh); window.removeEventListener(DESIGN_CANVAS_CHANGED_EVENT, refresh); window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); window.removeEventListener('permamap-places-changed', refresh); };
  }, [s, siteId]);
  async function exportWorking(quick: boolean) {
    if (!s || !currentReportCropSupport(s, siteId).allowCataloguePlanning) {
      setSupport(currentReportCropSupport(s, siteId));
      setError('Local crop-plan export is unavailable for the current site context.'); return;
    }
    const initialSupport = currentReportCropSupport(s, siteId);
    setExporting(true); setError('');
    try {
      const input = reportCropWorkingInput(s, siteName);
      const blob = await buildCropPlanPdf({ ...input, ...(quick ? { sections: ['calendar', 'taskSummary'] as CropPlanSection[] } : {}) });
      const current = currentReportCropSupport(s, siteId);
      if (!current.allowCataloguePlanning || current.fingerprint !== initialSupport.fingerprint) {
        setSupport(current); setError('Site details changed while the document was prepared. Review them before exporting.'); return;
      }
      await deliverPdf(blob, cropPlanPdfFilename(siteName, new Date(s.capturedAt), quick ? 'quick-print-a4' : undefined));
    } catch { setError('Could not export the crop plan. Please try again.'); }
    finally { setExporting(false); }
  }
  const calendar = s && support.allowCataloguePlanning ? reportSowingCalendar(s) : null;
  const symbol = (cell: { sow: boolean; transplant: boolean }) => `${cell.sow ? 'S' : ''}${cell.sow && cell.transplant ? ' / ' : ''}${cell.transplant ? 'T' : ''}`;
  const title = (cell: { sow: boolean; transplant: boolean }) => [cell.sow ? tr('Sow seed', 'Hlwanyela imbewu') : '', cell.transplant ? tr('Check seedlings; transplant when ready', 'Hlola izithombo; tshala uma sezilungile') : ''].filter(Boolean).join('; ');
  return <section lang={uiLanguage} className={styles.section} aria-label={tr('Sowing calendar')}>
    {support.allowCataloguePlanning && <ProductionYearOverview production={s?.annualProduction} language={language}/>}
    {!support.allowCataloguePlanning && <p role="note" className={styles.notice}>Local crop guidance and inherited forecasts are unavailable for this report’s current site context. Saved sowing entries remain records; this report does not approve local farming advice.</p>}
    <h2>{support.allowCataloguePlanning ? tr('Seasonal sowing calendar', 'Ikhalenda lokuhlwanyela lezinkathi zonyaka') : 'Saved sowing records'}</h2>
    <p className={styles.note}>{s ? `${tr('Saved plan', 'Uhlelo olugciniwe')} · ${reportUiDate(uiLanguage, s.capturedAt, false)}` : tr('This older report has a crop summary without dated planting records.', 'Lo mbiko omdala unesifinyezo sezitshalo ngaphandle kwamarekhodi anezinsuku.')}</p>
    {changed && <p className={styles.notice}>{tr('The current crop plan has changed. This calendar keeps the plan saved with this report.', 'Uhlelo lwamanje lushintshile. Leli khalenda ligcina uhlelo olwalugcinwe nalo mbiko.')}</p>}
    {calendar ? <>
      <p className={styles.note}>{tr('S = sow seed (in trays for transplant crops). T = check seedlings and transplant when ready. These are planned tasks; check water and field conditions.', 'S = hlwanyela imbewu (emathreyini ezitshalo ezizotshalwa kabusha). T = hlola izithombo bese utshala uma sezilungile. Lena yimisebenzi ehleliwe; hlola amanzi nezimo zensimu.')}</p>
      <div className={styles.calendar} tabIndex={0}><table><thead><tr><th scope="col">{tr('Crop', 'Isitshalo')}</th>{calendar.months.map(m => <th scope="col" key={m}>{reportUiMonth(uiLanguage, m).split(' ')[0]}<small>{m.split(' ').slice(1).join(' ')}</small></th>)}</tr></thead><tbody>
        {calendar.rows.map(row => <tr key={row.cropKey}><th scope="row"><span className={styles.crop}>{getCropArt(row.cropKey) && <img src={getCropArt(row.cropKey)} alt="" width={28} height={28} loading="lazy" />}{row.name}</span></th>{row.cells.map((cell, i) => <td key={i} title={title(cell)}>{symbol(cell) && <span className={cell.sow ? styles.sow : styles.transplant}>{symbol(cell)}</span>}</td>)}</tr>)}
      </tbody></table></div>
      <div className={styles.mobileMonths}>{calendar.months.map((month, i) => {
        const crops = calendar.rows.filter(row => row.cells[i].sow || row.cells[i].transplant);
        return <div key={month}><strong>{reportUiMonth(uiLanguage, month)}</strong><p>{crops.length ? crops.map(row => `${row.name} (${symbol(row.cells[i])})`).join(' · ') : tr('No sowing or transplant task scheduled', 'Akukho ukuhlwanyela noma ukutshala okuhleliwe')}</p></div>;
      })}</div>
      {!!calendar.unscheduled.length && <p className={styles.note}>{tr('No new sowing/transplant task in this period:', 'Akukho ukuhlwanyela noma ukutshala okusha kulesi sikhathi:')} {calendar.unscheduled.join(', ')}. {tr('See the working plan for crops already growing and undated records.', 'Bheka uhlelo lomsebenzi ngezitshalo ezikhulayo namarekhodi angenazinsuku.')}</p>}
    </> : <ul>{reportCropRows(crop).map(row => <li key={row.key}>{row.name} · saved sowing: {row.sow || tr('Sowing not recorded', 'Ukuhlwanyela akubhalwanga')} · {row.where}</li>)}</ul>}
    {support.allowCataloguePlanning && s?.planNotes?.length ? <details className={styles.notes}><summary>{tr('Saved plan choices and checks', 'Ukukhetha nokuhlola uhlelo olugciniwe')}</summary><ul>{s.planNotes.map((note, i) => <li key={i}>{note.text}</li>)}</ul></details> : null}
    {s && support.allowCataloguePlanning && <div className={styles.controls}>
      <button onClick={() => { void exportWorking(false); }} disabled={exporting}>{tr('Full crop-plan report (English)', 'Umbiko ophelele wohlelo lwezitshalo (isiNgisi)')}</button>
      <button onClick={() => { void exportWorking(true); }} disabled={exporting}>{tr('Quick-print summary (English)', 'Isifinyezo sokuphrinta (isiNgisi)')}</button>
      <a href={`/facilitator/crops?canvasSite=${encodeURIComponent(s.siteId)}`} target="_blank" rel="noopener noreferrer">{tr('Open current production plan', 'Vula uhlelo lokukhiqiza lwamanje')} →</a>
      <label><input type="checkbox" checked={includeWorking} onChange={e => onIncludeWorking(e.target.checked)} />{tr('Attach full working plan to PDF (English)', 'Faka uhlelo lomsebenzi oluphelele ku-PDF (isiNgisi)')}</label>
    </div>}
    {exporting && <p role="status">{tr('Preparing crop-plan report…', 'Kulungiswa umbiko wohlelo lwezitshalo…')}</p>}
    {error && <p role="alert">{tr(error)}</p>}
  </section>;
}

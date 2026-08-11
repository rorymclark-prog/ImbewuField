'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { LocationData, SiteData, WaterData } from '@/lib/types';
import RainfallChart from './RainfallChart';
import { loadReports, saveReport, deleteReport, reportId, MAX_REPORTS, type SavedReport, type SaveReportReason } from '@/lib/saved-reports';
import { isSampleMode } from '@/lib/sample-mode';
import { PLACE_LABELS, placeColor, type SavedPlace } from '@/lib/saved-places';
import { Loader2, Check, Circle, ChevronRight, Share2, MapPin, SlidersHorizontal, FileText } from 'lucide-react';
import { buildReportPdf, deliverPdf, reportPdfFilename, stripInlineMarkdown } from '@/lib/report-pdf';
import { resolveSiteEcology } from '@/lib/site-ecology';
import { loadSheetMetas, loadSheetImage } from '@/lib/sheet-store';
import { selectReportPlates } from '@/lib/report-plates';
import { PLAN_VERSION } from '@/lib/plan-version';
import { loadSurvey } from '@/lib/site-survey';
import { getSiteEvidence } from '@/lib/site-evidence';
import { designSiteIdFromLocation } from '@/lib/design-studio';
import { loadCanvasState } from '@/lib/design-canvas';
import { resolveBaseLayers } from '@/lib/base-layers';
import { buildPhasePlan } from '@/lib/phasing';
import { collectReportSiteFacts } from '@/lib/report-site-facts-collect';
import { paidApiHeaders } from '@/lib/api-client-auth';

const ALL_SECTIONS = [
  'Executive Summary',
  'Site Conditions',
  'Natural Vegetation & Biome',
  'Water Harvesting',
  'Irrigation Plan',
  'Soil Strategy',
  'Planting Calendar',
  'Year-Round Food Production',
  'Fruit, Nut & Berry Trees',
  'Indigenous Trees',
  'Agroecosystem Planting Guide',
  'Crop Rotation',
  'Animals & Livestock',
  'Sun & Solar',
  'Wind & Windbreaks',
  'Fire & Hazards',
  'Economic Opportunities',
  'Plant Guilds',
  'Zone Design',
  'Seasonal Calendar',
  '5-Year Vision',
  'Year 1 Priorities',
] as const;

// Sections most useful to a small-scale SA farmer (used by the "Farmer essentials" preset)
const FARMER_ESSENTIALS = [
  'Executive Summary',
  'Natural Vegetation & Biome',
  'Water Harvesting',
  'Irrigation Plan',
  'Soil Strategy',
  'Planting Calendar',
  'Year-Round Food Production',
  'Fruit, Nut & Berry Trees',
  'Indigenous Trees',
  'Agroecosystem Planting Guide',
  'Crop Rotation',
  'Animals & Livestock',
  'Sun & Solar',
  'Wind & Windbreaks',
  'Fire & Hazards',
  'Economic Opportunities',
  'Zone Design',
  'Year 1 Priorities',
];

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'zu', label: 'isiZulu' },
  { code: 'xh', label: 'isiXhosa' },
  { code: 'af', label: 'Afrikaans' },
  { code: 'st', label: 'Sesotho' },
  { code: 'nso', label: 'Sepedi' },
  { code: 'tn', label: 'Setswana' },
  { code: 'ts', label: 'Xitsonga' },
  { code: 've', label: 'Tshivenda' },
  { code: 'ss', label: 'siSwati' },
  { code: 'nr', label: 'isiNdebele' },
] as const;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const BIOME_COLORS: Record<string, string> = {
  SV: '#8B9D5E', GR: '#6BA84F', FY: '#C8974A', SK: '#D07850',
  NK: '#B89040', DE: '#C8A842', AT: '#5A8B4A', IOCB: '#3A9A7A', FOR: '#2D7A5C',
};

interface Props {
  locationData: LocationData;
  photoAnalysis?: string;
  siteData?: SiteData;
  waterData?: WaterData;
  savedPlaces?: SavedPlace[];  // saved pins → listed with their GPS points in the report
  mapCapture?: string | null;
  appLang?: string;
  onClose: () => void;
  savedReport?: SavedReport;   // when opening a previously-saved report
  activePlaceId?: string;
}

function renderReport(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (line.startsWith('## ')) {
      const heading = line.replace('## ', '');
      const headingId = heading.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const isExecSummary = heading === 'Executive Summary';
      elements.push(
        isExecSummary ? (
          <div key={i} className="report-h2 rounded-xl p-4 my-6"
               style={{ background: 'rgba(31,77,43,0.06)', border: '1px solid rgba(31,77,43,0.2)' }}>
            <div className="font-display font-bold text-lg mb-1" style={{ color: '#1F4D2B' }}>
              Executive Summary
            </div>
          </div>
        ) : (
          <h2 key={i} id={headingId} className="report-h2 font-display font-bold text-xl mt-10 mb-3 pt-4 pb-2 flex items-center gap-3"
              style={{ color: '#1F4D2B', borderBottom: '1px solid #E2D8C4' }}>
            <span style={{ display: 'inline-block', width: 3, height: 20, borderRadius: 2, background: '#C07A1E', flexShrink: 0 }} />
            {heading}
          </h2>
        )
      );
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="font-display font-semibold text-base mt-5 mb-2" style={{ color: '#C07A1E' }}>
          {line.replace('### ', '')}
        </h3>
      );
    } else if (line.startsWith('# ')) {
      // The document title. It used to fall through to the paragraph branch and print its own
      // literal "# " on screen; now that the title carries the farm's name it is the first thing
      // a reader sees, so it renders as a title.
      elements.push(
        <h1 key={i} className="font-display font-bold text-2xl mt-1 mb-1" style={{ color: '#20190F' }}>
          {stripInlineMarkdown(line.slice(2))}
        </h1>
      );
    } else if (line.startsWith('**') && line.endsWith('**')) {
      elements.push(
        <p key={i} className="font-display font-semibold text-sm mt-3 mb-1" style={{ color: '#20190F' }}>
          {stripInlineMarkdown(line)}
        </p>
      );
    } else if (line.startsWith('| ')) {
      // Table — collect all rows
      const tableRows: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        tableRows.push(lines[i]);
        i++;
      }
      const [header, , ...body] = tableRows;
      // Drop ONLY the empty cells the leading and trailing pipes produce — never an interior
      // one. `.filter(c => c.trim())` used to strip every blank cell, which silently shifted
      // each remaining cell one column left: a bill-of-quantities group row ("| **Water** | | |
      // | |") collapsed to a single cell, and a two-column table with a blank header rendered
      // its body wider than its head. lib/report-pdf.ts has always split correctly, so the
      // exported PDF and the on-screen report disagreed about the same table.
      const splitRow = (row: string): string[] => {
        const cells = row.split('|');
        if (cells.length && cells[0].trim() === '') cells.shift();
        if (cells.length && cells[cells.length - 1].trim() === '') cells.pop();
        return cells;
      };
      const headers = splitRow(header);
      const rows = body.map(splitRow);
      elements.push(
        <div key={`table-${i}`} className="overflow-x-auto my-4">
          <table className="w-full text-xs font-display border-collapse">
            <thead>
              <tr style={{ borderBottom: '1px solid #E2D8C4' }}>
                {headers.map((h, j) => (
                  <th key={j} className="text-left py-2 px-3 font-semibold" style={{ color: '#5C5040' }}>
                    {h.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: '1px solid #E2D8C4', background: ri % 2 === 0 ? 'transparent' : 'rgba(31,77,43,0.04)' }}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="py-2 px-3 leading-relaxed font-sans" style={{ color: '#20190F' }}>
                      {stripInlineMarkdown(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    } else if (line.match(/^\d+\. \*\*/)) {
      const match = line.match(/^(\d+)\. \*\*(.+?)\*\*(.*)$/);
      if (match) {
        elements.push(
          <div key={i} className="flex gap-3 my-2">
            <span className="font-display font-bold text-sm flex-shrink-0 w-5 text-right" style={{ color: '#C07A1E' }}>{match[1]}.</span>
            <div>
              <span className="font-display font-semibold text-sm" style={{ color: '#2D6B3C' }}>{match[2]}</span>
              {match[3] && <span className="font-display text-sm leading-relaxed" style={{ color: '#20190F' }}>{match[3]}</span>}
            </div>
          </div>
        );
      }
    } else if (line.match(/^\d+\./)) {
      elements.push(
        <div key={i} className="flex gap-3 my-1.5">
          <span className="font-display font-semibold text-sm flex-shrink-0 w-5 text-right" style={{ color: '#C07A1E' }}>
            {line.match(/^\d+/)?.[0]}.
          </span>
          <p className="font-display text-sm leading-relaxed" style={{ color: '#20190F' }}>
            {stripInlineMarkdown(line.replace(/^\d+\.\s*/, ''))}
          </p>
        </div>
      );
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      elements.push(
        <div key={i} className="flex gap-2 my-1">
          <span className="flex-shrink-0 mt-0.5" style={{ color: '#1F4D2B' }}><ChevronRight size={12} /></span>
          <p className="font-display text-sm leading-relaxed" style={{ color: '#20190F' }}>
            {stripInlineMarkdown(line.replace(/^[-•]\s*/, ''))}
          </p>
        </div>
      );
    } else {
      elements.push(
        <p key={i} className="font-display text-sm leading-relaxed my-1.5" style={{ color: '#20190F' }}>
          {stripInlineMarkdown(line)}
        </p>
      );
    }
    i++;
  }
  return elements;
}

export default function ReportView({ locationData, photoAnalysis, siteData: liveSite, waterData: liveWater, savedPlaces, mapCapture, appLang, onClose, savedReport, activePlaceId }: Props) {
  // When viewing a saved report, its snapshot overrides the live props so charts/header match.
  const [activeSaved, setActiveSaved] = useState<SavedReport | null>(savedReport ?? null);
  const d = activeSaved?.location ?? locationData;
  const siteData = activeSaved?.siteData ?? liveSite;
  const waterData = activeSaved?.waterData ?? liveWater;

  const [selected, setSelected] = useState<Set<string>>(new Set(FARMER_ESSENTIALS));
  const [report, setReport] = useState(savedReport?.report ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState(!!savedReport);
  const [language, setLanguage] = useState(savedReport?.lang ?? appLang ?? 'en');
  const [bilingual, setBilingual] = useState(false);
  const [tone, setTone] = useState<'simple' | 'professional'>('simple');
  const [length, setLength] = useState<'one-pager' | 'standard' | 'comprehensive'>('standard');
  const abortRef = useRef<AbortController | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // Saved reports (for the in-screen list) + save-button feedback
  const [savedList, setSavedList] = useState<SavedReport[]>([]);
  const [justSaved, setJustSaved] = useState(false);
  // saveReport ALREADY returns whether the write succeeded, and this component ALREADY ignored it.
  // A farmer who reads "Saved" and closes the tab has lost the report — it is not recoverable and
  // nothing warned them. The button has to be able to say so. Sample mode is a separate,
  // deliberate no-op that returns saved:false on purpose; the label already tells that truth.
  const [saveFailed, setSaveFailed] = useState(false);
  const [saveFailedReason, setSaveFailedReason] = useState<SaveReportReason | null>(null);
  const [copied, setCopied] = useState(false);
  const [pdfState, setPdfState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  useEffect(() => {
    const refresh = () => setSavedList(loadReports());
    refresh();
    window.addEventListener('imbewu-reports-changed', refresh);
    return () => window.removeEventListener('imbewu-reports-changed', refresh);
  }, []);

  // ── Narrow-screen layout ───────────────────────────────────────────────────
  // On a phone the settings column and the report cannot share the width: 232px
  // of controls out of 375px leaves the report in a ~140px gutter that is
  // unreadable. So on narrow screens they take turns — the report is the
  // primary read once one exists, and the controls come back on demand.
  // Desktop keeps the two-column layout untouched.
  const [isWide, setIsWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => setIsWide(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Controls start open (nothing to read yet) unless we opened straight into a
  // saved report, which already has content.
  const [panelOpen, setPanelOpen] = useState(!savedReport);
  const showPanel = isWide || panelOpen;
  const showReportColumn = isWide || !panelOpen;

  const handleSaveReport = useCallback(() => {
    if (!report) return;
    const { saved, reason } = saveReport({
      id: activeSaved?.id ?? reportId(),
      name: `${ecology.placeName} · ${new Date().toLocaleDateString()}`,
      savedAt: new Date().toISOString(),
      lang: language,
      report,
      location: d,
      siteData: siteData ?? undefined,
      waterData: waterData ?? undefined,
    });
    // A storage refusal (full disk, private mode) is the case that costs the farmer the report.
    // It STAYS on screen until the next attempt succeeds — a message that clears itself after two
    // seconds is the same lie more slowly, because the farmer may not be looking.
    if (!saved && !isSampleMode()) {
      setSaveFailed(true);
      setSaveFailedReason(reason ?? 'storage-error');
      return;
    }
    setSaveFailed(false);
    setSaveFailedReason(null);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
  }, [report, activeSaved, d, siteData, waterData, language]);

  // Once there is a report to read, a phone should be showing the report — not
  // the settings that produced it. Read the media query at call time rather than
  // closing over `isWide`, so this never acts on a stale value.
  const collapsePanelOnNarrow = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(min-width: 768px)').matches) setPanelOpen(false);
  }, []);

  const openSaved = useCallback((r: SavedReport) => {
    setActiveSaved(r);
    setReport(r.report);
    setLanguage(r.lang);
    setGenerated(true);
    setError('');
    collapsePanelOnNarrow();
  }, [collapsePanelOnNarrow]);

  // ONE ANSWER TO "WHAT GROWS HERE" — see lib/site-ecology.ts. The coarse biome polygon and

  // the SANBI vegetation map disagree near boundaries, and this screen used to spend the coarse

  // one on the title, the saved name, the share text and the PDF filename while the report body

  // itself named the precise unit — so a Zululand savanna site downloaded as "Indian Ocean

  // Coastal Belt". The precise map wins here too.

  const ecology = resolveSiteEcology(d.biome, d.vegetation);

  const bColor = BIOME_COLORS[ecology.biome.code] ?? '#6BA84F';

  const generate = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setReport('');
    setError('');
    setLoading(true);
    setGenerated(false);
    // Hand the screen to the report the moment generation starts — the farmer
    // wants to watch it stream in, not stare at the section checkboxes.
    collapsePanelOnNarrow();

    try {
      // Build evidence summary (strip base64 thumbnails — send counts + notes only)
      const rawEvidence = activePlaceId ? getSiteEvidence(activePlaceId) : {};
      const evidenceData: Record<string, { count: number; notes: string[] }> = {};
      for (const [key, items] of Object.entries(rawEvidence)) {
        if (items.length > 0) {
          evidenceData[key] = {
            count: items.length,
            notes: items.filter(i => i.note).map(i => i.note!),
          };
        }
      }

      const siteId = designSiteIdFromLocation(d);
      const canvas = loadCanvasState(siteId);
      const phasePlan = canvas
        ? buildPhasePlan(
          canvas,
          resolveBaseLayers(canvas, { boundary: [], house: [], driveway: [] }),
          { biome: ecology.placeName, rainfallMm: d.rainfall.annual },
        )
        : null;

      // What the farmer actually DREW — beds, species, zones, routes, tanks, the traced roof and
      // boundary. Until this existed the report was told "no design exists" on every single run
      // (the old studioLayers gate keyed off an `approved` flag nothing in the app ever sets), so
      // a finished plan one tab away never reached the document. See lib/report-site-facts.ts.
      const siteFacts = collectReportSiteFacts({
        siteId,
        lat: d.lat,
        lon: d.lon,
        canvas,
        farmName: (activePlaceId ? savedPlaces?.find((place) => place.id === activePlaceId)?.name : undefined)
          ?? savedPlaces?.[0]?.name,
      });

      const res = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await paidApiHeaders() },
        body: JSON.stringify({
          locationData: d,
          photoAnalysis: photoAnalysis || undefined,
          siteData: siteData || undefined,
          waterData: waterData || undefined,
          siteFacts,
          phasePlan: phasePlan ?? undefined,
          surveyData: loadSurvey(designSiteIdFromLocation(d)) ?? undefined,
          evidenceData: Object.keys(evidenceData).length > 0 ? evidenceData : undefined,
          sections: Array.from(selected),
          language,
          bilingual,
          tone,
          length,
        }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        setReport(text);
      }
      setGenerated(true);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [d, photoAnalysis, siteData, waterData, savedPlaces, activePlaceId, selected, language, bilingual, tone, length, collapsePanelOnNarrow]);

  // "Export PDF". This used to be window.print(), which is a silent no-op in an
  // installed iOS PWA (manifest display: standalone) — the button looked dead on
  // a phone and threw nothing anyone could catch. We build the PDF ourselves and
  // hand it to the device. See lib/report-pdf.ts.
  const exportPdf = useCallback(async () => {
    if (!report) return;
    setPdfState('working');
    try {
      // THE DESIGN MAPS GO IN THE REPORT. Rory: "Our report still doesn't have the images the
      // design maps we create". Metas only here — ids and labels, no pixels. The PDF pulls each
      // sheet's image immediately before it draws that plate and never holds two at once, because
      // a farmer can have dozens of sheets at 1–3 MB each and this export runs on the same phone
      // that has been dying of exactly that (lib/sheet-store.ts's memory contract).
      // ONE PLATE PER SHEET, NOT THE WHOLE GALLERY. The gallery is a working record — every render
      // ever made, exact and paid, across every revision of the plan rules — and a farmer can hold
      // a hundred of them. As a report appendix that is a hundred near-duplicate pages. The
      // selection takes the latest sheet of each kind from the current plan generation, in sheet
      // order. See lib/report-plates.ts.
      const sheetMetas = await loadSheetMetas(designSiteIdFromLocation(d)).catch(() => []);
      const plates = selectReportPlates(sheetMetas, PLAN_VERSION);
      const blob = await buildReportPdf(report, {
        biome: ecology.placeName,
        lat: d.lat,
        lon: d.lon,
        rainfallMm: d.rainfall.annual,
        soilPh: d.soil.ph,
        meanTempC: d.climate.meanTemp,
        dateLabel: new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' }),
        sheets: plates,
        loadSheetImage,
      });
      await deliverPdf(blob, reportPdfFilename(ecology.placeName));
      setPdfState('done');
      setTimeout(() => setPdfState('idle'), 2500);
    } catch (err) {
      // Never fail silently again — that was the whole bug.
      setPdfState('error');
      setError(err instanceof Error ? `Could not build the PDF: ${err.message}` : 'Could not build the PDF.');
      setTimeout(() => setPdfState('idle'), 4000);
    }
  }, [report, d]);

  async function shareReport() {
    if (!d || !report) return;
    const firstPara = report.split('\n').find((l) => l.trim() && !l.startsWith('#'))?.slice(0, 200) ?? '';
    const text = `ImbewuField Site Analysis\n${ecology.label} | ${Math.abs(d.lat).toFixed(3)}°S ${d.lon.toFixed(3)}°E\nRainfall: ${d.rainfall.annual}mm/yr | Soil pH: ${d.soil.ph} | Mean temp: ${d.climate.meanTemp}°C\n\n${firstPara}...\n\nSee the full report on ImbewuField (imbewufield.vercel.app)`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: 'ImbewuField Site Analysis', text }); return; } catch { /* user cancelled */ }
    }
    // Fallback: copy to clipboard
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#E4DCC6' }}>

      {/* ── Toolbar ──────────────────────────────────────────────────────────
          Wraps rather than scrolls. At 375px the old single non-wrapping row was
          731px wide, so Share and Generate sat off-screen with no way to reach
          them (the row was not scrollable either). Title and actions are now two
          wrapping groups: every control stays on screen at any width.
      */}
      <div
        className="no-print flex-shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 md:px-6 py-2.5 md:py-3"
        style={{ background: 'rgba(226,216,196,0.3)', borderBottom: '1px solid #E2D8C4' }}
      >
        <button onClick={onClose} className="text-xs font-mono px-3 py-1.5 rounded-lg transition-all flex-shrink-0"
                style={{ color: '#5C5040', background: 'rgba(226,216,196,0.5)', border: '1px solid #E2D8C4' }}>
          Back
        </button>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-display font-semibold truncate" style={{ color: '#20190F' }}>
            Site Analysis Report
          </div>
          <div className="text-xs font-mono truncate" style={{ color: '#5C5040' }}>
            {ecology.label} · {Math.abs(d.lat).toFixed(3)}°S {d.lon.toFixed(3)}°E
          </div>
        </div>

        {/* Settings toggle — phone only. The controls column and the report take
            turns on a narrow screen, so this is the way back to either one. */}
        {!isWide && (
          <button
            onClick={() => setPanelOpen((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-medium transition-all flex-shrink-0"
            style={panelOpen
              ? { background: 'rgba(31,77,43,0.15)', border: '1px solid rgba(31,77,43,0.4)', color: '#1F4D2B' }
              : { background: 'rgba(226,216,196,0.5)', border: '1px solid #E2D8C4', color: '#5C5040' }}
          >
            {panelOpen && report
              ? <><FileText size={12} />Report</>
              : <><SlidersHorizontal size={12} />Settings</>}
          </button>
        )}

        {/* Action group — wraps to its own row on a phone, sits inline on desktop */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="hidden md:block flex-1" />

          {generated && (
            <button
              onClick={handleSaveReport}
              className="flex items-center gap-1.5 px-3 md:px-4 py-1.5 rounded-lg text-xs font-display font-medium transition-all"
              style={saveFailed
                ? { background: 'rgba(154,52,18,0.12)', border: '1px solid rgba(154,52,18,0.45)', color: '#9A3412' }
                : justSaved
                ? { background: 'rgba(31,77,43,0.15)', border: '1px solid rgba(31,77,43,0.4)', color: '#1F4D2B' }
                : { background: 'rgba(31,77,43,0.1)', border: '1px solid rgba(31,77,43,0.3)', color: '#1F4D2B' }}
            >
              {saveFailed
                ? (saveFailedReason === 'store-full'
                    ? `You have ${MAX_REPORTS} saved reports — delete one to save this`
                    : 'Not saved — no space')
                : justSaved ? (isSampleMode() ? 'Demo — not saved' : 'Saved') : 'Save'}
            </button>
          )}

          {generated && (
            <button
              onClick={exportPdf}
              disabled={pdfState === 'working'}
              className="flex items-center gap-1.5 px-3 md:px-4 py-1.5 rounded-lg text-xs font-display font-medium transition-all"
              style={{
                background: 'linear-gradient(135deg, rgba(192,122,30,0.15), rgba(192,122,30,0.06))',
                border: '1px solid rgba(192,122,30,0.35)',
                color: '#C07A1E',
                opacity: pdfState === 'working' ? 0.6 : 1,
              }}
            >
              {pdfState === 'working' && <Loader2 size={12} className="animate-spin" />}
              {pdfState === 'working' ? 'Building…' : pdfState === 'done' ? 'PDF ready' : 'Export PDF'}
            </button>
          )}

          {generated && (
            <button
              onClick={shareReport}
              className="flex items-center gap-1.5 px-3 md:px-4 py-1.5 rounded-lg text-xs font-display font-medium transition-all"
              style={{
                background: copied ? 'rgba(35,94,134,0.15)' : 'rgba(35,94,134,0.08)',
                border: '1px solid rgba(35,94,134,0.3)',
                color: '#235E86',
              }}
            >
              <Share2 size={12} />{copied ? 'Copied!' : 'Share'}
            </button>
          )}

          {/* One regenerate control, not two — the primary button below already
              switches its own label to "Regenerate" once a report exists. */}
          <button
            onClick={generate}
            disabled={loading || selected.size === 0}
            className="flex items-center gap-1.5 px-3 md:px-4 py-1.5 rounded-lg text-xs font-display font-semibold transition-all"
            style={
              loading || selected.size === 0
                ? { background: 'rgba(226,216,196,0.6)', color: '#5C5040', border: '1px solid #E2D8C4' }
                : {
                    background: '#1F4D2B',
                    border: '1px solid rgba(31,77,43,0.6)',
                    color: '#F7F2E9',
                    boxShadow: '0 0 16px rgba(31,77,43,0.2)',
                  }
            }
          >
            {loading ? <><Loader2 size={14} className="animate-spin inline mr-1" /> Generating...</> : generated ? 'Regenerate' : 'Generate report'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">

        {/* ── Section controls sidebar ───────────
            Desktop: a fixed 232px column beside the report (unchanged).
            Phone: full width, and only one of the two is displayed at a time.
            Both stay mounted so reportRef and the report's scroll position
            survive toggling. */}
        <div className="no-print flex-shrink-0 overflow-y-auto py-4 px-3"
             style={{
               width: isWide ? 232 : '100%',
               display: showPanel ? 'block' : 'none',
               background: '#FFFEFA',
               borderRight: isWide ? '1px solid #E2D8C4' : 'none',
             }}>

          {/* Phone: the report is the primary read once it exists */}
          {!isWide && report && (
            <button
              onClick={() => setPanelOpen(false)}
              className="w-full flex items-center justify-center gap-2 mb-4 py-2.5 rounded-lg text-sm font-display font-semibold"
              style={{ background: '#1F4D2B', color: '#F7F2E9', border: 'none' }}
            >
              <FileText size={14} />Read the report
            </button>
          )}

          {/* Saved reports — reopen a past report without regenerating */}
          {savedList.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: '#5C5040' }}>Saved reports</div>
              <div className="flex flex-col gap-1.5">
                {savedList.map((r) => (
                  <div key={r.id} className="flex items-center gap-1 rounded-lg" style={{ background: 'rgba(226,216,196,0.5)', border: '1px solid #E2D8C4' }}>
                    <button onClick={() => openSaved(r)}
                      className="flex-1 min-w-0 text-left px-2.5 py-1.5 rounded-lg"
                      style={{ color: activeSaved?.id === r.id ? '#1F4D2B' : '#20190F' }}>
                      <div className="text-xs font-display truncate">{r.name}</div>
                    </button>
                    <button onClick={() => deleteReport(r.id)} title="Delete"
                      className="px-2 py-1.5 text-xs font-display" style={{ color: '#5C5040' }}>Delete</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Language */}
          <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: '#5C5040' }}>Language</div>
          <select
            value={language}
            onChange={(e) => { setLanguage(e.target.value); if (e.target.value === 'en') setBilingual(false); }}
            className="w-full text-xs font-display rounded-lg px-2.5 py-1.5 mb-2 outline-none cursor-pointer"
            style={{ background: 'rgba(226,216,196,0.5)', border: '1px solid #E2D8C4', color: '#20190F' }}
          >
            {LANGUAGE_OPTIONS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          {language !== 'en' && (
            <button
              onClick={() => setBilingual(!bilingual)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 mb-4 rounded-lg text-xs font-display transition-all"
              style={bilingual
                ? { background: 'rgba(45,107,60,0.12)', border: '1px solid rgba(45,107,60,0.35)', color: '#2D6B3C' }
                : { background: 'rgba(226,216,196,0.5)', border: '1px solid #E2D8C4', color: '#5C5040' }}
            >
              <span>+ English alongside</span>
              <span>{bilingual ? <Circle size={12} fill="currentColor" /> : <Circle size={12} />}</span>
            </button>
          )}

          {/* Tone */}
          <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: '#5C5040' }}>Wording</div>
          <div className="flex gap-1.5 mb-4">
            {([['simple', 'Simple'], ['professional', 'Detailed']] as const).map(([val, label]) => (
              <button key={val} onClick={() => setTone(val)}
                className="flex-1 py-1.5 rounded-lg text-xs font-display transition-all"
                style={tone === val
                  ? { background: 'rgba(31,77,43,0.1)', border: '1px solid rgba(31,77,43,0.3)', color: '#1F4D2B' }
                  : { background: 'rgba(226,216,196,0.3)', border: '1px solid #E2D8C4', color: '#5C5040' }}>
                {label}
              </button>
            ))}
          </div>

          {/* Length */}
          <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: '#5C5040' }}>Length</div>
          <div className="flex flex-col gap-1.5 mb-4">
            {([
              ['one-pager', 'One pager', 'Executive Summary only — fits one printed page'] as const,
              ['standard', 'Standard', 'Core sections for the farmer'] as const,
              ['comprehensive', 'Comprehensive', 'All sections, full detail'] as const,
            ]).map(([val, label, tip]) => (
              <button key={val} onClick={() => {
                setLength(val as 'one-pager' | 'standard' | 'comprehensive');
                if (val === 'one-pager') setSelected(new Set(['Executive Summary']));
                else if (val === 'comprehensive') setSelected(new Set(ALL_SECTIONS));
                else setSelected(prev => prev.size <= 1 ? new Set(FARMER_ESSENTIALS) : prev);
              }}
                className="w-full py-1.5 rounded-lg text-xs font-display transition-all text-left px-2.5"
                title={tip}
                style={length === val
                  ? { background: 'rgba(192,122,30,0.1)', border: '1px solid rgba(192,122,30,0.3)', color: '#C07A1E' }
                  : { background: 'rgba(226,216,196,0.3)', border: '1px solid #E2D8C4', color: '#5C5040' }}>
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-mono uppercase tracking-wider" style={{ color: '#5C5040' }}>Sections</div>
            <div className="flex gap-1">
              <button onClick={() => setSelected(new Set(FARMER_ESSENTIALS))}
                className="text-xs font-mono px-1.5 py-0.5 rounded transition-all"
                style={{ color: '#1F4D2B', background: 'rgba(31,77,43,0.1)', border: '1px solid rgba(31,77,43,0.2)' }}
                title="Select the sections most useful to a small-scale farmer">
                Farmer
              </button>
              <button onClick={() => setSelected(new Set(ALL_SECTIONS))}
                className="text-xs font-mono px-1.5 py-0.5 rounded transition-all"
                style={{ color: '#5C5040', background: 'rgba(226,216,196,0.3)', border: '1px solid #E2D8C4' }}
                title="Select all sections">
                All
              </button>
              <button onClick={() => setSelected(new Set())}
                className="text-xs font-mono px-1.5 py-0.5 rounded transition-all"
                style={{ color: '#9B4040', background: 'rgba(155,64,64,0.1)', border: '1px solid rgba(155,64,64,0.2)' }}
                title="Deselect all sections">
                None
              </button>
            </div>
          </div>
          {length === 'one-pager' && (
            <div className="text-xs font-mono px-2 py-1.5 rounded-lg mb-1" style={{ background: 'rgba(192,122,30,0.08)', border: '1px solid rgba(192,122,30,0.25)', color: '#9A6010' }}>
              One pager = Executive Summary only
            </div>
          )}
          <div className="space-y-1" style={{ opacity: length === 'one-pager' ? 0.4 : 1, pointerEvents: length === 'one-pager' ? 'none' : 'auto' }}>
            {ALL_SECTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setSelected(prev => {
                  const next = new Set(prev);
                  next.has(s) ? next.delete(s) : next.add(s);
                  return next;
                })}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-display text-left transition-all"
                style={
                  selected.has(s)
                    ? { background: 'rgba(31,77,43,0.1)', border: '1px solid rgba(31,77,43,0.3)', color: '#1F4D2B' }
                    : { background: 'transparent', border: '1px solid transparent', color: '#5C5040' }
                }
              >
                <span style={{ color: selected.has(s) ? '#1F4D2B' : '#5C5040' }}>
                  {selected.has(s) ? <Check size={10} /> : <Circle size={10} />}
                </span>
                {s}
              </button>
            ))}
          </div>

          {photoAnalysis && (
            <div className="mt-4 p-2.5 rounded-lg" style={{ background: 'rgba(31,77,43,0.06)', border: '1px solid rgba(31,77,43,0.2)' }}>
              <div className="text-xs font-display font-medium mb-0.5" style={{ color: '#1F4D2B' }}>Photos included</div>
              <div className="text-xs font-mono" style={{ color: '#5C5040' }}>Photo analysis will inform the report</div>
            </div>
          )}

          {/* Satellite capture status */}
          <div className="mt-3 p-2.5 rounded-lg" style={{ background: mapCapture ? 'rgba(31,77,43,0.06)' : 'rgba(226,216,196,0.4)', border: `1px solid ${mapCapture ? 'rgba(31,77,43,0.2)' : '#E2D8C4'}` }}>
            <div className="text-xs font-display font-medium mb-0.5" style={{ color: mapCapture ? '#1F4D2B' : '#8C7A62' }}>
              {mapCapture ? '✓ Aerial snapshot captured' : 'No aerial snapshot'}
            </div>
            {!mapCapture && (
              <div className="text-xs font-mono" style={{ color: '#8C7A62' }}>
                Close report → zoom into your site on the map → tap Capture → reopen
              </div>
            )}
          </div>
          {/* Generated TOC — appears once the report has content */}
          {report && (() => {
            const tocItems = report.split('\n')
              .filter(l => l.startsWith('## ') && !l.includes('Executive Summary'))
              .map(l => {
                const title = l.replace('## ', '');
                return { title, id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-') };
              });
            if (!tocItems.length) return null;
            return (
              <div className="mt-6 pt-4" style={{ borderTop: '1px solid #E2D8C4' }}>
                <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: '#5C5040' }}>
                  In this report
                </div>
                <div className="space-y-0.5">
                  {tocItems.map(({ title, id }) => (
                    <button
                      key={id}
                      onClick={() => {
                        // On a phone the report column is display:none while this
                        // panel is open — scrolling a hidden element does nothing,
                        // so show it first and scroll on the next frame.
                        setPanelOpen(false);
                        requestAnimationFrame(() => {
                          const el = reportRef.current?.querySelector(`#${id}`);
                          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        });
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-display transition-all"
                      style={{ color: '#5C5040', background: 'transparent', border: '1px solid transparent' }}
                      onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = '#20190F'; (e.target as HTMLButtonElement).style.background = 'rgba(226,216,196,0.3)'; }}
                      onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = '#5C5040'; (e.target as HTMLButtonElement).style.background = 'transparent'; }}
                    >
                      {title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* ── Report content ────────────────────── */}
        <div className="report-column flex-1 overflow-y-auto relative"
             ref={reportRef}
             style={{ display: showReportColumn ? 'block' : 'none' }}>
          {report && (
            <div
              style={{
                position: 'sticky', top: 0, left: 0, right: 0, height: 2,
                background: '#E2D8C4', zIndex: 10,
              }}
            >
              <div style={{
                height: '100%',
                background: 'linear-gradient(90deg, #1F4D2B, #2D6B3C)',
                width: loading ? '60%' : '100%',
                transition: 'width 1s ease',
              }} />
            </div>
          )}
          <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-8">

            {/* Print header */}
            <div className="print-header mb-8 pb-6" style={{ borderBottom: '2px solid #E2D8C4' }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-display font-bold text-3xl mb-1" style={{ letterSpacing: '-0.02em', color: '#20190F' }}>
                    ImbewuField
                  </div>
                  <div className="font-display text-base" style={{ color: '#20190F' }}>
                    Permaculture Site Analysis Report
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono" style={{ color: '#5C5040' }}>
                    {new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>
              </div>

              {/* Site summary bar */}
              {/* Two columns on a phone — six 60px-wide tiles wrap every value
                  onto its own line and read as noise. Desktop keeps one row. */}
              <div className={`mt-5 grid gap-3 grid-cols-2 ${['', '', 'md:grid-cols-2', 'md:grid-cols-3', 'md:grid-cols-4', 'md:grid-cols-5', 'md:grid-cols-6', 'md:grid-cols-7', 'md:grid-cols-8'][4 + (siteData ? 1 : 0) + (waterData ? 1 : 0) + (d.vegetation ? 1 : 0) + (d.bru ? 1 : 0)]}`}>
                {[
                  { label: 'Biome', value: ecology.label, color: bColor },
                  { label: 'Rainfall', value: `${d.rainfall.annual}mm/yr`, color: '#235E86' },
                  { label: 'Elevation', value: `${d.elevation.elevation}m · ${d.elevation.slopeDeg}°`, color: undefined },
                  { label: 'Soil pH', value: `pH ${d.soil.ph} · OC ${d.soil.organicCarbon}%`, color: d.soil.ph < 5.5 || d.soil.ph > 7.5 ? '#D4922A' : '#2D6B3C' },
                  ...(d.vegetation ? [{ label: 'Vegetation', value: d.vegetation.vegUnit, color: bColor }] : []),
                  ...(d.bru ? [{ label: 'BRU Zone', value: `${d.bru.brucode} · approx. ${d.bru.nearestBrg}`, color: bColor }] : []),
                  ...(siteData ? [{ label: 'Site Area', value: `${siteData.areaHa} ha`, color: '#2D6B3C' }] : []),
                  ...(waterData ? [{ label: 'Water Storage', value: `~${waterData.estVolumeKL.toLocaleString()} kL`, color: '#235E86' }] : []),
                ].map(({ label, value, color }) => (
                  <div key={label} className="p-3 rounded-xl" style={{ background: 'rgba(226,216,196,0.5)', border: '1px solid #E2D8C4' }}>
                    <div className="text-xs font-mono mb-0.5" style={{ color: '#5C5040' }}>{label}</div>
                    <div className="text-sm font-display font-semibold" style={{ color: color ?? '#20190F' }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Coords */}
              <div className="mt-3 text-xs font-mono" style={{ color: '#5C5040' }}>
                {Math.abs(d.lat).toFixed(4)}°S, {d.lon.toFixed(4)}°E · Köppen {d.climate.koppen} ({d.climate.koppenDesc}) ·
                {d.rainfall.pattern} rainfall · {d.rainfall.wetSeason} wet / {d.rainfall.drySeason} dry ·
                {d.climate.meanTemp}°C mean ({d.climate.minTemp}–{d.climate.maxTemp}°C)
              </div>

              {d.bru && (
                // Rainfall intentionally omitted from this footnote — the "Rainfall" summary tile above
                // is the single measured annual figure for this site; restating BRU's zone-average mm/yr
                // here reads as a second, conflicting rainfall claim for a non-expert reader.
                <div className="mt-1 text-xs font-mono" style={{ color: '#94876F' }}>
                  {d.bru.attribution} — BRU {d.bru.brucode} (parent {d.bru.bruParent}): {d.bru.tmean}°C mean ({d.bru.tmin}–{d.bru.tmax}°C).
                  Zone name &ldquo;{d.bru.nearestBrg}&rdquo; is a best-effort climate match, not a verified BRU→Bioresource Group crosswalk.
                </div>
              )}
            </div>

            {/* Saved places — GPS points for the farm (home, fields, water) */}
            {savedPlaces && savedPlaces.length > 0 && (
              <div className="mb-6 p-4 rounded-xl" style={{ background: 'rgba(226,216,196,0.5)', border: '1px solid #E2D8C4' }}>
                <div className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: '#5C5040' }}>
                  Saved Places · GPS Points
                </div>
                <div className="space-y-1.5">
                  {savedPlaces.map((p) => (
                    <div key={p.id} className="flex items-center gap-2.5 text-sm" style={{ color: '#20190F' }}>
                      <MapPin size={14} style={{ color: placeColor(p.label), flexShrink: 0 }} />
                      <span className="font-display font-semibold flex-1 min-w-0 truncate">{p.name}</span>
                      <span className="font-sans text-xs" style={{ color: '#8C7A62' }}>
                        {PLACE_LABELS.find((l) => l.v === p.label)?.name ?? 'Place'}
                      </span>
                      <span className="font-mono text-xs" style={{ color: '#5C5040' }}>
                        {Math.abs(p.lat).toFixed(5)}°S, {p.lon.toFixed(5)}°E
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Captured satellite view */}
            {mapCapture && (
              <div className="mb-6 p-4 rounded-xl" style={{ background: 'rgba(226,216,196,0.5)', border: '1px solid #E2D8C4' }}>
                <div className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: '#5C5040' }}>
                  Site Satellite View
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/jpeg;base64,${mapCapture}`}
                  alt="Captured satellite view of the site"
                  className="w-full rounded-lg"
                  style={{ border: '1px solid #E2D8C4' }}
                />
                <div className="text-xs font-mono mt-2" style={{ color: '#5C5040', opacity: 0.7 }}>
                  Maxar satellite imagery · {Math.abs(d.lat).toFixed(4)}°S {d.lon.toFixed(4)}°E
                </div>
              </div>
            )}

            {/* Rainfall chart in report */}
            <div className="mb-6 p-4 rounded-xl" style={{ background: 'rgba(226,216,196,0.5)', border: '1px solid #E2D8C4' }}>
              <div className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: '#5C5040' }}>
                Monthly Rainfall Pattern
              </div>
              <RainfallChart rainfall={d.rainfall} />
            </div>

            {/* Loading shimmer */}
            {loading && !report && (
              <div className="space-y-3 animate-pulse">
                {[60,90,75,50,85,70,40,95,65].map((w, i) => (
                  <div key={i} className="h-3 rounded" style={{ width: `${w}%`, background: 'rgba(226,216,196,0.6)', animationDelay: `${i*50}ms` }} />
                ))}
              </div>
            )}

            {error && (
              <div className="text-sm font-display p-4 rounded-xl" style={{ background: 'rgba(212,110,66,0.1)', border: '1px solid rgba(212,110,66,0.3)', color: '#D4922A' }}>
                {error}
              </div>
            )}

            {/* Generated report */}
            {report && (
              <div className="report-body">
                {renderReport(report)}
                {loading && <span className="inline-block w-2 h-4 rounded-sm animate-pulse ml-1" style={{ background: '#2D6B3C' }} />}
                {/* Print-only footer — hidden on screen */}
                <div className="print-footer" aria-hidden="true">
                  Generated by ImbewuField &mdash; imbewufield.vercel.app
                </div>
              </div>
            )}

            {/* Placeholder before generation */}
            {!report && !loading && !error && (
              <div className="text-center py-16">
                <div className="text-base font-display font-semibold mb-4" style={{ color: '#5C5040' }}>Report</div>
                <p className="font-display text-base mb-2" style={{ color: '#20190F' }}>
                  Select your sections and click Generate
                </p>
                <p className="font-display text-sm" style={{ color: '#5C5040' }}>
                  {selected.size} section{selected.size !== 1 ? 's' : ''} selected
                  {photoAnalysis ? ' · photos included' : ''}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Print stylesheet */}
      <style jsx global>{`
        /* ── Screen: hide the print-only footer ──────────────────────────── */
        .print-footer {
          display: none;
        }

        /* ══════════════════════════════════════════════════════════════════
           PRINT STYLES
           "Export PDF" no longer goes through window.print() — it builds the
           document with jsPDF (lib/report-pdf.ts) because window.print() is a
           silent no-op in an installed iOS PWA. These rules still matter for
           anyone printing from the browser's own menu on desktop.
        ══════════════════════════════════════════════════════════════════ */
        @media print {

          /* On a phone the report column is display:none while the settings
             panel is showing. A printed page must still contain the report. */
          .report-column {
            display: block !important;
            background: #ffffff !important;
          }

          /* Page geometry */
          @page {
            size: A4 portrait;
            margin: 18mm 16mm 20mm 16mm;
          }

          /* ── Global resets ─────────────────────────────────────────────── */
          *,
          *::before,
          *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }

          html,
          body {
            background: #ffffff !important;
            color: #111111 !important;
            font-size: 11pt !important;
          }

          /* ── Hide ALL interactive chrome ──────────────────────────────── */
          /* Toolbar row */
          .no-print,
          /* Any stray fixed/sticky UI that might not carry .no-print */
          [class*="toolbar"],
          [class*="sidebar"],
          [class*="language"],
          [class*="animate-spin"],
          [class*="animate-pulse"] {
            display: none !important;
          }

          /* ── Layout: let the report fill the page ─────────────────────── */
          /* The outer fixed-inset shell */
          .fixed,
          [style*="position: fixed"],
          [style*="position:fixed"] {
            position: static !important;
            overflow: visible !important;
            height: auto !important;
            width: auto !important;
            inset: unset !important;
            background: #ffffff !important;
          }

          /* Make the flex layout collapse sensibly */
          .flex-1,
          .overflow-y-auto,
          .overflow-hidden {
            overflow: visible !important;
            height: auto !important;
          }

          /* The centred report column */
          .max-w-3xl {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            background: #ffffff !important;
          }

          /* ── Colour corrections for white paper ───────────────────────── */
          /* CSS custom properties resolve to dark-mode values in the DOM;
             we override every token that appears in the report content. */
          :root {
            --bg-0: #ffffff !important;
            --bg-1: #ffffff !important;
            --bg-2: #ffffff !important;
            --bg-3: #f5f5f5 !important;
            --bg-4: #ececec !important;
            --border: #d0d0d0 !important;
            --border-bright: #b0b0b0 !important;
            --text-primary: #111111 !important;
            --text-secondary: #2a2a2a !important;
            --text-muted: #555555 !important;
            --emerald-bright: #1a5c30 !important;
            --emerald: #1a5c30 !important;
            --teal: #0d5c52 !important;
            --gold: #7a5500 !important;
            --blue: #1a3a6a !important;
            --orange: #8a3500 !important;
          }

          /* Report body text */
          .report-body,
          .report-body p,
          .report-body span,
          .report-body div {
            color: #111111 !important;
          }

          /* Headings */
          h2.report-h2 {
            color: #1a5c30 !important;
            border-bottom: 2px solid #c0c0c0 !important;
            font-size: 14pt !important;
            margin-top: 18pt !important;
            margin-bottom: 6pt !important;
          }

          h3 {
            color: #7a5500 !important;
            font-size: 12pt !important;
            margin-top: 12pt !important;
            margin-bottom: 4pt !important;
          }

          /* Prose paragraphs */
          .report-body > p,
          .report-body .font-display {
            color: #111111 !important;
            font-size: 10.5pt !important;
            line-height: 1.55 !important;
          }

          /* Bullet / numbered list row items */
          .report-body .flex {
            color: #111111 !important;
          }

          /* Tables */
          table {
            font-size: 9.5pt !important;
          }
          thead tr {
            border-bottom: 1.5px solid #b0b0b0 !important;
          }
          th {
            color: #444444 !important;
            font-weight: 700 !important;
          }
          td {
            color: #111111 !important;
          }
          /* Alternate-row tint → very light grey, no dark bg */
          tbody tr:nth-child(even) {
            background: #f2f2f2 !important;
          }
          tbody tr:nth-child(odd) {
            background: #ffffff !important;
          }

          /* Site summary cards */
          .print-header .rounded-xl {
            background: #f0f0f0 !important;
            border: 1px solid #cccccc !important;
          }

          /* Satellite image + rainfall chart containers */
          .mb-6.rounded-xl {
            background: #f5f5f5 !important;
            border: 1px solid #cccccc !important;
            break-inside: avoid !important;
          }

          /* ── Page-break rules ─────────────────────────────────────────── */

          /* Prevent headings from sitting alone at the bottom of a page */
          h2.report-h2,
          h3 {
            break-after: avoid !important;
            page-break-after: avoid !important;
          }

          /* Prevent headings from breaking inside (shouldn't happen but safety) */
          h2.report-h2,
          h3 {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          /* Keep list items together; a single item is rarely more than 2 lines */
          .report-body .flex {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          /* Tables should never split mid-row; small tables avoid breaking at all */
          table {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          /* The overflow wrapper around each table */
          .overflow-x-auto {
            overflow: visible !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          /* Print-header block stays on the first page */
          .print-header {
            break-after: avoid !important;
            page-break-after: avoid !important;
          }

          /* ── Images: rainfall chart + satellite ───────────────────────── */
          img {
            max-width: 100% !important;
            width: 100% !important;
            height: auto !important;
            display: block !important;
            object-fit: contain !important;
          }

          /* Constrain the rainfall chart SVG */
          svg,
          canvas {
            max-width: 100% !important;
            height: auto !important;
          }

          /* ── Print-only footer ────────────────────────────────────────── */
          .print-footer {
            display: block !important;
            margin-top: 32pt !important;
            padding-top: 8pt !important;
            border-top: 1px solid #cccccc !important;
            font-family: var(--font-mono), monospace !important;
            font-size: 8pt !important;
            color: #888888 !important;
            text-align: center !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { LocationData, SiteData, WaterData } from '@/lib/types';
import ReportVisualOverview from './report/ReportVisualOverview';
import { siteReportVisuals } from '@/lib/report-visuals';
import { prepareVisualPdfAssets } from '@/lib/report-visual-pdf';
import styles from './ReportView.module.css';
import { loadReports, saveReport, deleteReport, reportId, MAX_REPORTS, type SavedReport, type SaveReportReason } from '@/lib/saved-reports';
import { isSampleMode } from '@/lib/sample-mode';
import { PLACE_LABELS, placeColor, type SavedPlace } from '@/lib/saved-places';
import { Loader2, Check, Circle, ChevronRight, Share2, MapPin, SlidersHorizontal, FileText } from 'lucide-react';
import { buildReportPdf, deliverPdf, reportPdfFilename, sheetPlate, stripInlineMarkdown } from '@/lib/report-pdf';
import { resolveSiteEcology } from '@/lib/site-ecology';
import { loadSheetMetas, loadSheetImage } from '@/lib/sheet-store';
import { selectReportPlates, type ReportPlate } from '@/lib/report-plates';
import { prepareSiteAnalysisImages } from '@/lib/report-site-images';
import { PLAN_VERSION } from '@/lib/plan-version';
import { SHEET_RENDER_RECIPE } from '@/lib/sheet-render-recipe';
import { loadSurvey } from '@/lib/site-survey';
import { evidenceSiteId, getSiteEvidence } from '@/lib/site-evidence';
import { groundPhotoGallery, prepareGroundPhotos, type GroundPhotoView } from '@/lib/report-ground-photos';
import { designSiteIdFromLocation } from '@/lib/design-studio';
import { loadCanvasState } from '@/lib/design-canvas';
import { resolveBaseLayers } from '@/lib/base-layers';
import { buildPhasePlan } from '@/lib/phasing';
import { collectReportSiteFacts } from '@/lib/report-site-facts-collect';
import type { ReportSiteFacts } from '@/lib/report-site-facts';
import { reportSummaryPages, buildInkSummaryPdf, sampleFullSiteReport } from '@/lib/report-summary';
import { CROPS } from '@/lib/crop-catalog';
import { getCropArt } from '@/lib/crop-art';
import { REPORT_ZU } from '@/lib/report-localisation';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { recordReportAttempt, reportAttemptSurvived, reportShouldGoLight } from '@/lib/report-attempts';

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
            <div className="font-display font-bold text-lg mb-1" style={{ color: 'var(--report-green)' }}>
              Executive Summary
            </div>
          </div>
        ) : (
          <h2 key={i} id={headingId} className="report-h2 font-display font-bold text-xl mt-10 mb-3 pt-4 pb-2 flex items-center gap-3"
              style={{ color: 'var(--report-green)', borderBottom: '1px solid var(--report-border)' }}>
            <span style={{ display: 'inline-block', width: 3, height: 20, borderRadius: 2, background: 'var(--report-gold)', flexShrink: 0 }} />
            {heading}
          </h2>
        )
      );
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="font-display font-semibold text-base mt-5 mb-2" style={{ color: 'var(--report-gold)' }}>
          {line.replace('### ', '')}
        </h3>
      );
    } else if (line.startsWith('# ')) {
      // The document title. It used to fall through to the paragraph branch and print its own
      // literal "# " on screen; now that the title carries the farm's name it is the first thing
      // a reader sees, so it renders as a title.
      elements.push(
        <h1 key={i} className="font-display font-bold text-2xl mt-1 mb-1" style={{ color: 'var(--report-ink)' }}>
          {stripInlineMarkdown(line.slice(2))}
        </h1>
      );
    } else if (line.startsWith('**') && line.endsWith('**')) {
      elements.push(
        <p key={i} className="font-display font-semibold text-sm mt-3 mb-1" style={{ color: 'var(--report-ink)' }}>
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
              <tr style={{ borderBottom: '1px solid var(--report-border)' }}>
                {headers.map((h, j) => (
                  <th key={j} className="text-left py-2 px-3 font-semibold" style={{ color: 'var(--report-muted)' }}>
                    {h.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: '1px solid var(--report-border)', background: ri % 2 === 0 ? 'transparent' : 'rgba(31,77,43,0.04)' }}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="py-2 px-3 leading-relaxed font-sans" style={{ color: 'var(--report-ink)' }}>
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
            <span className="font-display font-bold text-sm flex-shrink-0 w-5 text-right" style={{ color: 'var(--report-gold)' }}>{match[1]}.</span>
            <div>
              <span className="font-display font-semibold text-sm" style={{ color: 'var(--report-green)' }}>{match[2]}</span>
              {match[3] && <span className="font-sans text-sm leading-relaxed" style={{ color: 'var(--report-ink)' }}>{match[3]}</span>}
            </div>
          </div>
        );
      }
    } else if (line.match(/^\d+\./)) {
      elements.push(
        <div key={i} className="flex gap-3 my-1.5">
          <span className="font-display font-semibold text-sm flex-shrink-0 w-5 text-right" style={{ color: 'var(--report-gold)' }}>
            {line.match(/^\d+/)?.[0]}.
          </span>
          <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--report-ink)' }}>
            {stripInlineMarkdown(line.replace(/^\d+\.\s*/, ''))}
          </p>
        </div>
      );
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      elements.push(
        <div key={i} className="flex gap-2 my-1">
          <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--report-green)' }}><ChevronRight size={12} /></span>
          <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--report-ink)' }}>
            {stripInlineMarkdown(line.replace(/^[-•]\s*/, ''))}
          </p>
        </div>
      );
    } else {
      elements.push(
        <p key={i} className="font-sans text-sm leading-relaxed my-1.5" style={{ color: 'var(--report-ink)' }}>
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
  const [facts, setFacts] = useState<ReportSiteFacts | null>(savedReport?.facts ?? null);
  const [reading, setReading] = useState<'full' | 'one' | 'five'>('full');
  const [presentation, setPresentation] = useState<'screen' | 'colour' | 'print'>('screen');
  const [includeImages, setIncludeImages] = useState(true);
  const tr = (en: string, zu: string) => language === 'zu' ? zu : en;
  const label = (en: string) => language === 'zu' ? REPORT_ZU[en] ?? en : en;
  const showVisuals = reading === 'full' && (presentation !== 'print' || includeImages);
  const visuals = siteReportVisuals(facts, d, language);
  const reportDate = activeSaved?.savedAt ?? new Date().toISOString();
  const summaryPages = reportSummaryPages(facts, d, reading === 'one' ? 1 : 5, language);
  useEffect(() => {
    if (activeSaved) { setFacts(activeSaved.facts ?? null); return; }
    const siteId = designSiteIdFromLocation(d);
    setFacts(collectReportSiteFacts({ siteId, lat: d.lat, lon: d.lon, canvas: loadCanvasState(siteId), farmName: savedPlaces?.find(p => p.id === activePlaceId)?.name }));
  }, [activeSaved, d, savedPlaces, activePlaceId]);
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

  // ── The farm's own maps, in the report a farmer READS ──────────────────────
  //
  // The design sheets have been going into the exported PDF as an appendix since #174, and the
  // report on screen still had none — which is what "i generated a report there is still no images"
  // is describing. A farmer who never presses Export never sees their plan in their report.
  //
  // Thumbnails only, held in state; the print-resolution master (1–3 MB per sheet) is fetched on
  // demand when a sheet is opened and dropped when it closes. That is lib/sheet-store's memory
  // contract, and this screen runs on the same phone the gallery had to be rewritten for.
  const [plates, setPlates] = useState<Array<ReportPlate & { thumb?: string }>>([]);
  const [openPlate, setOpenPlate] = useState<{ label: string; image: string } | null>(null);

  // The farmer's own photographs of the ground, and how many they have in total. Read on mount
  // rather than memoised on a value, because localStorage is where they live and nothing in this
  // component's props changes when one is added. No memory contract to observe: these are the
  // ≤400px thumbnails site-evidence stores, so the whole strip is a few hundred KB, unlike a
  // print-resolution plan sheet.
  const [photoGallery, setPhotoGallery] = useState<{ shown: GroundPhotoView[]; total: number }>({ shown: [], total: 0 });
  useEffect(() => {
    setPhotoGallery(groundPhotoGallery(getSiteEvidence(evidenceSiteId(activePlaceId))));
  }, [activePlaceId]);

  const siteKey = designSiteIdFromLocation(d);
  useEffect(() => {
    let cancelled = false;
    void loadSheetMetas(siteKey)
      .catch(() => [])
      .then((metas) => {
        if (cancelled) return;
        const chosen = selectReportPlates(metas, PLAN_VERSION, SHEET_RENDER_RECIPE);
        const thumbById = new Map(metas.map((m) => [m.id, m.thumb]));
        setPlates(chosen.map((p) => ({ ...p, thumb: thumbById.get(p.id) })));
      });
    return () => { cancelled = true; };
  }, [siteKey]);

  const openSheet = useCallback(async (plate: ReportPlate) => {
    const image = await loadSheetImage(plate.id).catch(() => null);
    if (image) setOpenPlate({ label: plate.label, image });
  }, []);
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
  const sampleReportSeeded = useRef(false);
  useEffect(() => {
    if (!isSampleMode() || savedReport || !facts || sampleReportSeeded.current) return;
    sampleReportSeeded.current = true;
    setReport(sampleFullSiteReport(facts, d, language));
    setGenerated(true);
    setIncludeImages(true);
    setPanelOpen(false);
  }, [facts, d, language, savedReport]);

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
      facts: facts ?? undefined,
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
  }, [report, activeSaved, d, siteData, waterData, language, facts]);

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
    setFacts(r.facts ?? null);
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

  // True when THIS generate skipped the plan-sheet images because the last attempts killed the
  // page — see lib/report-attempts.ts. Drives one honest line of UI, nothing else.
  const [wentLight, setWentLight] = useState(false);

  const generate = useCallback(async () => {
    if (isSampleMode()) {
      const siteId = designSiteIdFromLocation(d);
      const currentFacts = collectReportSiteFacts({ siteId, lat: d.lat, lon: d.lon, canvas: loadCanvasState(siteId), farmName: savedPlaces?.find(place => place.id === activePlaceId)?.name });
      setFacts(currentFacts);
      setReport(sampleFullSiteReport(currentFacts, d, language));
      setGenerated(true);
      setReading('full');
      setError('');
      collapsePanelOnNarrow();
      return;
    }
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
      // "EVEN IF I TRY AND GENERATE A REPORT IT CRASHES." The page-level crash guards cannot see
      // this — a generate crash lands minutes after the page settled, on a clean record. So the
      // generate flow keeps its own streak: recorded here BEFORE the heavy work, cleared in the
      // finally below on any outcome the page survives. Only a death mid-generate lets it grow,
      // and past the threshold this attempt skips the plan-sheet images — the one step that
      // decodes megapixel bitmaps — while the 400px ground photos still go.
      const attempt = recordReportAttempt(window.localStorage);
      const light = reportShouldGoLight(attempt);
      setWentLight(light);

      // THE PHOTOS GO WITH IT NOW.
      //
      // This block used to open "strip base64 thumbnails — send counts + notes only", and that
      // one line was the whole of Rory's "there is still no images … the report needs to draw
      // analyses from these images". The model was handed `soil_compaction: 2 items` and asked to
      // write about the soil. The counts and notes are still sent — they cover all 52 tiles and
      // every note, which four photographs cannot — but the photographs now go too.
      //
      // And the site id is resolved through evidenceSiteId at BOTH ends. It used to be read here
      // as `activePlaceId` and written in DataPanel as `activePlaceId ?? 'default'`, so a farmer
      // who had not tapped a saved place filed every photo under `default` and then generated a
      // report that read an empty object — silently, with no error and no missing-photo notice.
      const rawEvidence = getSiteEvidence(evidenceSiteId(activePlaceId));
      const groundPhotos = prepareGroundPhotos(rawEvidence);
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
      setFacts(siteFacts);

      // THE MODEL LOOKS AT THE PLAN, NOT ONLY AT NUMBERS ABOUT IT. siteFacts above carries the
      // geometry as figures; these are the drawings those figures came off, downsized for a vision
      // model. Rory, on the audit: the report "needs to also draw analyses from these images, not
      // generic zone information". Prepared one sheet at a time and skipped entirely on failure —
      // a report the model could not look at is still a report. See lib/report-site-images.ts.
      const siteImages = light
        ? []
        : await prepareSiteAnalysisImages(plates, loadSheetImage, sheetPlate).catch(() => []);

      const res = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await paidApiHeaders() },
        body: JSON.stringify({
          locationData: d,
          photoAnalysis: photoAnalysis || undefined,
          siteData: siteData || undefined,
          waterData: waterData || undefined,
          siteFacts,
          siteImages: siteImages.length ? siteImages : undefined,
          groundPhotos: groundPhotos.length ? groundPhotos : undefined,
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
      if (err instanceof Error && err.name !== 'AbortError') {
        // A dead connection surfaces as TypeError('Failed to fetch') (Chrome) or 'Load failed'
        // (Safari) — browser jargon that tells a farmer nothing. Say the true thing in her
        // words. navigator.onLine alone is not trusted (it lies on captive portals), so the
        // message shape is matched too.
        const offline = typeof navigator !== 'undefined' && !navigator.onLine;
        const networkShaped = /failed to fetch|load failed|network/i.test(err.message);
        setError(offline || networkShaped
          ? 'No signal — writing the report needs internet. Your section choices are kept; try again when you have bars.'
          : err.message);
      }
    } finally {
      // The page is alive to run this line, which is the entire test. Success, an HTTP error and
      // a cancel all clear the streak — they are disappointments, not deaths, and escalating a
      // network error into "your phone cannot generate reports" would be its own bug.
      reportAttemptSurvived(window.localStorage);
      setLoading(false);
    }
  }, [d, photoAnalysis, siteData, waterData, savedPlaces, activePlaceId, selected, language, bilingual, tone, length, plates, collapsePanelOnNarrow]);

  // "Export PDF". This used to be window.print(), which is a silent no-op in an
  // installed iOS PWA (manifest display: standalone) — the button looked dead on
  // a phone and threw nothing anyone could catch. We build the PDF ourselves and
  // hand it to the device. See lib/report-pdf.ts.
  const exportPdf = useCallback(async () => {
    if (!report && reading === 'full') return;
    setPdfState('working');
    try {
      if (reading !== 'full') {
        const blob = await buildInkSummaryPdf(reportSummaryPages(facts, d, reading === 'one' ? 1 : 5, language), (activeSaved?.savedAt ?? new Date().toISOString()).slice(0, 10), language);
        await deliverPdf(blob, reportPdfFilename(ecology.placeName).replace('.pdf', `-${reading === 'one' ? '1' : '5'}-page-summary.pdf`));
        setPdfState('done');
        setTimeout(() => setPdfState('idle'), 2500);
        return;
      }
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
      const plates = selectReportPlates(sheetMetas, PLAN_VERSION, SHEET_RENDER_RECIPE);
      const blob = await buildReportPdf(report, {
        visuals: presentation !== 'print' ? visuals : undefined,
        visualAssets: presentation !== 'print' ? await prepareVisualPdfAssets(visuals, includeImages ? [
          ...(photoGallery.shown[0] ? [{ image: photoGallery.shown[0].dataUrl, caption: `${photoGallery.shown[0].label} · Current site evidence; it may postdate saved report text.` }] : mapCapture && !activeSaved ? [{ image: `data:image/jpeg;base64,${mapCapture}`, caption: 'Captured site satellite view' }] : []),
        ] : [], includeImages ? (facts?.crop?.crops ?? []).flatMap(c => {
          const crop = CROPS.find(x => x.name === c.name);
          const image = crop ? getCropArt(crop.key) : undefined;
          return image ? [{ image, caption: `${c.name} · ${c.sowMonths.join(', ')}` }] : [];
        }) : []) : undefined,
        biome: ecology.placeName,
        lat: d.lat,
        lon: d.lon,
        rainfallMm: d.rainfall.annual,
        soilPh: d.soil.soilSource === 'lab' || d.soil.soilSource === 'soilgrids' ? d.soil.ph : undefined,
        language,
        meanTempC: d.climate.meanTemp,
        dateLabel: new Date(reportDate).toLocaleDateString(language === 'zu' ? 'zu-ZA' : 'en-ZA', { year: 'numeric', month: 'long', day: 'numeric' }),
        sheets: includeImages ? plates : [],
        loadSheetImage,
        // The same photographs the model read and the screen shows — so the printed report a
        // farmer hands to a funder carries the evidence the advice was drawn from.
        photos: includeImages ? photoGallery.shown.map((p) => ({ label: p.label, note: p.note, dataUrl: p.dataUrl })) : [],
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
  }, [report, d, reading, language, facts, includeImages, activeSaved, ecology.placeName, photoGallery, reportDate, presentation, mapCapture]);

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
    <div className={`${styles.workspace} ${presentation === 'print' ? styles.printPreview : ''} fixed inset-0 z-50 flex flex-col`} data-report-print={presentation === 'print' ? 'ink' : 'colour'}>

      {/* ── Toolbar ──────────────────────────────────────────────────────────
          Wraps rather than scrolls. At 375px the old single non-wrapping row was
          731px wide, so Share and Generate sat off-screen with no way to reach
          them (the row was not scrollable either). Title and actions are now two
          wrapping groups: every control stays on screen at any width.
      */}
      <div
        className={`${styles.toolbar} no-print flex-shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 md:px-6 py-2.5 md:py-3`}
        style={{ background: 'var(--report-panel)', borderBottom: '1px solid var(--report-border)' }}
      >
        <button onClick={onClose} className="text-xs font-mono px-3 py-1.5 rounded-lg transition-all flex-shrink-0"
                style={{ color: 'var(--report-muted)', background: 'var(--report-panel)', border: '1px solid var(--report-border)' }}>
          Back
        </button>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-display font-semibold truncate" style={{ color: 'var(--report-ink)' }}>
            {tr('Site Analysis Report', 'Umbiko wokuhlola indawo')}
          </div>
          <div className="text-xs font-mono truncate" style={{ color: 'var(--report-muted)' }}>
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
              ? { background: 'rgba(31,77,43,0.15)', border: '1px solid rgba(31,77,43,0.4)', color: 'var(--report-green)' }
              : { background: 'var(--report-panel)', border: '1px solid var(--report-border)', color: 'var(--report-muted)' }}
          >
            {panelOpen && (report || reading !== 'full')
              ? <><FileText size={12} />{tr('Report', 'Umbiko')}</>
              : <><SlidersHorizontal size={12} />{tr('Settings', 'Izilungiselelo')}</>}
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
                ? { background: 'rgba(31,77,43,0.15)', border: '1px solid rgba(31,77,43,0.4)', color: 'var(--report-green)' }
                : { background: 'rgba(31,77,43,0.1)', border: '1px solid rgba(31,77,43,0.3)', color: 'var(--report-green)' }}
            >
              {saveFailed
                ? (saveFailedReason === 'store-full'
                    ? `You have ${MAX_REPORTS} saved reports — delete one to save this`
                    : 'Not saved — no space')
                : justSaved ? (isSampleMode() ? 'Demo — not saved' : 'Saved') : 'Save'}
            </button>
          )}

          {(generated || reading !== 'full') && (
            <button
              onClick={exportPdf}
              disabled={pdfState === 'working'}
              className="flex items-center gap-1.5 px-3 md:px-4 py-1.5 rounded-lg text-xs font-display font-medium transition-all"
              style={{
                background: 'linear-gradient(135deg, rgba(192,122,30,0.15), rgba(192,122,30,0.06))',
                border: '1px solid rgba(192,122,30,0.35)',
                color: 'var(--report-gold)',
                opacity: pdfState === 'working' ? 0.6 : 1,
              }}
            >
              {pdfState === 'working' && <Loader2 size={12} className="animate-spin" />}
              {label(pdfState === 'working' ? 'Building…' : pdfState === 'done' ? 'PDF ready' : 'Export PDF')}
            </button>
          )}

          {generated && (
            <button
              onClick={shareReport}
              className="flex items-center gap-1.5 px-3 md:px-4 py-1.5 rounded-lg text-xs font-display font-medium transition-all"
              style={{
                background: copied ? 'rgba(35,94,134,0.15)' : 'rgba(35,94,134,0.08)',
                border: '1px solid rgba(35,94,134,0.3)',
                color: 'var(--report-blue)',
              }}
            >
              <Share2 size={12} />{label(copied ? 'Copied!' : 'Share')}
            </button>
          )}


        </div>
      </div>

      <div className={`${styles.readingControls} no-print`}>
          <button
            onClick={generate}
            disabled={loading || selected.size === 0}
            className="flex items-center gap-1.5 px-3 md:px-4 py-1.5 rounded-lg text-xs font-display font-semibold transition-all"
            style={
              loading || selected.size === 0
                ? { background: 'rgba(226,216,196,0.6)', color: 'var(--report-muted)', border: '1px solid var(--report-border)' }
                : {
                    background: 'var(--report-button)',
                    border: '1px solid rgba(31,77,43,0.6)',
                    color: '#F7F2E9',
                    boxShadow: '0 0 16px rgba(31,77,43,0.2)',
                  }
            }
          >
            {loading ? <><Loader2 size={14} className="animate-spin inline mr-1" /> Generating...</> : label(generated ? 'Generate new report' : 'Generate report')}
          </button>
        <div><button aria-pressed={presentation === 'screen'} onClick={() => { setPresentation('screen'); setIncludeImages(true); }}>{tr('Screen', 'Isikrini')}</button><button aria-pressed={presentation === 'colour'} onClick={() => { setPresentation('colour'); setIncludeImages(true); }}>{tr('Print · full colour', 'Phrinta · imibala egcwele')}</button><button aria-pressed={presentation === 'print'} onClick={() => { setPresentation('print'); setIncludeImages(false); }}>{tr('Print · save ink', 'Phrinta · yonga uyinki')}</button></div>
        <div>{([['one', '1-page summary', 'Isifinyezo sekhasi elilodwa'], ['five', '5-page summary', 'Isifinyezo samakhasi amahlanu'], ['full', 'Full report', 'Umbiko ogcwele']] as const).map(([value, en, zu]) => <button key={value} aria-pressed={reading === value} onClick={() => { setReading(value); setPanelOpen(false); }}>{tr(en, zu)}</button>)}</div>
        {reading === 'full' && <label><input type="checkbox" checked={includeImages} onChange={e => setIncludeImages(e.target.checked)} /> {tr('Include photos and maps in PDF', 'Faka izithombe namamephu ku-PDF')}</label>}
      </div>
      {isSampleMode() && <p className={`${styles.languageNote} no-print`}>Ready-to-read sample report. Generate new report refreshes the complete record from your practice design; no live AI request is made. Language and advice settings apply to live AI reports; sample wording is an English reference with translated summaries where available.</p>}
      {language !== (activeSaved?.lang ?? appLang ?? 'en') && report && reading === 'full' && <p className={`${styles.languageNote} no-print`}>{tr('Language changes apply to new reports and summaries. Regenerate to translate the full advice.', 'Ushintsho lolimi lusebenza emibikweni emisha nasezifinyezweni. Khiqiza kabusha ukuhumusha zonke izeluleko.')}</p>}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Section controls sidebar ───────────
            Desktop: a fixed 232px column beside the report (unchanged).
            Phone: full width, and only one of the two is displayed at a time.
            Both stay mounted so reportRef and the report's scroll position
            survive toggling. */}
        <div className={`${styles.sidebar} no-print flex-shrink-0 overflow-y-auto py-4 px-3`}
             style={{
               width: isWide ? 256 : '100%',
               display: showPanel ? 'block' : 'none',
               background: 'var(--report-paper)',
               borderRight: isWide ? '1px solid var(--report-border)' : 'none',
             }}>

          {/* Phone: the report is the primary read once it exists */}
          {!isWide && (report || reading !== 'full') && (
            <button
              onClick={() => setPanelOpen(false)}
              className="w-full flex items-center justify-center gap-2 mb-4 py-2.5 rounded-lg text-sm font-display font-semibold"
              style={{ background: 'var(--report-button)', color: '#F7F2E9', border: 'none' }}
            >
              <FileText size={14} />{label('Read the report')}
            </button>
          )}

          {/* Saved reports — reopen a past report without regenerating */}
          {savedList.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--report-muted)' }}>{label('Saved reports')}</div>
              <div className="flex flex-col gap-1.5">
                {savedList.map((r) => (
                  <div key={r.id} className="flex items-center gap-1 rounded-lg" style={{ background: 'var(--report-panel)', border: '1px solid var(--report-border)' }}>
                    <button onClick={() => openSaved(r)}
                      className="flex-1 min-w-0 text-left px-2.5 py-1.5 rounded-lg"
                      style={{ color: activeSaved?.id === r.id ? 'var(--report-green)' : 'var(--report-ink)' }}>
                      <div className="text-xs font-display truncate">{r.name}</div>
                    </button>
                    <button onClick={() => deleteReport(r.id)} title="Delete"
                      className="px-2 py-1.5 text-xs font-display" style={{ color: 'var(--report-muted)' }}>Delete</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Language */}
          <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--report-muted)' }}>{label('Language')}</div>
          <select
            value={language}
            onChange={(e) => { setLanguage(e.target.value); if (e.target.value === 'en') setBilingual(false); }}
            className="w-full text-xs font-display rounded-lg px-2.5 py-1.5 mb-2 outline-none cursor-pointer"
            style={{ background: 'var(--report-panel)', border: '1px solid var(--report-border)', color: 'var(--report-ink)' }}
          >
            {LANGUAGE_OPTIONS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          {language !== 'en' && (
            <button
              onClick={() => setBilingual(!bilingual)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 mb-4 rounded-lg text-xs font-display transition-all"
              style={bilingual
                ? { background: 'rgba(45,107,60,0.12)', border: '1px solid rgba(45,107,60,0.35)', color: 'var(--report-green)' }
                : { background: 'var(--report-panel)', border: '1px solid var(--report-border)', color: 'var(--report-muted)' }}
            >
              <span>{tr('+ English alongside', '+ IsiNgisi eceleni')}</span>
              <span>{bilingual ? <Circle size={12} fill="currentColor" /> : <Circle size={12} />}</span>
            </button>
          )}

          {/* Tone */}
          <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--report-muted)' }}>{label('Wording')}</div>
          <div className="flex gap-1.5 mb-4">
            {([['simple', 'Simple'], ['professional', 'Detailed']] as const).map(([val, label]) => (
              <button key={val} onClick={() => setTone(val)}
                className="flex-1 py-1.5 rounded-lg text-xs font-display transition-all"
                style={tone === val
                  ? { background: 'rgba(31,77,43,0.1)', border: '1px solid rgba(31,77,43,0.3)', color: 'var(--report-green)' }
                  : { background: 'var(--report-panel)', border: '1px solid var(--report-border)', color: 'var(--report-muted)' }}>
                {language === 'zu' ? REPORT_ZU[label] ?? label : label}
              </button>
            ))}
          </div>

          {/* Length */}
          <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--report-muted)' }}>{label('Length')}</div>
          <div className="flex flex-col gap-1.5 mb-4">
            {([
              ['one-pager', 'Brief advice', 'Generate brief advice. Use 1-page summary above for a fixed-length PDF.'] as const,
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
                  ? { background: 'rgba(192,122,30,0.1)', border: '1px solid rgba(192,122,30,0.3)', color: 'var(--report-gold)' }
                  : { background: 'var(--report-panel)', border: '1px solid var(--report-border)', color: 'var(--report-muted)' }}>
                {language === 'zu' ? REPORT_ZU[label] ?? label : label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--report-muted)' }}>{label('Sections')}</div>
            <div className="flex gap-1">
              <button onClick={() => setSelected(new Set(FARMER_ESSENTIALS))}
                className="text-xs font-mono px-1.5 py-0.5 rounded transition-all"
                style={{ color: 'var(--report-green)', background: 'rgba(31,77,43,0.1)', border: '1px solid rgba(31,77,43,0.2)' }}
                title="Select the sections most useful to a small-scale farmer">
                {tr('Farmer', 'Umlimi')}
              </button>
              <button onClick={() => setSelected(new Set(ALL_SECTIONS))}
                className="text-xs font-mono px-1.5 py-0.5 rounded transition-all"
                style={{ color: 'var(--report-muted)', background: 'var(--report-panel)', border: '1px solid var(--report-border)' }}
                title="Select all sections">
                {tr('All', 'Zonke')}
              </button>
              <button onClick={() => setSelected(new Set())}
                className="text-xs font-mono px-1.5 py-0.5 rounded transition-all"
                style={{ color: 'var(--report-danger)', background: 'rgba(155,64,64,0.1)', border: '1px solid rgba(155,64,64,0.2)' }}
                title="Deselect all sections">
                {tr('None', 'Azikho')}
              </button>
            </div>
          </div>
          {length === 'one-pager' && (
            <div className="text-xs font-mono px-2 py-1.5 rounded-lg mb-1" style={{ background: 'rgba(192,122,30,0.08)', border: '1px solid rgba(192,122,30,0.25)', color: 'var(--report-gold)' }}>
              {tr('Brief advice = Executive Summary only. Use the summary controls above to choose a fixed page count.', 'Izeluleko ezimfushane = isifinyezo kuphela. Khetha inani lamakhasi ezinkinobheni zesifinyezo ezingenhla.')}
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
                    ? { background: 'rgba(31,77,43,0.1)', border: '1px solid rgba(31,77,43,0.3)', color: 'var(--report-green)' }
                    : { background: 'transparent', border: '1px solid transparent', color: 'var(--report-muted)' }
                }
              >
                <span style={{ color: selected.has(s) ? 'var(--report-green)' : 'var(--report-muted)' }}>
                  {selected.has(s) ? <Check size={10} /> : <Circle size={10} />}
                </span>
                {label(s)}
              </button>
            ))}
          </div>

          {photoAnalysis && (
            <div className="mt-4 p-2.5 rounded-lg" style={{ background: 'rgba(31,77,43,0.06)', border: '1px solid rgba(31,77,43,0.2)' }}>
              <div className="text-xs font-display font-medium mb-0.5" style={{ color: 'var(--report-green)' }}>{label('Photos included')}</div>
              <div className="text-xs font-mono" style={{ color: 'var(--report-muted)' }}>{label('Photo analysis will inform the report')}</div>
            </div>
          )}

          {/* Satellite capture status */}
          <div className="mt-3 p-2.5 rounded-lg" style={{ background: mapCapture ? 'rgba(31,77,43,0.06)' : 'rgba(226,216,196,0.4)', border: `1px solid ${mapCapture ? 'rgba(31,77,43,0.2)' : 'var(--report-border)'}` }}>
            <div className="text-xs font-display font-medium mb-0.5" style={{ color: mapCapture ? 'var(--report-green)' : 'var(--report-muted)' }}>
              {mapCapture ? tr('✓ Aerial snapshot captured', '✓ Isithombe sasemoyeni sigciniwe') : tr('No aerial snapshot', 'Asikho isithombe sasemoyeni')}
            </div>
            {!mapCapture && (
              <div className="text-xs font-mono" style={{ color: 'var(--report-muted)' }}>
                {tr('Close report → zoom into your site on the map → tap Capture → reopen', 'Vala umbiko → sondeza indawo ebalazweni → thepha Capture → uvule umbiko futhi')}
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
              <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--report-border)' }}>
                <div className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--report-muted)' }}>
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
                      style={{ color: 'var(--report-muted)', background: 'transparent', border: '1px solid transparent' }}
                      onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = 'var(--report-ink)'; (e.target as HTMLButtonElement).style.background = 'var(--report-panel)'; }}
                      onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = 'var(--report-muted)'; (e.target as HTMLButtonElement).style.background = 'transparent'; }}
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
        <div className={`${styles.column} report-column flex-1 overflow-y-auto relative`}
             ref={reportRef}
             style={{ display: showReportColumn ? 'block' : 'none' }}>
          {report && (
            <div
              style={{
                position: 'sticky', top: 0, left: 0, right: 0, height: 2,
                background: 'var(--report-border)', zIndex: 10,
              }}
            >
              <div style={{
                height: '100%',
                background: 'linear-gradient(90deg, var(--report-green), var(--report-green))',
                width: loading ? '60%' : '100%',
                transition: 'width 1s ease',
              }} />
            </div>
          )}
          <div className={styles.document}>

            {/* Print header */}
            <div className="print-header mb-8 pb-6" hidden={reading !== 'full' || presentation !== 'print'} style={{ borderBottom: '2px solid var(--report-border)' }}>
              <div className={`${styles.coverTitle} flex items-start justify-between gap-4`}>
                <div>
                  <div className={`${styles.brand} font-sans font-semibold`}>
                    ImbewuField
                  </div>
                  <div className={`${styles.title} font-display font-bold`}>
                    {label('Permaculture Site Analysis Report')}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`${styles.date} font-sans`}>
                    {new Date(reportDate).toLocaleDateString(language === 'zu' ? 'zu-ZA' : 'en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>
              </div>

              {/* Site summary bar */}
              {/* Four readable tiles per row on desktop, two on smaller screens. */}
              <div className={styles.summaryGrid}>
                {[
                  { label: label('Biome'), value: ecology.label, color: bColor },
                  { label: label('Rainfall'), value: `${d.rainfall.annual}mm/yr`, color: 'var(--report-blue)' },
                  { label: label('Elevation'), value: `${d.elevation.elevation}m · ${d.elevation.slopeDeg}°`, color: undefined },
                  { label: label('Soil pH'), value: d.soil.soilSource === 'estimate' || !d.soil.soilSource ? tr('Not measured — soil test needed', 'Awukahlolwa — hlola umhlabathi') : `pH ${d.soil.ph} · OC ${d.soil.organicCarbon}%`, color: 'var(--report-gold)' },
                  ...(d.vegetation ? [{ label: 'Vegetation', value: d.vegetation.vegUnit, color: bColor }] : []),
                  ...(d.bru ? [{ label: 'BRU Zone', value: `${d.bru.brucode} · approx. ${d.bru.nearestBrg}`, color: bColor }] : []),
                  ...(facts?.boundary ? [{ label: tr('Mapped boundary', 'Umngcele obalazwe'), value: `${(facts.boundary.areaM2 / 10000).toFixed(3)} ha`, color: 'var(--report-green)' }] : []),
                  ...(facts?.design ? [{ label: tr('Mapped growing area', 'Indawo yokutshala ebalazwe'), value: `${facts.design.growingAreaM2.toLocaleString()} m²`, color: 'var(--report-green)' }] : []),
                  ...(facts?.water ? [{ label: tr('Tank capacity in plan', 'Umthamo wamathangi ohlelweni'), value: `${facts.water.statedStorageLitres.toLocaleString()} L`, color: 'var(--report-blue)' }] : []),
                ].map(({ label, value, color }) => (
                  <div key={label} className={styles.summaryTile} style={{ borderTop: `3px solid ${color ?? 'var(--report-border)'}` }}>
                    <div className={`${styles.summaryLabel} font-sans`}>{label}</div>
                    <div className={`${styles.summaryValue} font-sans font-semibold`}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Coords */}
              <div className="mt-3 text-xs font-mono" style={{ color: 'var(--report-muted)' }}>
                {Math.abs(d.lat).toFixed(4)}°S, {d.lon.toFixed(4)}°E · Köppen {d.climate.koppen} ({d.climate.koppenDesc}) ·
                {d.rainfall.pattern} rainfall · {d.rainfall.wetSeason} wet / {d.rainfall.drySeason} dry ·
                {d.climate.meanTemp}°C mean ({d.climate.minTemp}–{d.climate.maxTemp}°C)
              </div>

              {d.bru && (
                // Rainfall intentionally omitted from this footnote — the "Rainfall" summary tile above
                // is the single measured annual figure for this site; restating BRU's zone-average mm/yr
                // here reads as a second, conflicting rainfall claim for a non-expert reader.
                <div className="mt-1 text-xs font-mono" style={{ color: 'var(--report-muted)' }}>
                  {d.bru.attribution} — BRU {d.bru.brucode} (parent {d.bru.bruParent}): {d.bru.tmean}°C mean ({d.bru.tmin}–{d.bru.tmax}°C).
                  Zone name &ldquo;{d.bru.nearestBrg}&rdquo; is a best-effort climate match, not a verified BRU→Bioresource Group crosswalk.
                </div>
              )}
            </div>

            {reading === 'full' && presentation !== 'print' && <ReportVisualOverview visuals={visuals} stamp={new Date(reportDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })} image={photoGallery.shown[0]?.dataUrl ?? (!activeSaved && mapCapture ? `data:image/jpeg;base64,${mapCapture}` : plates[0]?.thumb)} imageCaption={photoGallery.shown[0] ? `${photoGallery.shown[0].label} · Current site evidence; it may postdate saved report text.` : !activeSaved && mapCapture ? 'Captured site satellite view' : plates[0] ? `Saved design: ${plates[0].label}` : undefined} />}

            {/* Saved places — GPS points for the farm (home, fields, water) */}
            {reading === 'full' && savedPlaces && savedPlaces.length > 0 && (
              <div className="mb-6 p-4 rounded-xl" style={{ background: 'var(--report-panel)', border: '1px solid var(--report-border)' }}>
                <div className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: 'var(--report-muted)' }}>
                  {label('Saved Places · GPS Points')}
                </div>
                <div className="space-y-1.5">
                  {savedPlaces.map((p) => (
                    <div key={p.id} className={`${styles.placeRow} text-sm`} style={{ color: 'var(--report-ink)' }}>
                      <MapPin size={14} style={{ color: placeColor(p.label), flexShrink: 0 }} />
                      <span className="font-display font-semibold flex-1 min-w-0 truncate">{p.name}</span>
                      <span className="font-sans text-xs" style={{ color: 'var(--report-muted)' }}>
                        {PLACE_LABELS.find((l) => l.v === p.label)?.name ?? 'Place'}
                      </span>
                      <span className="font-mono text-xs" style={{ color: 'var(--report-muted)' }}>
                        {Math.abs(p.lat).toFixed(5)}°S, {p.lon.toFixed(5)}°E
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Captured satellite view */}
            {showVisuals && mapCapture && !activeSaved && (
              <div className="mb-6 p-4 rounded-xl" style={{ background: 'var(--report-panel)', border: '1px solid var(--report-border)' }}>
                <div className="text-xs font-mono uppercase tracking-wider mb-3" style={{ color: 'var(--report-muted)' }}>
                  {label('Site Satellite View')}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/jpeg;base64,${mapCapture}`}
                  alt="Captured satellite view of the site"
                  className="w-full rounded-lg"
                  style={{ border: '1px solid var(--report-border)' }}
                />
                <div className="text-xs font-mono mt-2" style={{ color: 'var(--report-muted)', opacity: 0.7 }}>
                  Maxar satellite imagery · {Math.abs(d.lat).toFixed(4)}°S {d.lon.toFixed(4)}°E
                </div>
              </div>
            )}

            {/* One honest line when generation went light — the farmer should never wonder why
                this report's advice stopped quoting the masterplan. */}
            {wentLight && (
              <div className="mb-4 px-4 py-3 rounded-xl font-sans" style={{ background: '#FDF4E3', border: '1px solid #E8D5A8', fontSize: 12.5, color: 'var(--report-ink)' }}>
                The last attempt closed the app, so this report was made without sending your design
                maps to be read — everything else is complete, and your maps still show below and in
                the PDF. Generate again any time to retry with them.
              </div>
            )}

            {/* ── The farm's own design sheets ──────────────────────────────
                Present whether or not a report has been generated: they are the
                farmer's own work and the strongest evidence in the document.
                Thumbnails here, full sheet on tap — see the memory note above. */}
            {showVisuals && plates.length > 0 && (
              <div className="mb-6 p-4 rounded-xl" style={{ background: 'var(--report-panel)', border: '1px solid var(--report-border)' }}>
                <div className="text-xs font-sans uppercase tracking-wider mb-3" style={{ color: 'var(--report-muted)' }}>
                  {tr('Your saved design maps', 'Amamephu omklamo wakho agciniwe')} · {plates.length}
                </div>
                <div className={styles.mapGrid}>
                  {plates.map((plate, i) => (
                    <button
                      key={plate.id}
                      onClick={() => { void openSheet(plate); }}
                      className="text-left"
                      style={{
                        background: 'var(--report-paper)', border: '1px solid var(--report-border)', borderRadius: 10,
                        padding: 6, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6,
                      }}
                    >
                      {plate.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={plate.thumb}
                          alt={plate.label}
                          style={{ width: '100%', borderRadius: 6, display: 'block' }}
                        />
                      ) : (
                        <div
                          className="font-sans"
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            aspectRatio: '4 / 3', borderRadius: 6, background: 'rgba(31,77,43,0.06)',
                            color: 'var(--report-muted)', fontSize: 12,
                          }}
                        >
                          Tap to open
                        </div>
                      )}
                      <span className="font-sans" style={{ fontSize: 12, color: 'var(--report-ink)', lineHeight: 1.3 }}>
                        Figure {i + 1} — {stripInlineMarkdown(plate.label)}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="font-sans mt-3" style={{ fontSize: 12, color: 'var(--report-muted)', opacity: 0.8 }}>
                  {tr('Saved plan sheets. Open a sheet to inspect it. Include images in the full PDF when you need them.', 'Amakhasi omklamo agciniwe. Vula ikhasi ukuze ulihlole. Faka izithombe ku-PDF egcwele uma uzidinga.')}
                </div>
              </div>
            )}

            {/* ── The farmer's own photographs of the ground ────────────────
                Shown BELOW the plan sheets, because that is the order the model reads them in and
                the order they make sense in: the plans say what is where, the photographs say what
                state each thing is in.

                Only the photographs the model actually read are shown, and the count says how many
                more exist. A strip of everything on file would look more generous and be less true
                — advice about the soil beside twelve pictures, four of which informed it, with
                nothing marking which four. */}
            {showVisuals && photoGallery.shown.length > 0 && (
              <div className="mb-6 p-4 rounded-xl" style={{ background: 'var(--report-panel)', border: '1px solid var(--report-border)' }}>
                <div className="text-xs font-sans uppercase tracking-wider mb-3" style={{ color: 'var(--report-muted)' }}>
                  {tr('Your saved site photos', 'Izithombe zakho zendawo ezigciniwe')} · {photoGallery.shown.length}
                  {photoGallery.total > photoGallery.shown.length ? ` of ${photoGallery.total}` : ''}
                </div>
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
                  {photoGallery.shown.map((p, i) => (
                    <button
                      key={`${p.key}-${i}`}
                      onClick={() => setOpenPlate({ label: p.label, image: p.dataUrl })}
                      className="u-tap-target text-left"
                      style={{
                        background: 'var(--report-paper)', border: '1px solid var(--report-border)', borderRadius: 10,
                        padding: 6, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.dataUrl}
                        alt={p.label}
                        style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 6, display: 'block' }}
                      />
                      <span className="font-sans" style={{ fontSize: 12, color: 'var(--report-ink)', lineHeight: 1.3 }}>
                        Photo {i + 1} — {p.label}
                      </span>
                      {p.note && (
                        <span className="font-sans" style={{ fontSize: 12, color: 'var(--report-muted)', opacity: 0.85, lineHeight: 1.3 }}>
                          “{p.note}”
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="font-sans mt-3" style={{ fontSize: 12, color: 'var(--report-muted)', opacity: 0.8 }}>
                  {tr('Photos from your current site evidence. Saved report text may refer to an earlier selection. Photos can be included in the full PDF.', 'Izithombe ezisebufakazini bakho bendawo njengamanje. Umbiko ogciniwe ungase ubhekisele ezithombeni zangaphambili. Ungafaka izithombe ku-PDF egcwele.')}
                </div>
              </div>
            )}

            {/* No sheets for this site: say so, rather than silently producing a report with no
                maps and an appendix the farmer expected. */}
            {reading === 'full' && plates.length === 0 && (
              <div className="mb-6 p-4 rounded-xl font-sans" style={{ background: 'var(--report-panel)', border: '1px dashed var(--report-border)', fontSize: 12, color: 'var(--report-muted)' }}>
                {tr('No design maps are saved for this site yet. Save your plan sheets in the Design Map to include them here.', 'Awakagcinwa amamephu omklamo wale ndawo. Gcina amakhasi omklamo ku-Design Map ukuze afakwe lapha.')}
              </div>
            )}

            {showVisuals && facts?.crop && <section className={styles.plantPanel}>
              <h2>{tr('Your planned crops', 'Izitshalo zakho ezihleliwe')}</h2>
              <p>{tr('Saved planting rows. Catalogue illustrations show the crop, not a photograph of this garden.', 'Imigqa yokutshala egciniwe. Imidwebo yekhathalogi ikhombisa isitshalo, ayisona isithombe sale nsimu.')}</p>
              <div className={styles.plantGrid}>{facts.crop.crops.map(c => {
                const crop = CROPS.find(x => x.name === c.name);
                const art = crop ? getCropArt(crop.key) : undefined;
                return <article key={c.name}>{art && <img src={art} alt="" loading="lazy" />}<h3>{c.name}</h3><p>{c.bedLabels.join(', ')}</p><p>{c.sowMonths.join(' · ')}</p></article>;
              })}</div>
            </section>}
            {reading === 'full' && presentation === 'print' && <p className={styles.summaryLabel}>{tr('Ink-saving edition. Full-colour export includes the visual overview and charts.', 'Umbiko oyonga uyinki. Ukukhipha ngemibala egcwele kufaka amashadi.')}</p>}

            {/* Loading shimmer */}
            {loading && !report && (
              <div className="space-y-3 animate-pulse">
                {[60,90,75,50,85,70,40,95,65].map((w, i) => (
                  <div key={i} className="h-3 rounded" style={{ width: `${w}%`, background: 'rgba(226,216,196,0.6)', animationDelay: `${i*50}ms` }} />
                ))}
              </div>
            )}

            {error && (
              <div className="text-sm font-display p-4 rounded-xl" style={{ background: 'rgba(212,110,66,0.1)', border: '1px solid rgba(212,110,66,0.3)', color: 'var(--report-gold)' }}>
                {error}
              </div>
            )}

            {/* Generated report */}
            {(report || reading !== 'full') && (
              <div className={`${styles.body} report-body`}>
                {reading === 'full' ? renderReport(report) : summaryPages.map((page, i) => <section className={styles.summaryPage} key={page.title}><span className={styles.summaryLabel}>{i + 1} / {summaryPages.length}</span><h2>{page.title}</h2>{page.lines.map((line, n) => <p key={n}>{line}</p>)}</section>)}
                {loading && <span className="inline-block w-2 h-4 rounded-sm animate-pulse ml-1" style={{ background: 'var(--report-button)' }} />}
                {/* Print-only footer — hidden on screen */}
                <div className="print-footer" aria-hidden="true">
                  Generated by ImbewuField &mdash; imbewufield.vercel.app
                </div>
              </div>
            )}

            {/* Placeholder before generation */}
            {reading === 'full' && !report && !loading && !error && (
              <div className="text-center py-16">
                <div className="text-base font-display font-semibold mb-4" style={{ color: 'var(--report-muted)' }}>Report</div>
                <p className="font-display text-base mb-2" style={{ color: 'var(--report-ink)' }}>
                  Select your sections and click Generate
                </p>
                <p className="font-display text-sm" style={{ color: 'var(--report-muted)' }}>
                  {selected.size} section{selected.size !== 1 ? 's' : ''} selected
                  {photoAnalysis ? ' · photos included' : ''}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* One sheet at full resolution, held only while it is open. Closing drops the reference —
          the print master is the largest single string this screen ever holds. */}
      {openPlate && (
        <div
          onClick={() => setOpenPlate(null)}
          role="dialog"
          aria-label={openPlate.label}
          style={{
            position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(32,25,15,0.88)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: 16, gap: 10, cursor: 'zoom-out',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={openPlate.image}
            alt={openPlate.label}
            style={{ maxWidth: '100%', maxHeight: '86%', objectFit: 'contain', borderRadius: 8 }}
          />
          <div className="font-sans" style={{ color: '#F7F2E9', fontSize: 12, textAlign: 'center' }}>
            {stripInlineMarkdown(openPlate.label)} · tap anywhere to close
          </div>
        </div>
      )}

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

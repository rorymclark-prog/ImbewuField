'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { LocationData, SiteData, WaterData } from '@/lib/types';
import RainfallChart from './RainfallChart';
import { loadReports, saveReport, deleteReport, reportId, type SavedReport } from '@/lib/saved-reports';
import { PLACE_LABELS, placeColor, type SavedPlace } from '@/lib/saved-places';
import { Loader2, Check, Circle, ChevronRight, Share2, MapPin } from 'lucide-react';
import { loadSurvey } from '@/lib/site-survey';
import { getSiteEvidence } from '@/lib/site-evidence';

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
  activePlaceName?: string;
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
    } else if (line.startsWith('**') && line.endsWith('**')) {
      elements.push(
        <p key={i} className="font-display font-semibold text-sm mt-3 mb-1" style={{ color: '#20190F' }}>
          {line.replace(/\*\*/g, '')}
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
      const headers = header.split('|').filter(h => h.trim());
      const rows = body.map(r => r.split('|').filter(c => c.trim()));
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
                      {cell.trim().replace(/\*\*/g, '')}
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
            {line.replace(/^\d+\.\s*/, '').replace(/\*\*/g, '')}
          </p>
        </div>
      );
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      elements.push(
        <div key={i} className="flex gap-2 my-1">
          <span className="flex-shrink-0 mt-0.5" style={{ color: '#1F4D2B' }}><ChevronRight size={12} /></span>
          <p className="font-display text-sm leading-relaxed" style={{ color: '#20190F' }}>
            {line.replace(/^[-•]\s*/, '').replace(/\*\*/g, '')}
          </p>
        </div>
      );
    } else {
      elements.push(
        <p key={i} className="font-display text-sm leading-relaxed my-1.5" style={{ color: '#20190F' }}>
          {line.replace(/\*\*/g, '')}
        </p>
      );
    }
    i++;
  }
  return elements;
}

export default function ReportView({ locationData, photoAnalysis, siteData: liveSite, waterData: liveWater, savedPlaces, mapCapture, appLang, onClose, savedReport, activePlaceId, activePlaceName }: Props) {
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
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const activePlace = savedPlaces?.find((p) => p.id === activePlaceId) ?? null;
  const activePlaceTitle = activePlaceName ?? activePlace?.name ?? '';
  const activePlaceLabel = activePlace
    ? PLACE_LABELS.find((l) => l.v === activePlace.label)?.name ?? 'Place'
    : '';
  const activePlaceHeader = activePlaceTitle && activePlaceLabel
    ? `${activePlaceTitle} · ${activePlaceLabel}`
    : activePlaceTitle;
  const headerCoords = `${d.biome.name} · ${Math.abs(d.lat).toFixed(3)}°S ${d.lon.toFixed(3)}°E`;
  const headerTitle = activePlaceHeader ? `${activePlaceHeader} · ${headerCoords}` : headerCoords;
  const formatArea = (areaM2: number, areaHa?: number) =>
    areaHa != null && areaHa >= 1 ? `${areaHa} ha` : `${Math.round(areaM2).toLocaleString()} m2`;
  useEffect(() => {
    const refresh = () => setSavedList(loadReports());
    refresh();
    window.addEventListener('imbewu-reports-changed', refresh);
    return () => window.removeEventListener('imbewu-reports-changed', refresh);
  }, []);

  const handleSaveReport = useCallback(() => {
    if (!report) return;
    saveReport({
      id: activeSaved?.id ?? reportId(),
      name: `${activePlaceTitle ? `${activePlaceTitle} · ` : ''}${d.biome.name} · ${new Date().toLocaleDateString()}`,
      savedAt: new Date().toISOString(),
      lang: language,
      report,
      location: d,
      siteData: siteData ?? undefined,
      waterData: waterData ?? undefined,
    });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
  }, [report, activeSaved, d, siteData, waterData, language, activePlaceTitle]);

  const openSaved = useCallback((r: SavedReport) => {
    setActiveSaved(r);
    setReport(r.report);
    setLanguage(r.lang);
    setGenerated(true);
    setError('');
  }, []);

  const bColor = BIOME_COLORS[d.biome.code] ?? '#6BA84F';

  const generate = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setReport('');
    setError('');
    setLoading(true);
    setGenerated(false);

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

      const res = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationData: d,
          photoAnalysis: photoAnalysis || undefined,
          siteData: siteData || undefined,
          waterData: waterData || undefined,
          surveyData: activePlaceId ? loadSurvey(activePlaceId) ?? undefined : undefined,
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
  }, [d, photoAnalysis, siteData, waterData, selected, language, bilingual, tone, length]);

  async function exportPdf() {
    if (!report) return;
    setExporting(true);
    setExportError('');

    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 48;
      const marginTop = 48;
      const marginBottom = 42;
      const contentWidth = pageWidth - marginX * 2;
      let y = marginTop;

      const ensureSpace = (needed: number) => {
        if (y + needed > pageHeight - marginBottom) {
          doc.addPage();
          y = marginTop;
        }
      };

      const cleaned = (value: string) => value.replace(/\*\*/g, '').trim();

      const addParagraph = (text: string, options?: {
        size?: number;
        style?: 'normal' | 'bold';
        color?: [number, number, number];
        font?: 'helvetica' | 'courier';
        gapBefore?: number;
        gapAfter?: number;
        width?: number;
      }) => {
        const size = options?.size ?? 10;
        const style = options?.style ?? 'normal';
        const color = options?.color ?? [32, 25, 15];
        const font = options?.font ?? 'helvetica';
        const gapBefore = options?.gapBefore ?? 0;
        const gapAfter = options?.gapAfter ?? 4;
        const width = options?.width ?? contentWidth;
        const value = cleaned(text);
        if (!value) {
          y += gapBefore + gapAfter;
          return;
        }
        doc.setFont(font, style);
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
        const lines = doc.splitTextToSize(value, width);
        const lineHeight = size * 1.28;
        ensureSpace(gapBefore + lines.length * lineHeight + gapAfter);
        y += gapBefore;
        doc.text(lines, marginX, y);
        y += lines.length * lineHeight + gapAfter;
      };

      const addHeading = (text: string, level: 2 | 3) => {
        const isH2 = level === 2;
        const size = isH2 ? 14 : 11;
        const color: [number, number, number] = isH2 ? [31, 77, 43] : [192, 122, 30];
        const value = cleaned(text);
        if (!value) return;
        ensureSpace(size * 2.2 + 12);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(value, marginX, y);
        y += size * 1.45;
        if (isH2) {
          doc.setDrawColor(226, 216, 196);
          doc.setLineWidth(1);
          doc.line(marginX, y - 2, pageWidth - marginX, y - 2);
          y += 4;
        }
      };

      const addBullet = (text: string, prefix = '•') => {
        const value = cleaned(text);
        if (!value) return;
        const bulletWidth = 14;
        const wrapped = doc.splitTextToSize(value, contentWidth - bulletWidth);
        const size = 10;
        const lineHeight = size * 1.28;
        ensureSpace(wrapped.length * lineHeight + 2);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(size);
        doc.setTextColor(32, 25, 15);
        doc.text(prefix, marginX, y);
        doc.text(wrapped, marginX + bulletWidth, y);
        y += wrapped.length * lineHeight + 2;
      };

      const addNumbered = (text: string, number: string) => {
        const value = cleaned(text);
        if (!value) return;
        const labelWidth = 20;
        const wrapped = doc.splitTextToSize(value, contentWidth - labelWidth);
        const size = 10;
        const lineHeight = size * 1.28;
        ensureSpace(wrapped.length * lineHeight + 2);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(size);
        doc.setTextColor(192, 122, 30);
        doc.text(`${number}.`, marginX, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(32, 25, 15);
        doc.text(wrapped, marginX + labelWidth, y);
        y += wrapped.length * lineHeight + 2;
      };

      const addTable = (rows: string[][]) => {
        if (!rows.length) return;
        const rowFont = 'courier';
        const rowSize = 8.5;
        const rowLineHeight = rowSize * 1.35;
        rows.forEach((row, index) => {
          const text = row.join('  |  ');
          const wrapped = doc.splitTextToSize(text, contentWidth);
          ensureSpace(wrapped.length * rowLineHeight + 3);
          doc.setFont(rowFont, index === 0 ? 'bold' : 'normal');
          doc.setFontSize(rowSize);
          doc.setTextColor(index === 0 ? 92 : 32, index === 0 ? 80 : 25, index === 0 ? 64 : 15);
          doc.text(wrapped, marginX, y);
          y += wrapped.length * rowLineHeight + 3;
        });
      };

      const fileSafe = (value: string) => value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'site';
      const fileName = `ImbewuField-Site-Report-${fileSafe(activePlaceHeader || d.biome.name)}-${new Date().toISOString().slice(0, 10)}.pdf`;

      // Cover section
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(32, 25, 15);
      doc.text('ImbewuField', marginX, y);
      y += 18;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(32, 25, 15);
      doc.text('Permaculture Site Analysis Report', marginX, y);
      y += 18;
      doc.setDrawColor(226, 216, 196);
      doc.line(marginX, y, pageWidth - marginX, y);
      y += 16;

      if (activePlaceHeader) {
        addParagraph(`Place: ${activePlaceHeader}`, { style: 'bold', gapAfter: 2 });
      }
      addParagraph(`Site: ${d.biome.name}`, { style: 'bold', gapAfter: 2 });
      addParagraph(`Coordinates: ${Math.abs(d.lat).toFixed(4)}°S, ${d.lon.toFixed(4)}°E`, { gapAfter: 2 });
      addParagraph(`Rainfall: ${d.rainfall.annual} mm/yr · ${d.rainfall.pattern} · wet ${d.rainfall.wetSeason} · dry ${d.rainfall.drySeason}`, { gapAfter: 2 });
      addParagraph(`Climate: ${d.climate.koppen} (${d.climate.koppenDesc}) · mean ${d.climate.meanTemp}°C`, { gapAfter: 2 });
      addParagraph(`Soil: pH ${d.soil.ph} · organic carbon ${d.soil.organicCarbon}% · texture ${d.soil.textureClass}`, { gapAfter: 2 });
      addParagraph(`Elevation: ${d.elevation.elevation} m · slope ${d.elevation.slopeDeg}°`, { gapAfter: 4 });

      if (d.vegetation) {
        addParagraph(`Vegetation: ${d.vegetation.vegUnit}`, { gapAfter: 2 });
      }
      if (siteData) {
        addParagraph(`Site area: ${formatArea(siteData.areaM2, siteData.areaHa)} · perimeter ${siteData.perimeterKm.toFixed(2)} km`, { gapAfter: 2 });
      }
      if (waterData) {
        addParagraph(`Water storage: ~${waterData.estVolumeKL.toLocaleString()} kL across ${waterData.count} feature${waterData.count === 1 ? '' : 's'} · ${formatArea(waterData.areaM2)}`, { gapAfter: 4 });
      }

      if (savedPlaces && savedPlaces.length > 0) {
        addHeading('Saved Places', 3);
        savedPlaces.forEach((p) => {
          const placeLabel = PLACE_LABELS.find((l) => l.v === p.label)?.name ?? 'Place';
          addBullet(`${p.name} · ${placeLabel} · ${Math.abs(p.lat).toFixed(5)}°S, ${p.lon.toFixed(5)}°E`);
        });
        y += 2;
      }

      if (mapCapture) {
        const mapImage = mapCapture.startsWith('data:')
          ? mapCapture
          : `data:image/jpeg;base64,${mapCapture}`;
        const props = doc.getImageProperties(mapImage) as { width: number; height: number };
        const imageWidth = contentWidth;
        const imageHeight = imageWidth * (props.height / props.width);
        ensureSpace(imageHeight + 48);
        addHeading('Site Satellite View', 3);
        doc.addImage(mapImage, 'JPEG', marginX, y, imageWidth, imageHeight);
        y += imageHeight + 10;
        addParagraph(`Maxar satellite imagery · ${Math.abs(d.lat).toFixed(4)}°S ${d.lon.toFixed(4)}°E`, {
          size: 8,
          color: [92, 80, 64],
          gapAfter: 8,
        });
      }

      addHeading('Report', 2);

      const lines = report.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const line = raw.trim();
        if (!line) {
          y += 4;
          continue;
        }

        if (line.startsWith('## ')) {
          addHeading(line.replace('## ', ''), 2);
          continue;
        }

        if (line.startsWith('### ')) {
          addHeading(line.replace('### ', ''), 3);
          continue;
        }

        if (line.startsWith('|')) {
          const tableRows: string[][] = [];
          while (i < lines.length && lines[i].startsWith('|')) {
            const cells = lines[i].split('|').map((cell) => cleaned(cell)).filter(Boolean);
            if (cells.length > 0 && !cells.every((cell) => /^:?-{3,}:?$/.test(cell))) {
              tableRows.push(cells);
            }
            i++;
          }
          i--;
          addTable(tableRows);
          continue;
        }

        if (/^\d+\. \*\*/.test(line)) {
          const match = line.match(/^(\d+)\. \*\*(.+?)\*\*(.*)$/);
          if (match) {
            addNumbered(`${match[2]}${match[3] ?? ''}`, match[1]);
            continue;
          }
        }

        if (/^\d+\./.test(line)) {
          const number = line.match(/^(\d+)/)?.[1] ?? '1';
          addNumbered(line.replace(/^\d+\.\s*/, ''), number);
          continue;
        }

        if (line.startsWith('- ') || line.startsWith('• ')) {
          addBullet(line.replace(/^[-•]\s*/, ''));
          continue;
        }

        if (line.startsWith('**') && line.endsWith('**')) {
          addParagraph(line, { style: 'bold', gapAfter: 3 });
          continue;
        }

        addParagraph(line);
      }

      const totalPages = doc.getNumberOfPages();
      for (let page = 1; page <= totalPages; page++) {
        doc.setPage(page);
        doc.setDrawColor(226, 216, 196);
        doc.setLineWidth(1);
        doc.line(marginX, pageHeight - 32, pageWidth - marginX, pageHeight - 32);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(140, 122, 98);
        doc.text('Generated by ImbewuField · fieldproof.vercel.app', pageWidth / 2, pageHeight - 18, { align: 'center' });
        doc.text(`Page ${page} of ${totalPages}`, pageWidth - marginX, pageHeight - 18, { align: 'right' });
      }

      const blob = doc.output('blob');
      const file = new File([blob], fileName, { type: 'application/pdf' });
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'PDF export failed. Opening print as a fallback.');
      // Keep a last-resort print path if PDF generation or download is blocked.
      window.print();
    } finally {
      setExporting(false);
    }
  }

  async function shareReport() {
    if (!d || !report) return;
    const firstPara = report.split('\n').find((l) => l.trim() && !l.startsWith('#'))?.slice(0, 200) ?? '';
    const text = `ImbewuField Site Analysis\n${activePlaceHeader ? `${activePlaceHeader}\n` : ''}${d.biome.name} | ${Math.abs(d.lat).toFixed(3)}°S ${d.lon.toFixed(3)}°E\nRainfall: ${d.rainfall.annual}mm/yr | Soil pH: ${d.soil.ph} | Mean temp: ${d.climate.meanTemp}°C\n\n${firstPara}...\n\nSee the full report on ImbewuField (fieldproof.vercel.app)`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: 'ImbewuField Site Analysis', text }); return; } catch { /* user cancelled */ }
    }
    // Fallback: copy to clipboard
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#F7F2E9' }}>

      {/* ── Toolbar ──────────────────────────────── */}
      <div
        className="no-print flex-shrink-0 flex items-center gap-3 px-6 py-3"
        style={{ background: 'rgba(226,216,196,0.3)', borderBottom: '1px solid #E2D8C4' }}
      >
        <button onClick={onClose} className="text-xs font-mono px-3 py-1.5 rounded-lg transition-all"
                style={{ color: '#5C5040', background: 'rgba(226,216,196,0.5)', border: '1px solid #E2D8C4' }}>
          Back
        </button>

        <div className="text-sm font-display font-semibold" style={{ color: '#20190F' }}>
          Site Analysis Report
        </div>
        <div className="text-xs font-mono" style={{ color: '#5C5040' }}>
          {headerTitle}
        </div>

        <div className="flex-1" />

        {generated && (
          <button
            onClick={handleSaveReport}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-display font-medium transition-all"
            style={justSaved
              ? { background: 'rgba(31,77,43,0.15)', border: '1px solid rgba(31,77,43,0.4)', color: '#1F4D2B' }
              : { background: 'rgba(31,77,43,0.1)', border: '1px solid rgba(31,77,43,0.3)', color: '#1F4D2B' }}
          >
            {justSaved ? 'Saved' : 'Save report'}
          </button>
        )}

        {generated && (
          <button
            onClick={exportPdf}
            disabled={exporting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-display font-medium transition-all"
            style={{
              background: exporting ? 'rgba(192,122,30,0.08)' : 'linear-gradient(135deg, rgba(192,122,30,0.15), rgba(192,122,30,0.06))',
              border: '1px solid rgba(192,122,30,0.35)',
              color: '#C07A1E',
              opacity: exporting ? 0.75 : 1,
            }}
          >
            {exporting ? <><Loader2 size={12} className="animate-spin" /> Exporting...</> : 'Export PDF'}
          </button>
        )}

        {generated && (
          <button
            onClick={shareReport}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-display font-medium transition-all"
            style={{
              background: copied ? 'rgba(35,94,134,0.15)' : 'rgba(35,94,134,0.08)',
              border: '1px solid rgba(35,94,134,0.3)',
              color: '#235E86',
            }}
          >
            <Share2 size={12} />{copied ? 'Copied!' : 'Share'}
          </button>
        )}

        {generated && (
          <button onClick={generate}
            disabled={loading}
            className="flex items-center gap-1.5 font-sans font-semibold transition-all"
            style={{ padding: '0 14px', height: 36, borderRadius: 10, background: 'rgba(31,77,43,0.1)', border: '1px solid rgba(31,77,43,0.3)', color: '#1F4D2B', fontSize: 13, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.5 : 1 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            </svg>
            Regenerate
          </button>
        )}

        <button
          onClick={generate}
          disabled={loading || selected.size === 0}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-display font-semibold transition-all"
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
      {exportError && (
        <div className="no-print px-6 py-2 text-xs font-sans"
          style={{ background: 'rgba(192,83,30,0.08)', borderBottom: '1px solid rgba(192,83,30,0.2)', color: '#9E5C08' }}>
          PDF export had a problem, so print fallback was opened: {exportError}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">

        {/* ── Section controls sidebar ─────────── */}
        <div className="no-print flex-shrink-0 overflow-y-auto py-4 px-3"
             style={{ width: 232, background: '#FBF6EC', borderRight: '1px solid #E2D8C4' }}>

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
                        const el = reportRef.current?.querySelector(`#${id}`);
                        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        <div className="flex-1 overflow-y-auto relative" ref={reportRef}>
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
          <div className="max-w-3xl mx-auto px-8 py-8">

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
              <div className="mt-5 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                {[
                  ...(activePlaceHeader ? [{ label: 'Place', value: activePlaceHeader, color: '#1F4D2B' }] : []),
                  { label: 'Biome', value: d.biome.name, color: bColor },
                  { label: 'Rainfall', value: `${d.rainfall.annual}mm/yr`, color: '#235E86' },
                  { label: 'Elevation', value: `${d.elevation.elevation}m · ${d.elevation.slopeDeg}°`, color: undefined },
                  { label: 'Soil pH', value: `pH ${d.soil.ph} · OC ${d.soil.organicCarbon}%`, color: d.soil.ph < 5.5 || d.soil.ph > 7.5 ? '#D4922A' : '#2D6B3C' },
                  ...(d.vegetation ? [{ label: 'Vegetation', value: d.vegetation.vegUnit, color: bColor }] : []),
                  ...(siteData ? [{ label: 'Site Area', value: formatArea(siteData.areaM2, siteData.areaHa), color: '#2D6B3C' }] : []),
                  ...(waterData ? [{ label: 'Water Storage', value: `~${waterData.estVolumeKL.toLocaleString()} kL · ${formatArea(waterData.areaM2)}`, color: '#235E86' }] : []),
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
                  Generated by ImbewuField &mdash; fieldproof.vercel.app
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
           These keep a manual browser print clean if the user prints the page.
        ══════════════════════════════════════════════════════════════════ */
        @media print {

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

'use client';

// Design Studio — Print / Export composer. Turns the EXACT (deterministic) design maps into a
// publishable plan set: the canonical 9-map package (docs/PLAN-SET-SPEC.md), each a print page with
// a numbered title block, then a multi-page PDF or per-sheet PNGs. Everything is deterministic (no
// AI) so the output is always correct and print-ready.
//
// TWO kinds of page:
//  • SELF-CHROMED sheets (02 Sector, 03 Zones, 04 Water, 05 Earthworks, 06 Planting, 07 Structures,
//    09 Implementation) already carry their own legend / scale / north from the Blueprint chrome, so
//    the page just adds a numbered title strip and letterboxes the sheet FULL WIDTH (no paper
//    legend column — that would double-chrome).
//  • PAPER-FURNITURE sheets (01 Base, 08 Masterplan) are plain composites, so the page draws the
//    title block + legend column + scale bar + north arrow around them, as before.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, FileDown, Images, Loader2, Share2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import LessonLink from './LessonLink';

import type { CanvasFrame, DesignCanvasState } from '@/lib/design-canvas';
import type { SectorSite } from '@/lib/sector';
import {
  buildBlueprintBaseMap,
  buildBlueprintWholeMap,
  buildBlueprintSectorMap,
  buildBlueprintZoneMap,
  buildBlueprintWaterMap,
  buildBlueprintEarthworksMap,
  buildBlueprintPlantingMap,
  buildBlueprintStructuresMap,
  buildImplementationMap,
  layerContentCount,
  groundRows,
  sheetLegendRows,
  TAR,
  type GlossyLayerFilter,
} from './DesignGlossy';
import { buildPhasePlan } from '@/lib/phasing';
import { formatDesignTranslation } from '@/lib/design-studio-i18n';
import { useLanguage } from '@/lib/i18n';

type RefLayers = {
  boundary: Array<[number, number]>;
  house: Array<[number, number]>;
  driveway: Array<[number, number]>;
  drivewayClosed?: boolean;
};

interface DesignPrintProps {
  state: DesignCanvasState;
  frame: CanvasFrame;
  refLayers: RefLayers;
  site: SectorSite | null;
  placeName?: string;
  onClose: () => void;
}

const PAPER = '#FFFEFA';
const GOLD = '#F7C97E';
const GREEN = '#1F4D2B';
const DARK = '#0B120B';

type PrintLayer = {
  key: string;
  no: string; // '01'..'09'
  label: string;
  selfChromed: boolean; // sheet carries its own legend/scale/north (a Blueprint sheet)
  render: (state: DesignCanvasState, frame: CanvasFrame, refLayers: RefLayers, site: SectorSite | null, placeName?: string) => Promise<string>;
  // Only used to draw the PAPER legend on the two non-self-chromed pages.
  filter?: GlossyLayerFilter;
  drawDesign?: boolean;
};

// The canonical 9-map package, in order (docs/PLAN-SET-SPEC.md). Analysis (02) precedes design.
const PRINT_LAYERS: PrintLayer[] = [
  // THE PRINTED SET USED A DIFFERENT RENDERER FOR THESE TWO SHEETS, and that is why fixes kept
  // "not landing" on paper. 01 and 08 rendered through buildComposite -- an older path that never
  // received the exact-sheet work -- while buildBlueprintWholeMap, the correct masterplan builder,
  // sat in DesignGlossy.tsx with ZERO call sites. So the PDF a funder opens first and last carried
  // the staple-garden polygons Rory reported twice, the pipe-blue swale, unlegended zone bands and
  // emoji glyphs, all of them already fixed everywhere else in the app.
  //
  // Both now use the same builders the on-screen plan set uses, self-chromed like every other
  // sheet in this list. A defect fixed once is now fixed on screen AND on paper.
  { key: 'base', no: '01', label: 'Existing Site & Base', selfChromed: true, render: (s, f, r, _site, pn) => buildBlueprintBaseMap(s, f, r, pn) },
  { key: 'sector', no: '02', label: 'Sector Analysis', selfChromed: true, render: (s, f, r, site, pn) => buildBlueprintSectorMap(s, f, r, site, pn) },
  { key: 'zones', no: '03', label: 'Permaculture Zones', selfChromed: true, render: (s, f, r, _site, pn) => buildBlueprintZoneMap(s, f, r, pn) },
  { key: 'water', no: '04', label: 'Water & Irrigation', selfChromed: true, render: (s, f, r, _site, pn) => buildBlueprintWaterMap(s, f, r, pn) },
  // Sheet 05, NEW. Earthworks is the land-shaping / contour setting-out sheet split out of Water —
  // swale, contour berm, terrace and half-moon now print here instead (SHEET_OVERRIDE keeps the
  // two basin types on Water). Same pattern as the other filter-based layer sheets: the exact
  // Blueprint builder for the 'earthworks' GlossyLayerFilter, self-chromed like its siblings.
  { key: 'earthworks', no: '05', label: 'Earthworks & Contour Setting-Out', selfChromed: true, render: (s, f, r, _site, pn) => buildBlueprintEarthworksMap(s, f, r, pn) },
  { key: 'planting', no: '06', label: 'Planting & Agroforestry', selfChromed: true, render: (s, f, r, _site, pn) => buildBlueprintPlantingMap(s, f, r, pn) },
  { key: 'structures', no: '07', label: 'Livestock & Infrastructure', selfChromed: true, render: (s, f, r, _site, pn) => buildBlueprintStructuresMap(s, f, r, pn) },
  { key: 'all', no: '08', label: 'Integrated Masterplan', selfChromed: true, render: (s, f, r, _site, pn) => buildBlueprintWholeMap(s, f, r, pn) },
  { key: 'implementation', no: '09', label: 'Implementation & Phasing', selfChromed: true, render: (s, f, r, site, pn) => buildImplementationMap(s, f, r, site, pn) },
];

// A sheet is exportable only when it has something true to say — mirrors the Glossy generate-all
// skip so Print can't emit an empty Zones sheet or a phase-less Implementation sheet (a fundable
// plan set must never show a confident page built on nothing).
function isLayerAvailable(layer: PrintLayer, state: DesignCanvasState, refLayers: RefLayers, site: SectorSite | null): boolean {
  if (layer.key === 'implementation') return buildPhasePlan(state, refLayers, site).phases.length > 0;
  if (layer.key === 'zones' || layer.key === 'water' || layer.key === 'earthworks' || layer.key === 'planting' || layer.key === 'structures') {
    return layerContentCount(state, refLayers, layer.key) > 0;
  }
  return true; // 01 base · 02 sector · 08 masterplan are always meaningful (satellite + boundary + energies)
}

// Paper pixel sizes at ~150 DPI, portrait [w, h].
/**
 * Page size in pixels, portrait, at 225 dpi.
 *
 * These were 1240x1754 and 1754x2480 — 150 dpi, which is half of print standard and is most of why
 * an exported sheet does not survive being looked at closely. Rory: "its blurry when you zoom in so
 * printing is not gonna be nice."
 *
 * WHY 225 AND NOT 300. iOS Safari refuses to allocate a canvas over roughly 16.7 megapixels and
 * silently hands back a blank one — no error, just an empty page. A3 landscape at 300 dpi is
 * 4961x3508 = 17.4 Mpx, over the cliff, and A3 is the size a farmer takes to a funder. 225 dpi puts
 * A3 landscape at 9.8 Mpx with room to spare and still buys half as much resolution again as
 * before. Raising it further needs the export to tile the page rather than allocate it whole.
 */
const PRINT_DPI = 225;
const PAPER_MM: Record<'a4' | 'a3', [number, number]> = {
  a4: [210, 297],
  a3: [297, 420],
};
const PAPER_PX: Record<'a4' | 'a3', [number, number]> = {
  a4: PAPER_MM.a4.map((mm) => Math.round((mm / 25.4) * PRINT_DPI)) as [number, number],
  a3: PAPER_MM.a3.map((mm) => Math.round((mm / 25.4) * PRINT_DPI)) as [number, number],
};

const slug = (s: string) => s.replace(/[^a-z0-9.\-]+/gi, '_').replace(/^_+|_+$/g, '') || 'site';

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = src;
  });
}

// Legend rows for a PAPER-furniture layer (base / masterplan) — what the reader needs to decode it.
// Sheet 01 "Existing Site & Base" is a drawDesign:false composite, but drawMarks (DesignGlossy.tsx)
// paints the boundary/house/driveway rings AND every traced ground feature (lawn, orchard, veg
// garden, patio, cleared) onto it regardless — that block is explicitly NOT gated on drawDesign
// because this is the one sheet whose whole subject is existing fabric. The three rows below used
// to be unconditional, so an untraced site printed a key for a boundary/house/driveway that was
// nowhere on the page (the phantom-row defect), while any traced ground wash it DID paint had no
// row at all (the mirror defect) — see docs/LAYER-AUDIT-2026-07-20.md item 3. Every row is now
// gated on the identical test drawMarks uses, and groundRows(...) is the same helper the Zones/
// Water/Structures Blueprints use, so this legend and that paint job cannot drift apart again.
function legendRows(state: DesignCanvasState, layer: PrintLayer, refLayers: RefLayers): Array<{ swatch: string; icon?: string; text: string }> {
  const filter = layer.filter ?? 'all';
  if (!layer.drawDesign) {
    const rows: Array<{ swatch: string; icon?: string; text: string }> = [];
    if (refLayers.boundary.length >= 3) rows.push({ swatch: '#B4E000', text: 'Property boundary' }); // drawMarks:523 chartreuse
    if (refLayers.house.length >= 3) rows.push({ swatch: '#8A8D91', text: 'House / roof' }); // drawMarks:543 = GROUND_FEATURES.house.color
    if (refLayers.driveway.length >= 2) rows.push({ swatch: TAR, text: 'Driveway (tar)' }); // drawMarks:554-593
    for (const g of groundRows(state, refLayers)) rows.push({ swatch: g.color, text: g.label });
    return rows;
  }
  // Sheet 07 "Integrated Masterplan" — drawDesign:true, filter:'all'. This used to be a private
  // re-implementation that (a) pushed one row per zone POLYGON instead of per zone NUMBER, so three
  // Zone-3 patches printed "Zone 3 — Orchard / food forest" three times, and (b) had no branch at
  // all for lines (swale/pipe/drip/fence/path/windbreak), the driveway, or traced ground — all of
  // which buildComposite(...,'all',true) draws on this exact page (docs/LAYER-AUDIT-2026-07-20.md,
  // 'all/A/wrong'). sheetLegendRows is the same deduped, register-aware legend builder the AI-styled
  // sheets use, so this page's key can never again promise less than the map beside it shows.
  return sheetLegendRows(state, refLayers, filter);
}

// Render ONE print page (map + furniture) to a canvas at the chosen paper size.
async function renderPage(
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: RefLayers,
  site: SectorSite | null,
  placeName: string,
  layer: PrintLayer,
  opts: { paper: 'a4' | 'a3'; landscape: boolean; titleBlock: boolean; legend: boolean; scaleBar: boolean; northArrow: boolean; dateStr: string },
): Promise<HTMLCanvasElement> {
  const [pw, ph] = PAPER_PX[opts.paper];
  const W = opts.landscape ? ph : pw;
  const H = opts.landscape ? pw : ph;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  const M = Math.round(W * 0.038);
  const titleH = opts.titleBlock ? Math.round(H * 0.062) : 0;
  // A self-chromed Blueprint sheet already has its own legend / scale / north — the page adds only
  // the numbered title strip and gives the sheet the full width.
  const showPaperFurniture = !layer.selfChromed;
  const legendW = showPaperFurniture && opts.legend ? Math.min(440, Math.max(300, Math.round(W * 0.24))) : 0;
  const footH = showPaperFurniture && (opts.scaleBar || opts.northArrow) ? Math.round(H * 0.05) : 0;

  // ── Title block (numbered) ──
  if (opts.titleBlock) {
    ctx.fillStyle = DARK;
    ctx.fillRect(M, M, W - 2 * M, titleH);
    ctx.fillStyle = GOLD;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = `800 ${Math.round(titleH * 0.34)}px Georgia, serif`;
    ctx.fillText(placeName || 'Your design', M + 24, M + titleH * 0.38);
    ctx.fillStyle = '#EFE7D6';
    ctx.font = `600 ${Math.round(titleH * 0.24)}px system-ui, sans-serif`;
    ctx.fillText(`${layer.no} — ${layer.label}`, M + 24, M + titleH * 0.74);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#C9BFA0';
    ctx.font = `600 ${Math.round(titleH * 0.2)}px system-ui, sans-serif`;
    ctx.fillText('ImbewuField · plan set', W - M - 24, M + titleH * 0.36);
    ctx.fillText(opts.dateStr, W - M - 24, M + titleH * 0.68);
    ctx.textAlign = 'left';
  }

  // ── Map area ──
  const mapX = M;
  const mapY = M + titleH + (titleH ? 18 : 0);
  const mapAreaW = W - 2 * M - (legendW ? legendW + 24 : 0);
  const mapAreaH = H - mapY - M - footH;

  // Render this layer's exact sheet, then letterbox it into the map area preserving aspect.
  const composite = await layer.render(state, frame, refLayers, site, placeName);
  const img = await loadImg(composite);
  const scale = Math.min(mapAreaW / img.width, mapAreaH / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const dx = mapX + (mapAreaW - drawW) / 2;
  const dy = mapY + (mapAreaH - drawH) / 2;
  ctx.drawImage(img, dx, dy, drawW, drawH);
  ctx.strokeStyle = 'rgba(11,18,11,0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(dx, dy, drawW, drawH);

  // ── Paper legend column (non-self-chromed pages only) ──
  if (showPaperFurniture && opts.legend) {
    const lx = W - M - legendW;
    const ly = mapY;
    ctx.fillStyle = '#F3ECDD';
    ctx.strokeStyle = 'rgba(11,18,11,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(lx, ly, legendW, mapAreaH);
    ctx.fill();
    ctx.stroke();
    const pad = 22;
    ctx.fillStyle = GREEN;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '800 30px Georgia, serif';
    ctx.fillText('Legend', lx + pad, ly + pad + 26);
    const rows = legendRows(state, layer, refLayers);
    const rowH = 44;
    let ry = ly + pad + 62;
    ctx.font = '500 25px system-ui, sans-serif';
    for (const row of rows) {
      if (ry > ly + mapAreaH - 30) {
        ctx.fillStyle = '#6B6355';
        ctx.fillText('…', lx + pad, ry);
        break;
      }
      ctx.fillStyle = row.swatch;
      ctx.strokeStyle = 'rgba(11,18,11,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(lx + pad + 12, ry - 8, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      let tx = lx + pad + 34;
      if (row.icon) {
        ctx.fillStyle = DARK;
        ctx.font = '24px sans-serif';
        ctx.fillText(row.icon, tx, ry);
        tx += 34;
      }
      ctx.fillStyle = '#241E12';
      ctx.font = '500 25px system-ui, sans-serif';
      const maxTextW = legendW - (tx - lx) - pad;
      let text = row.text;
      while (ctx.measureText(text).width > maxTextW && text.length > 4) text = text.slice(0, -2);
      if (text !== row.text) text = text.slice(0, -1) + '…';
      ctx.fillText(text, tx, ry);
      ry += rowH;
    }
    if (!rows.length) {
      ctx.fillStyle = '#6B6355';
      ctx.font = 'italic 24px system-ui, sans-serif';
      ctx.fillText('Nothing placed on this layer.', lx + pad, ry);
    }
  }

  // ── Scale bar + north arrow (non-self-chromed pages only) ──
  if (showPaperFurniture) {
    const fy = H - M - footH * 0.4;
    if (opts.scaleBar) {
      const pxPerM = drawW / (frame.imgW * frame.mPerPx);
      const nice = [5, 10, 20, 25, 50, 100, 200, 500];
      const target = drawW * 0.22;
      let metres = nice[0];
      for (const n of nice) if (n * pxPerM <= target) metres = n;
      const barW = metres * pxPerM;
      const bx = dx + 4; // anchor to the drawn image, not the margin (they diverge in the letterbox gap)
      ctx.strokeStyle = DARK;
      ctx.fillStyle = DARK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bx, fy);
      ctx.lineTo(bx + barW, fy);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, fy - 8); ctx.lineTo(bx, fy + 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx + barW, fy - 8); ctx.lineTo(bx + barW, fy + 8); ctx.stroke();
      ctx.font = '600 24px system-ui, sans-serif';
      ctx.textBaseline = 'bottom';
      ctx.textAlign = 'left';
      ctx.fillText(`${metres} m`, bx, fy - 12);
    }
    if (opts.northArrow) {
      const nx = dx + drawW - 30; // anchor to the drawn image, not the margin
      const ny = fy;
      ctx.fillStyle = DARK;
      ctx.strokeStyle = DARK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(nx, ny - 34);
      ctx.lineTo(nx - 11, ny);
      ctx.lineTo(nx, ny - 10);
      ctx.lineTo(nx + 11, ny);
      ctx.closePath();
      ctx.fill();
      ctx.font = '700 24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('N', nx, ny - 40);
    }
  }

  return canvas;
}

export default function DesignPrint({ state, frame, refLayers, site, placeName, onClose }: DesignPrintProps) {
  const { t } = useLanguage();
  const available = useMemo(
    () => new Set(PRINT_LAYERS.filter((l) => isLayerAvailable(l, state, refLayers, site)).map((l) => l.key)),
    [state, refLayers, site],
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set(available));
  const [paper, setPaper] = useState<'a4' | 'a3'>('a4');
  const [landscape, setLandscape] = useState(true);
  const [furniture, setFurniture] = useState({ titleBlock: true, legend: true, scaleBar: true, northArrow: true });
  const [busy, setBusy] = useState<null | 'pdf' | 'png' | 'share' | 'preview'>('preview');
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const dateStr = new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  const chosen = PRINT_LAYERS.filter((l) => selected.has(l.key));

  const optsFor = useCallback(
    () => ({ paper, landscape, ...furniture, dateStr }),
    [paper, landscape, furniture, dateStr],
  );

  // Live preview of the first selected page whenever the composition changes.
  useEffect(() => {
    let cancelled = false;
    const first = PRINT_LAYERS.find((l) => selected.has(l.key));
    if (!first) { setPreviewUrl(null); return; }
    setBusy('preview');
    renderPage(state, frame, refLayers, site, placeName ?? 'Your design', first, optsFor())
      .then((cv) => { if (!cancelled) { setPreviewUrl(cv.toDataURL('image/jpeg', 0.85)); setBusy(null); } })
      .catch(() => { if (!cancelled) setBusy(null); });
    return () => { cancelled = true; };
  }, [state, frame, refLayers, site, placeName, selected, paper, landscape, furniture, optsFor]);

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  // Shared pipeline: builds the exact same multi-page jsPDF doc used by both the Download and Share
  // buttons, so the shared file is byte-for-byte what "Export PDF" would have produced.
  const buildPdfDoc = useCallback(async () => {
    const [pw, ph] = PAPER_PX[paper];
    const W = landscape ? ph : pw;
    const H = landscape ? pw : ph;
    const doc = new jsPDF({ unit: 'px', format: [W, H], orientation: landscape ? 'landscape' : 'portrait', hotfixes: ['px_scaling'] });
    for (let i = 0; i < chosen.length; i++) {
      const cv = await renderPage(state, frame, refLayers, site, placeName ?? 'Your design', chosen[i], optsFor());
      if (i > 0) doc.addPage([W, H], landscape ? 'landscape' : 'portrait');
      doc.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, W, H);
    }
    return doc;
  }, [chosen, paper, landscape, state, frame, refLayers, site, placeName, optsFor]);

  const exportPdf = useCallback(async () => {
    if (!chosen.length) return;
    setBusy('pdf');
    setExportErr(null);
    try {
      const doc = await buildPdfDoc();
      doc.save(`${slug(placeName ?? 'site')}-plan-set.pdf`);
    } catch (e) {
      setExportErr(formatDesignTranslation(t('designPrintPdfError'), {
        error: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setBusy(null);
    }
  }, [chosen, buildPdfDoc, placeName]);

  // WhatsApp-first share: build the exact plan-set PDF via the same pipeline as Export PDF, wrap it
  // in a File, and hand it to the OS share sheet. If the platform can't share files (canShare fails),
  // fall back to triggering the normal download so the farmer still has the file, then share a link.
  const sharePlanSet = useCallback(async () => {
    if (!chosen.length) return;
    setBusy('share');
    setExportErr(null);
    try {
      const doc = await buildPdfDoc();
      const filename = `${slug(placeName ?? 'site')}-plan-set.pdf`;
      const shareTitle = placeName ? `${placeName} — plan set` : 'ImbewuField plan set';
      const shareText = 'My farm plan set — made with ImbewuField';

      const blob = doc.output('blob') as Blob;
      const file = new File([blob], filename, { type: 'application/pdf' });

      let canShareFiles = false;
      try {
        canShareFiles = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
      } catch {
        canShareFiles = false;
      }

      if (canShareFiles) {
        await navigator.share({ files: [file], title: shareTitle, text: shareText });
      } else {
        doc.save(filename); // farmer still gets the file even without file-share support
        await navigator.share({ title: shareTitle, text: shareText, url: 'https://imbewufield.vercel.app' });
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        // User cancelled the share sheet — not an error, swallow silently.
      } else {
        setExportErr(formatDesignTranslation(t('designPrintShareError'), {
          error: e instanceof Error ? e.message : String(e),
        }));
      }
    } finally {
      setBusy(null);
    }
  }, [chosen, buildPdfDoc, placeName]);

  const canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  const exportPngs = useCallback(async () => {
    if (!chosen.length) return;
    setBusy('png');
    setExportErr(null);
    try {
      for (const layer of chosen) {
        const cv = await renderPage(state, frame, refLayers, site, placeName ?? 'Your design', layer, optsFor());
        const a = document.createElement('a');
        a.href = cv.toDataURL('image/png');
        a.download = `${slug(placeName ?? 'site')}-${layer.no}-${layer.key}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        await new Promise((r) => setTimeout(r, 250)); // let each download start
      }
    } catch (e) {
      setExportErr(formatDesignTranslation(t('designPrintPngError'), {
        error: e instanceof Error ? e.message : String(e),
      }));
    } finally {
      setBusy(null);
    }
  }, [chosen, state, frame, refLayers, site, placeName, optsFor]);

  const chk = (on: boolean) => ({
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10,
    border: on ? `2px solid ${GREEN}` : '1px solid rgba(0,0,0,0.2)', background: on ? 'rgba(31,77,43,0.08)' : 'transparent',
    color: DARK, fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
  } as const);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,12,8,0.5)', display: 'flex', justifyContent: 'center', padding: 0 }}>
      <div style={{ width: '100%', maxWidth: 1180, background: PAPER, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.12)' }}>
          <FileDown size={20} color={GREEN} />
          <div style={{ fontWeight: 800, fontSize: 16, color: DARK }}>{t('designPrintTitle')}</div>
          <div style={{ fontSize: 12, color: '#6B6355' }}>{t('designPrintSubtitle')}</div>
          <span style={{ marginLeft: 'auto' }}><LessonLink id="print:planset" label={t('designLearn')} /></span>
          <button onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: DARK, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            <X size={18} /> {t('designClose')}
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column', overflowY: 'auto' }}>
          {/* Controls */}
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.55, marginBottom: 8 }}>{t('designPrintSheets')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PRINT_LAYERS.map((l) => {
                  const canUse = available.has(l.key);
                  return (
                    <button
                      key={l.key}
                      onClick={() => canUse && toggle(l.key)}
                      disabled={!canUse}
                      aria-pressed={selected.has(l.key)}
                      title={canUse ? undefined : t('designPrintNothingDrawn')}
                      style={{ ...chk(selected.has(l.key) && canUse), opacity: canUse ? 1 : 0.4, cursor: canUse ? 'pointer' : 'default' }}
                    >
                      <span>{!canUse ? '·' : selected.has(l.key) ? '☑' : '☐'}</span> {l.no} · {l.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.55, marginBottom: 8 }}>{t('designPrintPaper')}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['a4', 'a3'] as const).map((p) => (
                    <button key={p} onClick={() => setPaper(p)} style={chk(paper === p)}>{p.toUpperCase()}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.55, marginBottom: 8 }}>{t('designPrintOrientation')}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setLandscape(true)} style={chk(landscape)}>{t('designPrintLandscape')}</button>
                  <button onClick={() => setLandscape(false)} style={chk(!landscape)}>{t('designPrintPortrait')}</button>
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.55, marginBottom: 8 }}>{t('designPrintInclude')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {([['titleBlock', 'designPrintTitleBlock'], ['legend', 'designPrintLegend'], ['scaleBar', 'designPrintScaleBar'], ['northArrow', 'designPrintNorthArrow']] as const).map(([k, labelKey]) => (
                  <button key={k} onClick={() => setFurniture((f) => ({ ...f, [k]: !f[k] }))} aria-pressed={furniture[k]} style={chk(furniture[k])}>
                    <span>{furniture[k] ? '☑' : '☐'}</span> {t(labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={exportPdf} disabled={!chosen.length || busy === 'pdf' || busy === 'png'} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 48, padding: '12px 22px', borderRadius: 12, border: 'none', background: GREEN, color: PAPER, fontWeight: 800, fontSize: 15, cursor: chosen.length ? 'pointer' : 'default', opacity: chosen.length && busy !== 'pdf' ? 1 : 0.6 }}>
                {busy === 'pdf' ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />}
                {busy === 'pdf'
                  ? t('designPrintBuildingPdf')
                  : formatDesignTranslation(t('designPrintExportPdf'), {
                    count: chosen.length,
                    pages: t(chosen.length === 1 ? 'designPrintPage' : 'designPrintPages'),
                  })}
              </button>
              <button onClick={exportPngs} disabled={!chosen.length || busy === 'pdf' || busy === 'png'} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 48, padding: '12px 22px', borderRadius: 12, border: `1px solid ${GREEN}`, background: 'transparent', color: GREEN, fontWeight: 800, fontSize: 15, cursor: chosen.length ? 'pointer' : 'default', opacity: chosen.length && busy !== 'png' ? 1 : 0.6 }}>
                {busy === 'png' ? <Loader2 size={18} className="animate-spin" /> : <Images size={18} />}
                {busy === 'png' ? t('designPrintSavingPngs') : t('designPrintExportPngs')}
              </button>
              {canNativeShare && (
                <button onClick={sharePlanSet} disabled={!chosen.length || busy === 'pdf' || busy === 'png' || busy === 'share'} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 48, padding: '12px 22px', borderRadius: 12, border: `2px solid ${GREEN}`, background: '#25D366', color: '#08210F', fontWeight: 800, fontSize: 15, cursor: chosen.length ? 'pointer' : 'default', opacity: chosen.length && busy !== 'share' ? 1 : 0.6 }}>
                  {busy === 'share' ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
                  {busy === 'share' ? t('designPrintPreparing') : t('designPrintShare')}
                </button>
              )}
            </div>
            {exportErr && <div style={{ color: '#B3261E', fontSize: 13, fontWeight: 600 }}>{exportErr}</div>}
          </div>

          {/* Preview */}
          <div ref={previewRef} style={{ padding: 16, borderTop: '1px solid rgba(0,0,0,0.1)', background: '#EDE7DA', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6B6355', alignSelf: 'flex-start' }}>
              {t('designPrintPreview')} · {t('designPrintFirstPage')}
              {chosen.length > 1 ? ` ${formatDesignTranslation(t('designPrintOfPages'), { count: chosen.length })}` : ''}
            </div>
            {busy === 'preview' && !previewUrl ? (
              <div style={{ padding: 40, color: '#6B6355', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Loader2 size={20} className="animate-spin" /> {t('designPrintRendering')}
              </div>
            ) : previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={t('designPrintPreviewAlt')} style={{ maxWidth: '100%', maxHeight: 620, boxShadow: '0 6px 24px rgba(0,0,0,0.25)', borderRadius: 4 }} />
            ) : (
              <div style={{ padding: 40, color: '#6B6355' }}>{t('designPrintSelectSheet')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

// Design Studio — Print / Export composer. Turns the EXACT (deterministic) design maps into a
// publishable plan set: the canonical 8-map package (docs/PLAN-SET-SPEC.md), each a print page with
// a numbered title block, then a multi-page PDF or per-sheet PNGs. Everything is deterministic (no
// AI) so the output is always correct and print-ready.
//
// TWO kinds of page:
//  • SELF-CHROMED sheets (02 Sector, 03 Zones, 04 Water, 05 Planting, 06 Structures, 08
//    Implementation) already carry their own legend / scale / north from the Blueprint chrome, so
//    the page just adds a numbered title strip and letterboxes the sheet FULL WIDTH (no paper
//    legend column — that would double-chrome).
//  • PAPER-FURNITURE sheets (01 Base, 07 Masterplan) are plain composites, so the page draws the
//    title block + legend column + scale bar + north arrow around them, as before.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, FileDown, Images, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';

import type { CanvasFrame, DesignCanvasState } from '@/lib/design-canvas';
import type { SectorSite } from '@/lib/sector';
import { ELEMENTS_BY_ID, ZONE_DEFS } from '@/lib/design-elements';
import {
  buildComposite,
  buildBlueprintSectorMap,
  buildBlueprintZoneMap,
  buildBlueprintWaterMap,
  buildBlueprintPlantingMap,
  buildBlueprintStructuresMap,
  buildImplementationMap,
  itemInFilter,
  layerContentCount,
  type GlossyLayerFilter,
} from './DesignGlossy';
import { buildPhasePlan } from '@/lib/phasing';

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
  no: string; // '01'..'08'
  label: string;
  selfChromed: boolean; // sheet carries its own legend/scale/north (a Blueprint sheet)
  render: (state: DesignCanvasState, frame: CanvasFrame, refLayers: RefLayers, site: SectorSite | null, placeName?: string) => Promise<string>;
  // Only used to draw the PAPER legend on the two non-self-chromed pages.
  filter?: GlossyLayerFilter;
  drawDesign?: boolean;
};

// The canonical 8-map package, in order (docs/PLAN-SET-SPEC.md). Analysis (02) precedes design.
const PRINT_LAYERS: PrintLayer[] = [
  { key: 'base', no: '01', label: 'Existing Site & Base', selfChromed: false, filter: 'all', drawDesign: false, render: (s, f, r) => buildComposite(s, f, r, 'all', false) },
  { key: 'sector', no: '02', label: 'Sector Analysis', selfChromed: true, render: (s, f, r, site, pn) => buildBlueprintSectorMap(s, f, r, site, pn) },
  { key: 'zones', no: '03', label: 'Permaculture Zones', selfChromed: true, render: (s, f, r, _site, pn) => buildBlueprintZoneMap(s, f, r, pn) },
  { key: 'water', no: '04', label: 'Water & Irrigation', selfChromed: true, render: (s, f, r, _site, pn) => buildBlueprintWaterMap(s, f, r, pn) },
  { key: 'planting', no: '05', label: 'Planting & Agroforestry', selfChromed: true, render: (s, f, r, _site, pn) => buildBlueprintPlantingMap(s, f, r, pn) },
  { key: 'structures', no: '06', label: 'Livestock & Infrastructure', selfChromed: true, render: (s, f, r, _site, pn) => buildBlueprintStructuresMap(s, f, r, pn) },
  { key: 'all', no: '07', label: 'Integrated Masterplan', selfChromed: false, filter: 'all', drawDesign: true, render: (s, f, r) => buildComposite(s, f, r, 'all', true) },
  { key: 'implementation', no: '08', label: 'Implementation & Phasing', selfChromed: true, render: (s, f, r, site, pn) => buildImplementationMap(s, f, r, site, pn) },
];

// A sheet is exportable only when it has something true to say — mirrors the Glossy generate-all
// skip so Print can't emit an empty Zones sheet or a phase-less Implementation sheet (a fundable
// plan set must never show a confident page built on nothing).
function isLayerAvailable(layer: PrintLayer, state: DesignCanvasState, refLayers: RefLayers, site: SectorSite | null): boolean {
  if (layer.key === 'implementation') return buildPhasePlan(state, refLayers, site).phases.length > 0;
  if (layer.key === 'zones' || layer.key === 'water' || layer.key === 'planting' || layer.key === 'structures') {
    return layerContentCount(state, refLayers, layer.key) > 0;
  }
  return true; // 01 base · 02 sector · 07 masterplan are always meaningful (satellite + boundary + energies)
}

// Paper pixel sizes at ~150 DPI, portrait [w, h].
const PAPER_PX: Record<'a4' | 'a3', [number, number]> = {
  a4: [1240, 1754],
  a3: [1754, 2480],
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
function legendRows(state: DesignCanvasState, layer: PrintLayer): Array<{ swatch: string; icon?: string; text: string }> {
  const filter = layer.filter ?? 'all';
  if (!layer.drawDesign) {
    return [
      { swatch: '#8CEB6A', text: 'Property boundary' },
      { swatch: '#3A352C', text: 'House / roof' },
      { swatch: '#3B3A3E', text: 'Driveway (tar)' },
    ];
  }
  const rows: Array<{ swatch: string; icon?: string; text: string }> = [];
  for (const z of state.zones) {
    if (z.feature || z.points.length < 3) continue;
    rows.push({ swatch: ZONE_DEFS[z.zone].color, text: `Zone ${z.zone} — ${ZONE_DEFS[z.zone].label}` });
  }
  const groups = new Map<string, { icon: string; color: string; n: number }>();
  for (const it of state.items) {
    const def = ELEMENTS_BY_ID[it.defId];
    if (!def || !itemInFilter(def.category, filter)) continue;
    const name = it.label ?? def.name;
    const g = groups.get(name) ?? { icon: def.icon, color: def.color, n: 0 };
    g.n += 1;
    groups.set(name, g);
  }
  for (const [name, g] of groups) rows.push({ swatch: g.color, icon: g.icon, text: `${name}${g.n > 1 ? ` ×${g.n}` : ''}` });
  return rows;
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
    const rows = legendRows(state, layer);
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
  const available = useMemo(
    () => new Set(PRINT_LAYERS.filter((l) => isLayerAvailable(l, state, refLayers, site)).map((l) => l.key)),
    [state, refLayers, site],
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set(available));
  const [paper, setPaper] = useState<'a4' | 'a3'>('a4');
  const [landscape, setLandscape] = useState(true);
  const [furniture, setFurniture] = useState({ titleBlock: true, legend: true, scaleBar: true, northArrow: true });
  const [busy, setBusy] = useState<null | 'pdf' | 'png' | 'preview'>('preview');
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

  const exportPdf = useCallback(async () => {
    if (!chosen.length) return;
    setBusy('pdf');
    setExportErr(null);
    try {
      const [pw, ph] = PAPER_PX[paper];
      const W = landscape ? ph : pw;
      const H = landscape ? pw : ph;
      const doc = new jsPDF({ unit: 'px', format: [W, H], orientation: landscape ? 'landscape' : 'portrait', hotfixes: ['px_scaling'] });
      for (let i = 0; i < chosen.length; i++) {
        const cv = await renderPage(state, frame, refLayers, site, placeName ?? 'Your design', chosen[i], optsFor());
        if (i > 0) doc.addPage([W, H], landscape ? 'landscape' : 'portrait');
        doc.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, W, H);
      }
      doc.save(`${slug(placeName ?? 'site')}-plan-set.pdf`);
    } catch (e) {
      setExportErr(`Could not build the PDF: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }, [chosen, paper, landscape, state, frame, refLayers, site, placeName, optsFor]);

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
      setExportErr(`Could not save the PNGs: ${e instanceof Error ? e.message : String(e)}`);
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
          <div style={{ fontWeight: 800, fontSize: 16, color: DARK }}>Print / Export</div>
          <div style={{ fontSize: 12, color: '#6B6355' }}>8-map plan set · exact · print-ready</div>
          <button onClick={onClose} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: DARK, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            <X size={18} /> Close
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column', overflowY: 'auto' }}>
          {/* Controls */}
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.55, marginBottom: 8 }}>Sheets (one page each)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PRINT_LAYERS.map((l) => {
                  const canUse = available.has(l.key);
                  return (
                    <button
                      key={l.key}
                      onClick={() => canUse && toggle(l.key)}
                      disabled={!canUse}
                      aria-pressed={selected.has(l.key)}
                      title={canUse ? undefined : 'Nothing drawn on this layer yet'}
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
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.55, marginBottom: 8 }}>Paper</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['a4', 'a3'] as const).map((p) => (
                    <button key={p} onClick={() => setPaper(p)} style={chk(paper === p)}>{p.toUpperCase()}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.55, marginBottom: 8 }}>Orientation</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setLandscape(true)} style={chk(landscape)}>Landscape</button>
                  <button onClick={() => setLandscape(false)} style={chk(!landscape)}>Portrait</button>
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.55, marginBottom: 8 }}>Include (legend / scale / north apply to the Base &amp; Masterplan pages only)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {([['titleBlock', 'Title block'], ['legend', 'Legend'], ['scaleBar', 'Scale bar'], ['northArrow', 'North arrow']] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setFurniture((f) => ({ ...f, [k]: !f[k] }))} aria-pressed={furniture[k]} style={chk(furniture[k])}>
                    <span>{furniture[k] ? '☑' : '☐'}</span> {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={exportPdf} disabled={!chosen.length || busy === 'pdf' || busy === 'png'} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 48, padding: '12px 22px', borderRadius: 12, border: 'none', background: GREEN, color: PAPER, fontWeight: 800, fontSize: 15, cursor: chosen.length ? 'pointer' : 'default', opacity: chosen.length && busy !== 'pdf' ? 1 : 0.6 }}>
                {busy === 'pdf' ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />}
                {busy === 'pdf' ? 'Building PDF…' : `Export PDF (${chosen.length} page${chosen.length === 1 ? '' : 's'})`}
              </button>
              <button onClick={exportPngs} disabled={!chosen.length || busy === 'pdf' || busy === 'png'} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 48, padding: '12px 22px', borderRadius: 12, border: `1px solid ${GREEN}`, background: 'transparent', color: GREEN, fontWeight: 800, fontSize: 15, cursor: chosen.length ? 'pointer' : 'default', opacity: chosen.length && busy !== 'png' ? 1 : 0.6 }}>
                {busy === 'png' ? <Loader2 size={18} className="animate-spin" /> : <Images size={18} />}
                {busy === 'png' ? 'Saving PNGs…' : 'Export PNGs'}
              </button>
            </div>
            {exportErr && <div style={{ color: '#B3261E', fontSize: 13, fontWeight: 600 }}>{exportErr}</div>}
          </div>

          {/* Preview */}
          <div ref={previewRef} style={{ padding: 16, borderTop: '1px solid rgba(0,0,0,0.1)', background: '#EDE7DA', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6B6355', alignSelf: 'flex-start' }}>
              Preview · first page{chosen.length > 1 ? ` of ${chosen.length}` : ''}
            </div>
            {busy === 'preview' && !previewUrl ? (
              <div style={{ padding: 40, color: '#6B6355', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Loader2 size={20} className="animate-spin" /> Rendering…
              </div>
            ) : previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Print preview" style={{ maxWidth: '100%', maxHeight: 620, boxShadow: '0 6px 24px rgba(0,0,0,0.25)', borderRadius: 4 }} />
            ) : (
              <div style={{ padding: 40, color: '#6B6355' }}>Select at least one sheet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

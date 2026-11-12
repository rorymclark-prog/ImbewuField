'use client';

// "Why not this month?": the crop planner's climate gate, shown. The planner silently drops a
// sowing month when lib/crop-climate-gate.ts judges that the crop would grow through a month too
// hot for it or, on a rain-fed plan, too dry. This figure slides one crop's bed months across this
// site's year, one sowing month at a time, and turns red the months the gate would refuse on.
//
// Every number on it comes from lib/crop-gate-year.ts, which only composes the gate's own
// functions (Thornthwaite evaporation, the half-evaporation wet-month test, judgeFieldMonths) with
// the planner's bed months (occupiedMonthsForPlanting). The data is monthly, so the figure steps
// by month; the short slide between steps is a transition, not a reading. Reduced motion gets a
// still, complete state with every control live.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { numberLabel } from '@/lib/format-figures';
import type { CropDef, RainPattern } from '@/lib/crop-catalog';
import {
  GATE_YEAR_ORDER,
  climateYear,
  dryMonthsOf,
  gateFigureCrops,
  heatHeadroom,
  sowingYear,
  type ClimateMonth,
  type GateYearSite,
  type HeatHeadroom,
  type SowingVerdict,
} from '@/lib/crop-gate-year';
import s from './CropGateYear.module.css';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));
const STEP_SECONDS = 2.6;
const SLIDE_SECONDS = 0.45;

// The planner's own names for the regional calendars (crop-autosuggest.ts CALENDAR_NAME).
const CALENDAR_NAME: Record<RainPattern, string> = {
  summer: 'summer-rainfall, hard-frost',
  winter: 'winter-rainfall',
  'all-year': 'frost-free',
  'mild-frost': 'summer-rainfall, light-frost',
};

interface Props {
  site: GateYearSite;
  /** Where the monthly rain and temperature come from, said in the note under the figure. */
  climateSource: string;
}

interface Palette {
  ink: string;
  ink2: string;
  muted: string;
  card: string;
  inset: string;
  water: string;
  warn: string;
  grow: string;
  font: string;
}

function readPalette(el: HTMLElement): Palette {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    ink: v('--text-primary', '#261B10'),
    ink2: v('--text-secondary', '#6A5040'),
    muted: v('--text-muted', '#755942'),
    card: v('--bg-1', '#FFFEFA'),
    inset: v('--bg-0', '#E4DCC6'),
    water: v('--blue', '#1C5A9E'),
    warn: v('--orange', '#B83A18'),
    grow: v('--emerald', '#346A15'),
    font: v('--font-sans', 'system-ui, sans-serif'),
  };
}

/** Catalog names carry a gloss in brackets ("Swiss chard (spinach)"); sentences use the plain name. */
const plainName = (crop: CropDef) => crop.name.replace(/\s*\(.*\)\s*$/, '');
const lowerName = (crop: CropDef) => {
  const n = plainName(crop);
  return /^Swiss/.test(n) ? n : n.charAt(0).toLowerCase() + n.slice(1);
};
const deg = (c: number) => `${numberLabel(c, 1)} °C`;
const mm = (v: number) => `${numberLabel(v, 1)} mm`;

/** Months as words, consecutive runs (in the October-first year) joined: "May to August". */
function monthList(months: readonly number[]): string {
  const pos = (m: number) => GATE_YEAR_ORDER.indexOf(m as (typeof GATE_YEAR_ORDER)[number]);
  const sorted = [...new Set(months)].sort((a, b) => pos(a) - pos(b));
  const runs: number[][] = [];
  for (const m of sorted) {
    const last = runs[runs.length - 1];
    if (last && pos(m) === pos(last[last.length - 1]) + 1) last.push(m); else runs.push([m]);
  }
  const words = runs.map((r) => (r.length >= 3 ? `${MONTH_NAMES[r[0] - 1]} to ${MONTH_NAMES[r[r.length - 1] - 1]}` : r.map((m) => MONTH_NAMES[m - 1]).join(' and ')));
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

const plural = (months: readonly number[], one: string, many: string) => (new Set(months).size === 1 ? one : many);

function timingSentence(crop: CropDef, v: SowingVerdict): string {
  const name = plainName(crop);
  const first = v.fieldMonths[0];
  const last = v.fieldMonths[v.fieldMonths.length - 1];
  const h0 = v.harvestMonths[0];
  const h1 = v.harvestMonths[v.harvestMonths.length - 1];
  const harvest = h0 === h1 ? `harvested in ${MONTH_NAMES[h0 - 1]}` : `harvested ${MONTH_NAMES[h0 - 1]} to ${MONTH_NAMES[h1 - 1]}`;
  if (v.trayMonth) {
    return `${name} sown in ${MONTH_NAMES[v.sowMonth - 1]} starts in a seed tray; the bed is kept for it from ${MONTH_NAMES[first - 1]} to ${MONTH_NAMES[last - 1]}, ${harvest}.`;
  }
  return `${name} sown in ${MONTH_NAMES[v.sowMonth - 1]} holds its bed from ${MONTH_NAMES[first - 1]} to ${MONTH_NAMES[last - 1]}, ${harvest}.`;
}

function reasonSentence(crop: CropDef, v: SowingVerdict, limitC: number): string {
  if (v.verdict === 'too-hot') {
    return `${monthList(v.hotMonths)} ${plural(v.hotMonths, 'averages', 'average')} above ${lowerName(crop)}’s heat limit of ${deg(limitC)}: too hot.`;
  }
  return `${monthList(v.dryMonths)} ${plural(v.dryMonths, 'gets', 'get')} less rain than half of what the air can evaporate: too dry without irrigation.`;
}

function monthSentence(crop: CropDef, v: SowingVerdict, rainFed: boolean, pattern: RainPattern, limitC: number): string {
  const head = timingSentence(crop, v);
  const month = MONTH_NAMES[v.sowMonth - 1];
  if (!v.inCalendar) {
    const also = v.verdict !== 'ok' ? ` Had it been, the climate check would refuse it too. ${reasonSentence(crop, v, limitC)}` : '';
    return `${head} The ${CALENDAR_NAME[pattern]} sowing calendar does not sow ${lowerName(crop)} in ${month}, so the planner never offers this month.${also}`;
  }
  if (v.verdict !== 'ok') return `${head} ${reasonSentence(crop, v, limitC)} The planner will not suggest ${month}.`;
  if (rainFed) {
    return `${head} Every month in the bed gets at least half its evaporation as rain, and none is hotter than ${deg(limitC)}. The planner may suggest ${month}.`;
  }
  const dry = v.dryMonths.length
    ? ` ${monthList(v.dryMonths)} still ${plural(v.dryMonths, 'gets', 'get')} less rain than half the evaporation: that water has to come from somewhere other than rain.`
    : ' Rain alone covers half the evaporation in every month in the bed.';
  return `${head} With reliable irrigation the planner checks heat only, and no month here is hotter than ${deg(limitC)}, so it may suggest ${month}.${dry}`;
}

function summarySentence(crop: CropDef, year: SowingVerdict[], irrigated: SowingVerdict[], rainFed: boolean, dry: number[], heat: HeatHeadroom, pattern: RainPattern): string {
  const cal = year.filter((v) => v.inCalendar);
  const ok = cal.filter((v) => v.verdict === 'ok').map((v) => v.sowMonth);
  const refused = cal.filter((v) => v.verdict !== 'ok').map((v) => v.sowMonth);
  const name = plainName(crop);
  const heatLine = heat.binds
    ? ` Heat binds here: ${MONTH_NAMES[heat.hottestMonth - 1]} averages ${deg(heat.hottestC)}, above ${lowerName(crop)}’s limit of ${deg(heat.limitC)}.`
    : ` Heat never binds here: the hottest month, ${MONTH_NAMES[heat.hottestMonth - 1]}, averages ${deg(heat.hottestC)}, below ${lowerName(crop)}’s limit of ${deg(heat.limitC)}.`;
  let line: string;
  if (cal.length === 0) {
    line = `The ${CALENDAR_NAME[pattern]} calendar gives ${lowerName(crop)} no sowing month here.`;
  } else if (rainFed && ok.length === 0) {
    const irrOk = irrigated.filter((v) => v.inCalendar && v.verdict === 'ok').length;
    line = `Rain-fed, the planner will not sow ${lowerName(crop)} in any month of its sowing calendar (${monthList(cal.map((v) => v.sowMonth))}): every one grows into ${monthList(dry)}, when the rain falls short.${irrOk === cal.length ? ' With reliable irrigation it would offer all of them.' : ''}`;
  } else if (rainFed) {
    const why = refused.some((m) => year[m - 1].verdict === 'too-dry') ? ` ${monthList(refused)} would grow into ${monthList(dry)}, when the rain falls short.` : '';
    line = `Rain-fed, the planner may sow ${lowerName(crop)} in ${monthList(ok)}: ${ok.length} of the ${cal.length} months in its sowing calendar.${refused.length ? why : ''}`;
  } else {
    line = `With reliable irrigation the planner may sow ${lowerName(crop)} in ${monthList(ok)}: ${ok.length} of the ${cal.length} months in its sowing calendar.${dry.length ? ` In ${monthList(dry)} the water has to come from somewhere other than rain.` : ''}`;
  }
  return `${name}. ${line}${heatLine}`;
}

/** The display column (0 = October) of a calendar month. */
const colOf = (month: number) => GATE_YEAR_ORDER.indexOf(month as (typeof GATE_YEAR_ORDER)[number]);

export default function CropGateYear({ site, climateSource }: Props) {
  const crops = useMemo(() => gateFigureCrops(), []);
  const year = useMemo(() => climateYear(site), [site]);
  const dry = useMemo(() => (year ? dryMonthsOf(year) : []), [year]);
  const [cropKey, setCropKey] = useState(crops[0]?.key ?? '');
  const crop = crops.find((c) => c.key === cropKey) ?? crops[0];
  const [rainFed, setRainFed] = useState(true);
  const verdicts = useMemo(() => (crop ? sowingYear(crop, site, rainFed) : null), [crop, site, rainFed]);
  const irrigated = useMemo(() => (crop ? sowingYear(crop, site, false) : null), [crop, site]);
  const heat = useMemo(() => (crop ? heatHeadroom(crop, site) : null), [crop, site]);
  // The sowing month shown, as a display column (0 = October).
  const [col, setCol] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);

  const v = verdicts ? verdicts[GATE_YEAR_ORDER[col] - 1] : null;
  const caption = crop && v && heat ? monthSentence(crop, v, rainFed, site.pattern, heat.limitC) : '';
  const summary = crop && verdicts && irrigated && heat ? summarySentence(crop, verdicts, irrigated, rainFed, dry, heat, site.pattern) : '';
  const cal = verdicts ? verdicts.filter((x) => x.inCalendar) : [];
  const allowed = cal.filter((x) => x.verdict === 'ok').length;

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const live = useRef({
    t: 0,
    col: 0,
    fromCol: 0,
    slide: 1,
    playing: true,
    reduced: false,
    visible: true,
    year: year as ClimateMonth[] | null,
    verdicts: verdicts as SowingVerdict[] | null,
    heat: heat as HeatHeadroom | null,
    crop: crop as CropDef | undefined,
    rainFed,
    w: 0,
    h: 0,
    dpr: 1,
    palette: null as Palette | null,
    draw: null as null | (() => void),
    setCol: (_c: number) => {},
  });

  useEffect(() => {
    const L = live.current;
    L.year = year; L.verdicts = verdicts; L.heat = heat; L.crop = crop; L.rainFed = rainFed;
    L.draw?.();
  }, [year, verdicts, heat, crop, rainFed]);

  useEffect(() => { live.current.playing = playing && !reduced; }, [playing, reduced]);

  const goTo = useCallback((c: number, slide: boolean) => {
    const L = live.current;
    const next = ((c % 12) + 12) % 12;
    if (next === L.col) return;
    L.fromCol = L.col;
    L.col = next;
    // A slide only between neighbouring months; a jump is a jump.
    L.slide = slide && !L.reduced && Math.abs(next - L.fromCol) === 1 ? 0 : 1;
    setCol(next);
    L.draw?.();
  }, []);

  useEffect(() => { live.current.setCol = (c: number) => goTo(c, true); }, [goTo]);

  // Reduced motion: a still on the first calendar sowing the gate refuses (else the first the
  // calendar offers), so the one picture carries a red month and its reason. Controls stay live.
  useEffect(() => {
    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const apply = () => {
      const r = !!mq?.matches;
      live.current.reduced = r;
      live.current.playing = !r && playing;
      setReduced(r);
      if (r) {
        const vs = live.current.verdicts ?? [];
        const pick = GATE_YEAR_ORDER.find((m) => vs[m - 1]?.inCalendar && vs[m - 1]?.verdict !== 'ok')
          ?? GATE_YEAR_ORDER.find((m) => vs[m - 1]?.inCalendar);
        if (pick) goTo(colOf(pick), false);
      }
      live.current.draw?.();
    };
    apply();
    mq?.addEventListener('change', apply);
    return () => mq?.removeEventListener('change', apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goTo]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const L = live.current;

    const rows = (w: number) => {
      const narrow = w < 560;
      const band = 20;
      const p1 = narrow ? 104 : 132;
      const p2 = narrow ? 66 : 80;
      const bed = narrow ? 30 : 32;
      const strip = narrow ? 28 : 30;
      let y = 0;
      const t1 = y; y += band;
      const r1 = y; y += p1 + 12;
      const t2 = y; y += band;
      const r2 = y; y += p2 + 12;
      const t3 = y; y += band + 10; // room for the sow marker under the row title
      const r3 = y; y += bed + 10;
      const t4 = y; y += band;
      const r4 = y; y += strip;
      const lab = y + 16; y += 22;
      return { narrow, t1, r1, p1, t2, r2, p2, t3, r3, bed, t4, r4, strip, lab, h: y };
    };

    const layout = () => {
      const w = Math.max(280, Math.round(wrap.clientWidth));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const h = rows(w).h;
      L.w = w; L.h = h; L.dpr = dpr;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = `${h}px`;
      L.palette = readPalette(wrap);
    };

    const hatch = (x: number, y: number, w: number, h: number, color: string, gap = 5) => {
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = -h; k < w; k += gap) { ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + h, y); }
      ctx.stroke();
      ctx.restore();
    };

    const draw = () => {
      const P = L.palette;
      const yr = L.year;
      const vs = L.verdicts;
      const cr = L.crop;
      const ht = L.heat;
      if (!P || !L.w) return;
      ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
      ctx.clearRect(0, 0, L.w, L.h);
      if (!yr || !vs || !cr || !ht) return;
      const g = rows(L.w);
      const sx0 = 8; const sx1 = L.w - 8; const cw = (sx1 - sx0) / 12;
      const colX = (c: number) => sx0 + c * cw;
      const cur = vs[GATE_YEAR_ORDER[L.col] - 1];
      const field = new Set(cur.fieldMonths);
      const refusedHere = (m: number) => field.has(m) && (
        (cur.verdict === 'too-dry' && cur.dryMonths.includes(m)) || (cur.verdict === 'too-hot' && cur.hotMonths.includes(m)));
      const ease = (x: number) => 1 - (1 - x) ** 3;
      // Slide offset: the bar starts one column back (or forward) and settles on its month.
      const dx = L.slide >= 1 ? 0 : (1 - ease(L.slide)) * (L.fromCol - L.col) * cw;

      ctx.textBaseline = 'alphabetic';

      // ── Dry columns: a faint tint behind both climate panels, the same in every state.
      for (const m of dry) {
        ctx.save();
        ctx.fillStyle = P.warn; ctx.globalAlpha = 0.07;
        ctx.fillRect(colX(colOf(m)), g.r1 - 4, cw, g.r2 + g.p2 - g.r1 + 8);
        ctx.restore();
      }

      // ── Panel 1: rain against half the evaporation.
      const maxMm = Math.max(...yr.map((m) => Math.max(m.rainMm, m.halfPetMm)), 1) * 1.14;
      const base1 = g.r1 + g.p1;
      const yMm = (v: number) => base1 - (v / maxMm) * g.p1;
      ctx.save();
      ctx.font = `600 12px ${P.font}`; ctx.fillStyle = P.ink2; ctx.textAlign = 'left';
      ctx.fillText(g.narrow ? 'Rain, and half the evaporation' : 'Rain each month, and half of what the air can evaporate', sx0, g.t1 + 14);
      ctx.strokeStyle = P.ink; ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx0, base1); ctx.lineTo(sx1, base1); ctx.stroke();
      ctx.restore();
      GATE_YEAR_ORDER.forEach((month, c) => {
        const m = yr[month - 1];
        const x = colX(c);
        const bw = Math.min(cw * 0.46, 30);
        const bx = x + (cw - bw) / 2;
        const red = refusedHere(month);
        // shortfall: the gap between the rain and the half-evaporation line
        if (!m.rainFed) {
          ctx.save();
          ctx.globalAlpha = red ? 0.9 : 0.55;
          hatch(bx, yMm(m.halfPetMm), bw, yMm(m.rainMm) - yMm(m.halfPetMm), P.warn, 4);
          ctx.restore();
        }
        ctx.save();
        ctx.fillStyle = P.water; ctx.globalAlpha = 0.62;
        ctx.fillRect(bx, yMm(m.rainMm), bw, base1 - yMm(m.rainMm));
        ctx.restore();
        // half-evaporation mark across the column
        ctx.save();
        ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.moveTo(x + cw * 0.12, yMm(m.halfPetMm)); ctx.lineTo(x + cw * 0.88, yMm(m.halfPetMm)); ctx.stroke();
        ctx.restore();
        if (red) {
          ctx.save();
          ctx.strokeStyle = P.warn; ctx.lineWidth = 2;
          ctx.strokeRect(x + 1.5, g.r1 - 2, cw - 3, g.p1 + 4);
          ctx.restore();
        }
        if (!g.narrow) {
          ctx.save();
          ctx.font = `12px ${P.font}`; ctx.fillStyle = P.ink2; ctx.textAlign = 'center';
          const top = Math.min(yMm(m.rainMm), yMm(m.halfPetMm));
          ctx.fillText(numberLabel(Math.round(m.rainMm)), x + cw / 2, top - 6);
          ctx.restore();
        }
      });
      // step connectors for the half-evaporation line
      ctx.save();
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1; ctx.globalAlpha = 0.35; ctx.setLineDash([2, 3]);
      ctx.beginPath();
      for (let c = 0; c < 11; c += 1) {
        const a = yr[GATE_YEAR_ORDER[c] - 1].halfPetMm; const b = yr[GATE_YEAR_ORDER[c + 1] - 1].halfPetMm;
        ctx.moveTo(colX(c) + cw * 0.88, yMm(a)); ctx.lineTo(colX(c + 1) + cw * 0.12, yMm(b));
      }
      ctx.stroke();
      ctx.restore();

      // ── Panel 2: mean temperature against the crop's heat limit.
      const lo = Math.min(0, ...yr.map((m) => m.tempC));
      const hi = Math.max(ht.limitC, ...yr.map((m) => m.tempC)) * 1.08;
      const base2 = g.r2 + g.p2;
      const yC = (t: number) => base2 - ((t - lo) / (hi - lo)) * g.p2;
      const name = plainName(cr);
      ctx.save();
      ctx.font = `600 12px ${P.font}`; ctx.fillStyle = P.ink2; ctx.textAlign = 'left';
      ctx.fillText(g.narrow ? 'Mean temperature, and the heat limit' : `Mean temperature each month, and ${lowerName(cr)}’s heat limit`, sx0, g.t2 + 14);
      ctx.strokeStyle = P.ink; ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx0, base2); ctx.lineTo(sx1, base2); ctx.stroke();
      ctx.globalAlpha = 1; ctx.strokeStyle = P.warn; ctx.lineWidth = 1.6; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(sx0, yC(ht.limitC)); ctx.lineTo(sx1, yC(ht.limitC)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `600 12px ${P.font}`; ctx.fillStyle = P.warn; ctx.textAlign = 'right';
      ctx.fillText(`heat limit ${deg(ht.limitC)}`, sx1 - 2, yC(ht.limitC) - 5);
      // temperature line
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.85; ctx.lineJoin = 'round';
      ctx.beginPath();
      GATE_YEAR_ORDER.forEach((month, c) => {
        const x = colX(c) + cw / 2; const y = yC(yr[month - 1].tempC);
        if (c) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.stroke();
      GATE_YEAR_ORDER.forEach((month, c) => {
        const t = yr[month - 1].tempC;
        const over = t > ht.limitC;
        ctx.globalAlpha = 1; ctx.fillStyle = over ? P.warn : (field.has(month) ? P.grow : P.ink);
        ctx.beginPath(); ctx.arc(colX(c) + cw / 2, yC(t), field.has(month) ? 4 : 3, 0, Math.PI * 2); ctx.fill();
      });
      // the hottest month, said in numbers
      const hc = colOf(ht.hottestMonth);
      ctx.font = `12px ${P.font}`; ctx.fillStyle = P.ink2;
      ctx.textAlign = hc > 8 ? 'right' : hc < 2 ? 'left' : 'center';
      const hx = hc > 8 ? colX(hc) + cw : hc < 2 ? colX(hc) + 2 : colX(hc) + cw / 2;
      ctx.fillText(`${MONTH_SHORT[ht.hottestMonth - 1]} ${deg(ht.hottestC)}`, hx, yC(ht.hottestC) - 9);
      ctx.restore();

      // ── Row 3: the crop's bed months, sliding into place.
      ctx.save();
      ctx.font = `600 12px ${P.font}`; ctx.fillStyle = P.ink2; ctx.textAlign = 'left';
      ctx.fillText(`${name} sown in ${MONTH_NAMES[cur.sowMonth - 1]}`, sx0, g.t3 + 14);
      ctx.restore();
      const cells: { month: number; kind: 'tray' | 'bed' | 'harvest' }[] = [];
      if (cur.trayMonth) cells.push({ month: cur.trayMonth, kind: 'tray' });
      cur.fieldMonths.forEach((m) => cells.push({ month: m, kind: cur.harvestMonths.includes(m) ? 'harvest' : 'bed' }));
      ctx.save();
      ctx.beginPath(); ctx.rect(sx0, g.r3 - 12, sx1 - sx0, g.bed + 14); ctx.clip();
      const span = 12 * cw;
      const cellAt = (c: number) => {
        let x = colX(c) + dx - sx0;
        x = ((x % span) + span) % span;
        return sx0 + x;
      };
      for (const cell of cells) {
        const base = cellAt(colOf(cell.month));
        for (const x of [base, base - span]) {
          if (x + cw < sx0 || x > sx1) continue;
          const cx = x + 1.5; const cy = g.r3; const cwi = cw - 3; const ch = g.bed;
          const red = cell.kind !== 'tray' && refusedHere(cell.month);
          const watered = cell.kind !== 'tray' && !L.rainFed && cur.dryMonths.includes(cell.month);
          ctx.save();
          if (cell.kind === 'tray') {
            ctx.strokeStyle = P.grow; ctx.lineWidth = 1.4; ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.roundRect(cx + 3, cy + 4, cwi - 6, ch - 8, 4); ctx.stroke();
          } else {
            ctx.fillStyle = red ? P.warn : P.grow;
            ctx.globalAlpha = red ? 0.9 : cell.kind === 'harvest' ? 0.78 : 0.4;
            ctx.beginPath(); ctx.roundRect(cx, cy, cwi, ch, 4); ctx.fill();
            ctx.globalAlpha = 1;
            if (watered) { ctx.globalAlpha = 0.9; hatch(cx, cy, cwi, ch, P.water, 4); }
            if (cell.kind === 'harvest' && !red) {
              ctx.globalAlpha = 0.9; ctx.fillStyle = P.card;
              ctx.beginPath(); ctx.arc(cx + cwi / 2, cy + ch / 2, Math.min(4, cwi * 0.14), 0, Math.PI * 2); ctx.fill();
            }
            if (red) {
              // a cross: the gate says no to this month
              ctx.globalAlpha = 1; ctx.strokeStyle = P.card; ctx.lineWidth = 2;
              const r = Math.min(6, cwi * 0.2);
              ctx.beginPath();
              ctx.moveTo(cx + cwi / 2 - r, cy + ch / 2 - r); ctx.lineTo(cx + cwi / 2 + r, cy + ch / 2 + r);
              ctx.moveTo(cx + cwi / 2 + r, cy + ch / 2 - r); ctx.lineTo(cx + cwi / 2 - r, cy + ch / 2 + r);
              ctx.stroke();
            }
          }
          ctx.restore();
        }
      }
      // sow marker above the sowing month
      const sx = cellAt(colOf(cur.sowMonth)) + cw / 2;
      ctx.fillStyle = P.ink;
      ctx.beginPath(); ctx.moveTo(sx - 5, g.r3 - 9); ctx.lineTo(sx + 5, g.r3 - 9); ctx.lineTo(sx, g.r3 - 3); ctx.closePath(); ctx.fill();
      ctx.restore();

      // ── Row 4: the gate's answer for every sowing month.
      ctx.save();
      ctx.font = `600 12px ${P.font}`; ctx.fillStyle = P.ink2; ctx.textAlign = 'left';
      ctx.fillText(L.rainFed ? 'Sow in each month: what the planner says, rain-fed' : 'Sow in each month: what the planner says, irrigated', sx0, g.t4 + 14);
      ctx.restore();
      GATE_YEAR_ORDER.forEach((month, c) => {
        const vv = vs[month - 1];
        const x = colX(c) + 2.5; const y = g.r4; const tw = cw - 5; const th = g.strip;
        ctx.save();
        if (!vv.inCalendar) {
          ctx.strokeStyle = P.muted; ctx.globalAlpha = 0.6; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
          ctx.beginPath(); ctx.roundRect(x, y, tw, th, 5); ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath(); ctx.moveTo(x + tw / 2 - 4, y + th / 2); ctx.lineTo(x + tw / 2 + 4, y + th / 2); ctx.stroke();
        } else if (vv.verdict === 'ok') {
          ctx.strokeStyle = P.grow; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.roundRect(x, y, tw, th, 5); ctx.stroke();
          ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          const cx = x + tw / 2; const cy = y + th / 2;
          ctx.beginPath(); ctx.moveTo(cx - 5, cy); ctx.lineTo(cx - 1.5, cy + 4); ctx.lineTo(cx + 5.5, cy - 4.5); ctx.stroke();
        } else {
          ctx.fillStyle = P.warn; ctx.globalAlpha = 0.9;
          ctx.beginPath(); ctx.roundRect(x, y, tw, th, 5); ctx.fill();
          ctx.globalAlpha = 1; ctx.strokeStyle = P.card; ctx.lineWidth = 2; ctx.lineCap = 'round';
          const cx = x + tw / 2; const cy = y + th / 2; const r = 4.5;
          ctx.beginPath(); ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r); ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r); ctx.stroke();
        }
        if (c === L.col) {
          ctx.globalAlpha = 1; ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.setLineDash([]);
          ctx.beginPath(); ctx.roundRect(x - 2, y - 2, tw + 4, th + 4, 7); ctx.stroke();
        }
        ctx.restore();
      });

      // ── Month labels.
      ctx.save();
      ctx.textAlign = 'center';
      GATE_YEAR_ORDER.forEach((month, c) => {
        const on = c === L.col;
        ctx.font = `${on ? '700 ' : ''}12px ${P.font}`;
        ctx.fillStyle = on ? P.ink : P.ink2;
        ctx.fillText(cw >= 34 ? MONTH_SHORT[month - 1] : MONTH_NAMES[month - 1][0], colX(c) + cw / 2, g.lab);
      });
      ctx.restore();
    };

    L.draw = draw;
    layout();
    draw();

    let raf = 0;
    let last = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (L.reduced || !L.visible) { last = 0; return; }
      let dirty = false;
      if (L.slide < 1) { L.slide = Math.min(1, L.slide + dt / SLIDE_SECONDS); dirty = true; }
      if (L.playing) {
        L.t += dt;
        if (L.t >= STEP_SECONDS) { L.t = 0; L.setCol(L.col + 1); }
      }
      if (dirty) draw();
    };
    raf = requestAnimationFrame(frame);

    const ro = new ResizeObserver(() => { layout(); draw(); });
    ro.observe(wrap);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) L.visible = e.isIntersecting && document.visibilityState === 'visible';
    }, { threshold: 0.05 });
    io.observe(canvas);
    const onVis = () => { L.visible = document.visibilityState === 'visible'; };
    document.addEventListener('visibilitychange', onVis);
    const repaint = () => { L.palette = readPalette(wrap); draw(); };
    const mo = new MutationObserver(repaint);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    const scheme = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    scheme?.addEventListener('change', repaint);
    document.fonts?.ready.then(() => draw()).catch(() => {});

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      scheme?.removeEventListener('change', repaint);
      L.draw = null;
    };
  }, [dry]);

  // Dev and ?figure=check only: drive the figure from a test harness.
  useEffect(() => {
    const allow = process.env.NODE_ENV !== 'production' || new URLSearchParams(window.location.search).get('figure') === 'check';
    if (!allow) return;
    const w = window as unknown as { __cropGate?: unknown };
    w.__cropGate = {
      seek: (c: number) => { setPlaying(false); goTo(c, false); },
      pause: () => setPlaying(false),
      facts: () => ({ year: live.current.year, verdicts: live.current.verdicts, heat: live.current.heat }),
    };
    return () => { delete w.__cropGate; };
  }, [goTo]);

  const stepTo = (c: number) => { setPlaying(false); live.current.t = 0; goTo(c, true); };

  const onCanvasPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor(((e.clientX - r.left - 8) / (r.width - 16)) * 12);
    if (i >= 0 && i < 12) stepTo(i);
  };

  const onCanvasKey = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    stepTo(col + (e.key === 'ArrowRight' ? 1 : -1));
  };

  if (!year || !crop || !verdicts || !heat || !v) return null;

  const wetCount = year.filter((m) => m.rainFed).length;
  const stats: { label: string; value: string; warn?: boolean }[] = [
    { label: 'Months the rain covers', value: `${wetCount} of 12` },
    { label: 'Hottest month', value: `${MONTH_SHORT[heat.hottestMonth - 1]}, ${deg(heat.hottestC)}` },
    { label: `${plainName(crop)} heat limit`, value: deg(heat.limitC) },
    { label: rainFed ? 'Calendar months allowed, rain-fed' : 'Calendar months allowed, irrigated', value: `${allowed} of ${cal.length}`, warn: allowed < cal.length },
  ];
  const sowMonth = GATE_YEAR_ORDER[col];
  const verdictWord = !v.inCalendar ? 'Not in the sowing calendar' : v.verdict === 'too-dry' ? 'Refused: too dry without irrigation' : v.verdict === 'too-hot' ? 'Refused: too hot' : 'Allowed';

  return (
    <section className={s.card} aria-labelledby="crop-gate-title">
      <div className={s.head}>
        <div>
          <h2 id="crop-gate-title" className={s.title}>Why not this month?</h2>
          <p className={s.sub}>
            The crop planner quietly skips a sowing month when the crop would grow through a month that is too dry or too hot.
            Here is what it decides for this site, month by month. The columns line up with the water year above:
            {' '}{monthList(dry)} {plural(dry, 'is the month', 'are the months')} the rain falls short.
          </p>
        </div>
        {!reduced && (
          <button
            type="button"
            className={s.play}
            onClick={() => { live.current.t = 0; setPlaying((p) => !p); }}
            aria-label={playing ? 'Pause the sowing months' : 'Play the sowing months'}
          >
            {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
            {playing ? 'Pause' : 'Play'}
          </button>
        )}
      </div>

      <div className={s.controls}>
        <div className={s.group}>
          <span className={s.groupLabel} id="crop-gate-crop">Crop</span>
          <div className={s.chips} role="group" aria-labelledby="crop-gate-crop">
            {crops.map((c) => (
              <button key={c.key} type="button" className={s.chip} aria-pressed={c.key === crop.key} onClick={() => setCropKey(c.key)}>
                {plainName(c)}
              </button>
            ))}
          </div>
        </div>
        <div className={s.group}>
          <span className={s.groupLabel} id="crop-gate-water">Water</span>
          <div className={s.chips} role="group" aria-labelledby="crop-gate-water">
            <button type="button" className={s.chip} aria-pressed={rainFed} onClick={() => setRainFed(true)}>Rain only</button>
            <button type="button" className={s.chip} aria-pressed={!rainFed} onClick={() => setRainFed(false)}>Reliable irrigation</button>
          </div>
        </div>
      </div>

      <div className={s.now} aria-hidden>
        <span className={s.month}>Sown in {MONTH_NAMES[sowMonth - 1]}</span>
        <span className={`${s.verdict} ${v.inCalendar && v.verdict !== 'ok' ? s.verdictNo : v.inCalendar ? s.verdictYes : ''}`}>{verdictWord}</span>
      </div>

      <div ref={wrapRef} className={s.stage}>
        <canvas
          ref={canvasRef}
          className={s.canvas}
          role="img"
          tabIndex={0}
          aria-label={`${summary} Use the left and right arrow keys to step through the sowing months.`}
          onPointerDown={onCanvasPointer}
          onKeyDown={onCanvasKey}
        />
      </div>

      <div className={s.scrub}>
        <label htmlFor="crop-gate-month" className={s.groupLabel}>Sowing month</label>
        <input
          id="crop-gate-month"
          type="range"
          min={0}
          max={11}
          step={1}
          value={col}
          className={s.range}
          aria-valuetext={`Sown in ${MONTH_NAMES[sowMonth - 1]}: ${verdictWord}`}
          onChange={(e) => stepTo(Number(e.currentTarget.value))}
        />
      </div>

      <div className={s.legend} aria-hidden>
        <span className={s.key}><span className={s.swRain} />rain</span>
        <span className={s.key}><span className={s.swPet} />half the evaporation</span>
        <span className={s.key}><span className={s.swShort} />rain falls short</span>
        <span className={s.key}><span className={s.swBed} />in the bed</span>
        <span className={s.key}><span className={s.swHarvest} />harvest</span>
        <span className={s.key}><span className={s.swTray} />seed tray</span>
        <span className={s.key}><span className={s.swNo} />month the planner refuses on</span>
        {!rainFed && <span className={s.key}><span className={s.swWatered} />dry month, watered</span>}
      </div>

      <p className={s.caption} aria-live="polite">{caption}</p>
      <p className={s.summary}>{summary}</p>

      <div className={s.stats}>
        {stats.map((st) => (
          <div key={st.label} className={`${s.stat} ${st.warn ? s.statWarn : ''}`}>
            <div className={s.statLabel}>{st.label}</div>
            <div className={s.statValue}>{st.value}</div>
          </div>
        ))}
      </div>

      <p className={s.note}>
        The planner&rsquo;s own climate check (FAO length-of-growing-period rule and FAO ECOCROP heat limits), run on this site&rsquo;s monthly
        averages. A month counts as rain-fed when its rain is at least half the evaporation, estimated by Thornthwaite from mean temperature
        alone; Thornthwaite under-estimates evaporation in dry, windy climates, and the check carries no stored soil moisture from one month
        to the next, so it can only be stricter than the FAO season. A month is too hot only when its mean is above the crop&rsquo;s ECOCROP
        absolute maximum; warmth above the crop&rsquo;s ideal range never refuses a month. Only months in the bed are checked: a seed tray month
        is not. The planner asks only about months in the {CALENDAR_NAME[site.pattern]} sowing calendar. Rain: {mm(year.reduce((a, m) => a + m.rainMm, 0))} a year.
        Climate: {climateSource}.
      </p>
    </section>
  );
}

'use client';

// "Your water year": the roof, the tank and the household, played through one year of this
// site's own monthly rain. Every figure on it comes from lib/water-year.ts, which takes its
// rules from roof-runoff.ts, water-calc.ts and WaterBalance.tsx; nothing here is a number of
// its own. Rain-drop density follows the month's millimetres; the tank's drawn size follows
// its volume (similar tanks, so height goes with the cube root); the tap drips faster with more
// people. Reduced motion gets the finished year as a still, with every control still live.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Pause, Play, Plus, RotateCcw } from 'lucide-react';
import { numberLabel } from '@/lib/format-figures';
import { DEFAULT_HOUSEHOLD } from '@/lib/household';
import {
  EMPTY_DAY_TOLERANCE,
  TANK_SIZES_L,
  WATER_YEAR_ORDER,
  householdTank,
  levelAtDay,
  monthStarts,
  waterYear,
  type HouseholdTank,
  type WaterMonth,
  type WaterYear as WaterYearResult,
} from '@/lib/water-year';
import s from './WaterYear.module.css';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SECONDS = 2.4;
const YEAR_SECONDS = MONTH_SECONDS * 12;
const END_HOLD = 6;
const LOOP_SECONDS = YEAR_SECONDS + END_HOLD;
const MIN_PEOPLE = 1;
const MAX_PEOPLE = 10;

interface Props {
  /** Monthly rainfall, January first, mm. */
  monthlyMm: readonly number[];
  roofM2: number;
  /** Household size to open on; lib/household.ts's default when no survey says otherwise. */
  defaultPeople?: number;
  /** Where the rainfall comes from, said in the note under the figure. */
  rainSource: string;
}

interface Palette {
  ink: string;
  ink2: string;
  muted: string;
  card: string;
  inset: string;
  water: string;
  warn: string;
  font: string;
  display: string;
}

interface Drop { x: number; y: number; vy: number; len: number }
interface Bit { x: number; y: number; vx: number; vy: number; life: number }

// No-break spaces: "10 000 L" must never split across a line in the caption.
const lit = (n: number) => `${numberLabel(Math.round(n)).replace(/ /g, '\u00a0')}\u00a0L`;
const dayOf = (d: number, days: number) => Math.min(days, Math.floor(d) + 1);

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
    font: v('--font-sans', 'system-ui, sans-serif'),
    display: v('--font-display', 'Georgia, serif'),
  };
}

/** Where the playhead is: which month (water-year index), how far through it, which day of the year. */
function clock(t: number, starts: number[], year: WaterYearResult) {
  if (t >= YEAR_SECONDS) return { i: 11, f: 1, day: 365, ended: true };
  const i = Math.min(11, Math.max(0, Math.floor(t / MONTH_SECONDS)));
  const f = (t - i * MONTH_SECONDS) / MONTH_SECONDS;
  return { i, f, day: starts[i] + f * year.months[i].days, ended: false };
}

/** Year-to-date totals at day `dayIn` of water-year month `i`, with the even-spread rule. */
function totalsTo(year: WaterYearResult, i: number, dayIn: number) {
  let caught = 0; let supplied = 0; let spilled = 0; let emptyDays = 0;
  for (let k = 0; k <= i; k += 1) {
    const m = year.months[k];
    const d = k < i ? m.days : Math.min(m.days, dayIn);
    const frac = d / m.days;
    const perDay = (m.caughtL - m.useL) / m.days;
    const shortHere = m.emptyAtDay === null ? 0 : Math.max(0, d - m.emptyAtDay) * -perDay;
    const spillHere = m.fullAtDay === null ? 0 : Math.max(0, d - m.fullAtDay) * perDay;
    caught += m.caughtL * frac;
    supplied += m.useL * frac - shortHere;
    spilled += spillHere;
    emptyDays += m.emptyAtDay === null ? 0 : Math.max(0, d - m.emptyAtDay);
  }
  return { caught, supplied, spilled, emptyDays };
}

function monthSentence(m: WaterMonth, people: number): string {
  const name = MONTH_NAMES[m.month];
  let line = `${name}: ${numberLabel(m.mm, 1)} mm of rain. The roof sends ${lit(m.caughtL)} to the tank; ${people === 1 ? 'one person uses' : `${people} people use`} ${lit(m.useL)}.`;
  if (m.fullAtDay !== null && m.fullAtDay < 0.5) line += ` The tank stays full all month; ${lit(m.spilledL)} runs over the top.`;
  else if (m.fullAtDay !== null) line += ` The tank is full by ${dayOf(m.fullAtDay, m.days)} ${name}; after that ${lit(m.spilledL)} runs over the top.`;
  else if (m.emptyAtDay !== null && m.startL > 0) line += ` The tank runs dry on ${dayOf(m.emptyAtDay, m.days)} ${name}.`;
  else if (m.emptyAtDay !== null) line += ' The tank stays empty: what falls is used as it arrives.';
  return line;
}

function nextTank(tankL: number, sizes: readonly number[]): number | null {
  const i = sizes.indexOf(tankL);
  return i >= 0 && i < sizes.length - 1 ? sizes[i + 1] : null;
}

function recommendSentence(year: WaterYearResult, rec: HouseholdTank | null): string {
  if (!rec || rec.tankL === year.input.tankL) return '';
  const who = year.input.people === 1 ? 'one person' : `${year.input.people} people`;
  if (rec.limit === 'none') return ` For ${who}, the smallest tank that never runs dry is ${lit(rec.tankL)}.`;
  return ` For ${who}, ${lit(rec.tankL)} is the smallest tank within ${EMPTY_DAY_TOLERANCE} day of the fewest empty days any size can give (${Math.round(rec.fewestEmptyDays)}).`;
}

function yearSentence(year: WaterYearResult, bigger: WaterYearResult | null): string {
  const { people, tankL } = year.input;
  const who = people === 1 ? 'one person uses' : `${people} people use`;
  const days = Math.round(year.emptyDays);
  if (days === 0) {
    return `Over the year the roof catches ${lit(year.caughtL)} and ${who} ${lit(year.useL)}. This ${lit(tankL)} tank carries the house through the dry months without running out; ${lit(year.spilledL)} runs over the top in the wet ones.`;
  }
  const head = `Over the year the roof catches ${lit(year.caughtL)} and ${who} ${lit(year.useL)}. The tank stands empty for ${days} days.`;
  if (year.useL > year.caughtL) {
    if (bigger && Math.round(bigger.emptyDays) === days) {
      // Level is linear within a month, so its highest point falls on a month boundary.
      const peak = Math.max(...year.months.map((x) => Math.max(x.startL, x.endL)));
      return `${head} A bigger tank would not change that: the most this one ever holds is ${lit(peak)}, so extra room would stand empty. The gap is in the catch, not the storage.`;
    }
    if (bigger) return `${head} The roof catches less than the house uses, so no tank closes the gap; a ${lit(bigger.input.tankL)} tank would cut the empty days to ${Math.round(bigger.emptyDays)}.`;
    return `${head} The roof catches less than the house uses, so no tank closes the gap.`;
  }
  if (bigger) return `${head} The roof catches enough over the year, but this tank cannot carry the wet months' water into the dry ones; a ${lit(bigger.input.tankL)} tank would cut the empty days to ${Math.round(bigger.emptyDays)}.`;
  return `${head} The roof catches enough over the year, but this tank cannot carry the wet months' water into the dry ones.`;
}

export default function WaterYear({ monthlyMm, roofM2, defaultPeople = DEFAULT_HOUSEHOLD, rainSource }: Props) {
  const [people, setPeople] = useState(Math.min(MAX_PEOPLE, Math.max(MIN_PEOPLE, defaultPeople)));
  // The recommendation counts the household: it is re-sized every time the people change.
  const rec = useMemo(() => householdTank({ monthlyMm, roofM2, people }), [monthlyMm, roofM2, people]);
  const recommended = rec?.tankL ?? null;
  // The tank follows the recommendation until someone picks one.
  const [picked, setPicked] = useState<number | null>(null);
  const tankL = picked ?? recommended ?? TANK_SIZES_L[TANK_SIZES_L.length - 1];
  // Standard sizes, plus the recommendation (or a picked size) when it is above them.
  const sizes = useMemo(
    () => [...new Set([...TANK_SIZES_L, ...(recommended ? [recommended] : []), tankL])].sort((a, b) => a - b),
    [recommended, tankL],
  );
  const biggest = sizes[sizes.length - 1];
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);

  const year = useMemo(() => waterYear({ monthlyMm, roofM2, people, tankL }), [monthlyMm, roofM2, people, tankL]);
  const bigger = useMemo(() => {
    const n = nextTank(tankL, sizes);
    return n ? waterYear({ monthlyMm, roofM2, people, tankL: n }) : null;
  }, [monthlyMm, roofM2, people, tankL, sizes]);
  const summary = useMemo(
    () => (year ? yearSentence(year, bigger) + recommendSentence(year, rec) : ''),
    [year, bigger, rec],
  );

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const monthRef = useRef<HTMLSpanElement>(null);
  const rainRef = useRef<HTMLSpanElement>(null);
  const captionRef = useRef<HTMLParagraphElement>(null);
  const statRefs = useRef<(HTMLDivElement | null)[]>([]);
  const statBoxRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Everything the draw loop needs, kept in one mutable bag so the loop never re-subscribes.
  const live = useRef({
    t: 0,
    playing: true,
    reduced: false,
    visible: true,
    year: year as WaterYearResult | null,
    summary,
    people,
    biggest,
    w: 0,
    h: 0,
    dpr: 1,
    palette: null as Palette | null,
    drops: [] as Drop[],
    bits: [] as Bit[],
    spill: [] as Bit[],
    drips: [] as Bit[],
    spawn: 0,
    dripClock: 0,
    puddle: 0,
    lastMonth: -1,
    lastEnded: false,
    lastStats: ['', '', '', ''],
    draw: null as null | (() => void),
  });

  useEffect(() => {
    const L = live.current;
    L.year = year;
    L.summary = summary;
    L.people = people;
    L.biggest = biggest;
    L.lastMonth = -1;
    L.draw?.();
  }, [year, summary, people, biggest]);

  useEffect(() => {
    live.current.playing = playing;
  }, [playing]);

  // Reduced motion: subscribe, so switching it on mid-play stops the animation.
  useEffect(() => {
    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const apply = () => {
      const r = !!mq?.matches;
      live.current.reduced = r;
      setReduced(r);
      if (r) live.current.t = LOOP_SECONDS - 0.01;
      live.current.lastMonth = -1;
      live.current.draw?.();
    };
    apply();
    mq?.addEventListener('change', apply);
    return () => mq?.removeEventListener('change', apply);
  }, []);

  const seekMonth = useCallback((i: number) => {
    const L = live.current;
    L.t = Math.min(11, Math.max(0, i)) * MONTH_SECONDS + MONTH_SECONDS * 0.999;
    L.lastMonth = -1;
    L.draw?.();
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const L = live.current;
    const starts = monthStarts();

    const layout = () => {
      const w = Math.max(280, Math.round(wrap.clientWidth));
      const narrow = w < 560;
      const sceneH = Math.round(narrow ? w * 0.82 : Math.min(w * 0.44, 340));
      const stripH = 124;
      const h = sceneH + 14 + stripH;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      L.w = w; L.h = h; L.dpr = dpr;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = `${h}px`;
      L.palette = readPalette(wrap);
    };

    const geom = (tank: number) => {
      const w = L.w;
      const narrow = w < 560;
      const sceneH = Math.round(narrow ? w * 0.82 : Math.min(w * 0.44, 340));
      const ground = sceneH - 22;
      const houseX = w * (narrow ? 0.03 : 0.07);
      const houseW = w * (narrow ? 0.34 : 0.3);
      const eaveY = sceneH * 0.3;
      const ridgeY = sceneH * 0.17;
      const roofL = houseX - 10;
      const roofR = houseX + houseW + 10;
      const roofY = (x: number) => ridgeY + ((x - roofL) / (roofR - roofL)) * (eaveY - ridgeY);
      const gutterX = roofR + 3;
      const gutterY = eaveY + 4;
      const standH = 18;
      const tankBase = ground - standH;
      const hMax = tankBase - (gutterY + 24);
      const k = Math.cbrt(tank / L.biggest);
      const th = hMax * k;
      const tw = Math.min(th * 0.86, w * (narrow ? 0.29 : 0.24) * k);
      const tcx = w * (narrow ? 0.6 : 0.6);
      const tx = tcx - tw / 2;
      const tankTop = tankBase - th;
      const dome = th * 0.1;
      return { w, narrow, sceneH, ground, houseX, houseW, eaveY, ridgeY, roofL, roofR, roofY, gutterX, gutterY, tankBase, th, tw, tcx, tx, tankTop, dome, stripTop: sceneH + 14 };
    };

    const tankPath = (g: ReturnType<typeof geom>) => {
      const p = new Path2D();
      const r = Math.min(8, g.tw * 0.08);
      p.moveTo(g.tx, g.tankTop + g.dome);
      p.quadraticCurveTo(g.tcx, g.tankTop - g.dome * 0.5, g.tx + g.tw, g.tankTop + g.dome);
      p.lineTo(g.tx + g.tw, g.tankBase - r);
      p.quadraticCurveTo(g.tx + g.tw, g.tankBase, g.tx + g.tw - r, g.tankBase);
      p.lineTo(g.tx + r, g.tankBase);
      p.quadraticCurveTo(g.tx, g.tankBase, g.tx, g.tankBase - r);
      p.closePath();
      return p;
    };

    const cloud = (cx: number, cy: number, sc: number, alpha: number, P: Palette) => {
      if (alpha <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = P.muted;
      ctx.beginPath();
      [[0, 0, 16], [18, -6, 20], [40, 0, 15], [20, 6, 16]].forEach(([dx, dy, r]) => {
        ctx.moveTo(cx + dx * sc + r * sc, cy + dy * sc);
        ctx.arc(cx + dx * sc, cy + dy * sc, r * sc, 0, Math.PI * 2);
      });
      ctx.fill();
      ctx.restore();
    };

    const draw = (dt = 0) => {
      const P = L.palette;
      const year = L.year;
      if (!P || !L.w) return;
      ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
      ctx.clearRect(0, 0, L.w, L.h);
      if (!year) return;
      const g = geom(year.input.tankL);
      const c = clock(L.t, starts, year);
      const m = year.months[c.i];
      const dayIn = c.f * m.days;
      const maxMm = Math.max(...year.months.map((x) => x.mm), 1);
      const maxCatch = Math.max(...year.months.map((x) => x.caughtL), 1);
      const prev = year.months[(c.i + 11) % 12];
      const blend = c.ended ? 1 : Math.min(1, c.f / 0.12);
      const mmNow = c.ended ? 0 : prev.mm + (m.mm - prev.mm) * blend;
      const wet = mmNow / maxMm;
      const level = c.ended ? year.months[11].endL : levelAtDay(year, c.day);
      const tank = year.input.tankL;
      const filling = !c.ended && m.caughtL > 0;
      const spilling = !c.ended && m.fullAtDay !== null && dayIn >= m.fullAtDay;
      const dry = level <= 0.5;
      const animate = !L.reduced;

      // ── Sky: sun in the dry months, cloud in the wet ones, both by this month's rain.
      const sunX = L.w * 0.9; const sunY = g.sceneH * 0.13;
      ctx.save();
      ctx.globalAlpha = 0.85 * (1 - wet);
      ctx.strokeStyle = P.muted; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(sunX, sunY, 11, 0, Math.PI * 2); ctx.stroke();
      for (let k = 0; k < 8; k += 1) {
        const a = (k / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(sunX + Math.cos(a) * 16, sunY + Math.sin(a) * 16);
        ctx.lineTo(sunX + Math.cos(a) * 22, sunY + Math.sin(a) * 22);
        ctx.stroke();
      }
      ctx.restore();
      cloud(L.w * 0.16, g.sceneH * 0.08, g.narrow ? 0.7 : 1, 0.28 * wet, P);
      cloud(L.w * 0.5, g.sceneH * 0.06, g.narrow ? 0.8 : 1.2, 0.32 * wet, P);
      cloud(L.w * 0.78, g.sceneH * 0.1, g.narrow ? 0.6 : 0.9, 0.24 * wet, P);

      // ── Rain: drops per second follow this month's millimetres.
      if (animate && dt > 0) {
        L.spawn += wet * 190 * (L.w / 800) * dt;
        while (L.spawn >= 1 && L.drops.length < 520) {
          L.spawn -= 1;
          L.drops.push({ x: Math.random() * (L.w + 40), y: -14 - Math.random() * 30, vy: 520 + Math.random() * 140, len: 8 + Math.random() * 7 });
        }
        if (L.spawn > 1) L.spawn = 0;
      }
      ctx.save();
      ctx.strokeStyle = P.water; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
      ctx.beginPath();
      const keep: Drop[] = [];
      for (const d of L.drops) {
        d.y += d.vy * dt; d.x -= 0.09 * d.vy * dt;
        const onRoof = d.x >= g.roofL && d.x <= g.roofR && d.y >= g.roofY(d.x);
        const onTank = d.x >= g.tx && d.x <= g.tx + g.tw && d.y >= g.tankTop + g.dome * 0.4;
        if (onRoof || onTank || d.y >= g.ground) {
          if (animate && Math.random() < 0.5) L.bits.push({ x: d.x, y: Math.min(d.y, onRoof ? g.roofY(d.x) : d.y), vx: (Math.random() - 0.5) * 50, vy: -40 - Math.random() * 50, life: 0.25 });
          continue;
        }
        ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 0.09 * d.len, d.y - d.len);
        keep.push(d);
      }
      ctx.stroke();
      L.drops = keep;
      ctx.globalAlpha = 0.45; ctx.fillStyle = P.water;
      L.bits = L.bits.filter((b) => {
        b.life -= dt; b.x += b.vx * dt; b.vy += 600 * dt; b.y += b.vy * dt;
        if (b.life <= 0) return false;
        ctx.fillRect(b.x, b.y, 1.5, 1.5);
        return true;
      });
      ctx.restore();

      // ── Ground.
      ctx.save();
      ctx.strokeStyle = P.ink; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, g.ground); ctx.lineTo(L.w, g.ground); ctx.stroke();
      ctx.globalAlpha = 0.25;
      for (let x = 6; x < L.w; x += 23) {
        ctx.beginPath(); ctx.moveTo(x, g.ground); ctx.lineTo(x - 2, g.ground - 5); ctx.moveTo(x + 3, g.ground); ctx.lineTo(x + 4, g.ground - 4); ctx.stroke();
      }
      ctx.restore();

      // ── House: mono-pitch iron roof falling toward the tank.
      const wallL = g.houseX; const wallR = g.houseX + g.houseW;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(wallL, g.roofY(wallL) + 3); ctx.lineTo(wallR, g.roofY(wallR) + 3); ctx.lineTo(wallR, g.ground); ctx.lineTo(wallL, g.ground); ctx.closePath();
      ctx.fillStyle = P.inset; ctx.globalAlpha = 0.55; ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = P.ink; ctx.lineWidth = 1.4; ctx.stroke();
      const wallH = g.ground - g.eaveY;
      const doorW = g.houseW * 0.17; const doorH = wallH * 0.52; const doorX = wallL + g.houseW * 0.2;
      ctx.strokeRect(doorX, g.ground - doorH, doorW, doorH);
      const winS = Math.min(g.houseW * 0.2, wallH * 0.26); const winX = wallL + g.houseW * 0.58; const winY = g.ground - wallH * 0.68;
      ctx.strokeRect(winX, winY, winS, winS);
      ctx.beginPath(); ctx.moveTo(winX + winS / 2, winY); ctx.lineTo(winX + winS / 2, winY + winS); ctx.moveTo(winX, winY + winS / 2); ctx.lineTo(winX + winS, winY + winS / 2); ctx.stroke();
      // roof sheet with corrugation ticks
      ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.moveTo(g.roofL, g.roofY(g.roofL)); ctx.lineTo(g.roofR, g.roofY(g.roofR)); ctx.stroke();
      ctx.lineWidth = 1; ctx.globalAlpha = 0.55;
      ctx.beginPath();
      for (let x = g.roofL + 4; x < g.roofR - 2; x += 6) { ctx.moveTo(x, g.roofY(x) - 3.5); ctx.lineTo(x, g.roofY(x) + 1); }
      ctx.stroke();
      ctx.restore();
      // roof label
      ctx.save();
      ctx.font = `12px ${P.font}`; ctx.fillStyle = P.ink2; ctx.textAlign = 'center';
      ctx.fillText(`${numberLabel(Math.round(year.input.roofM2))} m² roof`, wallL + g.houseW / 2, g.roofY(wallL + g.houseW / 2) + 20);
      ctx.restore();

      // ── Gutter and downpipe to the tank lid.
      const pipeY = g.gutterY + 4;
      const lidY = g.tankTop - g.dome * 0.05;
      ctx.save();
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(g.gutterX - 9, g.gutterY - 4); ctx.quadraticCurveTo(g.gutterX - 6, g.gutterY + 6, g.gutterX + 3, g.gutterY - 4); ctx.stroke();
      ctx.lineWidth = 5; ctx.globalAlpha = 0.3; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(g.gutterX - 3, pipeY); ctx.lineTo(g.tcx, pipeY); ctx.lineTo(g.tcx, lidY); ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(g.gutterX - 3, pipeY - 2.5); ctx.lineTo(g.tcx + 2.5, pipeY - 2.5); ctx.lineTo(g.tcx + 2.5, lidY);
      ctx.moveTo(g.gutterX - 3, pipeY + 2.5); ctx.lineTo(g.tcx - 2.5, pipeY + 2.5); ctx.lineTo(g.tcx - 2.5, lidY); ctx.stroke();
      if (filling || L.reduced) {
        const flow = c.ended ? 0 : m.caughtL / maxCatch;
        ctx.strokeStyle = P.water; ctx.lineWidth = 2.2; ctx.globalAlpha = L.reduced ? 0 : 0.25 + 0.75 * flow;
        ctx.setLineDash([5, 7]); ctx.lineDashOffset = -L.t * 60;
        ctx.beginPath(); ctx.moveTo(g.gutterX - 3, pipeY); ctx.lineTo(g.tcx, pipeY); ctx.lineTo(g.tcx, lidY); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();

      // ── Stand.
      ctx.save();
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.7;
      ctx.strokeRect(g.tx - 4, g.tankBase, g.tw + 8, g.ground - g.tankBase);
      ctx.restore();

      // ── Tank: a cutaway, the water inside at today's level.
      const body = tankPath(g);
      ctx.save();
      ctx.fillStyle = P.card; ctx.globalAlpha = 0.75; ctx.fill(body);
      ctx.globalAlpha = 1;
      ctx.clip(body);
      const innerTop = g.tankTop + g.dome;
      const innerH = g.tankBase - innerTop;
      const surf = g.tankBase - (level / tank) * innerH;
      if (level > 0.5) {
        const amp = L.reduced ? 0 : (filling ? 1.6 : 0.8) + (spilling ? 0.8 : 0);
        const grad = ctx.createLinearGradient(0, surf, 0, g.tankBase);
        ctx.fillStyle = grad;
        grad.addColorStop(0, P.water); grad.addColorStop(1, P.water);
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(g.tx - 2, g.tankBase + 2);
        for (let x = g.tx - 2; x <= g.tx + g.tw + 2; x += 3) {
          ctx.lineTo(x, surf + Math.sin(x * 0.11 + L.t * 3.2) * amp);
        }
        ctx.lineTo(g.tx + g.tw + 2, g.tankBase + 2); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 0.95; ctx.strokeStyle = P.water; ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let x = g.tx - 2; x <= g.tx + g.tw + 2; x += 3) {
          const y = surf + Math.sin(x * 0.11 + L.t * 3.2) * amp;
          if (x === g.tx - 2) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // falling stream from the inlet while the roof is sending water
      if (filling && !L.reduced) {
        ctx.globalAlpha = 0.25 + 0.6 * (m.caughtL / maxCatch);
        ctx.strokeStyle = P.water; ctx.lineWidth = 1.6;
        ctx.setLineDash([4, 6]); ctx.lineDashOffset = -L.t * 90;
        ctx.beginPath(); ctx.moveTo(g.tcx, innerTop - g.dome * 0.5); ctx.lineTo(g.tcx, Math.max(innerTop, surf)); ctx.stroke();
        ctx.setLineDash([]);
      }
      // ribs
      ctx.globalAlpha = 0.18; ctx.strokeStyle = P.ink; ctx.lineWidth = 1;
      for (let k = 1; k < 6; k += 1) {
        const y = innerTop + (innerH * k) / 6;
        ctx.beginPath(); ctx.moveTo(g.tx, y); ctx.lineTo(g.tx + g.tw, y); ctx.stroke();
      }
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = dry ? P.warn : P.ink; ctx.lineWidth = 1.6; ctx.stroke(body);
      ctx.fillStyle = P.ink; ctx.globalAlpha = 0.8;
      ctx.fillRect(g.tcx - 7, g.tankTop - g.dome * 0.25 - 3, 14, 3);
      ctx.restore();

      // level readout, inside the tank at the surface
      ctx.save();
      ctx.font = `600 13px ${P.font}`;
      const label = dry ? 'empty' : lit(level);
      const lw = ctx.measureText(label).width + 12;
      const ly = dry ? g.tankBase - 16 : Math.min(g.tankBase - 12, Math.max(innerTop + 12, surf - 13));
      ctx.fillStyle = P.card; ctx.globalAlpha = 0.92;
      ctx.beginPath(); ctx.roundRect(g.tcx - lw / 2, ly - 10, lw, 20, 6); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = dry ? P.warn : P.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, g.tcx, ly + 0.5);
      ctx.restore();
      // tank size under the stand
      ctx.save();
      ctx.font = `12px ${P.font}`; ctx.fillStyle = P.ink2; ctx.textAlign = 'center';
      ctx.fillText(`${numberLabel(tank)} L tank`, g.tcx, g.ground + 15);
      ctx.restore();

      // ── Overflow spout and spill.
      const ofX = g.tx + g.tw; const ofY = innerTop + 7;
      ctx.save();
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(ofX, ofY - 2.5); ctx.lineTo(ofX + 11, ofY - 2.5); ctx.moveTo(ofX, ofY + 2.5); ctx.lineTo(ofX + 11, ofY + 2.5); ctx.stroke();
      if (spilling && animate && dt > 0) {
        const n = Math.ceil(dt * 70);
        for (let k = 0; k < n; k += 1) L.spill.push({ x: ofX + 11, y: ofY, vx: 34 + Math.random() * 26, vy: Math.random() * 10, life: 2 });
      }
      L.puddle = Math.max(0, Math.min(1, L.puddle + (spilling ? dt * 0.8 : -dt * 0.25)));
      ctx.fillStyle = P.water; ctx.globalAlpha = 0.6;
      L.spill = L.spill.filter((b) => {
        b.vy += 900 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y >= g.ground - 1) return false;
        ctx.fillRect(b.x, b.y, 1.8, 2.6);
        return true;
      });
      if (L.puddle > 0.01 && !L.reduced) {
        const px = ofX + 11 + Math.sqrt(2 * (g.ground - ofY) / 900) * 47;
        ctx.globalAlpha = 0.35 * L.puddle;
        ctx.beginPath(); ctx.ellipse(px, g.ground + 1, 10 + 20 * L.puddle, 2.5, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      // ── Tap and bucket: the household drawing water.
      const tapY = g.tankBase - 9; const tapX = g.tx + g.tw;
      const spoutX = tapX + 12; const spoutY = tapY + 7;
      const bTop = g.ground - 15;
      ctx.save();
      ctx.strokeStyle = P.ink; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(tapX, tapY); ctx.lineTo(spoutX, tapY); ctx.lineTo(spoutX, spoutY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(spoutX - 4, tapY - 5); ctx.lineTo(spoutX + 4, tapY - 5); ctx.moveTo(spoutX, tapY - 5); ctx.lineTo(spoutX, tapY); ctx.stroke();
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(spoutX - 9, bTop); ctx.lineTo(spoutX - 7, g.ground); ctx.lineTo(spoutX + 7, g.ground); ctx.lineTo(spoutX + 9, bTop); ctx.stroke();
      if (!dry && !c.ended && animate && dt > 0) {
        L.dripClock += dt;
        const every = 0.9 / Math.max(1, L.people);
        while (L.dripClock >= every) { L.dripClock -= every; L.drips.push({ x: spoutX, y: spoutY, vx: 0, vy: 0, life: 1 }); }
      }
      ctx.fillStyle = P.water; ctx.globalAlpha = 0.85;
      L.drips = L.drips.filter((b) => {
        b.vy += 900 * dt; b.y += b.vy * dt;
        if (b.y >= bTop + 4) return false;
        ctx.beginPath(); ctx.ellipse(b.x, b.y, 1.6, 2.4, 0, 0, Math.PI * 2); ctx.fill();
        return true;
      });
      if (dry) {
        ctx.globalAlpha = 1; ctx.fillStyle = P.warn; ctx.font = `600 12px ${P.font}`; ctx.textAlign = 'left';
        ctx.fillText('dry', spoutX + 12, spoutY + 6);
      }
      ctx.restore();

      // ── The year strip: rain each month, the tank's level traced to the playhead.
      const sx0 = 8; const sx1 = L.w - 8; const cw = (sx1 - sx0) / 12;
      const top = g.stripTop + 6; const base = g.stripTop + 124 - 22; const chH = base - top;
      const xAt = (mi: number, din: number) => sx0 + (mi + din / year.months[mi].days) * cw;
      ctx.save();
      ctx.strokeStyle = P.ink; ctx.globalAlpha = 0.15; ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(sx0, top); ctx.lineTo(sx1, top); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.moveTo(sx0, base); ctx.lineTo(sx1, base); ctx.stroke();
      // rain bars
      ctx.fillStyle = P.muted;
      year.months.forEach((mo, mi) => {
        const bh = (mo.mm / maxMm) * chH * 0.92;
        ctx.globalAlpha = mi === c.i && !c.ended ? 0.5 : 0.24;
        ctx.fillRect(sx0 + mi * cw + cw * 0.33, base - bh, cw * 0.34, bh);
      });
      // tank level, drawn up to the playhead
      const endDay = c.ended ? 365 : c.day;
      const pts: [number, number][] = [];
      for (let mi = 0; mi < 12; mi += 1) {
        const mo = year.months[mi];
        const d0 = starts[mi];
        if (d0 > endDay) break;
        const steps = 12;
        for (let k = 0; k <= steps; k += 1) {
          const din = (mo.days * k) / steps;
          if (d0 + din > endDay) { pts.push([xAt(mi, endDay - d0), base - (levelAtDay(year, endDay) / tank) * chH]); break; }
          pts.push([xAt(mi, din), base - (levelAtDay(year, d0 + din) / tank) * chH]);
        }
      }
      if (pts.length > 1) {
        ctx.globalAlpha = 0.3; ctx.fillStyle = P.water;
        ctx.beginPath(); ctx.moveTo(pts[0][0], base);
        pts.forEach(([x, y]) => ctx.lineTo(x, y));
        ctx.lineTo(pts[pts.length - 1][0], base); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1; ctx.strokeStyle = P.water; ctx.lineWidth = 2; ctx.lineJoin = 'round';
        ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      }
      // empty stretches, and spill marks along the top
      year.months.forEach((mo, mi) => {
        const d0 = starts[mi];
        if (d0 > endDay) return;
        const lim = Math.min(mo.days, endDay - d0);
        if (mo.emptyAtDay !== null && lim > mo.emptyAtDay) {
          ctx.globalAlpha = 1; ctx.fillStyle = P.warn;
          ctx.fillRect(xAt(mi, mo.emptyAtDay), base - 2, xAt(mi, lim) - xAt(mi, mo.emptyAtDay), 4);
        }
        if (mo.fullAtDay !== null && lim > mo.fullAtDay) {
          ctx.globalAlpha = 0.8; ctx.strokeStyle = P.water; ctx.lineWidth = 1;
          ctx.beginPath();
          for (let x = xAt(mi, mo.fullAtDay); x < xAt(mi, lim); x += 5) { ctx.moveTo(x, top - 1); ctx.lineTo(x + 2, top - 5); }
          ctx.stroke();
        }
      });
      // playhead
      if (!c.ended) {
        const px = xAt(c.i, dayIn);
        const py = base - (level / tank) * chH;
        ctx.globalAlpha = 0.45; ctx.strokeStyle = P.ink; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px, top - 4); ctx.lineTo(px, base); ctx.stroke();
        ctx.globalAlpha = 1; ctx.fillStyle = dry ? P.warn : P.water;
        ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
      }
      // labels
      ctx.globalAlpha = 1; ctx.font = `12px ${P.font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      WATER_YEAR_ORDER.forEach((mon, mi) => {
        const on = mi === c.i && !c.ended;
        ctx.fillStyle = on ? P.ink : P.ink2;
        ctx.font = `${on ? '700 ' : ''}12px ${P.font}`;
        ctx.fillText(MONTH_NAMES[mon][0], sx0 + mi * cw + cw / 2, base + 16);
      });
      ctx.textAlign = 'left'; ctx.font = `12px ${P.font}`; ctx.fillStyle = P.ink2;
      ctx.fillText('full', sx0 + 2, top + 13);
      ctx.restore();

      // ── DOM readouts, touched only when their text changes.
      const monthChanged = L.lastMonth !== c.i || L.lastEnded !== c.ended;
      if (monthChanged) {
        L.lastMonth = c.i; L.lastEnded = c.ended;
        if (monthRef.current) monthRef.current.textContent = c.ended ? 'The whole year' : MONTH_NAMES[m.month];
        if (rainRef.current) rainRef.current.textContent = c.ended
          ? `${numberLabel(Math.round(year.months.reduce((a, x) => a + x.mm, 0)))} mm of rain, October to September`
          : `${numberLabel(m.mm, 1)} mm of rain`;
        if (captionRef.current) captionRef.current.textContent = c.ended ? L.summary : monthSentence(m, L.people);
      }
      const tot = c.ended
        ? { caught: year.caughtL, supplied: year.suppliedL, spilled: year.spilledL, emptyDays: year.emptyDays }
        : totalsTo(year, c.i, dayIn);
      const vals = [lit(tot.caught), lit(tot.supplied), lit(tot.spilled), String(Math.round(tot.emptyDays))];
      vals.forEach((v, k) => {
        if (L.lastStats[k] !== v) {
          L.lastStats[k] = v;
          const el = statRefs.current[k];
          if (el) el.textContent = v;
        }
      });
      const box = statBoxRefs.current[3];
      if (box) box.classList.toggle(s.statWarn, Math.round(tot.emptyDays) > 0);
    };

    L.draw = () => draw(0);
    layout();
    draw(0);

    let raf = 0;
    let last = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (L.reduced || !L.visible) { last = 0; return; }
      if (L.playing) {
        L.t += dt;
        if (L.t >= LOOP_SECONDS) { L.t = 0; L.lastMonth = -1; }
        draw(dt);
      } else {
        draw(0);
      }
    };
    raf = requestAnimationFrame(frame);

    const ro = new ResizeObserver(() => { layout(); draw(0); });
    ro.observe(wrap);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) L.visible = e.isIntersecting && document.visibilityState === 'visible';
    }, { threshold: 0.05 });
    io.observe(canvas);
    const onVis = () => { L.visible = document.visibilityState === 'visible'; };
    document.addEventListener('visibilitychange', onVis);
    const repaint = () => { L.palette = readPalette(wrap); draw(0); };
    const mo = new MutationObserver(repaint);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    const scheme = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    scheme?.addEventListener('change', repaint);
    document.fonts?.ready.then(() => draw(0)).catch(() => {});

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      scheme?.removeEventListener('change', repaint);
      L.draw = null;
    };
  }, []);

  // Dev and ?figure=check only: drive the clock from a test harness.
  useEffect(() => {
    const allow = process.env.NODE_ENV !== 'production' || new URLSearchParams(window.location.search).get('figure') === 'check';
    if (!allow) return;
    const w = window as unknown as { __waterYear?: unknown };
    w.__waterYear = {
      seek: (t: number) => { live.current.t = t; live.current.lastMonth = -1; live.current.draw?.(); },
      pause: () => setPlaying(false),
      facts: () => live.current.year,
    };
    return () => { delete w.__waterYear; };
  }, []);

  const onCanvasPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const i = Math.floor(((x - 8) / (r.width - 16)) * 12);
    if (i >= 0 && i < 12) seekMonth(i);
  };

  const onCanvasKey = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const L = live.current;
    const cur = L.t >= YEAR_SECONDS ? 12 : Math.floor(L.t / MONTH_SECONDS);
    setPlaying(false);
    seekMonth(cur + (e.key === 'ArrowRight' ? 1 : -1));
  };

  if (!year) return null;

  const statLabels = ['Caught by the roof', 'Used from the tank', 'Ran over the top', 'Days the tank stood empty'];

  return (
    <section className={s.card} aria-labelledby="water-year-title">
      <div className={s.head}>
        <div>
          <h2 id="water-year-title" className={s.title}>Your water year</h2>
          <p className={s.sub}>This roof, one tank and the household, through a year of this site&rsquo;s rain.</p>
        </div>
        {!reduced && (
          <button
            type="button"
            className={s.play}
            onClick={() => {
              const L = live.current;
              if (!playing && L.t >= YEAR_SECONDS) { L.t = 0; L.lastMonth = -1; }
              setPlaying((p) => !p);
            }}
            aria-label={playing ? 'Pause the year' : 'Play the year'}
          >
            {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
            {playing ? 'Pause' : 'Play'}
          </button>
        )}
      </div>

      <div className={s.now} aria-hidden>
        <span ref={monthRef} className={s.month}>October</span>
        <span ref={rainRef} className={s.rain} />
      </div>

      <div ref={wrapRef} className={s.stage}>
        <canvas
          ref={canvasRef}
          className={s.canvas}
          role="img"
          tabIndex={0}
          aria-label={`${summary} Use the left and right arrow keys to step through the months.`}
          onPointerDown={onCanvasPointer}
          onKeyDown={onCanvasKey}
        />
      </div>

      <div className={s.legend} aria-hidden>
        <span className={s.key}><span className={s.swatchRain} />rain each month</span>
        <span className={s.key}><span className={s.swatchTank} />water in the tank</span>
        <span className={s.key}><span className={s.swatchDry} />tank empty</span>
      </div>

      <p ref={captionRef} className={s.caption} />

      <div className={s.stats}>
        {statLabels.map((label, k) => (
          <div key={label} className={s.stat} ref={(el) => { statBoxRefs.current[k] = el; }}>
            <div className={s.statLabel}>{label}</div>
            <div className={s.statValue} ref={(el) => { statRefs.current[k] = el; }}>—</div>
          </div>
        ))}
      </div>

      <div className={s.controls}>
        <div className={s.group}>
          <span className={s.groupLabel} id="water-year-people">People</span>
          <div className={s.stepper} role="group" aria-labelledby="water-year-people">
            <button type="button" className={s.stepBtn} aria-label="One person fewer" disabled={people <= MIN_PEOPLE} onClick={() => setPeople((p) => Math.max(MIN_PEOPLE, p - 1))}>
              <Minus size={16} aria-hidden />
            </button>
            <span className={s.stepValue} aria-live="polite">{people}</span>
            <button type="button" className={s.stepBtn} aria-label="One person more" disabled={people >= MAX_PEOPLE} onClick={() => setPeople((p) => Math.min(MAX_PEOPLE, p + 1))}>
              <Plus size={16} aria-hidden />
            </button>
          </div>
        </div>
        <div className={s.group}>
          <span className={s.groupLabel} id="water-year-tank">Tank</span>
          <div className={s.tanks} role="group" aria-labelledby="water-year-tank">
            {sizes.map((size) => (
              <button key={size} type="button" className={s.tankBtn} aria-pressed={tankL === size} onClick={() => setPicked(size)}>
                <span>{numberLabel(size)} L</span>
                {size === recommended && <span className={s.rec}>recommended</span>}
              </button>
            ))}
          </div>
        </div>
        {!reduced && (
          <button
            type="button"
            className={s.play}
            onClick={() => { const L = live.current; L.t = 0; L.lastMonth = -1; setPlaying(true); }}
          >
            <RotateCcw size={16} aria-hidden /> From October
          </button>
        )}
      </div>

      <p className={s.note}>
        Roof {numberLabel(Math.round(roofM2))} m² × each month&rsquo;s rain × 0.80 runoff (the app&rsquo;s one roof coefficient).
        80 L per person per day. Rain and use are spread evenly through each month, and the year starts with whatever September
        left in the tank. Recommended: for this many people, the smallest standard tank within {EMPTY_DAY_TOLERANCE} day
        of the fewest empty days any size can give. Rainfall: {rainSource}.
        {' '}{DEFAULT_HOUSEHOLD} people is the app&rsquo;s household until a site survey says otherwise.
      </p>
    </section>
  );
}

'use client';

// "Where the shade falls": one wall's shadow through a day at midsummer, the equinox and midwinter,
// and the hours of direct sun each garden bed behind it gets. The same wall throws a noon shadow
// about fourteen times longer in June than in December at this latitude, which decides where winter
// beds can go.
//
// Every number on it comes from lib/shade-day.ts (sun altitude and azimuth by hour of day, the
// shadow of a thin opaque screen, sun hours per bed), which uses lib/solar.ts's own conventions and
// obliquity. Plan view, north up. Clock = LOCAL SOLAR TIME, not SAST. Reduced motion gets the finished
// comparison as a still (three noon shadows, sun hours per bed) with every control live.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Repeat } from 'lucide-react';
import { numberLabel } from '@/lib/format-figures';
import { aspectLabel } from '@/lib/biome';
import { OBLIQUITY_DEG } from '@/lib/solar';
import {
  BED_DISTANCES_M,
  SCREEN_HEIGHTS_M,
  SCREEN_LENGTH_M,
  SHADE_DAY_KEYS,
  shadeAt,
  shadeDay,
  shadowPolygon,
  solarClock,
  sunHoursSoFar,
  sunPosition,
  hourAngleOf,
  type Point,
  type ShadeDay,
  type ShadeDayKey,
} from '@/lib/shade-day';
import s from './ShadeFall.module.css';

// ── Every word the figure prints (i18n is deferred; keep them here so they are easy to translate). ──
const T = {
  title: 'Where the shade falls',
  sub: (lat: string) =>
    `Watch one wall’s shadow swing through a day at ${lat} South, and see which beds behind it stay in the sun. ` +
    'This is a plan view with north at the top. In the southern hemisphere the midday sun stands in the north, so midday shadows point south.',
  dayLabel: 'Day',
  objectLabel: 'Object',
  days: { december: '21 December', equinox: 'Equinox', june: '21 June' } as Record<ShadeDayKey, string>,
  daysShort: { december: 'Dec', equinox: 'Eq.', june: 'Jun' } as Record<ShadeDayKey, string>,
  dayLong: {
    december: '21 December, midsummer',
    equinox: 'The equinox (late March or September)',
    june: '21 June, midwinter',
  } as Record<ShadeDayKey, string>,
  tableHead: { december: 'Dec', equinox: 'Equinox', june: 'Jun' } as Record<ShadeDayKey, string>,
  objectChip: (h: number) => `${h} m ${h <= 2 ? 'hedge' : h <= 3 ? 'wall' : 'tree row'}`,
  objectName: (h: number) => `${h} m ${h <= 2 ? 'hedge' : h <= 3 ? 'wall' : 'row of trees'}`,
  play: 'Play',
  pause: 'Pause',
  replay: 'Replay',
  playAll: 'Play all three',
  playLabel: 'Play this day',
  pauseLabel: 'Pause the day',
  playAllLabel: 'Play December, the equinox and June one after another',
  timeLabel: 'Time of day',
  solarTime: 'solar time',
  northWord: 'N',
  planTitleBeds: 'm south of the object',
  barsTitle: 'Hours of direct sun, by bed',
  skyTitle: 'How high the sun climbs, by solar hour',
  keysHint: 'Use the left and right arrow keys to step through the day, and Home and End to jump to sunrise and sunset.',
  legend: {
    shadow: 'shadow now',
    noon: 'noon shadow, left behind',
    bed: 'garden bed',
    sun: 'bed in direct sun',
    noSun: 'bed in shade',
  },
  noPlay: 'The sun is below the horizon.',
  notes: (o: { slopeDeg: number; lengthM: number; declDeg: number; latDeg: number }) =>
    `The model: flat ground (this site’s slope is ${numberLabel(o.slopeDeg, 1)}°, treated as flat), a geometric horizon with no ridges, buildings or other trees, ` +
    `and a single opaque screen ${o.lengthM} m long running east to west, with no thickness. There is no atmospheric refraction and no diffuse light, so ` +
    '“direct sun” means the sun’s disc is above the horizon and the screen is not in the way. Hours of sun are measured at the centre of each bed. ' +
    `The sun’s position is spherical astronomy at latitude ${numberLabel(Math.abs(o.latDeg), 1)}° S, with the sun ${numberLabel(o.declDeg, 2)}° from the equator at the solstices and on it at the equinox ` +
    '(the same sun paths as the sector map). Times are local solar time: 12:00 is the moment the sun is highest, not South African Standard Time.',
};

const DAY_SECONDS = 7; // real seconds from sunrise to sunset
const HOLD_SECONDS = 1.1; // pause on a finished day before the next one starts
const PUSH_MS = 90; // how often the React readout follows the animation

const HEIGHTS = SCREEN_HEIGHTS_M;
const DEFAULT_HEIGHT_INDEX = 1;
const EIGHT_POINT = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const compassWord = (az: number) => EIGHT_POINT[Math.round((((az % 360) + 360) % 360) / 45) % 8];
const hours = (v: number) => `${v.toFixed(1)} h`;
const metres = (v: number) => `${numberLabel(v, v < 1 ? 2 : v < 10 ? 2 : 1)} m`;

interface Props {
  /** Site latitude, degrees (negative south). */
  latDeg: number;
  /** The site's slope, degrees: said in the note; the model treats the ground as flat. */
  slopeDeg: number;
}

interface Palette {
  ink: string; ink2: string; muted: string; card: string; ground: string; edge: string;
  water: string; warn: string; grow: string; violet: string; gold: string; font: string;
}

function readPalette(el: HTMLElement): Palette {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    ink: v('--text-primary', '#261B10'),
    ink2: v('--text-secondary', '#6A5040'),
    muted: v('--text-muted', '#755942'),
    card: v('--bg-1', '#FFFEFA'),
    ground: v('--bg-0', '#E4DCC6'),
    edge: v('--border', '#E2D8C4'),
    water: v('--blue', '#1C5A9E'),
    warn: v('--orange', '#B83A18'),
    grow: v('--emerald', '#346A15'),
    violet: v('--violet', '#5C3F86'),
    gold: v('--gold', '#9E5C08'),
    font: v('--font-sans', 'system-ui, sans-serif'),
  };
}

type Days<V> = Record<ShadeDayKey, V>;
const tint = (P: Palette): Days<string> => ({ december: P.warn, equinox: P.violet, june: P.water });

interface Rect { x: number; y: number; w: number; h: number }
interface Layout { wide: boolean; plan: Rect; sky: Rect; bars: Rect; h: number }

const ROW_H = 36;
function layoutFor(w: number): Layout {
  const barsH = 24 + BED_DISTANCES_M.length * ROW_H + 22;
  if (w >= 720) {
    const pw = Math.round(w * 0.56);
    const ph = Math.round((pw * 14) / 18);
    const cx = pw + 22;
    const sky = { x: cx, y: 0, w: w - cx, h: 168 };
    const bars = { x: cx, y: sky.h + 18, w: w - cx, h: barsH };
    return { wide: true, plan: { x: 0, y: 0, w: pw, h: ph }, sky, bars, h: Math.max(ph, bars.y + bars.h) };
  }
  const ph = Math.round((w * 14) / 18);
  const sky = { x: 0, y: ph + 14, w, h: 136 };
  const bars = { x: 0, y: sky.y + sky.h + 14, w, h: barsH };
  return { wide: false, plan: { x: 0, y: 0, w, h: ph }, sky, bars, h: bars.y + bars.h };
}

// Plan extents, metres: x east, y north. The screen sits at y = 0; the beds run south.
const X0 = -9; const X1 = 9; const Y0 = -9.5; const Y1 = 4.5;
const BED_W = 4; const BED_D = 1;

export default function ShadeFall({ latDeg, slopeDeg }: Props) {
  const [heightIdx, setHeightIdx] = useState(DEFAULT_HEIGHT_INDEX);
  const heightM = HEIGHTS[heightIdx];
  const results = useMemo(() => {
    try {
      return Object.fromEntries(SHADE_DAY_KEYS.map((d) => [d, shadeDay(latDeg, d, heightM)])) as Days<ShadeDay>;
    } catch {
      return null;
    }
  }, [latDeg, heightM]);
  // The three days at every height, for the comparison and the sentence.
  const [sel, setSel] = useState<ShadeDayKey>('december');
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<'one' | 'all' | null>(null);
  const [reduced, setReduced] = useState(false);
  const [clock, setClock] = useState(12);
  const [capKey, setCapKey] = useState(0); // bumps when the spoken caption should be rewritten

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const live = useRef({
    res: results as Days<ShadeDay> | null,
    t: { december: 12, equinox: 12, june: 12 } as Days<number>,
    sel: 'december' as ShadeDayKey,
    playing: false,
    mode: null as 'one' | 'all' | null,
    hold: 0,
    visible: false,
    reduced: false,
    autoplayed: false,
    lastPush: 0,
    w: 0, h: 0, dpr: 1,
    palette: null as Palette | null,
    draw: null as null | (() => void),
  });

  // ── Control actions: they change `live`, mirror what React shows, and redraw. ──
  const push = useCallback(() => {
    const L = live.current;
    setClock(L.t[L.sel]);
    L.lastPush = performance.now();
  }, []);

  const finishAll = useCallback(() => {
    const L = live.current;
    if (!L.res) return;
    for (const d of SHADE_DAY_KEYS) L.t[d] = L.res[d].setHour;
    L.sel = 'june'; L.playing = false; L.mode = null;
    setSel('june'); setPlaying(false); setMode(null);
    push(); setCapKey((k) => k + 1); L.draw?.();
  }, [push]);

  const startDay = useCallback((d: ShadeDayKey, m: 'one' | 'all') => {
    const L = live.current;
    if (!L.res) return;
    L.t[d] = L.res[d].riseHour;
    L.sel = d; L.mode = m; L.playing = true; L.hold = 0;
    setSel(d); setMode(m); setPlaying(true);
    push(); setCapKey((k) => k + 1); L.draw?.();
  }, [push]);

  const playAll = useCallback(() => {
    const L = live.current;
    if (!L.res) return;
    for (const d of SHADE_DAY_KEYS) L.t[d] = L.res[d].riseHour;
    startDay('december', 'all');
  }, [startDay]);

  const chooseDay = useCallback((d: ShadeDayKey) => {
    const L = live.current;
    if (!L.res) return;
    if (L.reduced) {
      L.sel = d; setSel(d); setPlaying(false); L.playing = false; push(); setCapKey((k) => k + 1); L.draw?.();
      return;
    }
    startDay(d, 'one');
  }, [startDay, push]);

  const togglePlay = useCallback(() => {
    const L = live.current;
    if (!L.res) return;
    if (L.playing) { L.playing = false; setPlaying(false); setCapKey((k) => k + 1); return; }
    const r = L.res[L.sel];
    if (L.t[L.sel] >= r.setHour - 1e-6) { startDay(L.sel, 'one'); return; }
    L.playing = true; L.mode = L.mode ?? 'one'; setPlaying(true); setMode(L.mode);
  }, [startDay]);

  const seek = useCallback((hour: number) => {
    const L = live.current;
    const r = L.res?.[L.sel];
    if (!r) return;
    L.t[L.sel] = Math.max(r.riseHour, Math.min(r.setHour, hour));
    L.playing = false; L.mode = null; setPlaying(false); setMode(null);
    push(); setCapKey((k) => k + 1); L.draw?.();
  }, [push]);

  // Keep `live` in step with the React inputs.
  useEffect(() => {
    const L = live.current;
    L.res = results;
    if (results) {
      // A different height keeps each day's clock where it was (rise and set do not depend on it).
      for (const d of SHADE_DAY_KEYS) L.t[d] = Math.max(results[d].riseHour, Math.min(results[d].setHour, L.t[d]));
    }
    setCapKey((k) => k + 1);
    L.draw?.();
  }, [results]);

  // Reduced motion: the finished comparison, with every control live.
  useEffect(() => {
    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const apply = () => {
      const r = !!mq?.matches;
      live.current.reduced = r;
      setReduced(r);
      if (r) finishAll();
    };
    apply();
    mq?.addEventListener('change', apply);
    return () => mq?.removeEventListener('change', apply);
  }, [finishAll]);

  // ── The canvas ──
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const L = live.current;
    let lay = layoutFor(300);

    const layout = () => {
      const w = Math.max(280, Math.round(wrap.clientWidth));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      lay = layoutFor(w);
      L.w = w; L.h = lay.h; L.dpr = dpr;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(lay.h * dpr);
      canvas.style.height = `${lay.h}px`;
      L.palette = readPalette(wrap);
    };

    const draw = () => {
      const P = L.palette;
      const res = L.res;
      if (!P || !res || !L.w) return;
      ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
      ctx.clearRect(0, 0, L.w, L.h);
      const col = tint(P);
      const day = L.sel;
      const r = res[day];
      const at = shadeAt(r, L.t[day]);
      const hM = r.heightM;

      const label = (text: string, x: number, y: number, o: { align?: CanvasTextAlign; color?: string; bold?: boolean; halo?: boolean } = {}) => {
        ctx.save();
        ctx.font = `${o.bold ? '700 ' : o.bold === false ? '' : ''}12px ${P.font}`;
        ctx.textAlign = o.align ?? 'left'; ctx.textBaseline = 'alphabetic';
        if (o.halo !== false) { ctx.lineJoin = 'round'; ctx.lineWidth = 3.5; ctx.strokeStyle = P.ground; ctx.globalAlpha = 0.9; ctx.strokeText(text, x, y); }
        ctx.globalAlpha = 1; ctx.fillStyle = o.color ?? P.ink2; ctx.fillText(text, x, y);
        ctx.restore();
      };

      // ───────────── Plan view ─────────────
      {
        const R = lay.plan;
        const sc = Math.min(R.w / (X1 - X0), R.h / (Y1 - Y0));
        const px = (x: number) => R.x + (x - X0) * sc;
        const py = (y: number) => R.y + (Y1 - y) * sc;
        const path = (pts: Point[]) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(px(p.x), py(p.y)) : ctx.moveTo(px(p.x), py(p.y)))); ctx.closePath(); };

        ctx.save();
        ctx.beginPath(); ctx.roundRect(R.x, R.y, R.w, R.h, 8); ctx.clip();
        ctx.fillStyle = P.ground; ctx.fillRect(R.x, R.y, R.w, R.h);

        // distance guides
        ctx.save();
        ctx.strokeStyle = P.ink; ctx.globalAlpha = 0.16; ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
        for (const d of BED_DISTANCES_M) { ctx.beginPath(); ctx.moveTo(px(X0), py(-d)); ctx.lineTo(px(X1), py(-d)); ctx.stroke(); }
        ctx.restore();

        // beds
        for (const d of BED_DISTANCES_M) {
          ctx.save();
          ctx.beginPath(); ctx.roundRect(px(-BED_W / 2), py(-d + BED_D / 2), BED_W * sc, BED_D * sc, 3);
          ctx.fillStyle = P.grow; ctx.globalAlpha = 0.34; ctx.fill();
          ctx.globalAlpha = 0.8; ctx.strokeStyle = P.grow; ctx.lineWidth = 1.2; ctx.stroke();
          ctx.restore();
        }

        // noon outlines left behind by the days that have passed noon
        for (const k of SHADE_DAY_KEYS) {
          if (L.t[k] < 12 - 1e-9) continue;
          const poly = shadowPolygon(sunPosition(latDeg, res[k].declDeg, 0), hM);
          if (!poly) continue;
          path(poly);
          ctx.save();
          ctx.fillStyle = col[k]; ctx.globalAlpha = k === day ? 0.2 : 0.16; ctx.fill();
          ctx.globalAlpha = 0.95; ctx.strokeStyle = col[k]; ctx.lineWidth = 1.6; ctx.stroke();
          ctx.restore();
        }

        // the shadow now
        if (at.polygon) {
          path(at.polygon);
          ctx.save(); ctx.fillStyle = P.ink; ctx.globalAlpha = 0.38; ctx.fill(); ctx.restore();
        }

        // the screen
        ctx.save();
        const wallH = Math.max(7, 0.5 * sc);
        ctx.fillStyle = P.ink; ctx.globalAlpha = 0.92;
        ctx.beginPath(); ctx.roundRect(px(-SCREEN_LENGTH_M / 2), py(0) - wallH / 2, SCREEN_LENGTH_M * sc, wallH, 2); ctx.fill();
        ctx.restore();

        // bed markers: is the bed's centre in direct sun right now?
        BED_DISTANCES_M.forEach((d, i) => {
          const cx = px(0); const cy = py(-d);
          ctx.save();
          ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2);
          if (at.lit[i]) {
            ctx.fillStyle = P.gold; ctx.fill(); ctx.strokeStyle = P.card; ctx.lineWidth = 1.6; ctx.stroke();
          } else {
            ctx.fillStyle = P.card; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = P.ink; ctx.lineWidth = 1.6; ctx.stroke();
          }
          ctx.restore();
          label(`${d} m`, px(X0) + 7, py(-d) + 4, { color: P.ink });
        });

        // noon shadow lengths, at the right of each outline
        for (const k of SHADE_DAY_KEYS) {
          if (L.t[k] < 12 - 1e-9) continue;
          const len = res[k].noon.shadowLengthM;
          label(`${T.daysShort[k]} ${metres(len)}`, px(X1 - 0.3), py(-len) + 4, { align: 'right', color: col[k], bold: true });
        }

        // the object's name, north of it
        label(T.objectName(hM), px(0), py(0) - wallH / 2 - 7, { align: 'center', color: P.ink, bold: true });

        // the sun, on the plan's rim, on its true bearing
        if (at.up) {
          const dx = Math.sin((at.sun.azimuthDeg * Math.PI) / 180);
          const dy = Math.cos((at.sun.azimuthDeg * Math.PI) / 180);
          const m = 1.0;
          const tx = dx > 1e-9 ? (X1 - m) / dx : dx < -1e-9 ? (X0 + m) / dx : Infinity;
          const ty = dy > 1e-9 ? (Y1 - m) / dy : dy < -1e-9 ? (Y0 + m) / dy : Infinity;
          const tt = Math.min(tx, ty);
          const sx = px(dx * tt); const sy = py(dy * tt);
          ctx.save();
          ctx.strokeStyle = P.gold; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.2; ctx.setLineDash([3, 5]);
          ctx.beginPath(); ctx.moveTo(px(0), py(0)); ctx.lineTo(sx, sy); ctx.stroke();
          ctx.setLineDash([]); ctx.globalAlpha = 1;
          ctx.strokeStyle = P.gold; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
          for (let k = 0; k < 8; k += 1) {
            const a = (k * Math.PI) / 4;
            ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * 9, sy + Math.sin(a) * 9); ctx.lineTo(sx + Math.cos(a) * 13, sy + Math.sin(a) * 13); ctx.stroke();
          }
          ctx.beginPath(); ctx.arc(sx, sy, 6.5, 0, Math.PI * 2); ctx.fillStyle = P.gold; ctx.fill();
          ctx.restore();
        }

        // compass: north arrow, and the other three edges named
        {
          const ax = R.x + R.w - 20; const ay = R.y + 22;
          ctx.save();
          ctx.strokeStyle = P.ink; ctx.fillStyle = P.ink; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(ax, ay + 22); ctx.lineTo(ax, ay - 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(ax - 5, ay + 5); ctx.lineTo(ax, ay - 4); ctx.lineTo(ax + 5, ay + 5); ctx.closePath(); ctx.fill();
          ctx.restore();
          label(T.northWord, ax, ay - 8, { align: 'center', color: P.ink, bold: true, halo: false });
          label('S', R.x + R.w / 2, R.y + R.h - 7, { align: 'center', halo: false });
          label('W', R.x + 8, R.y + R.h - 7, { halo: false });
          label('E', R.x + R.w - 8, R.y + R.h - 7, { align: 'right', halo: false });
        }
        ctx.restore();
        ctx.save(); ctx.strokeStyle = P.edge; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1, 8); ctx.stroke(); ctx.restore();
      }

      // ───────────── Sky: how high the sun is, hour by hour ─────────────
      {
        const R = lay.sky;
        const ml = 30; const mr = 8; const mt = 30; const mb = 22;
        const x0 = R.x + ml; const x1 = R.x + R.w - mr; const y0 = R.y + R.h - mb; const y1 = R.y + mt;
        const T0 = 4.5; const T1 = 19.5; const A1 = 90;
        const tx = (h: number) => x0 + ((h - T0) / (T1 - T0)) * (x1 - x0);
        const ty = (a: number) => y0 - (a / A1) * (y0 - y1);
        label(T.skyTitle, R.x, R.y + 12, { color: P.ink2, bold: true, halo: false });
        ctx.save();
        ctx.strokeStyle = P.ink; ctx.lineWidth = 1;
        ctx.globalAlpha = 0.14;
        for (const a of [30, 60, 90]) { ctx.beginPath(); ctx.moveTo(x0, ty(a)); ctx.lineTo(x1, ty(a)); ctx.stroke(); }
        ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
        ctx.restore();
        for (const a of [0, 30, 60, 90]) label(`${a}°`, x0 - 5, ty(a) + 4, { align: 'right', halo: false });
        for (const h of [6, 9, 12, 15, 18]) label(String(h).padStart(2, '0'), tx(h), y0 + 15, { align: 'center', halo: false });

        for (const k of SHADE_DAY_KEYS) {
          const rr = res[k];
          const steps = 90;
          const arc = (until: number) => {
            ctx.beginPath();
            for (let i = 0; i <= steps; i += 1) {
              const h = rr.riseHour + (i / steps) * (Math.min(until, rr.setHour) - rr.riseHour);
              const a = Math.max(0, sunPosition(latDeg, rr.declDeg, hourAngleOf(h)).altitudeDeg);
              if (i) ctx.lineTo(tx(h), ty(a)); else ctx.moveTo(tx(h), ty(a));
            }
          };
          ctx.save();
          ctx.strokeStyle = col[k]; ctx.lineCap = 'round';
          ctx.globalAlpha = 0.28; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]); arc(rr.setHour); ctx.stroke();
          ctx.setLineDash([]);
          if (L.t[k] > rr.riseHour + 1e-6) { ctx.globalAlpha = 1; ctx.lineWidth = k === day ? 3 : 2; arc(L.t[k]); ctx.stroke(); }
          ctx.restore();
          if (k !== day && L.t[k] > rr.riseHour + 1e-6 && L.t[k] < rr.setHour - 1e-6) {
            const a = sunPosition(latDeg, rr.declDeg, hourAngleOf(L.t[k])).altitudeDeg;
            ctx.save(); ctx.fillStyle = col[k]; ctx.beginPath(); ctx.arc(tx(L.t[k]), ty(Math.max(0, a)), 3.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
          }
        }
        // noon marker
        ctx.save(); ctx.strokeStyle = P.ink; ctx.globalAlpha = 0.25; ctx.setLineDash([2, 4]);
        ctx.beginPath(); ctx.moveTo(tx(12), y0); ctx.lineTo(tx(12), y1 - 6); ctx.stroke(); ctx.restore();
        // the sun now
        const cur = Math.max(0, at.sun.altitudeDeg);
        const sx = tx(L.t[day]); const sy = ty(cur);
        ctx.save();
        ctx.strokeStyle = P.gold; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.2; ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, y0); ctx.stroke(); ctx.setLineDash([]);
        ctx.globalAlpha = 1; ctx.fillStyle = P.gold; ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = P.card; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.restore();
      }

      // ───────────── Bars: hours of direct sun, bed by bed ─────────────
      {
        const R = lay.bars;
        label(T.barsTitle, R.x, R.y + 12, { color: P.ink2, bold: true, halo: false });
        const top = R.y + 24;
        const x0 = R.x + 40; const x1 = R.x + R.w - 50;
        const maxH = Math.ceil(Math.max(...SHADE_DAY_KEYS.map((k) => res[k].daylightHours)));
        const hx = (h: number) => x0 + (h / maxH) * (x1 - x0);
        ctx.save();
        ctx.strokeStyle = P.ink; ctx.globalAlpha = 0.12; ctx.lineWidth = 1;
        for (let h = 0; h <= maxH; h += 4) { ctx.beginPath(); ctx.moveTo(hx(h), top - 2); ctx.lineTo(hx(h), top + BED_DISTANCES_M.length * ROW_H - 4); ctx.stroke(); }
        ctx.restore();
        BED_DISTANCES_M.forEach((d, i) => {
          const y = top + i * ROW_H;
          label(`${d} m`, R.x, y + 17, { color: P.ink, halo: false });
          SHADE_DAY_KEYS.forEach((k, j) => {
            const rr = res[k];
            const by = y + 3 + j * 9;
            const started = L.t[k] > rr.riseHour + 1e-6;
            if (!started) return;
            ctx.save();
            ctx.fillStyle = col[k]; ctx.globalAlpha = 0.16;
            ctx.beginPath(); ctx.roundRect(x0, by, hx(rr.daylightHours) - x0, 7, 2); ctx.fill();
            const got = sunHoursSoFar(rr, i, L.t[k]);
            ctx.globalAlpha = 0.95;
            if (got > 0.005) { ctx.beginPath(); ctx.roundRect(x0, by, Math.max(2, hx(got) - x0), 7, 2); ctx.fill(); }
            ctx.restore();
            if (k === day) label(hours(got), hx(rr.daylightHours) + 5, by + 7, { color: col[k], bold: true, halo: false });
          });
        });
        // axis
        const ay = top + BED_DISTANCES_M.length * ROW_H + 8;
        for (let h = 0; h <= maxH; h += 4) label(String(h), hx(h), ay, { align: 'center', halo: false });
      }
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
      if (L.reduced || !L.visible || !L.res) { last = 0; return; }
      if (L.playing) {
        const rr = L.res[L.sel];
        if (L.hold > 0) {
          L.hold -= dt;
          if (L.hold <= 0) {
            const next = SHADE_DAY_KEYS[SHADE_DAY_KEYS.indexOf(L.sel) + 1];
            if (L.mode === 'all' && next) { L.t[next] = L.res[next].riseHour; L.sel = next; setSel(next); L.hold = 0; setCapKey((k) => k + 1); }
            else { L.playing = false; L.mode = null; setPlaying(false); setMode(null); }
          }
        } else {
          L.t[L.sel] = Math.min(rr.setHour, L.t[L.sel] + (dt * rr.daylightHours) / DAY_SECONDS);
          if (L.t[L.sel] >= rr.setHour) {
            const last3 = L.sel === 'june';
            if (L.mode === 'all' && !last3) L.hold = HOLD_SECONDS;
            else { L.playing = false; L.mode = null; setPlaying(false); setMode(null); L.hold = 0; }
            setCapKey((k) => k + 1);
            setClock(L.t[L.sel]);
          }
        }
        draw();
        if (now - L.lastPush > PUSH_MS) { setClock(L.t[L.sel]); L.lastPush = now; }
      }
    };
    raf = requestAnimationFrame(frame);

    const ro = new ResizeObserver(() => { layout(); draw(); });
    ro.observe(wrap);
    const startOnce = () => {
      if (L.autoplayed || L.reduced) return;
      L.autoplayed = true;
      playAll();
    };
    const io = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((entries) => {
      for (const e of entries) {
        L.visible = e.isIntersecting && document.visibilityState === 'visible';
        if (L.visible) startOnce();
      }
    }, { threshold: 0.3 });
    io?.observe(canvas);
    if (!io) { L.visible = true; startOnce(); }
    const onVis = () => { L.visible = L.visible && document.visibilityState === 'visible'; };
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
      io?.disconnect();
      mo.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      scheme?.removeEventListener('change', repaint);
      L.draw = null;
    };
  }, [latDeg, playAll]);

  // Dev and ?figure=check only: drive the figure from a test harness.
  useEffect(() => {
    const allow = process.env.NODE_ENV !== 'production' || new URLSearchParams(window.location.search).get('figure') === 'check';
    if (!allow) return;
    const w = window as unknown as { __shadeFall?: unknown };
    w.__shadeFall = {
      seek: (day: ShadeDayKey, hour: number) => {
        const L = live.current;
        L.sel = day; setSel(day); L.t[day] = hour; L.playing = false; L.mode = null; setPlaying(false); setMode(null);
        push(); setCapKey((k) => k + 1); L.draw?.();
      },
      setHeight: (i: number) => setHeightIdx(i),
      finish: () => finishAll(),
      playAll: () => playAll(),
      pause: () => { live.current.playing = false; setPlaying(false); },
      facts: () => live.current.res,
    };
    return () => { delete w.__shadeFall; };
  }, [push, finishAll, playAll]);

  const onCanvasKey = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const L = live.current;
    const r = L.res?.[L.sel];
    if (!r) return;
    const step = e.shiftKey ? 1 : 10 / 60;
    if (e.key === 'ArrowRight') seek(L.t[L.sel] + step);
    else if (e.key === 'ArrowLeft') seek(L.t[L.sel] - step);
    else if (e.key === 'Home') seek(r.riseHour);
    else if (e.key === 'End') seek(r.setHour);
    else return;
    e.preventDefault();
  };

  // ── Words (rewritten only when something changes, never at animation rate) ──
  const sentences = useMemo(() => {
    if (!results) return null;
    const J = results.june; const D = results.december; const E = results.equinox;
    const i2 = BED_DISTANCES_M.indexOf(2); const i5 = BED_DISTANCES_M.indexOf(5);
    const obj = T.objectName(heightM);
    const ratio = J.noon.shadowLengthM / D.noon.shadowLengthM;
    return {
      noon: `At noon the ${obj}’s shadow is ${metres(D.noon.shadowLengthM)} long on 21 December, ${metres(E.noon.shadowLengthM)} at the equinox and ${metres(J.noon.shadowLengthM)} on 21 June: about ${numberLabel(ratio, 0)} times longer in midwinter than in midsummer.`,
      beds: `On 21 June a bed 2 m south of the ${obj} gets ${hours(J.beds[i2].sunHours)} of direct sun, out of ${hours(J.daylightHours)} of daylight; at 5 m it gets ${hours(J.beds[i5].sunHours)}. On 21 December the same two beds get ${hours(D.beds[i2].sunHours)} and ${hours(D.beds[i5].sunHours)}, out of ${hours(D.daylightHours)}.`,
    };
  }, [results, heightM]);

  const caption = useMemo(() => {
    const L = live.current;
    if (!results) return '';
    const r = results[L.sel];
    const t = L.t[L.sel];
    const obj = T.objectName(heightM);
    if (t >= r.setHour - 1e-6) {
      const bits = r.beds.map((b) => `${b.distanceM} m ${hours(b.sunHours)}`).join(', ');
      return `${T.dayLong[L.sel]}, sunset at ${solarClock(r.setHour)} solar time. Hours of direct sun behind the ${obj}, by bed: ${bits}, out of ${hours(r.daylightHours)} of daylight.`;
    }
    const a = shadeAt(r, t);
    if (!a.up) return `${T.dayLong[L.sel]}, ${solarClock(t)} solar time. ${T.noPlay}`;
    const noon = Math.abs(t - 12) < 1.5 / 60;
    const lit = BED_DISTANCES_M.filter((_, i) => a.lit[i]).map((d) => `${d} m`);
    const dark = BED_DISTANCES_M.filter((_, i) => !a.lit[i]).map((d) => `${d} m`);
    const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
    const beds = `${lit.length ? `Beds in the sun: ${list(lit)}.` : 'No bed is in the sun.'}${dark.length ? ` In shade: ${list(dark)}.` : ''}`;
    const len = a.shadowLengthM ?? 0;
    const lenText = len > 40 ? 'longer than the plot' : metres(len);
    const dir = compassWord(a.sun.azimuthDeg + 180);
    return `${T.dayLong[L.sel]}, ${solarClock(t)} solar time. The sun is ${numberLabel(a.sun.altitudeDeg, 0)}° high, bearing ${numberLabel(a.sun.azimuthDeg, 0)}° (${compassWord(a.sun.azimuthDeg)}). The ${obj}’s shadow is ${lenText} long and points ${dir}.${noon ? ' In the southern hemisphere the midday sun stands in the north, so midday shadows point south.' : ''} ${beds}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capKey, results, heightM]);

  const readout = useMemo(() => {
    if (!results) return null;
    const r = results[sel];
    const a = shadeAt(r, clock);
    const atSet = clock >= r.setHour - 1e-6;
    return {
      clock: solarClock(clock),
      sun: atSet ? 'Sunset: the sun is on the horizon.' : a.up ? `Sun ${numberLabel(a.sun.altitudeDeg, 0)}° high · bearing ${numberLabel(a.sun.azimuthDeg, 0)}° ${aspectLabel(a.sun.azimuthDeg)}` : T.noPlay,
      shadow: a.up && a.shadowLengthM !== null ? `Shadow ${a.shadowLengthM > 40 ? 'longer than the plot' : metres(a.shadowLengthM)}, pointing ${compassWord(a.sun.azimuthDeg + 180)}` : '',
    };
  }, [results, sel, clock]);

  if (!results || !sentences || !readout) return null;
  const rSel = results[sel];
  const atEnd = clock >= rSel.setHour - 1e-6;
  const ariaLabel = `${sentences.noon} ${sentences.beds} ${T.keysHint}`;

  return (
    <section className={s.card} aria-labelledby="shade-fall-title">
      <div className={s.head}>
        <div>
          <h2 id="shade-fall-title" className={s.title}>{T.title}</h2>
          <p className={s.sub}>{T.sub(`${numberLabel(Math.abs(latDeg), 1)}°`)}</p>
        </div>
      </div>

      <div className={s.controls}>
        <div className={s.group}>
          <span className={s.groupLabel} id="shade-fall-day">{T.dayLabel}</span>
          <div className={s.chips} role="group" aria-labelledby="shade-fall-day">
            {SHADE_DAY_KEYS.map((d) => (
              <button key={d} type="button" className={s.chip} aria-pressed={d === sel} onClick={() => chooseDay(d)}>{T.days[d]}</button>
            ))}
          </div>
        </div>
        <div className={s.group}>
          <span className={s.groupLabel} id="shade-fall-object">{T.objectLabel}</span>
          <div className={s.chips} role="group" aria-labelledby="shade-fall-object">
            {HEIGHTS.map((h, i) => (
              <button key={h} type="button" className={s.chip} aria-pressed={i === heightIdx} onClick={() => setHeightIdx(i)}>{T.objectChip(h)}</button>
            ))}
          </div>
        </div>
        {!reduced && (
          <div className={s.actions}>
            <button type="button" className={`${s.play} ${s.playMain}`} onClick={togglePlay} aria-label={playing ? T.pauseLabel : T.playLabel}>
              {playing ? <Pause size={16} aria-hidden /> : atEnd ? <Repeat size={16} aria-hidden /> : <Play size={16} aria-hidden />}
              {playing ? T.pause : atEnd ? T.replay : T.play}
            </button>
            <button type="button" className={s.play} onClick={playAll} aria-label={T.playAllLabel} aria-pressed={playing && mode === 'all'}>
              <Play size={16} aria-hidden />{T.playAll}
            </button>
          </div>
        )}
      </div>

      <div className={s.now} aria-hidden>
        <span className={s.clock}>{readout.clock} <span className={s.readout}>{T.solarTime}</span></span>
        <span className={s.readout}>{readout.sun}</span>
        {readout.shadow && <span className={s.readout}>{readout.shadow}</span>}
      </div>

      <div ref={wrapRef} className={s.stage}>
        <canvas
          ref={canvasRef}
          className={s.canvas}
          role="img"
          tabIndex={0}
          aria-label={ariaLabel}
          onKeyDown={onCanvasKey}
        />
      </div>

      <div className={s.scrub}>
        <label htmlFor="shade-fall-time" className={s.groupLabel}>{T.timeLabel}</label>
        <input
          id="shade-fall-time"
          type="range"
          min={Math.floor(rSel.riseHour * 60)}
          max={Math.ceil(rSel.setHour * 60)}
          step={1}
          value={Math.round(clock * 60)}
          className={s.range}
          aria-valuetext={`${solarClock(clock)} ${T.solarTime}`}
          onChange={(e) => seek(Number(e.currentTarget.value) / 60)}
        />
      </div>

      <div className={s.legend} aria-hidden>
        {SHADE_DAY_KEYS.map((d) => (
          <span key={d} className={s.key}><span className={d === 'december' ? s.swDec : d === 'equinox' ? s.swEq : s.swJun} />{T.days[d]}</span>
        ))}
        <span className={s.key}><span className={s.swShadow} />{T.legend.shadow}</span>
        <span className={s.key}><span className={s.swBed} />{T.legend.bed}</span>
        <span className={s.key}><span className={s.swSun} />{T.legend.sun}</span>
      </div>

      <p className={s.caption} aria-live="polite">{caption}</p>
      <p className={s.summary}>{sentences.noon} {sentences.beds}</p>

      <div className={s.tableWrap}>
        <table className={s.table}>
          <caption>Hours of direct sun a day, {T.objectName(heightM)}</caption>
          <thead>
            <tr>
              <th scope="col">Bed</th>
              {SHADE_DAY_KEYS.map((d) => <th scope="col" key={d}>{T.tableHead[d]}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Daylight</th>
              {SHADE_DAY_KEYS.map((d) => <td key={d}>{hours(results[d].daylightHours)}</td>)}
            </tr>
            {BED_DISTANCES_M.map((dist, i) => (
              <tr key={dist}>
                <th scope="row">{dist} m south</th>
                {SHADE_DAY_KEYS.map((d) => {
                  const v = results[d].beds[i].sunHours;
                  return <td key={d} className={v < 0.05 ? s.cellNone : undefined}>{hours(v)}</td>;
                })}
              </tr>
            ))}
            <tr>
              <th scope="row">Noon shadow</th>
              {SHADE_DAY_KEYS.map((d) => <td key={d}>{metres(results[d].noon.shadowLengthM)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>

      <p className={s.note}>{T.notes({ slopeDeg, lengthM: SCREEN_LENGTH_M, declDeg: OBLIQUITY_DEG, latDeg })}</p>
    </section>
  );
}

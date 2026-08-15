'use client';

/**
 * Atlas side panel / bottom sheet — everything we can honestly say about one
 * tapped point on Earth, from a /api/location-data response.
 *
 * Visual language follows the app's 2026 warm-almanac idiom (see
 * components/DataPanel.tsx's Climate tab and app/plan/page.tsx): cream cards
 * on paper, Newsreader display serif for readings, Public Sans for chrome,
 * forest #1F4D2B as the sole interactive accent.
 *
 * HONESTY RULES BAKED IN HERE, deliberately, so a redesign can't lose them:
 *  - The Köppen block carries a "modelled from a coarse global grid" caveat —
 *    the classifier's input is a ~55 km grid and coastal/mountain points can
 *    read as a neighbouring climate (see lib/koppen-global.ts's docblock).
 *  - Soil is shown WITH its provenance caution from lib/plan-assurance.ts's
 *    SOIL_CAUTION, keyed by soilSource. An 'estimate' is never presented as a
 *    reading. A missing soilSource is shown as unknown, not hidden.
 *  - "What could grow here" is labelled as a catalog read-out, not advice,
 *    and disappears when the climate data is unusable.
 */

import { AlertTriangle, Sprout, Mountain, Droplets, Thermometer, Layers, Leaf } from 'lucide-react';
import type { LocationData } from '@/lib/types';
import { SOIL_CAUTION } from '@/lib/plan-assurance';
import { getCropArt } from '@/lib/crop-art';
import {
  atlasRainPattern, catalogMonthFor, koppenFrom, sowableInMonth,
  type AtlasRainPattern,
} from '@/lib/atlas';

const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const PATTERN_LABEL: Record<AtlasRainPattern, string> = {
  'summer': 'Summer rainfall',
  'winter': 'Winter rainfall',
  'all-year': 'Year-round rainfall',
  'mild-frost': 'Summer rainfall, light frost',
};

/* ── Shared micro-styles (copied idiom from DataPanel) ─────────────────── */

function Card({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div
      style={{
        background: '#FFFEFA',
        border: '1px solid #E2D8C4',
        borderRadius: 14,
        padding: 16,
        ...(accent ? { borderLeftWidth: 3, borderLeftColor: accent, borderLeftStyle: 'solid' } : {}),
      }}
    >
      {children}
    </div>
  );
}

function Label({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-sans font-bold uppercase mb-2" style={{ color: '#B07A1E', letterSpacing: '0.12em', fontSize: 11 }}>
      {icon}
      {children}
    </div>
  );
}

function chip(bg: string, color: string): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 12,
    padding: '4px 10px', borderRadius: 999, background: bg, color,
  };
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl px-2.5 py-2 text-center" style={{ background: 'rgba(31,77,43,0.06)', border: '1px solid rgba(31,77,43,0.08)' }}>
      <div className="font-display font-semibold text-sm" style={{ color: '#20190F' }}>{value}</div>
      <div className="font-sans mt-0.5" style={{ color: '#8C7A62', fontSize: 10 }}>{label}</div>
      {sub && <div className="font-sans" style={{ color: '#94876F', fontSize: 9.5 }}>{sub}</div>}
    </div>
  );
}

/** Monthly bars, in the Climate-tab idiom (value on top, month letter below). */
function MonthBars({ values, unit, colorFor, height = 96 }: {
  values: number[];
  unit: string;
  colorFor: (v: number) => string;
  height?: number;
}) {
  const max = Math.max(...values.map(Math.abs), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: height + 34, paddingTop: 2 }}>
      {values.map((v, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 9.5, color: '#766A50', marginBottom: 4 }}>{Math.round(v)}</span>
          <div style={{
            width: '68%', maxWidth: 20,
            height: Math.max(5, (Math.abs(v) / max) * height),
            borderRadius: '4px 4px 2px 2px',
            background: colorFor(v),
          }} />
          <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 9.5, color: '#AC9E82', marginTop: 6 }}>{MONTH_LETTERS[i]}</span>
        </div>
      ))}
      <span className="sr-only">{unit}</span>
    </div>
  );
}

/* ── Soil provenance caution ───────────────────────────────────────────── */

const SOIL_CAUTION_STYLE: Record<'lab' | 'soilgrids' | 'estimate' | 'unknown', { bg: string; border: string; color: string; title: string }> = {
  lab: { bg: '#EAF3E2', border: '#CBDDBA', color: '#3C6B3F', title: 'Your soil test' },
  soilgrids: { bg: 'rgba(31,77,43,0.05)', border: '#E2D8C4', color: '#5C5040', title: 'Modelled — SoilGrids' },
  estimate: { bg: '#F8ECDD', border: '#E4C9A2', color: '#8A4A12', title: 'Not a reading' },
  unknown: { bg: 'rgba(32,25,15,0.05)', border: '#E2D8C4', color: '#5C5040', title: 'Source unknown' },
};

function SoilProvenance({ source }: { source: LocationData['soil']['soilSource'] }) {
  const key = source ?? 'unknown';
  const st = SOIL_CAUTION_STYLE[key];
  const text = source
    ? SOIL_CAUTION[source]
    : 'This reading did not record where its numbers came from. Treat it with the same caution as a model estimate.';
  return (
    <div className="flex gap-2 items-start rounded-xl px-3 py-2.5 mt-3" style={{ background: st.bg, border: `1px solid ${st.border}` }}>
      <AlertTriangle size={13} style={{ color: st.color, flexShrink: 0, marginTop: 2 }} />
      <div>
        <div className="font-sans font-bold uppercase" style={{ fontSize: 10, letterSpacing: '0.1em', color: st.color }}>{st.title}</div>
        <p className="font-display leading-relaxed mt-0.5" style={{ fontSize: 12.5, color: '#3A2E22' }}>{text}</p>
      </div>
    </div>
  );
}

/* ── The panel ─────────────────────────────────────────────────────────── */

export default function AtlasPanel({ data, placeName, now = new Date() }: {
  data: LocationData;
  placeName?: string;
  /** Injectable for stable rendering in tests/previews. */
  now?: Date;
}) {
  const { climate, rainfall, soil, elevation } = data;
  const derived = koppenFrom(data);
  const koppenKnown = climate.koppen !== '?' && climate.koppen !== '';
  const koppenNote = climate.koppenNote
    ?? (derived.code === climate.koppen ? derived.growerNote : '');

  const temps = climate.monthlyTemp ?? [];
  const tMin = temps.length ? Math.min(...temps) : climate.minTemp;
  const tMax = temps.length ? Math.max(...temps) : climate.maxTemp;
  const annualRain = Math.round(rainfall.annual);
  const rainMax = Math.max(...rainfall.monthly, 1);
  const rainAvg = annualRain / 12;

  const pattern = atlasRainPattern(data);
  const monthNow = now.getMonth() + 1;
  const catalogMonth = pattern ? catalogMonthFor(monthNow, data.lat) : monthNow;
  const growable = pattern ? sowableInMonth(pattern, catalogMonth) : [];
  const northern = data.lat >= 0;

  const frostChipGreen = tMin >= 5;
  const frostChip = tMin < 2 ? 'Frost expected' : tMin < 5 ? 'Light frost possible' : 'Frost-free';

  const coordLabel = `${Math.abs(data.lat).toFixed(3)}°${data.lat < 0 ? 'S' : 'N'}, ${Math.abs(data.lon).toFixed(3)}°${data.lon < 0 ? 'W' : 'E'}`;

  return (
    <div className="space-y-3">

      {/* Where */}
      <div className="px-0.5">
        {placeName && (
          <div className="font-display font-bold" style={{ fontSize: 19, color: '#20190F', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
            {placeName}
          </div>
        )}
        <div className="font-sans" style={{ fontSize: 11.5, color: '#8C7A62', marginTop: placeName ? 2 : 0 }}>
          {coordLabel} · {Math.round(elevation.elevation)} m
        </div>
      </div>

      {/* 1 — Climate headline (Köppen) */}
      <Card accent="#1F4D2B">
        <Label>Climate</Label>
        {koppenKnown ? (
          <>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-display font-bold" style={{ fontSize: 26, color: '#1F4D2B', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {climate.koppen}
              </span>
              <span className="font-display font-semibold" style={{ fontSize: 16, color: '#20190F' }}>
                {climate.koppenDesc}
              </span>
            </div>
            {koppenNote && (
              <p className="font-display mt-2 leading-relaxed" style={{ fontSize: 14.5, fontStyle: 'italic', color: '#4A4030' }}>
                {koppenNote}
              </p>
            )}
            <div style={{ display: 'flex', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>
              <span style={chip('#E7EEF4', '#3A6E92')}>≈ {annualRain} mm/yr</span>
              {pattern && <span style={chip('#EDE7DA', '#7A6A48')}>{PATTERN_LABEL[pattern]}</span>}
              <span style={chip(frostChipGreen ? '#DDEBCF' : '#F4EAD0', frostChipGreen ? '#3C6B3F' : '#9A7A2E')}>{frostChip}</span>
            </div>
          </>
        ) : (
          <p className="font-display leading-relaxed" style={{ fontSize: 14, color: '#4A4030' }}>
            Climate data could not be fetched for this point — the figures below are placeholders, not readings. Try the point again.
          </p>
        )}
        <p className="font-sans mt-2.5" style={{ fontSize: 10.5, color: '#94876F', lineHeight: 1.45 }}>
          Modelled from a coarse global climate grid (~55 km) — coastal and mountain points can read as a neighbouring climate.
        </p>
      </Card>

      {/* 2 — Rainfall */}
      {rainfall.monthly?.length === 12 && (
        <Card>
          <div className="flex items-baseline justify-between">
            <Label icon={<Droplets size={12} />}>Rainfall</Label>
            <span className="font-sans font-bold" style={{ fontSize: 12.5, color: '#3A6E92' }}>≈ {annualRain} mm / yr</span>
          </div>
          <MonthBars
            values={rainfall.monthly}
            unit="mm"
            colorFor={(v) => (v > rainAvg * 0.9 ? '#3F92C9' : '#A6C9DF')}
            height={86}
          />
          <div className="flex justify-between font-sans mt-1" style={{ fontSize: 11, color: '#8C7A62' }}>
            <span>Wet: <b style={{ color: '#5C5040', fontWeight: 600 }}>{rainfall.wetSeason}</b></span>
            <span>Dry: <b style={{ color: '#5C5040', fontWeight: 600 }}>{rainfall.drySeason}</b></span>
          </div>
        </Card>
      )}

      {/* 3 — Temperature */}
      <Card>
        <Label icon={<Thermometer size={12} />}>Temperature</Label>
        <div className="grid grid-cols-3 gap-2 mb-1">
          <MiniStat label="Mean" value={`${climate.meanTemp}°C`} />
          <MiniStat label="Coldest month" value={`${Math.round(tMin)}°C`} />
          <MiniStat label="Hottest month" value={`${Math.round(tMax)}°C`} />
        </div>
        {temps.length === 12 && (
          <MonthBars
            values={temps}
            unit="°C"
            colorFor={(v) => {
              const norm = (v - tMin) / ((tMax - tMin) || 1);
              return `hsl(${Math.round(38 - norm * 14)}, ${Math.round(55 + norm * 20)}%, ${Math.round(62 - norm * 14)}%)`;
            }}
            height={64}
          />
        )}
      </Card>

      {/* 4 — Soil, with provenance */}
      <Card>
        <Label icon={<Layers size={12} />}>Soil</Label>
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Texture" value={soil.textureClass} />
          <MiniStat label="pH" value={String(soil.ph)} sub={soil.ph < 5.5 ? 'acidic' : soil.ph > 7.5 ? 'alkaline' : 'near neutral'} />
          <MiniStat label="Organic C" value={`${soil.organicCarbon}%`} />
        </div>
        <div className="space-y-2 mt-3">
          {[
            { name: 'Sand', pct: soil.sand, color: '#C07A1E' },
            { name: 'Silt', pct: soil.silt, color: '#1F4D2B' },
            { name: 'Clay', pct: soil.clay, color: '#2D6B3C' },
          ].map(({ name, pct, color }) => (
            <div key={name}>
              <div className="flex justify-between font-sans mb-0.5" style={{ fontSize: 11, color: '#5C5040' }}>
                <span>{name}</span>
                <span style={{ color }}>{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(226,216,196,0.6)' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color, opacity: 0.8 }} />
              </div>
            </div>
          ))}
        </div>
        <SoilProvenance source={soil.soilSource} />
      </Card>

      {/* 5 — Terrain */}
      <Card>
        <Label icon={<Mountain size={12} />}>Terrain</Label>
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Elevation" value={`${Math.round(elevation.elevation)} m`} />
          <MiniStat label="Slope" value={`${elevation.slopeDeg}°`} sub={`${elevation.slopePct}%`} />
          <MiniStat label="Aspect" value={elevation.aspectLabel} sub={`${Math.round(elevation.aspectDeg)}°`} />
        </div>
      </Card>

      {/* 6 — South African layers, when the point has them */}
      {(data.vegetation || data.bru) && (
        <Card>
          <Label icon={<Leaf size={12} />}>South African layers</Label>
          {data.vegetation && (
            <div className="mb-2">
              <div className="font-display font-semibold" style={{ fontSize: 14, color: '#20190F' }}>{data.vegetation.vegUnit}</div>
              <div className="font-sans" style={{ fontSize: 11.5, color: '#8C7A62', marginTop: 1 }}>
                {data.vegetation.biome} · {data.vegetation.bioregion} (SANBI 2018)
              </div>
            </div>
          )}
          {data.bru && (
            <div>
              <div className="font-display font-semibold" style={{ fontSize: 14, color: '#20190F' }}>
                Bioresource zone {data.bru.brucode}
              </div>
              <div className="font-sans" style={{ fontSize: 11.5, color: '#8C7A62', marginTop: 1 }}>
                Zone rainfall {Math.round(data.bru.map)} mm/yr · mean {data.bru.tmean}°C
              </div>
              <div className="font-sans" style={{ fontSize: 10, color: '#94876F', marginTop: 3 }}>{data.bru.attribution}</div>
            </div>
          )}
        </Card>
      )}

      {/* 7 — What could grow here */}
      {pattern && (
        <Card accent="#C07A1E">
          <Label icon={<Sprout size={12} />}>What could grow here</Label>
          <p className="font-sans" style={{ fontSize: 11.5, color: '#8C7A62', lineHeight: 1.5, marginBottom: 10 }}>
            From our crop catalog: crops with a sowing window open in {MONTH_NAMES[monthNow - 1]} under a{' '}
            <b style={{ color: '#5C5040', fontWeight: 600 }}>{PATTERN_LABEL[pattern].toLowerCase()}</b> pattern
            {northern ? ' (calendar shifted six months for the northern hemisphere)' : ''}.
            A description of the catalog, not planting advice for this site.
          </p>
          {growable.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {growable.map((c) => (
                <span
                  key={c.key}
                  className="font-display"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 13, fontWeight: 600, color: '#20190F',
                    background: 'rgba(31,77,43,0.06)', border: '1px solid rgba(31,77,43,0.12)',
                    borderRadius: 999, padding: '5px 12px 5px 8px',
                  }}
                >
                  {getCropArt(c.key) ? (
                    <img src={getCropArt(c.key)} alt="" aria-hidden style={{ width: 14, height: 14, objectFit: 'contain' }} />
                  ) : (
                    <span aria-hidden style={{ fontSize: 14 }}>{c.icon}</span>
                  )}
                  {c.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="font-display" style={{ fontSize: 13, color: '#5C5040' }}>
              No catalog crop opens a sowing window this month under this pattern.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

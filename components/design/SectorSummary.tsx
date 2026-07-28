'use client';

// Design Studio — SECTOR step. The plain-words twin of the SectorOverlay energies drawn on the
// canvas. The app computes property-specific sun, slope, drainage and coordinate climate-grid
// evidence, then adds clearly disclosed regional named-wind/fire context
// (lib/sector.deriveSectorModel). This card says, in plain English and compass words (never
// degrees), what came from which source so a farmer can compare it with local observation before
// tapping "Looks right →".
//
// Location source: mirrors TankCalculator — prefers `lat`/`site` props when a caller has them in
// scope, and otherwise self-resolves from the SAME localStorage cache the /design page fills
// (imbewu_loc_v3_{lat}_{lon}, keyed off the ?lat/?lon URL params). If nothing is cached it degrades
// honestly (shows model.dataNotes[0]) and still lets the farmer move on — it must NEVER block.

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { LocationData } from '@/lib/types';
import { deriveSectorModel, type SectorModel, type SectorSite } from '@/lib/sector';
import { formatDesignTranslation, type DesignStudioTranslate } from '@/lib/design-studio-i18n';
import { useLanguage } from '@/lib/i18n';

// Studio palette + the sector accent (STEP_ACCENT.sector) and the energy dot colours lifted from
// SectorOverlay so the card and the on-map overlay read as one analysis.
const PAPER = '#FFFEFA';
const DARK = '#20190F';
const GREEN = '#1F4D2B';
const OCHRE = '#C07A1E'; // STEP_ACCENT.sector
const DOT_SUN = '#F7C97E';
const DOT_WIND = '#E08A2C';
const DOT_FIRE = '#D64A2A';
const DOT_WATER = '#3A8EC4';

const COMPASS8_KEYS = [
  'designSectorDirectionNorth',
  'designSectorDirectionNorthEast',
  'designSectorDirectionEast',
  'designSectorDirectionSouthEast',
  'designSectorDirectionSouth',
  'designSectorDirectionSouthWest',
  'designSectorDirectionWest',
  'designSectorDirectionNorthWest',
];
// Bearing (deg clockwise from N) → plain compass WORD (never a number — a gogo farmer reads
// "south-west", not 214°). 8-point is the plain-words sweet spot; 16-point words get unwieldy.
function compassWord(bearingDeg: number, t: DesignStudioTranslate): string {
  const norm = ((bearingDeg % 360) + 360) % 360;
  return t(COMPASS8_KEYS[Math.round(norm / 45) % 8]);
}
// 16-point model label ('NE', 'SSW', …) → plain 8-point word, falling back to the raw label if it
// is somehow unparseable (honest — never invents a direction).
const LABEL_BEARING: Record<string, number> = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
};
function labelWord(label: string, t: DesignStudioTranslate): string {
  const b = LABEL_BEARING[label.toUpperCase().trim()];
  return b == null ? label : compassWord(b, t);
}

/** Self-resolve latitude/longitude + SectorSite from the ?lat/?lon URL params and the design
 *  page's cache. */
function resolveSectorContext(): { lat: number; lon: number; site: SectorSite | null } | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const lat = Number(params.get('lat'));
    const lon = Number(params.get('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    // Key + version must match app/design/page.tsx's readCachedLocationData / TankCalculator.
    const raw = localStorage.getItem(`imbewu_loc_v3_${lat.toFixed(5)}_${lon.toFixed(5)}`);
    const parsed = raw ? (JSON.parse(raw) as LocationData) : null;
    // Same shape app/design/page.tsx builds for glossySite (a superset of {biome, rainfallMm}).
    const site: SectorSite | null = parsed
      ? {
          biome: parsed.biome?.name,
          rainfallMm: parsed.rainfall?.annual,
          rainfallPattern: parsed.rainfall?.pattern ?? parsed.biome?.rainfallPattern,
          elevation: parsed.elevation
            ? {
                slopeDeg: parsed.elevation.slopeDeg,
                slopePct: parsed.elevation.slopePct,
                aspectDeg: parsed.elevation.aspectDeg,
                aspectLabel: parsed.elevation.aspectLabel,
              }
            : undefined,
          climate: parsed.climate
            ? {
                windFromSummer: parsed.climate.windFromSummer,
                windFromWinter: parsed.climate.windFromWinter,
                windSpeed: parsed.climate.windSpeed,
                minTemp: parsed.climate.minTemp,
                maxTemp: parsed.climate.maxTemp,
              }
            : undefined,
        }
      : null;
    return { lat, lon, site };
  } catch {
    return null;
  }
}

export interface SectorSummaryProps {
  /** Optional overrides — win over the self-resolved values when a caller has them in scope. */
  lat?: number;
  lon?: number;
  site?: SectorSite | null;
  /** Advance to the next step (Water). Wired to StepGuide's onNextStep. */
  onLooksRight?: () => void;
}

interface Row {
  key: string;
  dot: string;
  text: string;
}

function buildRows(model: SectorModel, t: DesignStudioTranslate): Row[] {
  const rows: Row[] = [];

  // ☀️ SUN — never missing. SH (below the tropics) → north; NH → south; 'mixed' inside the
  // tropics, where the two solstices disagree on which side the noon sun sits (lib/solar.ts).
  const sunWord =
    model.sun.middayFrom === 'N'
      ? t('designSectorDirectionNorth')
      : model.sun.middayFrom === 'S'
        ? t('designSectorDirectionSouth')
        : t('designSectorSunMixed');
  rows.push({
    key: 'sun',
    dot: DOT_SUN,
    text: formatDesignTranslation(t('designSectorSunRow'), { direction: sunWord.toUpperCase() }),
  });

  // 💨 WIND — coordinate climate-grid means, not a measured property wind rose.
  if (model.windSummer || model.windWinter) {
    const parts: string[] = [];
    if (model.windSummer) parts.push(formatDesignTranslation(t('designSectorWindSummer'), {
      direction: labelWord(model.windSummer.fromLabel, t),
    }));
    if (model.windWinter) parts.push(formatDesignTranslation(t('designSectorWindWinter'), {
      direction: labelWord(model.windWinter.fromLabel, t),
    }));
    rows.push({
      key: 'wind',
      dot: DOT_WIND,
      text: formatDesignTranslation(t('designSectorWindRow'), { directions: parts.join(', ') }),
    });
  }

  // 🔥 FIRE — sourced regional context, never presented as a property measurement.
  if (model.fire) {
    rows.push({
      key: 'fire',
      dot: DOT_FIRE,
      text: formatDesignTranslation(t('designSectorFireRow'), {
        season: model.fire.seasonNote,
        direction: labelWord(model.fire.fromLabel, t),
      }),
    });
  }

  // 💧 WATER (+ frost) — downhill flow direction, and frost pools at the low end on still nights.
  if (model.water) {
    const downWord = compassWord(model.water.downhillBearingDeg, t);
    const frostBit = model.frost ? t('designSectorFrostNote') : '';
    rows.push({
      key: 'water',
      dot: DOT_WATER,
      text: formatDesignTranslation(t('designSectorWaterRow'), { direction: downWord, frost: frostBit }),
    });
  }

  return rows;
}

export default function SectorSummary({ lat, lon, site, onLooksRight }: SectorSummaryProps) {
  const { t } = useLanguage();
  // Prefer props; otherwise self-resolve on mount (client-only, like TankCalculator).
  const [resolved, setResolved] = useState<{ lat: number; lon: number; site: SectorSite | null } | null>(null);
  useEffect(() => {
    if (lat == null) setResolved(resolveSectorContext());
  }, [lat]);

  const effLat = lat ?? resolved?.lat;
  const effLon = lon ?? resolved?.lon;
  const effSite = site ?? resolved?.site ?? null;

  const model = useMemo(
    () => (effLat != null && Number.isFinite(effLat) ? deriveSectorModel(effSite, effLat, effLon) : null),
    [effSite, effLat, effLon],
  );

  const rows = useMemo(() => (model ? buildRows(model, t) : []), [model, t]);
  // Honest degradation/provenance: show missing-data caveats first, otherwise disclose the
  // regional profile rather than implying it was measured at this property.
  const note =
    model?.dataNotes[0] ??
    model?.assumptionNotes[0] ??
    (model ? null : t('designSectorOpenMap'));

  return (
    <div style={{ padding: '2px 8px 4px' }}>
      <div style={{ borderRadius: 12, border: `1.5px solid ${OCHRE}`, background: PAPER, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minHeight: 38, padding: '7px 10px', background: 'rgba(192,122,30,0.10)' }}>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: DARK, flex: 1 }}>{t('designSectorTitle')}</span>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: OCHRE, textTransform: 'uppercase', letterSpacing: 0.3 }}>{t('designSectorSource')}</span>
        </div>

        <div style={{ padding: '8px 10px 4px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {rows.map((r) => (
            <div key={r.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ flexShrink: 0, marginTop: 5, width: 9, height: 9, borderRadius: 9, background: r.dot }} />
              <span style={{ fontSize: 12.5, lineHeight: 1.45, color: DARK }}>{r.text}</span>
            </div>
          ))}
          {note && (
            <div style={{ fontSize: 11.5, lineHeight: 1.4, color: 'rgba(11,18,11,0.6)', fontStyle: 'italic', paddingLeft: 17 }}>
              {note}
            </div>
          )}
        </div>

        <div style={{ padding: '4px 10px 10px' }}>
          <button
            type="button"
            onClick={() => onLooksRight?.()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 42, padding: '8px 18px',
              borderRadius: 10, border: 'none', background: GREEN, color: PAPER, fontWeight: 800, fontSize: 13.5, cursor: 'pointer',
            }}
          >
            {t('designSectorLooksRight')} <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

// Design Studio — WATER step. A dead-simple rain-tank sizing card: type your roof area and daily
// use, and it reads the site's real 30-year rainfall normals to tell you how much the roof banks
// in the wet season and how much JoJo storage carries you through the dry months. Live, no submit.
//
// Rainfall source: it prefers a `monthlyRainfallMm` prop when a caller has LocationData in scope,
// and otherwise self-resolves from the SAME localStorage cache the /design page fills
// (imbewu_loc_v4_{lat}_{lon}, keyed off the ?lat/?lon URL params) — so the card works standalone
// without threading a prop through the page. If nothing is cached, it degrades honestly.

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Droplets } from 'lucide-react';
import type { LocationData } from '@/lib/types';
import { computeTankSizing } from '@/lib/tank-sizing';
import { useLanguage } from '@/lib/i18n';

// Studio palette (kept in sync with StepGuide.tsx) + the water-layer accent.
const PAPER = '#FFFEFA';
const DARK = '#20190F';
const GREEN = '#1F4D2B';
const OCHRE = '#C07A1E';
const BLUE = '#3E8FBF'; // STEP_ACCENT.water

const DEFAULT_ROOF_M2 = 80;
/** Read the same cached LocationData the /design page writes, using the ?lat/?lon URL params. */
function resolveCachedRainfall(): number[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const latRaw = params.get('lat');
    const lonRaw = params.get('lon');
    const lat = latRaw === null || latRaw === '' ? NaN : Number(latRaw);
    const lon = lonRaw === null || lonRaw === '' ? NaN : Number(lonRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    // Key + version must match app/design/page.tsx's readCachedLocationData.
    const raw = localStorage.getItem(`imbewu_loc_v4_${lat.toFixed(5)}_${lon.toFixed(5)}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocationData;
    const monthly = parsed?.rainfall?.monthly;
    return Array.isArray(monthly) && monthly.length === 12 ? monthly : null;
  } catch {
    return null;
  }
}

export interface TankCalculatorProps {
  /** Optional override — 12 monthly rainfall totals (mm, Jan..Dec). When absent, self-resolves from cache. */
  monthlyRainfallMm?: number[];
  /** Saved farmer-entered demand. Undefined deliberately renders blank; no household default is invented. */
  dailyUseL?: number;
  onDailyUseLChange?: (dailyUseL: number | undefined) => void;
}

export default function TankCalculator({
  monthlyRainfallMm,
  dailyUseL,
  onDailyUseLChange,
}: TankCalculatorProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(true);
  const [roofArea, setRoofArea] = useState(DEFAULT_ROOF_M2);
  const [dailyUse, setDailyUse] = useState(dailyUseL ?? 0);

  // Prefer the prop; otherwise pull the site's cached rainfall on mount (client-only).
  const [cachedRain, setCachedRain] = useState<number[] | null>(null);
  useEffect(() => {
    if (!monthlyRainfallMm) setCachedRain(resolveCachedRainfall());
  }, [monthlyRainfallMm]);
  useEffect(() => {
    setDailyUse(dailyUseL ?? 0);
  }, [dailyUseL]);

  const rainfall = monthlyRainfallMm ?? cachedRain;
  const hasRain = Array.isArray(rainfall) && rainfall.length === 12;

  const result = useMemo(
    () => (hasRain ? computeTankSizing({ monthlyRainfallMm: rainfall!, roofAreaM2: roofArea, dailyUseL: dailyUse }) : null),
    [hasRain, rainfall, roofArea, dailyUse],
  );

  const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: 'rgba(11,18,11,0.7)', display: 'block', marginBottom: 3 };
  const inputStyle: React.CSSProperties = {
    width: '100%', minHeight: 40, padding: '8px 10px', borderRadius: 9,
    border: '1.5px solid rgba(11,18,11,0.18)', background: PAPER, color: DARK, fontSize: 14, fontWeight: 700,
  };

  return (
    <div style={{ padding: '2px 8px 4px' }}>
      <div style={{ borderRadius: 12, border: `1.5px solid ${BLUE}`, background: PAPER, overflow: 'hidden' }}>
        {/* Header toggle */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 7, minHeight: 40,
            padding: '7px 10px', border: 'none', background: 'rgba(62,143,191,0.10)', color: DARK, cursor: 'pointer', textAlign: 'left',
          }}
        >
          <Droplets size={15} color={BLUE} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, fontWeight: 800, flex: 1 }}>{t('designTankTitle')}</span>
          {open ? <ChevronUp size={16} color={BLUE} /> : <ChevronDown size={16} color={BLUE} />}
        </button>

        {open && (
          <div style={{ padding: '8px 10px 10px' }}>
            {!hasRain ? (
              <div style={{ fontSize: 12, lineHeight: 1.45, color: 'rgba(11,18,11,0.7)' }}>
                {t('designTankNeedRain')}
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8 }}>
                  <label style={{ flex: 1 }}>
                    <span style={labelStyle}>{t('designTankRoofArea')}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={Number.isFinite(roofArea) ? roofArea : ''}
                      onChange={(e) => setRoofArea(Math.max(0, Number(e.target.value)))}
                      style={inputStyle}
                    />
                  </label>
                  <label style={{ flex: 1 }}>
                    <span style={labelStyle}>{t('designTankDailyUse')}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={Number.isFinite(dailyUse) && dailyUse > 0 ? dailyUse : ''}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        const next = Number.isFinite(value) && value > 0 ? value : 0;
                        setDailyUse(next);
                        onDailyUseLChange?.(next > 0 ? next : undefined);
                      }}
                      style={inputStyle}
                    />
                  </label>
                </div>

                {result?.ok ? (
                  <div
                    style={{
                      marginTop: 9, padding: '9px 10px', borderRadius: 9,
                      background: 'rgba(62,143,191,0.08)', border: '1px solid rgba(62,143,191,0.25)',
                    }}
                  >
                    <div style={{ fontSize: 12.5, lineHeight: 1.5, color: DARK }}>{result.summary}</div>
                    {!result.waterNegative && result.dryMonths > 0 && (
                      <div
                        style={{
                          marginTop: 7, display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '4px 9px', borderRadius: 8, background: GREEN, color: PAPER, fontSize: 12, fontWeight: 800,
                        }}
                      >
                        <Droplets size={12} /> {result.jojoSuggestion}
                      </div>
                    )}
                    <div style={{ marginTop: 6, fontSize: 10.5, color: 'rgba(11,18,11,0.5)', lineHeight: 1.4 }}>
                      {t('designTankMethod')}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 9, fontSize: 12, color: OCHRE, fontWeight: 700 }}>
                    {t('designTankEnterValues')}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

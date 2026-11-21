'use client';

// Design Studio — WATER step. A dead-simple rain-tank sizing card: type your roof area and daily
// use, and it reads the site's real 30-year rainfall normals to tell you how much the roof banks
// in the wet season and how much JoJo storage carries you through the dry months. Live, no submit.
//
// Rainfall source: it prefers a `monthlyRainfallMm` prop when a caller has LocationData in scope,
// and otherwise self-resolves from the SAME localStorage cache the /design page fills
// (imbewu_loc_v7_{lat}_{lon}, keyed off the ?lat/?lon URL params) — so the card works standalone
// without threading a prop through the page. If nothing is cached, it degrades honestly.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Droplets } from 'lucide-react';
import type { LocationData } from '@/lib/types';
import { computeTankSizing, type TankSizingResult } from '@/lib/tank-sizing';
import { numberLabel } from '@/lib/format-figures';
import { sampleWorkspaceText } from '@/lib/sample-tour-localization';
import { prefersReducedMotion } from '@/lib/use-in-view-once';
import styles from './TankCalculator.module.css';
import { translate, useLanguage } from '@/lib/i18n';

type TankChromeKey =
  | 'designTankTitle'
  | 'designTankNeedRain'
  | 'designTankRoofArea'
  | 'designTankDailyUse'
  | 'designTankEnterValues'
  | 'designTankZuluDraftNotice';

function TankChromeText({ name, sourceBlock = false }: { name: TankChromeKey; sourceBlock?: boolean }) {
  const { t, lang } = useLanguage();
  if (lang !== 'zu') return t(name);

  return (
    <>
      <span lang="zu">{t(name)}</span>
      <span
        lang="en"
        style={{
          display: sourceBlock ? 'block' : 'inline',
          marginTop: sourceBlock ? 2 : 0,
          fontSize: 10.5,
          fontWeight: 400,
          lineHeight: 1.25,
          color: '#5C5040',
        }}
      >
        {!sourceBlock && ' · '}
        English source: {translate('en', name)}
      </span>
    </>
  );
}

// Studio palette (kept in sync with StepGuide.tsx) + the water-layer accent.
const PAPER = '#FFFEFA';
const DARK = '#20190F';
const GREEN = '#1F4D2B';
const OCHRE = '#C07A1E';
// Ochre is a FILL — as text on paper it measures 2.54:1. #7A4408 is the dim variant for text
// (CLAUDE.md); keep OCHRE itself for fills and borders. A literal, not var(--gold-dim): this card
// paints the fixed PAPER constant in every theme, and dark mode's --gold-dim (#B49040) is ~2.6:1 on it.
const GOLD_DIM = '#7A4408';
const BLUE = '#3E8FBF'; // STEP_ACCENT.water
const RED = '#B83A18'; // the same shortfall red as the app's --orange token

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
    const raw = localStorage.getItem(`imbewu_loc_v7_${lat.toFixed(5)}_${lon.toFixed(5)}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocationData;
    const monthly = parsed?.rainfall?.monthly;
    return Array.isArray(monthly) && monthly.length === 12 ? monthly : null;
  } catch {
    return null;
  }
}

// ── Figures ────────────────────────────────────────────────────────────────────────────────────
// Numbers tick from the old value to the new exact one, and the dry-months tile pulses once, but
// only after the farmer has stopped typing for a moment so a half-typed roof area does not thrash
// the screen. First render, reduced motion, and a roof that cannot meet the demand all show the
// real values at once with no motion.
const TICK_DEBOUNCE_MS = 250;
const TICK_MS = 450;

function useTickedFigures(result: TankSizingResult) {
  const target = { harvest: result.annualHarvestL, use: result.annualUseL, store: result.recommendedStorageL, dry: result.dryMonths };
  const [shown, setShown] = useState(target);
  const [pulse, setPulse] = useState(0);
  const shownRef = useRef(target);
  const lastDry = useRef(result.dryMonths);
  const key = `${target.harvest}|${target.use}|${target.store}|${target.dry}|${result.waterNegative}`;

  useEffect(() => {
    const t = { harvest: result.annualHarvestL, use: result.annualUseL, store: result.recommendedStorageL, dry: result.dryMonths };
    const from = shownRef.current;
    const set = (v: typeof t) => { shownRef.current = v; setShown(v); };
    const settle = () => {
      set(t);
      if (t.dry !== lastDry.current && t.dry > 0 && !result.waterNegative) setPulse((n) => n + 1);
      lastDry.current = t.dry;
    };
    if (from.harvest === t.harvest && from.use === t.use && from.store === t.store && from.dry === t.dry) {
      lastDry.current = t.dry;
      return;
    }
    if (result.waterNegative || prefersReducedMotion()) { set(t); lastDry.current = t.dry; return; }
    let raf = 0;
    const timer = window.setTimeout(() => {
      const start = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / TICK_MS);
        if (p >= 1) { settle(); return; }
        const e = 1 - Math.pow(1 - p, 3);
        set({
          harvest: Math.round(from.harvest + (t.harvest - from.harvest) * e),
          use: Math.round(from.use + (t.use - from.use) * e),
          store: Math.round(from.store + (t.store - from.store) * e),
          dry: Math.round(from.dry + (t.dry - from.dry) * e),
        });
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, TICK_DEBOUNCE_MS);
    return () => { window.clearTimeout(timer); cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { shown, pulse };
}

function TankFigures({ result }: { result: TankSizingResult }) {
  const { lang } = useLanguage();
  const text = (en: string, zu: string) => sampleWorkspaceText(lang, en, zu);
  const { shown, pulse } = useTickedFigures(result);
  const litres = (n: number) => `${numberLabel(n)} ℓ`;
  const gapL = Math.max(0, result.annualUseL - result.annualHarvestL);
  const caughtShare = result.annualUseL > 0 ? Math.min(100, (result.annualHarvestL / result.annualUseL) * 100) : 0;

  const tile = (label: string, value: string, extra?: { className?: string; key?: string | number; color?: string }) => (
    <div
      key={extra?.key}
      className={extra?.className}
      style={{ flex: '1 1 96px', minWidth: 0, padding: '6px 8px', borderRadius: 8, background: PAPER, border: '1px solid rgba(11,18,11,0.12)' }}
    >
      <div style={{ fontSize: 12, lineHeight: 1.3, color: 'rgba(11,18,11,0.7)' }}>{label}</div>
      <div style={{ marginTop: 2, fontSize: 15, fontWeight: 800, color: extra?.color ?? DARK, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );

  if (result.waterNegative) {
    return (
      <div style={{ marginTop: 8 }}>
        <div
          role="img"
          aria-label={text(
            `The roof catches ${litres(result.annualHarvestL)} a year against ${litres(result.annualUseL)} needed.`,
            `Uphahla luqoqa ${litres(result.annualHarvestL)} ngonyaka kuma-${litres(result.annualUseL)} adingekayo.`,
          )}
          style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', border: `1px solid ${RED}`, background: PAPER }}
        >
          <div style={{ width: `${caughtShare}%`, background: BLUE }} />
          <div style={{ flex: 1, background: `repeating-linear-gradient(-45deg, ${RED} 0 2px, ${PAPER} 2px 6px)` }} />
        </div>
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tile(text('Roof catches a year', 'Uphahla luqoqa ngonyaka'), litres(shown.harvest))}
          {tile(text('Household uses a year', 'Umndeni usebenzisa ngonyaka'), litres(shown.use))}
          {tile(text('Roof is short by', 'Uphahla lunciphile ngo'), litres(gapL), { color: RED })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {tile(text('Roof catches a year', 'Uphahla luqoqa ngonyaka'), litres(shown.harvest))}
      {tile(text('Household uses a year', 'Umndeni usebenzisa ngonyaka'), litres(shown.use))}
      {tile(text('Tank to store', 'Ithangi lokugcina'), litres(shown.store))}
      {result.dryMonths > 0 && tile(
        text('Dry months in a row', 'Izinyanga ezomile ngokulandelana'),
        numberLabel(shown.dry),
        { className: pulse > 0 ? styles.pulse : undefined, key: pulse, color: GOLD_DIM },
      )}
    </div>
  );
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
  const { t, lang } = useLanguage();
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
          <span style={{ fontSize: 12.5, fontWeight: 800, flex: 1 }}>
            <TankChromeText name="designTankTitle" />
          </span>
          {open ? <ChevronUp size={16} color={BLUE} /> : <ChevronDown size={16} color={BLUE} />}
        </button>

        {open && (
          <div style={{ padding: '8px 10px 10px' }}>
            {lang === 'zu' && (
              <div
                role="note"
                style={{ marginBottom: 8, padding: '6px 8px', borderRadius: 7, background: '#FFF5D6', border: '1px solid #E9CC76', fontSize: 10.5, lineHeight: 1.35, color: '#704B08' }}
              >
                <TankChromeText name="designTankZuluDraftNotice" sourceBlock />
              </div>
            )}
            {!hasRain ? (
              <div style={{ fontSize: 12, lineHeight: 1.45, color: 'rgba(11,18,11,0.7)' }}>
                <TankChromeText name="designTankNeedRain" sourceBlock />
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8 }}>
                  <label style={{ flex: 1 }}>
                    <span style={labelStyle}><TankChromeText name="designTankRoofArea" sourceBlock /></span>
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
                    <span style={labelStyle}><TankChromeText name="designTankDailyUse" sourceBlock /></span>
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
                    <TankFigures result={result} />
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
                  <div style={{ marginTop: 9, fontSize: 12, color: GOLD_DIM, fontWeight: 700 }}>
                    <TankChromeText name="designTankEnterValues" sourceBlock />
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

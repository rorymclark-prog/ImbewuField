'use client';

import type { LocationData, WaterData } from '@/lib/types';
import type { SiteSurvey } from '@/lib/site-survey';

interface Props {
  locationData: LocationData;
  waterData: WaterData | null;
  survey: SiteSurvey | null;
  siteAreaHa?: number;
}

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_FULL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function peopleFromAdults(adults: string | undefined): number {
  if (!adults) return 4;
  if (adults === '1') return 1;
  if (adults === '2-5') return 3;
  if (adults === '6-10') return 7;
  return 12;
}

export default function WaterBalance({ locationData, waterData, survey, siteAreaHa }: Props) {
  const { rainfall } = locationData;
  if (!rainfall?.monthly?.length) return null;

  // ── Demand estimates ───────────────────────────────────────────────────────
  const people = peopleFromAdults(survey?.adults);
  const dailyHouseKL = (people * 80) / 1000;        // 80 L/person/day
  const monthlyHouseKL = dailyHouseKL * 30;

  const hasVeg     = survey?.existingCrops?.includes('vegetables') ?? false;
  const hasFruit   = survey?.existingCrops?.includes('fruit-trees') ?? false;
  const area       = siteAreaHa ?? 0;
  const vegM2      = hasVeg   ? Math.min(area * 10000 * 0.15, 2000) : 0; // up to 15% of land, max 2000m²
  const fruitTrees = hasFruit ? Math.max(5, Math.round(area * 50))  : 0; // ~50 trees/ha
  const avgMonthlyRain = rainfall.annual / 12;

  // ── Catchment (roof harvest) ───────────────────────────────────────────────
  const roofM2 = (survey?.roofMainM2 ?? 0) + (survey?.roofSecondaryM2 ?? 0);
  const efficiency = survey?.hasGutters ? 0.80 : 0.60;

  // ── Per-month calculations ─────────────────────────────────────────────────
  const months = rainfall.monthly.map((mm, i) => {
    const isDry = mm < avgMonthlyRain * 0.7;

    // Catchment kL
    const catchment = roofM2 > 0 ? (roofM2 * mm * efficiency) / 1000 : (mm * 0.5) / 1000; // fallback: 0.5m² notional

    // Demand kL
    const irrigVeg   = hasVeg   ? (vegM2 * (isDry ? 4.5 : 1.5) * 30) / 1000 : 0;
    const irrigFruit = hasFruit ? (fruitTrees * (isDry ? 12 : 4) * 30) / 1000 : 0;
    const demand = monthlyHouseKL + irrigVeg + irrigFruit;

    return { month: i, mm, catchment, demand, irrigVeg, irrigFruit, isDry };
  });

  // ── Tank level simulation ──────────────────────────────────────────────────
  const capacity = waterData?.estVolumeKL ?? 0;
  const minSafe = Math.max(monthlyHouseKL * 2, capacity * 0.15); // 2 months household or 15% of capacity

  // Start tank at 50% of capacity (or half the annual harvest, whichever is less)
  let level = capacity > 0 ? capacity * 0.5 : 0;
  const tankLevels: number[] = [];
  months.forEach(({ catchment, demand }) => {
    level = Math.min(capacity, level + catchment - demand);
    level = Math.max(0, level);
    tankLevels.push(level);
  });

  // ── Chart geometry ─────────────────────────────────────────────────────────
  const W = 310;
  const H = 160;
  const PAD = { top: 12, right: 8, bottom: 24, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const barW = (chartW / 12) * 0.38;
  const gap  = chartW / 12;

  const maxVal = Math.max(
    ...months.map(m => Math.max(m.catchment, m.demand)),
    capacity > 0 ? capacity : 0,
    0.01,
  );

  const yScale = (v: number) => chartH - (v / maxVal) * chartH;
  const xBar   = (i: number) => PAD.left + i * gap + gap * 0.5 - barW;
  const xPoint = (i: number) => PAD.left + i * gap + gap * 0.5;

  const tankPath = tankLevels.map((v, i) =>
    `${i === 0 ? 'M' : 'L'} ${xPoint(i)} ${PAD.top + yScale(v)}`
  ).join(' ');

  const minSafeY = capacity > 0 ? PAD.top + yScale(minSafe) : null;

  // Y-axis tick labels
  const ticks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal].map(v => ({
    v, y: PAD.top + yScale(v),
    label: v < 1 ? `${(v * 1000).toFixed(0)}L` : `${v.toFixed(v < 10 ? 1 : 0)}kL`,
  }));

  const noStorage = capacity === 0;
  const noRoof    = roofM2 === 0;
  const noSurvey  = !survey;

  return (
    <div className="space-y-3">
      {/* Heading */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-wider" style={{ color: '#235E86' }}>Water balance</span>
        <span className="text-xs font-mono" style={{ color: '#8C7A62' }}>estimates</span>
      </div>

      {/* Main chart */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#F4EFE4', border: '1px solid #E2D8C4' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
          {/* Grid lines */}
          {ticks.map(({ y }, i) => (
            <line key={i} x1={PAD.left} x2={W - PAD.right} y1={PAD.top + yScale(ticks[i].v)} y2={PAD.top + yScale(ticks[i].v)}
              stroke="rgba(140,122,98,0.18)" strokeWidth="0.8" strokeDasharray={i === 0 ? '' : '3,3'} />
          ))}

          {/* Demand bars (behind) */}
          {months.map(({ demand }, i) => {
            const h = (demand / maxVal) * chartH;
            return (
              <rect key={i} x={xBar(i) + barW + 1} y={PAD.top + chartH - h} width={barW} height={h}
                fill={demand > (months[i].catchment + (capacity > 0 ? capacity : 0)) ? 'rgba(192,90,30,0.45)' : 'rgba(192,122,30,0.35)'}
                rx="1.5" />
            );
          })}

          {/* Catchment bars */}
          {months.map(({ catchment }, i) => {
            const h = (catchment / maxVal) * chartH;
            return (
              <rect key={i} x={xBar(i)} y={PAD.top + chartH - h} width={barW} height={h}
                fill="rgba(35,94,134,0.55)" rx="1.5" />
            );
          })}

          {/* Capacity bar (right edge, faint) */}
          {capacity > 0 && (
            <line x1={W - PAD.right - 2} x2={W - PAD.right - 2}
              y1={PAD.top + yScale(capacity)} y2={PAD.top + chartH}
              stroke="rgba(31,77,43,0.3)" strokeWidth="4" />
          )}

          {/* Min safe level */}
          {minSafeY != null && (
            <line x1={PAD.left} x2={W - PAD.right} y1={minSafeY} y2={minSafeY}
              stroke="rgba(192,60,30,0.55)" strokeWidth="1.2" strokeDasharray="4,3" />
          )}

          {/* Tank level line */}
          {capacity > 0 && (
            <path d={tankPath} fill="none" stroke="#1F4D2B" strokeWidth="1.8" strokeLinejoin="round" />
          )}
          {/* Tank level dots */}
          {capacity > 0 && tankLevels.map((v, i) => (
            <circle key={i} cx={xPoint(i)} cy={PAD.top + yScale(v)} r="2"
              fill={v <= minSafe ? '#C03C1E' : '#1F4D2B'} />
          ))}

          {/* X axis labels */}
          {MONTHS.map((m, i) => (
            <text key={i} x={xPoint(i)} y={H - 6} textAnchor="middle" fontSize="8" fill="#8C7A62" fontFamily="monospace">{m}</text>
          ))}

          {/* Y axis labels */}
          {ticks.filter((_, i) => i % 2 === 0).map(({ v, y, label }) => (
            <text key={v} x={PAD.left - 3} y={y + 3} textAnchor="end" fontSize="7.5" fill="#8C7A62" fontFamily="monospace">{label}</text>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: 'rgba(35,94,134,0.55)' }} />
          <span className="text-xs font-mono" style={{ color: '#5C5040' }}>Roof catchment</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: 'rgba(192,122,30,0.45)' }} />
          <span className="text-xs font-mono" style={{ color: '#5C5040' }}>Total demand</span>
        </div>
        {capacity > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-0.5 flex-shrink-0" style={{ background: '#1F4D2B' }} />
            <span className="text-xs font-mono" style={{ color: '#5C5040' }}>Tank level</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="w-8 flex-shrink-0" style={{ borderTop: '1.5px dashed rgba(192,60,30,0.7)' }} />
          <span className="text-xs font-mono" style={{ color: '#5C5040' }}>Min safe level</span>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-2">
        <StatBox label="People estimated" value={String(people)} sub={`${(monthlyHouseKL * 1000).toFixed(0)} L/month household`} color="#235E86" />
        {capacity > 0
          ? <StatBox label="Storage capacity" value={`${capacity.toFixed(0)} kL`} sub={`Min safe: ${minSafe.toFixed(0)} kL`} color="#1F4D2B" />
          : <StatBox label="Storage" value="Not mapped" sub="Draw a water area to calculate" color="#8C7A62" />
        }
        {hasVeg && <StatBox label="Veg irrigation" value={`${(months.find(m => m.isDry)?.irrigVeg ?? 0).toFixed(1)} kL`} sub="per dry month (est.)" color="#C07A1E" />}
        {hasFruit && <StatBox label="Fruit trees" value={`${fruitTrees}`} sub={`${(months.find(m => m.isDry)?.irrigFruit ?? 0).toFixed(1)} kL/dry month`} color="#C07A1E" />}
      </div>

      {/* Guidance messages */}
      {noSurvey && (
        <p className="text-xs font-display p-3 rounded-xl" style={{ background: 'rgba(192,122,30,0.08)', color: '#5C5040', border: '1px solid rgba(192,122,30,0.2)' }}>
          Complete the site survey to see household water demand and irrigation needs.
        </p>
      )}
      {noRoof && survey && (
        <p className="text-xs font-display p-3 rounded-xl" style={{ background: 'rgba(35,94,134,0.06)', color: '#5C5040', border: '1px solid rgba(35,94,134,0.2)' }}>
          Add roof area in the site survey to calculate monthly catchment potential.
        </p>
      )}
      {noStorage && !noSurvey && (
        <p className="text-xs font-display p-3 rounded-xl" style={{ background: 'rgba(31,77,43,0.06)', color: '#5C5040', border: '1px solid rgba(31,77,43,0.15)' }}>
          Draw a water harvesting area on the map to model how much storage you can build.
        </p>
      )}

      {/* Dry season shortfall warning */}
      {capacity > 0 && tankLevels.some(v => v <= minSafe) && (
        <div className="p-3 rounded-xl" style={{ background: 'rgba(192,60,30,0.07)', border: '1px solid rgba(192,60,30,0.25)' }}>
          <p className="text-xs font-display font-semibold mb-1" style={{ color: '#C03C1E' }}>Possible dry-season shortfall</p>
          <p className="text-xs font-display" style={{ color: '#5C5040' }}>
            Tank level dips below the safe minimum in {MONTH_FULL[tankLevels.indexOf(Math.min(...tankLevels))]}.
            Options: increase storage, add a second tank, or reduce irrigation during {rainfall.drySeason}.
          </p>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
      <p className="text-xs font-mono" style={{ color: '#8C7A62', marginBottom: 2 }}>{label}</p>
      <p className="font-display font-semibold" style={{ fontSize: 16, color, lineHeight: 1.2 }}>{value}</p>
      <p className="text-xs font-mono mt-1" style={{ color: '#8C7A62', fontSize: 10 }}>{sub}</p>
    </div>
  );
}

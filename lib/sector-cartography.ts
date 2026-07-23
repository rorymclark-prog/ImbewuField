// Sector Analysis presentation tokens. This module deliberately contains no canvas or DOM code:
// it translates the factual sector model into a stable visual vocabulary for any renderer.

import type { Provenance } from '@/lib/regional-wind';
import type { SectorModel } from '@/lib/sector';

export type SectorVisualKind =
  | 'summer-sun'
  | 'winter-sun'
  | 'midday-sun'
  | 'summer-cooling-wind'
  | 'cold-front-wind'
  | 'berg-wind'
  | 'fire'
  | 'driveway'
  | 'water'
  | 'frost';

export type SectorLegendIcon = 'sun' | 'wind' | 'fire' | 'driveway' | 'water' | 'frost';
export type SectorLineStyle = 'solid' | 'dashed';

export interface SectorStrokeToken {
  color: string;
  labelColor: string;
  width: { minPx: number; frameRatio: number };
  dash: readonly [number, number] | readonly [];
  fillAlpha: number;
  lineStyle: SectorLineStyle;
}

/** The benchmark's visual register, kept separate from factual bearings and source data. */
export const SECTOR_STYLES: Readonly<Record<SectorVisualKind, SectorStrokeToken>> = {
  'summer-sun': { color: '#F7C97E', labelColor: '#F7C97E', width: { minPx: 3, frameRatio: 0.005 }, dash: [], fillAlpha: 0, lineStyle: 'solid' },
  'winter-sun': { color: '#F5DFA6', labelColor: '#F5DFA6', width: { minPx: 3, frameRatio: 0.005 }, dash: [], fillAlpha: 0, lineStyle: 'solid' },
  'midday-sun': { color: '#F7C97E', labelColor: '#F7C97E', width: { minPx: 3.5, frameRatio: 0.0045 }, dash: [], fillAlpha: 0, lineStyle: 'solid' },
  'summer-cooling-wind': { color: '#2FA6A0', labelColor: '#8FE0D8', width: { minPx: 10, frameRatio: 0.0075 }, dash: [12, 7], fillAlpha: 0.18, lineStyle: 'dashed' },
  'cold-front-wind': { color: '#3A6FC9', labelColor: '#9FB8EC', width: { minPx: 10, frameRatio: 0.0075 }, dash: [12, 7], fillAlpha: 0.18, lineStyle: 'dashed' },
  'berg-wind': { color: '#C97B25', labelColor: '#E0A45A', width: { minPx: 10, frameRatio: 0.0075 }, dash: [12, 7], fillAlpha: 0.18, lineStyle: 'dashed' },
  fire: { color: '#D64A2A', labelColor: '#F0A58C', width: { minPx: 2.5, frameRatio: 0.0043 }, dash: [9, 5], fillAlpha: 0.20, lineStyle: 'dashed' },
  driveway: { color: '#9AA3AC', labelColor: '#C7CDD3', width: { minPx: 2.5, frameRatio: 0.0043 }, dash: [], fillAlpha: 0, lineStyle: 'solid' },
  water: { color: '#3A8EC4', labelColor: '#8FD0F0', width: { minPx: 3, frameRatio: 0.004 }, dash: [8, 6], fillAlpha: 0, lineStyle: 'dashed' },
  frost: { color: '#9FD0E8', labelColor: '#CDE7FA', width: { minPx: 2.4, frameRatio: 0.0034 }, dash: [3, 4], fillAlpha: 0, lineStyle: 'dashed' },
};

export interface SectorPresentation {
  key: string;
  kind: SectorVisualKind;
  label: string;
  icon: SectorLegendIcon;
  style: SectorStrokeToken;
  priority: number;
  provenance: Provenance;
  bearings: readonly number[];
  halfWidthDeg?: number;
  sourceKey?: string;
}

const WIND_KIND: Record<string, SectorVisualKind> = {
  summer_cooling: 'summer-cooling-wind',
  cold_front: 'cold-front-wind',
  berg: 'berg-wind',
};

const WIND_PRIORITY: Record<string, number> = {
  summer_cooling: 30,
  cold_front: 31,
  berg: 32,
};

function entry(
  key: string,
  kind: SectorVisualKind,
  label: string,
  icon: SectorLegendIcon,
  priority: number,
  provenance: Provenance,
  bearings: readonly number[],
  halfWidthDeg?: number,
  sourceKey?: string,
): SectorPresentation {
  return { key, kind, label, icon, style: SECTOR_STYLES[kind], priority, provenance, bearings, halfWidthDeg, sourceKey };
}

/**
 * Builds benchmark-oriented presentation records without changing the sector model.
 * Missing model fields produce no record: absence is data, not a reason to guess.
 */
export function presentSectorCartography(model: SectorModel): SectorPresentation[] {
  const result: SectorPresentation[] = [];
  const addSun = (key: 'summer' | 'winter', kind: 'summer-sun' | 'winter-sun', priority: number) => {
    const path = model.solar[key];
    if (path.sunriseAzDeg == null || path.sunsetAzDeg == null || !path.riseLabel16 || !path.setLabel16) return;
    result.push(entry(
      `${key}-sun`, kind, `${key[0].toUpperCase()}${key.slice(1)} sun — ${path.riseLabel16} → ${path.noonSide} → ${path.setLabel16}`,
      'sun', priority, 'computed', [path.sunriseAzDeg, path.sunsetAzDeg], undefined,
    ));
  };
  addSun('summer', 'summer-sun', 10);
  addSun('winter', 'winter-sun', 11);

  const middayBearings = model.sun.middayFrom === 'mixed' ? [0, 180] : [model.sun.middayFrom === 'N' ? 0 : 180];
  result.push(entry('midday-sun', 'midday-sun', `Midday sun — ${model.sun.middayFrom}`, 'sun', 12, 'computed', middayBearings));

  for (const wind of model.namedWind) {
    const kind = WIND_KIND[wind.id];
    if (!kind) continue;
    result.push(entry(`wind:${wind.id}`, kind, `${wind.title} — ${wind.fromLabel}`, 'wind', WIND_PRIORITY[wind.id] ?? 30, wind.provenance, [wind.bearingDeg], wind.halfWidthDeg, wind.sourceKey));
  }
  if (model.fire) result.push(entry('fire', 'fire', `Fire approach — ${model.fire.fromLabel}`, 'fire', 40, model.fire.provenance, [model.fire.bearingDeg], model.fire.halfWidthDeg, model.fire.sourceKey));
  if (model.driveway) result.push(entry('driveway', 'driveway', `Driveway access, dust & noise — ${model.driveway.fromLabel}`, 'driveway', 50, model.driveway.provenance, [model.driveway.bearingDeg], model.driveway.halfWidthDeg));
  if (model.water) result.push(entry('water', 'water', `Terrace fall ~${model.water.slopePct.toFixed(0)}%${model.water.indicative ? ' (indicative)' : ''}`, 'water', 60, 'computed', [model.water.downhillBearingDeg]));
  if (model.frost) result.push(entry('frost', 'frost', 'Cold-air drainage (inferred)', 'frost', 70, 'computed', [model.frost.downhillBearingDeg]));
  return result;
}

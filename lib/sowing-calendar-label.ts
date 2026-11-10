// One authority for how a sowing calendar is NAMED to a grower.
//
// The planner's four columns are FROST regimes, not rain timing. They used to be
// printed as "Summer rainfall" / "All-year rainfall", so a hot Lowveld farm with
// summer rain read "All-year rainfall" -- the opposite of what is true -- and a
// Karoo fallback read as a rain pattern when it was a hard-frost calendar. Every
// screen, export and note goes through here so they cannot drift apart again
// (2026-11-10 accuracy audit, CP-073/CP-074/CP-078).

import type { RainPattern } from '@/lib/crop-catalog';
import type { RainSeason } from '@/lib/koppen-global';
import type { SiteClimate, CalendarBasis } from '@/lib/site-climate';

/** Short name of the sowing calendar (a frost regime, not rain timing). */
export const SOWING_CALENDAR_LABEL: Record<RainPattern, string> = {
  summer: 'Winter frost',
  'mild-frost': 'Light frost at most',
  'all-year': 'Hot area, no frost',
  winter: 'Winter rainfall',
};

export const RAIN_SEASON_LABEL: Record<RainSeason, string> = {
  summer: 'summer rain',
  winter: 'winter rain',
  'all-year': 'rain all year',
};

/**
 * "Hot area, no frost · summer rain". The winter-rainfall calendar already says its
 * rain; with no rain season known the calendar label stands alone.
 */
export function sowingCalendarLabel(pattern: RainPattern, rainSeason?: RainSeason | null): string {
  const base = SOWING_CALENDAR_LABEL[pattern];
  if (pattern === 'winter' || !rainSeason) return base;
  return `${base} · ${RAIN_SEASON_LABEL[rainSeason]}`;
}

const WARMTH_ORDER: RainPattern[] = ['summer', 'mild-frost', 'all-year'];

const deg = (n: number): string => `${Math.round(n)} °C`;

/** Plain sentences that tell the grower why this calendar and what to do if it looks wrong. */
export function sowingCalendarReasons(
  site: SiteClimate,
  chosen: { pattern: RainPattern; basis: CalendarBasis },
): string[] {
  const out: string[] = [];

  let climate = `Coldest month averages ${deg(site.coldestMonthC)} and hottest ${deg(site.hottestMonthC)} here.`;
  if (site.recordMinC !== null && site.recordMinC !== undefined) {
    climate += ` The lowest temperature on record for this area is ${deg(site.recordMinC)}.`;
  }
  climate += ' These are satellite-era climate records for the wider area, not a weather station on your land.';
  out.push(climate);

  const chosenLabel = SOWING_CALENDAR_LABEL[chosen.pattern];
  const siteLabel = SOWING_CALENDAR_LABEL[site.pattern];
  if (chosen.basis === 'grower-frost' && chosen.pattern !== site.pattern) {
    const warmer = WARMTH_ORDER.indexOf(chosen.pattern) > WARMTH_ORDER.indexOf(site.pattern);
    out.push(
      `Your site survey says you have ${warmer ? 'not ' : ''}seen frost here, so this plan uses the "${chosenLabel}" calendar. ` +
      `The climate records alone would give "${siteLabel}".`,
    );
  } else if (site.closeCall) {
    let line = `This site is close to the line for the "${SOWING_CALENDAR_LABEL[site.closeCall]}" calendar.`;
    if (site.warmerNeighbour) {
      line += ' If you have never seen frost on these beds, say so in the site survey and the plan will use the warmer calendar.';
    } else if (site.pattern === 'all-year') {
      line += ' If frost does reach these beds, say so in the site survey and the plan will use the light-frost calendar.';
    } else {
      line += ' Check sowing months against what grows well near you.';
    }
    out.push(line);
  }
  return out;
}

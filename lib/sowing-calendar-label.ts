// One authority for how a sowing calendar is NAMED to a grower.
//
// The planner's four columns are FROST regimes, not rain timing. They used to be
// printed as "Summer rainfall" / "All-year rainfall", so a hot Lowveld farm with
// summer rain read "All-year rainfall" -- the opposite of what is true -- and a
// Karoo fallback read as a rain pattern when it was a hard-frost calendar. Every
// screen, export and note goes through here so they cannot drift apart again
// (2026-11-10 accuracy audit, CP-073/CP-074/CP-078).

import type { RainPattern } from '@/lib/crop-catalog';
import { LATE_FROST_COLDEST_MONTH_C, type RainSeason } from '@/lib/koppen-global';
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

/**
 * The calendars a grower can pick from, in the order they are offered: coldest first,
 * the Cape's winter-rain calendar last. `where` names places a grower can recognise
 * their own area in; it is a reading aid, not a rule about who may choose what.
 */
export const SOWING_CALENDAR_OPTIONS: readonly { value: RainPattern; label: string; where: string }[] = [
  { value: 'summer', label: SOWING_CALENDAR_LABEL.summer, where: 'Highveld, Midlands, Karoo' },
  { value: 'mild-frost', label: SOWING_CALENDAR_LABEL['mild-frost'], where: 'warm areas and mild coasts' },
  { value: 'all-year', label: SOWING_CALENDAR_LABEL['all-year'], where: 'Lowveld, Limpopo valley, KZN coast' },
  { value: 'winter', label: SOWING_CALENDAR_LABEL.winter, where: 'Western Cape' },
];

/** "Hot area, no frost (Lowveld, Limpopo valley, KZN coast)" — one option's text. */
export function sowingCalendarOptionText(option: { label: string; where: string }): string {
  return `${option.label} (${option.where})`;
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
  if (chosen.basis === 'grower-choice') {
    // Their choice stands. The screen still says what the records give, and says so
    // plainly when the choice is warmer than a record that shows frost: the warmer
    // calendars sow tender crops earlier, and the grower's own frost months are then
    // the only thing holding those crops back.
    let line = chosen.pattern === site.pattern
      ? `You chose the "${chosenLabel}" calendar yourself. The climate records for this area give the same one.`
      : `You chose the "${chosenLabel}" calendar yourself. The climate records for this area would give "${siteLabel}".`;
    const warmerThanRecords = WARMTH_ORDER.includes(chosen.pattern) && WARMTH_ORDER.includes(site.pattern)
      && WARMTH_ORDER.indexOf(chosen.pattern) > WARMTH_ORDER.indexOf(site.pattern);
    if (warmerThanRecords && site.recordMinC !== null && site.recordMinC !== undefined && site.recordMinC <= 0) {
      line += ` Those records show frost here (lowest on record ${deg(site.recordMinC)}). This calendar sows tender crops earlier, so record the months you see frost in the site survey.`;
    }
    out.push(line);
  } else if (chosen.basis === 'grower-frost' && chosen.pattern !== site.pattern) {
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
  // The frost calendars wait for frost to pass by the end of August. Where winters are
  // this cold it often has not (lib/koppen-global.ts LATE_FROST_COLDEST_MONTH_C).
  if (site.coldestMonthC < LATE_FROST_COLDEST_MONTH_C
      && (chosen.pattern === 'summer' || chosen.pattern === 'winter' || chosen.basis === 'grower-choice')) {
    out.push('Frost often lasts into September where winters are this cold. Plant out tomatoes, peppers and other tender crops only after your own last frost, and record your frost months in the site survey.');
  }
  return out;
}

/**
 * The sowing calendar as the printed plan and the PDF state it.
 *
 * The screen says "chosen by you" when the grower picked the calendar. Paper printed
 * the same calendar under "This site (satellite climate records)" and said nothing
 * more, so a plan on a calendar the records do not give read as if the records gave
 * it (found on 10 November 2026 while checking every surface the choice reaches).
 * A printed plan is handed to mentors and funders; it must say whose call the
 * calendar was.
 */
export function printedSowingCalendarLine(
  calendarLabel: string,
  basis: CalendarBasis | 'reference',
  climateSource: 'site' | 'reference' | 'none',
): string {
  if (basis === 'grower-choice') return `${calendarLabel} (sowing calendar chosen by the grower)`;
  if (basis === 'sample-farm') return `${calendarLabel} (sowing calendar set for the sample farm)`;
  return climateSource === 'none' ? `Assuming ${calendarLabel.toLowerCase()}` : calendarLabel;
}

/**
 * What the sample farm's calendar box says in place of climate readings. The sample's
 * calendar is declared in its sample data (lib/demo-farm.ts DEMO_SOWING_CALENDAR), so
 * the screen must not dress it as satellite records, and must tell a visitor what
 * their own farm would get instead.
 */
export const SAMPLE_FARM_CALENDAR_REASON =
  'This calendar is set for the sample farm, so the tour looks the same for everyone. '
  + 'On your own farm the app reads the climate records for your site, and you can choose a calendar yourself.';

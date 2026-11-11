// "This farm's calendar" on the calendar page (CP-097).
//
// The calendar page never picks a sowing calendar for the visitor. When the selected
// saved site has a calendar the crop plan is already using (the grower's own choice, the
// sample farm's declared one, or the one its cached climate records and frost answer
// give), this offers it as one explicit option. A regional fallback is NOT offered as
// "this farm's calendar": with nothing known the answer is null.

import type { RainPattern } from '@/lib/crop-catalog';
import { sowingCalendarInUse, type SiteClimate } from '@/lib/site-climate';
import { SOWING_CALENDAR_LABEL } from '@/lib/sowing-calendar-label';

export interface FarmCalendarOffer {
  pattern: RainPattern;
  basis: 'grower-choice' | 'grower-frost' | 'site-climate' | 'sample-farm';
}

export function farmCalendarOffer(input: {
  chosen: RainPattern | null;
  sample: RainPattern | null;
  site: SiteClimate | null;
  observedFrost: 'yes' | 'no' | 'unknown' | undefined;
}): FarmCalendarOffer | null {
  if (!input.chosen && !input.sample && !input.site) return null;
  // `reference` cannot be reached while one of the three is present.
  const used = sowingCalendarInUse({ ...input, reference: 'summer' });
  if (used.basis === 'reference') return null;
  return { pattern: used.pattern, basis: used.basis };
}

const BASIS_NOTE: Record<FarmCalendarOffer['basis'], string> = {
  'grower-choice': 'chosen by you',
  'grower-frost': "from this site's climate records and your frost answer",
  'site-climate': "from this site's climate records",
  'sample-farm': 'set for the sample farm',
};

/**
 * The option's own text. Kept short: a phone shows about forty characters of a closed
 * select, and "This farm's crop plan: Hot area, no frost (from this site's climate
 * records)" was cut off after "(from" at 390 px. Whose call the calendar was goes in
 * the line under the select (farmCalendarOfferNote).
 */
export function farmCalendarOfferText(offer: FarmCalendarOffer): string {
  return `This farm's crop plan: ${SOWING_CALENDAR_LABEL[offer.pattern]}`;
}

/** The line under the select: which calendar the farm's plan uses, and on whose word. */
export function farmCalendarOfferNote(offer: FarmCalendarOffer): string {
  return `This farm's crop plan uses the "${SOWING_CALENDAR_LABEL[offer.pattern]}" calendar (${BASIS_NOTE[offer.basis]}).`;
}

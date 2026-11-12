// Frost the plan cannot see (finding CP-108).
//
// The planner holds a frost-tender crop in its bed through its whole picking window. On the
// planner's real bed months, tender crops stood in a frost month at 3 of 44 saved places
// (45 crop-and-place cases; docs/audits/2026-11-11/argon-claims-dispositions-claude.md).
// When the grower has recorded their frost months, the plan checks every month a crop holds
// ground against them, picking months included. When they have not, the plan has no frost
// date for the farm at all: monthly averages cannot give one and the app does not invent
// one. It must then say so wherever the plan is read, and say what the grower can do.
//
// These sentences state an uncertainty. They name no month, shorten no crop and change no
// kilogram figure.

/** On the plan page and in the printed guide, under the list of affected crops. */
export const FROST_UNCONFIRMED_TEXT =
  'Planned picking can extend into frost. Confirm your local frost months; tender crops may stop producing when frost arrives.';

/** What recording the months does. */
export const FROST_UNCONFIRMED_ACTION_TEXT =
  'This plan has no frost dates for your farm. Record the months you see frost in the site survey, and the plan will check these crops against them.';

/** On one row of the printed bed-by-bed table. Short: it shares the harvest cell. */
export const FROST_UNCONFIRMED_ROW_TEXT =
  'Frost-tender: picking may stop when frost arrives. Confirm your frost months.';

/**
 * On one row of the printed table when the grower HAS recorded frost months and the crop
 * still holds ground in one of them. `months` are short month names in calendar order.
 * The months are the grower's own; the plan supplies none.
 */
export function frostRecordedRowText(months: readonly string[]): string {
  return `Frost-tender: still in the ground in ${months.join(', ')}, when you recorded frost.`;
}

/**
 * What the grower has told the plan about frost, as the printed table needs it.
 *   not-recorded       no answer, or "yes" with no month ticked: the plan has no frost date
 *   no-frost-observed  the grower's own observation that they have not seen frost
 *   months             the months they ticked, with "now" so a crop already past them is not flagged
 * A sowing calendar's name ("Hot area, no frost", "Light frost at most") is never one of
 * these: it is a reading of gridded climate records, not an observation on the farm.
 */
export type PlanTableFrost =
  | { kind: 'not-recorded' }
  | { kind: 'no-frost-observed' }
  | { kind: 'months'; months: readonly number[]; nowMonth: number };

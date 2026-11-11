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

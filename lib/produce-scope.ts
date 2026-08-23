// Whether the orchard is counted with the vegetables.
//
// Rory: perennials "should be toggled on and off in various places".
//
// WHY THIS IS A SWITCH AND NOT A DEFAULT. A food forest and a vegetable garden are one farm and two
// businesses. Twenty kilograms of avocados off four trees and twenty kilograms of spinach off two
// beds are the same line on a bank statement and nothing alike as growing work — one is four years
// of waiting and an annual pick, the other is eight weeks and a bed you turn over five times. A
// farmer asking "how did the beds do this month" and a farmer asking "what did the farm take" are
// asking different questions, and one figure cannot answer both.
//
// WHAT THE SWITCH IS NOT ALLOWED TO DO. It never changes a stored record. Turning the orchard off
// hides it from a total; the harvest, the sale and the rands are all still there when it goes back
// on. This follows the design map's own rule for its layer eyes: "These are view controls, not plan
// data. They hide groups without moving or changing the farmer's saved geometry."
//
// THE ONE PLACE THAT IS A RULE, NOT A PREFERENCE. A per-square-metre figure — the Production score,
// and anything else dividing rands by bed area — must ALWAYS exclude perennials, whatever this is
// set to. The denominator is the area of the vegetable beds; an avocado's fruit does not come off a
// bed, so counting its rands there inflates the score without bound and the number stops meaning
// anything. That exclusion is stated on screen rather than done quietly.

import { activeAccountLocalStorageKey } from './account-local-storage';
import { isSampleMode } from './sample-mode';
import { PERENNIAL_PRODUCE } from './perennial-produce';
import { cropEntryOption } from './crop-entry';

/**
 * What a recorded produce name turns out to be.
 *
 * 'unknown' is a real answer and is not a failure: every logging form lets a farmer type a name of
 * their own, and the app has no basis for calling "Garden special" annual or perennial. What
 * matters is that it is never silently filed as one of them.
 */
export type ProduceKind = 'annual' | 'perennial' | 'unknown';

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase('en-ZA').replace(/\s+/g, ' ');
}

/**
 * Names to match a perennial by.
 *
 * Logs store a NAME, not a key (ProductionLog.crop and SalesLog.crop are both `string`), so
 * matching is by text. A plural is included because a farmer records "Avocados" and the catalogue
 * says "Avocado", and both plainly mean the same fruit.
 */
function pluralsOf(base: string): string[] {
  const forms = [`${base}s`];
  // berry -> berries, but not "grey" -> "greies".
  if (/[^aeiou]y$/.test(base)) forms.push(`${base.slice(0, -1)}ies`);
  // peach -> peaches, citrus -> citruses.
  if (/(ch|sh|s|x|z)$/.test(base)) forms.push(`${base}es`);
  // mango -> mangoes. Both spellings are current, so keep the -s form above too.
  if (base.endsWith('o')) forms.push(`${base}es`);
  return forms;
}

function perennialAliases(): Map<string, string> {
  const map = new Map<string, string>();
  // Two passes so a real catalogue name always beats a plural GENERATED from another name. One
  // fruit's plural colliding with another fruit's actual name would file every log of the second
  // under the first, and nothing on screen would show it happening.
  for (const produce of PERENNIAL_PRODUCE) map.set(normalise(produce.label), produce.key);
  for (const produce of PERENNIAL_PRODUCE) {
    for (const form of pluralsOf(normalise(produce.label))) {
      if (!map.has(form)) map.set(form, produce.key);
    }
  }
  return map;
}

const PERENNIAL_ALIASES = perennialAliases();

/** The perennial produce key a recorded name refers to, or null. */
export function perennialKeyForName(name: string): string | null {
  return PERENNIAL_ALIASES.get(normalise(name)) ?? null;
}

/**
 * Classify a recorded produce name.
 *
 * The annual catalogue is asked FIRST and wins any tie. It is the schedulable one — a name that
 * resolves to a plannable crop must keep resolving to it, or a harvest would fall out of the plan
 * comparison because a perennial happened to share its name.
 */
export function produceKindOf(name: string): ProduceKind {
  if (!name || !name.trim()) return 'unknown';
  if (cropEntryOption(name)) return 'annual';
  return perennialKeyForName(name) ? 'perennial' : 'unknown';
}

/**
 * Should a row be counted, given the switch?
 *
 * Note what this deliberately is NOT: a three-way "annuals / perennials / everything" filter. The
 * app cannot tell what a farmer's own typed name is, so a view claiming to show "vegetables only"
 * would quietly drop their custom entries and misreport the total. Excluding what is KNOWN to be
 * orchard produce is a claim the data supports; claiming the remainder is all vegetables is not.
 */
export function countsWithScope(name: string, includePerennials: boolean): boolean {
  return includePerennials || produceKindOf(name) !== 'perennial';
}

const INCLUDE_PERENNIALS_KEY = 'imbewu_finance_include_perennials_v1';

/**
 * Default ON.
 *
 * Money the farmer took is money the farmer took, and a total that silently omitted the orchard
 * would be wrong in the more damaging direction — a farmer would only find out by adding it up by
 * hand. Off is the deliberate act, and the screen says so while it is off.
 */
export const DEFAULT_INCLUDE_PERENNIALS = true;

let sandboxIncludePerennials = DEFAULT_INCLUDE_PERENNIALS;

export function loadIncludePerennials(): boolean {
  if (isSampleMode()) return sandboxIncludePerennials;
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_INCLUDE_PERENNIALS;
  try {
    const raw = window.localStorage.getItem(activeAccountLocalStorageKey(INCLUDE_PERENNIALS_KEY));
    // Absent means never chosen, which is the default — not "off".
    return raw === null ? DEFAULT_INCLUDE_PERENNIALS : raw === '1';
  } catch {
    return DEFAULT_INCLUDE_PERENNIALS;
  }
}

export function saveIncludePerennials(include: boolean): void {
  if (isSampleMode()) { sandboxIncludePerennials = include; return; }
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      activeAccountLocalStorageKey(INCLUDE_PERENNIALS_KEY),
      include ? '1' : '0',
    );
  } catch {
    // Quota exceeded or storage unavailable — fail silently, same as saveCropPlan.
  }
}

/** Test seam: the sample-mode sandbox is module state, reset by a full page load. */
export function resetSampleProduceScope(): void {
  sandboxIncludePerennials = DEFAULT_INCLUDE_PERENNIALS;
}

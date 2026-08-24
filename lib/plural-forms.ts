/**
 * plural-forms.ts — the one place that knows a farmer might type the plural.
 *
 * WHY IT IS ITS OWN FILE. Free-text crop fields mean "Avocado" and "Avocados" are the same tree,
 * and both catalogues have to agree about that or the app splits one crop into two rows (see
 * lib/crop-identity.ts for what that costs). The orchard catalogue already generated plural forms;
 * the annual catalogue did not, so its EXACT tier answered "no" to "Cabbages" and the name only
 * ever got caught by the substring fallback below it — a tier the code itself calls a guess, and
 * one that returns null the moment a name is ambiguous. A rule that must hold in two catalogues
 * lives in neither of them.
 *
 * Deliberately a leaf: no imports, so both catalogues can use it without a cycle.
 *
 * English-only and deliberately crude — it is used to WIDEN an exact-match index, never to
 * rewrite what a farmer wrote. Callers must add these forms only where they do not already
 * have a real catalogue name, so a generated plural can never outrank a crop's own name.
 */
export function pluralFormsOf(base: string): string[] {
  const forms = [`${base}s`];
  // berry -> berries, but not "grey" -> "greies".
  if (/[^aeiou]y$/.test(base)) forms.push(`${base.slice(0, -1)}ies`);
  // peach -> peaches, citrus -> citruses.
  if (/(ch|sh|s|x|z)$/.test(base)) forms.push(`${base}es`);
  // mango -> mangoes. Both spellings are current, so keep the -s form above too.
  if (base.endsWith('o')) forms.push(`${base}es`);
  return forms;
}

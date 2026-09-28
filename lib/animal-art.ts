/**
 * Optional artwork per animal enterprise, keyed by enterpriseId (lib/animal-enterprises-data.ts).
 * A sibling lookup like lib/crop-art.ts: the dossier pipeline regenerates the enterprise table, so
 * the picture lives here, not in it.
 *
 * An enterprise with no entry keeps its Lucide product icon, so an empty map changes nothing a
 * farmer sees. Codex adds an entry in the same commit as its PNG; docs/ANIMAL-TREE-ART-BRIEF.md has
 * the list, the rules and the self-check. tests/animal-enterprises.test.ts keeps keys, files and
 * the 256×256 transparent-corner format in agreement.
 */
export const ANIMAL_ART_ROOT = '/animal-art';

export const ANIMAL_ART: Readonly<Record<string, string>> = {};

export function animalArtUrl(enterpriseId: string): string | null {
  return ANIMAL_ART[enterpriseId] ?? null;
}

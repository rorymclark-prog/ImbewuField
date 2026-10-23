// Retired catalogue ids and the entry that replaced them.
//
// A placed plant is saved as `speciesId` on the design (lib/design-canvas.ts), so an id that
// leaves SPECIES keeps living in farmers' saved maps. Deleting a duplicate without this table
// would leave those trees pointing at nothing: no harvest months, no produce link, no name.
//
// Only add a row when two entries turn out to be ONE plant — a botanical rename, not a lookalike.
// tests/species-aliases.test.ts keeps a retired id out of SPECIES and every target inside it.

export const SPECIES_ID_ALIASES: Readonly<Record<string, string>> = {
  // SANBI renamed Dovyalis caffra to D. afra (Madrid Code Art. 61.6). The catalogue had grown
  // one entry under each name — the same Kei apple twice, with different biomes and uses.
  'dovyalis-caffra': 'dovyalis-afra',
};

/** The live catalogue id for a saved one; ids that were never retired pass through. */
export function canonicalSpeciesId(id: string): string {
  return SPECIES_ID_ALIASES[id] ?? id;
}

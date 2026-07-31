// THE PLANT PALETTE — what a farmer can actually choose to plant, and what the app knows about it.
//
// Rory: "we need to audit actually whats the best way to insert different species… choose according
// to environment and rate according to usefulness… so if i click on nama karoo it's a different
// palette to kzn coast — of course there's gonna be overlap, some trees like citrus have a broad
// reach and you must get this right too… and again we don't need every species that's too
// exhaustive."
//
// FIVE THINGS THIS FILE EXISTS TO GET RIGHT.
//
// 1. CURATED, NOT EXHAUSTIVE. Every entry has to earn its place through a permaculture FUNCTION —
//    food, nitrogen, pollinators, habitat, shade, fodder, mulch, a living fence, holding a bank
//    together. A complete flora would be worse than useless to someone deciding what to plant on
//    Saturday: the value is in the choosing, and the choosing is what a designer is paid for.
//
// 2. RANKED, so a farmer who does not know the plants can take the top of a list and be right, and
//    a designer who does can read past it. `rank` is within a section and within a biome — the best
//    shade tree for the Highveld is not the best shade tree for the KZN coast.
//
// 3. LAYERED. A palette that is all trees is not a permaculture palette. `stratum` spans canopy
//    down to groundcover, and the picker shows every layer, because the thing beginners under-plant
//    is always the bottom two.
//
// 4. CLIMATE-FILTERED, WITH HONEST OVERLAP. Suitability is not a per-biome list of names — that
//    would make citrus a Highveld plant or not, when the truth is that it depends on frost. A
//    species declares the climate it survives; the biome declares the climate it has; the overlap
//    is computed. That way a species with broad reach appears everywhere it genuinely works,
//    without being copied into nine lists that then drift apart.
//
// 5. LEGALLY HONEST. Which species may be propagated in South Africa is regulated (NEM:BA Alien and
//    Invasive Species lists). `nemba` is a required field, not an optional note: a Category 1a or
//    1b species must never reach the picker, and a Category 2 or 3 species that is genuinely
//    standard practice must carry its category to the screen so nobody plants it unknowingly.
//    `source` is required for the same reason — an unsourced size or suitability claim is a guess
//    wearing the same typeface as a fact.
//
// Pure data + pure predicates. No React, no Firestore, no drawing: the suitability rules are the
// part most likely to be wrong and the part cheapest to test, so they live where a test can reach
// them without a browser.

/** What a plant is FOR. A species with no use here does not belong in the palette. */
export const SPECIES_USES = [
  'food',
  'nitrogen fixer',
  'pollinator',
  'habitat',
  'shade',
  'windbreak',
  'fodder',
  'mulch',
  'living fence',
  'erosion control',
  'medicinal',
  'timber',
  'groundcover',
] as const;
export type SpeciesUse = (typeof SPECIES_USES)[number];

/** Vertical layer. Ordered tallest-first — the picker reads this order straight off. */
export const SPECIES_STRATA = ['canopy', 'sub-canopy', 'shrub', 'herb', 'groundcover', 'climber'] as const;
export type SpeciesStratum = (typeof SPECIES_STRATA)[number];

/**
 * The shape of the crown, seen from above and from the side.
 *
 * This exists because of a real defect: the indigenous shade tree was drawn with a conifer glyph
 * and had no crown description in the render prompt, so it came back as something like a pine —
 * which in South Africa reads as the invasive plantation tree these plans usually exist to
 * replace. Crown form is DATA now rather than a per-species sentence buried in a prompt, so the
 * canvas, the plan sheets and the AI polish can all be driven from one field and cannot disagree.
 */
export const CROWN_FORMS = [
  'flat-crowned',
  'rounded',
  'spreading',
  'upright',
  'weeping',
  'feathery',
  'palm',
  'multi-stem',
  'columnar',
  'sprawling',
  'tufted',
  'mat',
] as const;
export type CrownForm = (typeof CROWN_FORMS)[number];

/** Sections in the picker. Order is the order they are shown. */
export const SPECIES_SECTIONS = [
  'Indigenous fruit',
  'Exotic fruit & nuts',
  'Large trees',
  'Medium trees',
  'Small trees & large shrubs',
  'Shrubs',
  'Groundcovers & herbaceous',
  'Climbers',
] as const;
export type SpeciesSection = (typeof SPECIES_SECTIONS)[number];

export type WaterNeed = 'low' | 'moderate' | 'high';
/** How much frost it takes without dying back. 'none' = a single frost kills it. */
export type FrostTolerance = 'none' | 'light' | 'moderate' | 'hardy';

/**
 * NEM:BA Alien and Invasive Species category.
 *
 * '1a' and '1b' must be REMOVED from the land, not planted — they may never appear in the picker;
 * the guard test enforces that rather than trusting reviewers to notice. '2' needs a permit, '3'
 * may stay where it is but not be planted anew. 'none' means indigenous or an unlisted exotic.
 */
export type NembaCategory = 'none' | '1a' | '1b' | '2' | '3';

export interface Species {
  /** Stable id — never reuse one for a different plant; saved designs point at it. */
  id: string;
  commonName: string;
  /** Currently accepted botanical name. The one field a nursery or an agronomist can check. */
  botanicalName: string;
  indigenous: boolean;
  section: SpeciesSection;
  stratum: SpeciesStratum;
  uses: SpeciesUse[];
  /** What to allow for ON A PLAN at maturity in cultivation — not the record wild specimen. */
  matureHeightM: number;
  matureWidthM: number;
  crownForm: CrownForm;
  waterNeed: WaterNeed;
  frostTolerance: FrostTolerance;
  /** Biomes where this is worth planting, ranked. Empty = suits none (should not ship). */
  biomes: SpeciesBiomeFit[];
  /** One sentence: why a designer picks this, here. Shown in the picker. */
  why: string;
  /** Where the size and suitability came from. Required — see the file header. */
  source: string;
  nemba: NembaCategory;
  /** False until an agronomist has signed this entry off. The picker says so on screen. */
  reviewed: boolean;
}

export interface SpeciesBiomeFit {
  /** A key of BIOMES in lib/biome.ts. */
  biome: string;
  /** 1 = the best choice in its section for that biome. */
  rank: number;
}

/** Nothing regulated as 1a/1b may ever be offered. Belt and braces beside the guard test. */
export function isPlantable(s: Species): boolean {
  return s.nemba !== '1a' && s.nemba !== '1b';
}

/** Rank within a biome, or null when the species is not offered there. */
export function rankIn(s: Species, biome: string): number | null {
  const fit = s.biomes.find((b) => b.biome === biome);
  return fit ? fit.rank : null;
}

/**
 * The palette for one biome: only plantable species that name this biome, best first.
 *
 * Ties break on common name so the list is stable between renders and between builds — a picker
 * whose rows reshuffle is a picker a farmer stops trusting.
 */
export function paletteFor(all: Species[], biome: string): Species[] {
  return all
    .filter((s) => isPlantable(s) && rankIn(s, biome) !== null)
    .sort((a, b) => {
      const d = (rankIn(a, biome) ?? 0) - (rankIn(b, biome) ?? 0);
      return d !== 0 ? d : a.commonName.localeCompare(b.commonName);
    });
}

/**
 * The palette grouped into the picker's sections, in section order, empty sections dropped.
 *
 * A section with nothing in it is not padded and not shown: some biomes genuinely have no
 * indigenous fruit worth planting, and inventing an entry to fill the row would be the one failure
 * mode this whole file is built to avoid.
 */
export function sectionedPaletteFor(all: Species[], biome: string): Array<{ section: SpeciesSection; species: Species[] }> {
  const ranked = paletteFor(all, biome);
  return SPECIES_SECTIONS
    .map((section) => ({ section, species: ranked.filter((s) => s.section === section) }))
    .filter((g) => g.species.length > 0);
}

/**
 * WHEN WE DO NOT KNOW WHERE THE FARM IS.
 *
 * A site outside South Africa, or one whose biome could not be classified, must not get an empty
 * picker — that reads as a broken feature, and the farmer still has a garden to plan. It gets the
 * species that succeed most widely, on the honest grounds that breadth is the best available proxy
 * for "probably fine here". Callers should say on screen that the list is not localised.
 */
export function broadReachPalette(all: Species[], minBiomes = 4): Species[] {
  return all
    .filter((s) => isPlantable(s) && s.biomes.length >= minBiomes)
    .sort((a, b) => b.biomes.length - a.biomes.length || a.commonName.localeCompare(b.commonName));
}

/** Filter by what the farmer is trying to achieve — the picker's use chips. */
export function withUse(list: Species[], use: SpeciesUse): Species[] {
  return list.filter((s) => s.uses.includes(use));
}

/**
 * Structural problems that must never ship. Returns one message per problem, empty when clean.
 *
 * This is the shape the guard test asserts on. It lives here rather than in the test so that a
 * future import script — the likely route for the rest of the list — can run the same check before
 * it writes anything.
 */
export function validateSpecies(all: Species[]): string[] {
  const problems: string[] = [];
  const seenIds = new Set<string>();
  const seenBotanical = new Map<string, string>();
  for (const s of all) {
    if (seenIds.has(s.id)) problems.push(`duplicate id: ${s.id}`);
    seenIds.add(s.id);
    const prior = seenBotanical.get(s.botanicalName.toLowerCase());
    if (prior && prior !== s.id) problems.push(`${s.botanicalName} appears twice (${prior}, ${s.id})`);
    seenBotanical.set(s.botanicalName.toLowerCase(), s.id);

    if (!isPlantable(s)) problems.push(`${s.commonName} is NEMBA ${s.nemba} and must not be offered`);
    if (s.uses.length === 0) problems.push(`${s.commonName} has no use — a palette entry must earn its place`);
    if (s.biomes.length === 0) problems.push(`${s.commonName} suits no biome`);
    if (!s.source.trim()) problems.push(`${s.commonName} has no source`);
    if (!(s.matureHeightM > 0) || !(s.matureWidthM > 0)) problems.push(`${s.commonName} has no mature size`);
    // A canopy tree 1m tall, or a groundcover 12m wide, is a data-entry slip that would silently
    // draw the wrong thing on a plan and mis-price the bill of quantities.
    if (s.stratum === 'canopy' && s.matureHeightM < 5) problems.push(`${s.commonName} is canopy but only ${s.matureHeightM}m tall`);
    if (s.stratum === 'groundcover' && s.matureHeightM > 1) problems.push(`${s.commonName} is groundcover but ${s.matureHeightM}m tall`);

    const ranks = new Map<string, number>();
    for (const fit of s.biomes) {
      if (ranks.has(fit.biome)) problems.push(`${s.commonName} lists ${fit.biome} twice`);
      ranks.set(fit.biome, fit.rank);
      if (!(fit.rank >= 1)) problems.push(`${s.commonName} has rank ${fit.rank} in ${fit.biome}`);
    }
  }
  return problems;
}

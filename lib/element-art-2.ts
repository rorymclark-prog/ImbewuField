/**
 * Art for the second sweep of catalogs that still show a raw emoji instead of real artwork:
 * CATEGORY_META, GROUND_FEATURES, ELEMENT_META (lib/site-elements.ts), WATER_POINT_CATEGORIES
 * (lib/water-points.ts), JOURNAL_CATEGORIES (lib/field-journal.ts) and the weather glyphs
 * (lib/weather.ts). See docs/ELEMENT-ART-BRIEF-2.md for the generation brief, the self-check
 * script, and the dedup reasoning behind which rows got new art vs. reused an existing file.
 *
 * Deliberately a SIBLING lookup, same pattern as lib/crop-art.ts/getCropArt() — none of the five
 * catalog .ts files are touched here, so this can't collide with in-flight work on any of them.
 *
 * NOT `getElementArt` — that name is already taken by lib/design-studio-shell-icons.ts's
 * unrelated `getElementArt(def: DesignElementDef): ElementArt` (a different signature, for the
 * unlinked Design Studio Shell v2). Reusing the name would collide or get silently shadowed
 * depending on import order.
 *
 * Falls back to each catalog's existing emoji `icon` wherever a key has no entry here, so wiring
 * this lookup in cannot change what anyone sees until a consuming component is actually updated
 * to read it. Two of the six catalogs it covers (GROUND_FEATURES, WATER_POINT_CATEGORIES) don't
 * render their `icon` field anywhere in the live app today — DesignPalette.tsx's ground-feature
 * chips and Map.tsx's water-point buttons both draw a color swatch + label text, never `icon`.
 * The same is true of getElementArt2() until each of those five call sites is wired to read from
 * it — this file only ships the art and the lookup, per docs/ELEMENT-ART-BRIEF-2.md's own scope
 * (Codex generates and self-checks; wiring the lookup table plus the one concrete
 * ELEMENT_CATALOG gap it names — `playground` — is Claude's job; wiring the five *catalogs*'
 * render call sites to actually consume getElementArt2() is a separate follow-up, same shape as
 * the GROUND_FEATURES/WATER_POINT_CATEGORIES icon field being unused data today).
 */
export const ELEMENT_ART_2: Record<string, string> = {
  // CATEGORY_META (lib/design-elements.ts) — 3 new, 3 reused
  water: '/element-art/jojo_2500.png',
  earthworks: '/element-art-2/category_earthworks.png',
  structure: '/element-art/shed.png',
  growing: '/element-art-2/category_growing.png',
  animal: '/element-art-2/category_animal.png',
  access: '/element-art/gate.png',

  // GROUND_FEATURES (lib/design-elements.ts) — 8 new, 2 reused
  boundary: '/element-art-2/boundary.png',
  house: '/element-art-2/house.png',
  patio: '/element-art-2/patio.png',
  driveway: '/element-art-2/driveway.png',
  lawn: '/element-art-2/lawn.png',
  veg_garden: '/element-art/veg_bed.png',
  orchard: '/element-art-2/orchard.png',
  cleared: '/element-art-2/cleared.png',
  staple_garden: '/element-art-2/staple_garden.png',
  terrace_bank: '/element-art/terrace.png',

  // ELEMENT_META (lib/site-elements.ts) — all 9 reused, no new art
  jojo_tank: '/element-art/jojo_2500.png',
  tap: '/element-art/tap_point.png',
  borehole: '/element-art/borehole.png',
  pond_dam: '/element-art/dam.png',
  compost: '/element-art/greywater_basin.png',
  gate: '/element-art/gate.png',
  beehive: '/element-art/beehive.png',
  nursery: '/element-art/nursery_table.png',
  tree: '/element-art/tree_other.png',

  // WATER_POINT_CATEGORIES (lib/water-points.ts) — keys lowercased from the type's 'Spring'/
  // 'Well' etc. 2 new (spring, well), 5 reused. 'other' here is WATER's Other → other_water.png;
  // JOURNAL_CATEGORIES' unrelated 'other' key is prefixed journal_other below so the two don't
  // collide in this one shared map.
  dam: '/element-art/dam.png',
  pond: '/element-art/pond_small.png',
  // 'borehole' already set above (ELEMENT_META and WATER_POINT_CATEGORIES dedupe to the same key
  // and the same art — both mean the same real-world object).
  spring: '/element-art-2/spring.png',
  well: '/element-art-2/well.png',
  tank: '/element-art/jojo_2500.png',
  other: '/element-art/other_water.png',

  // JOURNAL_CATEGORIES (lib/field-journal.ts) — journal_* prefix throughout: 'planting',
  // 'harvest', 'pest' etc. are exactly the kind of generic word another catalog could plausibly
  // reuse. 'weather' is an internal cross-reference to this same batch's own weather art, not a
  // pre-existing-library reuse — the journal's generic "weather happened" bucket doesn't need its
  // own 8th weather asset.
  journal_planting: '/element-art-2/journal_planting.png',
  journal_harvest: '/element-art-2/journal_harvest.png',
  journal_weather: '/element-art-2/weather_partly_cloudy.png',
  journal_pest: '/element-art-2/journal_pest.png',
  journal_maintenance: '/element-art-2/journal_maintenance.png',
  journal_training: '/element-art-2/journal_training.png',
  journal_other: '/element-art-2/journal_other.png',

  // Weather glyphs (lib/weather.ts describeWeatherCode()) — 9 unique conditions, weather_*
  // prefixed to group them in the folder listing and keep generic words like 'clear'/'fog'/'rain'
  // from colliding with a future catalog.
  weather_clear: '/element-art-2/weather_clear.png',
  weather_partly_cloudy: '/element-art-2/weather_partly_cloudy.png',
  weather_overcast: '/element-art-2/weather_overcast.png',
  weather_fog: '/element-art-2/weather_fog.png',
  weather_drizzle: '/element-art-2/weather_drizzle.png',
  weather_rain: '/element-art-2/weather_rain.png',
  weather_snow: '/element-art-2/weather_snow.png',
  weather_thunderstorm: '/element-art-2/weather_thunderstorm.png',
  weather_unsettled: '/element-art-2/weather_unsettled.png',
};

/** Returns the art path for a catalog key, or undefined if none exists yet. */
export function getElementArt2(key: string): string | undefined {
  return ELEMENT_ART_2[key];
}

# Country foundation integration proposal

Delivered code is additive and isolated. This document proposes the next patch;
it does **not** authorise or implement a saved-data migration or international
farming recommendations. Existing SA behaviour remains untouched in this lane.

1. Introduce an explicit, separately persisted `CountryContext` at the site
   boundary: ISO country code, independently selected agricultural region ID,
   and interface language. Coordinate the storage schema and sync policy with
   the owners before changing `lib/site-survey.ts` or site persistence. Unknown
   country must remain unknown, never inferred from the display language.
2. At the current site-to-crop-planner handoff, gate entry into SA authorities
   by **explicit country context**. Existing SA sites need a reviewed migration
   policy; the new foundation must not relabel every legacy site from coordinates
   or apply South African crop advice to non-SA sites.
3. Keep `lib/growing-zones.ts` as the SA variety-zone authority. Do not map
   international Köppen classes onto its SA zone IDs. A country-wide code is
   insufficient for an agricultural region; every current pilot has zero
   locally reviewed region definitions.
4. Keep `lib/site-climate.ts` as the existing SA planner climate bridge, and
   `lib/nasa-power.ts` as the existing location-data provider authority. Its
   existing fallbacks and return contracts are **not** imported into the public
   reference adapter. Before integrating an international climate result, define
   a typed provenance/missingness boundary and require explicit, suitable local
   evidence. A global monthly mean does not provide frost dates.
5. Keep `lib/site-ecology.ts` and its SANBI/SA biome resolution unchanged for
   SA. Abroad, missing local ecology must not select an SA biome/species entry.
   Taxonomy, occurrence, conservation and legal permission need separate scoped
   records; do not add species to the current checked catalogue in this work.
6. Reuse `evaluateCountryReadiness` for review display only at this milestone.
   `productionPlanSupported` and `southAfricanFallbackAllowed` are always false.
   The positive synthetic test demonstrates recognition of complete dated
   evidence, but even that reports `reviewed-evidence-only`; an international
   crop-engine release requires a separate implementation/review gate.
7. Add navigation to `/international` only after product review. This lane does
   not modify shared navigation, `lib/i18n.tsx` or calibrated course content.
   Optional links to `/international/locales` and `/international/projects`
   should be added by integration once those lanes exist and are reviewed.

Add the following test files to the existing package test registry **additively**:

- `tests/country-readiness.test.ts`
- `tests/country-provider.test.ts`

No shared package.json edit was made here. Preserve all existing registrations
and union the localization/project test entries in the coordinator’s patch.

Preview review: country route at port 4250; country selection, unsupported-country
state, source details/links, unknown agricultural region, desktop/mobile layouts,
Earth/dark themes, public reference success/failure and loading state. The UI
makes no private-coordinate request and provides no country-production action.

Source gaps requiring actual research include the UK advice provider/devolved
extension routes, NBN access, Brazil Embrapa/SiBBr access, full local legal scopes,
reviewed region definitions, dated agronomic documents, provider reuse licences
and dataset-level resolution/cadence. A later AGY research/review lane can propose
read-only evidence updates; this Codex lane remains the sole source writer until
handoff.

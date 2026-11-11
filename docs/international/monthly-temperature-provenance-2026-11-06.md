# Monthly temperature coverage

The location parser previously substituted display values for missing NASA POWER
monthly means without recording that substitution. Tagged rainfall and twelve
finite displayed temperatures could then pass the planner's climate gate, even
when the provider had not supplied every monthly mean.

This candidate records optional `climate.monthlyTempCoverage` before those fills:
`{ source: 'nasa-power', status: 'complete' | 'incomplete' }`. The existing numeric
cleaning rule is shared. Numeric outputs, display fills, rainfall selection,
minimum-temperature provenance, network requests and classifier arithmetic keep
their existing behaviour. Coverage describes the parser's supplied series; it is
neither a farm observation nor an authentication or crop-suitability grant.

The shared inspector distinguishes explicit complete, explicit incomplete and
unknown. Missing/malformed/unsupported metadata stays unknown. A claimed complete
receipt with invalid, sparse or missing means also stays unknown. Valid cold and
zero values remain valid. Minimum-temperature provenance cannot grant monthly-mean
completeness.

Planner climate derivation requires complete coverage alongside the existing
rainfall, latitude and recomputed-classification checks. The DataPanel labels the
coverage and withholds its monthly growing calendar and climate interpretation
when coverage is incomplete or unknown. Stored values remain intact. This does
not establish the quality of other environmental fields or local agronomy, and
does not complete the broader review of inherited regional recommendations and
AI prompt data quality.

This changes the picture: monthly growing calendars and climate interpretation
are withheld when coverage is unknown or incomplete. The current rendered result
still requires visual inspection.

## Cache and reference migration

All five location-cache readers/writers move together to v7. Farmer and Design
Studio cache admission also checks monthly coverage, so unproven v7 data cannot
silently stop a refresh. Old v6 entries are left untouched. Live incomplete
payloads can remain available as labelled display estimates; they cannot supply
the planner's monthly climate. Failed or held planner refreshes do not overwrite
existing cache evidence.

The Ezakheni captured reference and Ubhejane sample are distinct. Historical
arrays acquire no new provider receipt. Existing sample records, drawings and
manual tools are separate from monthly-climate admission. The sample-entry test's
cache-hit fixture now supplies an explicitly synthetic complete payload while
retaining its original opening/selection assertions; dedicated migration cases
cover unknown legacy records. Explicitly synthetic regional parser cases supply
the new fixture metadata while retaining all original calendar and climate
assertions; they certify no historical farm capture. A provider-composed positive uses the actual parser
with mocked transport instead of backfilling the historical farm fixture.

## Verification scope

Tests cover the shared helper, actual provider parser, planner derivation and
actual extracted cache callbacks/readers. UI excerpts execute the connected
notice, calendar condition and climate-entry guard; the unchanged calculator tail
is a boundary. These are synthetic contract checks, not provider observations,
browser verification, agronomic calibration or a deployed-account test.

Current-head ordered checks, full CI and actual desktop/phone inspection remain
release gates. No production release, new provider integration, translation
approval, species/lesson change, saved-geometry mutation or PLAN_VERSION change is
claimed here.

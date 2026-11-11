# Grower planning inputs — stage 2 contract

`lib/international/grower-planning.ts` supplies pure arithmetic from explicit grower
assumptions. It does not connect to the automatic planner, storage, UI, geometry or
country-policy authority. Existing South African planning is unchanged.

## Identity and provenance

A version-1 `GrowerPlanningProfile` has `profileId`, an **existing** `cropKey`, one
scope and `inputs`. Catalogue lookup checks identity only. The scope is exactly
`{kind:'mapped-site',siteId}` with a canonical five-decimal coordinate key, or
`{kind:'unmapped-workspace',workspaceId}` using the existing workspace validator.
Supplying both identifiers is invalid. A different scope cannot borrow a profile.
Scope is not a country declaration, local review or legal approval.
`growerPlanningScopeKey(scope)` returns the canonical discriminator plus identity,
or null for invalid scope. `normaliseGrowerPlanningProfiles(value)` projects a stored
list to valid profiles, preserving provided zeros. Every occurrence of a duplicated
`profileId` is rejected, including duplicates in other scopes or a corrupt duplicate;
array order must not decide which assumptions win.

Every field must be present, even when unknown. `GrowerInput<T,U>` is either:

- `{state:'missing',reason:'not-entered'|'not-known'|'not-applicable'}`; or
- `{state:'provided',value,unit,provenance}`.

Provenance carries an exact canonical UTC `recordedAt` (`YYYY-MM-DDTHH:mm:ss.sssZ`)
and a `kind`: `grower-estimate` (optional `note`), `grower-record` (required
nonempty `reference`), or `external-reference` (required `reference` and HTTP(S)
`sourceUrl` without embedded credentials). These are **grower-provided claims**,
not authenticated records or fetched/verified sources. No network fetch occurs.

## Fields and meanings

| Input | Unit | Meaning |
|---|---|---|
| `plantsPerM2` | `plants/m2` | Own stand-density assumption; positive for arithmetic |
| `yieldKgPerM2` | `kg/m2/cycle` | Own total yield assumption over one cycle; zero is data |
| `establishment` | `method` | Exactly `direct` or `transplant` |
| `nurseryDays` | `days` | Before field entry; required only for transplant |
| `fieldEntryToFirstHarvestDays` | `days` | Offset from field entry to first picking |
| `pickingDays` | `days` | Positive duration of the half-open harvest interval |
| `fieldOccupancyDays` | `days` | Positive field-entry-to-clear offset; contains all picking |
| `turnaroundDays` | `days` | Clear-to-next-possible-entry offset |
| `allowedEntryMonths` | `utc-months` | Explicit unique UTC month numbers 1–12 |

All durations are nonnegative safe whole days; picking/occupancy must be positive.
An empty provided month list permits no dates. Missing windows never become an
all-year window. Nursery, first-harvest and turnaround offsets can be zero.
A supplied zero density/picking/occupancy remains provided in the normalized
profile and invalid assessment snapshot; it is never recast as unknown.

`assessGrowerPlanning({profile,scope,measuredAreaM2,fieldEntryDate})` additionally
requires sourced `GrowerInput<number,'m2'>` measured area and
`GrowerInput<string,'utc-date'>` entry date (`YYYY-MM-DD`, years 0001–9999).
Area can be zero and remains unchanged. No unit conversion, inferred value,
germination allowance, tray count or environmental adjustment is applied.

## Assessment and review

Statuses are `invalid-inputs`, `scope-mismatch`, `missing-inputs`,
`entry-window-excluded` and `ready`. Held results contain no forecast or schedule.
Malformed supplied fields are invalid rather than discarded; valid unknown fields
are missing. A direct-established crop has no computed nursery phase. First harvest
plus picking must fit inside field occupancy. Dates use UTC calendar days, including
leap days and year boundaries; out-of-range dates and numeric overflow are invalid.

A ready result exposes `capacity` (unchanged `measuredAreaM2`,
`estimatedPlantCount = floor(area × density)`, `estimatedYieldKg = area × own yield`)
and `schedule` (`fieldEntryDate`, nullable `nurseryStartDate`, `firstHarvestDate`,
`harvestEndExclusiveDate`, `fieldClearDate`, `nextFieldEntryDate`). The latter is an
occupancy/turnaround boundary, **not** a claim that the next date passes the entry
window. A future cycle must be assessed separately.

Plant density is an area estimate, **not layout clearance**: no rows/beds, paths,
edge clearance, weather suitability, survival or success are certified. Yield is
one total; no monthly/weekly distribution or sales promise is inferred. `ready`
means arithmetic-ready under these inputs, not agronomically suitable or legal.
Every result states `basis:'grower-input-arithmetic'` and
`sourceVerification:'not-verified'`; it emits no policy approval flag.

Valid assessments carry detached deeply frozen `snapshot` and deterministic
`fingerprint` strings. Equivalent object order and unordered month selections
normalize alike; value, date, scope or provenance changes invalidate a review.
`isGrowerPlanningAssessmentCurrent(assessment,request)` reassesses immediately
before use and requires both results to be ready with the same fingerprint.
Fingerprints include source context and mapped identity; keep them within the
existing account's data boundary, not analytics or public logs.

## Current integration

The coordinator has wired optional `CropPlanState.growerPlanningProfiles` into
the existing account-scoped crop-plan load/save and temporary sample paths. No
new storage key, cloud collection or permission grant is added. Old plans without
profiles retain that absence. Invalid/duplicate profiles cannot acquire defaults;
other plan books and recorded zero values survive.

The crop planner exposes an explicit grower-estimate editor and calculation review
in both supported and unsupported countries. Forms begin blank, require renewed
estimate confirmation and record real save timestamps. The calculation receives
existing design/canvas beds only; the arbitrary virtual reference bed is excluded
from measured-area inputs. Partial profiles can be saved while arithmetic is held.
No accepted sowing, global forecast, nursery stock or crop suitability is inferred.

Profile saves merge against the latest stored book while protecting other scopes.
A changed same-scope profile rejects the old edit. A delayed autosave is bound to the account/sample and exact device revision
loaded or successfully written by this page. Local edits never re-authorise a
stale base; the writer returns its own exact revision before notifying observers.
On conflict it withholds writes and shows a reload warning, retaining open edits
on screen. A profile save also refuses to discard pending local plan edits. Undoing sowings retains current
grower profiles. Storage failure reports no device save, and country-policy
approval remains separate. Browser layout and hosted persistence still require
real review before release.

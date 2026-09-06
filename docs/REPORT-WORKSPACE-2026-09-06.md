# Report workspace and evidence follow-up · 6 September 2026

Rory approved deployment of the visual report in #422. That change is now on main
at `9c6bf79`; the production workflow passed and the live gallery shows its screen,
full-colour and ink-saving controls. The requests below are the subsequent work.

## Saved sites and saved reports

The menu's Site report entry opens `/reports`, with separate Saved sites and Saved
reports choices. Every saved site appears, including those with no report yet.
Reports retain their coordinate association when a place is renamed. Duplicate
pins at the same five-decimal location share a report workspace, and snapshots
whose place has been removed remain accessible.

Opening a site loads its coordinates and enters Site Analysis Report. New-site
selection starts on the map with instructions, then opens the selected location's
report. Location requests cannot replace a later selection with an earlier result.
The sample's default site no longer overrides an explicit site or new-site request.
Opening the workspace does not trigger paid AI; generation remains an explicit
action. The existing funder restrictions on personal site tools remain in place.

## Prepare a more useful report

The report has an Improve this report checklist: photos, soil tests, water tests,
site survey, boundary, design and planting plan. It reads the current site's
records and links to the existing editors. Unnamed sites can be named and saved
inside the checklist before evidence is attached. Current records are identified
separately from an archived report snapshot.

Soil and water test folders retain original PDFs up to 10 MB in account- and
site-scoped browser storage; the sample uses a separate memory store. Filenames
from older uploads remain references, not saved files. PDFs can be downloaded
again. Key results, units, sampling date/location and laboratory details can be
recorded as notes consumed by the report generator. PDF text extraction/OCR is not
implemented: the interface explains that the results need to be entered. Original
PDFs are local to the device, not a cloud backup. Unknown results and unfinished
designs are not marked verified by a count or percentage.

## Rich reading and full-colour PDF

Relevant report chapters now contain conceptual vegetation-layer, water-collection
and soil-profile graphics. Tree illustrations come from the existing catalogue
and are selected only when named in that section; no species are added or renamed.
Rainfall, stated storage, planting calendars and priced costs are repeated beside
the related narrative using typed site data, never numbers inferred from prose.
The full-colour PDF embeds these chapter plates and captions. The ink-saving
edition omits them. This changes the report picture, not plan-sheet rendering,
geometry, the sheet recipe or PLAN_VERSION.

## Funder programme progress

Progress includes ten current measures from the existing authorised area and
farmer registers, alongside dated indicators: garden coverage, vegetable/staple
areas, hectares, harvest, sold produce, sales, costs, reporting farmers and recent
activity. Current organisation totals are not presented as historical or
project-specific totals when those filters are selected. Missing values are not
zeros. Sample area and farmer portfolios have explicitly different scopes; no
profitability or per-area return is manufactured from unrelated denominators.

Seven areas of work include growing, water/energy, land/biodiversity, livelihoods,
participation, learning and delivery. Organisations can choose from twenty
measurement definitions or define their own, with dated evidence, an optional
agreed target and publication controls. Training remains one part of progress.
The progress export includes the same measures, scope and evidence notes.

## Verification and limits

Required gates: TypeScript, full repository tests, whitespace check and preview
inspection. Regression coverage includes missing/zero values, optional targets,
site/report grouping, scoped PDF bytes, evidence readiness, catalogue tree matching
and actual rich/ink PDF output. A PDF check caught chapter numbering suppressing
illustrations in older reports; the exporter now uses the document assembler's
heading-title rule. Browser results and final CI status are recorded in the PR.

No live AI generation or actual laboratory interpretation was used for QA.
Offline use, cross-device document backup, every catalogue garden's editable
workspace and the older feature-register requests remain separate outstanding
work; this change does not claim those are complete.

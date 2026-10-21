# Four-language completion

Requested by Rory on 21 October 2026. **In progress, not complete.**

Targets: isiZulu (`zu`), Sesotho (`st`), Xitsonga (`ts`), Tshivenda (`ve`). The source is English.
The app also offers other languages; this goal does not remove them.

## Navigation and account batch

The audit started from `origin/main` at `d99108f1`. Its English UI dictionary has 2,555 keys,
including inherited pending blocks. Before this batch, 583 isiZulu, 1,691 Sesotho, 1,706 Xitsonga
and 1,700 Tshivenda entries were missing or identical to English. These are dictionary counts,
not a claim about the number of untranslated screens. Some identical entries are names or
deliberate English sources displayed beside separate drafts.

`navigation-account-drafts.json` pairs 98 existing English keys with new Sesotho, Xitsonga and
Tshivenda drafts. The same controls already have isiZulu wording, which this batch preserves.
The batch covers navigation, site completion, sign-in labels, password recovery and sign-in
errors. No English farming instructions, species names, figures or learning content were changed.
The three regional languages also gain their own shared draft notice. Dismissal is scoped to both
page and language, and expanding the note offers a switch to English on the same page.

**These are unreviewed AI drafts. No fluent-speaker review is claimed.** The source pairs are a
review packet, not evidence of linguistic approval. The existing 95% language-picker threshold
is not the completion criterion for this goal.

`inventory.json` records the remaining dictionary gaps after this batch, including placeholder
differences. Duplicate placeholders in existing bilingual isiZulu strings need call-site review:
some are deliberate source pairing, but a caller replacing only the first occurrence can leave
raw placeholders visible. Do not silently delete the English source to make that check pass.

The initial syntax-tree scan found 2,226 literal-text candidates outside the dictionaries. This
includes other languages, names and intentional English source text. It also misses text built
in ordinary data objects, server-generated strings and document generators. It is a work list
requiring review, not an exhaustive measure of remaining translations.

## Settings batch

`codex/four-language-settings` is stacked on the navigation/account branch (#1028); merge that
branch first. `settings-drafts.json` pairs 43 Settings entries with all four target languages.
Four already-existing guidance keys also gain Sesotho and Tshivenda wording. The existing
isiZulu Settings sentences and existing Xitsonga guidance remain intact.

The actual panel now reads its language context for text size, Simple/All tools, theme choices,
display mode, guidance, support links, save status, paid-AI controls and save errors. The Home
settings launcher also uses the shared translated accessibility label. The six English AI
feature names derive from `AI_FEATURES`, rather than a second independent list. The matching
pending-source CSV has been regenerated.

The partial-language captions also have marked drafts in all four targets. Slate remains the
existing theme's proper name, with a translated description. Language names and each listed
language's partial-status caption deliberately follow that listed language; other languages
outside this goal retain their existing English fallback.

`tests/settings-localization.test.ts` renders the real Settings and AI controls in each target
language, including accessibility labels and every switch. Its deliberately hardcoded-English
variant proves an unwired label is detectable. Source-pair, figure, placeholder and historical
preservation checks retain the source and all unrelated learning content. Old tests that pinned
an English-only caption or the former bilingual close-label expression now guard their actual
rules: explicit draft status, source variables, translated labels and the same 44-pixel target.

Browser evidence in `evidence/settings/` covers all four targets at phone and desktop sizes.
The panel was inspected visually; the seven AI checkboxes and two display-level choices remain.
The tests and browser checks do not claim linguistic approval.

These remain **unreviewed AI drafts**, not fluent-speaker-approved translations. The whole-app
goal remains open; this batch does not complete Home, other workflows, lessons or exports.

## Home and report-controls batch

`codex/four-language-home-reports` is stacked on Settings (#1029), after navigation (#1028).
`core-entry-drafts.json` records 371 newly applied locale entries and the exact English source
for each. It also records earlier native wording that was kept, and the three direct-English
Biome labels replaced in place. No course source, species name, measurement or saved geometry
was changed. These remain **unreviewed AI drafts**.

Home's staff cards, task-completion accessibility labels, calendar action, prices shortcut,
tour explanation and sprout help now use the shared language context. The percentage text keeps
its original values. Dates use native weekday wording and the existing month-name authority;
the existing isiZulu date wording stays intact. Home has one shared draft notice, outside the
welcome card, with a switch to English. The browser check exposed the remaining English example
link in Xitsonga and Tshivenda; both now have source-paired drafts, and the render test rejects
English fallback for that link.

Sesotho, Xitsonga and Tshivenda also gain existing dictionary controls for Reports, report
headings, map help, site design and Lima. This does **not** establish that the report generator,
print window or AI replies are fully translated. `ReportView` still has English/isiZulu-only
branches and ordinary English label maps; those need a subsequent pass. Saved reports retain
their original content and language. The saved-English notice now follows all four targets.

Typecheck, the source-preservation tests and the focused UI tests pass. Actual Home and the
empty Reports list were checked in all four targets at 390 × 844 and 1440 × 1000. Each showed
its selected document language and one draft notice, with no horizontal overflow. Screenshots
and measured results are in `evidence/core-entry/`. The existing floating Lima button overlaps
part of the empty-sites help paragraph on phone; this batch does not resolve that pre-existing
layout issue. Report generation, saved-report opening and paid AI were not exercised.

The Settings full suite exposed a native-loader issue in isolated child processes. Its feature
name import now uses a relative `.ts` path; both failing isolated mutation checks pass after the
repair. Their corruption checks and the original historical source hashes are retained.

## Report viewer batch

`codex/four-language-report-viewer` is stacked on Home/report controls (#1030).
`report-viewer-drafts.json` binds 226 control sources to their keys: 805 new locale entries and
99 existing native values kept intact. Shared Save, Settings, language, tone, Yes/No and missing
value keys are reused. The new 198 English sources bring previously hardcoded controls into the
main dictionary; the inventory is still not an app-completion percentage.

The toolbar, next-report settings, section choices, reading editions, map review, image-opening
controls, crop-calendar controls and saved-version details now use the app language. Saved report
text keeps its original language; the next-generation picker remains independent and has a native
accessible label. Stored section identities remain English identifiers for generation. The saved
body exposes its actual language to assistive technology, while native controls have their own
language. Error messages are announced and repaint after an app-language switch, including failed
map-review saves, crop-export failures, HTTP failures and disconnected generation.

Month words reuse the existing calendar authority. Dates, sowing months, saved crop snapshots,
measurements, report bodies and geometry stay intact. One earlier isiZulu sowing legend omitted
the source's tray qualifier for transplant crops and its planned-task caveat; this batch restores
those clauses without changing the English instruction. The exact prior draft and reason are
recorded in the packet. Crop-plan exports still explicitly say English because their document
bodies have not yet been translated. Crop names retain their existing catalogue identities.

Typecheck and the final 192-test selection of report/save/geometry/print, translation/preservation
and error/accessibility checks pass. The tests mount the real viewer
in all four languages, change app language without remounting, submit only mocked generation
requests, and verify request-language/section identity and exact saved content. A map save is
deliberately made to fail and crop-PDF export is mocked to fail; their rendered errors must change
language too. Historical guards retain the original learning hashes and verify all four complete
pre-batch locale sources after reversing only declared UI changes. An old ternary-shape test now
executes the actual catch classification, retaining the no-false-offline rule, HTTP status and
diagnostic detail. The BRU caveat test retains its source meaning and actual zone name through
the shared placeholder.

The real browser was checked at 390 × 844 and 1440 × 1000 in all four languages with an English
saved report and the existing demo crop snapshot. The selected document language, one draft note,
original English body and unchanged requested report language were observed, with no horizontal
overflow. Phone reading choices now show whole words; sidebar choices have room for long native
labels. Generation requests were intercepted and aborted locally before the server, so the native
error states could be inspected without a paid AI call. Stored report bytes remained exact.
Evidence is in `evidence/report-viewer/`. These checks are not fluent-speaker approval.

This changes the picture. `PLAN_VERSION` stays unchanged. The complete suite and CI still need
to finish before merging. ReportPreparation/readiness, authored summary and visual content,
exports and other workflows remain under the whole-app goal; this batch does not complete it.

## Report preparation batch

`codex/four-language-report-content` is stacked on the report viewer (#1031). This batch
completes the current-site checklist wording in the four targets. Authored summaries and
PDF/export bodies remain outstanding work.

The 62 English source variants and their four drafts live together in
`REPORT_PREPARATION_COPY` in `lib/report-readiness.ts`. This extends the existing preparation
authority and stays pure, so server or document callers need no client dictionary or React
context. The previously present isiZulu headings, actions, save label and input labels are
retained. The old isiZulu-only note that said all status/details remain English was removed;
the parent viewer already displays the shared four-language draft notice.

All seven checklist areas now translate their titles, statuses, detail, actions and limitations.
The name/save form, storage error, snapshot caveat, changed-evidence message and accessible
section name follow the app language independently of the next report's generation language.
The original distinctions remain: a filename is not an attached original; an attachment still
needs key results; entered results still need source review; a fence is not a property outline;
saved records are not verified information or a completed design. Saved source labels, names,
figures, units, readiness decisions and geometry stay unchanged. Date words reuse the existing
month authority. Only authored presentation text is translated.

The fixture `tests/fixtures/report-preparation-translation/source-cases.json` was generated
straight from the original module at `3f7d1615` before refactoring. Nine cases cover missing and
loading maps, one/nine saved maps, fence-only and measured boundaries, photographs, filenames,
attached documents, entered results, survey counts and planting-plan presence. Original
English output remains exact. Native checks compare IDs, readiness decisions, all figures,
units and source labels, and confirm no input mutation. An unregistered synthetic control
must fail the source audit. The real panel is mounted with real progress/evidence/place stores;
app-language switches retain the typed name and repaint a deliberately failed save. Successful
retry keeps the typed name verbatim. Dialog bodies are outside this batch and stubbed in that
component test.

Typecheck, 58 focused tests, the notes gate and whitespace check pass. The full registered
suite is running; no full-suite pass is claimed yet. The real browser was checked in all four
targets at 390 × 844 and 1440 × 1000 with an English saved report. All seven areas rendered,
a forced local save failure used the selected language, and both report bytes and the typed
name remained intact. No horizontal overflow was measured. Twenty viewport screenshots were
inspected; evidence is in `evidence/report-preparation/`. No paid generation or PDF creation
was performed. These remain **unreviewed AI drafts**, not linguistic approval.

This changes the picture. `PLAN_VERSION` stays unchanged. The source table is outside the main
UI dictionary, so the dictionary inventory count does not increase for this batch.

## Summary text and PDF batch

`codex/four-language-report-summaries` is stacked on preparation (#1032). It translates the
one/five-page summary text and prepared sample-report prose. Report charts, figures and the
full-report exporter remain outstanding; native summary text does not establish their completion.

`REPORT_SUMMARY_COPY` in `lib/report-summary.ts` holds 63 English source variants and four drafts.
All 51 existing static English/isiZulu pairs remain exact. The new three regional versions include
unknown/zero, capacity/current-water, proposed/completed-work, illustrative/verified-evidence and
budget/actual-spending distinctions. The prior English one/five-page summaries and full sample
remain exact against four pre-change fixtures. Month words now use the existing calendar authority
in all four targets; the saved month identities do not change. Species identities and recorded
farmer labels remain verbatim.

The BOQ now tags only descriptions authored by its own factories: established beds, staple plots
and the existing listed-plant warning. Summaries translate those tags without guessing from a
saved label. A saved name identical to an authored English phrase stays exact. Prices, rates,
quantities, unpriced reasons and totals retain their existing authority. Count abbreviation `no.`
and SI units remain the original BOQ conventions.

Summary views and their exports follow the app language, independently of the next report's
language picker. Switching app language repaints a summary without changing that picker or saved
report bytes. Returning to Complete report restores the original saved body and its content
language. The existing error-repaint, request-language and source-preservation checks remain.

The old Latin-1 PDF sanitizer deleted Tshivenda letters. Summary PDFs now lazily load embedded,
unmodified Noto Sans Regular/Bold binaries with the SIL OFL license, pinned source commit and
SHA-256 hashes in `lib/report-fonts/`. There is no runtime font request. The summary sanitizer
keeps letters, figures and units while removing decorative emoji and control characters. The
full-report and crop exporters still use their older font paths and need separate work.

The page count stays exactly one or five. Native omitted-detail text wraps in its reserved footer
area. Every target-language page carries the draft-translation notice and the source's verify-
measurements/costs safeguard. Tests verify actual glyph coverage for all draft letters in both
font faces, exact font provenance, Unicode text maps and the actual renderer's native text calls.
A deliberately overlong summary must show its native omitted-detail notice.

Typecheck, 141 focused checks, notes gate and whitespace check pass. The full registered suite/CI
still need to finish before merging. Source, figures, units, record immutability, source-pair and
synthetic-unregistered-control checks accompany actual viewer language switches and mocked AI
requests. Browser exports were real local downloads: eight PDFs, one/five pages in each target,
with the next generation language still English and original saved bytes unchanged. No paid
request was made. All 24 rendered pages were inspected; browser downloads rendered to identical
pixels. Phone/desktop DOM checks show no horizontal overflow. Evidence and sample PDFs are in
`evidence/report-summaries/`. These are **unreviewed AI drafts**, not fluent-speaker approval.

This changes the picture. `PLAN_VERSION` stays unchanged. The pure summary source table does not
change the main UI dictionary inventory count.

## Metrics, chart text and overview batch

`codex/four-language-report-visuals` is stacked on summaries (#1033). Its 71 source variants in
`REPORT_VISUAL_COPY` extend the existing pure chart module. They cover metrics, plain chart titles,
notes, cost groups, tank statuses, calendar words, first-season alternative descriptions, empty
states, figure chrome, sample-chart labels and chapter graphics controls. **The 221 literal pairs
inside figure builders, concept-picture captions/annotations and full-report PDF paths still need
work. This does not complete report translation.**

All 33 existing literal English/isiZulu pairs in the chart module and overview component remain
exact at their actual call sites. Four site fixtures and eighteen fictional gardens retain exact
prior English data objects and SVGs. Plotted quantities, proportions, units, months, one-off
sowing markers, saved labels, source attribution and species identities stay exact. Fictional
garden captions keep the illustrative/unspecified-period and non-livelihood-measure qualifications.
No measured area, actual production or annual yield is inferred.

Language travels with ephemeral chart metadata. SVG calendars, visible labels and their shared
alternative descriptions use the existing month authority; alternatives include saved bed labels
and first-season qualifiers. Native empty-state sentences and longer bar labels wrap without
changing bar widths or stored data. Figure chrome preserves the actual figure object and its
source text; the still-untranslated drawing text is not labelled complete here.

Newly drawn screen information follows the app language. The full-PDF data continues to use the
saved content language, through the same original factories. Summary screens use native metrics;
returning to the saved complete report leaves its body/language untouched. A native `lang` scope
covers the overview and chapter controls. The raw diagram text remains a known language gap until
the next figure pass; these intermediate branches are drafts.

Typecheck, 185 focused checks, notes gate and whitespace check pass. Source-pair, placeholder,
figure/unit, English-SVG, record-immutability, original-viewer-error, historical-Study and geometry
checks remain. A synthetic unregistered source fails the audit. Actual component rendering and
viewer language switches prove that native text is wired; unchanged saved bytes and the separate
English next-generation picker are verified.

The real browser checked all four targets at phone/desktop sizes. Thirty-two inspected screenshots
are committed in `evidence/report-visuals/`: sixteen from the actual viewer and sixteen from the
production chart components/renderer with real CSS. Forty SVG cases, including empty and long-label
states, had no text beyond their viewBoxes; all image sources decoded. The viewer's native water
chart and enlarged-image dialog were opened and inspected in every target. No paid request or PDF
creation was made in this batch. Full registered CI is still pending; no full-suite pass is claimed.
These remain **unreviewed AI drafts**, not fluent-speaker approval.

This changes the picture. `PLAN_VERSION` stays unchanged. The pure document/chart source table
does not change the main UI dictionary inventory count.

## Site plan, land use and built/planned drawings batch

`codex/four-language-report-figures` is stacked on visuals (#1034). It adds 129 source variants
in the existing `REPORT_VISUAL_COPY` authority: 84 drawing variants (including a counted plot
range) and all 45 default non-plant equipment labels used by the site plan. These are **unreviewed
AI drafts** in isiZulu, Sesotho, Xitsonga and Tshivenda. The three drawings now have native titles,
legends, notes, sources and alternative descriptions. All 89 existing literal English/isiZulu call
pairs in these functions remain exact. The dynamic plot range retains its prior English/isiZulu
wording and identifiers through a source template.

Native legend cells and planned-work warnings wrap. Land-use labels reserve a separate column for
measured values. Progress rows expand for longer labels while keeping the same circles and counts.
Small equipment symbols retain their existing shortened label behaviour; a wrapped key also carries
every full default equipment name. Farmer-entered names that happen to equal a source label stay as
recorded. Plant names and codes are preserved, and the site plan's ground projection stays exact.
English outputs for all eight prior figures remain exact against fixtures captured at `25c83e2d`.

The actual viewer was checked at phone and desktop sizes in all four targets, including native
image alternatives and the enlarged site-plan dialog. The three drawings are in **Complete report**;
At a glance intentionally uses simpler charts. Switching the app language leaves the saved report
body, original English content scope, design bytes and next-report English setting unchanged.
The browser profile's QA records were removed and its prior design keys restored after the check.

Typecheck, 176 focused checks, notes gate and whitespace check pass. The source audit rejects a
synthetic unregistered caution. Geometry, area proportions, counts, all equipment drafts, original
source pairs, exact English SVGs, missing-data guards and actual viewer wiring are checked. The
browser measured 24 SVG cases with no text outside the viewBoxes, including equipment-heavy plans
and multi-plot ranges. Equipment-plan text boxes had no overlaps above 0.5 pixels. All images
decoded. The 36 selected screenshots in `evidence/report-figures/` were inspected: 20 from the
actual viewer and 16 from the production chart component/renderer with real CSS. The actual
viewer plan screenshots show the lower legend after scrolling its document panel; the isolated
component evidence shows the entire drawing, including the traced-map inputs.

This does not complete the report work. Climate, sector, water-budget, soil and timeline figures
still need their full native wording/layout pass; a few shared words now resolve through the
extended authority. Concept art, full-report and crop-plan PDF paths also remain. Stored source
attribution strings and saved labels are deliberately unchanged. No paid request or PDF creation
was made. Full registered CI is pending; no full-suite pass is claimed.

This changes the picture. `PLAN_VERSION` stays unchanged. No species, calibrated learning body,
saved geometry, farming calculation or number has changed.

## Climate, water, sector, soil and work-timeline drawings batch

`codex/four-language-report-climate` is stacked on site-plan drawings (#1035). It adds 150 source
variants in the same pure `REPORT_VISUAL_COPY` table. The remaining five deterministic figure
builders now use native draft titles, readings, legends, provenance, caveats and alternatives.
Month axes, wet/dry ranges, shortfall runs and regional-wind seasons use the existing month-name
authority without translating stored month identities. Regional-wind titles and fire notes, all
source phase-title variants, source week/month ranges, climate service labels and model soil
classifications are covered. These remain **unreviewed AI drafts**, not fluent-speaker approval.

All earlier paired English/isiZulu clauses remain exact. The parameterised post/shadow sentence
retains its source figures and prior isiZulu wording. The eight original English objects/SVGs stay
exact against the earlier immutable fixture. Compass direction codes and latitude suffixes remain
canonical, with a native compass key explaining N/E/S/W. Uploaded laboratory texture wording,
farmer-saved names and unrecognised source text remain as recorded. Existing species names,
including Vetiver inside an authored phase title, stay exact. No phase, catchment, soil, solar,
wind, storage or rainfall calculation changes.

Native headers and keys wrap. Soil headings, empty-reading cards, texture keys and pH descriptions
get room around unchanged measurement scales. Water-storage labels wrap without changing the bar
proportions. Timeline titles and ranges have separate columns and row heights; the phase numbers,
hold points, open-ended final stage and order remain. Native sector captions use the same measured
line layout for headroom and placement. The first browser pass caught the cold-temperature value
touching its month label and a long Xitsonga NW wind caption crossing the top edge. Those layouts
were corrected and checked again; the regression checks can detect both failures.

Typecheck, 214 focused checks on Node 24, notes gate and whitespace check pass. Source audits also
read the actual upstream phase/soil factories and named-wind titles, so a new authored variant
cannot silently remain English. Checks retain geometry/data, exact English output, source pairs,
month order, wet/dry marks, roof-runoff/storage arithmetic, installation uncertainty, soil model vs
laboratory provenance, missing-data honesty, phase order and bar widths. No earlier assertion was
removed or weakened.

The browser measured 60 SVG cases across the four targets, including missing water use, unknown
and installed tanks, laboratory/model/unmeasured soil, missing readings, flat/observed wind,
equatorial sun, temperature absence and sequential phases. After the layout corrections, no text
lay outside a viewBox and no text boxes overlapped above 0.5 pixels; all images decoded. The 44
inspected screenshots and structured evidence are in `evidence/report-climate/`: 28 from production
components/renderers and real CSS, plus 16 from the actual Complete report viewer. Native titles,
SVG alternatives and the enlarged soil dialog were checked. Saved report/design bytes, original
English report body/scope and next-report language remain unchanged. QA records were removed and
prior design keys restored. No paid call or PDF creation was made.

All eight deterministic site-report figure builders now resolve their authored display copy
through the four-language authority. This is not whole-report or whole-app completion: concept
art, source-data presentation beyond these figures, full-report/crop-plan PDF paths and broader
workflows/learning/media remain. Full registered CI is pending; no full-suite pass is claimed.
This changes the picture. `PLAN_VERSION` stays unchanged.

## Concept illustrations and native chapter matching batch

`codex/four-language-report-art` is stacked on report climate diagrams (#1036). It adds 61
source variants to the existing `REPORT_VISUAL_COPY` authority, covering all 16 concept pictures'
titles, alternative descriptions and caveats, vegetation-layer words, catalogue-picture wording
and two native technique cues. `report-art-drafts.json` records the new source pairs. These remain
**unreviewed AI drafts**, with no fluent-speaker or agronomic review claimed. Source crop/species
names remain exact, including crop names within alternative text. No new species or farming
figure has been introduced.

The 16 JPEGs remain byte-identical and text-free. The conceptual vegetation tree/soil/roots keep
the same geometry; native labels wrap in a separate column with adjusted leaders and sufficient
height. English chapter objects, picture order and the vegetation SVG remain exact against the
pre-edit fixtures. Concept caveats still lead with the existing warning that these are common
illustrations, not evidence of conditions at this site. Catalogue tree names remain original.

Translated section headings now resolve through the existing report-picker label authority.
The real generator sends those same labels as its selected H2 headings in each independent batch;
the older, longer English template titles retain their original English wording. Only selected
H2 titles are replaced. Subheadings, source facts, numerical templates, section identifiers and
the canonical API allow-list stay intact. Native Swale/Trench bed/Compost phrases can satisfy the
existing technique gate in a native saved body; generic water/ditch/manure words cannot. The
saved body's language controls that match, independently of the app language. Known native
headings retain single figure placement and the existing two-picture limit. Unknown headings
and unknown tree names are not inferred. Arbitrary older generated paraphrases of headings
remain outside the exact alias map; no saved report is rewritten.

Typecheck, 120 focused checks on Node 24, notes gate and whitespace check pass. The new checks
exercise all target aliases, Unicode phrase boundaries, original English objects and actual
English prompt hashes, unchanged image hashes/dimensions, caveats, exact crop names, tree identity,
source-audit failure cases and language independence. A mocked execution of the real POST route
captures every independent batch in English and all four targets, proving translated H2 labels
reach the outgoing request while source rainfall remains. No provider call is made, and unknown
translated topic identifiers still receive a 400 before any model request. No prior test was
removed or weakened.

Browser evidence in `evidence/report-art/` includes inspected contact sheets for all 18 graphic
cards in each language, phone cards and 24 screenshots from the actual Complete report viewer.
The four native vegetation SVGs have no text outside their viewBox or text-box overlap greater
than 0.5 pixels. All card images decoded. Eight real-viewer cases cover native and saved-English
reports under each target UI: all 16 concept alternatives and 17 illustration titles match,
vegetation enlargement works, and no document horizontal overflow was measured. Content-language
and next-report language stay native or English as originally saved. Saved report text and design
bytes remain intact. Temporary QA report/design storage was restored, and the paid route was
blocked. The 52 retained screenshots include full-resolution examples and contact sheets; they
are visual-layout evidence, not evidence of fluent-language approval.

A full registered Node 24 run from the stable climate checkout is still in progress; CI for the
climate predecessor is also pending. No full-suite pass is claimed for this batch. Code-authored
front/back matter for Sesotho/Xitsonga/Tshivenda, full-report and crop-plan PDFs, remaining shared
chrome, wider workflows and learning/media still need work. This changes the picture.
`PLAN_VERSION` stays unchanged. The overall four-language goal remains active.

## Cover, contents and honest section-state batch

`codex/four-language-report-matter` is stacked on concept illustrations (#1037). It adds 37
source pairs to `REPORT_DOCUMENT_COPY` in the existing localisation module. The review packet is
`report-document-drafts.json`. These are **unreviewed AI drafts**, not fluent-speaker approval.
The native cover builder keeps the original document reference, source coordinates and supplied
source flags. It translates document-control fields, issue depth/counts, revision, provenance,
certification status and the existing honesty statement. New native covers also state explicitly
that their translation has not had fluent-speaker review. Only sources actually supplied can be
named; missing map/survey/crop-plan data is never claimed. Native issue dates use existing month
wording; English and other offered languages keep their earlier date path.

The API uses the new cover for Sesotho, Xitsonga and Tshivenda. Its earlier abbreviated isiZulu
cover/glance/closing blocks are retained. Contents headings, standalone-figure labels, figure-list
headings and the uncaptained-figure message now follow all four languages. Original alternative
text, image URLs, source headings and fenced/inline images remain exact. Front-matter recognition
uses the same native labels, preserving body numbers. Native contents pages are recognised during
legacy export too, so exporting does not add a second English contents block. The optional
language-aware legacy builder is available; full-PDF callers still need their later language/font
pass. A saved document's existing architecture is returned byte-for-byte.

Truncated, failed and listed-invasive-rejected section states also have native wording in all
four targets. The API still retries at most once, drops the unsafe draft and records an honest
placeholder. Provider output is mocked in checks; no paid call or species change was made.

Browser inspection found an existing reader defect: a latitude such as `28.6280°` was interpreted
as list item `28.` and lost the leading decimal value in its paragraph. The reader now requires
whitespace after a numbered-list dot. Coordinates and decimal areas stay intact, ordinary numbered
actions keep their markers, and a no-space `1.Text` remains text. The check runs the actual reader
function and deliberately restores the old rule to confirm it detects this failure. The rendered
native covers were inspected again after the repair.

Typecheck, 164 focused Node 24 checks, notes gate and whitespace checks pass. The original English
cover/provenance, assembled-document and legacy-export fixtures stay exact. Checks cover every
combination of supplied map/survey/crop-plan data, anonymous/named sites, source placeholders and
figures, reference identity, front-matter numbering, image captions, fenced/inline images, source
audits and idempotence. The historical provenance test searched literal English table-label bytes;
it now recognises the translated label while still requiring the actual supplied-source producer.
The new runtime checks exercise all source combinations in every target. No assertion was deleted.

Evidence in `evidence/report-document/` contains 32 inspected screenshots/contact sheets and 16
actual-viewer cases: successful, truncated, rejected and failed mocked API output in each target.
Native cover/contents/status wording, the three new document-control tables and fixed decimal
coordinates were inspected at phone/desktop sizes. No document horizontal overflow was measured;
saved report bytes stay unchanged. Temporary saved-report storage was restored and the real paid
route remained blocked. The model-body placeholder is intentionally English and is not evidence
of generated-body translation. No PDF was produced in this batch.

The stable climate checkout's full registered Node 24 run and branch CI are still pending. This
batch does not finish report translation: the source measurement table and non-isiZulu closing
sections (costs, monitoring, risks and assurance), full-report/crop-plan PDFs and wider workflows,
learning and media still remain. The overall goal stays active. This changes the picture;
`PLAN_VERSION` remains unchanged.

## Report measurement tables and isiZulu cover parity — draft batch 12

Based on `af151ab440b84a9ff1d2c7aa930ed1493b4acd90` (draft #1038), the packet
`report-header-drafts.json` records 79 additional authored measurement-table labels, values,
source explanations and templates in all four languages, plus two shared season words.
English source output stays exact for 18 pre-change fixtures and all eight report diagrams.
The packet and fixtures carry their original source SHA; these are unreviewed AI drafts.

All four targets now receive the same complete native report cover and measurement table from
the API. The dead abbreviated isiZulu cover/glance producer was removed; its existing closing
sections remain unchanged. This replaces the earlier batch's intentional isiZulu exception.
The shared month-range parser now owns table and diagram seasons. All 144 start/end pairs retain
the same month identities, including year wrapping. Existing diagram soil-class wording is
reused for recognised model classes; recorded laboratory and unknown wording remain exact.

Recognised collector provenance (map tracing, farmer tracing and Design Studio tracing, including
its recorded point count) is translated in the table and land-use/water-budget captions. Unknown
source annotations and custom names remain verbatim. Counts retain their original digits. Water
category labels translate only exact existing category identities; custom categories stay raw.
No saved geometry, numbers, arithmetic, species identities or source model claims change.

The first phone renders exposed sideways table overflow. Word wrapping alone made field columns
too narrow to read, so native measurement tables now give the three columns minimum widths and
allow word breaks only in field/source columns. Long slash compounds have readable spacing.
The value column keeps original names and decimal values intact. English and other tables retain
their earlier layout. The final tables and actual-viewer contexts were inspected again.

Typecheck, 235 focused Node 24 tests, release-note checks and whitespace checks pass. Tests cover
all source fixtures, deliberately broken source audits, every month range, raw-name collisions,
missing/recorded water, proposed storage, scale/roof/wind source values, native table layout and
mocked actual API output in every target, including isiZulu parity. Two older assertions were
rewritten upward: the earlier packet still checks all its original rows without pinning the
size of a growing shared table; figure provenance now checks faithful translation of recognised
collector text and exact preservation of custom annotations. No assertion was deleted.

`evidence/report-header/` retains 66 inspected screenshots/contact sheets and QA records: 72
actual-viewer phone table cases, 28 full-table static phone cases using the actual reader and app
CSS, eight season SVG cases, and eight mocked actual API reports. All row counts and stored report
bytes are preserved; no clipped cells, document overflow or table overflow over one pixel was
measured. Land-use and water-budget source captions were inspected in every target. One-pixel
fractional table rounding remains recorded honestly. Temporary report storage was restored and
real paid generation was blocked. Mock model-body English is not translation evidence. No PDF
was produced.

The stable climate predecessor's complete registered Node 24 run finished: 538 files, 5,380 passes,
zero failures and one existing shape-sync TODO, with exit status zero. This result is for
`09b280efe5a7be82674af79dce70f238b7b07b1b`; it excludes the later art, document and header
batches. Current branch CI must still run the full suite. Earlier #1034 CI has both jobs green;
#1036–#1038 still had tests running at this checkpoint. All translation PRs remain drafts.

This batch does not finish translation. Catalogue equipment, route and tank display names still
need identity-aware handling; custom names and species must remain exact. Non-isiZulu closing
sections, full-report/crop-plan exports and wider workflows, learning and media remain. The goal
stays active. This changes the picture; `PLAN_VERSION` remains unchanged.

## Report catalogue identities — draft batch 13

Based on `ac308edb2c7b2e4c5bda9c41ebdf611804bead35` (draft #1039), standard equipment
and compact route labels now reuse the existing four-language figure drafts in report tables.
The water-storage bar chart shares the same equipment display helper. A name translates only
when the recorded catalogue ID and default name both match exactly. All growing/plant-code and
botanical identities remain canonical, regardless of dictionary entries. Custom names, unknown
IDs and older records without IDs remain raw. Route labels reuse the summary producer's exported
`ROUTE_LABELS`; its earlier parenthetical-shortening behaviour remains exact.

Tank facts previously dropped an ID already available in the design summary. Collection and API
normalisation now carry that optional identity for display only. Stated capacities, unknown sizes,
counts, names and proposed/existing status still come from their original producers; translation
never recomputes a capacity or joins rows by their names. No saved geometry or species changes.
The one additional authored source, `Windbreak row`, is in `report-labels-drafts.json`; all other
wording reuses existing drafts. No fluent-speaker approval is claimed.

Typecheck, 375 tests across 38 registered files, release-note checks and whitespace checks pass.
Three pre-change fixtures preserve exact English output for catalogue, legacy and custom cases.
Checks visit every catalogue definition and route kind in all four targets, reject missing/wrong/
prototype IDs, preserve every plant identity, and exercise tank collection, API normalisation,
source capacities and status separation. Actual mocked API calls reach the native table labels.
The first new tank check selected the first of two same-name status rows; it was rewritten to
match name plus state and require both rows, so accidental existing/proposed folding is detected.
No existing assertion was removed or weakened.

`evidence/report-labels/` retains 30 inspected screenshots/contact sheets and QA: 12 actual-viewer
mocked API reports and 12 complete static reader/chart scenes, with catalogue, legacy and custom
cases in every target. Phone tables had no clipped cells, horizontal table overflow or document
overflow; all expected names reached the actual reader and saved report bytes stayed unchanged.
All chart images decoded; the 12 source SVGs had no out-of-bounds or overlapping text above 0.5px.
Initial element captures clipped tall later scenes, so final evidence captures each complete scene
as a whole page. Native defaults, raw legacy/custom labels, capacities and unknown-size notices
were visually inspected again. Desktop catalogue cases were inspected too. Temporary saved-report
storage was restored and real paid generation was blocked. No PDF was produced.

Full current-suite CI remains pending; the earlier 5,380-pass full run applies only to climate
predecessor `09b280ef`. The goal stays active: closing sections, full-report/crop-plan PDFs and wider
workflows, learning and media still need work. This changes the picture; `PLAN_VERSION` stays exact.

## Full monitoring and risk sections — draft batch 14

Based on `013cec5286cfb6c7251e48a5907bb8548c80a25d` (draft #1040), 94 authored labels,
explanations and dynamic templates in `report-monitoring-drafts.json` cover the full monitoring
plan and risk register in all four languages. Language now reaches both source builders and
markdown renderers through the actual report API. Default English and unsupported-language
outputs retain their original rows and bytes. Risk ratings remain canonical typed values in the
model; their printed labels use the selected language. Inputs, rule gates, thresholds, rounding,
counts, areas, capacity, risk IDs, species identities and custom names remain unchanged.

IsiZulu now receives the same full source tables, replacing its shortened monitoring prose and
regex-based risk-trigger translation. The earlier native assessment note and risk caveat remain;
its crop, cost and assurance blocks remain byte-exact. No already-saved report is rewritten.
The new text is an unreviewed AI draft, not fluent-speaker approval or a new agronomic validation.

The first phone renders needed 189–353px of sideways scrolling and hid later fields. Exact native
six-column schemas now retain desktop tables and show each row as a labelled block at phone
widths, with every field and action visible. Header cells and explicit table/row/column/cell roles
retain the table relationship; pseudo-labels repeat the matching native column heading visually.
English tables, cost tables, measurement tables and other schemas keep their earlier layout.

Typecheck, 384 tests across 39 registered files, notes and whitespace checks pass. Eleven original
monitoring fixtures and 25 original risk cases preserve the English source, including all trigger
branches, source boundaries, singular/plural quantities, unknown tanks, zero-risk wording and
recorded names containing translation-like words/placeholders. The boundary cross-product checks
768 inputs in every native language against the same canonical decisions. Source audits reject new
untranslated fields and unknown templates; canonical rating keys are checked against their closed
type. Actual mocked API checks prove the full native tables reach all four outputs, including
isiZulu. The actual reader is exercised for native field labels/roles and unchanged other tables.
No existing test assertion was removed or weakened.

An initial new fixture named “none” still raised the source missing-crop-plan risk. That case was
retained as “no-environment-risk”; a genuinely empty case was captured by executing the original
`013cec52` risk module with the existing saved crop-plan fixture. Its absence-of-trigger caution
now has actual native coverage. The nine current-batch checks pass again after this correction.

`evidence/report-monitoring/` retains 68 screenshots/contact sheets and QA records.
Twenty-four complete static reader scenes include 20 phone tables and four empty registers; twelve
actual-viewer mocked API reports include 24 further native tables. All native phone fields/labels
were visible with no clipped cells or horizontal table/document overflow, and saved bytes remain
exact. Separate inspected details show raw recorded names, missing trees/storage, unknown tank
sizes, negative temperatures and empty-register cautions. Desktop tables were inspected too.
Initial overflow captures are retained for comparison. Static scenes use the actual reader and
served app CSS outside its fixed scrolling pane, allowing complete tall-page captures. Browser
saved-report/language storage was restored and real paid generation was blocked. No PDF was made.

Full current-suite CI is pending; the complete 5,380-pass run still applies only to climate
predecessor `09b280ef`. This does not finish the four-language goal: cost/purchasing/assurance
sections, exports and wider workflows, lessons and media remain. This changes the picture;
`PLAN_VERSION` remains unchanged.

## Shared assurance and soil cautions — draft batch 15

Based on `1340afff206706a36fdeec5fa4b6e104ff16a808` (draft #1041), sixteen source-bound
entries in `report-assurance-drafts.json` cover the full shared planning statement, footer, soil
cautions/titles and upload invitation in all four languages. `lib/plan-assurance.ts` owns their
wording and source selection; original English constants remain exact. Unknown/free text is not
translated by inference. All new wording is an unreviewed AI draft, without fluent approval.

The actual report API now uses all five shared assurance paragraphs in every target, replacing
isiZulu's earlier abbreviated producer. A source mismatch was also observed: the generic soil
paragraph said the soil came from a global model even for an uploaded lab result. When report
provenance is supplied, that paragraph now selects the already-existing lab, app-default or
unknown-source caution. SoilGrids keeps the original full model paragraph. The other four
paragraphs remain source-exact selections. Callers without context keep the original generic
English output. No source readings, quantities, species, saved geometry or report bytes change.

Atlas soil provenance now uses those same native titles and cautions for lab/model/default/missing
sources, with explicit language metadata. Its page displays the existing shared draft notice in
all four targets. English source-card HTML is byte-exact. The broader Atlas headings, chart month
labels, search, loading/error and other field text remain to be translated; this batch does not
claim a complete Atlas pass. Shared native footer/invitation text is available for later callers;
full/crop PDF export paths are not yet converted and no PDF was generated.

Typecheck, 418 tests across 43 registered files, notes and whitespace checks pass. Tests bind every
source constant/title to the review packet, preserve the entire generic English output, verify
five ordered native paragraphs, exact source selection, unknown/prototype keys, unchanged other
paragraphs, actual source-card rendering and all visible native text, real caller wiring and
mocked actual API output in English plus all four targets for every soil-source class. The older
isiZulu-closing assertion was rewritten upward: its shortened assurance is superseded by the
complete shared statement, so every original source paragraph must now appear in native form.
Existing crop/cost and native assessment/risk-note preservation checks remain.

`evidence/report-assurance/` retains 60 screenshots/contact sheets and QA for sixteen actual-viewer
mocked API reports and sixteen actual Atlas source cases. Report text includes all five selected
paragraphs and saved bytes remain exact. Every Atlas case has the expected native title, body,
language metadata and visible draft status. Phone/desktop examples were inspected in all targets.
Four native-to-English switches update the same source caution with no new location-data request.
Mapbox/geocoder/location/provider/auth/metering are mocked; this does not verify the map or live
environmental data. An access-token development toast appears in some context captures.

The initial Atlas width checks passed, but visual inspection caught the floating Lima button over
the edge of a bottom-aligned card. Final reading-position captures scroll the caution into clear
view; hit-testing the start, middle and end of every text line finds no occlusion in all sixteen
cases. This verifies a readable scroll position, not a change to the global floating control.
Initial overlap contacts are retained to make that limitation explicit. Temporary report/language
and draft-dismissal storage was restored; real paid generation remained blocked.

The complete 543-file Node 24 run at monitoring predecessor `1340afff` is still live in a separate
stable checkout and excludes this batch. Current full CI is pending; no merges. Costs/purchasing,
exports, wider workflows, lessons/media and fluent review remain. The goal stays active. This
changes the picture; `PLAN_VERSION` remains unchanged.

## Full measured costs and summary parity — draft batch 16

Source: `84278474`, stacked on draft #1042. The full bill of quantities now carries the selected
language through the measured-line builder and markdown writer in isiZulu, Sesotho, Xitsonga
and Tshivenda. The packet contains 25 document drafts and the complete swale-route explanation.
Existing summary drafts still own bed/plot/regulated-plant descriptions; the visual registry still
owns equipment and group wording. These are unreviewed AI drafts, not fluent-speaker approval.

The bill includes native table fields, count/unit words, measurement provenance, all unpriced
reasons, the priced subtotal, missing-price and existing-item explanations, and the original dated
VAT-inclusive price disclaimer. No rate, arithmetic, source date, quantity, group/reason ID,
existing exclusion, or regulated-plant purchasing restriction changes. Full route explanations
are retained. Equipment translates only when its recorded catalogue ID and exact default name
match. Plants, custom names and legacy names without IDs stay canonical. No saved geometry or
report bytes change. English and unsupported-language output is source-exact.

The API now uses that complete shared bill for all four targets, replacing the earlier abbreviated
isiZulu cost table. Its crop and assessment/risk notes remain. Five-page summaries and sample
inventories use the same identity-aware equipment and full route names. One-page summary content
stays exact. The previous native closing-cost assertion was rewritten upward: complete measured
lines are now required, with dedicated tests for the entire shared bill and real API output.

Initial phone renders hid the source column by 88–135 px. Exact native five-field cost tables now
reuse the reader's labelled phone cards, retaining all columns in the desktop view. Each cost
group has a separate accessible rowgroup with one spanning heading, rather than four empty
labelled fields. English and unrelated tables retain their earlier rendering.

Typecheck, 442 tests in 48 registered files, release notes and whitespace checks pass. Twelve
captured source cases cover empty/saved/crop/single-bed-and-plot records, every catalogue
definition and route, existing/mixed status, custom/legacy names, unknown capacity and source-word
collisions. Checks retain exact English models/markdown/summaries, every printed number, numeric
and rate decisions, row order, source metadata and original records. Catalogue checks prohibit
species renaming, identity inferred from words and loss of full route explanations. The source
audit also demonstrably rejects newly unregistered authored wording and unpriced reasons.

`evidence/report-costs/` retains 73 screenshots/contact sheets and QA for 36 static scenes,
16 actual-viewer mocked API reports and four actual five-page summaries. Final phone costs have
zero horizontal scroll range, matching field labels, unchanged desktop/phone cell content and
no clipped value/source text. Separate native regulated-plant rows and financial caveats were
inspected. Summary reading-position captures hit-test every chosen tank/route line without
occlusion; all five page models match the actual viewer. Returning to the saved English full
report retains its body and language. Temporary saved-report/language storage was restored;
paid generation was blocked in the browser and provider/auth/metering/fetch were mocked.

Four new five-page PDFs were generated with the actual summary exporter and all twenty pages
rendered and inspected. Native glyphs, changed water/cost pages, footers and the explicit long-bill
omission notices remain readable. Actual viewer/PDF fixtures pass through the existing saved-fact
normaliser, including its element cap, duplicate exclusions and recomputed tank totals; raw
catalogue cases separately exercise the full builder. The normalisation rules were not changed.
PDFs remain local QA artifacts under `output/pdf/`; page images and hashes are retained here.
Full/crop PDF export paths are still unfinished and this does not claim a whole export pass.

The 543-file Node 24 run at monitoring predecessor `1340afff` is still live in its stable separate
checkout and excludes this batch and #1042. Current full CI is pending. No merges. Crop/purchasing
text, other exports, wider workflows, lessons/media and fluent review remain; the goal stays
active. This changes the picture; `PLAN_VERSION` remains unchanged.

## Plant buying profiles and saved crop notes — draft batch 17

Source: `5b6da923`, stacked on draft #1043. New report crop-plan notes now use the selected
isiZulu, Sesotho, Xitsonga or Tshivenda summary, instead of English in the three regional targets.
The original isiZulu crop heading/page remains exact. One helper owns that page for all callers.
Purchasing guidance now also appears in isiZulu, where it was previously omitted.

`product-profile-drafts.json` binds 82 unique care, purchase and product-description clauses from
`PRODUCT_PROFILES` to four unreviewed drafts. Six purchasing templates cover the heading, original
research-date/introduction, inventory/product line, buying prefix, citation prefix and open gap
notice. The original profile objects and research facts remain unchanged. Month tokens resolve
through `recordsMonthLong`; they do not calculate a season. Tests bind each token's month and
occurrence count to the source words, retain every numeric figure/range and check named cultivars.

This does not complete purchasing translation. Harvest-age/yield research, regional season notes,
livestock detail and other data-owned clauses still need their own source-bound pass. The new
native notice explicitly says those research notes remain in their original English and the
section is not fully translated. The earlier local inventory found 831 distinct data strings
across those sources; some are shadowed or identifiers, so that count is not a completion measure.
No new rates, yields, timings, cultivar/species identities or food-use claims are introduced.

The critical Tshivenda poison/tuber terms were checked against primary terminology sources:
[DALRRD plant-health warning sticker](https://www.nda.gov.za/images/Branches/AgricProducHealthFoodSafety/PlantProductionHealth/PlantHealth/Plant-Health-Promotions/Tshivenda%20warning%20sticker%202022.pdf)
and [DSAC natural-science terminology](https://www.dsac.gov.za/sites/default/files/2023-11/natural-sciences-and-technology-for-grade-4-to-6.pdf).
Those lexical checks do not constitute a fluent-speaker review or approval of the sentences.
All new wording remains explicitly unreviewed. Poison, ripe-only, child-supervision, water/frost,
chilling/pollination and unsupported-claim cautions remain source-bound.

Typecheck, 565 tests across 55 registered files, release notes and whitespace checks pass. A
captured pre-edit fixture covers 34 cases, 103 source harvest records and all 15 livestock
enterprises, with every climate-zone and no-zone/contradictory/frost/shade/wet/dry-water branch,
selected/unselected housing, banana-circle inventory and a name matching authored source words.
English models/markdown/season decisions remain exact. Native models change only declared display
fields; all other notes, source records, months, figures, citations and order stay exact. A new
unregistered profile clause or presentation template demonstrably fails the audit. Real mocked
API checks require the native crop page and buying profiles in all four languages.

`evidence/product-profiles/` retains browser QA for 32 static scenes at desktop and phone sizes,
and 16 actual-viewer mocked API reports. All 48 selected native profile paragraphs plus twelve
gap notices were checked line by line in phone reading positions: 282 lines, zero occlusion.
Crop notes, saved bytes, language metadata and source citations remain intact. Safety, cultivar/date,
numeric, crop, gap-notice and citation examples were visually inspected in every target language.

The initial phone check caught unbroken reference URLs: an affected paragraph was 390 px wide
with 811 px scroll width and extended the static document to 885 px. The reader now wraps citation
paragraphs while preserving their complete copyable text, including original URLs and bibliography
labels. This also improves English citations. Plain paragraphs and saved report text are unchanged.
Final measured scenes have no document, native-paragraph or citation overflow. Temporary saved
report/language storage was restored and real paid generation remained blocked.

The separate complete 543-file Node 24 run at `1340afff` subsequently finished: 5,418 passed,
one failed, and one pre-existing TODO. The failure was eleven isiZulu pictographic control labels
in the unchanged no-emoji audit; batch 18 below repairs that issue. That older run excludes this
and the two preceding batches. Current full CI is pending; no merges. No PDF was
created or modified in this batch. Remaining purchasing research, exports, wider workflows,
lessons/media and fluent review remain under the active goal. This changes the picture;
`PLAN_VERSION` remains unchanged.

## Drawing controls and the full-suite icon failure — draft batch 18

`codex/four-language-control-icons` is stacked on the buying-profile branch (#1044).
`control-icon-drafts.json` records 50 exact sources, four native values and all original
values/source lines at `59a115b1`. These are unreviewed AI drafts. The controls previously
inherited English in Sesotho, Xitsonga and Tshivenda; several isiZulu values combined a glyph,
native wording and an English suffix. The packet preserves the original wording for review.

Palette actions now use fixed Lucide icons with native accessible names/tooltips. Canvas Cancel,
Point, Finish and preview confirmations render their icons separately from the translated words.
Operation callbacks, availability checks, confirmation gates and saved/draft geometry do not
change. English wording changes only by removing the old glyphs. A line hint carries its native
wording and a separate English source. The unused legacy Main label also loses its glyph; no
active Home badge is claimed.

Sector headings, field sentences, compass words and the advance action follow all four targets.
The draft notice sits outside the card; the English source remains visible beside each native
sentence. The wind sentence retains the coordinate climate-grid mean and on-site confirmation
qualification. Model-owned provenance and seasonal text can still be English. This is not a
complete Design Studio translation claim.

A lexical check against the Department of Arts and Culture’s 2013
[Multilingual Mathematics Dictionary](https://ulspace.ul.ac.za/server/api/core/bitstreams/a1a05d26-ee2d-49d5-9be8-4a33ebd145e8/content)
identified an opposite-meaning Tshivenda verb: `fhambanyisa` means differentiate (printed p.43),
while `fananyisa` means match (p.80). The two Snap labels and six previous buying-profile clauses
now use the matching verb. The product packet records each exact before/after and reason. The
geometric point labels also follow the dictionary’s point entry (p.105). These checks do not
constitute fluent-speaker approval of the sentences.

Typecheck, 203 tests across 32 registered files, release-note checks and whitespace checks pass.
The original no-emoji test stays unchanged and now passes. Historical Study guards reverse only
the complete exact declared UI layer, retaining the original hashes. Deliberately altered controls
and learning fields still fail those guards. Actual caller JSX tests check each icon, accessible
name, callback, confirmation gate, one-pass placeholder, geometry preservation, separate English
source, source qualifiers and draft status.

The visual check found a real phone problem: the absolutely centred action group shrank to about
half the canvas width, forcing long labels into narrow columns and shrinking an SVG. Its width now
uses the available bounded content width; icons cannot shrink. Another check found keyboard focus
could leave part of an isiZulu tool behind the scroll boundary. The strip now reveals its focused
action fully. Neither adjustment changes the farmer’s measurements.

Evidence and limitations are in `evidence/control-icons/`. The browser rendered 106 isolated
actual-caller states at 390 × 844 and 1440 × 1000 with the app’s real fonts. All four phone action
and sector cards and representative desktop cards were visually inspected. Measurements cover
all states; no document overflow or clipped text/buttons remained. Keyboard checks cover the eight
palette actions in all four targets. The fixtures use actual source JSX, model code and the actual
focus handler, with isolated UI state and mocked preview summaries. They do not establish that the
full map editor, personal saved records or paid generation have been exercised.

This changes the picture. `PLAN_VERSION` is unchanged. The whole-app goal remains active:
purchasing research, other workflows, exports, Study/media and fluent review remain unfinished.
No PDF was created or modified in this batch.

## First-crop reference explanations — draft batch 19

`codex/four-language-product-research` is stacked on drawing controls (#1045).
`first-crop-drafts.json` captures the 19 original first-crop note sources at `6446f1cb` and
binds them to four unreviewed AI drafts. Five further source rows cover the complete reference
sentence, fallback qualification, explicit unsourced/immediate-food caution and month/year labels.
The verified harvest-data file retains its exact pre-edit SHA-256.

The report’s plant-buying section now translates the complete first-crop explanation, including
its trial, region, propagation, earliest-age versus typical-age, starting-clock uncertainty and
no-guarantee qualifications. It does not replace a qualified paragraph with a short translated
heading. Named source locations and cultivars remain identifiable; all numeric tokens stay exact.
The English guides and markdown remain byte-for-byte equal to the existing 34-case source fixture.
Saved site facts, citations, species identities and season decisions are unchanged.

`firstCropAgeLabel` still owns the original month/year choice and rounding. An optional formatting
callback supplies only presentation words; its default preserves the old English API. There is
no second age calculation. Missing timing remains explicitly unsourced and says not to rely on
new plantings for immediate food. A deliberately unregistered source note fails the audit.

The previous product-profile preservation test now allows this narrowly declared first-crop line
while retaining deep equality for every other field. Its original source fixtures stay intact.
Typecheck, 369 tests across 41 registered files, release-note and whitespace checks pass.
Independent checks bind all 19 notes, source-data hash, figures, placeholders, named identities,
unit conversion boundaries and missing-note handling. The real mocked API test continues checking
every guidance line reaches all four report languages. No paid AI is used.

`evidence/first-crop/` records 80 static source/missing-timing scenes at phone and desktop sizes
(160 measured states), plus four actual saved-report viewer flows from mocked API output.
The existing placement adapter emitted 17 first-crop records per report: 68 native paragraphs
and 608 phone lines, with zero occluded lines, clipped paragraphs or document overflow. Granadilla
and guava were not emitted by that placement fixture; their original source-group records are
covered in the direct/static checks. This batch does not change placement eligibility.
The viewer’s selected body language and saved bytes stayed exact; temporary browser storage was
restored. Source/trial, missing-timing and actual-reader examples were visually inspected in all
four languages. These checks do not constitute fluent-speaker approval.

The long full run at `6446f1cb` is still in progress. It caught two release-note lines over the
existing 90-character phone limit, from the two preceding batches. Follow-up commits on #1044 and
#1045 shorten those lines without changing the test. No full-suite success is claimed for this branch; current CI must finish before
merge. This changes the picture; `PLAN_VERSION` stays unchanged. No PDF was created or modified.

Established-production/yield explanations, supplementary and regional research, livestock notes,
other workflows, exports and Study/media remain open. The native purchasing-gap notice remains.
The whole-app goal stays active and incomplete.

## Established-production and yield references — draft batch 20

`codex/four-language-product-yields` is stacked on first-crop explanations (#1046).
`product-yield-drafts.json` binds 15 full-bearing/yield source notes and four reference/fallback
sentences to unreviewed drafts in isiZulu, Sesotho, Xitsonga and Tshivenda. The notes were captured
before implementation at `231e7bd3`; later parent changes were test-only. The verified harvest-data
file retains its original SHA-256. No source ages, yields, spacings, species identities, seasons
or household-food eligibility rules change.

The buying section translates each complete research qualification with its original typed
range. It retains the distinction between orchard-average calculations and measured individual
trees, trial conditions versus a local forecast, seasonal collection versus annual production,
whole fruit versus edible pulp/kernel mass, lifespan versus age-specific yield, and cultivar-group
specificity. It does not calculate an intermediate age curve, multiply by the planted inventory
or relabel a source weight as kg/year. Missing notes retain explicit source-check/annual-forecast
cautions; absent ranges create no line. `formatRange` remains the original number formatter.

Formula notation, source spacing quotations and named locations/cultivar groups remain exact,
including the original operators, values and dimensions. These are intentional source quotations
and identities. The per-plant display heading itself has native unit wording. The English model
and markdown remain exact against the existing 34-case fixture. Native models permit only the
previous declared fields and these two additional source-bound lines; every other field is still
deep-compared. The earlier preservation claim is expanded with this explicit reason, not removed.

Typecheck, 391 tests across 44 registered files, release-note and whitespace checks pass.
Independent checks bind every source path, source-data hash, draft value, ordered numeric token,
placeholder, formula and named identity. A deliberately unregistered production note fails the
audit. Default/unknown languages, missing notes and ranges, one-pass interpolation, original
English output, sources, seasons and saved records remain covered. The actual mocked generation
route must include every selected native guidance line; real paid AI is never called.

A terminology check also corrects four earlier forecast cautions, recorded with exact before/after
values in `forecast-word-corrections.json`. Xitsonga uses the forecast root supported by
[Statistics South Africa’s crop-forecast entry](https://www.statssa.gov.za/wp-content/uploads/2015/11/Multilingual_Statistical_-terminology_2013.pdf)
and [the Presidency’s Xitsonga usage](https://thepresidency.gov.za/tso/node/5334), instead of prophecy
wording. The Tshivenda dated-forecast caution reuses the existing report forecast noun. These
lexical checks do not validate sentence fluency or count as human approval. Source English and
figures stay unchanged; older screenshots are historical evidence.

Browser evidence in `evidence/product-yields/` covers 152 static reader states and four actual
saved-report flows: 48 native production paragraphs, 414 phone lines, no occlusion/clipping or
document overflow, exact body language and saved bytes. Formula, caution, missing-note and
actual-reader examples were visually inspected in all four languages. Two actual Xitsonga
rainfall/climate cards were also checked at phone/desktop sizes; their captions remain complete,
while phone art retains its intended internal horizontal scroll. Final viewer runs use disposable
contexts with explicit onboarding/consent fixture preconditions; those flows are not claimed as
verified here. No paid AI or PDF generation is used.

The full 547-file run at older `6446f1cb` remains live, with its known failures repaired in
predecessor heads. No current full-suite success is claimed; CI must finish before merge.
The native purchasing-gap notice remains: supplementary/region/season, product and livestock
wording still contains English. Wider workflows, exports, Study/media and fluent review remain
open under the whole-app goal. This changes the picture; `PLAN_VERSION` stays unchanged.

## First-run consent and goals — draft batch 21

`codex/four-language-consent` is stacked on production/yield notes (#1047). The real two-step
consent flow now has native review status and source labels in all four targets, and fills
three missing goal-selection prompts in Sesotho, Xitsonga and Tshivenda. `consent-drafts.json`
records 16 new/corrected native values, their exact previous wording and the pre-edit source
hashes. The sharing label now describes results that do not disclose whose they are. The
Xitsonga family-food goal retains a steady spread through the year without promising food
never ends. These are **unreviewed AI drafts**, without fluent-speaker or compliance approval.

All 18 original English consent/goal clauses remain exact, as does the existing isiZulu notice.
Each target keeps separately language-tagged English source text. Switches, actions and dialogs
have native accessible names; goal buttons expose their selected state. Storage remains
required and starts on; sharing remains optional and starts off. The three goal IDs, selection
gates, account-scoped storage keys, record schema, timestamp and legacy-key cleanup are unchanged.
No policy, data-handling behavior or English farming/learning source was rewritten.

Evidence in `evidence/consent/` covers the actual modal at phone and desktop sizes in all four
languages: 32 states, 1,381 readable text lines without clipping, occlusion or document overflow.
The modal intentionally scrolls on phones. Disposable browser contexts exercise required-storage
and no-goal gates and save only synthetic local records; no real account or external consent is
used. Real React-hook tests also cover all three goals and changing language while keeping choices.
Exact source hashes and negative altered/partial-layer checks keep historical Study protection.
Typecheck is clean; 433 tests pass across 51 registered files, and whitespace checks are clean.

The original test excluding Xitsonga from source pairing pinned the old language list; it now
requires source backing for every target draft. Its consent-default/gate assertions remain.
The pending-source CSV was regenerated through the unchanged script after adding two UI source
keys; human translation cells remain blank. Wider workflows, research, exports, Study/media and
fluent review still remain under this goal. This changes the picture; `PLAN_VERSION` is unchanged.

## Offline page and sync badge — draft batch 22

`codex/four-language-offline-status` is stacked on consent (#1048). The 72 device-page entries
now have Sesotho, Xitsonga and Tshivenda drafts, and the missing isiZulu connection sentence
is filled. `offline-device-drafts.json` records 84 source pairs / 267 native values including
review/source labels, the short offline/waiting badge and eight additional exact device/service
errors in all four targets. Existing isiZulu page wording stays exact except two titles aligned
to the current Saved on this phone source instead of the retired Offline & sync name; their
prior wording is recorded. English stays exact.
These remain **unreviewed AI drafts**, without fluent-speaker approval.

The actual page now keeps source/review disclosures in every target, tags English separately,
uses native accessible action names and fills English-source placeholders with the actual counts
and page names. Progress, failed-page identities and error sources stay language-independent in
React state, so a later language switch updates an already-visible message. Unknown server and
user text stays verbatim with unknown-language markup. No queue payload, operation ID, cached
record, authorisation rule, account scope, lease, server acknowledgement, download byte or
local-only removal rule changes. Recorded service and worker hashes verify those files are
unchanged in this batch.

The real page and badge were verified at phone/desktop sizes: 24 guest-page states with explicit
onboarding/consent fixture preconditions and blocked service workers for the first-start error.
Another 48 queue-state fixtures use the actual component/hooks with isolated services and stub
header/navigation; these do not claim a real signed-in workspace. Their 13,900 text lines were
checked for readability by scrolling, with no clipped/occluded tested reading position, document
overflow or raw placeholder. Representative screenshots were visually inspected. A live provider
check also updates the same existing error through all four languages without reloading.

Typecheck is clean; 551 tests pass across 63 selected registered files, with separate manifest
validation. Actual handlers cover all queue states, source disclosures, downloads, Simple/All
tools, keep/remove/lease gates, account switches, preparation gaps/completion, authorised visit
pagination/photos and post-send language changes. Exact locale/source hashes and negative
partial/altered-layer checks retain the original Study protection. Old English-literal and JSX-
distance tests now guard their actual target-size/visibility rules. The unchanged CSV generator
adds 12 English source rows with blank human handoff cells.

The older frozen 547-file run has finished: 5,445 passed, three failed and one pre-existing TODO.
Its three failures were already repaired in predecessor heads and pass in the current focused
run. A fresh complete run is required at the finished head; the older result is not current-head
proof. Study pack/media, other service messages, wider workflows, exports and fluent review
remain under the whole-app goal. This changes the picture; `PLAN_VERSION` is unchanged.

## Remaining work

1. Finish shared app chrome beyond the checked Settings panel: onboarding, updates, account, dialogs, accessibility
   text, confirmations and failure states. Replace English/isiZulu-only branches with the shared
   language context. Verify phone layouts and language changes without stale text.
2. Complete the farmer workflows: map, survey, evidence, designs, crop planning, tasks, records,
   journal, prices, saved reports, offline preparation and sync. Preserve measured quantities,
   saved geometry and source meaning. Resolve dictionary placeholders against actual callers.
3. Complete mentor, organisation, funder, network, exchange, assessment and programme screens,
   including empty, loading, error, permission and save states.
4. Audit all Study content and media through its existing source-bound draft machinery. Preserve
   calibrated English lesson bodies, quiz options, answer order, rationales, species identities
   and figures. Keep held technical clauses explicit. Do not label an English slide or voice as
   a translation, and do not invent recordings or human review.
5. Audit print, download, share and generated outputs. Language selection must actually reach the
   document generator and AI request; a translated download button does not translate its PDF.
   Keep saved outputs' original language and source identity intact.
6. Verify all reachable roles and representative complete workflows in every target language,
   on phone and desktop. Review residual English intentionally and account for every exception.
   Run typecheck, the complete registered suite, whitespace checks and CI. Record honest media
   and human-review gaps. Do not mark the goal complete from a dictionary percentage alone.

## Checks

`tests/translation-inventory.ts` reads the actual English dictionary, including spreads, and can
scan JSX literal text and accessibility attributes. `translationGaps` in `lib/lang-coverage.ts`
exposes missing, blank, English and placeholder-different entries. `coverageOf` no longer counts
blank labels as translations.

`tests/four-language-completion.test.ts` exercises broken synthetic dictionaries and JSX so the
checks can fail. It also checks live translations against exact English sources and the review
packet, source figures and placeholders across all four locales.

An old Study guard pinned the whole shared Tshivenda dictionary. Its original hashes remain:
`tests/navigation-translation-preservation.ts` verifies and removes only this declared block of
new app-control entries before that historical comparison. Overrides and undeclared changes
still fail; calibrated Study data remains protected. This is not a replacement of old hashes
with whatever the current implementation happens to contain.

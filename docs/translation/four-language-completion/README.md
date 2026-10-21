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

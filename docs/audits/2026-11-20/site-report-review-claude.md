# Site report review: where it stands and what to improve — 20 November 2026

- Auditor: Claude, for Rory, with three read-only sub-reviews (prompt content, report screens, audit history). Every finding marked *verified* below was re-checked by the lead against source, the running screen or an exported PDF.
- Reviewed revision: `main` at `79adc2321ab22afdf8f921399d7f68dea23b30ad`, branch `claude/site-report-review-20261119`, plus commit `52b77266` (five fixes, below).
- Deployment inspected: none. Reports need a signed-in South African site and a paid model call, so the real report screen and route ran locally: the screen with the sample farm's design as an ordinary local site, the route with the model, sign-in, metering and country lookup stubbed. The narrative in every capture is labelled synthetic.
- Previous audits: the 12–19 November report records (CSR-15A, survey roof and water evidence, cost-gap labels) and [Site survey correctness and global readiness — 14 November](../2026-11-14/site-survey-global-readiness-claude.md), whose SS-005 and SS-006 Codex addressed on 15–16 November. Carries SS-002, SS-003, SS-004 and REP-L02.
- Scope: `app/api/generate-report/route.ts`, `components/ReportView.tsx`, `lib/report-pdf.ts`, `lib/report-planting-safety.ts`, `lib/report-site-facts*.ts`.
- Evidence type: source review; captured model prompts (standard, comprehensive, one-page); the real report screen at 390 px in Chromium; a 28-page PDF exported by the app; automated tests.

## What was already done

Between 12 and 19 November, Codex removed many invented or unsupported statements from the report and kept survey and map evidence separate. All of it reached `main` in #1394 on 19 November. Those records stand. None of them checked a real model-written narrative: every one used a stubbed provider. The newest record that reviewed a real generated report is the [5 September site report audit](../../SITE-REPORT-AUDIT-2026-09-05.md).

## Fixed in this branch (commit `52b77266`)

| ID | User-visible problem | Status | Evidence |
| --- | --- | --- | --- |
| SR-001 | A paid report waited for a tap on Save. Back, a reload or "Generate new report" discarded it, and the next attempt spent allowance again. | Fixed; verified on screen | After a stub generation, the saved-reports store holds the report with no tap. `ReportView.tsx` saves each finished generated version once; a full store still shows the existing "not saved" notice. |
| SR-002 | Sources printed as raw Markdown, e.g. `Source: [KZN DARD, Fruit and Nut Production …](https://…)`, 14 times in one sample report, on screen and in the PDF. | Fixed; verified on screen and in PDF | Screen: 0 raw links, 14 titled links. PDF: `title (full address)`. Saved report text is unchanged. |
| SR-003 | In English, the cost, monitoring and risk tables ran 421–558 px wide in a 354 px phone column; "What to do about it" was off-screen. Translated reports already used labelled rows. | Fixed; verified on screen | All three now use labelled rows with no overflow. The 12-month product grid still scrolls sideways (unchanged, by design). |
| SR-004 | A refused request showed "The server returned code 429" although the server sent a plain sentence ("Today's free AI for visitors is used up…"). | Fixed; verified on screen | A simulated 429 now shows the server's sentence. |
| SR-005 | With no sourced lowest temperature, the frost screen switched off: the "screened" list sent to the model offered mango, pawpaw, marula and brown ivory for a 962 m KZN site with Köppen Dwb and a −6.5 °C zone minimum. | Fixed; verified in the captured prompt | Unknown now screens as frost-possible (the existing ≤ 0 °C rule, woody perennials only) and the prompt says why. A sourced warm minimum still allows them. |

Four existing assertions encoded the old behaviour (raw citation text kept, English tables unchanged, a manual Save tap). They are rewritten with their reasons in the test files. Each new or rewritten check fails on the previous code (adverse control run).

## Open findings, most harmful first

| ID | User-visible problem | Status | Evidence and next action |
| --- | --- | --- | --- |
| SR-006 | **No one has read what the model actually writes since early September.** Two months of prompt fixes are unverified against real output. | Open; verified from the audit archive | Generate one real Standard report for a known South African site and review it against the rules below. Needs Rory's agreement to the model cost, or a recent real PDF from him. Carries SS-003. |
| SR-007 | **The prompt asks the model to name species from memory.** Natural Vegetation: "go deeper — name species typical of the Thukela Thornveld … geophytes … propagate on-site". Its "key species" line is generic Savanna (Mopane, Leadwood, Fever Tree), wrong for highland KZN. Guilds (18 slots), Windbreaks ("fast shelter"), Fire ("aloes, spekboom, vygies") and the 5-Year Vision also ask for species. The invasive check after generation knows only about 15 names. | Open; verified in the captured prompts | Contradicts the system rule (screened candidates only) and AGENTS §4. Next: every species-naming template draws only from the screened list or says "no screened candidate"; drop the generic key-species line when a SANBI unit is known. |
| SR-008 | **Templates demand content the data cannot support:** an action for each of 12 months; "plant every 2–3 weeks"; "name the hungry gap" (contradicts "unreported months are unknown"); home bottling for a crèche; "use the municipality named" when the data says it is unknown; litre placeholders in the irrigation table; "fire comes from the windward side" with wind unknown. | Open; verified in the captured prompts | Allow "not established" in each; delete the unsourced figures. |
| SR-009 | **Animals are recommended where none are kept.** Livestock "none reported", yet the Animals template asks for breeds, a carrying capacity and bees; the chicken-management block is printed in every batch. | Open; verified in the captured prompts | With no livestock, give "questions to answer first" (space, bylaws, child safety, care). Print the chicken block only when poultry is recorded. |
| SR-010 | A legal warning naming a listed invasive plant fails the post-check twice and replaces two whole sections with a placeholder. | Open; source review (sub-review) | Let a named warning pass, or write the warning in code. |
| SR-011 | **Leaving while a report is being written throws it away, but it is still paid for.** No cancel, no "leave anyway?" prompt; the server keeps generating. SR-001 protects only finished reports. | Open; source review (sub-review) | Keep the request alive outside the screen, or confirm before leaving. |
| SR-012 | **No real progress.** The server waits for every section before sending anything; the progress bar is fixed and the connection sits idle for minutes on mobile data. A section that fails becomes one italic line, not shown in the chapter list, and fixing it means regenerating everything. | Open; source review (sub-review) | Stream sections in order; name failed sections and offer to rewrite only those. |
| SR-013 | **The report is long and heavily hedged.** A Standard 16-section report is 28 A4 pages. About 5,700 words of fixed text appear before the model writes anything. The PDF contains 67 "not a / not proof / not established"-type hedges and 13 "Concept illustration, the same in every report" figures. It has two title pages, and "site at a glance" appears twice. Crop rotation and market illustrations repeat. Twelve rows read "No sowing or transplant task scheduled". A buying section reproduces 1991 avocado trial arithmetic. | Open; measured on the exported PDF | Product decision for Rory: a shorter default, one front section, hedges stated once in a "how to read this" box, and research detail moved to an appendix. |
| SR-014 | **The defaults cost the most.** 16 sections means 8 parallel model calls, each carrying the plan images. Brief mode still accepts many sections and always appends cost, monitoring, risk and assurance. Cost and time are not shown before Generate. | Open; source review (sub-review) | Default to a short essential set, show the call count and allowance, and really disable sections in Brief. |
| SR-015 | **The "Simple" wording option clashes with the templates.** It asks for very short plain sentences, but templates ask for botanical names, geophytes, guild layers, ETo and Köppen codes. The demo climate class "Dwb" contradicts its own monthly means (11.5 °C coldest; the app's classifier gives Cwa). | Open; verified in the captured prompts | Simplify the templates when the tone is Simple; re-derive the climate class. |
| SR-016 | Two roof-harvest figures remain (0.8 on the map, 0.6 in the survey). A roof without gutters is still credited a harvest. | Open; verified in the captured prompt | Carries SS-006, partly addressed on 15 November. One figure; with no gutters, "not collected now". |
| SR-017 | Reports live on one device only. Share sends a 200-character teaser that the recipient cannot open. Delete has no confirm or undo. | Open; source review (sub-review) | Sync to the account; share the PDF; confirm before deleting. |
| SR-018 | Six of the eleven report languages come out half English with no warning. The sub-review reports that the PDF drops Tshivenda and Sepedi letters outside Latin-1 (ḓ ṅ ṱ š). | Open; language coverage from source, PDF characters **not verified here** | Label languages "full" or "AI text only"; embed a Unicode font. Carries SS-002. |
| SR-019 | South-Africa-only wording (°S/°E, southern sun, SANBI, NEMBA, rand, SA breeds). | Open; acceptable while reports stay gated to confirmed South African sites | Address with the global work, not before. |

### Checked and sound

- The system rule against inventing structures and figures binds every batch.
- Water inventory gaps are stated as unknown, not absent, and survey and map records stay separate.
- Soil placeholders are marked as not evidence. There is one rainfall figure, and sun geometry is computed from the latitude.
- The code-written glance table, bill of quantities, monitoring plan and risk register are sound.
- Country support is checked on the device before anything is spent.
- The At a glance and Field guide editions need no model call.
- No horizontal page overflow at 390 px; chapter jumps move focus.

## Verification

- Typecheck: clean (`tsc --noEmit --incremental false`, Node 22.23.4). An earlier run hit missing `.next/types` files because the dev server was restarted mid-run; the clean re-run is the result.
- Affected tests: 103 of 103 pass across ten files, including the release-note, registry and new `tests/site-report-reader-fixes.test.ts`.
- Adverse control: with the source changes reverted and the new tests kept, 5 checks fail (the new file and four rewritten assertions). Restored afterwards.
- Full suite: see the PR or issue #35 for the result. It is not claimed here.
- Whitespace: clean. Release notes: a new 20 November entry stamped `79adc232`; the pending-notes check passes.
- Output inspected: the real report screen at 390 px (links, tables, error message, saved store) and the app's exported PDF (28 pages), before and after the fixes.
- Limits: no real model output, no signed-in account, no physical phone. The PDF character loss in SR-018 is not reproduced. The screen was mounted through a temporary local fixture route, never committed. `PLAN_VERSION` is untouched; this changes report presentation, not map pictures.

## Next continuation

1. SR-006: one real report generation and a narrative review. This is the most valuable next step. It needs Rory's go-ahead on cost.
2. SR-007, SR-008, SR-009: prompt template changes. Do them together, then re-check against real output from step 1.
3. SR-011, SR-012: generation lifecycle (keep, stream, partial retry).
4. SR-013, SR-014: product decisions on default length, hedging and cost display.
5. SR-017, SR-018, SR-016.

Branch `claude/site-report-review-20261119` at `52b77266` plus this record. It could not be pushed from this session (repository not authorised for push); a patch was handed to Rory instead. Issue #35 is not yet updated.

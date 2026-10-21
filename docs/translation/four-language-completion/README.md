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

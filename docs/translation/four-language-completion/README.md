# Four-language completion

Requested by Rory on 21 October 2026. **In progress, not complete.**

Targets: isiZulu (`zu`), Sesotho (`st`), Xitsonga (`ts`), Tshivenda (`ve`). The source is English.
The app also offers other languages; this goal does not remove them.

## Evidence and current batch

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

## Remaining work

1. Finish shared app chrome: Settings, onboarding, updates, account, common dialogs, accessibility
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

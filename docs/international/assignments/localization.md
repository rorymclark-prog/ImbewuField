# AGY lane: country-independent localization foundation

Read [the common work order](../AGY-WORKORDER-2026-11-01.md) and local `AGENTS.md`.
Work only in `/Users/roryclark/ImbewuField-tokens/agy-global-localization`
on `codex/agy-global-localization`, baseline `0f34e304344a5e9d1c59f539d1187bd6a2b8d491`.
Assigned model: Flash High. Codex launches the installed CLI.
Status path: `docs/international/AGY-STATUS-localization.json`.

## First concrete milestone

Create typed language/locale metadata and source-paired draft message records.
Add a small executable coverage/fallback evaluator and a test showing that a
missing or changed source message cannot be reported as a reviewed translation.
Then add the four requested draft languages and meaningful review tooling.

## Deliverables

1. Reusable code under `lib/international/locales/**` for language metadata,
   source-paired draft messages, coverage, fallback and human-review state.
2. French, Spanish, Portuguese and Swahili draft dictionaries for a bounded,
   explicitly listed set of existing interface messages. Preserve source text/key,
   translator provenance and review status; label drafts as unreviewed.
3. Executable coverage reporting and tests for missing/stale source bindings,
   fallback, placeholder agreement, plural forms, number/date formatting and RTL.
4. A useful review route under `app/international/locales/**` if feasible, with
   language selection, paired source/draft text and clear coverage/review states.
5. Audit of current language, country, units, currency, dates, offline behavior
   and report/export surfaces, plus an exact proposed integration patch.
6. Evidence notes, release-note draft, status and reviewable PR.

## Existing authorities to inspect, not rewrite

Start with `lib/i18n.tsx`, `lib/i18n-context.ts`, `lib/i18n-sync.ts`,
`lib/locales/**`, `lib/records-months.ts`, `lib/number-format.ts` if present,
`lib/invoice-document.ts`, `lib/invoices.ts`, `lib/report-*.ts` and offline modules.
Use `rg --files` to locate the actual number/date/report helpers before proposing code.
Do not edit existing global language types, navigation, lesson translations,
course bodies, quizzes, calibrated SA copy, sync or offline infrastructure.
The coordinator owns integration into the existing app; provide exact touched
paths and migration/compatibility implications in the proposed patch document.

## Required distinctions

A language can be used in many countries; a country can use many languages.
Do not choose a country solely from French, Portuguese, English or Swahili.
Keep language tags separate from optional formatting locale and jurisdiction.
Machine/draft translation, coverage and fluent human review are different states.
Retain English/source fallback explicitly; never count fallback as translated.
Source text changes must invalidate or flag the paired draft for re-review.
Preserve interpolation tokens and plural rules rather than concatenating grammar.
Use public documented locale conventions; identify runtime fallback limitations.

Currency follows the transaction's recorded denomination, not the display language.
Existing rand amounts remain rand; never change a symbol to simulate conversion.
Do not total mixed currencies or assume exchange rates from a language/country code.
Unit conversion requires an explicit quantity/unit contract; localized labels alone
do not convert hectares, acres, kg, packs, litres or temperature scales.
Use safe synthetic examples and avoid changes to real transaction storage.
Do not invent universal translated crop names; keep scientific/common-name
mapping out of scope unless there is actual locale-specific evidence and approval.
RTL fixtures must test direction/isolation behavior without pretending an RTL
language is among the four reviewed dictionaries or altering existing lesson bodies.
Do not claim a translated PDF or offline experience from a dictionary-only test.

## Acceptance checks

Tests must catch a missing key, stale English source, removed placeholder,
plural-category gap, invalid locale and fallback being counted as reviewed.
Include decimal/grouping, date-order and RTL fixtures using deterministic inputs.
Test that display-language changes preserve a synthetic transaction's currency
and prevent an unqualified mixed-currency total in any new helper.
Report actual runtime/ICU fallback if a locale is unavailable.
Inspect the review interface on a narrow viewport and one supported dark theme;
report any missing access honestly. Use port 4251 only if needed.

Write `docs/international/AGY-LOCALIZATION-EVIDENCE.md`,
`docs/international/AGY-INTEGRATION-localization.md` and
`docs/international/AGY-RELEASE-NOTES-localization.md`.
Run typecheck, owned tests and whitespace checks, then complete the common handoff.
The result is executable draft-review infrastructure, not a claim that all app
screens, farming advice, reports or lessons are ready in four new languages.

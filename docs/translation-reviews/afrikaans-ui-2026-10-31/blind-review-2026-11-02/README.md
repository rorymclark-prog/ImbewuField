# Blind back-translation review, 2 Nov 2026: scale exercise, prepared example and tour disclosure

Follows the method of `../blind-review-2026-11-01/`. Scope: the newest small Afrikaans machine drafts.

| Source | Rows |
|---|---|
| `lib/locales/af-inline/g52-ui-gaps-3.ts` (Design scale exercise notice and diagram text) | 4 |
| `lib/locales/af-inline/g53-prepared-example.ts` (prepared-example scope note, AI-report language notice) | 2 |
| `lib/locales/af-inline/g43-notices.ts`, the tour disclosure ("Unreviewed Afrikaans draft: titles, tasks and tips ...") | 1 |

## Method
1. A script extracted the Afrikaans values alone (row number and Afrikaans, no English key).
2. An English back-translation was written for every row before the keys were opened.
3. The two were joined and each row got a verdict: ok, minor (understandable, left as is) or repair. The join script also
   checked that `{placeholders}` and digits match the English and that the shards hold exactly the text recorded.

The reviewer is a model, not a fluent speaker. These drafts remain unreviewed machine drafts; "ok" means no meaning error
was found.

## Result: 5 ok, 2 minor, 0 repair
`review.csv` lists all 7 rows with columns file, english, afrikaans_before, back_translation, verdict, afrikaans_after, note.

## Checked and kept (caveats stay strong)
- "Dit is nie aanbevole bedding- of toegangswydtes nie": negation over both bed and access widths intact.
- "SLEGS MODEL · nie terreinmetings nie": "only" and the negation intact.
- Prepared-example note: "Dit is nie 'n volledige terreinassessering, ontwerpverslag of bewys van vordering nie. Geen nuwe
  AI-ontleding nie." keeps all three negations and the "no new AI analysis" line. Pinned in
  `tests/report-summary-localization.test.ts`.
- AI-report notice: "Dit is nie deur 'n vlot spreker hersien nie; kontroleer syfers teen die Engelse bron" keeps the
  unreviewed caveat and the check-against-English instruction. `{language}` and `{width}` intact.
- Tour disclosure: "konsep" here means the draft the English says ("draft"), not a concept; "Onhersiene" and the need for a
  good Afrikaans speaker who knows the app are kept.

## Minor, left as drafted
- "bedding-" in "bedding- of toegangswydtes" follows the app's existing "Bed" = "Bedding" draft, but "bedding" also means bed
  linen; a fluent reviewer should decide on "bed" / "bedde" across the app.
- "gestoorde" for "saved" and "volledige" for "comprehensive" are acceptable, not exact.

## Tests
`node --import ./tests/register-alias.mjs --test tests/af-inline.test.ts tests/report-summary-localization.test.ts`: 28 pass, 0 fail. No test expectation changed. `git diff --check` is clean.

# International locale foundation evidence — 1 November 2026

Executor: **Codex delegated agent**. AGY did not implement this lane. The prepared
head is `49539001709c2322c72543934591e08a806f0fce`, a docs-only child of the
production baseline `0f34e304344a5e9d1c59f539d1187bd6a2b8d491`.

## Delivered scope

The review inventory is the exact 32-key list in
`lib/international/locales/source.ts`. Its source is existing explicit `T_en`
properties in `lib/i18n.tsx`: language choice, navigation, place controls,
completion status/interpolation and the photo count. It excludes farming
instructions, species names, lessons, legal consent, financial advice and reports.

Four dictionaries contain 128 source-paired AI drafts: French, Spanish,
Portuguese and Swahili. Every record says `unreviewed`; no fluent human approval
is claimed. Portuguese uses European Portuguese preferences. The other dictionaries
also need regional wording review; a language tag is not a jurisdiction.
English bindings are stored independently in each draft so updating the inventory
cannot silently rebind old translations. Human-review evidence additionally binds
the actual draft text and plural forms, preventing a later edit inheriting approval.

The plural example adapts the existing `reportPhotosCount` source, `{n} photos`,
into whole singular/plural draft templates. It does not change the existing app's
English grammar. All plural categories required by the selected runtime are checked,
including `many` where ICU requires it. No new language is enabled in the app.

## Executable tooling

`coverage-cli.mjs` reads and parses the actual `T_en` source using the existing
TypeScript dependency; it does not execute the React provider or accept a saved
English snapshot as proof of current coverage. Its extraction is deliberately
bounded to explicit literal properties. A future inventory item sourced from a
spread/computed expression is reported missing until the reader is extended.
The review route uses the actual exported `T_en` dictionary instead.

Run from this worktree with Node 24:

```sh
node --import ./tests/register-alias.mjs lib/international/locales/coverage-cli.mjs --json
```

Default CLI success means structural/source validity, not human review. Add
`--require-reviewed` for a release gate: it currently exits 1 because the drafts
have zero human-reviewed coverage. Reports separate draft, reviewed, stale,
missing draft, missing source and invalid states. English fallback is never counted
as translated or reviewed. Unknown keys outside this inventory are out of scope.

`resolveMessage` keeps unreviewed messages in current English unless draft preview
is explicitly requested. Missing interpolation values remain visible as tokens
with an issue; zero values remain valid. Interpolated values receive directional
isolation. This is a small named-token contract, not an ICU MessageFormat parser.

The formatting helpers report requested and actually resolved number/date/plural
locales. Invalid tags and unavailable ICU support produce explicitly labelled
English formatting. Calendar dates are validated and formatted in UTC to preserve
their day. Number formatting does not parse localized user input or convert units.
Currency display uses the recorded three-letter denomination and prints its code.
Code shape validation is not a current ISO currency registry or legal validation.
Mixed currencies return separate subtotals with no combined total or exchange rate.
These synthetic helper examples do not migrate real financial data or provide
accounting precision/rounding rules.

## Existing-system inspection

| Surface inspected | Actual current behavior | Integration implication |
| --- | --- | --- |
| `lib/i18n.tsx` | Eleven app language choices; English eager, ten dictionaries loaded asynchronously. `translate` returns dictionary value, then English, then key. | A returned string alone cannot distinguish translated coverage from English fallback. Keep status available separately. |
| `lib/i18n-context.ts`, `lib/i18n-sync.ts` | Language context and change events carry a string. | Do not insert country, currency or formatting preferences into that string. |
| `lib/locales/**` | Existing SA language dictionaries are separate from this lane. | Preserve their wording and review history. |
| `lib/i18n.tsx` persistence | `permamap_lang` is a device localStorage preference; onboarding uses an account-scoped key. | Any preference migration needs an explicit compatibility/account decision; this lane adds no storage. |
| `lib/records-months.ts` | Localized month words for zu/st/ve/ts retain the existing date shape and raw stored dates; regional draft caveats are documented there. | A new formatting locale must not silently reinterpret stored dates or treat new Intl output as reviewed month translation. |
| `lib/format-figures.ts` | Deterministic plain-space number grouping, rand helpers and kg helpers deliberately avoid hydration/paste regressions. | Preserve these core conventions until a coordinated presentation migration is tested. |
| `lib/invoice-document.ts`, `lib/invoices.ts` | Existing invoices use explicit rand formatting and English/isiZulu document copy; the current invoice amount contract is not a multicurrency ledger. | Historical amounts must keep ZAR semantics. Language selection must never replace `R` with a different currency symbol. |
| `lib/report-localisation.ts`, report modules | Report wording has a separate source-paired localization authority. | These 32 UI messages do not translate reports or validate international agricultural claims. |
| `lib/report-pdf-font.ts` | Bundled Noto Sans fonts support existing document needs without a font request. | Font availability alone does not prove new PDF text layout, shaping, wording or accessibility. |
| `lib/offline-pack.ts`, `lib/offline-cache.ts` | Course assets, narration choices and download outcomes have existing explicit contracts. | A dictionary or successful browser render is not proof that this new review route is cached or that four-language lessons exist offline. |

Country and units were not changed. Existing South African crop-calendar, climate,
price and species authorities remain in place. This review route cannot certify
country support, crop suitability, plant legality or a worldwide crop engine.

## Primary documentation verified

Accessed **1 November 2026**, full pages opened through the connected web tool:

- [ECMA-402 internationalization specification](https://tc39.es/ecma402/), including
  NumberFormat and PluralRules sections: runtime locale negotiation, formatting
  and plural APIs. Used for the software contract, not as a claim that all hosts
  ship the same ICU data. Number/date/plural actual resolution is exposed.
- [Unicode UAX #9](https://www.unicode.org/reports/tr9/): directional isolation
  and mixed-direction text. Used for plain-string isolate controls.
- [W3C inline bidirectional markup guidance](https://www.w3.org/International/articles/inline-bidi-markup/):
  explicit directions and isolated runtime phrases. The review route uses `bdi`
  and a synthetic RTL fixture; no Arabic dictionary readiness is claimed.

No external translation service, outreach, account, legal acceptance or paid
generation was used. Draft wording was authored by the Codex delegated agent.

## Verification record

Node 24 binary available and verified: **v24.22.2**. Integrated commands/results are recorded in
[INTEGRATION-REVIEW.md](INTEGRATION-REVIEW.md). Owned tests exercise source mutation,
missing keys, removed/extra/repeated placeholders, plural gaps, explicit fallback,
review-text invalidation, formatting, date order, RTL controls, recorded currencies,
mixed-currency refusal, the executable report and real rendered review interactions.

Visual review remains with the coordinator: open `/international/locales` at a
narrow phone viewport and in a supported dark theme. Check readable paired source
and draft cards, count/locale controls, long text wrapping, status notices and the
RTL fixture. A React interaction test is not a screenshot or visual verification.
This lane has not run a production build, full-suite CI or a live offline/PDF check.

# Blind back-translation review — 1 November 2026 (batch b): report shards g46–g49

Follows the method of `../blind-review-2026-11-01/` (see its README and `../priority-review/REVIEW-BRIEF.md`).
Scope: the Afrikaans machine drafts for the report-preparation checklist, the MEL evidence report, the staff
(facilitator) reports and the mentor field report.

| Source | Rows |
|---|---|
| `lib/locales/af-inline/g46-report-preparation.ts` | 41 |
| `lib/locales/af-inline/g47-mel-report.ts` | 188 |
| `lib/locales/af-inline/g48-staff-reports.ts` | 56 |
| `lib/locales/af-inline/g49-field-report.ts` | 109 |
| **Total** | **394** |

## Method
1. A small script extracted the Afrikaans values alone (row number and Afrikaans, no English key).
2. An English back-translation was written for every row before the English key was opened.
3. The back-translations were joined to the keys and each row got a verdict: ok, minor (understandable, left as
   is) or repair (meaning, term or reading changed, or a farmer could misread it).
4. Repairs were applied in the shards (keys untouched). A script checked that every `{placeholder}`, digit and
   symbol (`|`, `→`, `·`, `m²`, `%`) in the Afrikaans equals the English, before and after.

The reviewer is a model, not a fluent speaker. These drafts remain unreviewed machine drafts; "ok" means no
meaning error was found.

## Result: 364 ok, 9 minor, 21 repair

| File | ok | minor | repair |
|---|---|---|---|
| g46 | 40 | 1 | 0 |
| g47 | 172 | 5 | 11 |
| g48 | 55 | 1 | 0 |
| g49 | 97 | 2 | 10 |

`review.csv` lists all 394 rows with columns file, english, afrikaans_before, back_translation, verdict,
afrikaans_after, note. No evidence-limit caveat ("does not establish / infer / prove", "must not be added",
"before claiming adoption") was found flipped or dropped, and no money/quantity, visits/unique-people or
observed/self-reported confusion was found, apart from the items below.

## Repairs
- "Uses information saved on this device (on {date})" and "Includes device-saved changes ..." began with a bare
  imperative ("Gebruik ...", "Sluit ... in"), which reads as an instruction to the farmer; now "Dit gebruik ...",
  "Dit sluit ... in". Same for the cutoff note "Uses the latest corrected observation histories" (120).
- Scores read as counts or points: "self-reported score" ("selfgerapporteerde telling" now "puntetelling"),
  "ordinal scores", "ordinal confidence score", "impact score" ("impakpunt"), "compliance score"
  ("nakomingspunt"), "sustainability-score" ("volhoubaarheidspunte") are now "-puntetelling(s)".
- "tree follow-ups" was "boomopvolge", which reads as ecological tree succession; now "boomopvolgkontroles".
- "Assigned people visited" (and "Current assigned people visited") was "Toegewysde mense besoek", which reads as
  a present-tense verb (the people visit); now "Toegewysde mense wat besoek is".
- "due or overdue" on actions used "verskuldig", which reads as money owed; now "met sperdatum op of voor {today}"
  and "waarvan {due} se sperdatum bereik of verby is" (sperdatum is the app's word for a due date).
- "No recorded visit does not establish that no support happened elsewhere" was "Geen aangetekende besoek bewys
  nie dat ...", which can be parsed as "no visit proves"; now "Die afwesigheid van 'n aangetekende besoek bewys
  nie dat ...", so the evidence limit is unambiguous.
- Mentor team "guidance" (heading, note, column, empty state, and the pointer in the training note) was
  "leiding"/"spanleiding", which reads as leadership; now "riglyne" ("Huidige riglyne vir die span").
  The term comment at the top of g49 was updated to match.

## Minor items left unchanged
"bepaal nie" (determine) for "does not establish" (g46 fence line); "algemene welsyn" for "Common-good
contribution"; "Afsonderlike huishoudings" for "Distinct households" (unieke would be stricter); "Grondbesit"
(ownership) for "Tenure"; "verhaal" for "narrative"; "Dienspunt" for "Service location"; "Toets" (test) for "Check
a named practical skill". "Kaart" appears only in "ontwerpkaart"/"kaartblaaie" where a map is meant; "konsep" is
the app's word for draft. A fluent reviewer should settle these.

## Tests
No test expectation changed (no test pins the repaired Afrikaans text). `node --import ./tests/register-alias.mjs
--test tests/af-inline.test.ts tests/mel-report.test.ts tests/staff-report.test.ts tests/field-api-core.test.ts
tests/field-programmes-i18n.test.ts tests/report-preparation-localization.test.ts`: 71 pass, 1 fail — the known Node 22
`ERR_INVALID_RETURN_PROPERTY_VALUE` real-panel test (`report-preparation-localization.test.ts`, "the real
preparation panel follows app language ..."), which fails in the loader hook before reaching any Afrikaans text.
`git diff --check` is clean.

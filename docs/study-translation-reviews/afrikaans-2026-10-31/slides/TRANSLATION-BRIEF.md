# Afrikaans Studies slide cards — narration drafts

ImbewuField's Studies modules each have a "Watch and listen" deck: numbered slides, each with a
heading and a few short paragraphs (the narration a farmer reads or hears). We are making Afrikaans
slide cards: each card shows your Afrikaans draft above the exact English, labelled as an unreviewed
AI draft. Work in `/home/user/ImbewuField-af`.

## Read first
1. `/tmp/claude-0/-home-user-ImbewuField/e2fbcdd9-55cd-53bd-a360-76840c1887f1/scratchpad/af/AF-BRIEF.md`
   (faithfulness rules and glossary).
2. The same modules' Afrikaans lesson text, which the narration often repeats — reuse its wording and
   terms where the English matches: `docs/study-translation-reviews/afrikaans-2026-10-31/drafts/<module>.json`.

## Your files
For each module, `docs/narration/<module>.af.silent-draft.json` already exists as a skeleton: every
slide has `english` (the source — never change it) and `target` with `heading.text` and one
`body[i].text` per English paragraph, all empty. Fill every `text` with the Afrikaans for the matching
English (heading → heading, paragraph i → paragraph i). Keep `status: "draft"`, keep the JSON layout
(2-space indent, file ends with `}` and a newline). Building the file with a small script is fine, but
every string must be your own careful translation.

Rules specific to slides:
- Plain spoken Afrikaans a farmer understands when read aloud; short sentences; "jy/jou".
- Every number, measurement, unit, rand amount, percentage and time span survives exactly (digits as
  digits). Keep negations, warnings ("do not…", "never…"), conditions and limits exact — these are
  farming-safety instructions (frost, livestock health, seed storage, water, pests, chemicals).
- Plant and animal names: keep them as the English writes them unless it is a plain everyday crop word
  (as in the lesson drafts). Never swap one species for another.
- Headings are short titles (sentence case).
- If you truly cannot translate a paragraph safely, leave it, and list it in your report.

## Validate
`cd /home/user/ImbewuField-af && node --import ./tests/register-alias.mjs /tmp/claude-0/-home-user-ImbewuField/e2fbcdd9-55cd-53bd-a360-76840c1887f1/scratchpad/af/decks/check.mjs <module> ...`
must print OK for every module.

Edit only your modules' `docs/narration/<module>.af.silent-draft.json`. No git commands. Report: per
module slides done, anything left untranslated (with reasons), and up to 5 renderings you are least
sure of.

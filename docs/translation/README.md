# isiZulu translation hand-off

`pending-isizulu.csv` in this folder lists every English string in the app's UI dictionary that is
still waiting on a reviewed isiZulu translation — every key spread from a `*_ENGLISH_PENDING`
dictionary in `lib/i18n-pending.ts` (`DESIGN_STUDIO_ENGLISH_PENDING`, `JOURNAL_ENGLISH_PENDING`,
`LIMA_ENGLISH_PENDING`, `MENTOR_ENGLISH_PENDING`, and any added later). These are keys the app
currently shows in English to every language, including isiZulu, because nobody has coined or
reviewed an isiZulu translation for them yet.

## Columns

- `group` — which `*_ENGLISH_PENDING` dictionary the key comes from (its export name with the
  `_ENGLISH_PENDING` suffix removed), so a translator can work through one screen area at a time.
- `key` — the dictionary key, exactly as it appears in `lib/i18n-pending.ts` and as used by `t(key)`
  in the app's components.
- `english` — the current English text. `{likeThis}` tokens are placeholders the app fills in at
  render time (a count, a name, a date) — keep them in the translation, unchanged, wherever the
  sentence needs them.
- `isizulu` — empty. This is what a translator fills in.

Open the file in Google Sheets (or Excel/LibreOffice) to translate it like any spreadsheet.

## Regenerating the CSV

Whenever `lib/i18n-pending.ts` changes (a key is added, removed or its English text edited), run:

```
npm run i18n:pending
```

This rewrites `docs/translation/pending-isizulu.csv` from the current dictionaries. Commit the
regenerated file — `tests/pending-translations-csv.test.ts` fails the build if the committed CSV
drifts out of date with `lib/i18n-pending.ts`.

Regenerating never touches the `isizulu` column's *content* for you — it always writes a fresh
empty column. If a translator has already started filling in isiZulu text in a working copy of the
sheet, keep that copy separate from this repo's tracked CSV until you are ready to bring the
translations back in (see the next section) — running `npm run i18n:pending` again will overwrite
`docs/translation/pending-isizulu.csv` with blanks.

## Bringing a filled-in isiZulu column back into the app

Once a fluent isiZulu speaker has filled in the `isizulu` column (leaving a row blank means "not
translated yet, still show English" — never guess or machine-translate a blank):

1. Export the filled-in sheet back to CSV (or open the tracked CSV in Sheets, paste the isiZulu
   column in, and re-download it) so you have `key → isizulu` pairs to work from.
2. Open `lib/locales/zu.ts`.
3. For each translated row, add or update an entry keyed by that exact `key`, with the isiZulu text
   as its value: `mentorSaveVisit: 'Gcina ukuvakasha',`. This overrides the English fallback that
   `zu.ts` inherits from spreading the pending dictionary — see that file's own top-of-file spreads
   (`...DESIGN_STUDIO_ENGLISH_PENDING`, `...MENTOR_ENGLISH_PENDING`, etc.) for how the fallback
   works before you add an override.
4. Leave the key in its `*_ENGLISH_PENDING` dictionary in `lib/i18n-pending.ts` untouched — that
   dictionary is what every *other* locale still falls back to. Only `zu.ts` gets the override.
5. Run `npx tsc --noEmit` and the locale/i18n tests (for example
   `node --import ./tests/register-alias.mjs --test tests/lang-coverage.test.ts`) before
   committing.
6. You do not need to regenerate `pending-isizulu.csv` for this step — the CSV tracks the English
   source text, not translation progress. It only needs regenerating when the English dictionaries
   themselves change.

A key never needs to move out of `pending-isizulu.csv` once it has an isiZulu override — the sheet
is a hand-off of English source text, not a translation-progress tracker, and a key can pick up
overrides for some locales while other locales still show the pending English.

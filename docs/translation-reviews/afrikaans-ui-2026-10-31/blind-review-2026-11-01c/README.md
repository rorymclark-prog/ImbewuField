# Blind back-translation review, 1 Nov 2026 (batch c): UI gaps shard

Follows the method of `../blind-review-2026-11-01/` and `../blind-review-2026-11-01b/`.
Scope: the Afrikaans machine drafts for the English gaps found in the 1 Nov browser check (Farm memory journal controls,
programme record cards on /funder and /ngo, the two /samples/farm photo captions, the site-report contents heading).

| Source | Rows |
|---|---|
| `lib/locales/af-inline/g50-ui-gaps.ts` | 83 |

## Method
1. A script extracted the Afrikaans values alone (row number and Afrikaans, no English key).
2. An English back-translation was written for every row before the keys were opened.
3. The two were joined and each row got a verdict: ok, minor (understandable, left as is) or repair.
4. Repairs were applied in the shard (keys untouched). A script checked that `{placeholders}`, digits, `R/m²`, `·` and `…`
   match the English before and after.

The reviewer is a model, not a fluent speaker. These drafts remain unreviewed machine drafts; "ok" means no meaning error
was found.

## Result: 80 ok, 2 minor, 1 repair
`review.csv` lists all 83 rows with columns file, english, afrikaans_before, back_translation, verdict, afrikaans_after, note.

## Repair
- `{n} enrolled farmers are withheld from the portfolio for consent.`: "weens toestemming" is "because of consent", which
  does not say consent is missing, so a funder could read it as the reverse. Now "weens ontbrekende toestemming".

Checked and kept: "Foto's alleen meet nie groei nie en bewys nie 'n opbrengs nie" (both negations present); "Konsep uit jou
gewasplan ... Dit teken nie 'n oeshoeveelheid aan nie en merk nie die taak as voltooi nie" (Konsep = draft, both negations
present); "dit bewys nie voortgesette deelname nie"; "dekking is nie die projek se totale bereik nie"; "daardie verhoudings
word nie hier bereken nie"; the offline-storage warning ("Hierdie notas bly op hierdie toestel. Hou 'n kopie voordat ...").
No "verskuldig" appears; no due date is drafted in this shard.

## Minor, left as drafted
"Teken aan wat jy gepluk het" (picked) matches the English "picked", though "oes" is the usual harvest word;
"rekords, wie se verslagtydperke ..." uses "wie se" for things where "waarvan die" is more natural.

## Tests
No test expectation changed. `node --import ./tests/register-alias.mjs --test tests/af-inline.test.ts
tests/farm-memory-copy.test.ts tests/farm-memory-ui.test.ts tests/programme-evidence.test.ts`: 46 pass, 0 fail.
`git diff --check` is clean.

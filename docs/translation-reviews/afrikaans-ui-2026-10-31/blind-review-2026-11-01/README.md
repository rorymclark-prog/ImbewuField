# Blind back-translation review — 1 November 2026 Afrikaans drafts

Follows the method of `../priority-review/` (see `../README.md` and `../priority-review/REVIEW-BRIEF.md`).
Scope: the Afrikaans machine drafts added on 1 November.

| Source | Rows |
|---|---|
| `lib/locales/af-inline/g44-records-book-rows.ts` (money book) | 464 |
| `lib/locales/af-inline/g45-site-report.ts` (site report) | 389 |
| `lib/update-copy-locales/af.ts` (last 5 entries: harvest-target release notes) | 5 |
| **Total** | **858** |

## Method
1. The Afrikaans values alone were extracted to batch files of 100 (index and Afrikaans only, no English).
2. An English back-translation was written for every batch before the English key was opened.
3. Each back-translation was then compared with the English key and given a verdict:
   ok, minor (understandable, wording could be better, left as is) or repair (meaning, term, number or
   species name wrong, or a farmer could misread it).
4. Every repair was applied in the shard (keys untouched, every `{placeholder}` and digit checked equal to the English).

The reviewer is a model, not a fluent speaker. These drafts remain unreviewed machine drafts; "ok" means
no meaning error was found.

## Result: 816 ok, 18 minor, 24 repair

| File | ok | minor | repair |
|---|---|---|---|
| g44 | 442 | 9 | 13 |
| g45 | 369 | 9 | 11 |
| af.ts release notes | 5 | 0 | 0 |

`review.csv` lists all 858 rows with columns file, english, afrikaans_before, back_translation, verdict,
afrikaans_after, note.

## Notable repairs
- "Card" (payment method next to Cash / EFT) was "Kaart", which reads as a map; now "Bankkaart".
- "Go to sign in" was "Gaan na intekening" (subscription); now "Gaan na aanmelding".
- "Authentication required." was "Verifikasie word vereis."; now "Aanmelding word vereis."
- "In, N months" (cash in) was "Ingekom" (arrived); now "Geld in, N maande".
- "Returns per growing area" and "What your growing space returns" are money, but "Opbrengs" reads as
  crop yield (a separate "Yield" label); now "Geldopbrengs" / "aan geld oplewer".
- "The rands elsewhere on this page" (five orchard-switch-off notes) used "rande" / "randsyfers", which
  read as edges; now "geldbedrae" / "geldsyfers".
- "a month you caught up on later" read as "a month in which you joined later"; now "ingehaal".
- "Concept illustration" was "Konsepillustrasie", which reads as the app's "draft"; now "Konseptuele illustrasie".
- "mulched bed / mulched basin" read as "covered" (bedekte); now "met 'n deklaag". "clumping plant" was "bosplant"; now "klompvormende plant".
- "saplings" (young trees) was "saailinge" (seedlings); now "boompies".
- Species name: "Vetiver Bank" was respelled "Vetiwergrasbank"; now "Vetiver-wal" (species name as in English).
- "discussion date" was "bespreekdatum" (booking date); now "gespreksdatum".
- "jars" was "flesse" (bottles); now "bottels". "Bench" was "Bank" (financial bank); now "Tuinbank".
- "AI" was written "KI"; now "AI" as everywhere else. Typo "vasle" (twice) now "vasstel".

## Minor items left unchanged
Mostly register or near-synonym choices: "Gesamentlik" for Combined, "Binnekort" for Coming up, "Herstel
faktuur" for Recover invoice, "Teken in" for sign in (glossary says "Meld aan"), "Skuur" for Shed,
"Skadudoek" for Shade Sail, "Tarief" for a bill-of-quantities Rate. A fluent reviewer should settle these.

## Tests
No test expectation changed. The 11 affected test files pass (156 tests).

# Afrikaans Permaculture Manual — machine draft notes (31 October 2026)

All 14 chapters (`content/manual/af/`) and the reader UI (`content/manual/af/ui.json`) are unreviewed
Afrikaans machine drafts, served at `/manual/af`. The reader shows the draft notice and a link to the
English chapter. Five model agents translated the chapters against `glossary-af.md` and the house
rules in `STYLE.md`. `tests/manual.test.ts` checks that every chapter keeps the English structure, the
supported Markdown and the Glossary's English word column. Every number in each English chapter was
checked by script to appear in its Afrikaans chapter.

## Decisions for the content owner
- **The 66 Glossary words.** Rory's 26 Sep 2026 rule keeps them in English in every language. Afrikaans
  already has established words for nearly all of them (kompos, erosie, kontoersloot), so the Afrikaans
  chapters use the Afrikaans word, with the English Glossary word in brackets the first time it
  appears in each chapter. "rocket stove" and "wonder bag" stay English, with an Afrikaans gloss.
  The Glossary's Word column stays exactly English (the test requires it). Each meaning starts with
  the Afrikaans chapter word, and the Afrikaans Glossary intro says what Afrikaans does. If English
  should be used throughout instead, the chapters need the KEEP-ENGLISH Part B pass.
- **Decimal separator.** The drafts keep the English decimal point (1.2 m, 0.8). Standard Afrikaans
  writes 1,2 m. Thousands are written with a space (25 000 liter), because "25,000" would read as 25
  in Afrikaans.
- **Times:** 9 vm. / 3 nm.

## Terms for the fluent reviewer first
- **Ethics and principles:** Aardesorg, Mensesorg, Billike Deel; "etiese waardes"; Ligging for aspect.
  Proverbs in 01 translated literally.
- **Pests:** "pes / pesbeheer" follows the app glossary; "plaag / plaagbeheer" may sound more natural.
  Pest names: Afrikaanse bolwurm, diamantrugmot, herfskommandowurm, rooispinmyte,
  knopwortelaalwurms.
- **Crops:** akkerbone (cowpeas), pêrelmanna (pearl millet), giers (millet), duiwe-ertjie, snybeet,
  raapsaad (rape).
- **Wild plants:** species kept in English by rule (Kei apple, sweet thorn, white stinkwood …).
  Where a well-known Afrikaans name exists it is given in brackets in some chapters, not all.
- **Water and earthworks:** poel (pond), afloopkoëffisiënt, afleivoor / afleiwal,
  eerstespoel-afleier, sypelput, vetvanger, flodder (slurry), doeke-water (nappy water). The Studies
  lessons use "luiers" for nappies.
- **Energy:** sonkraggeiser, omsetter, kisstoof, hooikis. "sonkrag-energieverskaffer" (fence
  energiser) is awkward.

## English source questions
- **00-introduction:** the manual is said to be "also in isiZulu, Sesotho, Tshivenḓa and Xitsonga". It
  omits isiXhosa and Afrikaans.
- **South Africa's average rainfall:** 450 mm (01) and 464 mm (03).
- **12-glossary:** "kept in English in every language" is not true of Afrikaans. The Afrikaans
  wording says what Afrikaans does instead.

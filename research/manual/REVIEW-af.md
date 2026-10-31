# Afrikaans Permaculture Manual — machine draft notes (31 October 2026)

All 14 chapters (`content/manual/af/`) and the reader UI (`content/manual/af/ui.json`) are unreviewed
Afrikaans machine drafts, served at `/manual/af`. The reader shows the draft notice and a link to the
English chapter. Five model agents translated the chapters against `glossary-af.md` and the house
rules in `STYLE.md`. `tests/manual.test.ts` checks that every chapter keeps the English structure, the
supported Markdown and the Glossary's English word column. Every number in each English chapter was
checked by script to appear in its Afrikaans chapter.

## Blind back-translation review of the safety sections (`review-af/`)
The 52 sections of chapters 01–11 that carry safety wording were reviewed by three independent model
reviewers. That wording covers poison, children, fire, greywater and blackwater, slaughter, vaccines,
drowning, carbon monoxide, stings and frost. Each reviewer read only the Afrikaans first and wrote a
back-translation, then compared it with the English (`review-af/MANUAL-REVIEW-BRIEF.md`). The rest of
the Manual has only the structure and number checks.
**Result: 8 repairs, 0 holds, all applied.** Four more fixes came out of the same pass.

**Water and sanitation:**
- "nooit bo" (could read "never on top of") became "never higher up the slope than": a pit toilet or
  septic tank (swales), and a well, borehole or spring (greywater).
- Greywater: "doekwater" (cloth water) became nappy water (luierwater), also in chapter 07 and the
  Blackwater glossary entry.
- "Geen poele nie" (no ponds) became "no standing puddles".

**Food safety:**
- "groentetuin" became "any garden where you grow food", for human faeces and pet droppings.

**Earthworks:**
- Pond digging: "so they cannot fall in" became "so the sides cannot collapse".

**Animals and crops:**
- The chicken grit sentence used the crop ("krop") for the gizzard (spiermaag).
- Bird netting: "Span net …" read as "only stretch …".
- The onions-around-carrots line was clarified.

**Principle names:**
- Principle 1 is now "Neem waar en tree in wisselwerking". It had read "observe and exchange".

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
- **04-vegetable-and-staple-crops, frost pockets:** "Leave a gap low down in walls and hedges on the
  uphill side". A gap uphill would let cold air in. The downhill side was probably meant, so the cold
  air drains away.
- **05-animal-systems, pig feed:** "Never give them meat scraps or kitchen waste from other homes …"
  can be read as allowing your own household's meat scraps, which are also an African swine fever risk.
- **07-earthworks-and-water:** greywater is defined as "bath and shower water" in one section, and as
  also hand basins, the washing machine and the kitchen sink in another.
- **11-home-and-appropriate-technology:** "never on morogo you eat raw". Morogo is normally cooked, so
  leafy greens or salads eaten raw were probably meant.
- **00-introduction:** the manual is said to be "also in isiZulu, Sesotho, Tshivenḓa and Xitsonga". It
  omits isiXhosa and Afrikaans.
- **South Africa's average rainfall:** 450 mm (01) and 464 mm (03).
- **12-glossary:** "kept in English in every language" is not true of Afrikaans. The Afrikaans
  wording says what Afrikaans does instead.

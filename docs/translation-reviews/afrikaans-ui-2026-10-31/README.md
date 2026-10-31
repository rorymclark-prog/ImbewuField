# Afrikaans app — machine draft (31 October 2026)

Rory asked for the whole app in Afrikaans after isiXhosa. This record covers the Afrikaans dictionary
(`lib/locales/af.ts`), the English-keyed inline drafts (`lib/locales/af-inline/`), the release notes
(`lib/update-copy-locales/af.ts`) and the Studies lessons
(`docs/study-translation-reviews/afrikaans-2026-10-31/`).

**Status of every string: unreviewed machine draft.** No fluent Afrikaans speaker or local farming
reviewer has checked any of it. Each Afrikaans screen says so, and English source lines sit beside the
drafts wherever isiXhosa shows them.

## Drafting
Drafted by model agents against one glossary and rule set (`DRAFTING-BRIEF.md`). Script checks: every
`{placeholder}` and number matches the English, no draft is blank, and every key is English a source
file still shows (`tests/af-inline.test.ts`).

## Priority review: safety, money and consent (`priority-review/`)
The 1,936 drafts whose English is safety, money or consent text were split into six packets
(`pN.meta.json` maps each index to its dictionary key or inline English). Six independent model
reviewers each read only the Afrikaans first and wrote a literal English back-translation
(`pN.backtranslation.txt`), then compared it with the English and recorded real problems
(`pN.review.json`, brief in `REVIEW-BRIEF.md`).

**Result: 1,891 ok, 44 repairs, 1 hold.** All 44 repairs ship. Examples:
- A roof-area hint invented house sizes (60 / 100 / 150 m²) and dropped "leave this blank if you do not know".
- A roof-area label asked for the building's floor area instead of the roof seen from above.
- "Assumes light frost" read as "tolerates light frost"; "Rysvry" (rice-free) for frost-free.
- "Assumed sale" in a cash forecast read as "accepted sale".
- "Withdrawn" consent and "Reviewed for funder sharing" read as buttons, not states.
- "Do not clear site data" pointed at farm-site data instead of the browser's stored data.
- "Save sale & invoice" dropped "& invoice"; "redacted" read as "edited".

The hold (p5 #319, `mentorZuluDraftNotice`) needs no change: like isiXhosa, the `*ZuluDraftNotice`
keys name the locale's own language.

## Fluent-review hand-off
`fluent-review-handoff-2026-10-31.csv` lists every Afrikaans draft beside its English, ordered
safety → money → consent → other. It covers 11,851 rows: dictionary, inline drafts, release notes and
Studies lessons. The `model_review` column says whether the blind model review checked a row, and
whether it repaired it. A fluent reviewer fills in `fluent_reviewer_verdict` (ok / fix / hold) and
`fluent_reviewer_correction`.

## Honest limits
- Drafters and reviewers are models. "Checked" means no meaning error was found, not that the wording
  is natural or in a South African farming register.
- Only the safety, money and consent drafts had the blind review; the remaining ~8,000 strings have
  only the script checks.
- Terms a fluent reviewer should settle first: "weergawe" for a paid map render, "Kieslys →
  Terreinverslag" for both Reports and Site reports, "land" for field, "toestemmings vir deel"
  (clashes with consent), the course module short names, decimal comma vs point, and species and
  pest names kept in English by rule (e.g. Nastergal, boerbone, Snybeet in older strings).

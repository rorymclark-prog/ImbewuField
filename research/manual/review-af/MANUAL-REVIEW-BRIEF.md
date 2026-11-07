# Blind back-translation review — Afrikaans Permaculture Manual (safety sections)

The Afrikaans Manual chapters are unreviewed machine drafts of English. You review the sections that
carry safety wording (poison, children, fire, greywater and blackwater, slaughter, vaccines, drowning,
carbon monoxide, stings and bites, frost, "never"). Find drafts that would **mislead or endanger a
farmer**: a dropped or flipped negation, a softened warning, a lost condition or limit ("only",
"never", "before", "unless"), a wrong quantity, time or term (another plant, animal, pest, disease or
chemical), or Afrikaans unclear enough to misread. Not style preferences. Never change or add a species
name; invent no numbers. Decimal points staying as in English is a known open decision — do not flag it.

Directory: `/tmp/claude-0/-home-user-ImbewuField/e2fbcdd9-55cd-53bd-a360-76840c1887f1/scratchpad/af/manual-review/`
(below `REVIEW/`); your packet is `MN`.

1. Read `REVIEW/../AF-BRIEF.md` and `/home/user/ImbewuField-af/research/manual/glossary-af.md`.
2. **Blind step:** read only `REVIEW/MN.af.md` (sections separated by `=== SECTION <id> ===`) and write
   `REVIEW/MN.backtranslation.md`: a literal English back-translation of every section, same layout.
   Do not open `MN.en.md` until it is finished.
3. **Compare:** read `REVIEW/MN.en.md` and compare section by section.
4. Write `REVIEW/MN.review.json`:
```json
{ "unit": "MN", "sectionsReviewed": 0,
  "items": [ { "section": "07-earthworks-and-water#4", "verdict": "repair",
    "english": "the English sentence(s)", "afrikaansBefore": "exact text copied from MN.af.md",
    "afrikaansAfter": "the corrected Afrikaans", "problem": "one sentence: what a farmer would get wrong" } ] }
```
   `afrikaansBefore` must be an exact, unique substring of that section in `MN.af.md` (a whole sentence
   or list item is best) so it can be replaced mechanically; keep Markdown markers (`**`, `- `, `> `,
   `|`) as they are. `afrikaansAfter` keeps every number. Use verdict `hold` (with `afrikaansAfter: ""`)
   only when no safe correction is possible.

Write only inside `REVIEW/`; no repository or git changes. Final message: sections reviewed, repair and
hold counts, the three most serious problems, and any problems in the English source.

# Permaculture Manual — working brief

Source: `research/manual/rvcc-handbook-source.txt` (git-ignored working copy; the original is
Drive file `1C_KhxUhz5SVTEn3WeXr_6ZQ-cGd2VndG`, extracted from `The_RVCC_Permaculture_Gardening_Handbook.pdf`) — *The Permaculture Gardening Handbook*,
compiled by Rory Clark for the UNDP/Government of Lesotho RVCC permaculture project (2020–21).
Parts are adapted from the African Conservation Trust's *Introduction to Permaculture and
Homestead Gardening* (2014). In the file, the printed page number = the `===== page N =====`
marker minus 1.

The app reader (`/manual`, `app/manual/`, renderer `lib/manual.ts`) shows one chapter at a time, in English, isiZulu, Sesotho,
Tshivenḓa or Xitsonga.

## Chapters (slugs are fixed — every language uses the same file names)

| # | Slug | Source section | Source lines |
|---|---|---|---|
| 0 | `00-introduction` | Introduction | 175–215 |
| 1 | `01-what-is-permaculture` | Section 1 — definitions, benefits, ethics, 12 principles | 216–884 |
| 2 | `02-planning-your-farm` | Section 2 — site assessment, zones, slope | 885–1147 |
| 3 | `03-sector-planning` | Section 3 — wind, fire, sun, climate, water, climate change | 1148–1685 |
| 4 | `04-vegetable-and-staple-crops` | Section 4 — kitchen, vegetable, commercial, staple gardens | 1686–1926 |
| 5 | `05-animal-systems` | Section 5 — animal tractors, chickens, ducks, bees | 1927–2682 |
| 6 | `06-tree-systems` | Section 6 — food forest, windbreaks, planting a tree | 2683–3779 |
| 7 | `07-earthworks-and-water` | Section 7 — rainwater, sand dams, ground prep, beds, irrigation, greywater | 3780–5229 |
| 8 | `08-soil` | Section 8 — soil types, soil audit, green manure, manure, mulch, compost, worms | 5230–6033 |
| 9 | `09-balanced-ecology` | Section 9 — ecosystems, succession, habitat, biodiversity | 6034–6361 |
| 10 | `10-natural-pest-control` | Section 10 — pests, predators, companion planting, sprays, rotation | 6362–7181 |
| 11 | `11-home-and-appropriate-technology` | Section 11 — Zone 0, solar, wonder bag, rocket stove, biogas | 7182–end |

Files:
- English (fact-checked, improved): `content/manual/en/<slug>.md`
- Fact-check log (English only): `research/manual/factcheck/<slug>.md`
- Translations: `content/manual/{zu,st,ve,ts}/<slug>.md`
- Reader UI strings: `content/manual/<lang>/ui.json` (English is the reference; keep `{n}`)
- Glossaries: `research/manual/glossary-{zu,st,ve,ts}.md`

## Reader & audience

Smallholder and homestead farmers in South Africa (also useful in Lesotho, Eswatini and
Zimbabwe), NGO field staff, mentors and students. Many read English as a second language and
read on a phone. Write for them: short sentences, everyday words, one idea per paragraph,
steps as numbered lists. Explain a technical word the first time it appears.

## What "fact-check and improve" means

1. **Check every factual claim** — numbers, dates, species, quantities, ratios, distances,
   temperatures, safety advice. Use WebSearch/WebFetch for anything you are not sure of, and
   prefer South African sources (ARC, DALRRD, SANBI, SAWS, Water Research Commission,
   Department of Forestry, Fisheries and the Environment, universities) or FAO.
   Correct what is wrong, and remove what cannot be supported rather than guess.
2. **South African context.** The source was written for Lesotho. Make it Southern-African:
   say "South Africa" / "Southern Africa" where the advice is general; keep a Lesotho example
   only where it is labelled as such and still useful. Rainfall, seasons and planting times
   should reflect SA's summer-rainfall interior and winter-rainfall Western Cape where that
   matters. Southern Hemisphere: the sun is in the **north**, so north-facing slopes are the
   warm ones.
3. **Invasive species law.** Under NEMBA's Alien and Invasive Species Lists (2020) many
   classic "permaculture" trees are listed invaders in SA (e.g. black wattle *Acacia mearnsii*,
   *Leucaena leucocephala*, many *Eucalyptus*, lantana, syringa *Melia azedarach*, prickly pear
   *Opuntia*, bugweed, Port Jackson, pampas grass, *Prosopis*, *Sesbania punicea*). Never
   recommend planting a listed invader. Flag the category if relevant and give an indigenous or
   non-invasive alternative (e.g. *Vachellia/Senegalia* spp., *Searsia*, *Dovyalis caffra*,
   *Tecomaria/Tecoma capensis*, *Dodonaea viscosa*, *Plumbago auriculata*, vetiver — sterile
   cultivars — for erosion).
4. **Safety.** Home-made sprays (e.g. tobacco/nicotine spray is highly toxic — remove or warn
   clearly), greywater (no kitchen/nappy water on leafy greens eaten raw), biogas (explosive,
   ventilation), rocket stoves, bee stings/allergy, manure pathogens (compost before use on
   crops eaten raw; withhold periods), children near ponds/tanks (cover them). Add a short
   **Safety** note where needed.
5. **Improve**, don't gut: keep the full practical content and all 12 principles. Fix grammar,
   remove repetition, turn dense paragraphs into steps, add a one-line "Key points" list at the
   end of each chapter. Remove figure captions ("Fig 34: …"), "Reproduced with permission"
   credits and page furniture — the reader has no images yet. Log the removed figure list in the
   fact-check file so figures can be added back later.
6. **Attribution.** Keep Bill Mollison and David Holmgren credited for the ethics/principles;
   keep the ACT (2014) acknowledgement in the introduction. Do not copy long passages from web
   sources — write in your own words and cite in the fact-check log.
7. **No personal data.** Do not include names of individual farmers or participants.

## Markdown format (strict — the app's renderer supports only this)

```
# Chapter title                      ← exactly one, first line
## Section heading
### Sub-heading
Plain paragraph text. **Bold** is allowed. *Italic* is allowed (use for Latin plant names).

- bullet item
1. numbered step

> **Safety:** a callout box. Start the line with "> ". Use for Safety / Tip / Note.

| Column | Column |                   ← simple tables allowed (header row + separator row)
|---|---|
| cell | cell |
```

No HTML, no images, no links, no emoji, no footnotes, no nested lists (one level only), no
code blocks. Leave one blank line between blocks.

## Translation rules (isiZulu `zu`, Sesotho `st`, Tshivenḓa `ve`, Xitsonga `ts`)

- Translate the **fact-checked English** in `content/manual/en/`, not the raw source.
- Keep the Markdown structure identical: same number and order of headings, list items,
  callouts and table rows. Translate every word of prose, including table cells and the
  "Key points" list.
- Keep Latin plant names in italics unchanged. Put a well-known English crop/tool name in
  brackets after the local word the first time if the local word may be unfamiliar,
  e.g. "umsele wokubamba amanzi (swale)".
- Plain, rural, spoken register — how an extension officer would explain it in the village,
  not a literary or academic register. South African orthography:
  - **Sesotho**: South African orthography (*di-*, *ho*, *tjhe*, *ke*), not Lesotho spelling (*li-*).
  - **Tshivenḓa**: use the correct circumflex/dot letters ḓ ḽ ṅ ṋ ṱ (not plain d l n t).
  - **Xitsonga**: standard SA Xitsonga orthography.
- Use the language's glossary file (`research/manual/glossary-<code>.md`) for every listed term
  so all chapters agree. If you need a new term, add it to the glossary.
- Numbers, units (mm, m, kg, °C) and measurements stay exactly as in English.
- These are **machine drafts** that a fluent speaker must review before they are treated as
  final. Do not claim otherwise anywhere in the text.

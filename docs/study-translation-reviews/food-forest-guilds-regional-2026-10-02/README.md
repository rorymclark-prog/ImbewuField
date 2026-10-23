# Food Forest and Plant Guilds regional drafts: review record (2 October 2026)

Six module editions: **Food Forest Design** and **Plant Selection & Guilds** in Sesotho (South African
orthography, Free State/QwaQwa), Tshivenda, and standard written Xitsonga (provisional for the Shangani-speaking
group). Everything here is an **unreviewed machine draft**. The exact English source is shown beside every draft in
the app. No fluent-speaker, local-farming or Shangani-comprehension approval is claimed. Facilitators review the
published drafts and send feedback afterwards.

## What is drafted

| | Food Forest | Plant Guilds |
| --- | ---: | ---: |
| Lesson fields per language (card, titles, image descriptions, paragraphs, key points, questions, options, explanations) | 93 | 92 |
| Slide passages per language (headings and paragraphs) | 90 | 102 |
| Existing slide frames per language (reused illustrations, re-rendered text) | 20 | 51 |
| English holds | 0 | 0 |

Totals across the three languages: 555 lesson fields and 576 slide passages (1,131 translated passages), counted
separately from the 213 slide image files. The image files existed before; a module is not complete because its
frames exist.

## Method

1. Parallel drafting agents (Claude Sonnet) per language, module and slide part, under one shared guide: translate
   ordinary prose fully; keep difficult technical terms in English inside translated sentences; keep every number,
   species name, quiz order and correct answer; keep qualifications such as "may", "can", "only", "before" and
   "do not"; never add farming guidance.
2. A blind English back-translation of every passage by a separate agent (Claude Sonnet) that never saw the
   English source.
3. Independent semantic checks (Claude Sonnet) of each draft against the exact English, followed by revision rounds
   for the passages they flagged. Claude Sonnet agents made most revisions, including the harmonisation round in
   step 4; Claude Opus wrote the word rules of the last consistency round and made the final small fixes in step 5.
   Passages that changed were back-translated again; a back-translation only counts if it was made from the exact
   current text.
4. A harmonisation round gave each language one word for the main recurring concepts across both modules (for
   example plant and tree, leaf, trunk and harvest). It also wrote every Sesotho passage in South African spelling
   (lesedi, motjheso, kwahela and jwang, not the Lesotho leseli, mocheso, koahela and joang). It replaced two
   wrong creature words used for insects: a Xitsonga word for small birds and a Tshivenda word for animals. Each
   language now uses the insect word of its live Seeds and Small Livestock drafts. Every passage this round changed
   was back-translated blind and checked again.
5. A last consistency round checked each recurring word against the drafts already live in the course. It changed
   the Tshivenda planting, harvest, crop and count words, the Xitsonga words for soil moisture and narrow, and the
   Sesotho word for light to match them. It restored Tshivenda diacritics (maḓi, maṱari, nḓila) and corrected left
   and right in two Tshivenda picture descriptions, where an earlier draft wrote west. It also made every lesson
   sentence that a slide repeats read the same on the slide. A final small pass fixed a Xitsonga word that read as
   meat instead of soil moisture, a Sesotho negative, Tshivenda noun-class agreement, a spelling, an insect gloss
   and one unclear Tshivenda quiz option. Every passage these rounds changed was back-translated blind and checked
   again.
6. Automated checks in `tests/regional-full-draft-checks.ts` and `tests/paired-draft-slides.test.ts`: species
   names verbatim, numbers unchanged, "support plant" and "thinning" kept, the listed technical terms kept, glosses
   present, South African Sesotho spelling, and one draft for each passage that the English repeats word for word.
   A lesson sentence repeated on a slide, alone or inside a longer slide paragraph, reads the same in both places.
   A list of words that must never appear includes the wrong creature, direction and planting words that the last
   rounds replaced. The Tshivenda word for animals and the Xitsonga word for small birds may appear only where the
   English names animals or birds.

The `*.back-translations.json` files in this folder list each passage key, exact English source, draft and blind
back-translation.

## "Support plant" and other terms kept in English

- **support plant(s), support tree(s), support shrub(s)** stay in English. A bare noun "support" that means these
  plants is written "support plant", and compounds keep "support" (support functions, support density, support
  strips, support guild, support species). The explanation around the term is translated.
- In Food Forest, "climbers use suitable supports" means the physical supports a climber grows up. It is never
  written as "support plant". The verb "support" ("can support habitat") is translated normally.
- **thinning** (removing selected whole plants) stays in English and never shares a word with pruning (cutting
  branches while the plant keeps standing).
- Also kept: guild, canopy, herbaceous, mulch, chop-and-drop, legume, rhizobia, nodule, nodulation, nitrogen,
  biomass, cover crop, cultivar, viable seed, root collar, root zone, leaf litter, frost tolerance, winter chilling,
  cardboard, habitat, ecosystem, indigenous, invasive, pollen, pollination, decomposition, nutrients, establishment
  basin, mulch basin, approved local species list, project species list, botanical guidance, nursery plants.
- Glossed in brackets at first mention: insects, pests, bacteria, pods, for example "dikokwanyana (insects)".

## Look at these first

These are the words and phrases that a blind back-translation misread or a checker questioned, or that have no
earlier use in the live course. Each was kept for the reason given; a fluent reader should confirm them first.

**All three languages**

- The insect words are the ones already live in Seeds and Small Livestock: Sesotho dikokwanyana, Xitsonga
  switsotswana and Tshivenda zwikhokhonono. If a facilitator prefers another word, change it course-wide.
- Where the English says a young tree, the Sesotho (sefate se senyane) and Tshivenda (muri muṱuku) say a small tree.
- Picture descriptions name left and right: Sesotho letshehadi, Xitsonga cheu ra ximatsi and cheu ra xinene,
  Tshivenda tshanḓa tsha monde and tshanḓa tsha u ḽa. An earlier Tshivenda draft wrote west for left.

**Sesotho**

- "Bocking 14 ha e phatlalale ka viable seed" (does not spread by viable seed) is a regular negative, but a blind
  reader took it as positive in all three places it appears.
- "se sa phelang nako e telele" (short-lived) was once read as long-lived.
- Please also check mekgahlelo (layers), dikutu tsa difate (tree trunks), naha ya jwang (grassland), sedikadikwe
  (ring), dimela tse sa batleheng (weeds), faola (prune), hatella (suppress), ntjhafatsa (renew) and pitlaganya
  (crowd).

**Xitsonga**

- "ku tsakama ka misava" (soil moisture) replaced a phrase that read as meat, and "lama nga anamangiki" (narrow)
  replaced banzi, which means wide.
- Please also check "switsotswana leswi onhaka swibyariwa" (pests), "nsinya wa murhi" (trunk), ntshovelo
  (harvest), phikizana (compete), "ku hunyuka ka mati" (evaporation), hundzuluxa (convert), xirhendzevutani
  (ring), goza (step), mpfhuka (spacing), "lexi nga lavekiki" (spare), "hi ku hatlisa-hatlisa" (instantly) and
  "swiphunga swo tiya" (woody).
- Mulch takes class 3 agreement (lowu, wu) throughout.

**Tshivenda**

- u ṱavha (plant), u zwala (sow), khaṋo (harvest) and Vhalani (count) follow the live course. Blind readers
  sometimes took u ṱavha for prune. Pruning is gunyula, cutting down is u rema, and thinning stays in English.
- tshinyalelo (damage) takes class 9 agreement because it is a noun made from a verb, like ṱhogomelo; one checker
  expected class 7. "vhupo ho vuliwaho" (the opening) uses the class 14 form that matches the possessive ha; one
  checker expected vho. khombo (risk) takes class 9 agreement, as in the live course.
- Words a blind reader misread: miṱaṱo (layers, read as cuts), "dza u fhisa" (warm, read as burning), "mavu a tsela
  maḓi zwavhuḓi (draining)", "maḓi o ḓungaho" (waterlogging), mathibo (edges), hwele and hwelana (crowd), mapheṋa
  (the wings of a pod) and "u mela hafhu" (regrowth).
- "zwithu zwine zwikhokhonono zwi zwi ṱoḓa" (resources) narrows the English to the things insects need, and
  "zwithu zwi bvaho kha zwimela" (organic material) narrows it to plant material.
- Ground cover is "zwi fukaho fhasi" in Food Forest and "zwi fukaho mavu" in Plant Guilds; soil moisture is
  "maḓi a kha mavu" in Food Forest and "maḓi a re mavuni" in Plant Guilds. Both pairs mean the same thing.
- The wrong quiz option "Planting as many trees as will physically fit" reads "as many trees as possible in the
  place", using "nga hune zwa konadzea ngaho", the live course's phrase for as … as possible. Checkers rejected two
  earlier versions, and the last check asked a reviewer to confirm the closing "ngaho fhethu".

## Slides, narration and offline use

Each silent regional frame keeps its illustration and the exact English source and shows the drafted text in a
regional panel, so the deck can be read without narration. No regional narration was generated or published;
optional narration stays in English and is an explicit choice. Sesotho, Tshivenda and Xitsonga learners save these
modules as a slide-only offline pack by default (the shared regional download setting already on main), which now
carries the re-rendered frames.

## Older review documents

These earlier records describe partial drafts that held most passages in English. They stay for history and are
superseded by this record: `FOOD-FOREST-ST-AI-DRAFT-REVIEW.md`, `FOOD-FOREST-VE-L2-L3-AI-DRAFT-REVIEW.md`,
`FOOD-FOREST-TS-SILENT-SLIDE-RELEASE.md`, `FOOD-FOREST-LAYER-DESCRIPTIONS-2026-10-01.md`,
`FOOD-FOREST-L1-ST-LEARNER-RELEASE.md`, the Food Forest part of `FOOD-FOREST-L1-TS-SEEDS-L1-VE-LEARNER-RELEASE.md`,
`PLANT-GUILDS-ST-AI-DRAFT-REVIEW.md` and `PLANT-GUILDS-TS-AI-DRAFT-REVIEW.md`.

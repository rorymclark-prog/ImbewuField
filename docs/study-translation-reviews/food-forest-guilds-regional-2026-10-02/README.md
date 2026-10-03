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
3. Independent semantic checks of each draft against the exact English, followed by Claude Opus revision rounds for
   the passages they flagged. Passages that changed were back-translated again; a back-translation only counts if
   it was made from the exact current text.
4. Automated checks in `tests/regional-full-draft-checks.ts` and `tests/paired-draft-slides.test.ts`: species
   names verbatim, numbers unchanged, "support plant" and "thinning" kept, the listed technical terms kept, glosses
   present, words that must never appear, and one draft for each passage that the English repeats word for word
   (a lesson sentence repeated on a slide reads the same in both places).

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

TODO-AFTER-ROUND-5

## Slides, narration and offline use

Each silent regional frame keeps its illustration and the exact English source and shows the drafted text in a
regional panel, so the deck can be read without narration. No regional narration was generated or published;
optional narration stays in English. Sesotho, Tshivenda and Xitsonga learners are offered a slide-only offline pack
for these modules. A selection with a voice in the learner's own language (the Sesotho Introduction, or the whole
course in Sesotho) keeps the full pack.

## Older review documents

These earlier records describe partial drafts that held most passages in English. They stay for history and are
superseded by this record: `FOOD-FOREST-ST-AI-DRAFT-REVIEW.md`, `FOOD-FOREST-VE-L2-L3-AI-DRAFT-REVIEW.md`,
`FOOD-FOREST-TS-SILENT-SLIDE-RELEASE.md`, `FOOD-FOREST-LAYER-DESCRIPTIONS-2026-10-01.md`,
`FOOD-FOREST-L1-ST-LEARNER-RELEASE.md`, the Food Forest part of `FOOD-FOREST-L1-TS-SEEDS-L1-VE-LEARNER-RELEASE.md`,
`PLANT-GUILDS-ST-AI-DRAFT-REVIEW.md` and `PLANT-GUILDS-TS-AI-DRAFT-REVIEW.md`.

# Afrikaans Studies lessons — machine draft (31 October 2026)

Every Studies module and lesson (title, description, body, key points, quiz, image description) as
source-paired Afrikaans machine drafts. `drafts/<module>.json` has the English shape exactly;
`scripts/build-af-course-drafts.mjs` pairs each field with the English it translates (read from
`lib/course-modules.ts`) and writes `lib/course-translation-drafts-af.ts`. A field listed in
`holds.json` ships as a hold (the learner sees English). `lib/course-localization.ts` shows a lesson in
Afrikaans only while every pair still matches its English, so a quiz cannot drift from its answer
(`tests/af-course-drafts.test.ts`).

**Status: unreviewed.** No fluent Afrikaans speaker or local farming reviewer has checked the lessons.
The Studies page labels each lesson "Afrikaans AI draft · review pending" and shows the exact English
beside it.

Drafted by three model agents against `../../translation-reviews/afrikaans-ui-2026-10-31/DRAFTING-BRIEF.md`.
Script checks: same ids, answer indexes, paragraph, key-point, question and option counts as the
English, and every figure written in digits survives.

**Blind back-translation review (`reviews/`):** three independent model reviewers, none of them a
drafter, each read only the Afrikaans first (without the answer key), wrote a literal English
back-translation, then compared it with the English (`LESSON-REVIEW-BRIEF.md`). 912 fields: 909 ok,
3 repairs, 0 holds. All three repairs ship:
- **Greywater:** "doeke" (cloths) became "luiers" (nappies), and the line now says clearly that
  water used to wash animals is excluded.
- **Soil jar test:** "do not prescribe watering … from one jar alone" had read as "do not water".
- **Chickens:** "Only put chickens in a bed after harvest" had read as "just after harvest", which
  lost the "only".

One quiz option's grammar ("Hou aan verkoop") was also fixed.

## Terms for the fluent reviewer first
- **Place names written in Afrikaans:** Hoëveld (Highveld), Suid-Afrika.
- **Species and crops:**
  - Kept in English by rule: khakibos, blackjack, wattle, sunn hemp, cowpea, pigeon pea, red sesbania,
    African basil, wild garlic, Wild Fig, black mulberry, Cape gooseberry, Wild Medlar, Barbados cherry,
    Natal Mahogany, Wild Dagga, Comfrey, Marula, Mopane, baobab, granadilla, naartjie, morogo, and the
    Cape and African honeybees.
  - Translated as everyday crop words: papaja (pawpaw), geelwortels (carrots), patats, suurlemoen,
    lukwart, kweper, lietsjie, and others.
- **Water works:** A-raamwaterpas, wal (berm), oorloop (spillway), gronddamwal, val (swale grade),
  spoelvoortjies (rills), syferplek (seep), eerstespoel-afleier (first-flush diverter; least certain).
  Swale is kontoersloot by the glossary, though a graded swale is not strictly on contour.
- **Soil and growing:** deklaag (mulch), dekgewasse, wurmgietsels, uitloogsel (leachate),
  beddingmateriaal (worm bedding; not the garden bed), geen-grawe, opvolgplanting, tussenverbouing,
  hongergaping, oopbestuifde, saadlot.
- **Coinages:** kap-en-laat-val (chop-and-drop), hoendertrekker (chicken tractor; the app elsewhere
  says "beweegbare hok"), deklaagkom, kroondak, boksskema, geadverteerde prys (headline price).
- **Times:** 8 vm. / 4 nm. for 8am / 4pm.
- **food-forest-l3 quiz 1:** all four options use the same "Om …" form, because the English
  correct option alone had a different grammatical form. Meaning unchanged.

## Questions for the content owner (English source, not translation)
The drafts follow the English faithfully; reviewers and drafters found these in the English:
- **Missing subjects in plant-guilds:**
  - l1: "These bacteria …", "It is indigenous to KwaZulu-Natal …", "It is a short-lived support
    shrub", "Count woody supports …".
  - l2: "Obtain the correct cultivar. Bocking 14 …" never names comfrey.
  - l3: "Keep its vines away …".
  - l2 paragraph 1 and quiz 1 refer to a video clip the learner may not see.
- **Quiz options:**
  - plant-guilds-l1 q2: "Always placing every support uphill" has no basis in the lesson.
  - small-livestock-l1 q2: the answer depends on ducks eating slugs and snails, which the body
    never mentions.
  - small-livestock-l3 q1: an option about ducks in a question about guinea fowl.
  - soil-health-l2 q2: a bark distractor in a question about wattle seed pods.
  - seeds-sovereignty-l2 q1: option 0 does not answer "what does fermentation help remove".
  - market-community-l2 q2: the correct option is more confident than its rationale.
  - reading-landscape-l4 q1, water-harvesting-l1 q2 and l2 q2: only the correct option is an
    action, which gives the answer away.
- **Lesson bodies:**
  - intro-permaculture-l2: the hail-injury-to-maize sentence does not fit its paragraph.
  - intro-permaculture-l2 q2 tests "integrate rather than segregate", which the body never teaches.
  - intro-permaculture-l1 q2: "Cap the borehole to preserve groundwater only" is ambiguous.
  - reading-landscape-l1: "Choose any water works for the site" reads oddly. The draft says "Kies
    enige waterwerke volgens die terrein" (according to the site).
  - seeds-sovereignty-l3: "paper envelopes, not plastic" next to "sealed container" does not say
    whether paper is for drying or storage.
  - soil-health-l2: "its name alone is not proof …" has no clear referent.
  - vegetables-staples-l1: "Look after heavy rain" is ambiguous. The draft reads "observe after
    heavy rain".
  - vegetables-staples-l1 key point 4: "space generously" is looser than the body.
  - seeds-sovereignty-l1 key points 2–3 and market-community-l3 key point 2: claims the body never
    makes.
  - market-community-l1: "tomatoes cost R18 per kilogram" is the cost to produce, per the quiz.

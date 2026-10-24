# isiXhosa app dictionary — machine draft (23 October 2026)

Rory asked for the whole app in isiXhosa. This record covers the UI dictionary
(`lib/locales/xh.ts`) and the money-book drafts (`docs/translation-reviews/records-finance-2026-10-06/draft-xh.json`).

**Status of every string: unreviewed machine draft.** No fluent isiXhosa speaker or local farming
reviewer has checked any of it. The screen says so: `components/LanguageDraftNote.tsx` (farmer,
records, prices, login, student pages) and an isiXhosa line under the language grid in Settings
(`components/ThemePanel.tsx`), the same pattern Xitsonga uses.

## What was done
- **Coverage:** 693 → 2,514 of 2,556 English keys rendered in isiXhosa (98.4%). The remaining keys
  are codes and names that are the same in both languages (GPS, pH, Köppen, ERA5, ImbewuField, 3D …).
- **New keys:** 1,863, drafted in 8 batches against one shared glossary (`DRAFTING-BRIEF.md`). Each
  batch was checked by script for identical `{placeholders}` and line breaks.
- **Existing keys:** a separate reviewer read all 693 shipped strings for meaning errors and fixed 185.
  Examples: `popiaShareDesc` said programmes "produce damage" (umonakalo) instead of tracking impact;
  `challengeLabour` said "enough labour" (negation flipped); `roofMainHint` said the opposite of the
  English; `insightLowSoilCarbon` promised doubled yields; contour toggles said "boundaries" (imida);
  frost strings used *ikhephu* (snow) instead of *iqabaka*.
- **Kept English on purpose:** the six `soilImprovement*` advice sentences (DataPanel shows the
  English source for every language except the paired isiZulu drafts) and `langPartialTag` /
  `langPartialActiveNote` (isiXhosa is no longer partial).
- **Money book:** 544 inventory strings drafted, then a separate model reviewer wrote a blind
  back-translation before comparing with the English (`../records-finance-2026-10-06/reviews/xh-*.json`):
  535 ok, 9 repair. Wording/minor repairs and one very short meaning fix (R167 seedlings, not heifers)
  ship; the whole-sentence meaning repair (I129) is held, so it shows English; R045 is retired like the
  other languages. 543 strings reach the screen through `lib/records-regional-drafts.ts`.
- **Draft-notice strings** that named isiZulu (`*ZuluDraftNotice`, `languageDraftNotice*`) are worded
  for isiXhosa in this locale.

## Honest limits
- Drafters and reviewer are models. "Checked" means no meaning error was found, not that the wording
  is natural, nor that it is the Eastern Cape farming register.
- Coined terms that need a fluent speaker first: *Isitudiyo soyilo* (Design studio), *Amandla omhlaba*
  (sectors), *imigca yokuphakama* (contours), *ingca yokugquma* (mulch), *umxhasi-mali* (funder),
  the glossy-design style names (*Imephu yoyilo*, *Ipolishwe yi-AI*, *Ukugqitywa okupheleleyo*),
  tree names in `biomeSpecies*`, and Köppen climate names in `reportKoppenDesc*`.
- Placeholders whose noun class changes at runtime (`{crop}`, `{site}`, `{season}`, `{direction}`,
  `{d}` with 1) are worded to avoid concords, so some lines read stiffly.
- Short forms: `surveyMonth*` use loan abbreviations (Jan, Feb, Mat …); the Home date uses the everyday
  loan month names (Janyuwari …), not the traditional ones (EyoMqungu …).

## Phase 2 — the rest of the app (same day)

- **Inline isiZulu branches** (~400 places in 119 component and lib files): routed through
  `lib/xh-inline.ts` (`inlineText` / `inlineTemplate`). The isiXhosa lives in English-keyed shards in
  `lib/locales/xh-inline/` (one per component group, plus `s01-mel-templates` for programme survey
  questions and `s02-study-tracks` for the Finance and Design study tracks), registered by the lazily loaded
  xh chunk. English output is unchanged for every other language. `tests/xh-inline.test.ts` fails if a key is
  no longer English that some source file shows, or if a placeholder drifts. Drafted by ten parallel model
  agents against the same glossary; where a screen pairs isiZulu with its English source (consent, money,
  farming instructions), isiXhosa gets the same pairing.
- **Studies lessons:** every module and lesson (title, body, key points, quiz, image description) as a
  source-paired draft in `lib/course-translation-drafts-xh.ts`, generated from
  `docs/study-translation-reviews/isixhosa-2026-10-23/drafts/` by `scripts/build-xh-course-drafts.mjs`.
  Five independent reviewers wrote blind back-translations before comparing with the English (535 ok,
  111 repairs, 0 holds — `reviews/r*-*.json`); a second reviewer re-checked the 19 meaning-level repairs
  (all confirmed, 7 small further fixes — `reviews/rr-*.json`). Notable catches: a reversed seed-storage
  warning, a lost frost-safety negation, wattle pods rendered as seed sacks, a flipped box-scheme
  condition, "acidic" rendered as "rocket".
- **Permaculture Manual:** all 14 chapters, the reader UI and `research/manual/glossary-xh.md`; every
  chapter keeps the English structure (`tests/manual.test.ts`). `/manual/xh` is public.

## Questions for the content owner (English source, not translation)

Reviewers found these in the English lessons; the drafts follow the English faithfully:
- `plant-guilds-l1` body: "These bacteria …" and "It is indigenous to KwaZulu-Natal" never name their
  subject; a learner cannot tell native *Sesbania sesban* from invasive *S. punicea* without the picture.
  `plant-guilds-l3` "its vines" never names the sweet potato.
- `small-livestock-l3` quiz 0 option 2 says "ducks" in a question about guinea fowl.
- `soil-health-l2` quiz 1 option 0 says "Bark" in a question about seed pods.
- `intro-permaculture-l2`: the hail-damage-to-maize sentence does not fit its paragraph.

## Phase 3 (24 Oct 2026): Studies slide cards, money charts, invoice, CSV, dates, feedback forms

### Studies slide cards
- All 10 modules (240 slides) now have isiXhosa slide cards. Each card shows the isiXhosa draft above
  the exact English narration, over the illustrated English slide. The card is labelled
  "ISIXHOSA AI DRAFT / NOT REVIEWED". This is the same silent-card format as the Sesotho Introduction
  release.
- Drafts: `docs/narration/<module>.xh.silent-draft.json`, validated by
  `scripts/paired-draft-slides.mjs` against the English narration.
- Build: `node --import ./tests/register-alias.mjs scripts/build-xh-deck-release.mjs`. It renders
  the cards to `public/course-decks/<module>/xh-silent/` and regenerates
  `lib/course-deck-release-bindings-xh-data.ts` (pair, text and image digests, plus offline sizes).
- Rendering here used DejaVu fonts. The other languages' cards were rendered with the Mac faces
  (Georgia, Avenir), so the type looks plainer, but the layout and checks are the same.
- **Blind back-translation review:** five reviewers, none reviewing their own module, read the
  isiXhosa first and wrote back-translations before seeing the English. They found 23 repairs and 0
  holds. Examples:
  - compost: "pet waste" had become all domestic-animal manure.
  - compost: "a hot centre" had become "a medium temperature".
  - grey water: "contact" had become "communication".
  - seed selection: "reject" had become "breed from".
  - drainage: "freely draining" had become "water rises".
  - One reviewer swapped iintsholongwane (germs) for the isiZulu amagciwane. That swap was reverted.
- Packet: `docs/study-translation-reviews/isixhosa-2026-10-23/slides/` (briefs, back-translations,
  review files).
- **Narration audio:** there is no isiXhosa voice. As for Sesotho, Xitsonga and Tshivenda, the deck
  is silent by default, and the learner can choose the English source narration.
- **Wiring:**
  - The isiXhosa release is a separate registry in `lib/course-deck-release-bindings-registry.ts`. A
    fault there withdraws only the isiXhosa cards, never the Sesotho release.
  - `lib/learner-deck-lang.ts` adds isiXhosa to the deck-language and narration-choice rules.
    `lib/course-deck.ts` and `lib/course-audio.ts` are byte-pinned, so they are left unchanged.
  - The new media is accounted for by `tests/xh-deck-history-checks.ts`.

### Rest of the app
- Money charts, receipt and harvest graphs:
  - These already read the money-book drafts.
  - The "English source" tooltips now show for isiXhosa too.
  - `lib/records-months.ts` has isiXhosa month names for chart axes, ledger dates and the CSV.
- Invoice document: `DOCUMENT_COPY.xh`, with isiXhosa dates, units and payment labels. This works the
  same way as isiZulu.
- Money-book CSV export: isiXhosa column headings. Column order and values are unchanged.
- Dates: `lib/xh-dates.ts` writes day, month and year with isiXhosa month names, because browsers'
  xh-ZA locale falls back to English. It is used in community, contact inbox, reports, saved
  reports, mentor due dates and staff dates.
- Forms:
  - The public feedback form gets the isiXhosa draft notice and paired labels.
  - Staff training feedback can be recorded in isiXhosa (`FEEDBACK_LANGUAGES`).
  - Participant survey answers can be saved as `xh`.

## Round 2 review (24 Oct 2026): Manual and inline UI strings
Eight independent reviewers (Sonnet) checked the parts with no blind review yet. Each read the
isiXhosa first, wrote an English back-translation, then compared it with the source and fixed real
meaning errors in place. Style preferences were left alone.

**Permaculture Manual, all 14 chapters: 35 repairs, 0 holds.** Records are in `manual-review/`.
- Greywater: "never put it on the garden" had become a plain description.
- Wells, boreholes and pit toilets: "uphill of" had become "above" or "on top of".
- First-flush diverter: "empty it" read as "throw it away".
- Glossary: "green manure, often a legume" had been reversed to "often NOT a legume".
- Ethics test: "fence off a spring" had become "block a spring".
- Parasitic wasps: "cannot sting" had become "cannot tell".
- Carbon monoxide: "a gas you cannot see" had become "cannot show".
- Chickens: "close the birds in every night" had become "one by one".
- Frost hedge: the "open end facing downhill" was lost.
- Varroa: the sentence was garbled.
- Soil: "dig in" manure, "sow thickly", and the "never flood the worms" step.

**Inline UI strings, all shards: 49 repairs, 0 holds.** Records are in `inline-review/`.
- Atlas: "score" had been rendered as "school".
- Community: the privacy line "never your exact homestead" was garbled.
- Exchange: "Make an offer" read as "raise the price".
- Design tools: "move" had become "remove".
- Training register: "signatures" had become "stamps".
- Money book: "guessed entry" had been narrowed to "estimated income".
- Agronomist: had become "agricultural doctor".
- An isiZulu "nxa" was found.
- The MEL question preview now shows the isiXhosa drafts.

None of this replaces a fluent-speaker review; it removes the errors a careful reader would catch.

## Still English for isiXhosa readers
- Lesson narration audio. No isiXhosa recording or TTS voice exists; the decks are silent or use the
  optional English source voice.
- Numeric-only dates printed with no month word, such as `toLocaleDateString(dateLocale)` with no
  options. The numbers read the same either way.

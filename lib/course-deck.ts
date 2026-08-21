// A module's slide deck — the form the course was actually authored in.
//
// WHY THIS EXISTS: Seeds was written as 24 slides, in a deliberate teaching order, with six of
// them built as near-empty frames because an animation carries the idea better than a still. The
// app only had lesson pages, so all of that collapsed into three long lessons and the animations
// had nowhere to live at all. A farmer got the words and lost the sequence.
//
// The deck does not replace the lesson pages. Someone who wants to read still reads; someone who
// wants to be taught presses play. Both come from the same authored content.
//
// PURE MODULE — no react, no firebase, no fetch. Just the manifest and lookups over it, so the
// player can be tested without a browser.

import { COURSE_NARRATION, trackUrl, type NarrationTrack } from '@/lib/course-audio';

export interface DeckAnimation {
  /** Wordless clip, audio stripped — narration plays over it. */
  src: string;
  /**
   * A still from the clip, shown until the farmer asks for it.
   *
   * NOTHING AUTOPLAYS AND NOTHING PRELOADS. lib/course-modules.ts already states the rule for this
   * audience — video is never given an inline player because KZN connectivity cannot stream it per
   * visit — and these clips are 0.6–2.6 MB against lesson stills of 60–140 KB. A poster is ~50 KB,
   * so the page costs what a picture costs, and the farmer decides whether the clip is worth the
   * rest. The size is shown on the button; guessing with someone else's data is not ours to do.
   */
  poster: string;
  /** Bytes, shown on the play button so the choice is an informed one. */
  bytes: number;
  seconds: number;
}

export interface DeckSlide {
  slide: number;
  /** English title. The narration manifest carries the isiZulu one. */
  title: string;
  lesson: string | null;
  animation?: DeckAnimation;
}

export interface ModuleDeck {
  /** Languages with their OWN rendered slides. Others fall back — see resolveDeckLang. */
  slideLanguages: string[];
  /**
   * Slides a language is missing, by slide number.
   *
   * A whole-deck fallback would be a lie here. If one localized asset is absent, only that slide
   * should fall back to English; showing English for every slide would take a finished lesson
   * away from the person it was made for.
   */
  missingSlides?: Record<string, number[]>;
  /**
   * File extension of this deck's slide images. Defaults to 'jpg' — what a painted deck is.
   *
   * A deck produced by scripts/render-course-deck.mjs is SVG instead, and that is a data decision
   * rather than a technical preference: those slides are 2–3 KB where a painted one is 47–152 KB,
   * for an audience buying data by the megabyte. It is PER DECK because the two production routes
   * genuinely differ — Seeds is illustration, which has to be a photograph-grade raster, and a
   * generated deck is type and rules, which is what vector is for. Both are just <img> to
   * DeckPlayer, and every URL is built by slideImageUrl, so nothing downstream has to know which
   * kind it is looking at.
   */
  imageExt?: string;
  slides: DeckSlide[];
}

const SEEDS_ANIMATIONS: Record<number, DeckAnimation> = {
  // Matched to slides by watching the clips, not by reading their filenames.
  //
  // SAMPLING ONE MID-CLIP FRAME IS NOT ENOUGH, and this is the proof. Slide 13 teaches the DRY
  // method — mature, collect, clean, dry — and carried `imbewu_isiZulu_video_04` because its
  // middle frame shows seed being pressed on a plate, which reads exactly like dry processing.
  // Watched end to end, that clip opens on tomato pulp going into a sieve: it is the WET method,
  // and a shorter duplicate of the back half of slide 15's clip. A farmer following slide 13 was
  // being shown one method while the voice taught another. (Rory: "you forgot to put part a into
  // this animation ... its here a few slides forward".)
  //
  // Meanwhile slide 8's clip ran ten seconds and taught two different lessons: selection in the
  // field, then threshing, winnowing and drying. It is now cut at 5.2s, where the farmer stops
  // choosing plants and starts processing seed, so slide 8 gets the selection and slide 13 gets
  // the dry process its narration actually describes. Both cuts come from the high-res original.
  //
  // `bytes` is the EXACT size of the file on disk, and tests/course-deck.test.ts stats each one and
  // fails on any difference. These were hand-rounded before, which meant re-encoding the clips
  // turned every play button into a wrong promise about somebody's data allowance — the one number
  // on this screen a farmer is asked to trust.
  5:  { src: 'imbewu_isiZulu_video_01', poster: 'imbewu_isiZulu_video_01', bytes: 420_204,   seconds: 10 }, // uniform vs varied seedlings
  7:  { src: 'imbewu_isiZulu_video_02', poster: 'imbewu_isiZulu_video_02', bytes: 738_328,   seconds: 10 }, // households exchanging packets
  8:  { src: 'seed-selecting-parents', poster: 'seed-selecting-parents', bytes: 248_394, seconds: 5 }, // walking the rows, choosing, harvesting
  10: { src: 'imbewu_isiZulu_video_03', poster: 'imbewu_isiZulu_video_03', bytes: 399_404,   seconds: 10 }, // maize tassels, crossing
  13: { src: 'seed-dry-processing', poster: 'seed-dry-processing', bytes: 311_237,   seconds: 5 }, // threshing, winnowing, drying on the mat
  15: { src: 'imbewu_isiZulu_video_05', poster: 'imbewu_isiZulu_video_05', bytes: 1_377_407, seconds: 20 }, // tomato in a jar — the long one
  18: { src: 'new_seed-storage-jar-vs-bag', poster: 'new_seed-storage-jar-vs-bag', bytes: 474_949, seconds: 10 },
  21: { src: 'imbewu_isiZulu_video_06', poster: 'imbewu_isiZulu_video_06', bytes: 439_958,   seconds: 10 }, // germination test on cloth
};

/**
 * Slides are derived from the narration manifest rather than typed out again.
 *
 * lib/course-audio.ts already holds the slide numbers, titles, isiZulu titles and lesson mapping,
 * and it is the file the recording is checked against. A second hand-maintained list of the same
 * 24 rows is this codebase's most repeated bug — two places answering one question and drifting —
 * and here the drift would be a slide showing one thing while its narration says another.
 */
function slidesFromNarration(moduleId: string, animations: Record<number, DeckAnimation>): DeckSlide[] {
  const narration = COURSE_NARRATION[moduleId];
  if (!narration) return [];
  return narration.tracks.map((t: NarrationTrack) => ({
    slide: t.slide,
    title: t.title,
    lesson: t.lesson,
    ...(animations[t.slide] ? { animation: animations[t.slide] } : {}),
  }));
}

export const COURSE_DECKS: Record<string, ModuleDeck> = {
  'seeds-sovereignty': {
    slideLanguages: ['en', 'zu'],
    // ALL 24 SLIDES NOW EXIST IN BOTH LANGUAGES. The history is kept because the failure was
    // invisible and the next deck can fail the same way.
    //
    // PowerPoint opened the isiZulu deck as "Repaired" and reported 23 slides where the file
    // contains 24 slide parts — the repair dropped one. Aligning the export against the English
    // titles identified it exactly: slide 13, "Buka: Indlela Eyomile". Everything after it was
    // therefore shifted by one, and the pages were renumbered on import to their TRUE slide
    // numbers. Wiring the 23 pages in order would instead have put the wrong narration under
    // eleven consecutive slides — a farmer hearing the tomato wet method while looking at dry seed
    // cleaning, with nothing visibly broken to warn anyone.
    //
    // The missing slide was rebuilt from the standalone isiZulu PowerPoint Rory supplied: its
    // eyebrow, title and caption are that file's own text, composited onto the English slide's
    // artwork, with the type geometry solved against zu/slide-05 and zu/slide-07 so it sits
    // unnoticed among its neighbours. No isiZulu was written or translated by the app.
    //
    // `missingSlides` stays in the type on purpose — resolveDeckLang and slideImageFor still
    // implement per-slide fallback, and the next module's deck will very likely need it.
    slides: slidesFromNarration('seeds-sovereignty', SEEDS_ANIMATIONS),
  },

  // THE FIRST GENERATED DECK, and deliberately a different kind of object from the one above.
  //
  // Seeds' 24 slides are painted: a woman winnowing seed at a table, hands passing labelled
  // packets, sepia process vignettes. That is the right way to make one module and an impossible
  // way to make nine — it needs an illustrator, roughly a dozen authored pieces per module. The
  // nine modules that gained English narration on 2026-08-03 had no deck at all, so a farmer got
  // the reading page and lost the sequence the course was actually written in.
  //
  // These slides are typographic instead: title, one idea, a few supporting lines and the script's
  // own reflection question, on the app's own paper and green. They do not imitate Seeds and are
  // not meant to be mistaken for it. scripts/render-course-deck.mjs produces them from
  // docs/narration/intro-permaculture.en.md and the narration manifest, deterministically — no
  // string on a slide was written here, and none was translated.
  //
  // ENGLISH ONLY, and that is not an oversight. lib/narration-blockers.ts flags eight of the nine
  // isiZulu scripts as self-declared drafts, and rendering slides from a draft would put unreviewed
  // isiZulu in front of a learner — the exact failure tests/narration-scripts.test.ts exists to
  // prevent. isiZulu decks wait for a first-language reviewer, not for a renderer.
  'intro-permaculture': {
    slideLanguages: ['en'],
    imageExt: 'svg',
    slides: slidesFromNarration('intro-permaculture', {}),
  },

  // The second generated deck, from the same renderer and on the same terms as the one above.
  //
  // ENGLISH ONLY, and here the manifest says so itself: COURSE_NARRATION['soil-health'].languages
  // is ['en']. docs/narration/soil-health.zu.md exists, but it opens its own appendix with "This is
  // a draft translation only. It must be read by a first-language isiZulu speaker who farms before
  // this script goes anywhere near a learner", which lib/narration-blockers.ts detects. Rendering
  // slides from it would put unreviewed isiZulu in front of the very people the module is for.
  //
  // NO `missingSlides`. All 20 slides the manifest lists were rendered, so declaring a gap would be
  // a lie in the other direction — tests/course-deck.test.ts asserts both halves of that.
  //
  // WORTH KNOWING WHEN READING THESE SLIDES: soil-health.en.md carries no [pause], so — unlike
  // intro-permaculture — not one of its 20 slides ends on a reflection question. That is the
  // script's shape, not a fitter that ran out of room; every supporting line the script wrote is on
  // its slide (the renderer drops none here). Six of the ten English scripts are written this way.
  //
  // Slides 5, 10 and 14 are titled "Watch: …" and public/course-animations/ has nothing for this
  // module, so `slidesFromNarration` is given no animation map. They render as scenario cards,
  // which reads, but the title still promises a clip that does not exist — the same pre-existing
  // gap intro-permaculture has, and it belongs to the course content rather than to the deck.
  'soil-health': {
    slideLanguages: ['en'],
    imageExt: 'svg',
    slides: slidesFromNarration('soil-health', {}),
  },

  // Another generated deck, same renderer and the same terms as the two above.
  //
  // ENGLISH ONLY, and the manifest says so itself: COURSE_NARRATION['vegetables-staples'].languages
  // is ['en']. docs/narration/vegetables-staples.zu.md exists and is the longest isiZulu draft in the
  // repo, but it opens "DRAFT FOR HUMAN REVIEW — NOT SHIPPABLE TEXT" and closes with a TERMS NEEDING
  // REVIEW table in which the translator marks every agronomic term as coined or uncertain. It is the
  // one script both of the old blocker lists agreed on — the coincidence lib/narration-blockers.ts
  // was written about. Rendering from it would put invented isiZulu agronomy on screen under the
  // app's own name.
  //
  // THE DENSEST SCRIPT ANY DECK HAS BEEN RENDERED FROM, and the first where what the fitter spends
  // is TEACHING rather than a reflection prompt. Named here because none of it is visible on disk —
  // eighteen files, all present, all the right size. Read against the CLI output of a fresh render:
  //
  //   slide 05  the script names four bed types; the slide fits no-dig and double-digging and loses
  //             raised (wet ground) and sunken (dry ground) — the two that answer the rainfall half
  //             of its own title, "Choose the Bed for the Soil and Rainfall".
  //   slide 16  the lead line reads "Work through four steps, in order" and three dots follow. The
  //             slide contradicts itself within two lines of type.
  //   slide 04  condensed to keep both supporting paragraphs, and one of them is now the stub "The
  //             protection is simple." — the sentence that NAMES the protection (permanent paths,
  //             and a bed narrow enough to reach into from both sides) is the half that went. This
  //             is exactly the case the CLI's "check these by eye" line is warning about.
  //   slide 13  condensed, and it bought back amadumbe — all four staples are now named. What it
  //             cost is maize's second sentence, on saving your own open-pollinated seed. A fair
  //             trade, but it is a seed-sovereignty point dropped from a seed-sovereignty course.
  //
  // NOT a fitter bug. It spends the reflection question first, then condenses, and only then drops a
  // paragraph, and it will not typeset below 0.82 of base because that is ~9 px on a phone-width
  // card. Probed against the earlier renderer: holding every whole paragraph on slide 05 needs the
  // floor at 0.70 — ~7.6 px, bought by making all eighteen slides unreadable. The fix is authorial
  // (slide 05 wants to be two slides; slide 16's lead should say what its slide shows), or an
  // illustrator. Neither is a rendering decision, so the deck ships as the script permits.
  //
  // A FAR BIGGER LOSS, AND NOTHING REPORTS IT. This script uses [pause] as a mid-slide beat rather
  // than as a lead-in to a closing question: seventeen of its slides carry post-pause material, and
  // twelve carry more than one paragraph of it. The renderer reads `block.after[0]` and nothing
  // else, and the fitter then spends even that first paragraph on eleven slides. Of 37 post-pause
  // paragraphs the author wrote, SEVEN reach a slide. intro-permaculture and soil-health have zero
  // multi-paragraph pauses between them, which is why this never surfaced — the renderer was built
  // against two scripts that happen to share a shape this one does not. Worst case is slide 14,
  // "Diversity Keeps Food Moving", where both dropped paragraphs state the diversity the title
  // promises. `dropped` is blind to all of it, because it counts only `before`.
  //
  // And where `after[0]` does survive it is set apart in rust italic under a hairline rule — visual
  // grammar for "a question to sit with" — while only 2 of the 17 are questions. The rest are plain
  // teaching sentences wearing a prompt's clothes.
  //
  // THE COVER SLIDE READS "Title". COURSE_NARRATION['vegetables-staples'].tracks[0].title is the
  // literal string "Title", a placeholder that matches the script's own "**Slide 1 — Title**"
  // heading. Seven of the ten modules carry their real name there; this one and seeds-sovereignty
  // do not. On Seeds it is invisible, because that deck is painted and the artwork carries the
  // title — here the string IS the slide, set at 132 units across the cover. Not fixed from here:
  // the honest repair is the hero path taking mod.title (which the eyebrow already uses, and which
  // reads "Vegetables and Staple Crops"), and changing the shared renderer would re-render every
  // registered deck's bytes.
  'vegetables-staples': {
    slideLanguages: ['en'],
    imageExt: 'svg',
    slides: slidesFromNarration('vegetables-staples', {}),
  },

  // Another generated deck, same renderer and the same terms as the three above. 20 slides, 40.9 KB
  // for the whole module — one Seeds still costs more than that.
  //
  // ENGLISH ONLY, and the manifest says so itself: COURSE_NARRATION['food-forest'].languages is
  // ['en']. docs/narration/food-forest.zu.md exists and its own appendix says "This is a draft
  // translation only. It must be read by a first-language isiZulu speaker who farms before this
  // script goes anywhere near a learner" — which lib/narration-blockers.ts detects. Nothing was
  // translated here.
  //
  // NO `missingSlides`. All 20 English files are on disk; declaring a gap that is not there is a
  // lie tests/course-deck.test.ts checks in both directions.
  //
  // NOTHING WAS DROPPED — every supporting line the script wrote is on its slide, and this is the
  // first of these decks where that is true of all 20. It is not the fitter doing better; it is
  // food-forest.en.md carrying no [pause], so no slide ends on a reflection question and none had
  // to be traded away for one. Two consequences a reader should know before judging the slides:
  // the deck has no closing beat anywhere in it (the narration has no pause there either, so this
  // is an authoring gap in the script rather than in the render), and with no prompt anchoring the
  // foot of the card, the type block sits higher in the frame than it does on an intro-permaculture
  // slide. Slide 13 typesets at exactly the 0.82 floor — ~8.8 px on a phone-width card, the
  // tightest slide in the deck and the one to check first if anyone reports these as small.
  //
  // Slides 5, 10 and 15 are titled "Watch: …" and public/course-animations/ holds nothing for this
  // module, so no animation map is passed. They render as scenario cards and read fine, but the
  // title promises a clip that does not exist — the same pre-existing course-content gap
  // intro-permaculture and soil-health have, not something introduced here.
  'food-forest': {
    slideLanguages: ['en'],
    imageExt: 'svg',
    slides: slidesFromNarration('food-forest', {}),
  },

  // Another generated deck, same renderer and the same terms as the four above. 20 slides, 40.8 KB
  // for the whole module.
  //
  // ENGLISH ONLY, and the manifest says so itself: COURSE_NARRATION['market-community'].languages
  // is ['en']. docs/narration/market-community.zu.md exists and closes with a "Notes for the Human
  // Reviewer" section stating "This is a draft translation only. It must be read by a first-language
  // isiZulu speaker who farms before this script goes anywhere near a learner" —
  // lib/narration-blockers.ts detects both phrases. Nothing was translated here.
  //
  // NO `missingSlides`. All 20 English files are on disk; declaring a gap that is not there is a lie
  // tests/course-deck.test.ts checks in both directions.
  //
  // NO REFLECTION QUESTION ON ANY SLIDE, because market-community.en.md carries no [pause] — the
  // same authoring shape as soil-health and food-forest, and unlike intro-permaculture. Nothing was
  // traded away for a prompt here; there was never a prompt to trade.
  //
  // SLIDE 17 IS THE ONE TO LOOK AT, and it is the sharpest example so far of condensing changing
  // what a slide says. "Sell Locally to Reduce Loss" has four paragraphs and the card holds three,
  // so the fitter condensed the third to its opening sentence — "Selling within walking distance
  // removes most of it." — dropping "If a formal market is 60km away, moving 50kg of beans sold at
  // R8/kg can cost R150." The fourth paragraph then survives intact and reads, on the slide:
  // "A WhatsApp group or community market removes THAT TRANSPORT COST and may reach R10/kg."
  // Both of its references are now gone. "That transport cost" points at an R150 no longer shown,
  // and "may reach R10/kg" is a comparison whose R8/kg baseline left with it. The slide is not
  // wrong, but its closing line is stranded, and the narration still speaks all four paragraphs —
  // so a farmer hears the arithmetic and looks at a card that has lost it. Authorial to fix (the
  // paragraph wants to be two), not a rendering decision.
  //
  // SLIDE 15 drops one supporting line outright: "The whole group receives stronger seed without
  // every farmer doing every task alone." That one is a closing summary of the three lines above it,
  // so it is the least costly of this script's paragraphs to lose. Probed: holding it needs the
  // floor at 0.80 against the fixed 0.82 — a near miss, but 0.82 is the shared constant every other
  // deck was rendered against, and moving it to buy one summarising line here would re-typeset five
  // registered modules.
  //
  // Slides 4, 9 and 14 are titled "Watch: …" and public/course-animations/ holds nothing for this
  // module, so no animation map is passed — the same pre-existing course-content gap the other
  // generated decks have. It bites hardest here: slide 9's supporting line is "The arrows show each
  // route", printed on a typographic card with no arrows on it. The diagram it means does exist —
  // public/course-images/market-community/market-community-l2.jpg is exactly "a roadside stall, a
  // group delivery to a shop, and a box going straight to a household" — but it is wired as a LESSON
  // infographic and this renderer reads only the narration script. Worth a look before anyone films
  // a clip for it.
  'market-community': {
    slideLanguages: ['en'],
    imageExt: 'svg',
    slides: slidesFromNarration('market-community', {}),
  },

  // Another generated deck, same renderer and the same terms as the ones above. 20 slides, 40.6 KB
  // for the whole module.
  //
  // ENGLISH ONLY, and the manifest says so itself: COURSE_NARRATION['plant-guilds'].languages is
  // ['en']. docs/narration/plant-guilds.zu.md exists, but its appendix says "This is a draft
  // translation only. It must be read by a first-language isiZulu speaker who farms before this
  // script goes anywhere near a learner" — which lib/narration-blockers.ts detects. Nothing here was
  // translated; isiZulu waits for a first-language reviewer, not for a renderer.
  //
  // NO `missingSlides`. All 20 English files are on disk, and tests/course-deck.test.ts checks that
  // claim in both directions — an undeclared gap is a broken image, and a declared one that exists
  // is a slide hidden behind a fallback forever.
  //
  // NOTHING IS DROPPED — every one of the 66 paragraphs the script wrote for slides 2–20 reaches its
  // slide, and the fitter reports no thin slide in this module.
  //
  // BUT THREE PARAGRAPHS ARE SET AS THEIR FIRST SENTENCE ONLY, and that loss is silent: it happens in
  // signpost() before the fitter ever measures, so it is counted by neither `dropped` nor the CLI.
  // The line looks like a complete sentence and is not. All three are paragraphs of 146–158
  // characters, just over the 140-character WHOLE_PARAGRAPH_LIMIT:
  //
  //   slide 06  sets "Sesbania sesban suits warm, moist KZN coastal and Lowveld conditions." and
  //             drops "Do not confuse it with Sesbania punicea, the red-flowered invasive relative."
  //             The slide names a tree to plant and omits the warning about its invasive lookalike.
  //             lib/course-modules.ts makes that distinction in the lesson body; the slide does not.
  //             This is the one to fix first.
  //   slide 10  keeps "Watch the cut leaves lying around living plants." and loses "They protect the
  //             soil surface, hold moisture, and slowly become organic matter…" — the teaching.
  //   slide 15  keeps "Look at the central mango and the plants around it." and loses "Notice how
  //             the guild works as one team…" — the point the slide exists to make.
  //
  // NOT A FITTER PROBLEM: all three fit whole with room to spare — slides 10 and 15 render as the
  // emptiest cards in the deck (1.4–1.6 KB against a 2.2 KB average) with two thirds of the frame
  // blank. A renderer change would re-render every registered deck's bytes, so it is not made from
  // here; the shared fix is to condense on measurement rather than on a character count. Recorded
  // rather than left to be discovered on a handset.
  //
  // NOT ONE SLIDE ENDS ON A REFLECTION QUESTION, and that is the script's shape rather than a fitter
  // out of room: plant-guilds.en.md contains no [pause] at all, so there is no post-pause paragraph
  // to set. It also means this module cannot hit the `after[0]` limitation recorded on
  // vegetables-staples above — with no [pause], nothing is stranded behind one.
  //
  // THE COVER SETS 1 OF ITS 4 PARAGRAPHS. The hero path is title plus one tagline by design and
  // every deck's cover behaves this way (intro-permaculture 1 of 3, food-forest 1 of 4). The
  // narration speaks all four. Recorded so it is not mistaken for content this module lost.
  //
  // Slides 5, 10 and 15 are titled "Watch: …" and public/course-animations/ holds nothing for this
  // module, so no animation map is passed. They render as scenario cards and read fine, but the
  // title promises a clip that does not exist — the same pre-existing course-content gap the other
  // generated decks carry, not something introduced here.
  'plant-guilds': {
    slideLanguages: ['en'],
    imageExt: 'svg',
    slides: slidesFromNarration('plant-guilds', {}),
  },

  // Another generated deck, same renderer and the same terms as the ones above. 20 slides, 39.2 KB
  // for the whole module — the cheapest deck registered so far.
  //
  // ENGLISH ONLY, and the manifest says so itself: COURSE_NARRATION['small-livestock'].languages is
  // ['en']. docs/narration/small-livestock.zu.md exists and closes with a "Notes for the Human
  // Reviewer" section saying "This is a draft translation only. It must be read by a first-language
  // isiZulu speaker who farms before this script goes anywhere near a learner" — two phrases
  // lib/narration-blockers.ts detects. Nothing here was translated.
  //
  // NO `missingSlides`. All 20 English files are on disk, and tests/course-deck.test.ts checks that
  // claim in both directions.
  //
  // NO REFLECTION QUESTION ON ANY SLIDE: small-livestock.en.md carries no [pause], the same
  // authoring shape as soil-health, food-forest, market-community and plant-guilds. Nothing was
  // traded away for a prompt because there was never a prompt to trade, and with no [pause] this
  // script cannot strand paragraphs behind `after[0]` the way vegetables-staples does.
  //
  // THREE SLIDES DROP A TEACHING LINE. Named here because the loss is invisible on disk — twenty
  // files, all present, all the right size — and because the narration still speaks all of it, so a
  // learner listening hears a sentence that is not on the card in front of them:
  //
  //   slide 13  loses "If a hive swarms repeatedly, it is likely overcrowded and needs a super or a
  //             split." The slide keeps the DALRRD registration requirement, so what goes is the
  //             one piece of hands-on husbandry on a slide titled "Strong Colonies Need Space and
  //             Flowers".
  //   slide 18  loses "The animals become partners in managing the grazing system." A closing
  //             summary of the three lines above it — the least costly of the three.
  //   slide 19  loses "Identify one loop that could work with the resources you already have."
  //             This is the worst one: it is the sentence that STATES THE TASK on a slide titled
  //             "Field Assignment: Draw Your Farm Loop". The slide still says walk the land and
  //             record what is there, and slide 20 carries its own actionable instruction, so the
  //             assignment is not lost from the module — but it is lost from its own slide.
  //
  // NOT a fitter bug, and measured rather than assumed. Probed against this renderer: the floor at
  // 0.80 restores slides 13 and 18, and 0.78 restores all three with nothing else in the deck
  // changing — the fitter takes the largest size that fits, so slides that already set at full size
  // stay there. It is that close. But 0.82 is the shared constant every registered deck was
  // rendered against, and moving it to buy three lines here would re-typeset six modules. Recorded
  // rather than changed from inside one module's entry.
  //
  // THE SAFETY LINE SURVIVES, which is the thing to check when a renderer is dropping sentences.
  // This module's one prohibition is set on both slides that carry it: slide 6 "Never place
  // chickens around seedlings." and slide 20 "Do not place chickens around seedlings."
  //
  // THE COVER SETS 1 OF ITS 3 PARAGRAPHS — the hero path is title plus one tagline by design, as on
  // every deck here. The narration speaks all three.
  //
  // Slides 4, 9 and 14 are titled "Watch: …" and public/course-animations/ holds nothing for this
  // module, so no animation map is passed. They render as scenario cards and read fine, but the
  // title promises a clip that does not exist — the same pre-existing course-content gap the other
  // generated decks carry, not something introduced here.
  'small-livestock': {
    slideLanguages: ['en'],
    imageExt: 'svg',
    slides: slidesFromNarration('small-livestock', {}),
  },

  // Another generated deck, same renderer and the same terms as the others. 24 slides, 44.9 KB for
  // the whole module — the longest of these decks and still a third of what ONE painted Seeds slide
  // costs.
  //
  // ENGLISH ONLY, AND THIS ONE IS NOT THE EASY CASE THE OTHERS WERE. Every deck above justifies
  // English-only twice over: the manifest lists ['en'], AND the isiZulu script declares itself a
  // draft in its own words, which lib/narration-blockers.ts detects. Here only the first half holds.
  // COURSE_NARRATION['water-harvesting'].languages is ['en'], but docs/narration/water-harvesting.zu.md
  // carries NO blocker marker — it and the reviewed, recorded seeds-sovereignty.zu.md are the only
  // two isiZulu scripts in the repo that do not. Its 24 bilingual blocks line up with the English
  // ones exactly, so a `zu` deck would render without complaint. It is still not rendered, for
  // reasons that are checkable rather than a matter of taste:
  //
  //   * ABSENCE OF AN APPENDIX IS NOT EVIDENCE OF REVIEW. Eight of the nine isiZulu drafts end with
  //     a reviewer note; this file simply ends. Seeds has no appendix because a first-language
  //     speaker read it. Which of those two this is cannot be read off the file, and guessing in
  //     the direction of "reviewed" puts unreviewed isiZulu in front of the people the module is for.
  //   * THE TITLES WOULD BE ENGLISH. This module's tracks carry no `titleByLang`, so renderDeck's
  //     `track.titleByLang?.[lang] ?? track.title` falls through to English on all 24 slides. An
  //     isiZulu deck here is an English headline over isiZulu body copy — half-translated slides
  //     under the app's own name, which is worse than honest English.
  //   * THERE IS NO ISIZULU RECORDING. public/course-audio/water-harvesting/ holds `en` and nothing
  //     else, so the slides would have no voice to go with them.
  //
  // Rendering it is Rory's call once someone has read it, not a renderer's. Nothing here was
  // translated.
  //
  // NO `missingSlides`. All 24 English files are on disk; tests/course-deck.test.ts checks that in
  // both directions.
  //
  // ONE SLIDE DROPS A SUPPORTING LINE, and it is worth knowing which. Slide 13, "Turn a Dam into a
  // Working Ecosystem", has five paragraphs and sets four; the one that does not fit is the last,
  // "Ducks and indigenous bulrushes turn a dam into a working ecosystem, not just storage." — the
  // sentence that states the claim in the title. The four that are set include both halves of it
  // ("Ducks aerate the water.", "Indigenous bulrushes stabilise the banks."), so the teaching
  // survives and the summary does not. The other 22 non-cover slides carry every paragraph whole:
  // nothing else dropped, nothing condensed.
  //
  // THE `after[0]` LIMITATION RECORDED ON vegetables-staples ABOVE BITES ONCE HERE, on slide 18.
  // "Keep Stored Water Protected" has two paragraphs after its [pause] and the renderer reads only
  // the first, so "For irrigation, untreated tank water is fine." reaches no slide — on a slide with
  // half a card of empty space below the text, and with `dropped` reporting nothing, because it
  // counts only `before`. The loss is softened by luck rather than design: slide 15 sets that exact
  // sentence as one of its own supporting lines, so the module does not lose the teaching, only the
  // reprise. This is the ONLY multi-paragraph pause in the script.
  //
  // NOT ONE OF THE SIX POST-PAUSE LINES IS A QUESTION. Slides 4, 7, 9, 12, 16 and 18 all end on a
  // plain declarative sentence, set in rust italic under a hairline rule — visual grammar for "a
  // question to sit with", doing caption duty instead. On slide 9 it restates the lead from the
  // other side ("Above 15-20% slope, use vetiver…" over "Swales work well on 1 to 15% slopes."),
  // which reads as a caption pair and not as a prompt. Authorial, not a render fault.
  //
  // SLIDE 14 SAYS ITS TITLE TWICE. The manifest titles it "Your Roof Is a Harvesting Surface" and
  // the script's first paragraph is "Your roof is a harvesting surface." — so the lead directly
  // under the headline is the headline. Both strings are the course's own and neither is the
  // renderer's to rewrite; the repair is one sentence of authoring in water-harvesting.en.md.
  //
  // SIX OF 24 SLIDES ARE TITLED "Watch: …" — 4, 7, 9, 12, 16 and 21 — and public/course-animations/
  // holds nothing for this module, so no animation map is passed. They render as scenario cards and
  // read fine, but a quarter of this deck promises a clip that does not exist. That is the same
  // pre-existing course-content gap the other generated decks carry, at the highest proportion of
  // any of them.
  'water-harvesting': {
    slideLanguages: ['en'],
    imageExt: 'svg',
    slides: slidesFromNarration('water-harvesting', {}),
  },

  // Another generated deck, same renderer and the same terms as the ones above. 21 slides, 39.7 KB
  // for the whole module.
  //
  // ENGLISH ONLY, and the manifest says so itself: COURSE_NARRATION['reading-landscape'].languages
  // is ['en'], so there is no isiZulu recording for isiZulu slides to sit under.
  // docs/narration/reading-landscape.zu.md exists and closes with "Notes for the Human Reviewer"
  // declaring itself "a draft translation only" that "must be read by a first-language isiZulu
  // speaker who farms before this script goes anywhere near a learner" — phrases
  // lib/narration-blockers.ts detects — and it lists fifteen unreviewed borrowings of its own.
  // Nothing here was translated.
  //
  // NO `missingSlides`. All 21 English files are on disk, checked both directions by
  // tests/course-deck.test.ts.
  //
  // NO REFLECTION QUESTION ON ANY SLIDE: reading-landscape.en.md carries no [pause], the same
  // authoring shape as soil-health, food-forest, market-community, plant-guilds and small-livestock.
  // Nothing was traded away for a prompt because there was never a prompt to trade — and with the
  // question band empty, every slide in this deck shows every supporting line its script has. Zero
  // dropped, on all 21.
  //
  // TEN PARAGRAPHS ACROSS NINE SLIDES SHOW ONLY THEIR OPENING SENTENCE. That is signpost()'s
  // 140-character rule; it is a property of the shared renderer rather than of this module, and it
  // is named here because the loss is invisible in every other way — 21 files, all present, all the
  // right size — while the narration still speaks every word, so a learner listening hears
  // sentences that are not on the card in front of them. The costly ones:
  //
  //   slide 12  loses "KZN escarpment farms face cold south-westerly fronts in winter and humid
  //             easterlies in summer." The slide keeps the Highveld half and drops the one sentence
  //             addressed to the audience this course is built for, on a slide whose very next line
  //             is "Know your region's pattern before planting."
  //   slide 08  loses "South-facing slopes are cooler and moister. On the Highveld, frost can sit
  //             in south-facing hollows long after it clears elsewhere." Keeping only "North-facing
  //             slopes are warmer and drier" leaves half of the comparison the slide exists to draw.
  //   slide 18  is reduced to "These are pioneer weeds." — a dangling definition. What goes is
  //             "They colonise ground that has been disturbed or compacted. Mark the area on your
  //             map so your future design responds to the soil condition", which is the instruction.
  //   slide 04  loses "Watch for rills, places where water fans out, ponds, and every point where
  //             water leaves your property" — the whole of what to look for, on the slide that
  //             sends the farmer out to look.
  //   slide 19  loses the reason: "They can come from different directions, so a windbreak or crop
  //             position that works in one season may be wrong in the other."
  //   slide 17  loses "Draw what already exists before planning changes" — its actual instruction —
  //             because that paragraph is 142 characters against a limit of 140.
  //
  //   Also 02 (three of its four patterns), 06, 10 and 14.
  //
  // NOT A FITTER LIMIT, and measured rather than assumed. The cut happens in signpost() BEFORE
  // anything is laid out, so the fitter never sees the missing text and never had to refuse it:
  // re-rendering with the character rule removed puts all ten paragraphs back whole, at or above
  // the 0.82 floor, with zero supporting lines dropped anywhere in the deck. The same probe
  // restores six truncated paragraphs on intro-permaculture at the cost of the reflection question
  // on its slides 7, 14 and 16 — which is the trade fit()'s own docblock already declares ("CONTENT
  // WINS ... what gets sacrificed first is the reflection question"). That fix belongs to the
  // renderer and to every generated deck at once, not to this entry, so it is reported here and not
  // taken here.
  //
  // FOUR OF 21 SLIDES ARE TITLED "Watch: …" — 5, 9, 13 and 17 — and public/course-animations/ holds
  // nothing for this module, so no animation map is passed. Sharper here than elsewhere: these
  // slides do not merely promise a clip in the title, their body text points at one. Slide 5 reads
  // "The picture shows rain moving downhill" and slide 17 "Use the picture as a guide" — on a card
  // that is the only picture there is. Pre-existing course content, not introduced here.
  'reading-landscape': {
    slideLanguages: ['en'],
    imageExt: 'svg',
    slides: slidesFromNarration('reading-landscape', {}),
  },
};

export function deckFor(moduleId: string): ModuleDeck | null {
  return COURSE_DECKS[moduleId] ?? null;
}

export function hasDeck(moduleId: string): boolean {
  const d = COURSE_DECKS[moduleId];
  return Boolean(d && d.slides.length > 0);
}

/**
 * Which language's slides to show, and whether it is the one asked for.
 *
 * Mirrors resolveNarrationLang deliberately: `exact: false` exists so the UI can TELL the learner
 * it is showing English, instead of quietly serving a language they may not read. A farmer who
 * cannot read the slide should know that is the app's gap, not their own.
 */
export function resolveDeckLang(moduleId: string, want: string): { lang: string; exact: boolean } | null {
  const deck = COURSE_DECKS[moduleId];
  if (!deck || deck.slides.length === 0) return null;
  if (deck.slideLanguages.includes(want)) return { lang: want, exact: true };
  if (deck.slideLanguages.includes('en')) return { lang: 'en', exact: false };
  return null;
}

export function slideImageUrl(moduleId: string, lang: string, slide: number): string | null {
  const deck = COURSE_DECKS[moduleId];
  if (!deck || !deck.slideLanguages.includes(lang)) return null;
  if (!deck.slides.some((s) => s.slide === slide)) return null;
  if (deck.missingSlides?.[lang]?.includes(slide)) return null;
  return `/course-decks/${moduleId}/${lang}/slide-${String(slide).padStart(2, '0')}.${deck.imageExt ?? 'jpg'}`;
}

/**
 * The image to show for one slide, and whether it is in the language asked for.
 *
 * PER SLIDE, not per deck. Falling the whole module back to English because one localized asset
 * is missing would take a finished lesson away from the person it was made for. `exact: false` is
 * returned only on the fallback slide, so the UI's explanation appears where it is true.
 */
export function slideImageFor(
  moduleId: string,
  lang: string,
  slide: number,
): { url: string; lang: string; exact: boolean } | null {
  const own = slideImageUrl(moduleId, lang, slide);
  if (own) return { url: own, lang, exact: true };
  const fallback = lang === 'en' ? null : slideImageUrl(moduleId, 'en', slide);
  return fallback ? { url: fallback, lang: 'en', exact: false } : null;
}

export function animationUrls(moduleId: string, slide: number): { video: string; poster: string; bytes: number; seconds: number } | null {
  const a = COURSE_DECKS[moduleId]?.slides.find((s) => s.slide === slide)?.animation;
  if (!a) return null;
  return {
    video: `/course-animations/${moduleId}/${a.src}.mp4`,
    poster: `/course-animations/${moduleId}/posters/${a.poster}.jpg`,
    bytes: a.bytes,
    seconds: a.seconds,
  };
}

/** Narration for a slide, in the learner's language where it exists. */
export function slideAudioUrl(moduleId: string, lang: string, slide: number): string | null {
  return trackUrl(moduleId, lang, slide);
}

/** "2.2 MB" — shown on the play button. Farmers on metered data decide with the number in front of them. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Total cost of watching every clip in a module — so "play all" is never a surprise. */
export function deckAnimationBytes(moduleId: string): number {
  return (COURSE_DECKS[moduleId]?.slides ?? []).reduce((sum, s) => sum + (s.animation?.bytes ?? 0), 0);
}

/** How many slides a given lesson owns — shown on the "Watch and listen" button so the learner
 *  knows the size of what they are opening before they open it. */
export function deckSlideCount(moduleId: string, lessonId?: string): number {
  const slides = COURSE_DECKS[moduleId]?.slides ?? [];
  return lessonId ? slides.filter((s) => s.lesson === lessonId).length : slides.length;
}

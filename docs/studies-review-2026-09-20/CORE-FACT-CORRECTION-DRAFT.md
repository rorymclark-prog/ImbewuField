# Draft — two core fact corrections for editorial review

Prepared 21 September 2026 from the two bounded leads in
`docs/studies-review-2026-09-20/reserve/design/SOURCES.md`. This is a proposed
editorial handoff only. It has not received practitioner, facilitator, language,
or learner review, and it does not approve publication.

## 1. Twelve-principle attribution

**Evidence.** David Holmgren's own *Essence of Permaculture* distinguishes the
term permaculture, which he says was coined with Bill Mollison, from his own
twelve-principle formulation. He describes that set as differing from the
formulations used by other permaculture teachers.

- [Holmgren, *Essence of Permaculture*](https://holmgren.com.au/downloads/Essence_of_Pc_EN.pdf)

**Current sentence** (`lib/course-modules.ts:103`; narration transcript
`lib/course-transcripts.ts:468`):

> Bill Mollison and David Holmgren distilled permaculture into twelve design principles.

**Proposed plain-language replacement:**

> David Holmgren set out these twelve permaculture design principles.

This preserves the course's named twelve-principle framework without making a
joint-attribution claim. The current lesson quiz does not repeat this claim.

**Proposed replacement narration: Introduction to Permaculture, slide 09**
(`intro-permaculture-l2`; keep the same three-principle teaching sequence):

> David Holmgren set out these twelve permaculture design principles.
>
> You can start by practising three of them on a South African smallholding.
>
> Observe and interact. Catch and store energy. Use edges and value the marginal.
>
> We will take those three one at a time.

The corresponding still, `public/course-decks/intro-permaculture/en/slide-09.jpg`,
says only “Twelve Principles”; it needs no factual-text change.

## 2. A-frame observation and earthwork design

**Evidence.** FAO describes a calibrated A-frame and plumb-line level as a simple
tool for contouring, including calibration and accuracy conditions; it does not
support a universal two-person/two-hectare/morning productivity claim.

- [FAO, *Measuring Height Differences — Part 2*](https://www.fao.org/fishery/static/FAO_Training/FAO_Training/General/x6707e/x6707e06.htm)

South African conservation-structure research says placement, size, shape and
slope need hydraulic design and site-specific runoff, soil and slope assessment.

- [Reinders et al., “Design norms for soil and water conservation structures in the sugar industry of South Africa”](https://www.scielo.org.za/scielo.php?pid=S1816-79502019000100016&script=sci_arttext)

**Current lesson sentence** (`lib/course-modules.ts:186`; matching narration
`lib/course-transcripts.ts:581-583`):

> Build an A-frame level from three poles and a weighted string. Two people can trace contour lines — points at the same height — across a two-hectare property in a morning. No surveyor needed. These lines guide where you place swales, dams, and tree rows.

**Proposed plain-language replacement:**

> An A-frame level uses three poles and a weighted string. Calibrate it and check it before using it to mark preliminary contour observations. Before you plan or dig swales, dams, or other earthworks, assess the site and get suitable local technical advice.

This removes the unsupported time/area figure and blanket assurance while
retaining the learner's preliminary observation task. It introduces no
construction threshold, layout instruction, or numerical recommendation.

**Current quiz** (`lib/course-modules.ts:195-203`):

> You want to trace contours on a 1.5-hectare slope with no survey budget. What's most practical?
>
> - Hire a civil engineer
> - Estimate contours by eye
> - Build an A-frame level and walk it yourself
> - Use a spirit level on a board every 5 metres
>
> Correct: Build an A-frame level and walk it yourself
>
> Rationale: An A-frame level is nearly free to build and accurate enough for farm earthworks — you don't need survey-grade precision to place a swale correctly.

**Proposed quiz focused on the tool's limits:**

> You have calibrated and checked an A-frame level. What can it help you do?
>
> - Prove that the soil is suitable for a dam
> - Decide that a swale is safe to dig without other checks
> - Mark preliminary contour observations for later checking
> - Replace site assessment and technical advice
>
> Correct: Mark preliminary contour observations for later checking
>
> Rationale: A checked A-frame helps you observe level points. It does not prove that an earthwork is suitable or safe. Use those observations with site assessment and suitable local technical advice before planning or digging earthworks.

**Proposed replacement narration: Reading the Landscape, slide 06**
(`reading-landscape-l1`; revised to include the tool check):

> An A-frame level uses three poles and a weighted string. Calibrate it and check it before use.
>
> Walk it across the land to find points at the same height. Join these points to trace a contour line.
>
> Use the line as a preliminary observation of your land. Before you plan or dig swales, dams, or other earthworks, assess the site and get suitable local technical advice.

The still `public/course-decks/reading-landscape/en/slide-06.jpg` is an A-frame
image and contains none of the removed claims. `flow-a-frame` should be reviewed
for consistency with the approved wording, but this draft does not request an
animation change.

## Coordinated update and release checks after approval

1. Apply approved wording together in `lib/course-modules.ts` and the source
   narration scripts, then regenerate `lib/course-transcripts.ts` using
   `scripts/gen-course-transcripts.mjs`; do not hand-edit a generated transcript.
2. Obtain and listen to replacement English recordings for exactly:
   - `public/course-audio/intro-permaculture/en/slide-09.mp3`
   - `public/course-audio/intro-permaculture/en/full.mp3`
   - `public/course-audio/reading-landscape/en/slide-06.mp3`
   - `public/course-audio/reading-landscape/en/full.mp3`
   Import through `scripts/import-course-audio.mjs` only after the approved
   script blocks are present, so its count and pacing checks run.
3. Keep `lib/course-audio.ts` track identities and lesson mapping aligned:
   introduction slide 09 remains `intro-permaculture-l2` / “Twelve Principles”;
   landscape slide 06 remains `reading-landscape-l1` / “Trace Contours with an
   A-Frame”. Update its verification comments to record the replacement audio.
4. Regenerate exact byte entries for the four changed audio files in
   `lib/course-asset-sizes.ts`. The deck stills are unchanged, so their size
   entries remain unchanged.
5. Add a new one-time migration in `app/sw.js/route.ts` for the same four audio
   URLs. It must delete only those cached old responses from `imbewu-course-v1`,
   use a fresh marker path, preserve unrelated downloads, and never fetch a
   replacement automatically. Add the matching focused migration regression
   case in `tests/studies-media-migration.test.ts`.
6. Verify the revised player state online and after a prior download: the new
   transcript agrees with slide audio; a migration removes only outdated clip and
   full-track cache entries; and the lesson becomes ready only after the learner
   explicitly downloads replacements. Check the A-frame animation separately for
   wording consistency; no animation-quality approval is implied here.
7. Ask a suitable practitioner/facilitator to review the two approved claims.
   Before any non-English publication, have the revised strings and any
   replacement audio reviewed by a fluent language reviewer. The affected
   recordings are currently English-only, but translation readiness must not be
   inferred from that absence.

Run the repository's required checks after an approved implementation. This draft
does not itself alter lessons, quizzes, scripts, audio, media, manifests, caches,
or tests.

# Course visual assets: infographics, video, related lessons

Wiring for the visual assets generated from the course content (typically via NotebookLM):
a still infographic per lesson, a facilitator training video, and cross-links between lessons.
Owner of this doc and the code it describes: Track 1 (`lib/course-modules.ts`,
`app/student/page.tsx`, `components/course/**`).

## The decision this is built on

**Infographics render in-app for farmers. Video does not.**

The audience is smallholder farmers on metered rural mobile data — KZN connectivity cannot
reliably stream video per-visit. A still image is light enough to show a farmer inline, behind
a tap-to-load button (see `components/course/LessonInfographic.tsx`, which follows the same
never-autoload discipline as `components/course/CourseAudioPlayer.tsx`). A video is not, so it
never gets an inline player — `app/student/page.tsx` renders `videoUrl` as a plain external
link labelled as facilitator/training material, so a farmer can never land on a 50MB stream by
accident. That link is for whoever runs the in-person session, not the learner scrolling on
their phone.

## Adding an infographic to a lesson — 3 steps

1. **Put the image file under `public/course-images/`.**
   Convention: `public/course-images/<module-id>/<lesson-id>.jpg` (or `.png`/`.webp` — whatever
   the export gives you; there's no hardcoded extension requirement, the field just holds a
   URL). Module and lesson ids are the same ones already in `lib/course-modules.ts`
   (`COURSE_MODULES`), e.g. `public/course-images/seeds-sovereignty/seeds-sovereignty-l1.jpg`.
   Keep the file reasonably small — this is the same rural-data audience the audio player was
   built for. There's no automated size check, so use judgement (a few hundred KB, not several
   MB).

2. **Set two fields on the lesson in `lib/course-modules.ts`:**
   ```ts
   {
     id: "seeds-sovereignty-l1",
     // ...existing title, body, keyPoints, quiz — do not touch those...
     infographicUrl: "/course-images/seeds-sovereignty/seeds-sovereignty-l1.jpg",
     infographicAlt: "Diagram comparing open-pollinated and hybrid seed across three seasons of saving and replanting",
   }
   ```
   Both fields are optional on the `Lesson` type, but **`infographicAlt` is required whenever
   `infographicUrl` is set** — not enforced by the type system (most lessons legitimately have
   neither), but enforced by `tests/course-content.test.ts`, which fails `npm test` if you set
   one without the other.

3. **Run `npm test`.** `tests/course-content.test.ts` checks the pairing above, plus (for
   `relatedLessonIds`, see below) that every cross-linked id actually exists and that no lesson
   links to itself. If it's green, the diagram will show up in the lesson's accordion panel in
   the app, right after the audio player (if the lesson has one) and before the lesson body —
   the idea being the diagram frames the reading, not the other way round.

### What `infographicAlt` is actually for

Two jobs, not one:
- **Accessibility** — a screen reader reads it instead of the image.
- **The failure case** — on a bad rural connection the image can fail to load. When it does,
  `LessonInfographic` shows a plain "could not load" message rather than a broken-image icon,
  but the *alt text itself* is also what shows up if the image tag renders before JS finishes
  hydrating, or in any tooling that dumps raw HTML. Write it as a real sentence describing what
  the diagram shows, not a filename or a one-word label.

## Related lessons

`relatedLessonIds?: string[]` on a `Lesson` renders as a row of pill buttons at the end of the
lesson panel, after the quiz. Tapping one expands the module that owns the target lesson and
scrolls its panel into view.

```ts
{
  id: "water-harvesting-l1",
  // ...
  relatedLessonIds: ["reading-landscape-l1", "soil-health-l3"],
}
```

Every id must resolve to a real lesson somewhere in `COURSE_MODULES` — `tests/course-content.test.ts`
fails the build on a typo'd or renamed id. The UI *also* defensively drops any id that doesn't
resolve (in `LessonPanel` in `app/student/page.tsx`, via `LESSON_INDEX`), so if bad data ever
does slip through, a farmer sees nothing rather than a dead button — but the test is what's
supposed to catch it first, in CI, before it ships.

## Generating the facilitator video (slides + narration → mp4)

Three scripts, run in order:

1. **`node scripts/make-lesson-slides.mjs <module-id> <lang> [out-dir]`** — renders branded slide
   images straight from `docs/narration/<module-id>.<lang>.md` (one `slide-NN.png` per numbered
   section, same numbering as the narration).
2. *(optional)* **`node scripts/animate-lesson.mjs <name> <out.mp4>`** — a handful of data-driven
   motion diagrams for ideas a still can't carry (succession sowing, water on a slope, three
   sisters, zones). Replace the still it corresponds to: e.g. delete `slide-09.png` and put the
   output at `slide-09.mp4` in the same slides folder. You can also drop in a Gemini/Veo character
   clip the same way — same folder, same numbering, `.mp4`/`.mov` instead of `.png`.
3. **`node scripts/build-lesson-video.mjs <module-id> <lang> <slides-dir> [out.mp4]`** — pairs each
   slide with its narration clip (`public/course-audio/<module-id>/<lang>/slide-NN.mp3`, put there
   first with `scripts/import-course-audio.mjs`) and assembles the mp4. Each slide is held on
   screen for exactly its own narration clip's length — audio/picture sync by construction, not by
   hand-scrubbing.

### Slide-NN.mp4 instead of slide-NN.png (motion slides)

A slide in the folder from step 3 can be a video clip instead of a still — same numbering, same
folder (`slide-07.mp4` alongside `slide-06.png`). Rules, enforced by `build-lesson-video.mjs`:

- The clip always occupies **exactly** its narration clip's duration, same guarantee a still has
  always had.
- Clip **shorter** than the narration → the last frame freezes for the remainder (never loops — a
  looping animation under narration that's moved on to the next sentence reads as a glitch, not a
  choice).
- Clip **longer** than the narration → it's trimmed, and the script prints which slide and by how
  much *before* building (`slide 07: 10.0s clip trimmed to 8.3s of narration`), so you know before
  you watch rather than mid-review.
- The clip's own audio is always dropped — narration is the only voice on the mix.
- A still **and** a video for the same slide number is refused with the slide number named — which
  one should win is a guess the script won't make silently.
- Adding a motion slide switches the whole video's frame rate from 2fps (fine for a pure slideshow,
  and keeps file size down) to 24fps, so the motion isn't reduced to a stutter — file size goes up
  accordingly.

## Facilitator video

```ts
{
  id: "water-harvesting-l1",
  // ...
  videoUrl: "https://drive.google.com/...",
}
```

Renders as a labelled external link only — never an inline player. See "The decision this is
built on" above for why. Point it at wherever the facilitator deck/recording actually lives
(Drive, YouTube unlisted, etc.) — the app does not host or proxy it. (This is the *wiring* step,
after the mp4 from the previous section has been generated and uploaded somewhere.)

## Proofread the generated assets before wiring them in

The lesson text in `lib/course-modules.ts` (body, key points, quiz, species and place names)
has already been through review — a previous brief explicitly warned against "tidying" it, and
that still stands; don't touch lesson content while wiring in an image or link.

The **generated infographics have not been through the same review**, and NotebookLM has
already been caught introducing errors that aren't in the source text — for example, an
infographic rendering "ferment" as "**Forment**" and "maize" as "**moise**" when the lesson
text (correctly) says "ferment" and "maize". Proofread every generated image against the
lesson's own body text before setting `infographicUrl` — the repo's text is the source of
truth, not the image.

## Files involved

| File | What it owns |
|---|---|
| `lib/course-modules.ts` | The `Lesson` type's optional fields, and `LESSON_INDEX` (id → lesson + owning module id) |
| `components/course/LessonInfographic.tsx` | Tap-to-load image block, mirrors `CourseAudioPlayer`'s data discipline |
| `app/student/page.tsx` | Renders the infographic, the facilitator video link, and the related-lessons row inside `LessonPanel`; owns the jump-to-lesson scroll behaviour |
| `tests/course-content.test.ts` | CI guard: infographic pairing, related-lesson ids resolve, no self-references, ids unique |

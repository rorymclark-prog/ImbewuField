# How the course files are written

Every course folder has the same files. Two of them (`slides.md`, `media.md`) and the poster
headers in `posters.md` are **parsed by `scripts/courses/build.py`**, so their syntax is strict.
Everything else is free Markdown written to be read on a phone: short lines, short paragraphs,
tables no wider than 4 columns.

```
<course>/
  README.md        overview: audience, outcomes, timetable grid, poster wall, delivery rhythm
  day-0-preparation.md  (in-person courses)
  day-1.md …       the full facilitator script for each day (read from the phone)
  posters.md       every poster, fully specified (parsed headers)
  slides.md        every slide, deck by deck (parsed)
  media.md         every image / animation / photo the slides and posters need (parsed)
  resources.md     kit list, per-group materials, learner-brought, substitutes, budget
  (optional) printables.md, prompt-cards.md, visit-playbook.md, app-track.md,
  online-programme.md, micro-teaching-bank.md — course-specific extras
```

## IDs

| Prefix | Course |
|---|---|
| `F` | farmer-5day |
| `M` | mentor-3day |
| `T` | teach-the-teachers |
| `R` | farmer-money (R for Rand) |
| `A` | ai-literacy |

- Days: `F-D1` … Sessions: `F-D1-S2` (S0 = opening circle, SC = closing circle)
- Posters: `F-P01` … (two digits)
- Decks: `F-D1` (one deck per day). Slides: `F-D1-01` …
- Media: `F-IMG-01` still image · `F-ANI-01` animation · `F-PHO-01` real photograph needed ·
  `F-P01-ART` the text-free artwork for poster F-P01
- Cross-course references are allowed: a mentor slide may use `F-P11`.

## Day files (`day-N.md`)

Start with a one-screen **day at a glance** table, then one block per session:

```markdown
## F-D1-S2 · 10:50–12:30 · Build an A-frame (100 min)

**By the end, learners can:** build and calibrate an A-frame and find a level line.
(Outcome verbs only: make, show, find, measure, explain, name, choose, draw, plan, record.)

**Poster:** F-P06 · **Slides:** F-D1-09 → F-D1-12 · **Clip:** F-ANI-02 (optional)
**Materials (per group of 5):** …
**Room:** outside, gentle slope, 5 stations 3 m apart

| Time | Step | Teacher talk? |
|---|---|---|
| 10:50 | Hook — … | 5 min |
| … | … | … |

### Say / ask / do
Numbered, plain-language script. `SAY:` for things to say (short!), `ASK:` for questions,
`DO:` for actions, `GROUPS:` for the group instruction. Expected answers in *(italics)*.

### Debrief (the three questions)
### Key messages (max 4 — these are what learners must leave with)
### If things go wrong
### Language & inclusion notes
```

Every session also states its **teacher-talk minutes** so the ≤30% rule can be checked.

## `posters.md` (parsed)

```markdown
## F-P06 · Build an A-frame
- Size: A1 portrait
- Used in: F-D1-S2, F-D2-S2
- Art: F-P06-ART

**Headline:** Find the level line
**Art brief (text-free):** A tall wooden A-frame standing on bare ground…
**Labels on the poster (≤ 25 words, each ≤ 4 words):**
1. Two legs, 2 m
2. …
**Layout:** Headline top band; art fills centre 60%; labels as numbered callouts…
**Teach it — back-of-poster card (A5):**
1. …
```

`## <ID> · <title>` headers and the three `- Key: value` lines are parsed; the rest is
copied into the manifest and phone pack as-is.

## `slides.md` (parsed)

```markdown
# Deck F-D1 · Day 1 — Why we farm this way

## F-D1-01 · Welcome
Screen:
- Grow Food, Grow Strong
- Day 1 of 5
Media: F-IMG-01
Poster: F-P01
Notes:
Speaker notes: the short version of what to say. Point back to the day file session ID.
```

- `Screen:` max **3 bullets, max ~7 words each**. The picture carries the slide.
- `Media:` zero or more media IDs, comma-separated (first one is placed on the slide).
- `Poster:` the poster this slide mirrors (so the facilitator can switch).
- `Notes:` everything until the next `##` becomes PowerPoint speaker notes.
- A slide can be `Type: activity` (bold activity card: what groups do, for how long) or
  `Type: section` (divider). Default is content.

## `media.md` (parsed)

```markdown
## F-ANI-02 · A-frame: find the level
- Type: animation
- Status: REUSE public/course-animations/reading-landscape/flow-a-frame.mp4
- Used in: F-D1-10, F-D2-04
- Length: 12 s loop, silent

**Brief:** … (only needed for NEW items; for REUSE say what part of the clip to use)
```

- `Type:` `image` | `animation` | `photo` | `poster-art`
- `Status:` `NEW` or `REUSE <repo path>`
- Target path for NEW items is set by the build script:
  `public/course-media/<course>/<ID>.<jpg|mp4>`
- Animations: **silent**, 8–30 s, loopable, ≤ 3 MB, 1280×720, still poster frame (`.jpg`)
  alongside. Narration happens live, by the facilitator.

## App on / app off

Where a session uses the ImbewuField app, write it as a pair with the same time and outcome:
`### [APP] …` and `### [PAPER] …`. The course README says how to switch the app track on or off
for a whole programme. Slides for app-only content carry `Track: app` (the build marks them).

## Writing rules (all files)

- **Plain English at about Grade 6 reading level.** Short sentences. One idea per line.
- Facilitator scripts are *prompts*, not speeches. The facilitator talks ≤30% of the time.
- **Southern hemisphere:** the sun is in the **north**; north-facing slopes are warm.
- **No named invasive species** on posters or in illustrations (NEMBA). Name crops freely in
  text; illustrations use generic plant shapes unless the brief says otherwise.
- Money in **Rand (R)**. Measures in metric. Dates day-month.
- Name local examples (tins, 2 ℓ bottles, kraal manure, 20 ℓ drums) before bought ones.
- No promises of income. Speak of "saving money on food" and "selling surplus".
- Consent before photographs (POPIA). No photographs of children without guardian consent.

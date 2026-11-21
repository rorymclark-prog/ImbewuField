# ImbewuField training pathway — five courses

Five linked courses for agroecology / permaculture food-security programmes of the ACT·SEF
type: smallholders, new farmers, young and old, in rural and peri-urban South Africa.

| # | Course | Who takes it | Length | Folder |
|---|---|---|---|---|
| 1 | **Grow Food, Grow Strong** — the farmer course | Programme participants (farmers, new farmers, youth, gogos) | 5 days, 09:00–16:00 | [`farmer-5day/`](farmer-5day/README.md) |
| 2 | **Walking With Farmers** — the mentor course | Extension officers, community farmer-mentors, lead farmers, field supervisors | 3 days in person, *or* 6 weeks online + field tasks | [`mentor-3day/`](mentor-3day/README.md) |
| 3 | **Teach the Teachers** — permaculture & agroecology facilitation | People who will deliver Course 1 (and any permaculture / agroecology course) | 5 days, 08:30–16:30 | [`teach-the-teachers/`](teach-the-teachers/README.md) |
| 4 | **Farmer Money** — financial literacy for farming households | Programme farmers (after Course 1), savings groups, youth enterprises | 3 days, 09:00–16:00 (or 6 weekly half-days) | [`farmer-money/`](farmer-money/README.md) |
| 5 | **AI Literacy** — using AI safely and usefully on a phone | Farmers with smartphones, youth, mentors, facilitators | 2 days, 09:00–16:00 (or 4 half-days) | [`ai-literacy/`](ai-literacy/README.md) |

Order of *delivery* in a programme is usually **3 → 1 → 2 → 4 → 5**: train the facilitators,
they run the farmer course, mentors walk with the farmers through the season, and the money and
AI courses follow once gardens are producing. Every course can run on its own, and every course
can be taught **with or without the ImbewuField app** (app sessions are marked `[APP]` and always
have a `[PAPER]` twin of the same length).

## The rule every course is built on

**Assume there is no projector and no electricity.** Every lesson can be taught from a poster
on a wall, a tree or a fence. The facilitator's full notes are on their phone. If there *is* a
laptop, TV or projector, the slide deck (same lesson, same order, same media) is a bonus — the
facilitator can switch between poster and slides at any point, or use only one.

Three ways to teach the same session:

| Mode | What the facilitator holds | What the learners see |
|---|---|---|
| **Poster mode** (default) | Phone open at the day file, or the A5 "teach it" card on the back of each poster | A1 posters, real objects, the practical |
| **Slide mode** | Laptop / tablet with the `.pptx` (speaker notes = the day file) | TV / projector / a tablet passed round a small group |
| **Mixed** | Phone notes + a tablet or laptop for the animations only | Posters on the wall; 10–30 s animation clips shown to groups of 5 on a tablet |

## Lessons from the field, designed in

These come from Rory's 2022 facilitator-assessment report (23 courses, 729 learners, KZN /
Mpumalanga / Free State) and the April 2023 ACT/SEF Teach-the-Teachers course. Each one is a
design decision in these courses, not a footnote.

| What happened in the field | What these courses do about it |
|---|---|
| Practicals collapsed into one facilitator demonstrating to 25 people, even when materials for four groups were there | Every practical is written for **groups of 5 with named roles**; the kit is counted per group; the day file says "if you have only one set, rotate groups — never demo-only" |
| One A-frame for the whole class | Kit makes **one A-frame per group**; building it is a Day 1 practical |
| Projector unreadable in daylight | Poster mode is the default; slides are optional; tablets for small-group clips |
| Planting plans and spacing not followed | A spacing poster, a string-and-stick spacing tool each group makes, and a planting check in the mentor visit |
| Registers not filled in; certificates ran out | Register is the first 10 minutes of every day; certificate count = registered learners + 10% |
| Course started on a Monday with nothing ready | **Day 0 preparation day** is part of every course |
| Facilitators exhausted by back-to-back courses | Delivery rhythm in each course README: max 3 courses back to back, then a week at home |
| Teacher talk time crept up | **≤30% teacher talk** target, checked by the co-facilitator on the session sheet |
| Class sizes over 30 | Max 30 learners per course, 25 is ideal; 2 facilitators per course |
| Languages: longer discussions needed | Sessions carry "language time" buffers; every poster is designed to be retyped in isiZulu / Sesotho / siSwati / Xitsonga / Sepedi |
| Learners asked for posters for every lesson | Every session has at least one poster, fully specified |

## Folder map

```
courses/
  README.md                  ← you are here
  shared/
    FORMAT.md                how every file is written (session blocks, slide syntax, poster & media specs)
    poster-standards.md      print sizes, layout grid, typography, colours, art rules, translation
    facilitation-toolkit.md  circles, energisers, attention signals, groups of 5, debriefs, feedback
    forms.md                 register, POPIA consent, skills checklists, evaluation, certificates
    PRODUCTION-GUIDE.md      how to make the media: Gemini/Veo script, Flow + ChatGPT packs, Canva; bilingual posters
  farmer-5day/               Course 1
  mentor-3day/               Course 2
  teach-the-teachers/        Course 3
  farmer-money/              Course 4
  ai-literacy/               Course 5
  media-manifest.json        generated — every image / animation / poster, with brief and target path
  build/                     generated — .pptx decks and phone-readable HTML packs
```

Build the decks, phone packs and manifest:

```bash
pip install python-pptx markdown
python3 scripts/courses/build.py            # all courses
python3 scripts/courses/build.py farmer-5day
```

## Reuse of existing ImbewuField material

The app already carries 10 farmer modules (`lib/course-modules.ts`), a design course and a
finance course, plus ~55 animations under `public/course-animations/` and lesson infographics
under `public/course-images/`. These courses **reuse** them wherever they fit — the media
specs mark each item `REUSE <path>` or `NEW`. Codex only makes the `NEW` ones.

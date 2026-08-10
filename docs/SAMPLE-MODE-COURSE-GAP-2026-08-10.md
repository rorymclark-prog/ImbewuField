# The demo cannot show the course

**Date:** 2026-08-10
**Status:** finding, verified in the running app. No fix attempted — see "Why this is not just a
missing guard" below.

## What happens

With sample mode active, opening the Learning Portal bounces you to the sign-in page.

Verified in the running dev server, not inferred:

```js
// after clicking into sample mode, then navigating to /student
{ "url": "http://localhost:4343/login",
  "sampleFlag": [["imbewu_sample_mode", "1"]],
  "path": "/login" }
```

The flag is set. The redirect happens anyway.

## Where the gap is

`app/student/page.tsx:472`:

```js
if (!loading && !user && isLive) router.replace('/login');
```

That condition has no sample-mode term. **23 files across the app call `isSampleMode()`. None of
them is in `app/student/` or `components/course/`.** The four pages that honour it are
`contact`, `farmer`, `finances` and `invoice`.

So the Ubhejane Crèche demo shows a visitor the map, the farmer view, the finances and an invoice
— and cannot show them the course.

## Why that matters more than it looks

The 11-section report system and the course are the two things this app has that a generic mapping
tool does not. A prospective NGO, funder or mentor who opens the demo to decide whether this is
worth their time is shown everything except the differentiator.

It is also the part that is hardest to describe and easiest to demonstrate: ten modules, 33
lessons, field assignments a farmer photographs, and a deck player in two languages.

## Why this is not just a missing guard

Adding sample mode to the redirect would get someone onto the page and then break, because the
portal reads three Firestore collections — `course_progress`, `course_assignments`,
`course_submissions`. A demo needs an answer for each, and they are not the same answer:

- **Course content is entirely static.** Modules, lessons, key points, quizzes, infographics,
  narration and decks all come from `lib/course-modules.ts`, `lib/course-audio.ts` and files on
  disk. None of it needs a backend. **A read-only demo of the whole curriculum is nearly free.**
- **Progress** is a learner's own tick. Sample mode already has a localStorage shim
  (`lib/sample-mode.ts`), so demo progress could live there and be discarded with the session,
  exactly as the rest of the demo already promises ("Nothing here is saved").
- **Assignments and submissions** are mentor-owned and evidence-bearing. `firestore.rules`
  deliberately makes enrolment mentor-set — a learner cannot enrol themselves or set their own
  deadlines. A demo must not imply otherwise, and a fake submission screen that accepts a photo
  going nowhere would be worse than not showing one.

So the shape of the right fix is probably: **the curriculum and the deck player open in sample
mode; progress is session-local; assignment submission is visible but plainly inert.** That is a
product decision about what the demo promises, which is why this document stops here.

## What was not checked

I could not walk the authenticated Learning Portal. It requires sign-in, and entering credentials
is not something I do. Everything above is from the unauthenticated path plus the source.

The six-area walkthrough that motivated this — module gating, deck player, a quiz answered right
and wrong, the field assignment, and language switching — **remains undone**, and it is the only
part of the course nobody has checked by using it. Two defects found today by other means, the
"Title" caption in the live player and lesson art contradicting its own alt text, would both have
been visible in seconds of looking at the running app.

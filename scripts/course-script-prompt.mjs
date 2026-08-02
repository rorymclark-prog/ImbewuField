#!/usr/bin/env node
// Assemble the narration-script request for a module, ready to paste into ChatGPT.
//
// WHY: `npm run course:status` ends with 18 things to produce, and 14 of them start with the same
// sentence — "no English narration script — ChatGPT, deck + script prompt". That prompt was being
// rebuilt by hand every time, which is both the slow part and the part that goes wrong: the script
// is not just words, it DEFINES THE DECK. scripts/make-lesson-slides.mjs renders one slide per
// `**Slide N — Title**` block, so a script that drifts from the house format produces the wrong
// number of slides, and build-lesson-video.mjs then refuses the module outright.
//
// WHAT THIS DOES NOT DO: write the teaching. Every fact in the output prompt is lifted verbatim
// from lib/course-modules.ts — the lesson bodies, key points, quiz questions and rationales Rory
// already authored. This tool does the clerical half (gathering the content, stating the format,
// stating the limits) so the writing is the only thing left to do.
//
// The structure below is DERIVED from the three modules already produced, not invented:
//
//   water-harvesting    4 lessons -> 24 slides, 42 words/slide
//   vegetables-staples  4 lessons -> 18 slides, 89 words/slide
//   seeds-sovereignty   3 lessons -> 24 slides, 89 words/slide
//
// all three opening with a title slide and learning outcomes and closing with a field assignment,
// carrying roughly four to six teaching slides per lesson in between.
//
// USAGE
//   node scripts/course-script-prompt.mjs <module-id> [en|zu]
//   npm run course:script-prompt -- plant-guilds
//   npm run course:script-prompt -- plant-guilds zu > /tmp/prompt.txt

import { COURSE_MODULES } from '../lib/course-modules.ts';

const [moduleId, langArg = 'en'] = process.argv.slice(2);
const lang = langArg.toLowerCase();

if (!moduleId || !['en', 'zu'].includes(lang)) {
  console.error('usage: course-script-prompt.mjs <module-id> [en|zu]\n');
  console.error('modules:');
  for (const m of COURSE_MODULES) console.error(`  ${m.id}  (${m.lessons.length} lessons)`);
  process.exit(1);
}

const mod = COURSE_MODULES.find((m) => m.id === moduleId);
if (!mod) {
  console.error(`No module "${moduleId}". Run with no arguments to list them.`);
  process.exit(1);
}

// Front matter (title, why-it-matters, outcomes) and back matter (assignment, action) are fixed at
// 3 + 2 across the produced modules; the rest is teaching, at the observed 4–6 slides per lesson.
const FRONT = 3;
const BACK = 2;
const low = FRONT + mod.lessons.length * 4 + BACK;
const high = FRONT + mod.lessons.length * 6 + BACK;

const heading =
  lang === 'zu'
    ? '**Ikhasi 4 — Isihloko SesiZulu (Slide 4 — English Title)**'
    : '**Slide 4 — Plant on the Downhill Berm**';

const langRules =
  lang === 'zu'
    ? `
LANGUAGE — isiZulu
- Write the narration in isiZulu. Every heading carries BOTH languages, isiZulu first, with the
  English in brackets exactly as shown above. lib/narration-check.ts matches "Slide" OR "Ikhasi";
  a heading missing the bracketed English still parses but leaves the deck untitled in English.
- Use ordinary spoken farming isiZulu, the words a KwaZulu-Natal farmer actually uses out loud.
- DO NOT COIN TERMS. If there is no everyday isiZulu word for something, keep the English word in
  the sentence rather than inventing one. A previous draft coined 22 terms and is still blocked
  from recording because of it.
- isiZulu is agglutinative, so the same idea is fewer words than in English. Do not pad to match
  an English word count — the pacing check compares each clip to its OWN language's median.
- This output is a DRAFT. It must be read by a first-language isiZulu speaker who farms before any
  of it is recorded.`
    : `
LANGUAGE — South African English
- Write for a smallholder farmer in KwaZulu-Natal reading or hearing this, not for a classroom.
- Short spoken sentences. This is read aloud, so anything hard to say aloud is wrong.
- South African usage throughout: mielies, JoJo tank, bakkie, spade — the words on the farm.`;

const lessonBlocks = mod.lessons
  .map((l, i) => {
    const kp = l.keyPoints.map((k) => `  - ${k}`).join('\n');
    const quiz = l.quiz
      .map(
        (q) =>
          `  Q: ${q.q}\n  A: ${q.options[q.correct]}\n  Why: ${q.rationale}`,
      )
      .join('\n');
    return `### Lesson ${i + 1} — ${l.title}   (id: ${l.id})

${l.body}

KEY POINTS
${kp}

ASSESSED BY (the narration must make these answerable)
${quiz}`;
  })
  .join('\n\n');

process.stdout.write(`Write the ${lang === 'zu' ? 'isiZulu' : 'English'} narration script for one module of a permaculture
course for South African smallholder farmers.

The script is not only narration — IT DEFINES THE SLIDE DECK. A tool renders exactly one slide per
"Slide N" block, so the block list you write is the deck that gets built. Getting the format right
matters as much as getting the words right.

================================ MODULE ================================

${mod.title}
${mod.description}
${mod.lessons.length} lessons, about ${mod.durationMins} minutes, category: ${mod.category}

${lessonBlocks}

================================ OUTPUT FORMAT ================================

Markdown. Nothing before the first slide and nothing after the last except an appendix under its
own "## " heading. Each block is exactly:

${heading}

One idea, in two to five short lines, each on its own line with a blank line between them.

---

RULES
- Number slides from 1 with no gaps. Aim for ${low}–${high} slides in total.
- 40–90 words per slide. Under 40 the slide is thin; over 90 the farmer loses the thread.
- Open with: a title slide, a "why this matters" slide, then "Learning Outcomes".
- Close with a "Field Assignment" slide and a "Field Action" slide.
- In between, four to six slides per lesson, in the lesson order given above.
- Where an idea is better shown than told, title that slide "Watch: <what is shown>" and keep the
  words to what the picture cannot say. Do not add more than one per lesson.
- A "Watch:" slide gets 15–35 WORDS. Not 40, not a paragraph. This is a hard budget and it is the
  rule most often broken: every module's first draft has come back with watch slides the same
  length as its teaching slides, which is the picture and the voice competing to teach the same
  thing at the same moment. Orient the eye and stop — "Follow the water from the roof to the
  tank." A list of items the picture already shows is exactly what does not belong here.
- Separate every block with a line containing only ---
- Never put a markdown heading (#, ##) inside a block. A heading ends the block, and a glossary
  written without one was once counted as 1 052 words of slide 18's narration.
${langRules}

WHAT YOU MAY NOT DO
- Do not introduce any number that is not in the lesson content above — no spacings, yields,
  depths, timings, rainfall, prices or percentages. If a figure would help and is not given, write
  the sentence without it.
- Do not name a plant species that does not appear above. Some species are illegal to propagate in
  South Africa under NEMBA, and this course must not be the thing that suggests one.
- Do not contradict, soften or "improve" a lesson's facts. Narrate what is written.
- DO NOT HEDGE A DEFINITE CLAIM. This is the single most common failure and it is always the same
  shape: the source says a thing happens and the narration says it might. "dies at the first
  Highveld frost" became "can die after"; "won't fruit" became "may not fruit"; "casts no shade in
  summer" became "casts little shade"; "most smallholders" became "many". Every one of those
  reads as caution and is actually a different, weaker instruction — a farmer who hears "may not
  fruit" plants the tree anyway. If the lesson states it flatly, state it flatly.
- Do not invent a farmer's experience, a place name, or a story presented as real.

Write the full script now.
`);

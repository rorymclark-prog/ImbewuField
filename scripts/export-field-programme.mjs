#!/usr/bin/env node
// A readable review copy of the same activities shown in Studies, regenerated from one source.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CORE_FIELD_CYCLES, ELECTIVE_FIELD_PATHWAYS, FIELDWORK_SOURCES, fieldworkForLesson } from '../lib/course-fieldwork.ts';
import { COURSE_MODULES, LESSON_INDEX } from '../lib/course-modules.ts';

const lines = [
  '# ImbewuField — expanded field programme', '',
  'English authoring edition · 7 September 2026', '',
  'This is the written practical companion to the existing studies. It contains 36 core weekly cycles and four elective pathways, with three activities per pathway. These are learning cycles, not 36 additional app lessons. All 33 existing lessons retain their IDs and have linked practical activities.', '',
  'The scope comes from Rory’s **ImbewuField Training Audit and 36 Week Plan**, recovered from the July 2026 document. The new activities below were authored for this continuation. Facilitator and language review remain outstanding; this document does not certify completed bilingual media or change graduation requirements.', '',
  'Use the week numbers as a learning sequence. The facilitator adapts actual field work to local weather, water, crop stage and resources. Keep evidence on paper or in the field journal, and use the existing assignment submission when requested. No photograph, survey response, planting or harvest should be claimed before it exists.', '',
  'Generated from `lib/course-fieldwork.ts` with `node --import ./tests/register-alias.mjs scripts/export-field-programme.mjs`. Edit the source and regenerate this copy.', '',
  '## Where each existing lesson is expanded', '',
  '| Module and lesson | Core weeks | Elective activities |',
  '| --- | --- | --- |',
];
for (const mod of COURSE_MODULES) for (const lesson of mod.lessons) {
  const activities = fieldworkForLesson(lesson.id);
  lines.push(`| ${mod.title}: ${lesson.title} | ${activities.filter((a) => a.week).map((a) => a.week).join(', ') || '—'} | ${activities.filter((a) => !a.week).map((a) => a.title).join('; ') || '—'} |`);
}
function cycle(c) {
  lines.push('', `### ${c.week ? `Week ${c.week} — ` : ''}${c.title}`, '',
    `**Read alongside:** ${c.lessonIds.map((id) => LESSON_INDEX.get(id).lesson.title).join('; ')}.`, '',
    `**Why this matters.** ${c.why}`, '', `**Look closely.** ${c.see}`, '', '**Try it in the field**', '',
    ...c.steps.map((step, i) => `${i + 1}. ${step}`), '', `**Keep a record.** ${c.record}`, '',
    `**Think it through.** ${c.reflect}`, '', `**Facilitator check.** ${c.mentorCheck}`, '',
    `**If the timing is wrong.** ${c.whenBlocked}`, '',
    ...(c.sourceIds ?? []).map((id) => `Supporting reading: [${FIELDWORK_SOURCES[id].title}](${FIELDWORK_SOURCES[id].url}).`));
}
lines.push('', '## Core programme');
CORE_FIELD_CYCLES.forEach(cycle);
for (const pathway of ELECTIVE_FIELD_PATHWAYS) {
  lines.push('', `## Elective pathway — ${pathway.title}`, '', pathway.purpose);
  pathway.cycles.forEach(cycle);
}
const target = fileURLToPath(new URL('../docs/COURSE-FIELD-PROGRAMME-2026-09-07.md', import.meta.url));
writeFileSync(target, `${lines.join('\n')}\n`);
console.log(`Wrote ${CORE_FIELD_CYCLES.length} core cycles and ${ELECTIVE_FIELD_PATHWAYS.length} pathways to ${target}`);

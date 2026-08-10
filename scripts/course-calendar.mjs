#!/usr/bin/env node
// The course against the nine months it promises — week by week.
//
// WHY: "nine months" is stated in design/DESIGN.md, lib/db/types.ts and the demo task list, but
// nothing in the app has ever known what week a learner is in. `npm run course:status` answers
// "is this module produced?"; this answers the different question "does the course fill the span
// we sell?" — and, because several assignments wait on rain and on a harvest, "can a learner even
// do this one in the week we put it in?".
//
// It authors nothing. Every figure is read from lib/course-assignment-content.ts and
// lib/course-modules.ts at run time.
//
// USAGE
//   npm run course:calendar

import {
  COURSE_WEEKS,
  SEASONAL_CONDITIONS,
  conditionQuote,
  courseCoverage,
  harvestGaps,
  layOutCourse,
} from '../lib/course-calendar.ts';

const STATE_MARK = { reading: 'read', 'field-work': 'work', empty: '·' };

const weeks = layOutCourse();
const cov = courseCoverage();

console.log('');
console.log(`  ImbewuField course — ${COURSE_WEEKS} weeks promised (the "9-month course")`);
console.log('');
console.log(
  `  ${cov.readingMinutes} minutes of lessons · ${cov.minimumDays} days of field work at the course's own fastest pace`,
);
console.log('');

console.log('  WEEK  MODULE                 ');
console.log('  ─────────────────────────────────────────');
for (const w of weeks) {
  const label = w.moduleId ?? '(nothing scheduled)';
  console.log(
    `  ${String(w.week).padStart(2)}    ${label.padEnd(22)} ${STATE_MARK[w.state] ?? ''}`,
  );
}

console.log('');
console.log(
  `  ${cov.scheduledWeeks} of ${cov.totalWeeks} weeks have something in them. ${cov.emptyWeeks} do not.`,
);
if (cov.unplacedModules.length > 0) {
  console.log(`  RAN PAST THE SPAN: ${cov.unplacedModules.join(', ')}`);
}

console.log('');
console.log('  WAITS ON THE REAL WORLD — the course says so in its own words:');
console.log('');
for (const c of SEASONAL_CONDITIONS) {
  const quote = conditionQuote(c);
  console.log(`   · ${c.moduleId} — needs ${c.needs}`);
  console.log(`     "${quote}"`);
}

const gaps = harvestGaps();
if (gaps.length > 0) {
  console.log('');
  console.log('  ORDERING:');
  for (const g of gaps) {
    console.log(
      `   · ${g.moduleId} asks for a harvest ${g.daysSincePlanting} days after ${g.plantingModuleId}`,
    );
    console.log('     asks the learner to plant. Check that is long enough for anything to be ready.');
  }
}
console.log('');

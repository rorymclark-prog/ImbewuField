import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Simple / All tools (lib/app-level.ts) on /mentor. All tools is this screen exactly as it has
// always been; Simple hides the "View curriculum" chip cloud, per-module duration tags and the
// search box on a short roster, collapses the three cohort stat cards into one line, replaces the
// per-module Assign / due-date grid with a single "Assign" picker, and shortens the enrolment
// status pill to two states. See app/mentor/page.tsx's own comments for the reasoning.

const source = () => readFileSync(new URL('../app/mentor/page.tsx', import.meta.url), 'utf8');

test('the page reads Simple / All tools from lib/app-level.ts and threads it into TraineeCard', () => {
  const src = source();
  assert.match(src, /import \{ useAppLevel \} from '@\/lib\/app-level'/, 'useAppLevel import is gone');
  assert.match(src, /const simple = useAppLevel\(\) === 'simple'/, 'the page no longer reads the Simple/All tools level');
  assert.match(src, /simple=\{simple\}/, 'TraineeCard is no longer told which level to render');
});

test('Simple collapses the three cohort stat cards into one line; All tools keeps the 3-card grid', () => {
  const src = source();
  assert.match(src, /\{simple \? \(\s*<div className="rounded-2xl px-4 py-3 flex items-center justify-center gap-4 flex-wrap text-center"/,
    'the Simple one-line cohort summary is gone');
  assert.match(src, /\) : \(\s*<div className="grid grid-cols-3 gap-3">/,
    'the All-tools 3-card cohort grid is gone or no longer the All-tools branch');
});

test('Simple hides the "View curriculum" chip cloud; All tools keeps it', () => {
  const src = source();
  assert.match(src, /\{!simple && \(\s*<details className="rounded-2xl px-4 py-3\.5"/,
    'the curriculum chip cloud is no longer gated behind !simple');
  assert.match(src, /View curriculum/, 'the curriculum disclosure text is gone entirely');
});

test('Simple hides the search box only while the roster is short (under 8)', () => {
  const src = source();
  assert.match(src, /\{\(!simple \|\| trainees\.length >= 8\) && \(/,
    'the search box is no longer conditional on Simple + a short (<8) roster');
});

test('Simple replaces the per-module duration tag and Assign/due-date grid with one Assign picker', () => {
  const src = source();
  const pickerAt = src.indexOf('unassignedModules.map((m) =>');
  assert.ok(pickerAt > 0, 'the module-list Simple picker moved — recheck this guard by hand');
  const branchStart = src.lastIndexOf('{simple ? (', pickerAt);
  assert.ok(branchStart > 0, 'could not find the module-list Simple/All-tools branch in TraineeCard');
  const end = src.indexOf(') : COURSE_MODULES.map((mod) => {', pickerAt);
  assert.ok(end > pickerAt, 'could not find the end of the Simple module-list branch');
  const simpleBlock = src.slice(branchStart, end);

  assert.doesNotMatch(simpleBlock, /mod\.durationMins/, 'the per-module duration tag is still shown in Simple');
  assert.doesNotMatch(simpleBlock, /due-\$\{trainee\.id\}-\$\{mod\.id\}/, 'the per-module due-date input is still shown in Simple');
  assert.doesNotMatch(simpleBlock, /onUnassign\(trainee\.id, mod\.id\)/, 'the per-module unassign control is still shown in Simple');
  assert.match(simpleBlock, /unassignedModules\.map/, 'the single-picker module <select> is gone from Simple');
  assert.match(simpleBlock, /onAssign\(trainee\.id, pickerModule, null\)/, 'the single Assign action is gone from Simple');

  const allToolsBlock = src.slice(end, src.indexOf('trainee.phone', end));
  assert.match(allToolsBlock, /mod\.durationMins/, 'All tools lost the per-module duration tag');
  assert.match(allToolsBlock, /onUnassign\(trainee\.id, mod\.id\)/, 'All tools lost the per-module unassign control');
});

test('Simple shortens the enrolment status pill to two states: on track / needs attention', () => {
  const src = source();
  assert.match(src, /const SIMPLE_NEEDS_ATTENTION = new Set<EnrollmentStatus>\(\['paused', 'withdrawn'\]\)/,
    'the two-state status mapping changed — recheck which states count as "needs attention"');
  assert.match(src, /function simpleStatusLabel/, 'the two-state status label helper is gone');
  assert.match(src, /\{simple \? simpleStatusLabel\(status, lang\) : lang === 'zu' \? MENTOR_STATUS_ZU\[status\] : STATUS_LABEL\[status\]\}/,
    'the status pill no longer switches to the two-state label in Simple');
});

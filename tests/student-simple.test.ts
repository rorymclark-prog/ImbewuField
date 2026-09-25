import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Source-text guard tests for the Study — Simple mode track: /student, /student/design,
// /student/finance and their fixes. Same pattern as tests/home-next-step-links.test.ts and
// tests/app-level.test.ts — these screens are not pure functions of exported data, so the guard
// reads the real shipped source and pins the wiring a farmer (Simple) or a mentor/facilitator
// (All tools) would actually see.

const STUDENT_SOURCE = readFileSync(new URL('../app/student/page.tsx', import.meta.url), 'utf8');
const OFFLINE_DOWNLOAD_SOURCE = readFileSync(new URL('../components/course/OfflineDownload.tsx', import.meta.url), 'utf8');
const COURSE_MODULES_SOURCE = readFileSync(new URL('../lib/course-modules.ts', import.meta.url), 'utf8');
const COURSE_GATING_SOURCE = readFileSync(new URL('../lib/course-gating.ts', import.meta.url), 'utf8');
const COURSE_ASSIGNMENTS_SOURCE = readFileSync(new URL('../lib/course-assignments.ts', import.meta.url), 'utf8');
const DESIGN_SOURCE = readFileSync(new URL('../app/student/design/page.tsx', import.meta.url), 'utf8');
const DESIGN_LESSON_SOURCE = readFileSync(new URL('../app/student/design/[lesson]/page.tsx', import.meta.url), 'utf8');
const FINANCE_SOURCE = readFileSync(new URL('../app/student/finance/page.tsx', import.meta.url), 'utf8');
const FINANCE_LESSON_SOURCE = readFileSync(new URL('../app/student/finance/[lesson]/page.tsx', import.meta.url), 'utf8');
const TIPS_SOURCE = readFileSync(new URL('../app/tips/page.tsx', import.meta.url), 'utf8');

test('/student reads the Simple / All tools switch', () => {
  assert.match(STUDENT_SOURCE, /const simple = useAppLevel\(\) === 'simple';/);
});

test('Simple hides the production-readiness badge; All tools keeps it', () => {
  const badge = STUDENT_SOURCE.slice(STUDENT_SOURCE.indexOf('HOW FINISHED THIS MODULE IS'));
  assert.match(badge, /\{!simple && \(/, 'the readiness badge must be gated on Simple');
  assert.match(badge, /studentReadinessComplete/, 'the readiness label itself must still exist for All tools');
});

test('Simple hides the OfflineDownload Standard/Higher quality picker; farmers still get Standard by default', () => {
  assert.match(OFFLINE_DOWNLOAD_SOURCE, /const simple = useAppLevel\(\) === 'simple';/);
  assert.match(OFFLINE_DOWNLOAD_SOURCE, /hasHigher && !busy && phase !== 'done' && !simple && \(/);
  assert.match(OFFLINE_DOWNLOAD_SOURCE, /useState<PackQuality>\('standard'\)/, 'quality must still default to standard');
});

test('Simple collapses the overdue/due-soon dual counts to one urgency line', () => {
  const summary = STUDENT_SOURCE.slice(
    STUDENT_SOURCE.indexOf('What the mentor has actually asked for'),
    STUDENT_SOURCE.indexOf('ONE TAP, THE WHOLE COURSE'),
  );
  assert.match(summary, /simple \? \(/, 'the assignment summary must branch on Simple');
  assert.match(summary, /assignSummary\.overdue > 0 \? \(/, 'Simple picks overdue over due-soon rather than stacking both counts');
  assert.match(summary, /studentAssignmentsOrder/, 'All tools must still show the ordering note');
});

test('Simple drops the category text chip next to "Continue here" for a colour dot', () => {
  const chip = STUDENT_SOURCE.slice(STUDENT_SOURCE.indexOf("Content — tap to expand lessons"));
  assert.match(chip, /simple \? \(/);
  assert.match(chip, /borderRadius: '50%', background: color/, 'Simple must show a plain colour dot instead of the text chip');
  assert.match(chip, /t\(CATEGORY_LABEL_KEYS\[mod\.category\]\)/, 'All tools must still show the category label text');
});

test('Simple reduces the progress hero to the ring and one stat', () => {
  const hero = STUDENT_SOURCE.slice(STUDENT_SOURCE.indexOf('aria-labelledby="studies-title"'), STUDENT_SOURCE.indexOf('What the mentor has actually asked for'));
  assert.match(hero, /\{!fetching && !simple && \(/, 'the modules-complete count must be All tools only in Simple');
  assert.match(hero, /\{!simple && pct < 100 && totalMins > 0 && \(/, 'the remaining-time chip must be All tools only');
  assert.match(hero, /\{!simple && pct === 100 && \(/, 'the practitioner badge must be All tools only');
});

test('Simple shows the Design/Finance companion previews as two plain links', () => {
  assert.match(
    STUDENT_SOURCE,
    /simple \? \(\s*\n\s*\/\/ Two plain links[\s\S]*?studentDesignPreviewCardTitle[\s\S]*?studentFinancePreviewCardTitle/,
    'Simple must branch to a plain-link pair naming both companion pathways',
  );
});

test('ochre is never painted as readable text: the due-soon tone and the category text-colour variant', () => {
  assert.match(STUDENT_SOURCE, /'due-soon':\s*\{ fg: '#7A4408'/, 'ASSIGNMENT_TONE due-soon.fg must be the text-safe ochre');
  assert.match(COURSE_MODULES_SOURCE, /CATEGORY_TEXT_COLORS[\s\S]*?design: "#7A4408"/, 'CATEGORY_TEXT_COLORS.design must be the text-safe ochre');
  // Every site that paints the category colour as text (not a fill/border/icon) must use the
  // text-safe variant, not the raw CATEGORY_COLORS/`color` fill value.
  assert.match(STUDENT_SOURCE, /style=\{\{ color: textColor \}\}>\{t\('studentKeyPoints'\)\}/);
  assert.match(STUDENT_SOURCE, /color: textColor, cursor: 'pointer' \}\}/, 'the related-lessons buttons must use the text-safe colour');
  assert.match(STUDENT_SOURCE, /background: `\$\{color\}10`, color: textColor, border: `1px solid \$\{color\}20` \}\}/);
  assert.match(STUDENT_SOURCE, /background: color \+ '18', color: textColor, border: `1px solid \$\{color\}30` \}\}/);
});

test('a locked module names the previous module by its localised title, not raw English', () => {
  assert.match(
    COURSE_GATING_SOURCE,
    /titleFor: \(moduleId: string\) => string = \(id\) => MODULE_TITLE\.get\(id\) \?\? 'the previous module',/,
    'unlockReason must accept a title resolver, defaulting to the existing English behaviour',
  );
  assert.match(STUDENT_SOURCE, /unlockReason\(mod\.id, gatingCtx, \(id\) => localisedModuleTitle\(id, lang\)\)/);
});

test('the mark-done toggle and the submission self-check items expose aria-pressed', () => {
  assert.match(
    STUDENT_SOURCE,
    /aria-label=\{done \? t\('studentMarkNotDone'\) : t\('studentMarkComplete'\)\}\s*\n\s*aria-pressed=\{done\}/,
  );
  assert.match(
    STUDENT_SOURCE,
    /onClick=\{\(\) => toggleCheck\(item\)\}\s*\n\s*aria-pressed=\{isChecked\}/,
  );
});

test('assignment due dates localise the month abbreviation itself, not just the surrounding wrapper text', () => {
  assert.match(COURSE_ASSIGNMENTS_SOURCE, /const MONTHS_ZU = \[/);
  assert.match(COURSE_ASSIGNMENTS_SOURCE, /export function formatDue\(due_at: string \| null, today: string, lang: string = 'en'\)/);
  assert.match(STUDENT_SOURCE, /formatDue\(assignment\.due_at, today, lang\)/);
});

test('/student/design and /student/finance collapse their syllabus grid to the next lesson in Simple', () => {
  assert.match(DESIGN_SOURCE, /<CourseSyllabus/);
  assert.match(FINANCE_SOURCE, /<CourseSyllabus/);
});

test('/student/design and /student/finance hide their sources/further-reading lists and the ten-day plan in Simple', () => {
  assert.match(DESIGN_SOURCE, /<FullToolsOnly><details><summary>Sources behind the pathway<\/summary>/);
  assert.match(DESIGN_LESSON_SOURCE, /<FullToolsOnly><details><summary>Sources and further reading<\/summary>/);
  assert.match(FINANCE_SOURCE, /<FullToolsOnly>\s*<section className=\{styles\.section\}>\s*<h2>A proposed ten-day course<\/h2>/);
  assert.match(FINANCE_LESSON_SOURCE, /<FullToolsOnly><section className=\{`\$\{styles\.section\} \$\{styles\.sourceLinks\}`\}><details><summary>Sources and further reading<\/summary>/);
  // Kept in both modes: the lesson reading, the isiZulu-draft disclosure banner, the app-guide links.
  assert.match(DESIGN_SOURCE, /<DesignDraftNotice \/>/);
  assert.match(FINANCE_SOURCE, /<FinanceReadingChecklist/);
});

test('tips page routes its hero, section headings and controls through the translation pattern', () => {
  assert.match(TIPS_SOURCE, /useLanguage/);
  assert.match(TIPS_SOURCE, /t\('tipsTitle'\)/);
  assert.match(TIPS_SOURCE, /t\('tipsVideoGuidesTitle'\)/);
  assert.match(TIPS_SOURCE, /t\('navTour'\)/);
  assert.doesNotMatch(TIPS_SOURCE, /<h1>Tips &amp; help<\/h1>/, 'the hero title must no longer be a hard-coded literal');
});

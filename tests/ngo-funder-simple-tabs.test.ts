import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Simple / All tools (lib/app-level.ts) on the two organisation-facing dashboards. All tools is
// each tab strip exactly as it has always been; Simple declutters it — see app/ngo/page.tsx and
// app/funder/page.tsx's own comments for what moves where and why.

const ngo = () => readFileSync(new URL('../app/ngo/page.tsx', import.meta.url), 'utf8');
const funder = () => readFileSync(new URL('../app/funder/page.tsx', import.meta.url), 'utf8');

test('/ngo Simple reduces the 9-tab strip to Cohort, Gardens, Messages, Reports, plus one merged Training tab', () => {
  const src = ngo();
  assert.match(src, /const NGO_SIMPLE_VIEWS = new Set<NgoView>\(\['cohort', 'gardens', 'messages', 'reports', 'training'\]\)/,
    'the Simple tab set for /ngo changed shape — recheck it matches Cohort · Gardens · Messages · Reports · Training');
  assert.match(src, /const NGO_ALL_VIEWS = new Set<NgoView>\(\['access', 'evidence', 'reports', 'cohort', 'gardens', 'messages', 'assessments', 'area', 'funder-preview'\]\)/,
    'the All-tools tab set for /ngo changed — it must stay every tab that existed before Simple was added');
});

test('/ngo Simple moves Control centre, Production area and Funder summary preview to All tools, and merges Assessments into Training', () => {
  const src = ngo();
  const at = src.indexOf('(simple ? [');
  assert.ok(at > 0, 'could not find the Simple/All-tools tab strip branch');
  const simpleBlock = src.slice(at, src.indexOf('] as const : ['));
  for (const gone of ['access', "'assessments'", "'area'", "'funder-preview'"]) {
    assert.doesNotMatch(simpleBlock, new RegExp(`key: '${gone.replace(/'/g, '')}'`),
      `${gone} is still offered as a Simple tab on /ngo`);
  }
  assert.match(simpleBlock, /key: 'training'/, 'the merged Training tab is missing from Simple');
});

test('/ngo All tools is unchanged: still every original tab, in its original order', () => {
  const src = ngo();
  const allAt = src.indexOf('] as const : [');
  assert.ok(allAt > 0, 'could not find the All-tools tab array');
  const allBlock = src.slice(allAt, src.indexOf('] as const).map'));
  const order = ['access', 'evidence', 'reports', 'cohort', 'gardens', 'messages', 'assessments', 'area', 'funder-preview'];
  let cursor = 0;
  for (const key of order) {
    const at = allBlock.indexOf(`key: '${key}'`, cursor);
    assert.ok(at >= cursor, `All-tools tab '${key}' is missing or reordered on /ngo`);
    cursor = at + 1;
  }
});

test('/ngo hides the Portfolio map header link in Simple, and it is a next/link Link', () => {
  const src = ngo();
  assert.match(src, /\{!simple && \(\s*<Link\s+href="\/network"/, 'the Portfolio map link is no longer hidden in Simple, or is no longer a next/link Link');
  assert.doesNotMatch(src, /<a\s+href="\/network"/, 'the Portfolio map link is still a plain <a>, not next/link Link');
});

test('/ngo renders both Training & progress content and Assessments under the merged Simple Training tab', () => {
  const src = ngo();
  assert.match(src, /\{view === 'training' && <div[^>]*><ProgrammeEvidence \/><MelDashboard \/><\/div>\}/,
    'the Simple Training tab no longer renders both ProgrammeEvidence and MelDashboard');
});

test('/funder Simple defaults to Cohort and Progress & milestones (plus Reports); Gardens, Production area and Assessments move to All tools', () => {
  const src = funder();
  assert.match(src, /const FUNDER_SIMPLE_VIEWS = new Set<FunderView>\(\['cohort', 'evidence', 'reports'\]\)/,
    'the Simple tab set for /funder changed — recheck it is Cohort + Progress & milestones (+ Reports)');
  assert.match(src, /const FUNDER_ALL_VIEWS = new Set<FunderView>\(\['evidence', 'reports', 'cohort', 'gardens', 'area', 'assessments'\]\)/,
    'the All-tools tab set for /funder changed — it must stay every tab that existed before Simple was added');
});

test('/funder All tools is unchanged: still every original tab, in its original order', () => {
  const src = funder();
  const allAt = src.indexOf('] as const : [');
  assert.ok(allAt > 0, 'could not find the All-tools tab array');
  const allBlock = src.slice(allAt, src.indexOf('] as const).map'));
  const order = ['evidence', 'reports', 'cohort', 'gardens', 'area', 'assessments'];
  let cursor = 0;
  for (const key of order) {
    const at = allBlock.indexOf(`key: '${key}'`, cursor);
    assert.ok(at >= cursor, `All-tools tab '${key}' is missing or reordered on /funder`);
    cursor = at + 1;
  }
});

test('the funder BrandLogo no longer passes the ignored icon prop, and the Portfolio map link is a next/link Link', () => {
  const src = funder();
  assert.doesNotMatch(src, /<BrandLogo icon="🏛"\s*\/>/, 'BrandLogo still receives the icon prop it silently ignores');
  assert.match(src, /<BrandLogo\s*\/>/, 'BrandLogo is no longer rendered');
  assert.doesNotMatch(src, /<a\s+href="\/network"/, 'the Portfolio map link is still a plain <a>, not next/link Link');
  assert.match(src, /<Link\s+href="\/network"/, 'the Portfolio map link is no longer a next/link Link');
});

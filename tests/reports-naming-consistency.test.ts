import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// copy-05: the saved-sites/reports destination was named five different ways across the app —
// nav 'Site report', page h1 'Saved sites & reports', list headers 'Your Sites'/'Saved Reports',
// toolbar 'Site Analysis Report'. Settled on 'Site reports' (and sentence-case list headers)
// everywhere this track owns or that reads from lib/i18n.tsx's shared English block.

const i18n = () => readFileSync(new URL('../lib/i18n.tsx', import.meta.url), 'utf8');

test('the nav label, page title and intro all say "Site reports"/"site report", not five different things', () => {
  const src = i18n();
  assert.match(src, /siteReportOverline: 'Site reports'/, 'the nav label is no longer "Site reports"');
  assert.match(src, /reportsTitle: 'Site reports'/, 'the page h1 is no longer "Site reports"');
  assert.doesNotMatch(src, /reportsTitle: 'Saved sites & reports'/, 'the old five-word title is still there');
  assert.match(src, /reportsIntro: 'Choose a site to prepare and generate its site report/, 'the visible reports-page intro still says "Site Analysis Report"');
});

test('list headers are sentence case, not Title Case', () => {
  const src = i18n();
  assert.match(src, /savedSitesHeader: 'Your sites'/, '"Your sites" should be sentence case');
  assert.match(src, /savedReportsHeader: 'Saved reports'/, '"Saved reports" should be sentence case');
});

// The dead tap that started this: on a phone that had never opened Reports while online,
// tapping "Site report" offline did NOTHING. The report view is a lazy chunk
// (dynamic(() => import('@/components/ReportView')) in app/farmer/page.tsx), so offline the
// import rejected, showReport flipped anyway, and no view ever arrived — no error, no
// message, the screen simply did not change. The fix routes both report doors through a
// preflight import of the same module (deduped by the bundler, free when the chunk is
// already on the phone) and only flips state once the chunk is real; the failure path says
// the true sentence through the app dialog instead.
//
// Run with:
//   node --import ./tests/register-alias.mjs --test tests/report-offline-honesty.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const farmer = readFileSync(new URL('../app/farmer/page.tsx', import.meta.url), 'utf8');
const reportView = readFileSync(new URL('../components/ReportView.tsx', import.meta.url), 'utf8');

test('both report doors preflight the lazy chunk before flipping state', () => {
  // The preflight must load the SAME module the dynamic() uses — a different specifier
  // would preflight a different chunk and prove nothing.
  const spec = "'@/components/ReportView'";
  assert.ok(farmer.includes(`dynamic(() => import(${spec})`), 'the lazy view moved — update this test with it');
  assert.match(farmer, /const withReportChunk = useCallback/);
  assert.ok(farmer.split(`import(${spec})`).length >= 3, 'preflight must import the same module as the dynamic()');

  // Both openers go through the preflight, and neither flips showReport outside it.
  const viewSaved = farmer.match(/const handleViewReport = useCallback\(\(r: SavedReport\) => \{([\s\S]*?)\}, \[/)?.[1] ?? '';
  const openFresh = farmer.match(/const handleOpenReport = useCallback\(\(photoAnalysis\?: string\) => \{([\s\S]*?)\}, \[/)?.[1] ?? '';
  assert.ok(viewSaved.includes('withReportChunk('), 'saved-report door must preflight the chunk');
  assert.ok(openFresh.includes('withReportChunk('), 'fresh-report door must preflight the chunk');
});

test('the chunk-failure path speaks through the app dialog, not a swallowed catch', () => {
  const preflight = farmer.match(/const withReportChunk = useCallback[\s\S]*?\}, \[appConfirm\]\);/)?.[0] ?? '';
  assert.ok(preflight, 'preflight must depend on appConfirm — a silent failure path is the bug this exists to stop');
  assert.ok(preflight.includes('appConfirm({'), 'failure must surface as a dialog');
  assert.match(preflight, /signal/i, 'the message must name the actual problem in farmer words');
});

test('a dead connection during generate reads as no-signal, not as Failed to fetch', () => {
  assert.match(reportView, /failed to fetch\|load failed\|network/i,
    'network-shaped errors must be recognised (Chrome and Safari word them differently)');
  assert.match(reportView, /No signal — writing the report needs internet/,
    'the farmer-language line must exist');
  // The jargon must not be the fallback for network failures: the honest line and the raw
  // message must be alternatives of the same ternary.
  assert.match(reportView, /\? 'No signal[\s\S]{0,120}: err\.message/);
});

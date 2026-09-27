import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Report footnote in plain words (swarm/w3-report-notes, task 1).
//
// The site-facts footnote under the print header used to concatenate raw English jargon
// ("Köppen {code} ({desc})", "BRU {code} (parent {parent})", the BRU→Bioresource Group
// crosswalk caveat) with no tr(), while every neighbouring string in this report goes through
// tr('English', 'isiZulu'). Source-text guard in the same style as tests/nav-simple-track.test.ts:
// rendering the real component needs a location/site-data fixture this track doesn't own.

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const REPORT_VIEW = read('../components/ReportView.tsx');

test('ReportView reads Simple / All tools for the site-facts footnote', () => {
  assert.match(REPORT_VIEW, /import \{ useAppLevel \} from '@\/lib\/app-level';/,
    'ReportView must read the Simple / All tools level');
  assert.match(REPORT_VIEW, /const simple = useAppLevel\(\) === 'simple';/);
});

test('Simple hides the technical footnote but keeps the coordinates line', () => {
  const block = REPORT_VIEW.slice(
    REPORT_VIEW.indexOf('{/* Coords */}'),
    REPORT_VIEW.indexOf('{presentation !== \'print\' && <ReportVisualOverview'),
  );
  assert.match(block, /\{simple \? \(/, 'the footnote must branch on simple');
  const simpleBranch = block.slice(block.indexOf('{simple ? ('), block.indexOf(') : ('));
  // The coordinates line survives in Simple...
  assert.match(simpleBranch, /Math\.abs\(d\.lat\)\.toFixed\(4\)/);
  assert.match(simpleBranch, /d\.lon\.toFixed\(4\)/);
  // ...but none of the technical jargon does.
  for (const jargon of ['Köppen', 'koppenDesc', 'BRU', 'bruParent', 'Bioresource Group', 'crosswalk']) {
    assert.doesNotMatch(simpleBranch, new RegExp(jargon),
      `Simple's coordinates line must not carry "${jargon}"`);
  }
});

test('All tools keeps the technical detail but routes its labels through tr(), leaving codes as data', () => {
  const allToolsBranch = REPORT_VIEW.slice(
    REPORT_VIEW.indexOf(') : ('),
    REPORT_VIEW.indexOf('{presentation !== \'print\' && <ReportVisualOverview'),
  );
  // Labels now go through tr() with isiZulu drafts.
  assert.match(allToolsBranch, /tr\('Köppen climate class', '[^']+'\)/);
  assert.match(allToolsBranch, /tr\('rainfall', '[^']+'\)/);
  assert.match(allToolsBranch, /tr\('wet', '[^']+'\)/);
  assert.match(allToolsBranch, /tr\('dry', '[^']+'\)/);
  assert.match(allToolsBranch, /tr\('BRU zone', '[^']+'\)/);
  assert.match(allToolsBranch, /tr\('parent zone', '[^']+'\)/);
  assert.match(allToolsBranch, /is a best-effort climate match, not a verified BRU→Bioresource Group crosswalk\.`,\s*\n\s*`/,
    'the crosswalk caveat must be the English half of a tr() call with an isiZulu counterpart');
  // Codes/identifiers stay as raw interpolated data, not translated strings.
  assert.match(allToolsBranch, /\{d\.climate\.koppen\}/);
  assert.match(allToolsBranch, /\{d\.bru\.brucode\}/);
  assert.match(allToolsBranch, /\{d\.bru\.bruParent\}/);
});

test('the print/PDF path (presentation === \'print\') still renders the same footnote JSX, not a second copy', () => {
  // The footnote sits inside the single "print-header" block gated by reading/presentation,
  // not duplicated per presentation mode — so print and screen share the Simple/All-tools branch.
  const printHeaderStart = REPORT_VIEW.indexOf('{/* Print header */}');
  const coordsIndex = REPORT_VIEW.indexOf('{/* Coords */}');
  assert.ok(printHeaderStart >= 0 && printHeaderStart < coordsIndex,
    'the Coords/footnote block must live inside the print-header block shared by screen and print');
  const occurrences = REPORT_VIEW.split('{/* Coords */}').length - 1;
  assert.equal(occurrences, 1, 'the coords/footnote markup must not be duplicated for print vs screen');
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Task 11 sweep (wave 13, desktop-frame track): outline-none without a focus-visible ring, and
// a sub-12px badge left over from an earlier wave's fix that only reached /ngo, not /mentor.

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

test('no input/select/textarea in the owned files keeps outline-none without a focus-visible ring', () => {
  for (const file of ['app/mentor/page.tsx', 'app/surveys/page.tsx', 'components/ReportView.tsx'] as const) {
    const src = read(file);
    for (const line of src.split('\n')) {
      if (/\boutline-none\b/.test(line) && !/focus-visible:ring/.test(line)) {
        assert.fail(`${file}: "outline-none" with no focus-visible ring companion: ${line.trim().slice(0, 100)}`);
      }
    }
  }
});

test("mentor's tab badge matches the fix already applied to the same badge on /ngo (12px digit, 19px pill)", () => {
  const src = read('app/mentor/page.tsx');
  assert.match(src, /minWidth: 19, height: 19, fontSize: 12, padding: '0 5px'/, "mentor's badge is still the old 16px/fontSize-9 shape");
});

test('CompletionScore\'s in-progress badge is at the 11px floor, not 10px', () => {
  const src = read('components/report/CompletionScore.tsx');
  assert.doesNotMatch(src, /fontSize: 10, fontWeight: 800/, 'the in-progress step badge is still below the 11px floor');
});

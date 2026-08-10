import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildCoverMarkdown, preparedFromLabel, type ReportCoverInput } from '../lib/report-cover.ts';

// The cover is the page a funder or extension officer reads first and quotes back. Everything on
// it is code-authored precisely so that no field can drift — which only helps if the fields are
// also TRUE. These tests guard the one line that makes a claim about where the document came from.

const BASE: Omit<ReportCoverInput, 'sources'> = {
  farmName: 'Ubhejane Creche',
  bioregion: 'Zululand Lowveld (Savanna)',
  adminLabel: 'Mkhuze, uMkhanyakude, KwaZulu-Natal',
  lat: -27.726231,
  lon: 31.963044,
  dateLabel: '5 August 2026',
  isoDate: '2026-08-05',
  sectionCount: 14,
  lengthLabel: 'Comprehensive',
};

const cover = (sources: ReportCoverInput['sources']) => buildCoverMarkdown({ ...BASE, sources });

test('the cover names only the sources it actually got', () => {
  // The defect: this line was a string literal naming all three, while the route makes both the
  // survey and the map/crop facts optional and normalises missing ones to null. A report built
  // with neither still told its reader it was prepared "from the farmer's own map, survey and
  // crop plan".
  assert.match(
    cover({ map: true, survey: true, cropPlan: true }),
    /Prepared by \| ImbewuField, from the farmer's own map, survey and crop plan \|/,
  );
  assert.match(
    cover({ map: true, survey: false, cropPlan: true }),
    /from the farmer's own map and crop plan \|/,
  );
  assert.match(cover({ map: false, survey: true, cropPlan: false }), /from the farmer's own survey \|/);
});

test('a report built from nothing of the farmer\'s own says so', () => {
  const line = preparedFromLabel({ map: false, survey: false, cropPlan: false });
  assert.match(line, /location and public environmental data/);
  assert.ok(!/farmer's own/.test(line), 'it still claims the farmer supplied something');
});

test('no survey means the word survey never appears in the provenance', () => {
  // The failure is specifically a claim of provenance the document does not have, so the check
  // that matters is the absence of the word, not the shape of the sentence.
  const line = preparedFromLabel({ map: true, survey: false, cropPlan: true });
  assert.ok(!/survey/i.test(line), `still claims a survey: ${line}`);
});

test('the provenance line cannot go back to being a literal', () => {
  // A source test because the failure mode is someone re-hardcoding the friendly-sounding full
  // version. The cover must build this line from the sources it was handed.
  const src = readFileSync(new URL('../lib/report-cover.ts', import.meta.url), 'utf8');
  const preparedByLine = src.split('\n').find((l) => l.includes('| Prepared by |')) ?? '';
  assert.ok(
    preparedByLine.includes('preparedFromLabel(input.sources)'),
    'the Prepared by row is not derived from the supplied sources',
  );
});

test('the cover does not promise honesty it then breaks', () => {
  // Two lines below the provenance claim, the cover tells the reader that "where the app had no
  // data, the report says so rather than filling the gap". That sentence is the reason this file
  // is code rather than prose; a cover that names a survey nobody filled in contradicts it on the
  // same page.
  const bare = cover({ map: false, survey: false, cropPlan: false });
  assert.match(bare, /says so rather than filling the gap/);
  assert.ok(!/survey/i.test(bare.split('\n').find((l) => l.includes('Prepared by')) ?? ''));
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { nurseryFieldPlantingReviewCsv } from '../lib/international/locales/nursery-field-planting-review-csv.ts';
import { loadNurseryReviewData } from '../lib/international/locales/nursery-field-planting-review-server.ts';
import type { NurseryReviewRow } from '../lib/international/locales/nursery-field-planting-review.ts';

function parseCsv(csv: string): string[][] {
  assert.equal(csv[0], '\uFEFF');
  const rows: string[][] = [], cells: string[] = [];
  let cell = '', quoted = false;
  for (let index = 1; index < csv.length; index++) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') { cell += '"'; index++; }
      else quoted = !quoted;
    } else if (!quoted && character === ',') { cells.push(cell); cell = ''; }
    else if (!quoted && character === '\r' && csv[index + 1] === '\n') {
      cells.push(cell); rows.push([...cells]); cells.length = 0; cell = ''; index++;
    } else cell += character;
  }
  assert.equal(quoted, false); assert.equal(cell, ''); assert.equal(cells.length, 0);
  return rows;
}

test('the actual server reader supplies every registered source-checked language to a UTF-8 review worksheet', () => {
  const data = loadNurseryReviewData();
  assert.equal(data.issue, null);
  assert.deepEqual(data.languages.map(language => language.locale), ['fr', 'es', 'pt-BR', 'sw', 'hi', 'bn', 'id', 'ar', 'ur', 'ne', 'vi']);
  assert.equal(data.languages.flatMap(language => language.rows).length, data.languages.length * 26);
  for (const language of data.languages) {
    assert.equal(language.rows.filter(row => row.state === 'draft').length, 26);
    const before = structuredClone(language.rows);
    const csv = nurseryFieldPlantingReviewCsv(language.locale, language.rows);
    assert.ok(csv.endsWith('\r\n'));
    const rows = parseCsv(Buffer.from(csv, 'utf8').toString('utf8'));
    assert.deepEqual(rows[0], ['Language', 'Message key', 'Source file', 'Frozen English',
      'Current English (blank if not verified)', 'AI draft', 'Source/draft check', 'Human review', 'Reviewer notes (blank worksheet field)']);
    assert.equal(rows.length, 27);
    for (const [index, row] of rows.slice(1).entries()) {
      const source = language.rows[index];
      assert.equal(row.length, 9);
      assert.deepEqual(row, [language.locale, source.key, source.sourceFile, source.frozenEnglish,
        source.currentEnglish, source.translation, 'draft', 'unreviewed', '']);
    }
    assert.deepEqual(language.rows, before, 'Export must not edit source/draft text or create a review record');
  }
});

test('unknown current English and a synthetic reviewed state cannot become a sign-off in exported rows', () => {
  const row: NurseryReviewRow = { ...loadNurseryReviewData().languages[0].rows[0],
    currentEnglish: null, translation: null, state: 'source-missing' };
  const sourceMissing = parseCsv(nurseryFieldPlantingReviewCsv('fr', [row]))[1];
  assert.equal(sourceMissing[3], row.frozenEnglish);
  assert.equal(sourceMissing[4], ''); assert.equal(sourceMissing[5], '');
  assert.equal(sourceMissing[6], 'source-missing'); assert.equal(sourceMissing[7], 'unreviewed');
  const claimed = parseCsv(nurseryFieldPlantingReviewCsv('fr', [{ ...row, state: 'reviewed' }]))[1];
  assert.equal(claimed[6], 'needs-review'); assert.equal(claimed[7], 'unreviewed'); assert.equal(claimed[8], '');
});

for (const dangerous of ['=1+1', '+SUM(1,2)', '-1+1', '@SUM(1,2)', ' \t=HYPERLINK("https://example.invalid")', '\tordinary', '\rline', '\nline']) {
  test(`a spreadsheet formula prefix ${JSON.stringify(dangerous)} is export-escaped in every text column`, () => {
    const original = loadNurseryReviewData().languages[0].rows[0];
    const row = { ...original, key: dangerous, sourceFile: dangerous as NurseryReviewRow['sourceFile'],
      frozenEnglish: dangerous, currentEnglish: dangerous, translation: dangerous };
    const exported = parseCsv(nurseryFieldPlantingReviewCsv('fr', [row]))[1];
    for (const index of [1, 2, 3, 4, 5]) assert.equal(exported[index], `'${dangerous}`);
    assert.equal(row.translation, dangerous, 'Escaping the worksheet must leave the draft untouched');
  });
}

test('quotes, commas and multilingual multiline drafts round-trip without becoming extra rows or columns', () => {
  const original = loadNurseryReviewData().languages[0].rows[0];
  const draft = 'বাংলা, हिन्दी "draft"\nDeuxième ligne\r\nLínea tres';
  const rows = parseCsv(nurseryFieldPlantingReviewCsv('bn', [{ ...original, translation: draft }]));
  assert.equal(rows.length, 2); assert.equal(rows[1].length, 9); assert.equal(rows[1][5], draft);
});

test('an empty worksheet contains column headings without inventing draft or review rows', () => {
  assert.equal(parseCsv(nurseryFieldPlantingReviewCsv('pt-BR', [])).length, 1);
});

for (const locale of ['ar', 'ur', 'ne', 'vi'] as const) {
  test(`${locale} actual packet exports its exact mixed-script literals with no approval or direction controls`, () => {
    const language = loadNurseryReviewData().languages.find(entry => entry.locale === locale)!;
    assert.ok(language);
    const rows = parseCsv(nurseryFieldPlantingReviewCsv(locale, language.rows));
    assert.equal(rows.length, 27);
    for (const [index, row] of rows.slice(1).entries()) {
      assert.equal(row[5], language.rows[index].translation);
      assert.equal(row[7], 'unreviewed'); assert.equal(row[8], '');
      assert.doesNotMatch(row[5], /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/);
    }
    const demo = rows.find(row => row[3].startsWith('DEMO'))!;
    assert.match(demo[5], /DEMO/);
    const zero = rows.find(row => row[3].includes('entered 0'))!;
    assert.match(zero[5], /0/);
    assert.ok(rows.some(row => row[5].includes('UTC')));
  });
}

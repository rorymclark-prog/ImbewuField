import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { resolveSampleChooserDraft, SESOTHO_SAMPLE_CHOOSER_DRAFT as draft } from '../lib/sample-chooser-translation-draft-st.ts';

test('Sesotho sample chooser strings retain the exact chooser source beside each draft', () => {
  const expected = {
    eyebrow: 'EXPLORE',
    heading: 'Choose a view',
    intro: 'Explore each workspace. Use Tour in the menu to return here.',
    sectionLabel: 'All views',
    sectionHeading: 'Choose your workspace',
    indexLabel: 'View index',
    ngo: ['Organisation', 'Run a programme', 'Explore gardens, assessments, reports and the organisation Control centre.'],
    funder: ['Funder', 'Review what is shared', 'See the same programme through its published summaries.'],
    farmer: ['Farmer', 'Explore Ubhejane Crèche', 'Open the farm map, crop plan, harvests and example sales.'],
    mentor: ['Mentor', 'Support a grower', 'Explore assigned farmers, organisation guidance, visits and reports.'],
    student: ['Student', 'Try the learning workspace', 'Explore the existing course and progress.'],
  };
  for (const key of ['eyebrow', 'heading', 'intro', 'sectionLabel', 'sectionHeading', 'indexLabel'] as const) {
    assert.equal(draft[key].sourceEnglish, expected[key]);
    assert.ok(draft[key].sesothoDraft.trim());
    assert.equal(draft[key].reviewStatus, 'machine-draft');
    assert.equal(resolveSampleChooserDraft(draft[key], 'st'), draft[key].sesothoDraft);
    assert.equal(resolveSampleChooserDraft(draft[key], 'en'), draft[key].sourceEnglish);
  }
  for (const key of ['ngo', 'funder', 'farmer', 'mentor', 'student'] as const) {
    const copy = draft.roles[key];
    const source = expected[key];
    assert.deepEqual(
      [copy.label.sourceEnglish, copy.title.sourceEnglish, copy.subtitle.sourceEnglish],
      source,
      `${key} labels and card copy must match the public source strings exactly`,
    );
    for (const pair of [copy.label, copy.title, copy.subtitle]) {
      assert.ok(pair.sesothoDraft.trim());
      assert.ok(pair.reviewStatus === 'machine-draft' || pair.reviewStatus === 'hold');
    }
  }
  assert.equal(draft.roles.ngo.subtitle.reviewStatus, 'hold');
  assert.equal(draft.roles.ngo.subtitle.sesothoDraft, draft.roles.ngo.subtitle.sourceEnglish);
});

test('draft resolution exposes Sesotho only in Sesotho and holds uncertain copy in English', () => {
  const candidate = draft.roles.funder.label;
  assert.equal(resolveSampleChooserDraft(candidate, 'st'), candidate.sesothoDraft);
  assert.equal(resolveSampleChooserDraft(candidate, 'en'), candidate.sourceEnglish);
  assert.equal(resolveSampleChooserDraft(candidate, 'zu'), candidate.sourceEnglish);
  assert.equal(resolveSampleChooserDraft(draft.roles.ngo.subtitle, 'st'), draft.roles.ngo.subtitle.sourceEnglish);
  assert.equal(draft.roles.ngo.subtitle.reviewStatus, 'hold');
});

test('the chooser visibly pairs every selected draft field and keeps English/isiZulu routing intact', () => {
  const page = readFileSync(new URL('../app/samples/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /if \(pair\.reviewStatus === 'hold'\) return <>{pair\.sourceEnglish}<\/>/);
  assert.match(page, /English: \{pair\.sourceEnglish\}/);
  assert.match(page, /<PairedDraft pair=\{SESOTHO_SAMPLE_CHOOSER_DRAFT\.eyebrow\}/);
  assert.match(page, /<PairedDraft pair=\{SESOTHO_SAMPLE_CHOOSER_DRAFT\.heading\}/);
  assert.match(page, /<PairedDraft pair=\{SESOTHO_SAMPLE_CHOOSER_DRAFT\.intro\}/);
  assert.match(page, /<PairedDraft pair=\{SESOTHO_SAMPLE_CHOOSER_DRAFT\.sectionHeading\}/);
  assert.match(page, /<PairedDraft pair=\{roleCopy\.label\}/);
  assert.match(page, /<PairedDraft pair=\{roleCopy\.title\}/);
  assert.match(page, /<PairedDraft pair=\{roleCopy\.subtitle\}/);
  assert.match(page, /lang === 'zu' \? examplesZu : lang === 'st'/);
  assert.match(page, /const ui = \(english: string, zulu: string\) => lang === 'zu' \? zulu : english/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { actualPracticeUi, practiceNodeText } from './tour-practice-renderers.ts';
import { sampleWorkspaceDraft } from '../lib/sample-workspace-copy.ts';
import { controlT } from './control-icon-renderers.ts';

import {
  resolveSampleChooserTshivendaDraft,
  TSHIVENDA_SAMPLE_CHOOSER_DRAFT as draft,
} from '../lib/sample-chooser-translation-draft-ve.ts';

test('Tshivenda sample chooser drafts keep the exact English source paired', () => {
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
    assert.ok(draft[key].tshivendaDraft.trim());
    assert.ok(draft[key].reviewStatus === 'machine-draft' || draft[key].reviewStatus === 'hold');
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
      assert.ok(pair.tshivendaDraft.trim());
      assert.ok(pair.reviewStatus === 'machine-draft' || pair.reviewStatus === 'hold');
      if (pair.reviewStatus === 'hold') assert.equal(pair.tshivendaDraft, pair.sourceEnglish);
    }
  }
  assert.equal(draft.roles.ngo.title.reviewStatus, 'hold');
  assert.equal(draft.roles.funder.title.reviewStatus, 'hold');
  assert.equal(draft.sectionHeading.reviewStatus, 'hold');
  assert.equal(draft.roles.student.subtitle.reviewStatus, 'machine-draft');
});

test('Tshivenda drafts resolve only for Tshivenda and holds remain exact English', () => {
  const candidate = draft.roles.farmer.label;
  assert.equal(resolveSampleChooserTshivendaDraft(candidate, 've'), candidate.tshivendaDraft);
  assert.equal(resolveSampleChooserTshivendaDraft(candidate, 'en'), candidate.sourceEnglish);
  assert.equal(resolveSampleChooserTshivendaDraft(candidate, 'st'), candidate.sourceEnglish);
  assert.equal(resolveSampleChooserTshivendaDraft(candidate, 'zu'), candidate.sourceEnglish);
  assert.equal(resolveSampleChooserTshivendaDraft(draft.roles.ngo.title, 've'), draft.roles.ngo.title.sourceEnglish);
});

// The earlier source-regex test required the old English-only hold branch forever.
// Keep its historical hold assertions above; the real chooser must now pair every
// source with the recorded unreviewed draft, including newly filled held fields.
test('Tshivenda chooser drafts remain visibly paired when historical held fields gain native drafts', async () => {
  const h = await actualPracticeUi('ve');
  try {
    assert.ok(h.text().includes(controlT('ve')('languageDraftNoticeText')));
    for (const key of ['eyebrow', 'heading', 'intro', 'sectionLabel', 'sectionHeading'] as const) {
      const source = draft[key].sourceEnglish;
      if (key === 'sectionLabel') assert.ok(h.renderer.root.findAllByProps({ 'aria-label': sampleWorkspaceDraft(source, 've') }).length);
      else assert.ok(h.text().includes(sampleWorkspaceDraft(source, 've')!));
      if (key !== 'sectionLabel') assert.ok(h.renderer.root.findAllByProps({ lang: 'en' }).some(n => practiceNodeText(n).includes(source)));
    }
    for (const role of ['ngo', 'funder', 'farmer', 'mentor', 'student'] as const) {
      const card = h.renderer.root.findByProps({ id: 'sample-' + role });
      for (const pair of Object.values(draft.roles[role])) {
        assert.ok(practiceNodeText(card).includes(sampleWorkspaceDraft(pair.sourceEnglish, 've')!));
        assert.ok(card.findAllByProps({ lang: 'en' }).some(n => practiceNodeText(n).includes(pair.sourceEnglish)));
      }
      await h.choose(role);
    }
    assert.deepEqual(h.calls.routes, ['/ngo', '/funder', '/farmer', '/mentor', '/student']);
    await h.language('en'); assert.ok(h.text().includes('Choose a view'));
    await h.language('zu'); assert.ok(h.text().includes('Khetha indawo yokusebenza'));
  } finally { await h.dispose(); }
});

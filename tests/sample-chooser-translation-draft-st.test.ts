import test from 'node:test';
import assert from 'node:assert/strict';
import { actualPracticeUi, practiceNodeText } from './tour-practice-renderers.ts';
import { sampleWorkspaceDraft } from '../lib/sample-workspace-copy.ts';
import { controlT } from './control-icon-renderers.ts';

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

// The earlier source-regex test required the old English-only hold branch forever.
// Keep its historical hold assertions above; the real chooser must now pair every
// source with the recorded unreviewed draft, including newly filled held fields.
test('Sesotho chooser drafts remain visibly paired when historical held fields gain native drafts', async () => {
  const h = await actualPracticeUi('st');
  try {
    assert.ok(h.text().includes(controlT('st')('languageDraftNoticeText')));
    for (const key of ['eyebrow', 'heading', 'intro', 'sectionLabel', 'sectionHeading'] as const) {
      const source = draft[key].sourceEnglish;
      if (key === 'sectionLabel') assert.ok(h.renderer.root.findAllByProps({ 'aria-label': sampleWorkspaceDraft(source, 'st') }).length);
      else assert.ok(h.text().includes(sampleWorkspaceDraft(source, 'st')!));
      if (key !== 'sectionLabel') assert.ok(h.renderer.root.findAllByProps({ lang: 'en' }).some(n => practiceNodeText(n).includes(source)));
    }
    for (const role of ['ngo', 'funder', 'farmer', 'mentor', 'student'] as const) {
      const card = h.renderer.root.findByProps({ id: 'sample-' + role });
      for (const pair of Object.values(draft.roles[role])) {
        assert.ok(practiceNodeText(card).includes(sampleWorkspaceDraft(pair.sourceEnglish, 'st')!));
        assert.ok(card.findAllByProps({ lang: 'en' }).some(n => practiceNodeText(n).includes(pair.sourceEnglish)));
      }
      await h.choose(role);
    }
    assert.deepEqual(h.calls.routes, ['/ngo', '/funder', '/farmer', '/mentor', '/student']);
    await h.language('en'); assert.ok(h.text().includes('Choose a view'));
    await h.language('zu'); assert.ok(h.text().includes('Khetha indawo yokusebenza'));
  } finally { await h.dispose(); }
});

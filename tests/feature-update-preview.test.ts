import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { actualUpdateUi, withArchivedReleaseTour } from './update-ui-renderer.ts';
import { RELEASE_NOTES, visibleUpdateTour } from '../lib/release-notes.ts';
import { UPDATE_GUIDE_KEY } from '../lib/update-tour.ts';
import { cleanUpdateTour } from '../lib/update-tour.ts';

const stop = { title: 'Choose sites', where: 'Settings', detail: 'Review access.', href: '/connect/imbewu', preview: 'assistant-access' as const };

test('an important update demonstrates the feature and lets the reader pause and replay it', async () => {
  const h = await actualUpdateUi('en', { kind: 'guide', guide: { sha: 'qa-current-build', stops: [stop], phase: 'offer', index: 0 } });
  try {
    assert.equal(h.renderer.root.findAllByProps({ role: 'img' }).length, 1);
    await h.buttonText('Pause animation');
    assert.equal(h.renderer.root.findByProps({ 'data-paused': true }).type, 'div');
    await h.buttonText('Replay animation ↻');
    assert.equal(h.renderer.root.findByProps({ 'data-paused': false }).type, 'div');
    assert.ok(h.text().includes('Pause animation'));
  } finally { await h.dispose(); }
  assert.equal(cleanUpdateTour([stop])[0].preview, 'assistant-access');
});

test('routine updates do not acquire a demonstration and reduced motion has a complete still frame', async () => {
  const h = await actualUpdateUi('en', { kind: 'guide', guide: { sha: 'qa-current-build', stops: [{ ...stop, preview: undefined }], phase: 'offer', index: 0 } });
  try { assert.equal(h.renderer.root.findAllByProps({ role: 'img' }).length, 0); }
  finally { await h.dispose(); }
  const css = readFileSync(new URL('../components/FeatureUpdatePreview.module.css', import.meta.url), 'utf8');
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /animation: none !important/);
  assert.doesNotMatch(css, /infinite/);
});

test('acknowledging a feature keeps later update offers quiet, while the history can reopen it', async () => {
  const h = await actualUpdateUi('en', { kind: 'guide', seenPreview: true, releaseTour: [stop], guide: { sha: 'qa-current-build', stops: [stop], phase: 'offer', index: 0 } });
  try {
    assert.equal(h.renderer.toJSON(), null);
    await h.event('imbewu-open-update-guide');
    assert.equal(h.renderer.root.findAllByProps({ role: 'img' }).length, 1);
    await h.click('updateGuideCloseAria');
    assert.equal(h.renderer.toJSON(), null);
    assert.equal(h.storage.get('imbewu-feature-preview-seen:assistant-access'), '1');
  } finally { await h.dispose(); }
});

test('current announcements govern history and refresh before and after an explicit archived guide fixture', async () => {
  const identity = RELEASE_NOTES, original = [...RELEASE_NOTES], current = visibleUpdateTour();
  async function checkCurrentDefaults() {
    // e075's actual current announcement has no tour. Derive expectations from
    // its real data so a later valid routine tour does not become a false failure.
    const guide = await actualUpdateUi('en', { kind: 'guide', seenPreview: true });
    try {
      await guide.event('imbewu-open-update-guide');
      assert.equal(guide.renderer.root.findAllByProps({ role: 'region' }).length, current.length ? 1 : 0,
        'history must not borrow an older tour when current announcements have none');
      assert.equal(guide.renderer.root.findAllByProps({ role: 'img' }).length, current[0]?.preview === 'assistant-access' ? 1 : 0,
        'an older assistant demonstration is not a default for a routine or empty announcement');
      assert.equal(guide.session.has(UPDATE_GUIDE_KEY), false, 'opening history does not fabricate a saved offer');
      assert.equal(guide.storage.get('imbewu-feature-preview-seen:assistant-access'), '1');
    } finally { await guide.dispose(); }
    const banner = await actualUpdateUi('en');
    try {
      await banner.click('updateBannerWhatChangedAria');
      await banner.click('updateBannerRefreshButton');
      const raw = banner.session.get(UPDATE_GUIDE_KEY);
      assert.deepEqual(raw ? JSON.parse(raw) : null, current.length
        ? { sha: 'qa-new-build', stops: current, phase: 'offer', index: 0 } : null,
        'a refresh with no announced guide must not manufacture a post-refresh session');
      assert.equal(banner.calls.reload, 1, 'an optional empty guide cannot block explicit refresh');
    } finally { await banner.dispose(); }
  }
  function unchanged() {
    assert.equal(RELEASE_NOTES, identity, 'fixture restoration preserves the original array identity');
    assert.deepEqual(RELEASE_NOTES, original, 'fixture restoration preserves all original data and order');
    assert.ok(RELEASE_NOTES.every((note, index) => note === original[index]), 'original note objects are restored, not reconstructed');
    assert.deepEqual(visibleUpdateTour(), current);
  }
  await checkCurrentDefaults();
  const archived = original.find(note => note.sha === 'a5300d2f7'); assert.ok(archived?.tour);
  await withArchivedReleaseTour(async () => {
    assert.notEqual(RELEASE_NOTES[0], archived, 'the positive fixture is detached from its real archived source');
    assert.deepEqual(RELEASE_NOTES[0], archived, 'fixture text and destinations remain exact source data');
    assert.notEqual(RELEASE_NOTES[0].changes, archived.changes);
    assert.notEqual(RELEASE_NOTES[0].tour, archived.tour);
    assert.notEqual(RELEASE_NOTES[0].tour![0], archived.tour![0]);
    assert.deepEqual(visibleUpdateTour(), archived.tour);
  });
  unchanged(); await checkCurrentDefaults();
  const failure = Error('Engineering fixture rejection');
  await assert.rejects(withArchivedReleaseTour(async () => { throw failure; }), error => error === failure);
  unchanged(); await checkCurrentDefaults();
});

test('an explicit empty guide cannot fall through to an available archived assistant demonstration', async () => {
  await withArchivedReleaseTour(async () => {
    assert.equal(visibleUpdateTour()[0].preview, 'assistant-access', 'the adverse fixture must actually offer the older demonstration');
    const h = await actualUpdateUi('en', { kind: 'guide', seenPreview: true, releaseTour: [] });
    try {
      await h.event('imbewu-open-update-guide');
      assert.equal(h.renderer.toJSON(), null);
      assert.equal(h.renderer.root.findAllByProps({ role: 'img' }).length, 0);
      assert.equal(h.session.has(UPDATE_GUIDE_KEY), false);
      assert.equal(h.storage.get('imbewu-feature-preview-seen:assistant-access'), '1');
    } finally { await h.dispose(); }
  });
});

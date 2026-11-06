import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { actualUpdateUi } from './update-ui-renderer.ts';
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
  // History reloads the current release, not the saved offer. Keep this feature fixture current
  // explicitly: a later unrelated release may correctly have no assistant animation at all.
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

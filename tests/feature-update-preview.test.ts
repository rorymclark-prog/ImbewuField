import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { actualUpdateUi, updateNodeText } from './update-ui-renderer.ts';
import { cleanUpdateTour } from '../lib/update-tour.ts';
import { RELEASE_NOTES, visibleUpdateTour } from '../lib/release-notes.ts';
import { controlT } from './control-icon-renderers.ts';

const stop = { title: 'Choose sites', where: 'Settings', detail: 'Review access.', href: '/connect/imbewu', preview: 'assistant-access' };

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

test('acknowledging a feature keeps offers quiet, while history opens the current guide', async () => {
  // History deliberately loads the latest release tour. A newer routine nursery
  // stop must not inherit an older acknowledged assistant demonstration.
  const current = visibleUpdateTour()[0]; assert.ok(current);
  const h = await actualUpdateUi('en', { kind: 'guide', seenPreview: true, guide: { sha: 'qa-current-build', stops: [stop], phase: 'offer', index: 0 } });
  try {
    assert.equal(h.renderer.toJSON(), null);
    await h.event('imbewu-open-update-guide');
    assert.equal(h.renderer.root.findAllByProps({ role: 'region' }).length, 1);
    assert.equal(h.renderer.root.findAllByProps({ role: 'img' }).length, current.preview === 'assistant-access' ? 1 : 0);
    assert.equal(h.calls.lazy, 1);
    await h.click('settingsGuideMe');
    for (const source of [current.title, current.where, current.detail]) assert.ok(h.text().includes(source));
    assert.equal(h.renderer.root.findAll(n => n.type === 'a' && n.props.href === current.href).length, 1);
    await h.click('updateGuideCloseAria');
    assert.equal(h.renderer.toJSON(), null);
    assert.equal(h.storage.get('imbewu-feature-preview-seen:assistant-access'), '1');
  } finally { await h.dispose(); }
});

test('history uses routine or important current releases instead of replaying an acknowledged saved stop', async () => {
  const original = [...RELEASE_NOTES];
  try {
    for (const important of [false, true]) {
      const current = { title: important ? 'Current assistant feature' : 'Current routine worksheet',
        where: 'Current source location', detail: 'Current source detail.', href: important ? '/connect/imbewu#current' : '/international/locales',
        ...(important ? { preview: 'assistant-access' as const } : {}) };
      RELEASE_NOTES.splice(0, RELEASE_NOTES.length, { when: '5 November 2026', changes: ['Synthetic current release'], tour: [current] });
      const h = await actualUpdateUi('en', { kind: 'guide', seenPreview: true,
        guide: { sha: 'qa-current-build', stops: [stop], phase: 'offer', index: 0 } });
      try {
        assert.equal(h.renderer.toJSON(), null);
        await h.event('imbewu-open-update-guide');
        assert.equal(h.renderer.root.findAllByProps({ role: 'img' }).length, important ? 1 : 0);
        await h.click('settingsGuideMe');
        for (const source of [current.title, current.where, current.detail]) assert.ok(h.text().includes(source));
        assert.equal(h.renderer.root.findAll(n => n.type === 'a' && n.props.href === current.href).length, 1);
        assert.equal(h.renderer.root.findAllByType('h2').some(n => updateNodeText(n) === stop.title), false);
        await h.click('updateGuideCloseAria'); assert.equal(h.renderer.toJSON(), null);
        assert.equal(h.storage.get('imbewu-feature-preview-seen:assistant-access'), '1');
      } finally { await h.dispose(); }
    }
  } finally { RELEASE_NOTES.splice(0, RELEASE_NOTES.length, ...original); }
});

for (const [href, wrong] of [['/farmer?panel=Ask', '/farmer?panel=Details'], ['/records?tab=sold', '/records?tab=harvest']]) {
  test(`the mounted guide recognizes ${href} only after the required panel is selected`, async () => {
    const destination = { title: 'Review this panel', where: 'Current app panel', detail: 'Read the available choices.', href };
    const h = await actualUpdateUi('en', { kind: 'guide', path: wrong,
      guide: { sha: 'qa-current-build', stops: [destination], phase: 'offer', index: 0 } });
    const t = controlT('en');
    const continueLabel = t('updateGuideContinue').replace('{index}', '1').replace('{total}', '1');
    try {
      await h.click('settingsGuideMe');
      assert.equal(h.renderer.root.findAllByProps({ 'aria-label': t('updateGuideOpenPage') }).length, 1);
      assert.equal(h.renderer.root.findByProps({ 'aria-label': t('updateGuideOpenPage') }).props.href, href);
      assert.ok(!h.text().includes(t('updateGuideArrived')), 'a different panel on the same page has not arrived');
      await h.path(href);
      assert.equal(h.renderer.root.findAllByProps({ 'aria-label': continueLabel }).length, 1, 'arrival minimizes the guide to reveal the page');
      await h.actionLabel(continueLabel);
      assert.ok(h.text().includes(t('updateGuideArrived')));
      assert.equal(h.renderer.root.findAllByProps({ 'aria-label': t('updateGuideOpenPage') }).length, 0);
      await h.path(wrong);
      assert.equal(h.renderer.root.findByProps({ 'aria-label': t('updateGuideOpenPage') }).props.href, href);
      assert.ok(!h.text().includes(t('updateGuideArrived')));
      assert.deepEqual(JSON.parse(h.session.get('imbewu-update-guide-v1')!).stops, [destination], 'navigation does not rewrite the stored destination');
    } finally { await h.dispose(); }
  });
}

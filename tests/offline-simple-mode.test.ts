import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { actualOfflineUi, offlineNodeText } from './offline-ui-renderer.ts';
import { controlT } from './control-icon-renderers.ts';

// app/offline/page.tsx: the isiZulu "English source" <summary> toggles were 32px tall (below the
// 44px tap-target floor every other control in this app uses), and Simple mode showed a raw JSON
// download button and a page-readiness technical details block that a farmer using the decluttered
// Home has no use for. Both fixed without touching All tools, which keeps everything.

const source = readFileSync(new URL('../app/offline/page.tsx', import.meta.url), 'utf8');

// The source prefix is now translated in every target. Guard the rendered tap target,
// rather than pinning the old English literal or a fixed JSX character distance.
test('every target source toggle meets the 44px tap-target floor', async () => {
  for (const lang of ['zu','st','ts','ve'] as const) {
    const h = await actualOfflineUi(lang);
    try {
      const summaries = h.renderer.root.findAllByType('summary').filter(s => offlineNodeText(s) === controlT(lang)('offlineSourceLabel'));
      assert.ok(summaries.length, 'the English-source disclosures must remain available');
      for (const summary of summaries) assert.ok(summary.props.style.minHeight >= 44, 'the source toggle must be at least 44px tall');
    } finally { await h.dispose(); }
  }
});

test('offline page reads the Simple/All tools switch', () => {
  assert.match(source, /import\s*\{\s*useAppLevel\s*\}\s*from\s*['"]@\/lib\/app-level['"]/);
  assert.match(source, /useAppLevel\(\)\s*===\s*'simple'/);
});

test('Simple mode hides the raw JSON download of a queued entry while All tools retains it', async () => {
  for (const simple of [false,true]) {
    const h = await actualOfflineUi('st', { simple });
    try {
      const downloads = h.renderer.root.findAllByProps({ 'aria-label': controlT('st')('offlineDownloadCopy') });
      assert.equal(downloads.length > 0, !simple, 'technical downloads follow the real display-level gate');
    } finally { await h.dispose(); }
  }
});

test('Simple mode hides the page-readiness details block', () => {
  const at = source.indexOf('offlinePageReadiness');
  assert.ok(at > -1, 'the page-readiness block is gone — this test needs updating, not deleting');
  const before = source.slice(Math.max(0, at - 100), at);
  assert.match(before, /\{!simple\s*&&\s*<details>/, 'the page-readiness <details> must be gated on Simple mode');
});

test('the prepare-for-offline action is never gated by Simple mode', () => {
  const at = source.indexOf('offlinePrepareButton');
  assert.ok(at > -1, 'the prepare-for-offline button is gone — this test needs updating, not deleting');
  const before = source.slice(Math.max(0, at - 200), at);
  assert.doesNotMatch(before, /\{!simple/, 'Prepare for offline must stay available in Simple mode');
});

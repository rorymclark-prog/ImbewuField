import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// app/offline/page.tsx: the isiZulu "English source" <summary> toggles were 32px tall (below the
// 44px tap-target floor every other control in this app uses), and Simple mode showed a raw JSON
// download button and a page-readiness technical details block that a farmer using the decluttered
// Home has no use for. Both fixed without touching All tools, which keeps everything.

const source = readFileSync(new URL('../app/offline/page.tsx', import.meta.url), 'utf8');

test('the isiZulu source toggle meets the 44px tap-target floor', () => {
  const at = source.indexOf('English source');
  assert.ok(at > -1, 'the English-source <summary> toggle is gone — this test needs updating, not deleting');
  const summaryOpen = source.lastIndexOf('<summary', at);
  const summaryTag = source.slice(summaryOpen, at);
  assert.match(summaryTag, /minHeight:\s*44/, 'the source toggle must be at least 44px tall');
  assert.doesNotMatch(summaryTag, /minHeight:\s*32/, 'the old 32px height must be gone');
});

test('offline page reads the Simple/All tools switch', () => {
  assert.match(source, /import\s*\{\s*useAppLevel\s*\}\s*from\s*['"]@\/lib\/app-level['"]/);
  assert.match(source, /useAppLevel\(\)\s*===\s*'simple'/);
});

test('Simple mode hides the raw JSON download of a queued entry', () => {
  const at = source.indexOf('onClick={()=>download(row)}');
  assert.ok(at > -1, 'the per-entry JSON download button is gone — this test needs updating, not deleting');
  const before = source.slice(Math.max(0, at - 40), at);
  assert.match(before, /\{!simple&&/, 'the download button must be gated on Simple mode');
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

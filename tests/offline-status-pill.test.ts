import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// nav-06 (2026-10-16 visual/UX audit): the status line under /offline's header was just the
// bold word "Connected" with no icon or sentence, reading like a leftover label rather than a
// status. nav-10/nav-11 (samples/farm file input, samples/gardens card nesting) are covered by
// tests/ux-11-nav-08-ux-21.test.ts — both landed in that earlier commit as the same bug class
// as ux-21.

const page = readFileSync(new URL('../app/offline/page.tsx', import.meta.url), 'utf8');
const i18n = readFileSync(new URL('../lib/i18n.tsx', import.meta.url), 'utf8');

test('the offline status line has a Wifi/WifiOff icon and a full sentence when online', () => {
  assert.match(page, /import \{ ChevronDown,Wifi,WifiOff \} from 'lucide-react';/);
  const statusAt = page.indexOf('role="status"');
  assert.ok(statusAt > 0);
  const statusBlock = page.slice(statusAt, statusAt + 1200);
  assert.match(statusBlock, /<Wifi size=\{18\}/, 'online must show the Wifi icon');
  assert.match(statusBlock, /<WifiOff size=\{18\}/, 'offline must show the WifiOff icon');
  assert.match(statusBlock, /offlineConnectedSentence/, 'the status must say what it means, not just the bare word "Connected"');
});

test('offlineConnectedSentence is a real sentence, not a repeat of the single word', () => {
  const m = i18n.match(/offlineConnectedSentence: '([^']+)'/);
  assert.ok(m, 'the key must exist in T_en');
  assert.ok(m![1].length > 20, 'must be a full sentence, not a one-word label');
});

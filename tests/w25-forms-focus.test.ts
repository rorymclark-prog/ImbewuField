import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('w25-01: a practice-mode contact send does not claim delivery or a reply', () => {
  const page = read('app/contact/page.tsx');
  assert.match(page, /const \[practiceSend, setPracticeSend\] = useState\(false\);/);
  assert.match(page, /const realSend = Boolean\(isLive && user && !isSampleMode\(\)\);/);
  assert.match(page, /setPracticeSend\(!realSend\);\s*setSent\(true\);/);
  assert.match(page, /\{practiceSend\s*\?\s*ui\('Practice version: your message is kept on this device and is not sent yet\.'/);
});

test('w25-02: a label wrapping a visually hidden input shows the focus ring', () => {
  assert.match(read('app/globals.css'), /label:has\(> input\.sr-only:focus-visible\) \{\s*outline: 2px solid currentColor;\s*outline-offset: 2px;\s*\}/);
});

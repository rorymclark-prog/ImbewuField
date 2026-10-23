// bug-05: Lima Vision sent the full camera photo straight to /api/lima-vision — a 12 MP phone
// photo is several MB and exceeds the upload limit (413), and the retry never helped because the
// same oversized file was sent again. Guard: the raw file is now resized with the repo's existing
// resizeForStorage() (lib/site-evidence.ts) before it is read into the upload payload, and a 413
// gets a plain translated message rather than a bare status-code string.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const VISION = readFileSync(new URL('../app/vision/page.tsx', import.meta.url), 'utf8');

test('vision imports the shared resize helper', () => {
  assert.match(VISION, /import\s*\{\s*resizeForStorage\s*\}\s*from\s*'@\/lib\/site-evidence'/);
});

test('handleFile resizes the camera photo before building the upload payload, and never passes the raw file', () => {
  const start = VISION.indexOf('const handleFile = useCallback(');
  assert.notEqual(start, -1, 'handleFile must exist');
  const end = VISION.indexOf('\n  }, [t]);', start);
  const block = VISION.slice(start, end === -1 ? undefined : end);

  assert.match(block, /resizeForStorage\(file, VISION_UPLOAD_MAX_PX\)/, 'the raw file must be resized before use');
  assert.doesNotMatch(block, /reader\.readAsDataURL\(file\)/, 'the raw, full-resolution file must not be read straight into the upload payload');
});

test('the resize target is capped at ~1600px, matching the fix brief', () => {
  assert.match(VISION, /VISION_UPLOAD_MAX_PX\s*=\s*1600/);
});

test('a 413 response gets a plain translated message, not a bare status-code string', () => {
  const start = VISION.indexOf('if (!res.ok) {');
  assert.notEqual(start, -1);
  const end = VISION.indexOf('\n      }\n', start);
  const block = VISION.slice(start, end);

  assert.match(block, /res\.status === 413/);
  // The 413 branch's farmer-facing copy must not itself interpolate the status code.
  const branch413 = block.slice(block.indexOf('413'), block.indexOf('} else'));
  assert.doesNotMatch(branch413, /\$\{res\.status\}/);
});

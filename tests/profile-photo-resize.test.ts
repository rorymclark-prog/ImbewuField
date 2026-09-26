import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Guard: every farmer photo that goes to Firebase Storage via uploadPhoto()/uploadProfilePhoto()
// (lib/db/queries.ts) should be shrunk with resizeFileForUpload() (lib/site-evidence.ts) first —
// a raw phone camera photo is several MB, and this app's audience is on cheap Android phones
// with expensive, slow mobile data. MyRecords.tsx's produce-photo upload used to pass
// form.photoFile straight to uploadPhoto() unresized; pin that it now resizes first.

const SITE_EVIDENCE_SOURCE = readFileSync(new URL('../lib/site-evidence.ts', import.meta.url), 'utf8');
const MY_RECORDS_SOURCE = readFileSync(new URL('../components/MyRecords.tsx', import.meta.url), 'utf8');

test('lib/site-evidence.ts exports a File-producing resize for Storage uploads', () => {
  assert.match(SITE_EVIDENCE_SOURCE, /export function resizeFileForUpload\(/,
    'resizeFileForUpload must exist alongside resizeForStorage in lib/site-evidence.ts');
});

test('MyRecords produce photo is resized before it is uploaded', () => {
  assert.match(MY_RECORDS_SOURCE, /import\s*\{\s*resizeFileForUpload\s*\}\s*from\s*'@\/lib\/site-evidence'/,
    'MyRecords.tsx must import resizeFileForUpload from lib/site-evidence');

  const submitBlock = MY_RECORDS_SOURCE.match(/if \(form\.photoFile\) \{[\s\S]*?\}\n/);
  assert.ok(submitBlock, 'could not find the produce-photo upload block in handleSubmit');
  assert.match(submitBlock![0], /resizeFileForUpload\(form\.photoFile\)/,
    'the raw camera file must be resized before uploadPhoto() is called');
  assert.match(submitBlock![0], /uploadPhoto\(resized, 'produce'\)/,
    'uploadPhoto must receive the resized file, not the original form.photoFile');
});

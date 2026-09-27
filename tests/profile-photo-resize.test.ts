import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Guard: every farmer photo that goes to Firebase Storage via uploadPhoto()/uploadProfilePhoto()
// (lib/db/queries.ts) should be shrunk with resizeFileForUpload() (lib/site-evidence.ts) first —
// a raw phone camera photo is several MB, and this app's audience is on cheap Android phones
// with expensive, slow mobile data. MyRecords.tsx's produce-photo upload used to pass
// form.photoFile straight to uploadPhoto() unresized; pin that it now resizes first.
//
// swarm/w6-perf, task people-07 covered the other four call sites in parallel: the farmer's
// profile-edit sheet (components/ProfileSheet.tsx, opened from app/farmer/page.tsx) and the
// account-settings avatar picker (app/account/page.tsx) both sent uploadProfilePhoto()/
// uploadPhoto(file, 'avatars') the raw camera file, while app/community/page.tsx and
// app/community/profile/page.tsx already resized. All five upload paths are pinned below.

const SITE_EVIDENCE_SOURCE = readFileSync(new URL('../lib/site-evidence.ts', import.meta.url), 'utf8');
const MY_RECORDS_SOURCE = readFileSync(new URL('../components/MyRecords.tsx', import.meta.url), 'utf8');
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const PROFILE_SHEET = read('../components/ProfileSheet.tsx');
const ACCOUNT_PAGE = read('../app/account/page.tsx');
const COMMUNITY_BOARD = read('../app/community/page.tsx');
const COMMUNITY_PROFILE = read('../app/community/profile/page.tsx');

test('lib/site-evidence.ts exports a File-producing resize for Storage uploads', () => {
  assert.match(SITE_EVIDENCE_SOURCE, /export (async )?function resizeFileForUpload\(/,
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

test('ProfileSheet resizes the photo before uploadProfilePhoto()', () => {
  assert.match(PROFILE_SHEET, /import \{ resizeFileForUpload \} from '@\/lib\/site-evidence';/);
  assert.match(PROFILE_SHEET, /uploadProfilePhoto\(await resizeFileForUpload\(file\)\)/,
    'the profile-photo upload must resize the file first, not send it at full camera resolution');
});

test('the account-settings avatar upload resizes the photo before uploadPhoto()', () => {
  assert.match(ACCOUNT_PAGE, /import \{ resizeFileForUpload \} from '@\/lib\/site-evidence';/);
  assert.match(ACCOUNT_PAGE, /uploadPhoto\(await resizeFileForUpload\(file\), 'avatars'\)/,
    'the avatar upload must resize the file first, not send it at full camera resolution');
});

test('community board and community profile photo uploads already resize before upload', () => {
  assert.match(COMMUNITY_BOARD, /uploadPhoto\(await resizeFileForUpload\(file\), 'board'\)/);
  assert.match(COMMUNITY_PROFILE, /uploadPhoto\(await resizeFileForUpload\(file\), 'community'\)/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// swarm/w6-perf, task people-07: the farmer's profile-edit sheet (components/ProfileSheet.tsx,
// opened from app/farmer/page.tsx) and the account-settings avatar picker (app/account/page.tsx)
// both sent uploadProfilePhoto()/uploadPhoto(file, 'avatars') the raw camera file — often several
// megabytes on a farmer's mobile data. app/community/page.tsx and app/community/profile/page.tsx
// already resized via lib/site-evidence.ts's resizeFileForUpload() before uploading; these two
// call sites now do the same. Source-text guard, in the style of tests/home-next-step-links.test.ts.

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const PROFILE_SHEET = read('../components/ProfileSheet.tsx');
const ACCOUNT_PAGE = read('../app/account/page.tsx');
const COMMUNITY_BOARD = read('../app/community/page.tsx');
const COMMUNITY_PROFILE = read('../app/community/profile/page.tsx');

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

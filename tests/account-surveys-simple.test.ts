import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Simple / All tools (Settings → "How much to show", lib/app-level.ts) for swarm/w4-account-
// surveys-simple: app/account/page.tsx and app/surveys/page.tsx. Source-text guard style, the
// same pattern tests/app-level.test.ts and tests/invoice-simple-mode.test.ts use, because both
// pages render as stateful client components rather than a pure function of exported data.
//
// account/page.tsx had no data export/import, storage details, device IDs, tester flags or
// danger-zone controls beyond sign out to begin with — only checked, not moved, since there was
// nothing there to move. What it did have that fits "role/admin details" and "staff tool" is the
// Role row and the AccountAccess panel (role dashboards, sample-mode role preview, "Refresh my
// access"), plus a second "Appearance & language" button that duplicates the header's own
// Settings button. Those move into a "More account settings" disclosure in Simple; All tools is
// untouched. Change password and the POPIA ConsentPanel stay plainly visible in both — neither is
// a developer/advanced item, and consent is the farmer's own record.

const ACCOUNT = readFileSync(new URL('../app/account/page.tsx', import.meta.url), 'utf8');
const SURVEYS = readFileSync(new URL('../app/surveys/page.tsx', import.meta.url), 'utf8');

test('account: reads the Simple / All tools level', () => {
  assert.match(ACCOUNT, /import \{ useAppLevel \} from '@\/lib\/app-level';/);
  assert.match(ACCOUNT, /const simple = useAppLevel\(\) === 'simple';/);
});

test('account: Simple shows name, photo, farm/organisation and language plainly', () => {
  // Avatar + name + edit are never gated on simple — always plain.
  const avatarAt = ACCOUNT.indexOf('{/* Avatar + name */}');
  assert.ok(avatarAt > 0, 'the avatar + name card moved — recheck this guard');
  const avatarBlock = ACCOUNT.slice(avatarAt, avatarAt + 1600);
  assert.doesNotMatch(avatarBlock, /!simple/, 'the avatar/name/edit card must stay plain in Simple');

  // A farm/organisation row exists and is not gated behind simple/moreOpen.
  assert.match(ACCOUNT, /<Row icon=\{Sprout\} label=\{copy\('Farm \/ organisation', 'Ipulazi \/ inhlangano'\)\} value=\{profile\?\.farm_name \?\? orgName \?\? null\} \/>/,
    'a plain Farm / organisation row must exist for Simple');

  // Language stays a plain row, not gated.
  assert.match(ACCOUNT, /<Row icon=\{Globe\} label=\{copy\('Language', 'Ulimi'\)\} value=\{langLabel\} \/>/);
});

test('account: the Role row and AccountAccess move behind the "More account settings" disclosure', () => {
  assert.match(ACCOUNT, /\{\(!simple \|\| moreOpen\) && <Row icon=\{User\} label=\{copy\('Role', 'Isikhundla'\)\} value=\{roleLabel\} \/>\}/,
    'the Role row (role/admin detail) must be gated on !simple || moreOpen');
  assert.match(ACCOUNT, /\{\(!simple \|\| moreOpen\) && <AccountAccess \/>\}/,
    'AccountAccess (role dashboards, sample-mode preview, refresh access) must be gated the same way');
  assert.match(ACCOUNT, /const \[moreOpen, setMoreOpen\] = useState\(false\);/,
    'the disclosure must start collapsed');
  assert.match(ACCOUNT, /\{simple && \(\s*<button onClick=\{\(\) => setMoreOpen/,
    'the "More account settings" toggle must only render in Simple — All tools shows its content unconditionally');
});

test('account: change password and the redundant Appearance shortcut also gate on the disclosure', () => {
  assert.match(ACCOUNT, /\{\(!simple \|\| moreOpen\) && \(!changingPw \? \(/,
    'the Change password block must be gated on !simple || moreOpen');
  const settingsAt = ACCOUNT.indexOf('{/* Settings shortcut.');
  assert.ok(settingsAt > 0, 'the Appearance & language shortcut comment moved — recheck this guard');
  const settingsBlock = ACCOUNT.slice(settingsAt, settingsAt + 500);
  assert.match(settingsBlock, /\{\(!simple \|\| moreOpen\) && \(/,
    'the Appearance & language shortcut must be gated — the header Settings button already reaches the same panel in both modes');
});

test('account: the POPIA consent panel is never hidden by Simple — it is the farmer\'s own record', () => {
  const consentAt = ACCOUNT.indexOf("profile?.role === 'farmer' && profile?.org_id && (");
  assert.ok(consentAt > 0, 'the consent-gating condition moved — recheck this guard');
  const changePasswordAt = ACCOUNT.indexOf('{/* Change password */}');
  assert.ok(changePasswordAt > consentAt, 'the Change password comment moved — recheck this guard');
  const block = ACCOUNT.slice(consentAt, changePasswordAt);
  assert.match(block, /<ConsentPanel orgName=\{orgName\} \/>/);
  assert.doesNotMatch(block, /!simple|moreOpen/, 'Simple must not additionally hide the consent panel');
});

test('account: sign out stays plain and reachable in both modes', () => {
  const at = ACCOUNT.indexOf('{/* Sign out');
  assert.ok(at > 0, 'the sign-out section comment moved — recheck this guard');
  const block = ACCOUNT.slice(at, at + 500);
  assert.doesNotMatch(block, /!simple|moreOpen/, 'Sign out must never be gated behind Simple or the disclosure');
  assert.match(block, /onClick=\{handleSignOut\}/);
});

test('account: no delete-account control exists to hide — nothing to move for that case', () => {
  assert.doesNotMatch(ACCOUNT, /delete.?account/i, 'a delete-account control appeared — it must stay reachable, e.g. inside the disclosure, and this guard needs updating');
});

// ─── Surveys ────────────────────────────────────────────────────────────────

test('surveys: reads the Simple / All tools level', () => {
  assert.match(SURVEYS, /import \{ useAppLevel \} from '@\/lib\/app-level';/);
  assert.match(SURVEYS, /const simple = useAppLevel\(\) === 'simple';/);
});

test('surveys: the builder stays exactly as-is — Simple wiring only touches FarmerSurveyCard', () => {
  const builderAt = SURVEYS.indexOf('function SurveyBuilder(');
  const builderEnd = SURVEYS.indexOf('function StaffSurveyCard(');
  assert.ok(builderAt > 0 && builderEnd > builderAt, 'SurveyBuilder moved — recheck this guard');
  const builderSrc = SURVEYS.slice(builderAt, builderEnd);
  assert.doesNotMatch(builderSrc, /useAppLevel|\bsimple\b/, 'the survey builder (a staff tool) must not read Simple / All tools at all');
});

test('surveys: Simple hides the question-count metadata for a farmer answering', () => {
  const at = SURVEYS.indexOf("{localUi('From', 'Kuvela ku', lang)} {survey.org_name}");
  assert.ok(at > 0, 'the "From {org}" line moved — recheck this guard');
  const block = SURVEYS.slice(at, at + 300);
  assert.match(block, /\{!simple && <>&middot;/, 'the question-count metadata must be gated on !simple');
});

test('surveys: Simple uses bigger answer targets for yes/no and choice questions', () => {
  assert.match(SURVEYS, /className=\{simple \? 'flex-1 py-4 rounded-xl font-display font-semibold text-base' : 'flex-1 py-2\.5 rounded-xl font-display font-semibold text-sm'\}/,
    'the yes/no answer buttons must grow in Simple');
  assert.match(SURVEYS, /className=\{simple \? 'w-full flex items-center gap-3 px-4 py-4 rounded-xl text-left' : 'w-full flex items-center gap-3 px-3\.5 py-2\.5 rounded-xl text-left'\}/,
    'the multiple-choice answer buttons must grow in Simple');
});

test('surveys: "Send answers" is reachable in Simple, "Submit" in All tools, both submit the same action', () => {
  const at = SURVEYS.indexOf('onClick={handleSubmit}');
  assert.ok(at > 0, 'the submit button moved — recheck this guard');
  const block = SURVEYS.slice(at, at + 900);
  assert.match(block, /simple \? localUi\('Send answers', 'Thumela izimpendulo', lang\) : localUi\('Submit', 'Thumela', lang\)/,
    'Simple must offer one "Send answers" action; All tools keeps "Submit"');
  // One action, one handler — not a second/duplicate submit path.
  assert.equal((SURVEYS.match(/onClick=\{handleSubmit\}/g) ?? []).length, 1);
});

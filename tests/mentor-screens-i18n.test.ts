import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// swarm/w8-mentor-i18n: components/FieldTeams.tsx, components/MemberAccessPreview.tsx and
// components/PeoplePanel.tsx already called useLanguage()/read `lang`, but rendered most visible
// text as literal English. This pins each component's chrome to t()/MENTOR_ENGLISH_PENDING keys,
// in the source-shape-guard style of tests/species-picker-i18n.test.ts.
//
// FieldTeams.tsx's FIELD_PROGRAMMES/FIELD_PROGRAMMES_ZU `ui(...)` call sites are deliberately left
// alone here — tests/field-programmes-i18n.test.ts already pins their exact shape, and this file
// must not fight that guard. Likewise components/PeoplePanel.tsx's `aria-label={isCurrentUser ?
// 'Open your profile' : undefined}` and `const Wrapper = isCurrentUser ? 'button' : 'div'` stay
// literal English — tests/a11y-modal-semantics.test.ts pins that exact source text.

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('FieldTeams.tsx routes its chrome through t()/paired(), not literal English', () => {
  const s = source('components/FieldTeams.tsx');
  assert.match(s, /const \{ lang, t \} = useLanguage\(\)/, 'FieldTeams must read t() from useLanguage()');
  assert.match(s, /const paired = \(key: string\)/, 'FieldTeams must keep its paired() helper for isiZulu-drafted keys');

  // Spot-check across the panels named in the task: hero, tabs, metrics, visit form, empty states.
  for (const call of [
    "t('mentorLoadingFieldTeam')",
    "t('mentorFieldworkViewsAria')",
    "paired('mentorRecordFieldVisit')",
    "t('mentorMetricAssignedParticipants')",
    "t('mentorWhatNeedsAttention')",
    "paired('mentorParticipantLabel')",
    "paired('mentorSupportAreasCovered')",
    "t('mentorNoVisitsRecorded')",
    "t('mentorNoParticipantsMatch')",
    "t('mentorNoFieldTeamAssigned')",
    "t('mentorAssignUpdateTeam')",
  ]) {
    assert.ok(s.includes(call), `FieldTeams.tsx no longer calls ${call}`);
  }

  // The pinned FIELD_PROGRAMMES ui() call sites (tests/field-programmes-i18n.test.ts) must survive.
  assert.match(s, /\{ui\(FIELD_PROGRAMMES\[t\.programme\?\?'general'\],FIELD_PROGRAMMES_ZU\[t\.programme\?\?'general'\]\)\}/,
    'the pinned team-card programme label regressed');
  assert.match(s, /\{ui\(label,FIELD_PROGRAMMES_ZU\[key as FieldProgramme\]\)\}/,
    'the pinned "Programme focus" picker regressed');

  // Regression guard: these exact hard-coded English literals must not come back.
  assert.doesNotMatch(s, /<p>Loading field team…<\/p>/, 'loading text regressed to hard-coded English');
  assert.doesNotMatch(s, /<h2>What needs attention<\/h2>/, 'overview heading regressed to hard-coded English');
  assert.doesNotMatch(s, /aria-label="Recorded field visits"/, 'recorded-visits aria-label regressed to hard-coded English');
});

test('MemberAccessPreview.tsx routes its chrome through t()', () => {
  const s = source('components/MemberAccessPreview.tsx');
  assert.match(s, /\buseLanguage\(\)/, 'MemberAccessPreview must read the active language context');
  for (const call of [
    "t('mentorAccessCheckHeading')",
    "t('mentorAccessCheckIntro')",
    "t('mentorAccessMemberLabel')",
    "t('mentorAccessChecking')",
    "t('mentorAccessAssignedFieldGroup')",
    "t('mentorAccessReadOnlyNotice')",
  ]) {
    assert.ok(s.includes(call), `MemberAccessPreview.tsx no longer calls ${call}`);
  }
  assert.doesNotMatch(s, /<h2>Check a member.s saved access<\/h2>/, 'heading regressed to hard-coded English');
});

test('PeoplePanel.tsx routes its chrome through t()', () => {
  const s = source('components/PeoplePanel.tsx');
  assert.match(s, /\buseLanguage\(\)/, 'PeoplePanel must read the active language context');
  for (const call of [
    "t('mentorPeopleUnavailableHeading')",
    "t('mentorNoTeamMembersFound')",
    "t('mentorProjectTeamLabel')",
    "t('mentorEditProfileButton')",
    "t(ROLE_LABEL_KEYS[role])",
  ]) {
    assert.ok(s.includes(call), `PeoplePanel.tsx no longer calls ${call}`);
  }

  // The accessibility guard (tests/a11y-modal-semantics.test.ts) pins this exact literal aria-label
  // and element-switch — they must survive untouched by this translation pass.
  assert.match(s, /const Wrapper = isCurrentUser \? 'button' : 'div'/);
  assert.match(s, /aria-label=\{isCurrentUser \? 'Open your profile' : undefined\}/);

  // Regression guard: the old hard-coded role-label map must be gone.
  assert.doesNotMatch(s, /ngo: 'NGO Staff',/, 'ROLE_LABEL reverted to a hard-coded English map');
  assert.doesNotMatch(s, /No team members found\. Invite colleagues to join your organisation\./,
    'empty-state copy regressed to hard-coded English');
});

test('the MENTOR_ENGLISH_PENDING keys these components use are wired into every locale', () => {
  const pendingSrc = source('lib/i18n-pending.ts');
  assert.match(pendingSrc, /export const MENTOR_ENGLISH_PENDING: Dict = \{/);

  const i18nSrc = source('lib/i18n.tsx');
  assert.match(i18nSrc, /\.\.\.MENTOR_ENGLISH_PENDING,/, 'T_en must spread MENTOR_ENGLISH_PENDING');

  for (const code of ['af', 'zu', 'xh', 'nso', 'tn', 'st', 'ts', 've', 'ss', 'nr']) {
    const localeSrc = source(`lib/locales/${code}.ts`);
    assert.match(localeSrc, /\.\.\.MENTOR_ENGLISH_PENDING,/, `${code}.ts must spread MENTOR_ENGLISH_PENDING`);
  }
});

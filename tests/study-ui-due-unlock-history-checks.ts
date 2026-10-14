import { withBlindReviewedCorrectionReadScope } from './blind-reviewed-study-corrections-history-checks.ts';
import { blindReviewedSourceBefore } from './blind-reviewed-study-corrections-history-checks.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
// Validate the bounded current audit corrections before this dated predecessor claim.
import { readBlindReviewedHistoryFile as readFileSync } from './blind-reviewed-study-corrections-history-checks.ts';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHAT_PANEL_ENGLISH_PENDING, NETWORK_FAILURE_ENGLISH_PENDING, PHOTO_UPLOAD_ENGLISH_PENDING, PROFILE_SHEET_ENGLISH_PENDING } from '../lib/i18n-pending.ts';

const folder = 'docs/study-translation-reviews/study-ui-due-unlock-2026-10-08/';
const root = fileURLToPath(new URL('../', import.meta.url));
const path = (file: string) => resolve(root, file);
const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const predecessorSourcePath = folder + 've-before.ts.txt';
const predecessorLocalePath = folder + 've-before.json';
const currentLocalePath = folder + 've-after.json';
const predecessorSource = readFileSync(path(predecessorSourcePath));
const predecessorLocaleBytes = readFileSync(path(predecessorLocalePath));
const currentLocaleBytes = readFileSync(path(currentLocalePath));
const predecessorLocale = JSON.parse(predecessorLocaleBytes.toString());
const currentLocale = JSON.parse(currentLocaleBytes.toString());

assert.equal(sha(predecessorSource), 'e9deff4c7b627e99378bbc574111e23dd346911fcc8d4afb3ac60358c910db0e', 'exact complete VE source before the due/unlock layer');
assert.equal(sha(predecessorLocaleBytes), 'e11dcd0b19061de333ad2b810408fde435f1b43605fdde7a68886c77f60e934a', 'exact complete VE dictionary before the due/unlock layer');
assert.equal(sha(currentLocaleBytes), '6f705e0b0bdf20992d3767477af2ce96f8f044bd7513f336a678df9348b6a0b9', 'exact complete VE dictionary after the due/unlock layer');

const acceptedAdditions: Record<string, string> = {
  studentDueToday: 'Zwi tea u itwa ṋamusi',
  studentDueTomorrow: 'Zwi tea u itwa matshelo',
  studentDaysOverdue: 'Zwo lenga nga maḓuvha a {count}',
  studentDueInDays: 'Zwi tea u itwa nga maḓuvha a {count}',
  studentDueDate: 'Zwi tea u itwa nga {date}',
  studentOpenedByMentor: 'Zwo vulwa nga mueletshedzi waṋu',
  studentFinishToUnlock: 'Fhedzisani ngudo ya “{title}” uri ni kone u vula izwi',
  studentSubmitToUnlock: 'Rumelani mushumo wa ngudo ya “{title}” uri ni kone u vula izwi',
  studentPractitioner: 'Muthu ane a shumisa Permaculture',
};
const expectedLocale = structuredClone(predecessorLocale);
for (const [key, value] of Object.entries(acceptedAdditions)) {
  assert.equal(Object.hasOwn(predecessorLocale, key), false, `${key}: absent from exact predecessor`);
  assert.equal(currentLocale[key], value, `${key}: exact accepted unreviewed draft`);
  expectedLocale[key] = value;
}
assert.deepEqual(currentLocale, expectedLocale, 'only the nine accepted VE labels are added; every pre-existing entry stays exact');

const WAVE_11_IMPORT = "import { CHAT_PANEL_ENGLISH_PENDING, DESIGN_STUDIO_ENGLISH_PENDING, JOURNAL_ENGLISH_PENDING, LIMA_ENGLISH_PENDING, MENTOR_ENGLISH_PENDING, NETWORK_FAILURE_ENGLISH_PENDING, PHOTO_UPLOAD_ENGLISH_PENDING, PROFILE_SHEET_ENGLISH_PENDING, type Dict }";
const WAVE_10_IMPORT = "import { DESIGN_STUDIO_ENGLISH_PENDING, JOURNAL_ENGLISH_PENDING, LIMA_ENGLISH_PENDING, MENTOR_ENGLISH_PENDING, type Dict }";
const WAVE_11_SPREADS = '  ...CHAT_PANEL_ENGLISH_PENDING,\n  ...PHOTO_UPLOAD_ENGLISH_PENDING,\n  ...PROFILE_SHEET_ENGLISH_PENDING,\n  ...NETWORK_FAILURE_ENGLISH_PENDING,\n';
const WAVE_11_ZULU_BLOCK = '\n\n  // Ask tab chat panel (components/ChatPanel.tsx) — wave 11';
/** Remove exactly the wave 11 import names, spreads and (isiZulu only) trailing draft block. */
function rewindWave11Locale(text: string): string {
  assert.equal(text.split(WAVE_11_IMPORT).length, 2, 'one wave 11 pending import');
  assert.equal(text.split(WAVE_11_SPREADS).length, 2, 'one wave 11 spread group');
  let before = text.replace(WAVE_11_IMPORT, WAVE_10_IMPORT).replace(WAVE_11_SPREADS, '');
  const block = before.indexOf(WAVE_11_ZULU_BLOCK);
  if (block >= 0) before = before.slice(0, block) + before.slice(before.lastIndexOf('\n};'));
  return before;
}
/** The five predecessor lines wave 11 reworded (water, Ask tab, soil hints, altitude), none in Studies. */
const WAVE_11_REWORDED = new Set([
  "  waterBalanceMinSafe: 'Min safe: {amount} kL',",
  "  tabAI: 'AI',",
  "  soilImprovementCompacted: 'Bulk density {bd} g/cm³ suggests compaction — deep-rooted cover crops and broadfork open the profile',",
  "  soilImprovementSandy: 'Sandy soil ({sand}%) — mulch heavily and boost CEC with compost and biochar',",
  "  homeStatASL: 'ASL',",
]);
function assertOnlyWave11Additions(before: string, live: string) {
  const liveLines = live.split('\n');
  const keyOf = (line: string) => /^ {2}([A-Za-z_$][\w$]*): /.exec(line)?.[1];
  const rewordedKeys = new Set([...WAVE_11_REWORDED].map(keyOf));
  const beforeKeys = new Set(before.split('\n').map(keyOf).filter(Boolean));
  const added: string[] = [];
  let at = 0, reworded = 0;
  for (const line of before.split('\n')) {
    if (WAVE_11_REWORDED.has(line)) { reworded++; continue; }
    const from = at;
    while (at < liveLines.length && liveLines[at] !== line) at++;
    assert.ok(at < liveLines.length, `predecessor line lost or reordered by wave 11: ${line.slice(0, 80)}`);
    added.push(...liveLines.slice(from, at));
    at++;
  }
  added.push(...liveLines.slice(at));
  assert.equal(reworded, WAVE_11_REWORDED.size, 'each named wave 11 rewording is accounted for once');
  // A later duplicate key in an object literal silently wins, so no added line may re-declare a
  // predecessor key other than the five named rewordings.
  for (const line of added) {
    const key = keyOf(line);
    if (key && !rewordedKeys.has(key)) assert.ok(!beforeKeys.has(key), `wave 11 re-declares predecessor key ${key}`);
  }
}

export function ensureStudyUiDueUnlockCurrent() {
  return withBlindReviewedCorrectionReadScope(() => {
  // Wave 11 (lang-01) spreads four new English-pending groups (Ask chat, photo upload, profile
  // sheet, network failure) into every locale and adds unreviewed isiZulu drafts for them, all
  // outside Studies. Check each complete new file, then rewind exactly those additions so the
  // earlier whole-file pins below still bind byte for byte.
  const liveSource = readFileSync(path('lib/locales/ve.ts'));
  assert.equal(sha(liveSource), 'bb0983d867888c06e799cf8f82d4ef97332f0a47184e5f1ce8b8725ffd67be04', 'complete live VE source bytes after the wave 11 pending spreads');
  assert.equal(sha(rewindWave11Locale(liveSource.toString())), '0062c005b859e3723ce3ca24923cd8880d7f078c09f2b8c67f3df91a92790a69', 'complete live VE source bytes for the newest accepted layer');
  // Main #990 adds report-footnote keys to the shared app dictionary, outside
  // Studies. Check the complete new file before rewinding precisely its two
  // additions; the original whole-file Study predecessor check still binds.
  // Wave 11 adds non-Study keys across the app dictionary in many places, so the exact
  // predecessor is kept as a fixture: it must hash to the earlier whole-file pin, and every one
  // of its lines must survive in order in the live file except the five named non-Study edits.
  const liveEnglish = readFileSync(path('lib/i18n.tsx'), 'utf8');
  assert.equal(sha(liveEnglish), 'c113a108d9c1cd9728cb39c172fc1cbf7aa35fa9de393e23779e96d84d0a845d', 'complete app dictionary after the wave 11 additions');
  const english = readFileSync(path('tests/fixtures/i18n-before-wave-11.tsx.txt'), 'utf8');
  assert.equal(sha(english), 'd37673fb5c1a65ea78b4981b9ef24ade6f174365c7c999f20c3f03bc8326f3c7', 'complete app dictionary after the reviewed report-footnote layer remains exact');
  assertOnlyWave11Additions(english, liveEnglish);
  const predecessor = english
    .replace('MENTOR_ENGLISH_PENDING, REPORT_FOOTNOTE_ENGLISH_PENDING, type Dict', 'MENTOR_ENGLISH_PENDING, type Dict')
    .replace('  ...REPORT_FOOTNOTE_ENGLISH_PENDING,\n', '');
  assert.equal(sha(predecessor), 'e59b3c22b8d89455c3862be6f418e52b3f47762ad504bcfa4e7f35cb1cc22318', 'canonical English Study source dictionary remains exact after only the two reviewed non-Study additions');
  assert.equal(sha(readFileSync(path('lib/learner-ui-english.ts'))), '7d29b6d32a551a57070489ad33ccee003a2ebdd84a13874360e976af20e6fe74', 'canonical English learner UI source remains exact');
  const liveZulu = readFileSync(path('lib/locales/zu.ts'), 'utf8');
  assert.equal(sha(liveZulu), 'ff57af75e2a8583e76b193bc1a92855d0c259acdd75d39d859cba49f5dee95ce', 'complete isiZulu locale source after the wave 11 Ask drafts');
  assert.equal(sha(rewindWave11Locale(liveZulu)), '2462f4298e9e854c041328ec3c030e85efaffd08c9c1f3ab104a71dc8e5ba6dc', 'isiZulu locale source remains exact');
  });
}

/** Project the exact predecessor only after the complete current source hash validates. */
export function studyUiDueUnlockSourceBefore(file: string, bytes: string | Uint8Array): string | Uint8Array {
  return withBlindReviewedCorrectionReadScope(() => {
  bytes = blindReviewedSourceBefore(file, bytes);
  if (file !== 'lib/locales/ve.ts') return bytes;
  ensureStudyUiDueUnlockCurrent();
  const supplied = Buffer.from(bytes);
  const live = readFileSync(path(file));
  if (supplied.equals(predecessorSource)) return bytes;
  if (supplied.equals(live)) return typeof bytes === 'string' ? predecessorSource.toString() : predecessorSource;
  return bytes;
  });
}

/** The four non-Study English-pending groups wave 11 spreads into the VE dictionary. */
const WAVE_11_PENDING: Record<string, string> = { ...CHAT_PANEL_ENGLISH_PENDING, ...PHOTO_UPLOAD_ENGLISH_PENDING, ...PROFILE_SHEET_ENGLISH_PENDING, ...NETWORK_FAILURE_ENGLISH_PENDING };
/** Remove exactly the wave 11 pending keys, each only if it still holds its exact English source value. */
function rewindWave11Dictionary(actual: unknown): unknown {
  if (!actual || typeof actual !== 'object') return actual;
  const dict = actual as Record<string, unknown>;
  const keys = Object.keys(WAVE_11_PENDING);
  if (!keys.some(key => Object.hasOwn(dict, key))) return actual;
  const before = { ...dict };
  for (const key of keys) {
    assert.equal(Object.hasOwn(currentLocale, key), false, `${key}: wave 11 key is new, absent from the due/unlock dictionary`);
    assert.equal(dict[key], WAVE_11_PENDING[key], `${key}: wave 11 holds the exact English pending value`);
    delete before[key];
  }
  return before;
}

/** Project the exact prior dictionary; callers compare that result in the older history layer. */
export function studyUiDueUnlockLocaleBefore(actual: unknown): unknown {
  return withBlindReviewedCorrectionReadScope(() => {
  ensureStudyUiDueUnlockCurrent();
  actual = rewindWave11Dictionary(actual);
  assert.deepEqual(currentLocale, JSON.parse(currentLocaleBytes.toString()));
  if (JSON.stringify(actual) === JSON.stringify(predecessorLocale)) return structuredClone(actual);
  if (JSON.stringify(actual) === JSON.stringify(currentLocale)) return structuredClone(predecessorLocale);
  return actual;
  });
}

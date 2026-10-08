import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

export function ensureStudyUiDueUnlockCurrent() {
  const liveSource = readFileSync(path('lib/locales/ve.ts'));
  assert.equal(sha(liveSource), '0062c005b859e3723ce3ca24923cd8880d7f078c09f2b8c67f3df91a92790a69', 'complete live VE source bytes for the newest accepted layer');
  assert.equal(sha(readFileSync(path('lib/i18n.tsx'))), 'e59b3c22b8d89455c3862be6f418e52b3f47762ad504bcfa4e7f35cb1cc22318', 'canonical English Study source dictionary remains exact');
  assert.equal(sha(readFileSync(path('lib/learner-ui-english.ts'))), '7d29b6d32a551a57070489ad33ccee003a2ebdd84a13874360e976af20e6fe74', 'canonical English learner UI source remains exact');
  assert.equal(sha(readFileSync(path('lib/locales/zu.ts'))), '2462f4298e9e854c041328ec3c030e85efaffd08c9c1f3ab104a71dc8e5ba6dc', 'isiZulu locale source remains exact');
}

/** Project the exact predecessor only after the complete current source hash validates. */
export function studyUiDueUnlockSourceBefore(file: string, bytes: string | Uint8Array): string | Uint8Array {
  if (file !== 'lib/locales/ve.ts') return bytes;
  ensureStudyUiDueUnlockCurrent();
  const supplied = Buffer.from(bytes);
  const live = readFileSync(path(file));
  if (supplied.equals(predecessorSource)) return bytes;
  if (supplied.equals(live)) return typeof bytes === 'string' ? predecessorSource.toString() : predecessorSource;
  return bytes;
}

/** Project the exact prior dictionary; callers compare that result in the older history layer. */
export function studyUiDueUnlockLocaleBefore(actual: unknown): unknown {
  ensureStudyUiDueUnlockCurrent();
  assert.deepEqual(currentLocale, JSON.parse(currentLocaleBytes.toString()));
  if (JSON.stringify(actual) === JSON.stringify(predecessorLocale)) return structuredClone(actual);
  if (JSON.stringify(actual) === JSON.stringify(currentLocale)) return structuredClone(predecessorLocale);
  return actual;
}

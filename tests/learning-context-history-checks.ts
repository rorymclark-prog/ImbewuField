import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The reviewed learning notice is a newer UI layer, not a change to the dated
// course source. Older owners may see their exact predecessor only after both
// the complete mounted page and the complete notice have passed their own pins.
const root = fileURLToPath(new URL('../', import.meta.url));
const page = 'app/student/page.tsx';
const notice = 'components/studies/LearningRegionNotice.tsx';
const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const shortcutPageSha = 'b63181ee9d1cca5d83da3084e8a0c1c477d59720827e01da11e851fedc4a5599';
const noticePageSha = 'ece4f0787a0e0c5e14d6d5f406aef782e195cedb22b1578013a0b2781e173730';
const previousPageSha = 'a361890bfdb03c22e74a01b61516f759cf93225ca20b83edf422aa37a9712272';
const additions = [
  Buffer.from("import LearningRegionContext from '@/components/studies/LearningRegionNotice';\n"),
  Buffer.from('        <LearningRegionContext scope="core-farming" />\n'),
];

// The 26 November Study shortcut (#1423, 49147aa46) replaced one JSX span.
// The source on each side is kept here so shallow CI and the isolated history
// fixtures can verify the exact edit without reading Git or trusting a marker.
const actionsWithManual = Buffer.from([
  "            <div className={styles.studyActions}>",
  "              <div>",
  "                <button type=\"button\" className={`font-sans ${styles.studyButton}`} onClick={() => {",
  "                  setCourseOpen(true);",
  "                  setExpandedModuleId(studyModule.id);",
  "                  requestAnimationFrame(() => document.getElementById(`module-${studyModule.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));",
  "                }}><PlayCircle size={18} />{pct === 100 ? t('studentRevisit') : doneCount === 0 ? t('studentStart') : t('studentContinue')}</button>",
  "                <span className={`font-sans ${styles.nextLesson}`}>{studyModulePresentation.title}</span>",
  "              </div>",
  "              <Link href=\"/manual\" className={`font-sans ${styles.studyButton} ${styles.manualLink}`}>",
  "                <BookOpen size={18} aria-hidden=\"true\" />{t('navManual')}",
  "              </Link>",
  "            </div>",
  '',
].join('\n'));
const actionsBeforeManual = Buffer.from([
  "            <button type=\"button\" className={`font-sans ${styles.studyButton}`} onClick={() => {",
  "              setCourseOpen(true);",
  "              setExpandedModuleId(studyModule.id);",
  "              requestAnimationFrame(() => document.getElementById(`module-${studyModule.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));",
  "",
  "            }}><PlayCircle size={18} />{pct === 100 ? t('studentRevisit') : doneCount === 0 ? t('studentStart') : t('studentContinue')}</button>",
  "            <span className={`font-sans ${styles.nextLesson}`}>{studyModulePresentation.title}</span>",
  '',
].join('\n'));

export function beforeStudyManualShortcut(live: Buffer): Buffer {
  assert.equal(live.length, 88519, page + ': complete actual live successor size');
  assert.equal(sha(live), shortcutPageSha, page + ': complete actual live successor, including the manual link and every unlisted byte');
  const start = live.indexOf(actionsWithManual);
  assert.ok(start >= 0, page + ': exact Study manual shortcut and neighbouring course action');
  const end = start + actionsWithManual.length;
  assert.equal(live.indexOf(actionsWithManual, end), -1, page + ': one reviewed Study action group');
  const restored = Buffer.concat([live.subarray(0, start), actionsBeforeManual, live.subarray(end)]);
  assert.equal(restored.length, 88187, page + ': original complete learning-context successor size');
  assert.equal(sha(restored), noticePageSha, page + ': original complete learning-context successor bytes');
  return restored;
}

function removeReviewedAdditions(supplied: Uint8Array): Buffer {
  let bytes = Buffer.from(supplied);
  for (const addition of additions) {
    const offset = bytes.indexOf(addition);
    assert.ok(offset >= 0, page + ': the exact reviewed learning-context addition is present');
    assert.equal(bytes.indexOf(addition, offset + addition.length), -1, page + ': each reviewed addition occurs exactly once');
    // Only the declared byte spans disappear; all unlisted bytes retain order.
    bytes = Buffer.concat([bytes.subarray(0, offset), bytes.subarray(offset + addition.length)]);
  }
  assert.equal(bytes.length, 88053, page + ': exact pre-learning-context successor size');
  assert.equal(sha(bytes), previousPageSha, page + ': only the reviewed additions separate the complete historical successor');
  return bytes;
}

function readCheckedSources() {
  // Do not reuse a successful stat signature here. Historical callers can nest
  // inside an older checked scope; a changed current read must still be visible.
  const live = readFileSync(resolve(root, page));
  const withNotice = beforeStudyManualShortcut(live);
  const component = readFileSync(resolve(root, notice));
  assert.equal(component.length, 9886, notice + ': complete actual live successor size');
  assert.equal(sha(component), '334871cadceedffd6dd2c6de33a9457ade8b89882685c03e5bcebb81488ae747',
    notice + ': complete actual live successor of the reviewed learning-context layer');
  return { live, withNotice, before: removeReviewedAdditions(withNotice) };
}

export function ensureLearningContextCurrent(): void {
  readCheckedSources();
}

/** Reverse only the exact reviewed UI additions. Unknown caller bytes stay
 * exposed to the original dated owner's complete byte/hash assertions. */
export function learningContextSourceBefore<T extends string | Uint8Array>(file: string, supplied: T): T {
  if (file !== page) return supplied;
  const { live, withNotice, before } = readCheckedSources();
  const bytes = typeof supplied === 'string' ? Buffer.from(supplied) : supplied as Uint8Array;
  if (!live.equals(bytes) && !withNotice.equals(bytes)) return supplied;
  return (typeof supplied === 'string' ? before.toString()
    : Buffer.isBuffer(supplied) ? Buffer.from(before) : new Uint8Array(before)) as T;
}

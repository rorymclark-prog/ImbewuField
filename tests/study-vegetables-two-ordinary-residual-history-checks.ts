import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COURSE_MODULES } from '../lib/course-modules.ts';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const repositoryPath = (path: string) => resolve(repositoryRoot, path);
const reviewDirectory = 'docs/study-translation-reviews/vegetables-two-ordinary-residual-2026-10-08/';
const packetPath = reviewDirectory + 'prepared-layer.json';
const mediaPacketPath = reviewDirectory + 'media-proof.json';
const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const packetBytes = readFileSync(repositoryPath(packetPath));
assert.equal(sha(packetBytes), 'b0050c4c517e5f42464eb838a408f15c714535caba4f80d7904d875021c38d24', 'prepared source/reviewer packet is immutable');
const packet = JSON.parse(packetBytes.toString());
const mediaPacketBytes = readFileSync(repositoryPath(mediaPacketPath));
assert.equal(sha(mediaPacketBytes), 'de15dd6662fa5fbd88f98f3c38a8fac00e8e9cbaf62ab80739ad758c42be4117', 'paired-card render and migration proof is immutable');
const mediaPacket = JSON.parse(mediaPacketBytes.toString());
const [veRow, tsRow] = packet.changes;

function restoreExactSourceFile(row: any, path: string): string {
  const bytes = readFileSync(repositoryPath(path));
  const currentHash = sha(bytes);
  assert.equal(currentHash, row.sourceFileHashesAfter.learner);
  const currentText = bytes.toString();
  assert.equal(currentText.split(row.afterTarget).length - 1, 1, `${path}: target appears exactly once`);
  const restored = currentText.replace(row.afterTarget, row.beforeTarget);
  const beforeHash = row.sourceFileHashesBefore.learner;
  assert.equal(sha(restored), beforeHash, `${path}: reversing one target restores every predecessor byte`);
  return currentText;
}

function canonicalLesson(lessonId: string) {
  const module = COURSE_MODULES.find(item => item.id === 'vegetables-staples');
  assert.ok(module, 'canonical Vegetables and Staple Crops module exists');
  const lesson = module.lessons.find(item => item.id === lessonId);
  assert.ok(lesson, `${lessonId}: canonical lesson exists`);
  return lesson;
}

function projectNativeBefore<T>(actual: T): T {
  const module = actual as any;
  if (module?.id !== 'vegetables-staples') return actual;
  const language = module.language;
  const row = language === 've' ? veRow : language === 'ts' ? tsRow : undefined;
  if (!row) return actual;
  const learnerPath = row.language === 've'
    ? 'lib/course-translation-drafts-ve-vegetables-staples.ts'
    : 'lib/course-translation-drafts-ts-vegetables-staples.ts';
  const learnerText = restoreExactSourceFile(row, learnerPath);
  const source = canonicalLesson(row.lessonId);
  const lesson = module.lessons.find((item: any) => item.id === row.lessonId);
  if (!lesson) return actual;
  assert.equal(lesson.body.sourceEnglish, source.body, `${row.id}: exact full canonical source binding`);
  assert.equal(lesson.body.reviewStatus, 'machine-draft', `${row.id}: machine-draft status stays visible`);
  const key = language === 've' ? 'tshivendaDraft' : 'xitsongaDraft';
  const targetIndex = row.language === 've' ? 14 : 0;
  const paragraphs = lesson.body[key].split('\n\n');
  if (paragraphs[targetIndex] === row.afterTarget) paragraphs[targetIndex] = row.beforeTarget;
  else assert.equal(paragraphs[targetIndex], row.beforeTarget, `${row.id}: complete current registry target is current or exact predecessor`);
  const beforeBody = paragraphs.join('\n\n');
  assert.ok(learnerText.includes(row.afterTarget), `${row.id}: exact learner target remains in its source file`);
  const projected = structuredClone(actual) as any;
  const priorLesson = projected.lessons.find((item: any) => item.id === row.lessonId);
  priorLesson.body[key] = beforeBody;
  return projected;
}

export function studyVegetablesTwoResidualSourceBefore(file: string, bytes: string | Uint8Array): string | Uint8Array {
  if (file === 'app/sw.js/route.ts' || file === 'lib/course-asset-sizes.ts') {
    const row = mediaPacket.sourceFiles[file];
    const supplied = Buffer.from(bytes);
    const digest = sha(supplied);
    const live = readFileSync(repositoryPath(file));
    assert.equal(sha(live), row.afterSha256, `${file}: complete current source hash for two-card media change`);
    if (digest === row.beforeSha256) return bytes;
    if (digest === row.afterSha256) {
      let prior = supplied.toString();
      if (file === 'lib/course-asset-sizes.ts') {
        for (const asset of mediaPacket.assets) {
          const current = `'${asset.url}': ${asset.afterBytes}`;
          const previous = `'${asset.url}': ${asset.beforeBytes}`;
          assert.equal(prior.split(current).length - 1, 1, `${asset.url}: one exact current manifest entry`);
          prior = prior.replace(current, previous);
        }
      } else {
        const start = prior.indexOf('\n// These two newly reviewed text spans change their paired stills.');
        const end = prior.indexOf("\nself.addEventListener('activate'", start);
        assert.ok(start >= 0 && end > start, 'new one-time two-card migration block is uniquely bounded');
        prior = prior.slice(0, start) + prior.slice(end);
        const activation = '.then(migrateVegetablesTwoOrdinaryResidualStills)';
        assert.equal(prior.split(activation).length - 1, 1, 'one activation link is present for the two-card migration');
        prior = prior.replace(activation, '');
      }
      assert.equal(sha(prior), row.beforeSha256, `${file}: exact media-layer reversal restores complete predecessor bytes`);
      return typeof bytes === 'string' ? prior : Buffer.from(prior);
    }
    return bytes;
  }
  const row = file === 'lib/course-translation-drafts-ve-vegetables-staples.ts' || file === veRow.pairedPath ? veRow
    : file === 'lib/course-translation-drafts-ts-vegetables-staples.ts' || file === tsRow.pairedPath ? tsRow : undefined;
  if (!row) return bytes;
  const field = file === row.pairedPath ? 'paired' : 'learner';
  const digest = (value: string | Uint8Array) => sha(value);
  const liveBytes = readFileSync(repositoryPath(file));
  assert.equal(digest(liveBytes), row.sourceFileHashesAfter[field], `${row.id}: full current ${field} file hash`);
  const supplied = Buffer.from(bytes);
  const beforeHash = row.sourceFileHashesBefore[field];
  if (digest(supplied) === beforeHash) return bytes;
  const text = supplied.toString();
  if (digest(supplied) === row.sourceFileHashesAfter[field]) {
    assert.equal(text.split(row.afterTarget).length - 1, 1, `${row.id}: only one target occurrence can be projected`);
    const prior = text.replace(row.afterTarget, row.beforeTarget);
    assert.equal(digest(prior), beforeHash, `${row.id}: exact reverse restores all source and unlisted bytes`);
    return typeof bytes === 'string' ? prior : Buffer.from(prior);
  }
  // An older owner may call after already projecting its own fields from this
  // same file. Project only this exact leaf; that owner then validates its full
  // predecessor snapshot and rejects every unrelated caller change.
  const currentCount = text.split(row.afterTarget).length - 1;
  const priorCount = text.split(row.beforeTarget).length - 1;
  if (currentCount === 0 && priorCount === 1) return bytes;
  assert.equal(currentCount, 1, `${row.id}: complete source must contain the unique current target before its projection`);
  const prior = text.replace(row.afterTarget, row.beforeTarget);
  return typeof bytes === 'string' ? prior : Buffer.from(prior);
}

export function studyVegetablesTwoResidualAssetBefore(path: string, bytes: Uint8Array) {
  const url = path.startsWith('public/') ? path.slice(6) : path;
  const row = mediaPacket.assets.find((asset: any) => asset.url === url);
  if (!row) return null;
  ensureStudyVegetablesTwoResidualCurrent();
  const digest = sha(bytes);
  assert.ok(digest === row.afterSha256 || digest === row.beforeSha256, `${url}: exact current or recorded predecessor image bytes`);
  return { bytes: digest === row.afterSha256 ? row.beforeBytes : bytes.byteLength, sha256: digest === row.afterSha256 ? row.beforeSha256 : row.beforeSha256, width: row.width, height: row.height };
}

function projectPairedBefore(path: string, actual: any): any {
  const row = path === veRow.pairedPath ? veRow : path === tsRow.pairedPath ? tsRow : undefined;
  if (!row) return actual;
  const bytes = readFileSync(repositoryPath(path));
  assert.equal(sha(bytes), row.sourceFileHashesAfter.paired, `${row.id}: complete paired file after hash`);
  const sourceFileBeforeHash = row.sourceFileHashesBefore.paired;
  const text = bytes.toString();
  assert.equal(text.split(row.afterTarget).length - 1, 1, `${row.id}: exact paired target occurs once`);
  assert.equal(sha(text.replace(row.afterTarget, row.beforeTarget)), sourceFileBeforeHash,
    `${row.id}: reversing one paired target restores every predecessor byte`);
  const slide = actual.slides.find((item: any) => item.n === row.pairedSlide);
  assert.ok(slide, `${row.id}: paired slide remains present`);
  const bodyIndex = row.pairedField.match(/body\[(\d+)\]/)?.[1];
  assert.ok(bodyIndex, `${row.id}: paired body locator is explicit`);
  assert.equal(slide.english.body[Number(bodyIndex)], row.sourceEnglish, `${row.id}: exact English paired source`);
  assert.equal(slide.target.body[Number(bodyIndex)].status, 'draft', `${row.id}: paired target remains machine-draft`);
  assert.ok([row.afterTarget, row.beforeTarget].includes(slide.target.body[Number(bodyIndex)].text),
    `${row.id}: complete current paired file is current or exact predecessor`);
  const projected = structuredClone(actual);
  const projectedText = projected.slides.find((item: any) => item.n === row.pairedSlide).target.body[Number(bodyIndex)].text;
  if (projectedText === row.afterTarget) projected.slides.find((item: any) => item.n === row.pairedSlide).target.body[Number(bodyIndex)].text = row.beforeTarget;
  return projected;
}

export function studyVegetablesTwoResidualNativeBefore<T>(actual: T): T {
  return projectNativeBefore(actual);
}

export function studyVegetablesTwoResidualPairedBefore(path: string, actual: any): any {
  return projectPairedBefore(path, actual);
}

export function studyVegetablesTwoResidualPresentationBefore<T extends { status?: string; content: any }>(
  value: T,
  lessonId: string,
  language: string,
): T {
  const row = packet.changes.find((item: any) => item.lessonId === lessonId && item.language === language);
  if (!row || value.status !== 'draft') return value;
  ensureStudyVegetablesTwoResidualCurrent();
  const index = language === 've' ? 14 : 0;
  const paragraphs = value.content.body.split('\n\n');
  assert.ok([row.afterTarget, row.beforeTarget].includes(paragraphs[index]), `${row.id}: resolver content is current or exact predecessor`);
  if (paragraphs[index] === row.beforeTarget) return value;
  const projected = structuredClone(value);
  const priorParagraphs = projected.content.body.split('\n\n');
  priorParagraphs[index] = row.beforeTarget;
  projected.content.body = priorParagraphs.join('\n\n');
  return projected;
}

export function ensureStudyVegetablesTwoResidualCurrent(): void {
  assert.equal(packet.status, 'PREPARED_UNREVIEWED_MACHINE_DRAFT_ROOT_REVIEW_PENDING');
  assert.equal(packet.canonicalSourceFile.sha256,
    sha(readFileSync(repositoryPath('lib/course-modules.ts'))), 'canonical source file remains exact');
  for (const row of packet.changes) {
    const learnerPath = row.language === 've'
      ? 'lib/course-translation-drafts-ve-vegetables-staples.ts'
      : 'lib/course-translation-drafts-ts-vegetables-staples.ts';
    restoreExactSourceFile(row, learnerPath);
    projectPairedBefore(row.pairedPath, JSON.parse(readFileSync(repositoryPath(row.pairedPath), 'utf8')));
    const lesson = canonicalLesson(row.lessonId);
    assert.equal(lesson.body.split('\n\n')[row.language === 've' ? 14 : 0], row.sourceEnglish,
      `${row.id}: exact source field remains at its expected index`);
  }
  for (const [file, source] of Object.entries(mediaPacket.sourceFiles) as [string, any][]) {
    assert.equal(sha(readFileSync(repositoryPath(file))), source.afterSha256, `${file}: current two-card media-layer source bytes`);
  }
  for (const asset of mediaPacket.assets) {
    const bytes = readFileSync(repositoryPath('public' + asset.url));
    assert.equal(bytes.byteLength, asset.afterBytes, `${asset.url}: current rendered card length`);
    assert.equal(sha(bytes), asset.afterSha256, `${asset.url}: current rendered card digest`);
  }
}

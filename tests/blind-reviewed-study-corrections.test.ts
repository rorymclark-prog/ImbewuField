import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, copyFileSync, cpSync, constants, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { ensureBlindReviewedCorrectionsCurrent, blindReviewedSourceBefore, blindReviewedNativeBefore } from './blind-reviewed-study-corrections-history-checks.ts';
import { COURSE_TRANSLATION_DRAFTS } from '../lib/course-translation-drafts.ts';
import { TSHIVENDA_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-ve-reading-landscape.ts';
import { XITSONGA_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-ts.ts';
import { XITSONGA_SMALL_LIVESTOCK_DRAFT } from '../lib/course-translation-drafts-ts-small-livestock.ts';

const folder = 'docs/study-translation-reviews/blind-reviewed-corrections-2026-10-12/';
const webpFolder = 'docs/study-translation-reviews/slides-webp-2026-10-14/';
const nativeRows = JSON.parse(readFileSync(folder + 'native-before-after.json','utf8'));
const nativeValues: Record<string, any> = { COURSE_TRANSLATION_DRAFTS, TSHIVENDA_READING_LANDSCAPE_DRAFT, XITSONGA_READING_LANDSCAPE_DRAFT, XITSONGA_SMALL_LIVESTOCK_DRAFT };
const pair = (file: string) => JSON.parse(readFileSync(file,'utf8'));

test('blind-reviewed corrections preserve all canonical sources, recorded Sesotho media and every unlisted asset', () => {
  ensureBlindReviewedCorrectionsCurrent();
  for (const row of nativeRows) {
    assert.deepEqual(nativeValues[row.exportName],row.after,row.exportName + ': complete imported successor');
    assert.deepEqual(blindReviewedNativeBefore(nativeValues[row.exportName]),row.before,row.exportName + ': exact complete predecessor');
  }
});
test('the livestock winter distractor stays winter and the birds are moved rather than shaken', () => {
  const q=XITSONGA_SMALL_LIVESTOCK_DRAFT.lessons[0].quiz[0];
  assert.equal(q.sourceCorrectIndex,1,'correct answer and option order are unchanged');
  assert.equal(q.options[3].sourceEnglish,'Only in winter to avoid heat stress');
  assert.equal(q.options[3].xitsongaDraft,'Ntsena hi xixika (winter), leswaku ku papalatiwa heat stress');
  const deck=pair('docs/study-translation-reviews/small-livestock-regional/small-livestock.st.paired-draft.json');
  assert.equal(deck.slides[5].english.body[3],'Move the birds before they damage the ground.');
  assert.equal(deck.slides[5].target.body[3].text,'Suthisa dinonyana pele di senya fatshe.');
});
test('the People Care card says sells, the market heading keeps its actual subject, and the swale illustration slows runoff', () => {
  const intro=pair('docs/narration/intro-permaculture.ts.paired-draft.json');
  assert.match(intro.slides[4].target.body[2].text,/Murimi la xavisaka/);
  assert.doesNotMatch(intro.slides[4].target.body[2].text,/Murimi la xavaka/);
  const market=pair('docs/narration/market-community.ts.paired-draft.json').slides[2];
  assert.equal(market.english.heading,'Learning Outcomes');
  assert.equal(market.target.heading.status,'english-hold');
  assert.equal(market.target.heading.text,undefined,'wrong-subject regional heading is no longer shown');
  assert.match(COURSE_TRANSLATION_DRAFTS['water-harvesting-l1'].infographicAlt!,/ehlisa ijubane/);
  assert.doesNotMatch(COURSE_TRANSLATION_DRAFTS['water-harvesting-l1'].infographicAlt!,/ehla ngejubane/);
});
test('a same-size live source edit after successful validation is caught and failures are not cached', async () => {
  const guard = await isolatedGuard();
  guard.ensureBlindReviewedCorrectionsCurrent();
  const file='lib/course-translation-drafts-ts-small-livestock.ts';
  const path=join(fixture!,file), original=readFileSync(path);
  const bad=Buffer.from(original);const index=bad.indexOf(Buffer.from('xixika'));assert.ok(index>=0);bad[index]=120;bad[index+1]=120;
  try {
    writeFileSync(path,bad);
    assert.throws(()=>guard.ensureBlindReviewedCorrectionsCurrent(),/complete actual live successor/);
    assert.throws(()=>guard.blindReviewedSourceBefore(file,original),/complete actual live successor/,'an intact caller cannot hide changed live bytes');
  } finally { writeFileSync(path,original); }
  guard.ensureBlindReviewedCorrectionsCurrent();
});
test('a same-size unlisted saved still edit after initialization fails the preservation guard', async () => {
  const guard = await isolatedGuard();
  guard.ensureBlindReviewedCorrectionsCurrent();
  const file='public/course-decks/intro-permaculture/st/slide-22.webp';
  const path=join(fixture!,file),original=readFileSync(path),bad=Buffer.from(original);bad[bad.length-1]^=1;
  try { writeFileSync(path,bad);assert.throws(()=>guard.ensureBlindReviewedCorrectionsCurrent(),/unchanged|preserved unlisted media/); }
  finally { writeFileSync(path,original); }
  guard.ensureBlindReviewedCorrectionsCurrent();
});

test('a disk change during a nested historical read is rejected at its boundary and after failure', async () => {
  const guard = await isolatedGuard();
  const file='lib/course-translation-drafts-ts-small-livestock.ts';
  const path=join(fixture!,file),original=readFileSync(path),bad=Buffer.from(original);
  bad[bad.length-2]^=1;
  try {
    assert.throws(() => guard.withBlindReviewedCorrectionReadScope(() => {
      guard.withBlindReviewedCorrectionReadScope(() => guard.blindReviewedSourceBefore(file,original));
      writeFileSync(path,bad);
    }), /complete actual live successor/);
    assert.throws(() => guard.withBlindReviewedCorrectionReadScope(() => original), /complete actual live successor/);
  } finally { writeFileSync(path,original); }
  guard.ensureBlindReviewedCorrectionsCurrent();
});

// The full suite runs files concurrently. Corruption must be confined to a
// cloned fixture so another worker never reads intentionally damaged live media.
let fixture: string | undefined;
let fixtureGuard: any;
async function isolatedGuard() {
  if (fixtureGuard) return fixtureGuard;
  fixture = mkdtempSync(join(tmpdir(),'imbewu-blind-correction-guard-'));
  const proof=JSON.parse(readFileSync(folder+'source-layer-proof.json','utf8'));
  const inventory=JSON.parse(readFileSync(folder+'media-before-inventory.json','utf8'));
  // The guard now sits under the WebP media-format layer: the fixture carries that
  // layer's live files and proof, never the retired JPEGs it no longer ships.
  const webp=JSON.parse(readFileSync(webpFolder+'webp-layer-proof.json','utf8'));
  const retiredJpegs=new Set<string>(webp.retired.map((r: any)=>r.path));
  const files=new Set<string>([...inventory.map((r: any)=>r.path),...Object.keys(proof.files),...Object.keys(proof.protected),'tests/blind-reviewed-study-corrections-history-checks.ts',
    'tests/slides-webp-history-checks.ts',...webp.retired.map((r: any)=>r.successor.path),...webp.added.map((r: any)=>r.path),...Object.keys(webp.files),
    // The wave 13 theme layer sits on the WebP layer and is imported by it, so the fixture carries it and its predecessor fixture too.
    'tests/wave-13-theme-history-checks.ts','tests/fixtures/student-page-before-wave-13.tsx.txt',
    // The wave 14 study layer sits on the wave 13 theme layer the same way.
    'tests/wave-14-study-history-checks.ts','tests/fixtures/student-page-before-wave-14.tsx.txt',
    // The wave 16 layer sits on the wave 14 one the same way.
    'tests/wave-16-history-checks.ts','tests/fixtures/student-page-before-wave-16.tsx.txt',
    // The wave 17 layer sits on the wave 16 one the same way.
    'tests/wave-17-history-checks.ts','tests/fixtures/student-page-before-wave-17.tsx.txt',
    // The wave 25 offline layer is imported by the WebP layer for app/sw.js/route.ts, so the fixture carries it and its predecessor.
    'tests/wave-25-offline-history-checks.ts','tests/fixtures/sw-route-before-w25-offline.ts.txt']);
  for (const file of files) { if (retiredJpegs.has(file)) continue;const destination=join(fixture,file);mkdirSync(dirname(destination),{recursive:true});copyFileSync(file,destination,constants.COPYFILE_FICLONE); }
  cpSync(folder,join(fixture,folder),{recursive:true});
  cpSync(webpFolder,join(fixture,webpFolder),{recursive:true});
  // Retired JPEG bytes are read from the predecessor commit's immutable git objects.
  writeFileSync(join(fixture,'.git'),`gitdir: ${execFileSync('git',['rev-parse','--absolute-git-dir']).toString().trim()}\n`);
  fixtureGuard=await import(pathToFileURL(join(fixture,'tests/blind-reviewed-study-corrections-history-checks.ts')).href);
  return fixtureGuard;
}
after(()=>{ if (fixture) rmSync(fixture,{recursive:true,force:true}); });

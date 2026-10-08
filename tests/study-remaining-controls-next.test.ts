import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ve from '../lib/locales/ve.ts';
import { SESOTHO_READING_LANDSCAPE_DRAFT as st } from '../lib/course-translation-drafts-st-reading-landscape.ts';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import {
  assertStudyRemainingControlsLocale,
  assertStudyRemainingControlsNative,
  ensureStudyRemainingControlsCurrent,
  studyRemainingControlsNativeBefore,
} from './study-remaining-controls-next-history-checks.ts';

const folder = 'docs/study-translation-reviews/study-remaining-controls-next-2026-10-08/';
const packet = JSON.parse(readFileSync(folder + 'applied-packet.json', 'utf8'));
const root = JSON.parse(readFileSync(folder + packet.rootReviewedPacket.path, 'utf8'));
const beforeSt = JSON.parse(readFileSync(folder + packet.sesotho.beforeSnapshot, 'utf8'));

test('Tshivenda Study controls preserve reviewed sources, placeholders, status and global staff scope', () => {
  ensureStudyRemainingControlsCurrent();
  assertStudyRemainingControlsLocale(ve);
  assert.deepEqual(packet.locale.addedKeys, [
    'studentReadinessCompleteDetail',
    'studentReadinessNarratedDetail',
    'studentReadinessLessonsDetail',
    'studentReadinessNarrated',
    'courseDeckAnimationFailed',
    'offlineGetWhileSignal',
  ]);
  assert.equal(root.acceptedRows.length, 6);
  for (const row of root.acceptedRows) {
    assert.equal(ve[row.key], row.target, `${row.key}: exact source-bound reviewed value`);
    const placeholders = (value: string) => [...value.matchAll(/\{[^}]+\}/g)].map(match => match[0]).sort();
    assert.deepEqual(placeholders(row.target), placeholders(row.sourceEnglish), `${row.key}: placeholder set stays exact`);
  }

  assert.match(ve.studentReadinessCompleteDetail, /\{lessons\}.*\{languages\}/, 'global completed detail keeps both counts');
  assert.match(ve.studentReadinessNarratedDetail, /dzo lugela.*\{languages\}.*hu kha ḓi sala/, 'narration ready status remains distinct from outstanding translation review');
  assert.match(ve.studentReadinessLessonsDetail, /zwo lugela.*zwi kha ḓi itwa/, 'ready reading remains distinct from narration and slides still being made');
  assert.equal(Object.hasOwn(ve, 'studentReadinessComplete'), false, 'ambiguous “Fully built” candidate stays exact English');
  assert.equal(Object.hasOwn(ve, 'offlineDownloadPack'), false, 'Download · {size} remains an exact technical/action hold');

  const studentPage = readFileSync('app/student/page.tsx', 'utf8');
  assert.ok(studentPage.includes('moduleReadinessDetail(mod.id)'), 'readiness detail remains global to the module');
  assert.ok(studentPage.includes('readinessFacts.narrationLanguages.length'), 'language number comes from global readiness facts');
  assert.ok(studentPage.includes('{!simple && isStaff && ('), 'production badge remains staff-only');
  for (const row of root.acceptedRows.filter((item: any) => item.key.startsWith('studentReadiness'))) {
    assert.ok(studentPage.includes(`t('${row.key}')`), `${row.key}: caller remains bound to its existing readiness state`);
  }
  assert.doesNotMatch(ve.studentReadinessCompleteDetail + ve.studentReadinessNarratedDetail, /Tshivenda|Tshivenḓa/i, 'global readiness copy does not promise narration in the selected Tshivenda language');

  assert.match(ve.courseDeckAnimationFailed, /thetshelesa.*vhala slide.*Watch.*lingedze hafhu/, 'animation failure keeps all three source choices');
  assert.doesNotMatch(ve.courseDeckAnimationFailed, /arali|if narration/i, 'the source does not condition listening on currently playing narration');
  const deckPlayer = readFileSync('components/course/DeckPlayer.tsx', 'utf8');
  assert.ok(deckPlayer.includes('{animationFailed && (') && deckPlayer.includes("t('courseDeckAnimationFailed')"), 'message remains attached to animation failure');

  assert.match(ve.offlineGetWhileSignal, /slides.*ṱhalutshedzo nga ipfi.*clips.*kha founu iyi.*signal/, 'offline instruction retains the exact source media list and while-signal timing');
  assert.match(ve.offlineGetWhileSignal, /Nga murahu.*airtime/, 'saved files are said to work without airtime afterward');
  assert.doesNotMatch(ve.offlineGetWhileSignal, /dzine dza vha hone|available/i, 'no unsupported availability qualifier is added');
  const offline = readFileSync('components/course/OfflineDownload.tsx', 'utf8');
  assert.ok(offline.includes("regionalSlidePack && variant === 'slides' ? t('offlineGetSlidesWhileSignal') : t('offlineGetWhileSignal')"), 'full pack wording remains separate from the regional slides-only instruction');

  const unauthorizedLocale = { ...ve, studentContinue: ve.studentContinue + ' Unlisted.' };
  assert.throws(() => assertStudyRemainingControlsLocale(unauthorizedLocale), /unlisted or altered locale value/, 'whole-dictionary guard rejects unlisted changes');
});

test('Sesotho Reading A-frame observation changes only its held learner fragment before historical snapshots', () => {
  ensureStudyRemainingControlsCurrent();
  const changed = st.lessons.find(lesson => lesson.id === packet.sesotho.lessonId)!;
  const canonical = COURSE_MODULES.find(module => module.id === 'reading-landscape')!.lessons.find(lesson => lesson.id === packet.sesotho.lessonId)!;
  const beforeLesson = beforeSt.lessons.find((lesson: any) => lesson.id === packet.sesotho.lessonId)!;
  const paragraphs = changed.body.sesothoDraft.split('\n\n');
  const beforeParagraphs = beforeLesson.body.sesothoDraft.split('\n\n');

  assert.equal(changed.body.sourceEnglish, canonical.body);
  assert.equal(canonical.body.split('\n\n')[packet.sesotho.paragraphIndex], packet.sesotho.sourceEnglishParagraph);
  assert.equal(changed.body.reviewStatus, 'machine-draft');
  assert.equal(paragraphs.length, 3);
  assert.equal(beforeParagraphs.length, paragraphs.length);
  assert.equal(paragraphs[packet.sesotho.paragraphIndex], packet.sesotho.afterParagraph);
  assert.equal(paragraphs[packet.sesotho.paragraphIndex].split(packet.sesotho.heldSourceFragment).length, 2, 'the exact technical English observation is visible once');
  assert.ok(paragraphs[packet.sesotho.paragraphIndex].includes('eseng moralo kapa tumello ya ho tjheka mobu (earthworks)'), 'the marks remain neither an earthworks design nor permission');
  assert.ok(paragraphs[packet.sesotho.paragraphIndex].includes('Pele o tjheka mokero (swale), letamo, kapa sebopeho se seng, etsa hore sebaka se hlahlojwe.'), 'site assessment still comes before digging each named or other structure');
  for (const condition of ['Mofuta wa mobu, letswapo, tsamaiso ya metsi, phallo ya sefefo', 'tsela e sireletsehileng ya ho phalla ha metsi a tletse (overflow route)', 'Botsa moeletsi wa lehae ya kwetlisitsweng (trained local adviser).']) {
    assert.ok(paragraphs[packet.sesotho.paragraphIndex].includes(condition), `safety and adviser clause remains exact: ${condition}`);
  }
  assert.equal(paragraphs[0], beforeParagraphs[0], 'safe rain-observation paragraph remains exact');
  assert.equal(paragraphs[2], beforeParagraphs[2], 'site-specific waterworks paragraph remains exact');
  assert.deepEqual(changed.keyPoints, beforeLesson.keyPoints, 'all key points stay exact');
  assert.deepEqual(changed.quiz, beforeLesson.quiz, 'all assessment text and answer indexes stay exact');

  const presentation = resolveLearnerLessonPresentation(canonical, 'st');
  assert.equal(presentation.status, 'draft');
  assert.equal(presentation.content.body, changed.body.sesothoDraft);
  const alteredSourceBody = canonical.body.replace(packet.sesotho.sourceEnglishParagraph, packet.sesotho.sourceEnglishParagraph + ' Source changed.');
  assert.notEqual(alteredSourceBody, canonical.body);
  const fallback = resolveLearnerLessonPresentation({ ...canonical, body: alteredSourceBody }, 'st');
  assert.equal(fallback.status, 'english-fallback', 'changed source withdraws the stale Sesotho learner draft');
  assert.equal(fallback.content.body, alteredSourceBody, 'source-drift fallback displays the exact changed English body');

  const historical = studyRemainingControlsNativeBefore(st);
  assert.deepEqual(historical, beforeSt, 'historical full-object claims receive only the exact verified predecessor');
  const unauthorized = structuredClone(st);
  unauthorized.lessons.find((lesson: any) => lesson.id === packet.sesotho.lessonId)!.keyPoints[0].sesothoDraft += ' Unlisted.';
  assert.throws(() => assertStudyRemainingControlsNative(unauthorized), /complete current ST Reading object equals/, 'complete source-bound guard rejects unrelated learner text mutation');
  const changedStatus = structuredClone(st);
  changedStatus.lessons.find((lesson: any) => lesson.id === packet.sesotho.lessonId)!.body.reviewStatus = 'hold';
  assert.throws(() => assertStudyRemainingControlsNative(changedStatus), /complete current ST Reading object equals/, 'complete source-bound guard rejects unauthorized review-status mutation');
});

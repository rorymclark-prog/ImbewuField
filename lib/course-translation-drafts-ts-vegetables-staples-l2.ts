/** Unreviewed source-paired Xitsonga concept sentences for Vegetables & Staple Crops L2. */
import { COURSE_MODULES } from './course-modules.ts';
import type { XitsongaCourseModuleDraft, XitsongaSourcePair } from './course-translation-drafts-ts.ts';

const pair = (sourceEnglish: string, xitsongaDraft: string, reviewStatus: XitsongaSourcePair['reviewStatus'] = 'machine-draft'): XitsongaSourcePair => ({
  sourceEnglish,
  xitsongaDraft,
  reviewStatus,
});
const hold = (sourceEnglish: string): XitsongaSourcePair => pair(sourceEnglish, sourceEnglish, 'hold');

const sourceModule = COURSE_MODULES.find(module => module.id === 'vegetables-staples')!;
const sourceLesson = sourceModule.lessons.find(lesson => lesson.id === 'vegetables-staples-l2')!;
const sourceParagraphs = sourceLesson.body.split('\n\n');
const draftParagraphs = [...sourceParagraphs];
draftParagraphs[0] = 'Ku byala swibyariwa hi ku landzelelana i ntolovelo wa khalendara, a hi xibyariwa xo hlawuleka.';
draftParagraphs[3] = 'Ku lahleka ka swakudya ka hunguteka loko ku ri na ntshovelo wo tala. Ku va na swakudya swo tenga nkarhi wo leha. Ntirho wu hangalaka hi nkarhi wa nguva, ematshan\'weni yo ku wu humelela hinkwawo hi nkarhi wun\'we.';


export const XITSONGA_VEGETABLES_STAPLES_L2_DRAFT: XitsongaCourseModuleDraft = {
  id: sourceModule.id,
  language: 'ts',
  reviewStatus: 'machine-draft',
  sourceMetadata: { durationMins: sourceModule.durationMins, category: sourceModule.category },
  title: hold(sourceModule.title),
  description: hold(sourceModule.description),
  lessons: [
    {
      id: sourceLesson.id,
      infographicAlt: hold(sourceLesson.infographicAlt!),
      title: hold(sourceLesson.title),
      body: pair(sourceLesson.body, draftParagraphs.join('\n\n')),
      keyPoints: sourceLesson.keyPoints.map(hold),
      quiz: sourceLesson.quiz.map(question => ({
        question: hold(question.q),
        options: question.options.map(hold),
        sourceCorrectIndex: question.correct,
        rationale: hold(question.rationale),
      })),
    },
  ],
  holds: sourceParagraphs.flatMap((sourceText, index) => [0, 3].includes(index) ? [] : [{
    lessonId: sourceLesson.id,
    field: `body[${index}]`,
    sourceText,
    reason: index === 2
      ? 'Keep the numeric two-to-three-week schedule exact English.'
      : index === 4
        ? 'Keep separate sowings and their risk/harvest uncertainty exact English until fluent review confirms the timing nuance.'
        : index >= 11
          ? 'Keep intercropping, Indigenous Three Sisters context, crop-specific species and timing, nitrogen/residue claims, and household crop-planning advice exact English.'
          : 'Keep household sowing instructions, practice sequences, timing, and harvest uncertainty exact English.',
  }]),
};

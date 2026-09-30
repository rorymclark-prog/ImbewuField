/** Unreviewed source-paired Xitsonga concept block for Vegetables & Staple Crops L3. */
import { COURSE_MODULES } from './course-modules.ts';
import type { XitsongaCourseModuleDraft, XitsongaSourcePair } from './course-translation-drafts-ts.ts';

const pair = (sourceEnglish: string, xitsongaDraft: string, reviewStatus: XitsongaSourcePair['reviewStatus'] = 'machine-draft'): XitsongaSourcePair => ({
  sourceEnglish,
  xitsongaDraft,
  reviewStatus,
});
const hold = (sourceEnglish: string): XitsongaSourcePair => pair(sourceEnglish, sourceEnglish, 'hold');

const sourceModule = COURSE_MODULES.find(module => module.id === 'vegetables-staples')!;
const sourceLesson = sourceModule.lessons.find(lesson => lesson.id === 'vegetables-staples-l3')!;
const sourceParagraphs = sourceLesson.body.split('\n\n');
const draftParagraphs = [...sourceParagraphs];
draftParagraphs[10] = 'Xiya leswaku swibyariwa leswi swi tsandzeka eka swiyimo swo hambana. Hi yona mhaka ya kona.';
draftParagraphs[11] = 'Resilience a swi vuli leswaku a ku na lexi tsandzekaka.';
draftParagraphs[12] = 'Swi vula leswaku ku tsandzeka kun\'we a ku herisi kungu ra swakudya ra ndyangu wa wena.';
draftParagraphs[13] = 'Xibyariwa xin\'we i "point of failure" yin\'we.';
// Keep the whole quantity-and-staples claim in English until its scope is reviewed.
draftParagraphs[14] = sourceParagraphs[14];
draftParagraphs[15] = 'Swibyariwa swo hambana swi tirhisa mati, misava na tinguva hi tindlela to hambana. Ku hambana loku hi kona ku va nsirhelelo.';

export const XITSONGA_VEGETABLES_STAPLES_DRAFT: XitsongaCourseModuleDraft = {
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
  holds: [
    ...sourceParagraphs.slice(0, 10).map((sourceText, index) => ({
      lessonId: sourceLesson.id,
      field: `body[${index}]`,
      sourceText,
      reason: 'Keep all staple recommendations and species-specific food, seed, storage, water, and growing-condition claims exact English.'
    })),
    { lessonId: sourceLesson.id, field: 'body[14]', sourceText: sourceParagraphs[14], reason: 'Keep the full “two or more staples” scope exact English until a fluent reviewer confirms wording that cannot narrow the claim.' },
    { lessonId: sourceLesson.id, field: 'infographicAlt', sourceText: sourceLesson.infographicAlt!, reason: 'The illustration names staple crop forms; retain exact English.' },
    { lessonId: sourceLesson.id, field: 'quiz', sourceText: sourceLesson.quiz.map(item => `${item.q}\n${item.rationale}`).join('\n\n'), reason: 'Keep crop-specific resilience, seed-saving, and wet-ground claims exact English in quiz content.' },
  ],
};

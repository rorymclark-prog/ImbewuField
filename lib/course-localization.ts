import type { Lesson, QuizQuestion } from './course-modules';
import { COURSE_TRANSLATION_DRAFTS } from './course-translation-drafts.ts';

export type CourseLanguage = 'en' | 'zu';
export type CourseTranslationStatus =
  | 'unavailable'
  | 'review-draft'
  | 'source-held'
  | 'published-audio-only'
  | 'published';

export interface LocalizedQuizQuestion extends Omit<QuizQuestion, 'options'> {
  options: string[];
}

/** The learner-facing lesson fields must travel together so a quiz cannot silently stay English. */
export interface LocalizedLessonContent {
  title: string;
  body: string;
  keyPoints: string[];
  quiz: LocalizedQuizQuestion[];
}

export interface HumanReviewApproval {
  reviewer: string;
  role: 'fluent-isiZulu' | 'local-farming';
  reviewedAt: string;
  accepted: true;
}

export interface CourseTranslationRecord {
  lessonId: string;
  language: 'zu';
  status: CourseTranslationStatus;
  /** Path to a comparison packet/handoff; the packet itself stays outside the learner UI. */
  reviewDocument?: string;
  /** Proposed copy may be shown only through the owner-authorized, visibly labelled draft path. */
  draft?: LocalizedLessonContent;
  /** Only a published record with both named human approvals can be returned to learners. */
  published?: LocalizedLessonContent;
  approvals?: HumanReviewApproval[];
}

type ReviewState = Pick<CourseTranslationRecord, 'status' | 'reviewDocument'>;

const REVIEW_STATE_BY_LESSON: Record<string, ReviewState> = {
  'intro-permaculture-l1': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/INTRODUCTION-ISIZULU-FULL-DRAFT-HANDOFF.md' },
  'intro-permaculture-l2': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/INTRODUCTION-ISIZULU-FULL-DRAFT-HANDOFF.md' },
  'intro-permaculture-l3': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/INTRODUCTION-ISIZULU-FULL-DRAFT-HANDOFF.md' },
  'reading-landscape-l1': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/READING-LANDSCAPE-ISIZULU-FULL-DRAFT-HANDOFF.md' },
  'reading-landscape-l2': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/READING-LANDSCAPE-ISIZULU-FULL-DRAFT-HANDOFF.md' },
  'reading-landscape-l3': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/READING-LANDSCAPE-ISIZULU-FULL-DRAFT-HANDOFF.md' },
  'reading-landscape-l4': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/READING-LANDSCAPE-ISIZULU-FULL-DRAFT-HANDOFF.md' },
  'water-harvesting-l1': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/WATER-HARVESTING-ISIZULU-FULL-DRAFT-HANDOFF.md' },
  'water-harvesting-l2': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/WATER-HARVESTING-ISIZULU-FULL-DRAFT-HANDOFF.md' },
  'water-harvesting-l3': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/WATER-HARVESTING-ISIZULU-FULL-DRAFT-HANDOFF.md' },
  'water-harvesting-l4': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/water-harvesting-l4.zu.full-draft.md' },
  'soil-health-l1': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/SOIL-HEALTH-ISIZULU-FULL-DRAFT-HANDOFF.md' },
  'soil-health-l2': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/SOIL-HEALTH-ISIZULU-FULL-DRAFT-HANDOFF.md' },
  'soil-health-l3': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/soil-health-l3.zu.review.md' },
  'vegetables-staples-l1': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/VEGETABLES-ISIZULU-FULL-DRAFT-HANDOFF.md' },
  'vegetables-staples-l2': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/VEGETABLES-ISIZULU-FULL-DRAFT-HANDOFF.md' },
  'vegetables-staples-l3': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/VEGETABLES-ISIZULU-FULL-DRAFT-HANDOFF.md' },
  'vegetables-staples-l4': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/VEGETABLES-ISIZULU-FULL-DRAFT-HANDOFF.md' },
  'food-forest-l1': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/FOOD-FOREST-ISIZULU-FULL-DRAFT-HANDOFF.md' },
  'food-forest-l2': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/FOOD-FOREST-ISIZULU-FULL-DRAFT-HANDOFF.md' },
  'food-forest-l3': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/FOOD-FOREST-ISIZULU-FULL-DRAFT-HANDOFF.md' },
  'small-livestock-l1': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/SMALL-LIVESTOCK-ISIZULU-FULL-DRAFT-HANDOFF.md' },
  'small-livestock-l2': { status: 'source-held', reviewDocument: 'docs/narration-reviews/small-livestock-l2.zu.review.md' },
  'small-livestock-l3': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/SMALL-LIVESTOCK-ISIZULU-FULL-DRAFT-HANDOFF.md' },
  'market-community-l1': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/MARKET-COMMUNITY-ISIZULU-FULL-DRAFT-HANDOFF.md' },
  'market-community-l2': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/MARKET-COMMUNITY-ISIZULU-FULL-DRAFT-HANDOFF.md' },
  'market-community-l3': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/MARKET-COMMUNITY-ISIZULU-FULL-DRAFT-HANDOFF.md' },
  // Existing narration does not approve lesson text; this packet still needs fluent and local-farming review.
  'seeds-sovereignty-l1': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/seeds-sovereignty-l1.zu.full-draft.md' },
  'seeds-sovereignty-l2': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/seeds-sovereignty-l2.zu.full-draft.md' },
  'seeds-sovereignty-l3': { status: 'review-draft', reviewDocument: 'docs/narration-reviews/seeds-sovereignty-l3.zu.full-draft.md' },
  'plant-guilds-l1': { status: 'published-audio-only' },
  'plant-guilds-l2': { status: 'published-audio-only' },
  'plant-guilds-l3': { status: 'published-audio-only' },
};

const REQUIRED_REVIEW_ROLES: HumanReviewApproval['role'][] = ['fluent-isiZulu', 'local-farming'];

function hasReleaseApprovals(record: CourseTranslationRecord): boolean {
  if (record.status !== 'published' || !record.published || !record.approvals) return false;
  return REQUIRED_REVIEW_ROLES.every(role => record.approvals?.some(approval =>
    approval.role === role && approval.accepted === true && approval.reviewer.trim().length > 0 &&
    !Number.isNaN(Date.parse(approval.reviewedAt)),
  ));
}

function hasCompleteLessonShape(source: Lesson, translated: LocalizedLessonContent): boolean {
  const present = (value: string) => typeof value === 'string' && value.trim().length > 0;
  return present(translated.title) && present(translated.body) &&
    Array.isArray(translated.keyPoints) &&
    translated.keyPoints.length === source.keyPoints.length && translated.keyPoints.every(present) &&
    Array.isArray(translated.quiz) &&
    translated.quiz.length === source.quiz.length && translated.quiz.every((question, index) => {
      const original = source.quiz[index];
      return question && present(question.q) && present(question.rationale) &&
        Array.isArray(question.options) && question.options.length === original.options.length &&
        question.options.every(present) &&
        question.correct === original.correct;
    });
}

/** Returns only learner-approved translation records; review drafts are available via the separate metadata API. */
export function learnerLessonForLanguage(
  lesson: Lesson,
  language: CourseLanguage,
  translation?: CourseTranslationRecord,
): LocalizedLessonContent {
  if (language === 'zu' && translation?.lessonId === lesson.id && hasReleaseApprovals(translation) &&
    hasCompleteLessonShape(lesson, translation.published!)) {
    return translation.published!;
  }

  return {
    title: lesson.title,
    body: lesson.body,
    keyPoints: lesson.keyPoints,
    quiz: lesson.quiz,
  };
}

export interface LearnerLessonPresentation {
  content: LocalizedLessonContent;
  status: 'approved' | 'draft' | 'english-fallback';
}

/** Rory authorised clearly labelled review drafts in the learner view on 24 September.
 * This path never upgrades a draft to an approved translation, and keeps lessons
 * with unresolved farming claims in English until their sources are checked. */
export function resolveLearnerLessonPresentation(
  lesson: Lesson,
  language: string,
  translation?: CourseTranslationRecord,
): LearnerLessonPresentation {
  const source: LocalizedLessonContent = {
    title: lesson.title,
    body: lesson.body,
    keyPoints: lesson.keyPoints,
    quiz: lesson.quiz,
  };
  if (language !== 'zu') return { content: source, status: 'approved' };

  if (REVIEW_STATE_BY_LESSON[lesson.id]?.status === 'source-held') {
    return { content: source, status: 'english-fallback' };
  }

  if (translation?.lessonId === lesson.id && hasReleaseApprovals(translation) &&
    hasCompleteLessonShape(lesson, translation.published!)) {
    return { content: translation.published!, status: 'approved' };
  }

  if (REVIEW_STATE_BY_LESSON[lesson.id]?.status === 'review-draft') {
    const draft = translation?.lessonId === lesson.id && translation.status === 'review-draft'
      ? translation.draft
      : COURSE_TRANSLATION_DRAFTS[lesson.id];
    if (draft && hasCompleteLessonShape(lesson, draft)) {
      return { content: draft, status: 'draft' };
    }
  }
  return { content: source, status: 'english-fallback' };
}

/** Review tools may show where a packet lives and why it is held, without exposing its proposed text to learners. */
export function courseTranslationReviewState(lessonId: string): Readonly<ReviewState> {
  return REVIEW_STATE_BY_LESSON[lessonId] ?? { status: 'unavailable' };
}

/** Explicit publication check for future app wiring and release tooling. */
export function isCourseTranslationLearnerReady(lesson: Lesson, record: CourseTranslationRecord | undefined): boolean {
  return record !== undefined && record.lessonId === lesson.id && hasReleaseApprovals(record) &&
    hasCompleteLessonShape(lesson, record.published!);
}

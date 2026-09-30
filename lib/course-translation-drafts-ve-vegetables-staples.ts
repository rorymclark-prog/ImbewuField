import type { TshivendaCourseModuleDraft, TshivendaSourcePair } from './course-translation-drafts-ve.ts';
import { COURSE_MODULES } from './course-modules.ts';

/** Source-paired review records for unreviewed conceptual passages in Vegetables L3. */
export const TSHIVENDA_VEGETABLES_STAPLES_L3_REVIEW_DRAFT = {
  moduleId: 'vegetables-staples',
  lessonId: 'vegetables-staples-l3',
  language: 've',
  reviewStatus: 'machine-draft',
  bodyConcept: {
    paragraphIndex: 0,
    sourceEnglish: 'A staple earns its place because it feeds the household beyond the day of harvest.',
    tshivendaDraft: 'Tshiḽiwa tsha vhuthogwa [staple] tshi wana vhuimo hatsho ngauri tshi ṋea muṱa zwiḽiwa u fhirisa ḓuvha ḽa khaṋo.',
    reviewStatus: 'machine-draft',
  },
  secondBodyConcept: {
    paragraphIndex: 12,
    sourceEnglish: "It means one failure doesn't finish your household's food plan.",
    tshivendaDraft: 'Zwi amba uri u kundwa huṅwe huthihi a hu fhedzi pulane ya zwiḽiwa ya muṱa waṋu.',
    reviewStatus: 'machine-draft',
  },
  additionalBodyConcepts: [
    {
      paragraphIndex: 1,
      sourceEnglish: 'It carries energy or protein.',
      tshivendaDraft: 'Tshiḽiwa tsha vhuthogwa tshi fara energy kana protein.',
      reviewStatus: 'machine-draft',
    },
    {
      paragraphIndex: 1,
      sourceEnglish: 'It stores, or it stays in the ground until you need it.',
      tshivendaDraft: 'Tshi a vhulungea kana tshi sala tshi mavuni u swika ni tshi tshi ṱoḓa.',
      reviewStatus: 'machine-draft',
    },
    {
      paragraphIndex: 1,
      sourceEnglish: 'And often it carries cultural memory too.',
      tshivendaDraft: 'Nahone kanzhi tshi na cultural memory.',
      reviewStatus: 'machine-draft',
    },
    {
      paragraphIndex: 2,
      sourceEnglish: 'One staple leaves you vulnerable.',
      tshivendaDraft: 'Tshiḽiwa tshithihi tsha vhuthogwa tshi ni sia ni vulnerable.',
      reviewStatus: 'machine-draft',
    },
    {
      paragraphIndex: 11,
      sourceEnglish: "Resilience doesn't mean nothing fails.",
      tshivendaDraft: 'Resilience a zwi ambi uri a hu na zwine zwa kundwa.',
      reviewStatus: 'machine-draft',
    },
    {
      paragraphIndex: 13,
      sourceEnglish: 'One crop is one point of failure.',
      tshivendaDraft: 'Tshibyariwa tshithihi ndi point nthihi ya failure.',
      reviewStatus: 'machine-draft',
    },
  ],
  exactEnglishHoldPaths: [
    'module title and description',
    'lesson title',
    'infographicAlt',
    'body paragraph 3 sentence 2, paragraphs 4–10 and 15–16',
    'keyPoints',
    'quiz questions, options, and rationales',
  ],
} as const;

const pair = (sourceEnglish: string, tshivendaDraft: string): TshivendaSourcePair => ({ sourceEnglish, tshivendaDraft, reviewStatus: 'machine-draft' });
const hold = (sourceEnglish: string): TshivendaSourcePair => ({ sourceEnglish, tshivendaDraft: sourceEnglish, reviewStatus: 'hold' });
const sourceModule = COURSE_MODULES.find(module => module.id === TSHIVENDA_VEGETABLES_STAPLES_L3_REVIEW_DRAFT.moduleId)!;
const sourceLesson = sourceModule.lessons.find(lesson => lesson.id === TSHIVENDA_VEGETABLES_STAPLES_L3_REVIEW_DRAFT.lessonId)!;
const sourceParagraphs = sourceLesson.body.split('\n\n');
const draftParagraphs = sourceParagraphs.map((paragraph, index) =>
  index === TSHIVENDA_VEGETABLES_STAPLES_L3_REVIEW_DRAFT.bodyConcept.paragraphIndex
    ? TSHIVENDA_VEGETABLES_STAPLES_L3_REVIEW_DRAFT.bodyConcept.tshivendaDraft
    : index === TSHIVENDA_VEGETABLES_STAPLES_L3_REVIEW_DRAFT.secondBodyConcept.paragraphIndex
      ? TSHIVENDA_VEGETABLES_STAPLES_L3_REVIEW_DRAFT.secondBodyConcept.tshivendaDraft
      : paragraph,
);
for (const concept of TSHIVENDA_VEGETABLES_STAPLES_L3_REVIEW_DRAFT.additionalBodyConcepts) {
  draftParagraphs[concept.paragraphIndex] = draftParagraphs[concept.paragraphIndex].replace(concept.sourceEnglish, concept.tshivendaDraft);
}

export const TSHIVENDA_VEGETABLES_STAPLES_L3_DRAFT: TshivendaCourseModuleDraft = {
  id: "vegetables-staples", language: 've', reviewStatus: 'machine-draft',
  sourceMetadata: { durationMins: 30, category: "plants" },
  title: hold("Vegetables and Staple Crops"),
  description: hold("Bed prep, succession planting, staple crops and pest management — the daily work of growing food."),
  lessons: [{
    id: "vegetables-staples-l3",
    infographicAlt: hold("Three staple crops together: a tall grain stalk, a climbing vine on a pole, and a root crop shown half below the ground."),
    title: hold("Staple Crops: Maize, Beans, and Root Vegetables"),
    body: pair(
      sourceLesson.body,
      draftParagraphs.join('\n\n'),
    ),
    keyPoints: [
      hold("Open-pollinated maize lets you save seed; hybrid seed won't breed true next season"),
      hold("Beans are the key protein crop — productive, storable, and nitrogen-fixing"),
      hold("Sweet potato develops some drought tolerance after storage roots form, but needs water early; young leaves are edible"),
      hold("Amadumbe (taro) is an underused traditional staple suited to wetter KZN and coastal ground"),
    ],
    quiz: [
      {
        question: hold("Why choose open-pollinated maize over a hybrid variety if you plan to save your own seed?"),
        options: [hold("Open-pollinated varieties yield more"), hold("Hybrid seed won't breed true — the next generation won't match the parent plant"), hold("Open-pollinated maize is always more drought-tolerant"), hold("Hybrids can't be planted in South Africa")],
        sourceCorrectIndex: 1,
        rationale: hold("Seed saved from an F1 hybrid may grow, but the next generation can vary. A stable open-pollinated variety with managed pollination is more predictable when saving seed."),
      },
      {
        question: hold("Why is amadumbe (taro) a good staple choice for parts of KZN?"),
        options: [hold("It thrives on very dry, sandy soil"), hold("It tolerates wetter ground than maize, suiting coastal and high-rainfall conditions"), hold("It requires no cultivation at all"), hold("It's the only staple that stores for multiple years")],
        sourceCorrectIndex: 1,
        rationale: hold("Amadumbe actually prefers damper ground where maize would struggle — it fills a niche other staples can't handle well."),
      },
    ],
  }],
};

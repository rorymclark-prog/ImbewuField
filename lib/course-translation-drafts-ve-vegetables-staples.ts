import type { TshivendaCourseModuleDraft, TshivendaSourcePair } from './course-translation-drafts-ve.ts';

/** Source-paired review records for the two unreviewed conceptual passages in Vegetables L3. */
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
  exactEnglishHoldPaths: [
    'module title and description',
    'lesson title',
    'infographicAlt',
    'body paragraphs 2–12 and 14–16',
    'keyPoints',
    'quiz questions, options, and rationales',
  ],
} as const;

const pair = (sourceEnglish: string, tshivendaDraft: string): TshivendaSourcePair => ({ sourceEnglish, tshivendaDraft, reviewStatus: 'machine-draft' });
const hold = (sourceEnglish: string): TshivendaSourcePair => ({ sourceEnglish, tshivendaDraft: sourceEnglish, reviewStatus: 'hold' });

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
      "A staple earns its place because it feeds the household beyond the day of harvest.\n\nIt carries energy or protein. It stores, or it stays in the ground until you need it. And often it carries cultural memory too.\n\nOne staple leaves you vulnerable. Two or more give you options when weather or pests hit.\n\nGrow at least two. Not one.\n\nWhich staple does your household rely on most heavily right now? That's the one whose failure would hurt most — so that's the one that needs a companion.\n\nEach staple protects you against something different.\n\nMaize gives calories, and stores dry. Open-pollinated maize also lets you save your own seed, if you manage isolation and selection.\n\nBeans and cowpeas give a storable protein harvest.\n\nSweet potato develops some drought tolerance after its storage roots form. It needs water in the first weeks and while roots are forming; water stress then can reduce the harvest. Its young leaves are edible too.\n\nAmadumbe handles wetter ground, where other staples struggle.\n\nNotice that they fail in different conditions. That's the whole point.\n\nResilience doesn't mean nothing fails.\n\nIt means one failure doesn't finish your household's food plan.\n\nOne crop is one point of failure.\n\nTwo or more staples give you more ways to keep eating.\n\nDifferent crops use water, soil and seasons differently. That difference is the protection.",
      "Tshiḽiwa tsha vhuthogwa [staple] tshi wana vhuimo hatsho ngauri tshi ṋea muṱa zwiḽiwa u fhirisa ḓuvha ḽa khaṋo.\n\nIt carries energy or protein. It stores, or it stays in the ground until you need it. And often it carries cultural memory too.\n\nOne staple leaves you vulnerable. Two or more give you options when weather or pests hit.\n\nGrow at least two. Not one.\n\nWhich staple does your household rely on most heavily right now? That's the one whose failure would hurt most — so that's the one that needs a companion.\n\nEach staple protects you against something different.\n\nMaize gives calories, and stores dry. Open-pollinated maize also lets you save your own seed, if you manage isolation and selection.\n\nBeans and cowpeas give a storable protein harvest.\n\nSweet potato develops some drought tolerance after its storage roots form. It needs water in the first weeks and while roots are forming; water stress then can reduce the harvest. Its young leaves are edible too.\n\nAmadumbe handles wetter ground, where other staples struggle.\n\nNotice that they fail in different conditions. That's the whole point.\n\nResilience doesn't mean nothing fails.\n\nZwi amba uri u kundwa huṅwe huthihi a hu fhedzi pulane ya zwiḽiwa ya muṱa waṋu.\n\nOne crop is one point of failure.\n\nTwo or more staples give you more ways to keep eating.\n\nDifferent crops use water, soil and seasons differently. That difference is the protection.",
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

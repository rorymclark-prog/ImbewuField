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
      paragraphIndex: 2,
      sourceEnglish: 'Two or more give you options when weather or pests hit.',
      tshivendaDraft: 'Zwiḽiwa zwa vhuthogwa zwivhili kana zwo engaho zwi ni ṋea khetho musi mutsho kana zwikhokhonono zwi tshi kwama zwimela.',
      reviewStatus: 'machine-draft',
    },
    {
      paragraphIndex: 5,
      sourceEnglish: 'Each staple protects you against something different.',
      tshivendaDraft: 'Tshiḽiwa tsha vhuthogwa tshiṅwe na tshiṅwe tshi ni tsireledza kha zwithu zwo fhambanaho.',
      reviewStatus: 'machine-draft',
    },
    {
      paragraphIndex: 15,
      sourceEnglish: 'Different crops use water, soil and seasons differently.',
      tshivendaDraft: 'Zwimela zwo fhambanaho zwi shumisa maḓi, mavu na khalaṅwaha nga nḓila dzo fhambanaho.',
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
    'body[3–4], body[6–10], body[14], and the remaining English sentence in body[15]',
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

const vegetablesL1 = sourceModule.lessons.find(lesson => lesson.id === 'vegetables-staples-l1')!;

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
  },
  {
    id: 'vegetables-staples-l1',
    title: hold(vegetablesL1.title),
    infographicAlt: hold(vegetablesL1.infographicAlt!),
    body: pair("Compacted soil loses its air spaces. Roots slow down. Water soaks in differently. The bed gets harder to work every season.\n\nThe protection is simple. Permanent paths, and a bed narrow enough to reach into from both sides.\n\nOne metre to one point two metres wide. That's the working number. At that width you can reach the centre from either path, and your feet never touch the growing area.\n\nNow think about your own beds. Can you reach the middle without stepping inside? Go and try it before you plant anything else.\n\nThere's no single bed shape that's right everywhere.\n\nStart with the least disturbance that solves your problem.\n\nNo-dig suits most garden soils. Leave the structure alone and build fertility on top.\n\nDo not dig wet clay. If compaction or poor drainage is severe, identify the cause with local advice before choosing deeper cultivation.\n\nRaised beds suit wet ground, where water needs somewhere to drain away to.\n\nSunken beds suit dry ground, where you want to catch and hold what rain you get.\n\nLook after heavy rain. Where does water sit or run off? Combine that observation with soil and drainage advice before choosing the bed.\n\nSome crops resent having their roots disturbed. They do better sown straight where they'll grow. Beans, carrots and maize belong in that group.\n\nOthers do better with a protected start in a nursery, then transplanting. Tomatoes and brassicas belong there.\n\nUse spacing guidance for the crop, variety and local conditions. Check the packet and local grower advice. Watch for crowding as plants develop.\n\nBefore you plant, mark the bed out.\n\nOne point two metres wide. Three metres long. One practice bed.\n\nUse pegs and string. Mark the rectangle, and mark both access paths.\n\nThen prepare for your own soil — no-dig first, and dig deeper only if your ground genuinely needs it.\n\nA string line turns an idea into a decision. Once the paths exist, keep them. Once the growing area exists, protect it.\n\nThat bed gets easier to improve every season, because you stopped walking on it.", "Compacted soil loses its air spaces. Roots slow down. Water soaks in differently. The bed gets harder to work every season.\n\nTsireledzo ndi yo leluwaho. Permanent paths, and a bed narrow enough to reach into from both sides.\n\nOne metre to one point two metres wide. Wonoyo ndi mpimo une wa shumiswa. At that width you can reach the centre from either path, and your feet never touch the growing area.\n\nZwino humbulani nga ha beds dzaṋu. Ni nga swikelela vhukati without stepping inside? Iyani ni lingedze zwenezwo ni sa athu ṱavha tshiṅwe tshithu.\n\nA hu na tshivhumbeo tshithihi tsha bed tshine tsha tea fhethu hoṱhe.\n\nThomani nga least disturbance that solves your problem.\n\nNo-dig suits most garden soils. Litshani structure ya mavu i sa shanduke, nahone ni fhaṱe fertility on top.\n\nDo not dig wet clay. If compaction or poor drainage is severe, identify the cause with local advice before choosing deeper cultivation.\n\nRaised beds suit wet ground, hune maḓi a ṱoḓa fhethu ha u bva hone.\n\nSunken beds suit dry ground, hune na ṱoḓa u catch and hold mvula ine na i wana.\n\nMusi heavy rain yo no na, ṱhogomelani. Maḓi a dzula ngafhi kana a run off ngafhi? Ṱanganyisani zwe na vhona na soil and drainage advice u sa athu khetha bed.\n\nZwimela zwiṅwe a zwi takaleli musi midzi yazwo i tshi kavanyedzwa. They do better sown straight where they'll grow. Beans, carrots na maize zwi wela kha tshigwada itsho.\n\nZwimela zwiṅwe zwi ita zwavhuḓi arali zwi thoma zwi tshi tsireledzwa nursery, then transplanting. Tomatoes na brassicas zwi wela henefho.\n\nShumisani spacing guidance for the crop, variety and local conditions. Check the packet and local grower advice. Sedzani crowding musi zwimela zwi tshi aluwa.\n\nNi sa athu ṱavha, swayani bed.\n\nOne point two metres wide. Three metres long. Bed nthihi ya vhuḓowedzi (practice bed).\n\nShumisani zwipiki na thambo. Swayani rectangle, and mark both access paths.\n\nThen prepare for your own soil — no-dig first, and dig deeper only if your ground genuinely needs it.\n\nString line i shandula muhumbulo wa vha tsheo. Musi paths dzi no vha hone, ni dzi litshe dzi dzule hone. Musi growing area i no vha hone, ni i tsireledze.\n\nBed yeneyo i a leluwa u khwinifhadza khalaṅwaha iṅwe na iṅwe, ngauri no litsha u tshimbila khayo."),
    keyPoints: vegetablesL1.keyPoints.map(hold),
    quiz: vegetablesL1.quiz.map(question => ({
      question: hold(question.q),
      options: question.options.map(hold),
      sourceCorrectIndex: question.correct,
      rationale: hold(question.rationale),
    })),
  }],
};

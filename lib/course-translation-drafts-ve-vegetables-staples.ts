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

const vegetablesL2 = sourceModule.lessons.find(lesson => lesson.id === 'vegetables-staples-l2')!;

const vegetablesL4 = sourceModule.lessons.find(lesson => lesson.id === 'vegetables-staples-l4')!;

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
    title: pair("Preparing and Planting Your Beds", "U Lugisela na u Ṱavha Beds dzaṋu"),
    infographicAlt: hold(vegetablesL1.infographicAlt!),
    body: pair("Compacted soil loses its air spaces. Roots slow down. Water soaks in differently. The bed gets harder to work every season.\n\nThe protection is simple. Permanent paths, and a bed narrow enough to reach into from both sides.\n\nOne metre to one point two metres wide. That's the working number. At that width you can reach the centre from either path, and your feet never touch the growing area.\n\nNow think about your own beds. Can you reach the middle without stepping inside? Go and try it before you plant anything else.\n\nThere's no single bed shape that's right everywhere.\n\nStart with the least disturbance that solves your problem.\n\nNo-dig suits most garden soils. Leave the structure alone and build fertility on top.\n\nDo not dig wet clay. If compaction or poor drainage is severe, identify the cause with local advice before choosing deeper cultivation.\n\nRaised beds suit wet ground, where water needs somewhere to drain away to.\n\nSunken beds suit dry ground, where you want to catch and hold what rain you get.\n\nLook after heavy rain. Where does water sit or run off? Combine that observation with soil and drainage advice before choosing the bed.\n\nSome crops resent having their roots disturbed. They do better sown straight where they'll grow. Beans, carrots and maize belong in that group.\n\nOthers do better with a protected start in a nursery, then transplanting. Tomatoes and brassicas belong there.\n\nUse spacing guidance for the crop, variety and local conditions. Check the packet and local grower advice. Watch for crowding as plants develop.\n\nBefore you plant, mark the bed out.\n\nOne point two metres wide. Three metres long. One practice bed.\n\nUse pegs and string. Mark the rectangle, and mark both access paths.\n\nThen prepare for your own soil — no-dig first, and dig deeper only if your ground genuinely needs it.\n\nA string line turns an idea into a decision. Once the paths exist, keep them. Once the growing area exists, protect it.\n\nThat bed gets easier to improve every season, because you stopped walking on it.", "Compacted soil loses its air spaces. Roots slow down. Water soaks in differently. The bed gets harder to work every season.\n\nTsireledzo ndi yo leluwaho. Permanent paths, and a bed narrow enough to reach into from both sides.\n\nOne metre to one point two metres wide. Wonoyo ndi mpimo une wa shumiswa. At that width you can reach the centre from either path, and your feet never touch the growing area.\n\nZwino humbulani nga ha beds dzaṋu. Ni nga swikelela vhukati without stepping inside? Iyani ni lingedze zwenezwo ni sa athu ṱavha tshiṅwe tshithu.\n\nA hu na tshivhumbeo tshithihi tsha bed tshine tsha tea fhethu hoṱhe.\n\nThomani nga least disturbance that solves your problem.\n\nNo-dig suits most garden soils. Litshani structure ya mavu i sa shanduke, nahone ni fhaṱe fertility on top.\n\nDo not dig wet clay. If compaction or poor drainage is severe, identify the cause with local advice before choosing deeper cultivation.\n\nRaised beds suit wet ground, hune maḓi a ṱoḓa fhethu ha u bva hone.\n\nSunken beds suit dry ground, hune na ṱoḓa u catch and hold mvula ine na i wana.\n\nMusi heavy rain yo no na, ṱhogomelani. Maḓi a dzula ngafhi kana a run off ngafhi? Ṱanganyisani zwe na vhona na soil and drainage advice u sa athu khetha bed.\n\nZwimela zwiṅwe a zwi takaleli musi midzi yazwo i tshi kavanyedzwa. They do better sown straight where they'll grow. Beans, carrots na maize zwi wela kha tshigwada itsho.\n\nZwimela zwiṅwe zwi ita zwavhuḓi arali zwi thoma zwi tshi tsireledzwa nursery, then transplanting. Tomatoes na brassicas zwi wela henefho.\n\nShumisani spacing guidance for the crop, variety and local conditions. Check the packet and local grower advice. Sedzani crowding musi zwimela zwi tshi aluwa.\n\nNi sa athu ṱavha, swayani bed.\n\nOne point two metres wide. Three metres long. Bed nthihi ya vhuḓowedzi (practice bed).\n\nShumisani zwipiki na thambo. Swayani rectangle, and mark both access paths.\n\nThen prepare for your own soil — no-dig first, and dig deeper only if your ground genuinely needs it.\n\nString line i shandula muhumbulo wa vha tsheo. Musi paths dzi no vha hone, ni dzi litshe dzi dzule hone. Musi growing area i no vha hone, ni i tsireledze.\n\nBed yeneyo i a leluwa u khwinifhadza khalaṅwaha iṅwe na iṅwe, ngauri no litsha u tshimbila khayo."),
    keyPoints: [
      pair("Keep beds 1-1.2m wide so you never need to step on the growing area", "Beds dzaṋu dzi vhe 1-1.2m wide so you never need to step on the growing area."),
      hold("Assess compaction and drainage before choosing deeper cultivation; do not work wet clay"),
      hold("Transplant crops needing a head start; direct-seed crops that resent root disturbance"),
      hold("Crowded plants underperform — space generously for your local climate"),
    ],
    quiz: [
      {
        question: pair("Why keep a vegetable bed to 1-1.2m wide rather than wider?", "Ndi ngani ni tshi vhulunga vegetable bed i tshi vha 1-1.2m wide, nṱhani ha u i ita wider?"),
        options: [
          hold("Wider beds get too much sun"),
          hold("You can reach the centre from either side without stepping on the growing area, avoiding compaction"),
          hold("Narrow beds drain better in all conditions"),
          pair("It's a fixed rule with no practical reason", "Ndi mulayo wo vhewaho une wa si vha na tshiitisi tsha u shumisa."),
        ],
        sourceCorrectIndex: 1,
        rationale: hold("Stepping on growing soil compacts it and damages roots — a bed you can reach into from both sides means you never have to."),
      },
      {
        question: hold("Which crop is best suited to direct-seeding rather than transplanting?"),
        options: [
          hold("Tomatoes, which need an early start"),
          hold("Brassicas, which need protection while small"),
          hold("Beans, which resent root disturbance"),
          hold("Peppers, which are slow to germinate"),
        ],
        sourceCorrectIndex: 2,
        rationale: hold("Beans and other quick, sensitive-rooted crops establish poorly after transplant shock — sowing them straight into the bed avoids that setback entirely."),
      },
    ],
  },
  {
    id: 'vegetables-staples-l2',
    title: pair("Succession Planting and Intercropping", "Succession Planting na Intercropping"),
    infographicAlt: hold(vegetablesL2.infographicAlt!),
    body: pair("Succession planting is a calendar habit, not a special crop.\n\nChoose something your household actually eats often. Then sow a small amount of it, again and again.\n\nPlant a short row every two to three weeks.\n\nLess waste during a glut. Fresh food for longer. And the labour spreads out across the season instead of landing on you all at once.\n\nSeparate sowings may reduce the risk of losing everything at once. They do not guarantee a harvest if difficult conditions continue.\n\nWhich fast crop could you sow in small batches? Decide on one, and start it this week.\n\nHere's what it looks like in practice.\n\nSow one. Then two to three weeks later, sow two. Then sow three. Then sow four.\n\nWith suitable crop timing, harvests can begin to overlap. The first batch will not always be ready by the fourth sowing.\n\nTwo to three weeks is a starting rhythm, not a law. A cool-season leaf crop may hold longer. Heat may speed things up, or cause a failure.\n\nWatch what your own garden does, and adjust the interval. That observation is the skill.\n\nIntercropping is not just crowding different plants together. Each plant needs a job, and enough space to do it.\n\nThe Three Sisters is an example from Indigenous farming traditions in the Americas.\n\nMaize gives height and structure.\n\nBeans climb the maize, and store as protein.\n\nPumpkin spreads across the ground, shading the soil and holding moisture.\n\nTiming matters. Establish the maize first, so it's strong enough to carry the beans when they start to climb.\n\nThe plants can still compete. Give them suitable space, water and light. Beans fix nitrogen with root bacteria, but do not assume they immediately feed the maize; nutrients in residues are released during decomposition.\n\nA household may have a hungry gap: weeks when stored food runs low before the next harvest is ready.\n\nYours might come after stored maize runs out. It might come before winter greens are ready. It might come in a dry period when water limits the garden.\n\nDon't copy somebody else's calendar. Name your own months first.\n\nWrite them down. Then choose the crop and the sowing date that puts food into that gap.\n\nThat's planning backwards, and it's the difference between a garden that looks productive and a household that eats.", "Succession planting ndi maitele a kalenda, hu si tshimela tsho khetheaho.\n\nChoose something your household actually eats often. Then sow a small amount of it, again and again.\n\nṰavhani muduba mupfufhi every two to three weeks.\n\nLess waste during a glut. Fresh food for longer. Na mushumo u a phadalala kha khalaṅwaha, u sa ni kwama woṱhe nga tshifhinga tshithihi.\n\nSeparate sowings dzi nga fhungudza risk ya u xelelwa nga zwoṱhe nga tshifhinga tshithihi. They do not guarantee a harvest if difficult conditions continue.\n\nWhich fast crop could you sow in small batches? Nangani tshithihi, ni tshi thome ino vhege.\n\nHezwi ndi zwine zwa itea ngazwo.\n\nSow one. Nga murahu ha two to three weeks, sow two. Nga murahu, sow three. Nga murahu, sow four.\n\nWith suitable crop timing, harvests can begin to overlap. The first batch will not always be ready by the fourth sowing.\n\nTwo to three weeks ndi starting rhythm, hu si law. A cool-season leaf crop may hold longer. Heat may speed things up, or cause a failure.\n\nSedzani zwine zwa itea tsimuni yaṋu, ni shandule interval. U sedza nga nḓila iyi ndi yone skill.\n\nIntercropping is not just crowding different plants together. Tshimela tshiṅwe na tshiṅwe tshi ṱoḓa mushumo watsho, na fhethu ho eḓanaho uri tshi kone u ita wonoyo mushumo.\n\nThe Three Sisters ndi tsumbo from Indigenous farming traditions in the Americas.\n\nMaize i fha height and structure.\n\nBeans dzi gonya maize, and store as protein.\n\nPumpkin spreads across the ground, i ita murunzi kha mavu na u vhulunga moisture.\n\nTiming ndi ya ndeme. Establish the maize first, so it's strong enough to carry the beans when they start to climb.\n\nThe plants can still compete. Ni zwi fhe fhethu ho teaho, maḓi na tshedza. Beans fix nitrogen with root bacteria, but do not assume they immediately feed the maize; nutrients in residues are released during decomposition.\n\nMuṱa u nga vha na hungry gap: weeks when stored food runs low before the next harvest is ready.\n\nYours might come after stored maize runs out. It might come before winter greens are ready. It might come in a dry period when water limits the garden.\n\nNi songo kopolola calendar ya muṅwe muthu. Thomani nga u bula miṅwedzi yaṋu.\n\nIṅwaleni fhasi. Ni kone u khetha crop na sowing date ine ya isa zwiḽiwa kha hungry gap yeneyo.\n\nHezwi ndi planning backwards, nahone ndi zwone zwi fhambanyisaho garden ine ya vhonala i tshi bveledza na muṱa une wa wana zwiḽiwa."),
    keyPoints: [
      pair("Stagger sowings and adjust the interval for crop, weather and household use", "Shumisani staggered sowings, ni shandule interval u ya nga crop, weather na household use."),
      hold("The Three Sisters comes from Indigenous farming traditions in the Americas"),
      pair("Use household food records to identify and plan for a hungry gap", "Shumisani household food records u wana na u pulana hungry gap."),
      pair("Intercropped plants can still compete; manage space, timing and water", "Zwimela zwo ṱavhiwaho zwo ṱanganelana zwi nga kha ḓi konkurisana; langani space, timing na maḓi."),
    ],
    quiz: [
      {
        question: pair("Why sow lettuce in small batches every 2-3 weeks instead of all at once?", "Ndi ngani ni tshi sow lettuce nga small batches every 2-3 weeks, nṱhani ha u i sow all at once?"),
        options: [
          hold("It uses less seed overall"),
          hold("It gives a steady harvest instead of a glut followed by a gap"),
          hold("Lettuce germinates better in small batches"),
          pair("It reduces pest pressure", "Zwi fhungudza pest pressure."),
        ],
        sourceCorrectIndex: 1,
        rationale: hold("A single large sowing matures all at once — staggering the sowing spreads the harvest out to match what a household can actually use."),
      },
      {
        question: pair("When can nitrogen in bean crop residues become available to other plants?", "Ndi lini nitrogen in bean crop residues i nga vha available kha other plants?"),
        options: [
          pair("Immediately whenever a bean touches maize", "Nga u ṱavhanya tshifhinga tshoṱhe musi bean i tshi kwama maize."),
          hold("As soil organisms decompose the residues"),
          hold("Only when pumpkin leaves shade them"),
          hold("It can never be released"),
        ],
        sourceCorrectIndex: 1,
        rationale: hold("Beans fix nitrogen with suitable root bacteria. Nitrogen in their residues is released through decomposition; growing beans beside maize does not guarantee immediate feeding."),
      },
    ],
  },
  {
    id: 'vegetables-staples-l4',
    title: pair("Observe and Manage Pests and Disease", "Sedzani ni lange Pests na Disease."),
    infographicAlt: hold(vegetablesL4.infographicAlt!),
    body: pair("Pest pressure usually rises for a reason.\n\nPlants under stress. One crop dominating the ground. Or broad chemical use that has already removed the predators that were helping you.\n\nSo before you treat anything, look at the whole system.\n\nIs the plant short of water? Is the soil compacted, or hungry? Are predators already working on the problem for you?\n\nA yellow leaf is not automatically an insect. It can be water, nutrition, or root damage. Find out which before you act.\n\nWork through four steps, in order.\n\nOne. Observe. Look at the damage pattern, the underside of the leaf, the stem, and the plants nearby.\n\nTwo. Check for stress. Soil moisture, roots, spacing, nutrition, drainage.\n\nThree. Protect what's helping you. Beneficial insects are doing work you'd otherwise do yourself.\n\nFour. Only then, act — and start with the lightest thing that works. Physical removal, barriers or changes in crop care may help. Check that the action suits the problem and monitor the result.\n\nIf a treatment is needed, use a product registered for that crop and pest, and follow its label. This includes neem products. Check protection and harvest waiting instructions. Do not improvise mixtures or stronger doses.\n\nBe honest with yourself about which step you usually skip.", "Pest pressure i anzela u engedzea nga tshiitisi.\n\nPlants under stress. One crop dominating the ground. Or broad chemical use that has already removed the predators that were helping you.\n\nSo before you treat anything, sedzani system yoṱhe.\n\nIs the plant short of water? Is the soil compacted, or hungry? Are predators already working on the problem for you?\n\nA yellow leaf is not automatically an insect. It can be water, nutrition, or root damage. Find out which before you act.\n\nTevhelani vhukando vhuṋa nga u tevhekana.\n\nTsha u thoma. Sedzani zwavhuḓi. Damage pattern, the underside of the leaf, the stem, and nearby plants: sedzani hezwi.\n\nTwo. Check for stress. Soil moisture, roots, spacing, nutrition, drainage.\n\nThree. Protect what's helping you. Beneficial insects are doing work you'd otherwise do yourself.\n\nTsha vhuṋa. Ndi hone fhedzi ni tshi dzhia vhukando — start with the lightest thing that works. Physical removal, barriers or changes in crop care may help. Check that the action suits the problem and monitor the result.\n\nIf a treatment is needed, use a product registered for that crop and pest, and follow its label. This includes neem products. Check protection and harvest waiting instructions. Do not improvise mixtures or stronger doses.\n\nNi ḓi ambele ngoho nga ha vhukando vhune na anzela u vhu pfuka."),
    keyPoints: [
      pair("Identify the cause before treating damage", "Wanani tshiitisi tsha damage ni sa athu treating."),
      pair("Check water, roots, nutrition and beneficial insects", "Ṱolani maḓi, roots, nutrition na beneficial insects."),
      pair("Use suitable physical or crop-care measures and monitor results", "Shumisani physical kana crop-care measures zwo teaho ni monitor results."),
      pair("If treatment is needed, use a registered product for the crop and pest and follow the label", "Arali treatment i tshi ṱoḓea, use a registered product for the crop and pest and follow the label."),
    ],
    quiz: [
      {
        question: pair("If a pest problem needs a treatment product, what should guide its use?", "Arali pest problem i tshi ṱoḓa treatment product, ndi mini tshine tsha fanela u langa u shumiswa hayo?"),
        options: [
          hold("An improvised stronger mixture"),
          hold("A product registered for the crop and pest, used according to its label"),
          pair("Any product described as natural", "Product iṅwe na iṅwe ine ya ṱaluswa sa natural."),
          hold("A neighbour’s dose for a different crop"),
        ],
        sourceCorrectIndex: 1,
        rationale: hold("Crop, pest, dose, protection and harvest waiting instructions matter. A natural origin does not make an improvised treatment safe or suitable."),
      },
      {
        question: pair("A farmer's brassica leaves are turning yellow. Before assuming pests, what should she check first?", "Musi maṱari a brassica a murimi a tshi khou vha yellow, u sa athu humbulela uri ndi pests, u fanela u thoma u ṱola mini?"),
        options: [
          pair("Whether it's actually a soil nutrient or watering issue", "Arali hu vhukuma thaidzo ya soil nutrient kana watering."),
          hold("Whether the moon phase is right for treatment"),
          pair("Whether her neighbour has the same problem", "Arali muhura wawe a tshi na thaidzo i fanaho."),
          hold("Whether it's aphids specifically"),
        ],
        sourceCorrectIndex: 0,
        rationale: hold("Yellowing has several common causes, and a soil or watering issue needs a completely different fix than a pest does — checking first avoids wasted treatment."),
      },
    ],
  }],
};

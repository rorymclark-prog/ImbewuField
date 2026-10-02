/** Unreviewed source-paired Xitsonga bed-preparation and staple concepts. */
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
    {
      "id": "vegetables-staples-l1",
      "infographicAlt": {
        "sourceEnglish": "A raised bed about 1.2 metres wide, with paths on both sides, so a person can reach the middle from either side without ever standing on the growing soil.",
        "xitsongaDraft": "A raised bed about 1.2 metres wide, with paths on both sides, so a person can reach the middle from either side without ever standing on the growing soil.",
        "reviewStatus": "hold"
      },
      "title": {
        "sourceEnglish": "Preparing and Planting Your Beds",
        "xitsongaDraft": "Preparing and Planting Your Beds",
        "reviewStatus": "hold"
      },
      "body": {
        "sourceEnglish": "Compacted soil loses its air spaces. Roots slow down. Water soaks in differently. The bed gets harder to work every season.\n\nThe protection is simple. Permanent paths, and a bed narrow enough to reach into from both sides.\n\nOne metre to one point two metres wide. That's the working number. At that width you can reach the centre from either path, and your feet never touch the growing area.\n\nNow think about your own beds. Can you reach the middle without stepping inside? Go and try it before you plant anything else.\n\nThere's no single bed shape that's right everywhere.\n\nStart with the least disturbance that solves your problem.\n\nNo-dig suits most garden soils. Leave the structure alone and build fertility on top.\n\nDo not dig wet clay. If compaction or poor drainage is severe, identify the cause with local advice before choosing deeper cultivation.\n\nRaised beds suit wet ground, where water needs somewhere to drain away to.\n\nSunken beds suit dry ground, where you want to catch and hold what rain you get.\n\nLook after heavy rain. Where does water sit or run off? Combine that observation with soil and drainage advice before choosing the bed.\n\nSome crops resent having their roots disturbed. They do better sown straight where they'll grow. Beans, carrots and maize belong in that group.\n\nOthers do better with a protected start in a nursery, then transplanting. Tomatoes and brassicas belong there.\n\nUse spacing guidance for the crop, variety and local conditions. Check the packet and local grower advice. Watch for crowding as plants develop.\n\nBefore you plant, mark the bed out.\n\nOne point two metres wide. Three metres long. One practice bed.\n\nUse pegs and string. Mark the rectangle, and mark both access paths.\n\nThen prepare for your own soil — no-dig first, and dig deeper only if your ground genuinely needs it.\n\nA string line turns an idea into a decision. Once the paths exist, keep them. Once the growing area exists, protect it.\n\nThat bed gets easier to improve every season, because you stopped walking on it.",
        "xitsongaDraft": "Compacted soil loses its air spaces. Roots slow down. Mati ma tswonga hi ndlela yo hambana. Bed yi ya tika ku tirha eka nguva yin'wana ni yin'wana.\n\nNsirhelelo wu olova. Permanent paths, and a bed narrow enough to reach into from both sides.\n\nOne metre to one point two metres wide. That's the working number. At that width you can reach the centre from either path, and your feet never touch the growing area.\n\nSweswi ehleketa hi mabedhe ya wena. Can you reach the middle without stepping inside? Famba u ya ringeta leswi u nga si byala swin'wana.\n\nA ku na xivumbeko xa bed lexi lulameke eka tindhawu hinkwato.\n\nSungula hi least disturbance that solves your problem.\n\nNo-dig suits most garden soils. Leave the structure alone and build fertility on top.\n\nDo not dig wet clay. If compaction or poor drainage is severe, identify the cause with local advice before choosing deeper cultivation.\n\nRaised beds suit wet ground, where water needs somewhere to drain away to.\n\nSunken beds suit dry ground, where you want to catch and hold what rain you get.\n\nEndzhaku ka heavy rain, kambisisa. Where does water sit or run off? Combine that observation with soil and drainage advice before choosing the bed.\n\nSwibyariwa swin'wana a swi tsakeli ku kavanyetiwa ka timitsu ta swona. They do better sown straight where they'll grow. Beans, carrots and maize belong in that group.\n\nOthers do better with a protected start in a nursery, then transplanting. Tomatoes and brassicas belong there.\n\nLandzelela spacing guidance for the crop, variety and local conditions. Check the packet and local grower advice. Watch for crowding as plants develop.\n\nLoko u nga si byala, mark the bed out.\n\nOne point two metres wide. Three metres long. One practice bed.\n\nTirhisa pegs and string. Mark the rectangle, and mark both access paths.\n\nThen prepare for your own soil — no-dig first, and dig deeper only if your ground genuinely needs it.\n\nNtila wa ntambhu wu hundzula miehleketo wu va xiboho. Loko tindlela ti ri kona, ti hlayise. Loko ndhawu yo byala yi ri kona, yi sirhelele.\n\nBed yoleyo yi ya olova ku antswisa eka nguva yin'wana ni yin'wana, hikuva u tshike ku famba ehenhla ka yona.",
        "reviewStatus": "machine-draft"
      },
      "keyPoints": [
        {
          "sourceEnglish": "Keep beds 1-1.2m wide so you never need to step on the growing area",
          "xitsongaDraft": "Keep beds 1-1.2m wide so you never need to step on the growing area",
          "reviewStatus": "hold"
        },
        {
          "sourceEnglish": "Assess compaction and drainage before choosing deeper cultivation; do not work wet clay",
          "xitsongaDraft": "Assess compaction and drainage before choosing deeper cultivation; do not work wet clay",
          "reviewStatus": "hold"
        },
        {
          "sourceEnglish": "Transplant crops needing a head start; direct-seed crops that resent root disturbance",
          "xitsongaDraft": "Transplant crops needing a head start; direct-seed crops that resent root disturbance",
          "reviewStatus": "hold"
        },
        {
          "sourceEnglish": "Crowded plants underperform — space generously for your local climate",
          "xitsongaDraft": "Crowded plants underperform — space generously for your local climate",
          "reviewStatus": "hold"
        }
      ],
      "quiz": [
        {
          "question": {
            "sourceEnglish": "Why keep a vegetable bed to 1-1.2m wide rather than wider?",
            "xitsongaDraft": "Why keep a vegetable bed to 1-1.2m wide rather than wider?",
            "reviewStatus": "hold"
          },
          "options": [
            {
              "sourceEnglish": "Wider beds get too much sun",
              "xitsongaDraft": "Wider beds get too much sun",
              "reviewStatus": "hold"
            },
            {
              "sourceEnglish": "You can reach the centre from either side without stepping on the growing area, avoiding compaction",
              "xitsongaDraft": "You can reach the centre from either side without stepping on the growing area, avoiding compaction",
              "reviewStatus": "hold"
            },
            {
              "sourceEnglish": "Narrow beds drain better in all conditions",
              "xitsongaDraft": "Narrow beds drain better in all conditions",
              "reviewStatus": "hold"
            },
            {
              "sourceEnglish": "It's a fixed rule with no practical reason",
              "xitsongaDraft": "It's a fixed rule with no practical reason",
              "reviewStatus": "hold"
            }
          ],
          "sourceCorrectIndex": 1,
          "rationale": {
            "sourceEnglish": "Stepping on growing soil compacts it and damages roots — a bed you can reach into from both sides means you never have to.",
            "xitsongaDraft": "Stepping on growing soil compacts it and damages roots — a bed you can reach into from both sides means you never have to.",
            "reviewStatus": "hold"
          }
        },
        {
          "question": {
            "sourceEnglish": "Which crop is best suited to direct-seeding rather than transplanting?",
            "xitsongaDraft": "Which crop is best suited to direct-seeding rather than transplanting?",
            "reviewStatus": "hold"
          },
          "options": [
            {
              "sourceEnglish": "Tomatoes, which need an early start",
              "xitsongaDraft": "Tomatoes, which need an early start",
              "reviewStatus": "hold"
            },
            {
              "sourceEnglish": "Brassicas, which need protection while small",
              "xitsongaDraft": "Brassicas, which need protection while small",
              "reviewStatus": "hold"
            },
            {
              "sourceEnglish": "Beans, which resent root disturbance",
              "xitsongaDraft": "Beans, which resent root disturbance",
              "reviewStatus": "hold"
            },
            {
              "sourceEnglish": "Peppers, which are slow to germinate",
              "xitsongaDraft": "Peppers, which are slow to germinate",
              "reviewStatus": "hold"
            }
          ],
          "sourceCorrectIndex": 2,
          "rationale": {
            "sourceEnglish": "Beans and other quick, sensitive-rooted crops establish poorly after transplant shock — sowing them straight into the bed avoids that setback entirely.",
            "xitsongaDraft": "Beans and other quick, sensitive-rooted crops establish poorly after transplant shock — sowing them straight into the bed avoids that setback entirely.",
            "reviewStatus": "hold"
          }
        }
      ]
    },
    {
      "id": "vegetables-staples-l4",
      "title": {
        "sourceEnglish": "Observe and Manage Pests and Disease",
        "xitsongaDraft": "Observe and Manage Pests and Disease",
        "reviewStatus": "hold"
      },
      "infographicAlt": {
        "sourceEnglish": "A pest on a leaf, and three ways to deal with it without chemicals: a beneficial insect, a physical barrier, and picking it off by hand.",
        "xitsongaDraft": "A pest on a leaf, and three ways to deal with it without chemicals: a beneficial insect, a physical barrier, and picking it off by hand.",
        "reviewStatus": "hold"
      },
      "body": {
        "sourceEnglish": "Pest pressure usually rises for a reason.\n\nPlants under stress. One crop dominating the ground. Or broad chemical use that has already removed the predators that were helping you.\n\nSo before you treat anything, look at the whole system.\n\nIs the plant short of water? Is the soil compacted, or hungry? Are predators already working on the problem for you?\n\nA yellow leaf is not automatically an insect. It can be water, nutrition, or root damage. Find out which before you act.\n\nWork through four steps, in order.\n\nOne. Observe. Look at the damage pattern, the underside of the leaf, the stem, and the plants nearby.\n\nTwo. Check for stress. Soil moisture, roots, spacing, nutrition, drainage.\n\nThree. Protect what's helping you. Beneficial insects are doing work you'd otherwise do yourself.\n\nFour. Only then, act — and start with the lightest thing that works. Physical removal, barriers or changes in crop care may help. Check that the action suits the problem and monitor the result.\n\nIf a treatment is needed, use a product registered for that crop and pest, and follow its label. This includes neem products. Check protection and harvest waiting instructions. Do not improvise mixtures or stronger doses.\n\nBe honest with yourself about which step you usually skip.",
        "xitsongaDraft": "Pest pressure hi ntolovelo yi engetseka hi xivangelo.\n\nPlants under stress. One crop dominating the ground. Or broad chemical use that has already removed the predators that were helping you.\n\nKutani, loko u nga si tshungula xin'wana ni xin'wana, languta system hinkwawu.\n\nIs the plant short of water? Is the soil compacted, or hungry? Are predators already working on the problem for you?\n\nA yellow leaf is not automatically an insect. It can be water, nutrition, or root damage. Find out which before you act.\n\nTirha hi magoza ya mune, hi ku landzelelana.\n\nOne. Observe. Look at the damage pattern, the underside of the leaf, the stem, and the plants nearby.\n\nTwo. Check for stress. Soil moisture, roots, spacing, nutrition, drainage.\n\nVunharhu. Sirhelela leswi swi ku pfunaka. Beneficial insects are doing work you'd otherwise do yourself.\n\nVumune. Hi kona ntsena u tekaka goza — and start with the lightest thing that works. Physical removal, barriers or changes in crop care may help. Check that the action suits the problem and monitor the result.\n\nIf a treatment is needed, use a product registered for that crop and pest, and follow its label. This includes neem products. Check protection and harvest waiting instructions. Do not improvise mixtures or stronger doses.\n\nTshembeka eka wena n'winyi mayelana na goza leri u talaka ku ri tlula.",
        "reviewStatus": "machine-draft"
      },
      "keyPoints": [
        {
          "sourceEnglish": "Identify the cause before treating damage",
          "xitsongaDraft": "Identify the cause before treating damage",
          "reviewStatus": "hold"
        },
        {
          "sourceEnglish": "Check water, roots, nutrition and beneficial insects",
          "xitsongaDraft": "Check water, roots, nutrition and beneficial insects",
          "reviewStatus": "hold"
        },
        {
          "sourceEnglish": "Use suitable physical or crop-care measures and monitor results",
          "xitsongaDraft": "Use suitable physical or crop-care measures and monitor results",
          "reviewStatus": "hold"
        },
        {
          "sourceEnglish": "If treatment is needed, use a registered product for the crop and pest and follow the label",
          "xitsongaDraft": "If treatment is needed, use a registered product for the crop and pest and follow the label",
          "reviewStatus": "hold"
        }
      ],
      "quiz": [
        {
          "question": {
            "sourceEnglish": "If a pest problem needs a treatment product, what should guide its use?",
            "xitsongaDraft": "If a pest problem needs a treatment product, what should guide its use?",
            "reviewStatus": "hold"
          },
          "options": [
            {
              "sourceEnglish": "An improvised stronger mixture",
              "xitsongaDraft": "An improvised stronger mixture",
              "reviewStatus": "hold"
            },
            {
              "sourceEnglish": "A product registered for the crop and pest, used according to its label",
              "xitsongaDraft": "A product registered for the crop and pest, used according to its label",
              "reviewStatus": "hold"
            },
            {
              "sourceEnglish": "Any product described as natural",
              "xitsongaDraft": "Any product described as natural",
              "reviewStatus": "hold"
            },
            {
              "sourceEnglish": "A neighbour’s dose for a different crop",
              "xitsongaDraft": "A neighbour’s dose for a different crop",
              "reviewStatus": "hold"
            }
          ],
          "sourceCorrectIndex": 1,
          "rationale": {
            "sourceEnglish": "Crop, pest, dose, protection and harvest waiting instructions matter. A natural origin does not make an improvised treatment safe or suitable.",
            "xitsongaDraft": "Crop, pest, dose, protection and harvest waiting instructions matter. A natural origin does not make an improvised treatment safe or suitable.",
            "reviewStatus": "hold"
          }
        },
        {
          "question": {
            "sourceEnglish": "A farmer's brassica leaves are turning yellow. Before assuming pests, what should she check first?",
            "xitsongaDraft": "A farmer's brassica leaves are turning yellow. Before assuming pests, what should she check first?",
            "reviewStatus": "hold"
          },
          "options": [
            {
              "sourceEnglish": "Whether it's actually a soil nutrient or watering issue",
              "xitsongaDraft": "Whether it's actually a soil nutrient or watering issue",
              "reviewStatus": "hold"
            },
            {
              "sourceEnglish": "Whether the moon phase is right for treatment",
              "xitsongaDraft": "Whether the moon phase is right for treatment",
              "reviewStatus": "hold"
            },
            {
              "sourceEnglish": "Whether her neighbour has the same problem",
              "xitsongaDraft": "Whether her neighbour has the same problem",
              "reviewStatus": "hold"
            },
            {
              "sourceEnglish": "Whether it's aphids specifically",
              "xitsongaDraft": "Whether it's aphids specifically",
              "reviewStatus": "hold"
            }
          ],
          "sourceCorrectIndex": 0,
          "rationale": {
            "sourceEnglish": "Yellowing has several common causes, and a soil or watering issue needs a completely different fix than a pest does — checking first avoids wasted treatment.",
            "xitsongaDraft": "Yellowing has several common causes, and a soil or watering issue needs a completely different fix than a pest does — checking first avoids wasted treatment.",
            "reviewStatus": "hold"
          }
        }
      ]
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

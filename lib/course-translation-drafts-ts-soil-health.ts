/** Unreviewed source-paired Xitsonga concept sentences for Soil Health L1. */
import type { XitsongaCourseModuleDraft, XitsongaSourcePair } from './course-translation-drafts-ts.ts';

const pair = (sourceEnglish: string, xitsongaDraft: string, reviewStatus: XitsongaSourcePair['reviewStatus'] = 'machine-draft'): XitsongaSourcePair => ({
  sourceEnglish,
  xitsongaDraft,
  reviewStatus,
});

const hold = (sourceEnglish: string): XitsongaSourcePair => pair(sourceEnglish, sourceEnglish, 'hold');

const sourceBody = 'Soil contains many kinds of living organisms. Bacteria and fungi help break down organic matter and cycle nutrients.\n\nSome fungi help roots take up nutrients. Worm channels can help water and air enter soil.\n\nLook at roots, soil structure and water movement as well as visible soil life.\n\nPut soil and water in a clear jar, with a little suitable dispersing detergent. Close and shake it, then leave it undisturbed.\n\nSand settles first. Silt settles next, while clay can remain suspended much longer.\n\nThis is a rough learning exercise. Clumps and unsettled clay can mislead you; use a soil laboratory when accurate texture is needed.\n\nA thick sand layer beneath cloudy water does not yet tell you the final proportions. Some fine particles may still be suspended.\n\nCompare the settled layers and feel the soil in the field.\n\nRecord what you see and what remains uncertain. Do not prescribe watering or soil treatments from one jar alone.\n\nCompaction, poor drainage and loss of organic matter can limit roots and soil life.\n\nPale colour or few worms do not prove that chemicals killed the soil. Worm activity also changes with moisture and season.\n\nLook for patterns across the field. Check management history, drainage and plant growth before choosing a remedy.';
const sourceParagraphs = sourceBody.split('\n\n');
const draftParagraphs = [...sourceParagraphs];
draftParagraphs[0] = 'Misava yi na tinxaka to tala ta swilo leswi hanyaka. Bacteria and fungi help break down organic matter and cycle nutrients.';
draftParagraphs[1] = "Fungi tin'wana ti pfuna timitsu ku tswonga nutrients. Worm channels ti nga pfuna mati na moya ku nghena emhlabeni.";

export const XITSONGA_SOIL_HEALTH_DRAFT: XitsongaCourseModuleDraft = {
  id: 'soil-health',
  language: 'ts',
  reviewStatus: 'machine-draft',
  sourceMetadata: { durationMins: 20, category: 'soil' },
  title: hold('Soil Health & Composting'),
  description: hold('Build living soil with compost, mulch, cover crops and worm farms.'),
  lessons: [
    {
      id: 'soil-health-l1',
      infographicAlt: hold('A spade cut through the ground showing dark crumbly topsoil above pale subsoil, with worm channels. Beside it, a jar of soil settled into three layers — sand, silt and clay.'),
      title: hold('Understanding Your Soil: The Foundation of Everything'),
      body: pair(sourceBody, draftParagraphs.join('\n\n')),
      keyPoints: [
        hold('Use several clues to assess soil condition'),
        hold('Soil colour and worm counts alone do not diagnose the cause of a problem'),
        hold('A jar exercise gives a rough indication of texture, not a complete soil test'),
        hold('Check drainage, roots and management history before choosing a remedy'),
      ],
      quiz: [
        {
          question: hold('A soil jar still has cloudy water above the sand layer. What should the farmer conclude?'),
          options: [
            hold('The soil definitely needs less water'),
            hold('Fine particles may still be suspended; more observation is needed'),
            hold('All the clay has already settled'),
            hold('The crop definitely needs gypsum'),
          ],
          sourceCorrectIndex: 1,
          rationale: hold('Cloudy water can contain unsettled fine particles. One early observation cannot establish the final proportions or the right treatment.'),
        },
        {
          question: hold('A farmer finds compacted soil and few worms. What is the useful next step?'),
          options: [
            hold('Assume every soil organism has died'),
            hold('Add a treatment without checking the site'),
            hold('Check drainage, roots, moisture and management history'),
            hold('Give up because the soil cannot improve'),
          ],
          sourceCorrectIndex: 2,
          rationale: hold('Several observations help identify a problem. Worm activity varies with conditions, so few worms alone do not establish its cause.'),
        },
      ],
    },
  ],
  holds: [
    { lessonId: 'soil-health-l1', field: 'body[0]', sourceText: 'Bacteria and fungi help break down organic matter and cycle nutrients.', reason: 'Technical microbiology and nutrient-cycling claim remains exact English.' },
    { lessonId: 'soil-health-l1', field: 'body[2]', sourceText: sourceParagraphs[2], reason: 'Soil observation guidance remains exact English.' },
    { lessonId: 'soil-health-l1', field: 'body[3]', sourceText: sourceParagraphs[3], reason: 'Jar-test steps and detergent choice remain exact English.' },
    { lessonId: 'soil-health-l1', field: 'body[4-8]', sourceText: sourceParagraphs.slice(4, 9).join('\n\n'), reason: 'Texture interpretation, uncertainty and assessment advice remain exact English.' },
    { lessonId: 'soil-health-l1', field: 'body[9-11]', sourceText: sourceParagraphs.slice(9, 12).join('\n\n'), reason: 'Soil diagnosis, causes and remedy-selection advice remain exact English.' },
  ],
};

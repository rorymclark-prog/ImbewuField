/** Unreviewed source-paired Xitsonga concept sentences for Soil Health L1. */
import type { XitsongaCourseModuleDraft, XitsongaSourcePair } from './course-translation-drafts-ts.ts';

const pair = (sourceEnglish: string, xitsongaDraft: string, reviewStatus: XitsongaSourcePair['reviewStatus'] = 'machine-draft'): XitsongaSourcePair => ({
  sourceEnglish,
  xitsongaDraft,
  reviewStatus,
});

const hold = (sourceEnglish: string): XitsongaSourcePair => pair(sourceEnglish, sourceEnglish, 'hold');
const l3SourceBody = 'Cover bare soil with suitable clean mulch, such as straw, dry grass or wood chips.\n\nMulch can reduce evaporation, soften the impact of rain and suppress weeds.\n\nKeep it clear of trunks and stems. Check moisture underneath and adjust the layer; more mulch is not always better.\n\nCover crops can protect ground between main crops. Choose for local weather, available water and the next planting.\n\nThe course examples include oats, lupins, sunn hemp and cowpea. Check local suitability before sowing.\n\nLegumes need suitable bacteria and growing conditions to fix nitrogen. Nutrients in their residues become available as the material decomposes.\n\nWorm farms can turn suitable food scraps and bedding into castings. Check the bin rather than expecting a fixed harvest date.\n\nLiquid that drains naturally from a worm bin is called leachate. It is not the same as a prepared worm-casting tea.\n\nLeachate can contain harmful organisms or substances. Do not use it on edible plants or assume that dilution makes it safe.\n\nA Highveld field left bare after the maize harvest faces two main risks.\n\nWinter wind can carry away dry topsoil.\n\nThe first heavy spring storm can strike bare ground and damage its surface and structure. If water runs over the field, it can carry loosened soil away.\n\nCover crops, mulch, and organic matter can help hold soil in place and help it stay alive.';
const l3SourceParagraphs = l3SourceBody.split('\n\n');
const l3DraftParagraphs = [...l3SourceParagraphs];
l3DraftParagraphs[9] = 'Nsimu ya Highveld leyi tshikiweke yi nga funengetiwangi endzhaku ka ntshovelo wa maize yi langutana ni makhombo mambirhi lamakulu.';
l3DraftParagraphs[10] = 'Mheho wa xixika wu nga susa misava ya le henhla leyi omeke.';
l3DraftParagraphs[11] = 'Xidzedze xo sungula xo tika xa ximun’wana xi nga hlasela misava leyi nga funengetiwangi, xi onha vuandlalo ni xivumbeko xa yona. Loko mati ma khuluka ehenhla ka nsimu, ma nga teka misava leyi ntshunxekeke ma famba na yona.';

const sourceBody = 'Soil contains many kinds of living organisms. Bacteria and fungi help break down organic matter and cycle nutrients.\n\nSome fungi help roots take up nutrients. Worm channels can help water and air enter soil.\n\nLook at roots, soil structure and water movement as well as visible soil life.\n\nPut soil and water in a clear jar, with a little suitable dispersing detergent. Close and shake it, then leave it undisturbed.\n\nSand settles first. Silt settles next, while clay can remain suspended much longer.\n\nThis is a rough learning exercise. Clumps and unsettled clay can mislead you; use a soil laboratory when accurate texture is needed.\n\nA thick sand layer beneath cloudy water does not yet tell you the final proportions. Some fine particles may still be suspended.\n\nCompare the settled layers and feel the soil in the field.\n\nRecord what you see and what remains uncertain. Do not prescribe watering or soil treatments from one jar alone.\n\nCompaction, poor drainage and loss of organic matter can limit roots and soil life.\n\nPale colour or few worms do not prove that chemicals killed the soil. Worm activity also changes with moisture and season.\n\nLook for patterns across the field. Check management history, drainage and plant growth before choosing a remedy.';
const sourceParagraphs = sourceBody.split('\n\n');
const draftParagraphs = [...sourceParagraphs];
draftParagraphs[0] = 'Misava yi na tinxaka to tala ta swilo leswi hanyaka. Bacteria and fungi help break down organic matter and cycle nutrients.';
draftParagraphs[1] = "Fungi tin'wana ti pfuna timitsu ku tswonga nutrients. Worm channels ti nga pfuna mati na moya ku nghena emhlabeni.";
draftParagraphs[2] = 'Languta timitsu, xivumbeko xa misava ni ndlela leyi mati ma fambaka ha yona, swin’we ni leswi hanyaka emisaveni leswi u swi vonaka.';
draftParagraphs[7] = "Fananisa swiyenge leswi tshamaka ehansi, kutani u twa misava ensin'wini.";
draftParagraphs[8] = 'Tsala leswi u swi vonaka ni leswi nga si tiyiseka. U nga teki xiboho xa ku cheleta kumbe ku tirhisa ndlela yo lulamisa misava hi ku ya hi jar yin’we ntsena.';

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
      infographicAlt: hold('A soil cross-section shows dark topsoil above pale subsoil, with two worms. Beside it, a jar of soil settles into three layers — sand, silt and clay.'),
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
    {
      id: 'soil-health-l3',
      infographicAlt: hold('Two patches of soil under the same sun: bare ground cracked and dry, mulched ground still dark and moist.'),
      title: hold('Mulching and Cover Crops: Protecting and Building Soil'),
      body: pair(l3SourceBody, l3DraftParagraphs.join('\n\n')),
      keyPoints: [
        hold('Protect exposed soil with suitable cover'),
        hold('Keep mulch away from trunks and stems'),
        hold('Choose cover crops for local water, weather and the following crop'),
        hold('Worm-bin leachate is not automatically safe fertiliser; keep it off edible plants'),
      ],
      quiz: [
        {
          question: hold('A Highveld farmer harvests maize in April and leaves the field bare all winter. What are the two main risks?'),
          options: [
            hold('Overheating in winter sun and waterlogging from rain'),
            hold('Frost kills soil life and weeds take over early'),
            hold('Wind erosion of dry topsoil and loss of soil structure from spring storm impact'),
            hold('Soil pH drops and nitrogen builds up'),
          ],
          sourceCorrectIndex: 2,
          rationale: hold('Bare soil is exposed to winter wind, which can carry away dry topsoil. Raindrop impact can damage the surface; where water runs over the field, it can carry loosened soil away.'),
        },
        {
          question: hold('What should you remember about liquid draining from a worm bin?'),
          options: [
            hold('It is always safe on salad leaves'),
            hold('It can contain harmful organisms or substances; dilution is not a safety guarantee'),
            hold('It is identical to finished worm castings'),
            hold('A fixed dilution makes every liquid safe'),
          ],
          sourceCorrectIndex: 1,
          rationale: hold('Leachate is liquid that drains naturally from a worm bin. Its composition varies, so it must not be presented as a guaranteed safe feed for edible crops.'),
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
    { lessonId: 'soil-health-l3', field: 'body[0-8]', sourceText: l3SourceParagraphs.slice(0, 9).join('\n\n'), reason: 'Mulch, cover-crop and worm-bin advice stays exact English; only the screened seasonal erosion risks are drafted.' },
    { lessonId: 'soil-health-l3', field: 'body[12]', sourceText: l3SourceParagraphs[12], reason: 'The closing soil-cover advice stays exact English.' },
  ],
};

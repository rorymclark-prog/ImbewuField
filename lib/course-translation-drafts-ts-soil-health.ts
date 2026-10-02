/** Unreviewed source-paired Xitsonga drafts for all three Soil Health lessons. */
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
l3DraftParagraphs[0] = 'Funengetani misava leyi nga hava cover hi mulch leyi basekile, leyi faneleke, yo fana na straw, byanyi byo oma kumbe wood chips.';
l3DraftParagraphs[1] = 'Mulch yi nga hunguta evaporation; yi nga olovisa ku ba ka mpfula naswona yi nga suppress weeds.';
l3DraftParagraphs[2] = 'Keep it clear of trunks and stems. Kambelani moisture ehansi ka yona, mi lulamisa layer; mulch yo tala a yi vuli leswaku swi ta antswa nkarhi wun\'wana ni wun\'wana.';
l3DraftParagraphs[3] = 'Cover crops ti nga sirhelela misava leyi nga kona between main crops. Ti hlawuleni hi ku ya hi weather ya laha, mati lama kumekaka ni next planting.';
l3DraftParagraphs[4] = 'Swikombiso swa course swi katsa oats, lupins, sunn hemp na cowpea. Kambelani loko swi fanele ndhawu ya kwalaho mi nga si swi byala.';
l3DraftParagraphs[5] = 'Legumes ti lava bacteria leti faneleke ni suitable growing conditions leswaku ti fix nitrogen. Nutrients leti nga eka masalela ya tona ta kumeka loko material yi ri karhi yi bola.';
l3DraftParagraphs[6] = 'Worm farms ti nga hundzuluxa food scraps ni bedding leswi faneleke swi va castings. Kambelani bin ematshan\'weni yo langutela fixed harvest date.';
l3DraftParagraphs[7] = 'Liquid that drains naturally from a worm bin yi vuriwa leachate. A yi fani na prepared worm-casting tea.';
l3DraftParagraphs[8] = 'Leachate yi nga va na harmful organisms kumbe substances. Do not use it on edible plants or assume that dilution makes it safe.';
l3DraftParagraphs[12] = 'Cover crops, mulch ni organic matter swi nga pfuna ku khoma misava endhawini ya yona ni ku yi pfuna leswaku yi ya mahlweni yi hanya.';

const l2SourceBody = 'Compost is organic matter broken down under managed conditions.\n\nFinished compost can improve soil structure and contribute nutrients.\n\nTime to readiness varies with materials, moisture, air and temperature. A province name or a fixed number of weeks is not a readiness test.\n\nMix dry browns with fresh greens. Avoid thick, wet layers that keep air out.\n\nIf the heap becomes slimy or smells strongly of ammonia, add dry browns and turn it.\n\nCheck moisture and air as the heap changes; one recipe does not suit every mix of materials.\n\nA hot centre does not prove that every part of a heap has been treated. Time, temperature and management all matter.\n\nKeep meat, dairy, diseased plants, pet waste and contaminated materials out of this simple household system.\n\nDo not assume home composting destroys every weed seed or disease organism. Use a recognised process where sanitation is required.\n\nKeep wattle seed pods out of the compost heap. An ordinary heap may not make every seed non-viable.\n\nUse only clean, untreated materials. Bark breaks down slowly; its name alone is not proof that it is free of contamination.\n\nCheck the heap and turn when it needs more air or mixing. Keep it moist rather than waterlogged.';
const l2DraftBody = [
  'Compost i organic matter leyi broken down ehansi ka managed conditions.',
  'Finished compost yi nga antswisa xivumbeko xa misava ni ku contribute nutrients.',
  'Nkarhi wo lungheka wa hambana hi materials, moisture, air na temperature. Vito ra province kumbe nhlayo leyi vekiweke ya mavhiki a hi readiness test.',
  'Hlanganisa dry browns na fresh greens. Papalata thick, wet layers leti sivelaka air ku nghena.',
  "Loko heap yi va slimy kumbe yi nun'hwa ammonia swinene, engetela dry browns kutani u yi turn.",
  "Kambela moisture na air loko heap yi ri karhi yi cinca; recipe yin'we a yi ringani eka nkatsakanyo wun'wana ni wun'wana wa materials.",
  'Hot centre ya heap a yi tiyisisi leswaku every part ya heap yi treated. Time, temperature and management all matter.',
  'Hlayisani meat, dairy, diseased plants, pet waste na contaminated materials swi ri ehandle ka simple household system.',
  "U nga teki leswaku home composting yi lovisa weed seed yin'wana ni yin'wana kumbe disease organism yin'wana ni yin'wana. Tirhisa recognised process laha sanitation yi lavekaka.",
  "Hlayisani wattle seed pods ehandle ka compost heap. An ordinary heap may not make every seed non-viable.",
  'Tirhisa clean, untreated materials ntsena. Bark breaks down slowly; vito ra yona ntsena a hi vumbhoni bya leswaku a yi na contamination.',
  'Kambela heap kutani u yi turn loko yi lava air yo tala kumbe mixing. Yi hlayise yi ri moist, ku nga ri waterlogged.',
].join('\n\n');

const sourceBody = 'Soil contains many kinds of living organisms. Bacteria and fungi help break down organic matter and cycle nutrients.\n\nSome fungi help roots take up nutrients. Worm channels can help water and air enter soil.\n\nLook at roots, soil structure and water movement as well as visible soil life.\n\nPut soil and water in a clear jar, with a little suitable dispersing detergent. Close and shake it, then leave it undisturbed.\n\nSand settles first. Silt settles next, while clay can remain suspended much longer.\n\nThis is a rough learning exercise. Clumps and unsettled clay can mislead you; use a soil laboratory when accurate texture is needed.\n\nA thick sand layer beneath cloudy water does not yet tell you the final proportions. Some fine particles may still be suspended.\n\nCompare the settled layers and feel the soil in the field.\n\nRecord what you see and what remains uncertain. Do not prescribe watering or soil treatments from one jar alone.\n\nCompaction, poor drainage and loss of organic matter can limit roots and soil life.\n\nPale colour or few worms do not prove that chemicals killed the soil. Worm activity also changes with moisture and season.\n\nLook for patterns across the field. Check management history, drainage and plant growth before choosing a remedy.';
const sourceParagraphs = sourceBody.split('\n\n');
const draftParagraphs = [...sourceParagraphs];
draftParagraphs[0] = 'Misava yi na tinxaka to tala ta swilo leswi hanyaka. Bacteria na fungi swi pfuna ku fayelela organic matter ni ku cycle nutrients.';
draftParagraphs[1] = "Fungi tin'wana ti pfuna timitsu ku tswonga nutrients. Worm channels ti nga pfuna mati na moya ku nghena emhlabeni.";
draftParagraphs[2] = 'Languta timitsu, xivumbeko xa misava ni ndlela leyi mati ma fambaka ha yona, swin’we ni leswi hanyaka emisaveni leswi u swi vonaka.';
draftParagraphs[3] = 'Chela misava na mati eka clear jar, u chela nyana suitable dispersing detergent. Pfala jar u yi ninginika, kutani u yi tshika yi nga ninginiki.';
draftParagraphs[4] = 'Sand yi sungula ku tshamisa ehansi. Silt yi tshamisa endzhaku ka yona, kasi clay yi nga ha sala yi suspended much longer.';
draftParagraphs[5] = 'Lowu i rough learning exercise. Clumps na clay leyi nga si tshamaka ehansi swi nga ku hambukisa; tirhisa soil laboratory loko ku laveka accurate soil texture.';
draftParagraphs[6] = 'Thick sand layer ehansi ka cloudy water a yi si komba final proportions. Fine particles tin’wana ti nga ha va suspended.';
draftParagraphs[7] = "Fananisa swiyenge leswi tshamaka ehansi, kutani u twa misava ensin'wini.";
draftParagraphs[8] = 'Tsala leswi u swi vonaka ni leswi nga si tiyiseka. U nga teki xiboho xa ku cheleta kumbe ku tirhisa ndlela yo lulamisa misava hi ku ya hi jar yin’we ntsena.';
draftParagraphs[9] = 'Compaction, poor drainage na ku lahleka ka organic matter can limit timitsu ni soil life.';
draftParagraphs[10] = 'Muhlovo lowu nga vonakaka wa pale kumbe few worms a swi tiyisisi leswaku chemicals ti dlayile misava. Worm activity na yona ya cinca hi ku ya hi moisture na season.';
draftParagraphs[11] = 'Languta patterns leti humelelaka ensin\'wini hinkwaro. Kambela management history, drainage ni ku kula ka swimilani u nga si hlawula remedy.';

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
        pair('Use several clues to assess soil condition', 'Tirhisa swikombiso swo hlayanyana ku kambela xiyimo xa misava.'),
        pair('Soil colour and worm counts alone do not diagnose the cause of a problem', 'Muhlovo wa misava ni ku hlayela worms ntsena a swi diagnose cause ya problem.'),
        pair('A jar exercise gives a rough indication of texture, not a complete soil test', 'Jar exercise yi nyika rough indication ya texture, a hi complete soil test.'),
        pair('Check drainage, roots and management history before choosing a remedy', 'Kambela drainage, timitsu na management history u nga si hlawula remedy.'),
      ],
      quiz: [
        {
          question: pair('A soil jar still has cloudy water above the sand layer. What should the farmer conclude?', 'Jar ya misava ya ha ri na cloudy water ehenhla ka sand layer. Murimi u fanele ku gimeta hi yini?'),
          options: [
            pair('The soil definitely needs less water', 'Misava yi lava less water hakunene'),
            pair('Fine particles may still be suspended; more observation is needed', 'Fine particles ti nga ha va suspended; ku laveka ku languta nakambe'),
            pair('All the clay has already settled', 'Clay hinkwaro se yi tshamile ehansi'),
            pair('The crop definitely needs gypsum', 'Crop yi lava gypsum hakunene'),
          ],
          sourceCorrectIndex: 1,
          rationale: pair('Cloudy water can contain unsettled fine particles. One early observation cannot establish the final proportions or the right treatment.', 'Cloudy water yi nga va na fine particles leti nga se tshamaka ehansi. Observation yin\'we ya le masungulweni a yi koti ku tiyisisa final proportions kumbe right treatment.'),
        },
        {
          question: pair('A farmer finds compacted soil and few worms. What is the useful next step?', 'Murimi u kuma misava leyi compacted ni worms ti nga ri tingani. Hi wihi mohato lowu landzelaka wu nga pfunaka?'),
          options: [
            pair('Assume every soil organism has died', 'Ehleketa leswaku soil organism yin\'wana ni yin\'wana yi file'),
            pair('Add a treatment without checking the site', 'Engetela treatment handle ko kambela site'),
            pair('Check drainage, roots, moisture and management history', 'Kambela drainage, timitsu, moisture ni management history'),
            pair('Give up because the soil cannot improve', 'Tshika hikuva misava a yi nge antswi'),
          ],
          sourceCorrectIndex: 2,
          rationale: pair('Several observations help identify a problem. Worm activity varies with conditions, so few worms alone do not establish its cause.', 'Ku endla observations to tala swi pfuna ku kuma problem. Worm activity yi cinca hi conditions, hikokwalaho worms ti nga ri tingani ntsena a ti kombisi cause ya yona.'),
        },
      ],
    },
    {
      id: 'soil-health-l2',
      infographicAlt: hold('A compost heap cut open, showing alternating layers of dry brown material and fresh green material, heat rising from the middle, and an arrow showing it being turned.'),
      title: hold('Making and Using Compost'),
      body: pair(l2SourceBody, l2DraftBody),
      keyPoints: [
        hold('Balance browns, greens, moisture and air'),
        hold('A hot centre does not prove the whole heap is sanitised'),
        hold('Keep seed pods and contaminated materials out'),
        hold('Judge readiness from the compost condition, not a fixed regional timetable'),
      ],
      quiz: [
        {
          question: hold("A farmer's compost heap smells strongly of ammonia and is wet and slimy. What's the fix?"),
          options: [
            hold('Add more nitrogen-rich green material'),
            hold('Add more dry carbon material like straw and turn the heap'),
            hold('Stop turning it and let it cool'),
            hold("Add more water — the smell means it's too dry"),
          ],
          sourceCorrectIndex: 1,
          rationale: hold('A wet, slimy heap may need more air and drier material. Add dry browns and turn the heap to open it up. An ammonia smell can also suggest too much nitrogen-rich material. Check that the heap stays damp, not soggy.'),
        },
        {
          question: hold('Why keep wattle seed pods out of an ordinary compost heap?'),
          options: [
            hold('Bark makes every heap too hot'),
            hold('Some seeds may survive and spread when the compost is used'),
            hold('Pods always attract termites'),
            hold('Pods release a gas that kills every soil organism'),
          ],
          sourceCorrectIndex: 1,
          rationale: hold('An ordinary heap may not expose every seed to conditions that make it non-viable. Excluding pods avoids spreading them with the compost.'),
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
  holds: [],
};

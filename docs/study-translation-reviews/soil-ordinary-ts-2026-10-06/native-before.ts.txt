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
l3DraftParagraphs[0] = "Funengetani misava leyi nga funengetiwangiki hi mulch leyi basekile, leyi faneleke, yo fana na straw, byanyi byo oma kumbe wood chips.";
l3DraftParagraphs[1] = "Mulch yi nga hunguta evaporation; yi nga olovisa ku ba ka mpfula naswona yi nga sivela nhova.";
l3DraftParagraphs[2] = "Yi hlayiseni ekule na trunks and stems. Kambelani ku tsakama ehansi ka yona, mi lulamisa layer; mulch yo tala a yi vuli leswaku swi ta antswa nkarhi wun'wana ni wun'wana.";
l3DraftParagraphs[3] = "Cover crops ti nga sirhelela misava leyi nga kona exikari ka main crops. Ti hlawuleni hi ku ya hi maxelo ya laha, mati lama kumekaka ni ku byala loku landzelaka.";
l3DraftParagraphs[4] = "Swikombiso swa dyondzo swi katsa oats, lupins, sunn hemp na cowpea. Kambelani loko swi fanele ndhawu ya kwalaho mi nga si swi byala.";
l3DraftParagraphs[5] = "Legumes ti lava bacteria leti faneleke ni swiyimo leswi faneleke swa ku kula leswaku ti fix nitrogen. Nutrients leti nga eka masalela ya tona ta kumeka loko material yi ri karhi yi bola.";
l3DraftParagraphs[6] = "Worm farms ti nga hundzuluxa food scraps ni bedding leswi faneleke swi va castings. Kambelani xibye ematshan'weni yo langutela siku ra ntshovelo leri vekiweke.";
l3DraftParagraphs[7] = "Liquid leyi khulukaka hi ntumbuluko yi huma eka worm bin yi vuriwa leachate. A yi fani na worm-casting tea leyi lunghisiweke.";
l3DraftParagraphs[8] = "Leachate yi nga va na harmful organisms kumbe substances leswi nga ni khombo. U nga yi tirhisi eka edible plants. U nga ehleketi leswaku dilution yi endla leswaku yi hlayiseka.";
l3DraftParagraphs[12] = 'Cover crops, mulch ni organic matter swi nga pfuna ku khoma misava endhawini ya yona ni ku yi pfuna leswaku yi ya mahlweni yi hanya.';

const l2SourceBody = 'Compost is organic matter broken down under managed conditions.\n\nFinished compost can improve soil structure and contribute nutrients.\n\nTime to readiness varies with materials, moisture, air and temperature. A province name or a fixed number of weeks is not a readiness test.\n\nMix dry browns with fresh greens. Avoid thick, wet layers that keep air out.\n\nIf the heap becomes slimy or smells strongly of ammonia, add dry browns and turn it.\n\nCheck moisture and air as the heap changes; one recipe does not suit every mix of materials.\n\nA hot centre does not prove that every part of a heap has been treated. Time, temperature and management all matter.\n\nKeep meat, dairy, diseased plants, pet waste and contaminated materials out of this simple household system.\n\nDo not assume home composting destroys every weed seed or disease organism. Use a recognised process where sanitation is required.\n\nKeep wattle seed pods out of the compost heap. An ordinary heap may not make every seed non-viable.\n\nUse only clean, untreated materials. Bark breaks down slowly; its name alone is not proof that it is free of contamination.\n\nCheck the heap and turn when it needs more air or mixing. Keep it moist rather than waterlogged.';
const l2DraftBody = [
  "Compost i organic matter leyi broken down ehansi ka swiyimo leswi lawuriwaka.",
  "Compost leyi lunghekeke yi nga antswisa xivumbeko xa misava ni ku engetela nutrients.",
  "Nkarhi wo lungheka wa hambana hi swilo leswi tirhisiweke, ku tsakama, moya na temperature. Vito ra xifundzankulu kumbe nhlayo leyi vekiweke ya mavhiki a hi readiness test.",
  "Hlanganisa dry browns na fresh greens. Papalata thick layers leti tsakamaka leti sivelaka moya ku nghena.",
  "Loko nhulu yi va slimy kumbe yi nun'hwa ammonia swinene, engetela dry browns kutani u yi hundzuluxa.",
  "Kambela ku tsakama na moya loko nhulu yi ri karhi yi cinca; ndlela yin'we yo hlanganisa a yi ringani eka nkatsakanyo wun'wana ni wun'wana wa swilo leswi tirhisiweke.",
  "Xiphemu xa le xikarhini xa nhulu lexi hisaka a xi tiyisisi leswaku xiphemu xin’wana ni xin’wana xa nhulu xi treated. Nkarhi, temperature ni ndlela yo yi lawula hinkwato swi na nkoka.",
  "Hlayisani nyama, dairy, swimilani leswi vabyaka, pet waste na contaminated materials swi ri ehandle ka ndlela leyi olovaka ya ndyangu.",
  "U nga teki leswaku home composting yi lovisa weed seed yin'wana ni yin'wana kumbe disease organism yin'wana ni yin'wana. Tirhisa recognised process laha sanitation yi lavekaka.",
  "Hlayisani wattle seed pods ehandle ka nhulu ya compost. Nhulu leyi tolovelekeke yi nga ha ka yi nga endli mbewu yin’wana ni yin’wana yi va non-viable.",
  "Tirhisa clean, untreated materials ntsena. Bark yi bola hi ku nonoka; vito ra yona ntsena a hi vumbhoni bya leswaku a yi na contamination.",
  "Kambela nhulu kutani u yi hundzuluxa loko yi lava moya wo tala kumbe ku hlanganisiwa. Yi hlayise yi tsakamile, ku nga ri waterlogged.",
].join('\n\n');

const sourceBody = 'Soil contains many kinds of living organisms. Bacteria and fungi help break down organic matter and cycle nutrients.\n\nSome fungi help roots take up nutrients. Worm channels can help water and air enter soil.\n\nLook at roots, soil structure and water movement as well as visible soil life.\n\nPut soil and water in a clear jar, with a little suitable dispersing detergent. Close and shake it, then leave it undisturbed.\n\nSand settles first. Silt settles next, while clay can remain suspended much longer.\n\nThis is a rough learning exercise. Clumps and unsettled clay can mislead you; use a soil laboratory when accurate texture is needed.\n\nA thick sand layer beneath cloudy water does not yet tell you the final proportions. Some fine particles may still be suspended.\n\nCompare the settled layers and feel the soil in the field.\n\nRecord what you see and what remains uncertain. Do not prescribe watering or soil treatments from one jar alone.\n\nCompaction, poor drainage and loss of organic matter can limit roots and soil life.\n\nPale colour or few worms do not prove that chemicals killed the soil. Worm activity also changes with moisture and season.\n\nLook for patterns across the field. Check management history, drainage and plant growth before choosing a remedy.';
const sourceParagraphs = sourceBody.split('\n\n');
const draftParagraphs = [...sourceParagraphs];
draftParagraphs[0] = "Misava yi na tinxaka to tala ta swilo leswi hanyaka. Bacteria na fungi swi pfuna ku break down organic matter ni ku cycle nutrients.";
draftParagraphs[1] = "Fungi tin'wana ti pfuna timitsu ku tswonga nutrients. Worm channels ti nga pfuna mati na moya ku nghena emhlabeni.";
draftParagraphs[2] = 'Languta timitsu, xivumbeko xa misava ni ndlela leyi mati ma fambaka ha yona, swin’we ni leswi hanyaka emisaveni leswi u swi vonaka.';
draftParagraphs[3] = "Chela misava na mati eka jar leyi u vonaka leswi nga endzeni ka yona, u chela nyana suitable dispersing detergent. Pfala jar u yi ninginika, kutani u yi tshika yi nga ninginiki.";
draftParagraphs[4] = "Sand yi sungula ku tshamisa ehansi. Silt yi tshamisa endzhaku ka yona, kasi clay yi nga ha sala yi suspended nkarhi wo leha swinene.";
draftParagraphs[5] = "Lowu i ntoloveto wo dyondza wo ringanyeta. Clumps na clay leyi nga si tshamaka ehansi swi nga ku hambukisa; tirhisa soil laboratory loko ku laveka soil texture leyi pimiweke kahle.";
draftParagraphs[6] = 'Thick sand layer ehansi ka cloudy water a yi si komba final proportions. Fine particles tin’wana ti nga ha va suspended.';
draftParagraphs[7] = "Fananisa settled layers, kutani u twa misava ensin'wini.";
draftParagraphs[8] = 'Tsala leswi u swi vonaka ni leswi nga si tiyiseka. U nga teki xiboho xa ku cheleta kumbe ku tirhisa ndlela yo lulamisa misava hi ku ya hi jar yin’we ntsena.';
draftParagraphs[9] = "Compaction, poor drainage na ku lahleka ka organic matter swi nga limit timitsu ni soil life.";
draftParagraphs[10] = "Muhlovo lowu nga vonakaka wa pale kumbe worms ti nga ri tingani a swi tiyisisi leswaku chemicals ti dlayile misava. Worm activity na yona ya cinca hi ku ya hi ku tsakama na nguva.";
draftParagraphs[11] = "Languta patterns leti humelelaka ensin'wini hinkwaro. Kambela management history, drainage ni ku kula ka swimilani u nga si hlawula ndlela yo lulamisa.";

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
      infographicAlt: { sourceEnglish: "A soil cross-section shows dark topsoil above pale subsoil, with two worms. Beside it, a jar of soil settles into three layers — sand, silt and clay.", xitsongaDraft: "Xiyenge xa misava lexi tsemiweke xi komba dark topsoil ehenhla ka pale subsoil, xi ri na worms timbirhi. Etlhelo ka xona: the soil in the jar settles into three layers — sand, silt na clay.", reviewStatus: 'machine-draft' },
      title: pair('Understanding Your Soil: The Foundation of Everything', 'Ku twisisa misava ya wena: Masungulo ya swilo hinkwawo'),
      body: pair(sourceBody, draftParagraphs.join('\n\n')),
      keyPoints: [
        pair('Use several clues to assess soil condition', 'Tirhisa swikombiso swo hlayanyana ku kambela xiyimo xa misava.'),
        pair('Soil colour and worm counts alone do not diagnose the cause of a problem', "Muhlovo wa misava ni ku hlayela worms ntsena a swi diagnose xivangelo xa xiphiqo."),
        pair('A jar exercise gives a rough indication of texture, not a complete soil test', "Ntoloveto wa jar wu nyika nkombiso wo ringanyeta wa texture, a hi soil test leyi heleleke."),
        pair('Check drainage, roots and management history before choosing a remedy', "Kambela drainage, timitsu na management history u nga si hlawula ndlela yo lulamisa."),
      ],
      quiz: [
        {
          question: pair('A soil jar still has cloudy water above the sand layer. What should the farmer conclude?', 'Jar ya misava ya ha ri na cloudy water ehenhla ka sand layer. Murimi u fanele ku gimeta hi yini?'),
          options: [
            pair('The soil definitely needs less water', "Misava yi lava mati lama hunguteke hakunene"),
            pair('Fine particles may still be suspended; more observation is needed', 'Fine particles ti nga ha va suspended; ku laveka ku languta nakambe'),
            pair('All the clay has already settled', 'Clay hinkwaro se yi tshamile ehansi'),
            pair('The crop definitely needs gypsum', "Xibyariwa xi lava gypsum hakunene"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair('Cloudy water can contain unsettled fine particles. One early observation cannot establish the final proportions or the right treatment.', "Cloudy water yi nga va na fine particles leti nga se tshamaka ehansi. Ku languta kan'we le masungulweni a ku koti ku tiyisisa final proportions kumbe treatment leyi faneleke."),
        },
        {
          question: pair('A farmer finds compacted soil and few worms. What is the useful next step?', "Murimi u kuma misava leyi compacted ni worms ti nga ri tingani. Hi rihi goza leri landzelaka leri nga pfunaka?"),
          options: [
            pair('Assume every soil organism has died', 'Ehleketa leswaku soil organism yin\'wana ni yin\'wana yi file'),
            pair('Add a treatment without checking the site', "Engetela treatment handle ko kambela ndhawu"),
            pair('Check drainage, roots, moisture and management history', "Kambela drainage, timitsu, ku tsakama ni management history"),
            pair('Give up because the soil cannot improve', 'Tshika hikuva misava a yi nge antswi'),
          ],
          sourceCorrectIndex: 2,
          rationale: pair('Several observations help identify a problem. Worm activity varies with conditions, so few worms alone do not establish its cause.', "Ku languta swilo swo hlayanyana swi pfuna ku kuma xiphiqo. Worm activity yi cinca hi swiyimo, hikokwalaho worms ti nga ri tingani ntsena a ti kombisi xivangelo xa xona."),
        },
      ],
    },
    {
      id: 'soil-health-l2',
      infographicAlt: pair('A compost heap cut open, showing alternating layers of dry brown material and fresh green material, heat rising from the middle, and an arrow showing it being turned.', 'Heap ya compost cut open, yi komba alternating layers ta dry brown material na fresh green material; ku hisa ku tlakuka ku suka exikarhini, naswona arrow yi komba leswaku heap ya hundzuluxiwa.'),
      title: pair('Making and Using Compost', 'Ku Endla ni Ku Tirhisa Compost'),
      body: pair(l2SourceBody, l2DraftBody),
      keyPoints: [
        pair('Balance browns, greens, moisture and air', "Ringanisa browns, greens, ku tsakama ni moya."),
        pair('A hot centre does not prove the whole heap is sanitised', "Xiphemu xa le xikarhini lexi hisaka a xi tiyisisi leswaku nhulu hinkwayo yi sanitised."),
        pair('Keep seed pods and contaminated materials out', "Hlayisa seed pods na contaminated materials swi ri handle ka nhulu."),
        pair('Judge readiness from the compost condition, not a fixed regional timetable', "Kambela ku lungheka ka compost hi xiyimo xa yona, ku nga ri hi regional timetable leyi vekiweke."),
      ],
      quiz: [
        {
          question: pair("A farmer's compost heap smells strongly of ammonia and is wet and slimy. What's the fix?", "Nhulu ya compost ya murimi yi nun'hwa ammonia swinene naswona yi tsakama yi tlhela yi va slimy. Ku lulamisa i yini?"),
          options: [
            pair('Add more nitrogen-rich green material', 'Engetela green material yo tala leyi fuweke hi nitrogen'),
            pair('Add more dry carbon material like straw and turn the heap', "Engetela dry carbon material yo tala yo fana na straw kutani u hundzuluxa nhulu"),
            pair('Stop turning it and let it cool', "Tshika ku hundzuluxa nhulu kutani u yi tshika yi hola"),
            pair("Add more water — the smell means it's too dry", 'Engetela mati yo tala — nun\'hwelo wu vula leswaku yi omile ngopfu'),
          ],
          sourceCorrectIndex: 1,
          rationale: pair('A wet, slimy heap may need more air and drier material. Add dry browns and turn the heap to open it up. An ammonia smell can also suggest too much nitrogen-rich material. Check that the heap stays damp, not soggy.', "Nhulu leyi tsakamaka, yi slimy yi nga lava moya wo tala na swilo swo oma ku tlurisa leswi nga kona. Engetela dry browns kutani u hundzuluxa nhulu leswaku yi pfuleka. Nun'hwelo wa ammonia na wona wu nga komba nitrogen-rich material yo tala ngopfu. Kambela leswaku nhulu yi sala yi tsakamile, ku nga ri soggy."),
        },
        {
          question: pair('Why keep wattle seed pods out of an ordinary compost heap?', "Ha yini u fanele ku hlayisa wattle seed pods handle ka nhulu ya compost leyi tolovelekeke?"),
          options: [
            pair('Bark makes every heap too hot', "Bark yi endla leswaku nhulu yin'wana ni yin'wana yi hisa ngopfu"),
            pair('Some seeds may survive and spread when the compost is used', 'Mbewu tin\'wana ti nga ha pona kutani ti hangalaka loko compost yi tirhisiwa'),
            pair('Pods always attract termites', 'Pods ti koka termites minkarhi hinkwayu'),
            pair('Pods release a gas that kills every soil organism', 'Pods ti humesa gas leyi dlayaka soil organism yin\'wana ni yin\'wana'),
          ],
          sourceCorrectIndex: 1,
          rationale: pair('An ordinary heap may not expose every seed to conditions that make it non-viable. Excluding pods avoids spreading them with the compost.', "Nhulu leyi tolovelekeke yi nga ha ka yi nga fikisi mbewu yin’wana ni yin’wana eka swiyimo leswi yi endlaka yi va non-viable. Ku susa pods swi papalata ku ti hangalasa na compost."),
        },
      ],
    },
    {
      id: 'soil-health-l3',
      infographicAlt: pair('Two patches of soil under the same sun: bare ground cracked and dry, mulched ground still dark and moist.', 'Swiphemu swimbirhi swa misava ehansi ka dyambu rin\'we: misava leyi nga funengetiwangi yi pandzekile naswona yi omile; misava leyi nga na mulch ya ha ri ya ntima naswona yi tsakamile.'),
      title: pair('Mulching and Cover Crops: Protecting and Building Soil', 'Ku Tirhisa Mulch na Cover Crops: Ku Sirhelela Misava na Building Soil'),
      body: pair(l3SourceBody, l3DraftParagraphs.join('\n\n')),
      keyPoints: [
        pair('Protect exposed soil with suitable cover', "Sirhelela misava leyi paluxiweke hi swilo leswi faneleke swo yi funengeta."),
        pair('Keep mulch away from trunks and stems', 'Hlayisa mulch ekule na trunks na stems.'),
        pair('Choose cover crops for local water, weather and the following crop', "Hlawula cover crops hi ku ya hi mati ya laha, maxelo ni crop leyi landzelaka."),
        pair('Worm-bin leachate is not automatically safe fertiliser; keep it off edible plants', "Worm-bin leachate a yi fanelanga ku tekiwa yi ri fertiliser leyi hlayisekeke hi yoxe; yi hlayise ekule na edible plants."),
      ],
      quiz: [
        {
          question: pair('A Highveld farmer harvests maize in April and leaves the field bare all winter. What are the two main risks?', "Murimi wa Highveld u tshovela maize hi April kutani a siya nsimu yi nga funengetiwangi xixika hinkwaxo. Hi wahi makhombo mambirhi lamakulu?"),
          options: [
            pair('Overheating in winter sun and waterlogging from rain', "Ku hisa ngopfu ehansi ka dyambu ra xixika ni waterlogging leyi vangiwaka hi mpfula"),
            pair('Frost kills soil life and weeds take over early', "Frost yi dlaya soil life naswona nhova yi talela ndhawu ka ha ri eku sunguleni"),
            pair('Wind erosion of dry topsoil and loss of soil structure from spring storm impact', 'Wind erosion ya dry topsoil ni ku lahlekeriwa hi soil structure hi ku ba ka spring storm'),
            pair('Soil pH drops and nitrogen builds up', 'Soil pH ya hunguteka naswona nitrogen ya hlengeletana'),
          ],
          sourceCorrectIndex: 2,
          rationale: pair('Bare soil is exposed to winter wind, which can carry away dry topsoil. Raindrop impact can damage the surface; where water runs over the field, it can carry loosened soil away.', "Misava leyi nga funengetiwangi yi va erivaleni eka mheho wa xixika, lowu nga susaka dry topsoil. Ku ba ka marhonsi ya mpfula ku nga onha vuandlalo; laha mati ma khulukaka ehenhla ka nsimu, ma nga teka misava leyi ntshunxekeke ma yi susa."),
        },
        {
          question: pair('What should you remember about liquid draining from a worm bin?', "U fanele ku tsundzuka yini hi liquid leyi khulukaka yi huma eka worm bin?"),
          options: [
            pair('It is always safe on salad leaves', 'Yi hlayisekile minkarhi hinkwayu eka salad leaves'),
            pair('It can contain harmful organisms or substances; dilution is not a safety guarantee', "Yi nga va na harmful organisms kumbe substances leswi nga ni khombo; dilution a hi safety guarantee"),
            pair('It is identical to finished worm castings', 'Yi fana hi ku helela na finished worm castings'),
            pair('A fixed dilution makes every liquid safe', 'Dilution yo karhi leyi vekiweke yi endla leswaku liquid yin\'wana ni yin\'wana yi hlayiseka'),
          ],
          sourceCorrectIndex: 1,
          rationale: pair('Leachate is liquid that drains naturally from a worm bin. Its composition varies, so it must not be presented as a guaranteed safe feed for edible crops.', "Leachate i liquid leyi khulukaka hi ntumbuluko yi huma eka worm bin. Composition ya yona ya hambana, hikokwalaho a yi fanelanga ku kombisiwa yi ri feed leyi tiyisekisiweke leswaku yi hlayisekile eka edible crops."),
        },
      ],
    },
  ],
  holds: [],
};

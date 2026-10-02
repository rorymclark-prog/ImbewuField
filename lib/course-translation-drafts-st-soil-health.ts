/** Unpublished, source-paired Sesotho machine draft for Soil Health & Composting. */
import type { SesothoCourseModuleDraft, SesothoSourcePair } from './course-translation-drafts-st.ts';

const pair = (sourceEnglish: string, sesothoDraft: string, reviewStatus: SesothoSourcePair['reviewStatus'] = 'machine-draft'): SesothoSourcePair => ({ sourceEnglish, sesothoDraft, reviewStatus });

export const SESOTHO_SOIL_HEALTH_DRAFT: SesothoCourseModuleDraft = {
  id: "soil-health", language: 'st', reviewStatus: 'machine-draft',
  sourceMetadata: { durationMins: 20, category: "soil" },
  title: pair("Soil Health & Composting", "Bophelo bo Botle ba Mobu le ho Etsa Kompose (Compost)", "machine-draft"),
  description: pair("Build living soil with compost, mulch, cover crops and worm farms.", "Aha mobu o phelang ka kompose (compost), mulch, dijalo tse sireletsang mobu (cover crops) le mapolasi a diboko.", "machine-draft"),
  lessons: [
    {
      id: "soil-health-l1",
      infographicAlt: pair("A soil cross-section shows dark topsoil above pale subsoil, with two worms. Beside it, a jar of soil settles into three layers — sand, silt and clay.", "A soil cross-section shows dark topsoil above pale subsoil, with two worms. Beside it, a jar of soil settles into three layers — sand, silt and clay.", "hold"),
      title: pair("Understanding Your Soil: The Foundation of Everything", "Ho Utlwisisa Mobu wa Hao: Motheo wa Ntho e Nngwe le e Nngwe", "machine-draft"),
      body: pair("Soil contains many kinds of living organisms. Bacteria and fungi help break down organic matter and cycle nutrients.\n\nSome fungi help roots take up nutrients. Worm channels can help water and air enter soil.\n\nLook at roots, soil structure and water movement as well as visible soil life.\n\nPut soil and water in a clear jar, with a little suitable dispersing detergent. Close and shake it, then leave it undisturbed.\n\nSand settles first. Silt settles next, while clay can remain suspended much longer.\n\nThis is a rough learning exercise. Clumps and unsettled clay can mislead you; use a soil laboratory when accurate texture is needed.\n\nA thick sand layer beneath cloudy water does not yet tell you the final proportions. Some fine particles may still be suspended.\n\nCompare the settled layers and feel the soil in the field.\n\nRecord what you see and what remains uncertain. Do not prescribe watering or soil treatments from one jar alone.\n\nCompaction, poor drainage and loss of organic matter can limit roots and soil life.\n\nPale colour or few worms do not prove that chemicals killed the soil. Worm activity also changes with moisture and season.\n\nLook for patterns across the field. Check management history, drainage and plant growth before choosing a remedy.", "Mobung ho na le mefuta e mengata ya dintho tse phelang. Baktheria le fungi di thusa ho qhaqha organic matter le ho tsamaisa dimatlafatsi ka potoloho.\n\nFungi tse ding di thusa metso ho monya dimatlafatsi. Meselana e entsweng ke diboko e ka thusa metsi le moya ho kena mobung.\n\nSheba metso, sebopeho sa mobu le motsamao wa metsi, hammoho le dintho tse phelang mobung tse bonahalang.\n\nKenya mobu le metsi ka clear jar, o kenye hanyenyane ya suitable dispersing detergent. E kwale mme o e sisinye, ebe o e siya e sa sisinyehe.\n\nSand e dula fatshe pele. Silt e latela, athe clay e ka nna ya dula e suspended nako e telele haholo.\n\nEna ke rough learning exercise feela. Dikgobokano tsa mobu (clumps) le clay e so duleng fatshe di ka o kgelosa; sebedisa soil laboratory ha o hloka soil texture e nepahetseng.\n\nLera le letenya la sand ka tlasa cloudy water ha le eso o bolelle final proportions. Fine particles tse ding di ka nna tsa dula di suspended.\n\nBapisa likarolo tse lutseng, ’me u utloe mobu tšimong.\n\nNgola seo u se bonang le seo u sa kholisehang ka sona. U se ke ua etsa qeto ea ho nosetsa kapa ho alafa mobu ka lebaka la nkho e le ’ngoe feela.\n\nHo thatafala ha mobu (compaction), drainage e mpe le tahlehelo ya organic matter di ka sitisa metso le bophelo ba mobu.\n\nMmala o lerootho kapa palo e nyane ya diboko ha e pake hore dikhemikhale di bolaile mobu. Mosebetsi wa diboko le wona o a fetoha ho latela mongobo le sehla.\n\nBatla mekhoa e iphetang tšimong. Hlahloba nalane ea tsamaiso, metsi a phallang le kholo ea limela pele u khetha tharollo.", "machine-draft"),
      keyPoints: [
        pair("Use several clues to assess soil condition", "Sebedisa dintlha le matshwao a mmalwa ho lekola boemo ba mobu", "machine-draft"),
        pair("Soil colour and worm counts alone do not diagnose the cause of a problem", "Mmala wa mobu le palo ya diboko feela ha di fumane sesosa sa bothata", "machine-draft"),
        pair("A jar exercise gives a rough indication of texture, not a complete soil test", "Boikwetliso ba jar bo fana ka rough indication ya soil texture, eseng complete soil test.", "machine-draft"),
        pair("Check drainage, roots and management history before choosing a remedy", "Hlahloba drainage, metso le nalane ya tshebediso pele o kgetha pheko", "machine-draft"),
      ],
      quiz: [
        {
          question: pair("A soil jar still has cloudy water above the sand layer. What should the farmer conclude?", "Nkho ya mobu e sa ntse e na le cloudy water ka hodima lera la sand. Molemi o lokela ho fihlela qeto efe?", "machine-draft"),
          options: [
            pair("The soil definitely needs less water", "Mobu o hloka metsi a fokolang ka nnete", "machine-draft"),
            pair("Fine particles may still be suspended; more observation is needed", "Fine particles di ka nna tsa sala di suspended; ho hlokahala further observation", "machine-draft"),
            pair("All the clay has already settled", "Letsopa lohle le se le dutse fatshe", "machine-draft"),
            pair("The crop definitely needs gypsum", "Sejalo se hloka gypsum ka nnete", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Cloudy water can contain unsettled fine particles. One early observation cannot establish the final proportions or the right treatment.", "Cloudy water e ka ba le fine particles tse eso dule fatshe. Ho sheba hang feela qalong ho ke ke ha bontsha final proportions kapa treatment e loketseng.", "machine-draft"),
        },
        {
          question: pair("A farmer finds compacted soil and few worms. What is the useful next step?", "Molemi o fumana mobu o kitlaneng le diboko tse mmalwa feela. Mohato o latelang o nang le thuso ke ofe?", "machine-draft"),
          options: [
            pair("Assume every soil organism has died", "Nahana hore setshedi se seng le se seng sa mobu se shwele", "machine-draft"),
            pair("Add a treatment without checking the site", "Kenya pheko kapa kalafo ntle le ho hlahloba setsha", "machine-draft"),
            pair("Check drainage, roots, moisture and management history", "Hlahloba drainage, metso, mongobo le nalane ya tshebediso le botsamaisi", "machine-draft"),
            pair("Give up because the soil cannot improve", "Nyahama hobane mobu o ke ke wa hlola o ntlafala", "machine-draft"),
          ],
          sourceCorrectIndex: 2,
          rationale: pair("Several observations help identify a problem. Worm activity varies with conditions, so few worms alone do not establish its cause.", "Diteko le ditekolo tse mmalwa di thusa ho fumana bothata. Mosebetsi wa diboko o fapana le maemo, kahoo diboko tse mmalwa feela ha di tiise sesosa sa tsona.", "machine-draft"),
        },
      ],
    },
    {
      id: "soil-health-l2",
      infographicAlt: pair("A compost heap cut open, showing alternating layers of dry brown material and fresh green material, heat rising from the middle, and an arrow showing it being turned.", "A compost heap cut open, showing alternating layers of dry brown material and fresh green material, heat rising from the middle, and an arrow showing it being turned.", "hold"),
      title: pair("Making and Using Compost", "Ho Etsa le ho Sebedisa Kompose (Compost)", "machine-draft"),
      body: pair("Compost is organic matter broken down under managed conditions.\n\nFinished compost can improve soil structure and contribute nutrients.\n\nTime to readiness varies with materials, moisture, air and temperature. A province name or a fixed number of weeks is not a readiness test.\n\nMix dry browns with fresh greens. Avoid thick, wet layers that keep air out.\n\nIf the heap becomes slimy or smells strongly of ammonia, add dry browns and turn it.\n\nCheck moisture and air as the heap changes; one recipe does not suit every mix of materials.\n\nA hot centre does not prove that every part of a heap has been treated. Time, temperature and management all matter.\n\nKeep meat, dairy, diseased plants, pet waste and contaminated materials out of this simple household system.\n\nDo not assume home composting destroys every weed seed or disease organism. Use a recognised process where sanitation is required.\n\nKeep wattle seed pods out of the compost heap. An ordinary heap may not make every seed non-viable.\n\nUse only clean, untreated materials. Bark breaks down slowly; its name alone is not proof that it is free of contamination.\n\nCheck the heap and turn when it needs more air or mixing. Keep it moist rather than waterlogged.", "Compost ke organic matter e qhaqhollwang ka tsela e laolwang.\n\nCompost e phethilweng e ka ntlafatsa sebopeho sa mobu mme ya fana ka dimatlafatsi.\n\nNako ya hore compost e lokele ho sebediswa e fapana ho ya ka materials, mongobo, moya le thempereitjha. Lebitso la province kapa palo e behilweng ya dibeke ha se readiness test.\n\nKopanya dry browns le fresh greens. Qoba layers tse teteaneng, tse metsi tse thibelang moya ho kena.\n\nHa qubu ya compost e ka ba slimy kapa e nkha ammonia haholo, eketsa dry browns mme o e phethole.\n\nHlahloba mongobo le moya ha qubu ya compost e ntse e fetoha; recipe e le nngwe ha e tshwanele motswako o mong le o mong wa materials.\n\nKarolo e bohareng e tjhesang ya qubu ha e pake hore karolo e nngwe le e nngwe ya yona e se e treated. Nako, temperature le management kaofela di bohlokwa.\n\nBoloka meat, dairy, diseased plants, pet waste le contaminated materials di le ka ntle ho tsamaiso ena e bonolo ya lapeng.\n\nU se ke ua nahana hore home composting e fedisa peo e nngwe le e nngwe ya mofoka kapa disease organism e nngwe le e nngwe. Sebedisa recognised process moo sanitation e hlokahalang.\n\nBoloka wattle seed pods di le ka ntle ho qubu ya compost. Qubu e tlwaelehileng e ka nna ya se etse hore peo e nngwe le e nngwe e be non-viable.\n\nSebedisa materials tse hlwekileng feela, tse sa alafwang. Bark e bola butle; lebitso la yona feela ha le pake hore ha e na contamination.\n\nHlahloba qubu ya compost mme o e phethole ha e hloka moya o mongata kapa ho kopanngwa. E boloke e le mongobo, e se ke ya ba waterlogged.", "machine-draft"),
      keyPoints: [
        pair("Balance browns, greens, moisture and air", "Lekanyetsa tse sootho, tse tala, mongobo le moya", "machine-draft"),
        pair("A hot centre does not prove the whole heap is sanitised", "Karolo e bohareng e chesang ha e pake hore qubu yohle e sanitised.", "machine-draft"),
        pair("Keep seed pods and contaminated materials out", "Boloka makgapha a dipeo le disebediswa tse nang le ditshila kantle", "machine-draft"),
        pair("Judge readiness from the compost condition, not a fixed regional timetable", "Ahlola ho loka ho tswa boemong ba kompose, eseng lenaneong le behilweng la nako la lebatowa", "machine-draft"),
      ],
      quiz: [
        {
          question: pair("A farmer's compost heap smells strongly of ammonia and is wet and slimy. What's the fix?", "Qubu ya compost ya molemi e nkha ammonia haholo mme e metsi ebile e slimy. Tharollo ke efe?", "machine-draft"),
          options: [
            pair("Add more nitrogen-rich green material", "Eketsa disebediswa tse tala tse nang le naetrojene e ngata", "machine-draft"),
            pair("Add more dry carbon material like straw and turn the heap", "Eketsa disebediswa tse omileng tsa khabone (carbon) jwalo ka jwang bo omileng (straw) mme o phethole qubu", "machine-draft"),
            pair("Stop turning it and let it cool", "Kgaotsa ho e phethola mme o e tlohele e fole", "machine-draft"),
            pair("Add more water — the smell means it's too dry", "Eketsa metsi a mangata — monko o bolela hore e omeletse haholo", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("A wet, slimy heap may need more air and drier material. Add dry browns and turn the heap to open it up. An ammonia smell can also suggest too much nitrogen-rich material. Check that the heap stays damp, not soggy.", "Qubu e metsi, e slimy e ka hloka moya o mongata le material e ommeng ho feta. Eketsa dry browns mme o phethole qubu hore e bulehe mme moya o kene. Monko wa ammonia le wona o ka bontsha hore ho na le material e ngata haholo e nang le nitrogen. Hlahloba hore qubu e dule e le damp, e se be soggy.", "machine-draft"),
        },
        {
          question: pair("Why keep wattle seed pods out of an ordinary compost heap?", "Ke hobaneng ha o lokela ho boloka makgapha a dipeo tsa wattle kantle ho qubu e tlwaelehileng ya kompose?", "machine-draft"),
          options: [
            pair("Bark makes every heap too hot", "Makgapetla a difate a etsa hore qubu e nngwe le e nngwe e tjhese haholo", "machine-draft"),
            pair("Some seeds may survive and spread when the compost is used", "Dipeo tse ding di ka nna tsa pholoha mme tsa nama ha kompose e sebediswa", "machine-draft"),
            pair("Pods always attract termites", "Makgapha a dula a hulela mohlwa kamehla", "machine-draft"),
            pair("Pods release a gas that kills every soil organism", "Makgapha a lokolla kgase e bolayang setshedi se seng le se seng sa mobu", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("An ordinary heap may not expose every seed to conditions that make it non-viable. Excluding pods avoids spreading them with the compost.", "Qubu e tlwaelehileng e ka nna ya se pepesetse peo e nngwe le e nngwe maemong a ka e etsang hore e se hlole e kgona ho mela (non-viable). Ho ntsha makgapha a dipeo ho thibela hore a se ke a nama mmoho le kompose.", "machine-draft"),
        },
      ],
    },
    {
      id: "soil-health-l3",
      infographicAlt: pair("Two patches of soil under the same sun: bare ground cracked and dry, mulched ground still dark and moist.", "Two patches of soil under the same sun: bare ground cracked and dry, mulched ground still dark and moist.", "hold"),
      title: pair("Mulching and Cover Crops: Protecting and Building Soil", "Ho Sebedisa Mulch le Dijalo tse Sireletsang Mobu (Cover Crops): Ho Sireletsa le ho Aha Mobu", "machine-draft"),
      body: pair("Cover bare soil with suitable clean mulch, such as straw, dry grass or wood chips.\n\nMulch can reduce evaporation, soften the impact of rain and suppress weeds.\n\nKeep it clear of trunks and stems. Check moisture underneath and adjust the layer; more mulch is not always better.\n\nCover crops can protect ground between main crops. Choose for local weather, available water and the next planting.\n\nThe course examples include oats, lupins, sunn hemp and cowpea. Check local suitability before sowing.\n\nLegumes need suitable bacteria and growing conditions to fix nitrogen. Nutrients in their residues become available as the material decomposes.\n\nWorm farms can turn suitable food scraps and bedding into castings. Check the bin rather than expecting a fixed harvest date.\n\nLiquid that drains naturally from a worm bin is called leachate. It is not the same as a prepared worm-casting tea.\n\nLeachate can contain harmful organisms or substances. Do not use it on edible plants or assume that dilution makes it safe.\n\nA Highveld field left bare after the maize harvest faces two main risks.\n\nWinter wind can carry away dry topsoil.\n\nThe first heavy spring storm can strike bare ground and damage its surface and structure. If water runs over the field, it can carry loosened soil away.\n\nCover crops, mulch, and organic matter can help hold soil in place and help it stay alive.", "Cover bare soil with suitable clean mulch, such as straw, dry grass or wood chips.\n\nMulch can reduce evaporation, soften the impact of rain and suppress weeds.\n\nKeep it clear of trunks and stems. Check moisture underneath and adjust the layer; more mulch is not always better.\n\nCover crops can protect ground between main crops. Choose for local weather, available water and the next planting.\n\nThe course examples include oats, lupins, sunn hemp and cowpea. Check local suitability before sowing.\n\nLegumes need suitable bacteria and growing conditions to fix nitrogen. Nutrients in their residues become available as the material decomposes.\n\nWorm farms can turn suitable food scraps and bedding into castings. Check the bin rather than expecting a fixed harvest date.\n\nLiquid that drains naturally from a worm bin is called leachate. It is not the same as a prepared worm-casting tea.\n\nLeachate can contain harmful organisms or substances. Do not use it on edible plants or assume that dilution makes it safe.\n\nTšimo ea Highveld e siiloeng e sa koaheloa ka mor’a kotulo ea maize e tobana le likotsi tse peli tse kholo.\n\nMoea oa mariha o ka nka mobu o ommeng o ka holimo.\n\nSefefo sa pele se matla sa selemo se ka otla mobu o sa koaheloang ’me sa senya bokaholimo le sebopeho sa mobu. Ha metsi a phalla holim’a tšimo, a ka nka mobu o khoehileng.\n\nCover crops, mulch, and organic matter can help hold soil in place and help it stay alive.", "machine-draft"),
      keyPoints: [
        pair("Protect exposed soil with suitable cover", "Sireletsa mobu o pepesitsweng ka sekwahelo se loketseng", "machine-draft"),
        pair("Keep mulch away from trunks and stems", "Boloka mulch hole le dithito le makala a dimela", "machine-draft"),
        pair("Choose cover crops for local water, weather and the following crop", "Kgetha dijalo tse sireletsang mobu ho latela metsi a lehae, maemo a lehodimo le sejalo se latelang", "machine-draft"),
        pair("Worm-bin leachate is not automatically safe fertiliser; keep it off edible plants", "Worm-bin leachate is not automatically safe fertiliser; keep it off edible plants", "hold"),
      ],
      quiz: [
        {
          question: pair("A Highveld farmer harvests maize in April and leaves the field bare all winter. What are the two main risks?", "Molemi wa Highveld o kotula poone (maize) ka Mmesa mme o siya tshimo e hlobotse mariha kaofela. Dikotsi tse pedi tse ka sehloohong ke dife?", "machine-draft"),
          options: [
            pair("Overheating in winter sun and waterlogging from rain", "Ho tjhesa ho tlola tekanyo letsatsing la mariha le ho kopa metsi ho tswa puleng", "machine-draft"),
            pair("Frost kills soil life and weeds take over early", "Serame se bolaya bophelo ba mobu mme mefoka e nka sebaka pele ho nako", "machine-draft"),
            pair("Wind erosion of dry topsoil and loss of soil structure from spring storm impact", "Wind erosion of dry topsoil and loss of soil structure from spring storm impact", "hold"),
            pair("Soil pH drops and nitrogen builds up", "PH ya mobu e a theoha mme naetrojene e a bokellana", "machine-draft"),
          ],
          sourceCorrectIndex: 2,
          rationale: pair("Bare soil is exposed to winter wind, which can carry away dry topsoil. Raindrop impact can damage the surface; where water runs over the field, it can carry loosened soil away.", "Bare soil is exposed to winter wind, which can carry away dry topsoil. Raindrop impact can damage the surface; where water runs over the field, it can carry loosened soil away.", "hold"),
        },
        {
          question: pair("What should you remember about liquid draining from a worm bin?", "O lokela ho hopola eng ka mokedikedi o rothang ho tswa moqomong wa diboko?", "machine-draft"),
          options: [
            pair("It is always safe on salad leaves", "O dula o bolokehile kamehla hodima mahlaku a salate", "machine-draft"),
            pair("It can contain harmful organisms or substances; dilution is not a safety guarantee", "O ka ba le ditshedi kapa dintho tse kotsi; ho o hlapolla hase tiisetso ya polokeho", "machine-draft"),
            pair("It is identical to finished worm castings", "O tshwana hantle le manyolo a phethilweng a diboko (worm castings)", "machine-draft"),
            pair("A fixed dilution makes every liquid safe", "Ho hlapolla ho itseng ho behilweng ho etsa hore mokedikedi o mong le o mong o bolokehe", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Leachate is liquid that drains naturally from a worm bin. Its composition varies, so it must not be presented as a guaranteed safe feed for edible crops.", "Leachate is liquid that drains naturally from a worm bin. Its composition varies, so it must not be presented as a guaranteed safe feed for edible crops.", "hold"),
        },
      ],
    },
  ],
};

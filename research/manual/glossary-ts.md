# Xitsonga (ts) permaculture glossary

> **Machine draft, not reviewed.** Claude drafted this glossary to keep the Xitsonga manual
> (`public/manual/ts/`) consistent with the Xitsonga app wording. A fluent Xitsonga speaker,
> ideally someone with farming or extension experience in Limpopo or Mpumalanga, must
> review it before it is treated as final. Every term marked **(check)** is a guess or has
> competing forms, and needs a decision from that reviewer.

## How to use this glossary

- Use the Xitsonga term for every listed English term, in every chapter.
- Where the notes say **"explain on first use"**, write the Xitsonga phrase and put the English word in brackets the first time it appears in a chapter, for example "xisele (swale)". After that, use the Xitsonga alone.
- **Loan words** follow Xitsonga spelling and noun classes, for example *ti-zone*, *damu*, *thanki*.
- **"app:"** means the term is already used in the ImbewuField app. The file and key are given so the manual and the app stay the same. `ts.ts` is `lib/locales/ts.ts`. "drafts" means `lib/course-translation-drafts-ts.ts` and `lib/course-translation-drafts-ts-water-harvesting.ts`.
- `lib/locales/ts.ts` lines ~527–723 (climate cards, dashboards, My Records, POPIA screens) used to mix in siSwati, isiZulu and Sepedi words such as *manzi*, *metsi*, *mvula*, *xichelo*, *tihlahla*, *kotula* and *Nkulukumba*. They were re-translated on 2026-09-26 (see the clean-up log at the end), so the whole file now follows this glossary. It is still a machine draft: check the items marked **(check)** in the log.
- Keep Latin plant names in italics. Numbers and units stay as in English.

## 1. Permaculture, ethics and principles

| English | Xitsonga | Notes |
|---|---|---|
| permaculture | permaculture | Loan word. Explain on first use: "ndlela yo rima leyi tiyisaka misava na vanhu malembe hinkwawo". app: ts.ts `tagline`, `welcomeSub` |
| ethics | mahanyelo | app: drafts (`intro-permaculture` title "Mahanyelo Manharhu") |
| the three ethics | mahanyelo manharhu | app: drafts |
| Earth Care / Care for the Earth | Ku Hlayisa Misava | app: drafts |
| People Care / Care for People | Ku Hlayisa Vanhu | app: drafts |
| Fair Share / Share our Resources | Ku Avelana hi Ku Ringana | app: drafts |
| principle(s) | nsinya wa nawu / misinya ya milawu | app: drafts ("Misinya ya Milawu ya Khume-Mbirhi"). Plain *milawu* also works in speech (check) |
| 1. Observe and interact | Xiyisisa u tlhela u tirhisana | app: drafts (quiz on swales) |
| 2. Catch and store energy | Khoma u tlhela u hlayisa matimba | *matimba* = energy, as in drafts (check) |
| 3. Obtain a yield | Kuma vuyelo | Explain: "leswi u swi tshovelaka kumbe u swi kumaka" (check) |
| 4. Apply self-regulation and accept feedback | Tilawule u tlhela u amukela leswi ntumbuluko wu ku byelaka swona | Descriptive; "feedback" in brackets on first use (check) |
| 5. Use and value renewable resources and services | Tirhisa u tlhela u teka swi ri swa nkoka swilo leswi tipfuxetaka | Descriptive (check) |
| 6. Produce no waste | U nga humesi thyaka | app: drafts (`intro-permaculture-l2` body) |
| 7. Design from patterns to details | Dizayina ku sukela eka mavumbeko lamakulu ku ya eka vuxokoxoko | Use *mavumbeko* with "(patterns)" on first use. app: drafts (module description, changed from "ti-pattern" 2026-09-26) (check) |
| 8. Integrate rather than segregate | Hlanganisa ku ri na ku hambanisa | app: drafts |
| 9. Use small and slow solutions | Tirhisa swintlhantlho leswitsongo naswona swo nonoka | app: drafts (`intro-permaculture-l2` body; "swa le hansi" = low was corrected 2026-09-26) (check) |
| 10. Use and value diversity | Tirhisa u tlhela u teka ku hambana-hambana ku ri ka nkoka | app: drafts |
| 11. Use edges and value the marginal | Tirhisa mindzilakano u tlhela u teka swa le matlhelweni swi ri swa nkoka | *ndzilakano* as in app (check) |
| 12. Creatively use and respond to change | Tirhisa ku cinca hi vutlhari u tlhela u angula eka kona | (check) |
| design (noun) | dizayini | Loan word. app: ts.ts `tabDesign`, `designMapLink` |
| to design | ku dizayina / ku endla pulani | app: drafts ("Ku Endla Pulani na Ntumbuluko") |
| plan | pulani | app: ts.ts `heroSub` |
| energy | matimba | app: drafts (`Ku Hlela Purasi ra Wena hi Matimba`) |
| yield / harvest (noun) | ntshovelo | app: drafts ("endzhaku ka ntshovelo") |
| waste | thyaka | app: drafts |
| food scraps | masalela ya swakudya | app: drafts ("masalela ma hundzuka khompositi") |
| pattern | xivumbeko / mavumbeko | app: drafts ("mavumbeko (patterns)"). Explain on first use (check) |
| element (of a design) | xiphemu | Explain: "xin'wana na xin'wana eka dizayini: yindlu, thanki, tihuku, murhi" (check) |
| system | maendlelo | app: drafts ("maendlelo ya nsimu"). *sisiteme* is also used in ts.ts `windbreakRowSystem` |
| nature | ntumbuluko | app: ts.ts `tabNature` |
| organic (farming) | ya ntumbuluko | app: ts.ts `practiceFullyOrganicLabel` |
| sustainable | leswi tshamaka swi tirha malembe yo tala | Descriptive, no single word (check) |
| self-reliance | ku tiyimela | (check) |
| food security | vusirhelelo bya swakudya | app: ts.ts `goalFoodSecurityLabel` |
| manual (this book) | buku ya swiletelo | Explain with "(manual)" on first use (check) |
| chapter | ndzima / tindzima | Used in the reader UI ("Tindzima hinkwato") (check) |
| key points | tinhla ta nkoka | Heading at the end of each chapter (check) |
| resources | rifuwo | Also "wealth". Used for natural and farm resources (check) |
| surplus | leswi tlulaka | Descriptive. Explain with "(surplus)" on first use (check) |
| diversity / stability / resilience | ku hambana-hambana / ku tiya / matimba yo pfuka | Mollison's definition (check) |
| feedback | feedback | Loan word, kept in English after the principle 4 wording explains it (check) |
| closed loop | xirhendzevutana lexi pfalekeke | Explain with "(closed loops)" (check) |
| saying / proverb | xivuriso | Label for Holmgren's sayings. The sayings are translated by meaning, not word for word (check) |

## 2. Planning, zones and sectors

| English | Xitsonga | Notes |
|---|---|---|
| site | ndhawu | app: ts.ts `siteReportOverline` ("Xiviko xa ndhawu") |
| site assessment / site analysis | nxopaxopo wa ndhawu | app: ts.ts `reportToolbarTitle` |
| to observe | ku xiyisisa | app: drafts |
| map | mepe | app: ts.ts `tabMap` |
| base map | mepe wa masungulo | app: drafts |
| boundary | ndzilakano | app: ts.ts `drawingInProgressBoundary`, drafts (the variants *ndzelekani* / *ndzilekana* were replaced 2026-09-26) |
| zone | zone / ti-zone | Loan word. app: drafts ("Ti-zone na Ti-Sector"). The old draft form "tizoniti" was replaced 2026-09-26 and should not be used. Explain on first use: "ndhawu leyi hlelekeke hi ku ya hi leswaku u yi endzela kangani" |
| Zone 0 (the home) | Zone 0 (yindlu) | app: drafts ("Zone 0 i yindlu") |
| sector | sector / ti-sector | Loan word. app: drafts. Explain on first use: "matimba lama taka ehandle: dyambu, moya, mpfula, ndhambi, ndzilo". The old draft form "tisekitara" was replaced 2026-09-26 and should not be used |
| slope | ku rhelela / ndhawu yo rhelela | app: drafts |
| steep slope | ku rhelela ngopfu | (check) |
| contour / contour line | khanthura / layini ya khanthura | Loan word. app: drafts ("eka khanthura"). Explain on first use: "layini leyi tindhawu hinkwato ta yona ti nga eka ku leha loku fanaka". ts.ts map layer `layerToggleContours` / `layersButtonCollapsedContours` now say *Tikhanthura* (was *Mipfhuka* = distances). Do not use *mipfhuka* for "contour" (check) |
| A-frame level | A-frame | Loan word. app: drafts. Explain: "xitirhisiwa xa mapulanka xo kuma khanthura" |
| elevation / height above sea level | vutlakuko | app: ts.ts `statElevation` |
| topography / landform | swiyimo swa misava | app: drafts |
| aspect (the way a slope faces) | tlhelo leri ndhawu yi languteke kona | app: drafts |
| north | n'walungu | app: drafts, ts.ts `shapeNamingPlaceholderWater` |
| Southern Africa | Dzonga ra Afrika | "Afrika Dzonga" is the country South Africa; keep the two apart (check) |
| south | dzonga | app: drafts |
| east | vuxa | app: drafts |
| west | vupeladyambu | app: drafts |
| microclimate | maxelo ya ndhawu leyitsongo | Descriptive. Explain on first use with "(microclimate)" (check) |
| frost hollow / frost pocket | xikhele xa xirhami | app: drafts |
| valley | nkova | app: drafts |
| ridge | nhlonge | app: drafts (check) |
| farm | purasi | app: ts.ts `tabFarm` |
| smallholding | purasi leritsongo | app: drafts |
| household / homestead | muti | app: drafts, ts.ts `radioMeMyFamilyDesc` |
| house | yindlu | app: drafts |
| community | vaaki | app: ts.ts `radioCommunityGroup` |
| neighbour | muakelani | app: drafts |
| farmer | murimi | app: ts.ts `sectionPresetFarmer` |
| extension officer | mutirhi wa vurimi wa mfumo | Descriptive (check) |

## 3. Climate, weather and sectors

| English | Xitsonga | Notes |
|---|---|---|
| climate / weather | maxelo | app: ts.ts `tabClimate` |
| climate change | ku cinca ka maxelo | Explain on first use with "(climate change)" |
| weather station | xitichi xa maxelo | app: drafts |
| rain | mpfula | app: ts.ts `reportRainfallLabel`, `homeStatRain`. Do not use *mvula* (isiZulu/siSwati; removed from ts.ts 2026-09-26) |
| rainfall (amount) | mpfula / mpimo wa mpfula | app: ts.ts `statAnnualRainfall` ("Mpfula ya lembe") |
| storm | xidzedze | app: drafts |
| hail | xihangu | (check) |
| mist | nkungu | (check) |
| sun | dyambu | app: ts.ts `statSolar` |
| shade / shadow | ndzhuti | app: drafts, ts.ts `infraShadeTunnel` |
| wind | moya / mimoya | app: ts.ts `windSectionHeader`, drafts (*mheho* was replaced by *moya* 2026-09-26) |
| frost / cold | xirhami | app: ts.ts `calendarFrost`, `statFrostRisk`, climate cards. Do not use *xichelo* (removed from ts.ts 2026-09-26) |
| drought | dyandza | app: ts.ts `challengeDrought` |
| dry season | nkarhi wa dyandza / nkarhi wo oma | app: drafts |
| flood | ndhambi | app: ts.ts `challengeFlooding` |
| fire | ndzilo | app: ts.ts `allSectionFireHazards` |
| veld fire | ndzilo wa nhova | (check) |
| firebreak | ndlela yo sivela ndzilo | Descriptive. Explain with "(firebreak)" |
| summer | ximumu | app: ts.ts `statSummerMax`, drafts |
| winter | vuxika | app: drafts and ts.ts (`statWinterMin`, `windWinterLabel` changed from *xixika* 2026-09-26; climate cards changed from *xirhanguri*). *Xixika* is also heard; the reviewer should confirm (check) |
| season | nguva / minguva | app: drafts, ts.ts `allSectionSeasonalCalendar` |
| temperature | mahiselo / tempheracha | app: drafts (*mahiselo*), ts.ts `monthlyTemperatureHeader` (*tempheracha*) |
| evaporation | ku phyaphyarha ka mati | app: drafts |

## 4. Water and earthworks

| English | Xitsonga | Notes |
|---|---|---|
| water | mati | app: ts.ts `tabWater`. Do not use *manzi* / *metsi* (removed from ts.ts 2026-09-26) |
| rainwater | mati ya mpfula | app: ts.ts `waterSourceRainwater` |
| water harvesting / rainwater harvesting | ku hlengeleta mati (ya mpfula) | app: ts.ts `allSectionWaterHarvesting`, drafts title |
| catchment (area) | ndhawu yo hlengeleta mati | app: ts.ts `catchmentAreaLabel` |
| roof catchment | ku hlengeleta mati elwangwini | app: drafts, ts.ts `stepRoofCatchment` |
| roof | lwangu | app: ts.ts `waterCategoryRoof` |
| gutter | gatara / tigatara | app: ts.ts `toggleGuttersLabel`, drafts (*gavhu* replaced 2026-09-26) |
| pipe / hosepipe | phayiphi | app: ts.ts `waterDeliveryPipedDesc` |
| tank / water tank | thanki / tithanki | app: ts.ts `waterStorageJojoTanks`, drafts (*tangi / matangi* replaced 2026-09-26) |
| first-flush diverter | first-flush diverter | app: drafts (kept in English). Explain: "xitirhisiwa lexi lahlaka mati yo sungula lama thyakeke" |
| runoff | mati lama khulukaka | app: drafts. ts.ts `waterCategoryRoadRunOff` has "Mati lama humaka egondzweni" for road runoff |
| water flow | ku khuluka ka mati | app: drafts |
| infiltration (water soaking in) | ku nghena ka mati emisaveni | Descriptive (check) |
| swale | xisele (swale) / swisele | app: ts.ts `waterCategorySwale` ("Xisele (swale)"), `insightModerateRain`, drafts ("ti-swale" replaced 2026-09-26). Give "(swale)" on first use |
| berm / mound | khurhana ra misava / makhurhana ya misava | app: drafts (`water-harvesting-l1`). Based on ts.ts `waterCategoryContourBank`. Explain with "(berm)" (check) |
| contour bank | khurhana ro sivela mati | app: ts.ts `waterCategoryContourBank` |
| earthworks | ntirho wa misava / mintirho ya ku cela misava | app: ts.ts `waterCategoryEarthwork`, drafts |
| trench | mugodi wo leha | Descriptive (check) |
| pit / hole | mugodi | app: ts.ts `photoDetailSoilProfile` |
| dam | damu / madamu | app: ts.ts `waterStorageEarthDam` ("Damu ra misava") |
| dam wall | rirhangu ra damu | app: drafts |
| bank (of a dam or river) | ribuwa / maribuwa | app: drafts |
| spillway | spillway | app: drafts (kept in English). Explain: "ndlela leyi hlayisekeke leyi mati lama taleke ma humaka hi yona" |
| overflow | mati lama taleke | app: drafts |
| sand dam | damu ra sava | Explain with "(sand dam)" on first use |
| check dam | rirhangu ritsongo ro nonopisa mati | Descriptive. Explain with "(check dam)" (check) |
| gully (erosion channel) | mugero lowu kukuriweke hi mati | Descriptive. Explain with "(gully)" (check) |
| pond | xidziva / swidziva | app: ts.ts `waterStoragePond`, drafts |
| borehole | xihlovo / borehole | app: ts.ts `waterSourceBorehole` (*Xihlovo*). Drafts keep "borehole". *Xihlovo* also means a well or spring, so write "xihlovo (borehole)" where the difference matters |
| spring (water source) | xihlovo lexi humaka | app: ts.ts `guideAddWaterPointDesc` |
| river | nambu | app: ts.ts `waterSourceRiverStream` |
| stream | xinambyana | app: ts.ts `waterSourceRiverStream` |
| groundwater | mati ya le hansi ka misava | app: drafts |
| wetland | ndhawu leyi tsakamaka minkarhi hinkwayo | Descriptive. Explain with "(wetland)" (check) |
| irrigation / to water | ku cheleta | app: ts.ts `allSectionIrrigationPlan`, drafts |
| drip irrigation | ku cheleta hi mathonsi | app: ts.ts `waterDeliveryDripLabel` |
| bottle irrigation | ku cheleta hi bodlhela | Descriptive (check) |
| sprinkler | xihahatelo | app: ts.ts `waterDeliverySprinklerLabel` |
| greywater | mati lama tirhisiweke (greywater) | app: ts.ts `waterSourceGreyWater` ("(greywater)" added 2026-09-26), drafts (`water-harvesting-l4` title and key point) |
| germs / pathogens | switsongwatsongwana | app: drafts |
| drinking water | mati yo nwa | app: drafts |

## 5. Soil and fertility

| English | Xitsonga | Notes |
|---|---|---|
| soil / land | misava | app: ts.ts `tabSoil`, `yourLand` |
| soil health | rihanyu ra misava | app: ts.ts `soilHealthScoreHeader` |
| soil profile | xivumbeko xa misava | app: ts.ts `photoLabelSoilProfile` |
| soil type / texture | muxaka wa misava | app: ts.ts `statSoilTexture` |
| sand / sandy | sava / yi na sava | app: ts.ts `textureSand`, `soilConditionSandy` |
| clay | vumba | app: ts.ts `textureClay` |
| silt | ndhaka | app: ts.ts `textureSilt` (check) |
| loam | misava yo hlangana (loam) | Descriptive. Explain on first use (check) |
| topsoil | misava ya le henhla | Descriptive |
| subsoil | misava ya le hansi | Descriptive |
| compacted soil | misava leyi tiyeke / ku sindzeka ka misava | app: ts.ts `soilConditionCompacted`, drafts |
| fertile | yi nonile | app: drafts |
| soil fertility | ku nona ka misava | (check) |
| erosion | ku kukuriwa ka misava | app: ts.ts `challengeFlooding` |
| degraded soil | misava leyi onhakeke | app: ts.ts `soilHealthScoreDegraded`, `challengePoorSoil` |
| organic matter | swilo swa ntumbuluko leswi boleke | Descriptive. Explain with "(organic matter)" |
| humus | misava ya ntima leyi noneke | Descriptive (check) |
| organic carbon | khaboni ya ntumbuluko | app: ts.ts `statOrganicCarbon` |
| nutrients (plant food) | swakudya swa swimilana | Descriptive. Explain with "(nutrients)" |
| nitrogen | naytirojini | Loan word (check spelling) |
| pH | pH | app: ts.ts `statPH` |
| acidic | yi na asidi | app: ts.ts `phAcidic` |
| lime (agricultural) | layimi | app: ts.ts `phAcidic` |
| compost | monyolo wa khompositi / khompositi | app: ts.ts `soilAmendmentCompost` ("Monyolo wa khompositi", was *Monyolo*, which also means fertiliser), `infraCompostBay`, drafts. Give "(compost)" on first use (check) |
| compost heap | nhulu wa khompositi | Descriptive. ts.ts `infraCompostBay` (compost bay) now "Ndhawu ya khompositi" (check) |
| compost tea | mati ya khompositi | Descriptive (check) |
| fertiliser | monyolo | app: ts.ts `soilAmendmentCommercialFert` |
| chemical fertiliser | monyolo wa khemikhali / wa xibindzu | app: ts.ts `soilAmendmentCommercialFert` ("Monyolo wa xibindzu") |
| manure (animal) | vulongo bya swifuwo | ts.ts `soilAmendmentKraalManure` now "Vulongo bya xivala" (was "Manyhi ya xivala"); the draft "manyoro ya compost" was replaced. *Manyoro* (loan) is also heard (check) |
| kraal manure | vulongo bya xivala | See above (check) |
| liquid manure | manyoro ya mati | Descriptive (check) |
| green manure | monyolo wa rihlaza | Explain on first use: "swimilana leswi byariwaka kutani swi rimiwa emisaveni (green manure)" (check) |
| cover crop | swimilana swo funengeta misava | Descriptive. Explain with "(cover crop)" |
| mulch | xifunengeto (mulch) | app: ts.ts `soilAmendmentMulch` ("Xifunengeto / swiphemu swa mirhi"), `insightModerateRain`, drafts (`water-harvesting-l4` key point). Give "(mulch)" on first use |
| to mulch | ku funengeta misava | Based on ts.ts, drafts ("Hlayisa misava yi funengetekile") |
| ground cover | ku funengeteka ka misava | app: drafts |
| straw / dry grass | byanyi byo oma | (check) |
| leaf litter | matluka lama weleke | Descriptive |
| wood ash | nkuma wa tihunyi | (check) |
| earthworm | xivungu xa misava / swivungu swa misava | (check). A single noun for earthworm may exist; the reviewer should decide |
| worm farm / wormery | ndhawu yo fuya swivungu swa misava | Descriptive. Explain with "(worm farm)" (check) |
| worm tea | mati ya swivungu | Descriptive (check) |
| to dig | ku cela | app: ts.ts `photoDetailSoilProfile`, drafts |
| to plough / till | ku rima | app: ts.ts `landPrepTractorDesc` |
| no-dig (method) | ku byala handle ko cela | Descriptive. Explain with "(no-dig)" |
| double digging | ku cela kambirhi | Descriptive. Explain with "(double digging)" (check) |
| soil test / soil audit | ku kambela misava | app: drafts ("u kambisisa misava") |
| micro-organisms | swihanyi leswitsongo-tsongo | Coined in ch. 8. Explain with "(micro-organisms)" (check) |
| fungi | mikowa | *Nkowa* = mushroom; used for fungi in ch. 8–9. Explain with "(fungi)" (check) |
| taproot | rimitsu lerikulu leri nghenaka ehansi | Descriptive. Explain with "(taproot)" (check) |
| soil structure | ndlela leyi misava yi hlanganeke ha yona | Descriptive. Explain with "(structure)"; kept apart from *xivumbeko xa misava* (soil profile) (check) |
| feel test / ribbon test | ku kambela hi ku khumba | Descriptive. Explain with "(ribbon test)" (check) |
| jar test | ku kambela hi xibya xa ngilazi | Descriptive. Explain with "(jar test)" (check) |
| root nodules | swirhundzu (nodules) | (check) |
| sheet mulching | ku funengeta hi makhadibodo | Descriptive. Explain with "(sheet mulching)" (check) |
| mulch bank | xirhapa xa xifunengeto | Descriptive. Explain with "(mulch bank)" (check) |
| browns / greens (compost) | swo oma / swa rihlaza | Explain with "(browns)", "(greens)" (check) |
| worm castings | vulongo bya swivungu | Explain with "(castings)" (check) |
| composting worms | swivungu swa khompositi | Kept apart from *swivungu swa misava* (garden earthworms) (check) |
| worm cocoons | makokwana | Explain with "(cocoons)" (check) |
| bedding (worm farm) | mubhedo | Distinct from *mubhedhi* (garden bed) (check) |
| slasher | xitsemelo xa byanyi | Descriptive (check) |
| autumn | ndzhenga | (check) |

## 6. Plants, gardens and trees

| English | Xitsonga | Notes |
|---|---|---|
| plant (noun) | ximilana / swimilana | app: ts.ts `reportVegetationLabel`, drafts (*ximilani / swimilani* replaced 2026-09-26) |
| to plant / sow | ku byala | app: ts.ts `plantingCalendarHeader` |
| planting calendar | khalendara yo byala | app: ts.ts `plantingCalendarHeader` |
| seed | mbewu | app: drafts |
| seed saving | ku hlayisa mbewu | Descriptive |
| seedling | ximilana lexintshwa | Descriptive (check) |
| germination | ku mila ka mbewu | Descriptive |
| nursery (for seedlings) | ndhawu yo kurisa swimilana | Drafts keep "nursery". Explain with "(nursery)" |
| to transplant | ku rhurhisa swimilana | (check) |
| crop(s) | swibyariwa | app: drafts. ts.ts uses *swakudya* (food) for crops |
| vegetables | matsavu | app: ts.ts `cropVegetables` |
| leafy greens (wild or cultivated) | miroho | Common spoken word for cooked leafy relish (check) |
| herbs | mirhi yo nun'hwela | app: ts.ts `cropHerbsMedicinal` |
| medicinal plant | ximilana xa murhi | *Murhi* means both "tree" and "medicine". Based on ts.ts `cropHerbsMedicinal` (check) |
| fruit | muhandzu / mihandzu | app: ts.ts `cropFruitTrees` |
| tree | murhi / mirhi | app: ts.ts `cropFruitTrees` |
| fruit tree | murhi wa mihandzu | app: ts.ts `cropFruitTrees` |
| indigenous plants / trees | swimilana / mirhi ya ndhavuko | app: ts.ts `cropIndigenousPlants`, `allSectionIndigenousTrees` |
| invasive alien plant | ximilana xa matiko mambe lexi hangalakaka | Descriptive. Explain with "(invasive alien plant)" (check) |
| shrub / bush | xihlahla / swihlahla | app: ts.ts `insightModerateWind` (hedge row). (check). Do not use *tihlahla* for trees (removed from ts.ts 2026-09-26) |
| climber / vine | ximilana lexi khandziyaka | Descriptive |
| vertical gardening | ku rima hi ku tlakukela ehenhla | Descriptive. Explain with "(vertical gardening)" (check) |
| sprouts (sprouted seeds) | timbewu leti mileke | Explain with "(sprouts)" on first use (check) |
| grains (cereal crops) | swibyariwa swa timbewu | Descriptive. Explain with "(grains)" (check) |
| root(s) | rimitsu / timitsu | app: ts.ts `waterDeliveryDripDesc` ("etimitswini") |
| leaf / leaves | tluka / matluka | app: drafts |
| flower | xiluva / swiluva | (check) |
| branch | rhavi / marhavi | (check) |
| annual (plant) | ximilana xa lembe rin'we | Descriptive |
| perennial (plant) | ximilana lexi hanyaka malembe yo tala | Descriptive |
| legume | ximilana xa muxaka wa tinyawa | Descriptive. Explain with "(legume)" (check) |
| nitrogen fixer | ximilana lexi nyikaka misava naytirojini | Descriptive. Explain with "(nitrogen fixer)" (check) |
| garden | ntanga | app: ts.ts `shapeCategoryVegetableGarden`, drafts (*jarata* replaced 2026-09-26) |
| vegetable garden | ntanga wa matsavu | app: ts.ts `shapeCategoryVegetableGarden` |
| kitchen garden | ntanga wa le kusuhi na yindlu | Descriptive. Explain with "(kitchen garden)" |
| orchard | ntanga wa mirhi ya mihandzu | app: ts.ts `shapeCategoryOrchard` |
| field | nsimu / masimu | app: ts.ts `shapeCategoryField` |
| plot | xirhapa | app: ts.ts `shapeCategoryHomePlot` |
| staple crops | swibyariwa swa nkoka | Based on ts.ts `shapeCategoryStapleCropPlot` ("Xirhapa xa swakudya swa nkoka") |
| garden bed | mubhedhi | app: drafts |
| raised bed | mubhedhi lowu tlakukeke | Descriptive |
| double-reach bed | mubhedhi lowu fikeleriwaka hi matlhelo mambirhi | Descriptive. Explain with "(double-reach bed)" |
| keyhole bed | mubhedhi wa keyhole | Explain on first use: "mubhedhi wa xirhendzevutana lowu nga na ndlela yo nghena exikarhi (keyhole bed)" (check) |
| trench bed | mubhedhi wa mugodi wo leha | Descriptive. Explain with "(trench bed)" (check) |
| mandala garden | ntanga wa mandala | Loan word. Explain: "ntanga wa swirhendzevutana" (check) |
| tyre garden | ntanga wa matayere | (check) |
| row | layini / milayini | app: ts.ts `windbreakRowSystem` |
| spacing (between plants) | mpfhuka exikarhi ka swimilana | (check) |
| food forest | khwati ra swakudya | Explain on first use: "mirhi, swihlahla na swimilana swa swakudya leswi byariweke swin'we ku fana na khwati (food forest)" (check) |
| guild (plant guild) | ntlawa wa swimilana | app: ts.ts `allSectionPlantGuilds` ("Mintlawa ya Swimilana") |
| layers (of a food forest) | swiyenge | app: ts.ts `layersButtonOpen` (map layers) (check) |
| canopy (tall-tree layer) | xiyenge xa ehenhla xa mirhi leyi lehaka | Descriptive. Explain with "(canopy)" |
| understory | mirhi leyitsongo ya le hansi ka leyikulu | Descriptive. Explain with "(understory)" |
| windbreak / shelter belt | xisivela-moya / swisivela-moya | app: ts.ts `allSectionWindWindbreaks`, `windbreakDesignHeader`, `insightHighWind`, drafts (*xisirhelelo xa mheho* replaced 2026-09-26) |
| living fence / hedge | lufenisi leri hanyaka | Descriptive (check) |
| fence | lufenisi | app: ts.ts `sectionFencing` |
| to prune | ku tsema marhavi | Descriptive (check) |
| to graft | ku hlanganisa mirhi | Descriptive. Explain with "(grafting)" (check) |
| greenhouse / plastic tunnel | yindlu ya swimilana / thanele ya plastiki | app: ts.ts `infraGreenhouse` |
| shade cloth | lapi ra ndzhuti | Drafts keep "shade cloth". ts.ts `infraShadeTunnel` has "Thanele ya ndzhuti" (check) |
| to harvest | ku tshovela | app: drafts (*ntshovelo*), ts.ts My Records (`myRecordsSaveHarvest` etc.). Do not use *kotula* (isiZulu/siSwati; removed from ts.ts 2026-09-26) |
| weeds | nhova | (check). In drafts *nhova* means "wild land" |
| grass | byanyi | (check) |

## 7. Crop names

| English | Xitsonga | Notes |
|---|---|---|
| maize | mavele | app: ts.ts `cropGrainMaize` (check). Drafts held the maize term back for review |
| sorghum | mabele | (check). May be confused with *mavele* |
| millet | nyawuti / milete | (check) |
| beans | tinyawa | (check) |
| cowpea | dlodlo / tinyawa | (check) |
| groundnut / peanut | timanga | (check) |
| jugo bean / Bambara groundnut | tindluwa | (check) |
| pumpkin | rhanga / marhanga | (check) |
| watermelon | xibehe | (check) |
| potato | zambala / tapula | (check). Both forms are heard |
| sweet potato | patata leyi nyanganyelaka | Descriptive (check) |
| cabbage | khavichi | Loan word (check) |
| spinach / Swiss chard | xipinichi | Loan word (check) |
| tomato | tamatisi / matamatisi | Loan word (check). ts.ts `myRecordsCropSalePlaceholder` now says *Matamatisi* (was *Tidomasi*, which should not be used) |
| onion | nyala / anyanisi | (check) |
| carrot | kherotsi | Loan word (check) |
| lettuce | letisi | Loan word (check) |
| peas | tiphiza | Loan word (check) |
| cucumber | khukhamba / makhukhamba | Loan word (check) |
| gourd / calabash | xikutsu / swikutsu | Explain with "(gourds)" (check) |
| aloe | aloe | Kept as loan ("swimilana swa aloe swa ndhavuko"); a Xitsonga name is needed (check) |
| amaranth (wild spinach) | theperi / vowa | (check) |
| banana | vanana | (check) |
| mango | manga | (check) |
| pawpaw / papaya | phapayi | Drafts keep "pawpaw" (check) |
| citrus / orange | lamula / orenji | (check). Drafts keep "citrus" |
| marula | nkanyi (tree) / makanyi (fruit) | (check) |
| moringa | moringa | Loan word |
| fodder | swakudya swa swifuwo | app: ts.ts `cropFodder` |

## 8. Animals, insects and pests

| English | Xitsonga | Notes |
|---|---|---|
| livestock | swifuwo | app: ts.ts `sectionLivestock` |
| animals | swiharhi | app: drafts, ts.ts `allSectionAnimalsLivestock` |
| chickens | tihuku | app: ts.ts `livestockChickens` |
| ducks | tidada | Loan word (check) |
| goats | timbuti | app: ts.ts `livestockGoats` |
| cattle / cow | tihomu / homu | app: ts.ts `livestockCattle`, `landPrepAnimalLabel` |
| pigs | tinguluve | app: ts.ts `livestockPigs` |
| sheep | tinyimpfu | (check) |
| donkey | mbhongolo | app: ts.ts `landPrepAnimalLabel` |
| rabbits | mpfundla / timpfundla | (check). *Mpfundla* is also the hare |
| bees | tinyoxi | app: ts.ts `livestockBees` |
| beekeeping | ku fuya tinyoxi | Descriptive |
| beehive | yindlu ya tinyoxi | Descriptive. Explain with "(beehive)" (check) |
| honey | vulombe | (check) |
| kraal / animal pen | xivala | app: ts.ts `infraLivestockKraal` |
| chicken run / chicken house | xivala xa tihuku | app: drafts |
| chicken tractor / animal tractor | xivala lexi fambaka | Descriptive. Explain with "(chicken tractor)" |
| grazing / pasture | madyelo | app: ts.ts `shapeCategoryGrazing` |
| to graze / herd | ku risa | app: drafts |
| overgrazing | ku risa ku tlula mpimo | Descriptive (check) |
| birds | swinyenyani | app: drafts |
| pests | swivungu (swo onha) | app: ts.ts `challengePests` ("Swivungu na mavabyi") |
| plant diseases | mavabyi ya swimilana | app: ts.ts `challengePests` |
| pesticide | swidlayi swa swivungu | app: ts.ts `practiceConventionalDesc` |
| weedkiller / herbicide | swidlayi swa nhova | Descriptive, follows *swidlayi swa swivungu* (check) |
| fly larvae | swivungu swa tinhongana | *nhongana* = fly (check) |
| caterpillar / butterfly | xivungu / phaphatana | Principle 12 (check) |
| nectar and pollen | swakudya swa swiluva (nectar na pollen) | Descriptive, English kept in brackets (check) |
| natural spray | murhi wo fafazela wa ntumbuluko | Descriptive (check) |
| insects | swivungwana | (check) |
| beneficial insects | swivungwana leswi pfunaka | Descriptive (check) |
| predator | xiharhi lexi dyaka swin'wana | Descriptive. Explain on first use: "xiharhi kumbe xivungwana lexi dyaka swivungu swo onha (predator)" |
| pollinators | swivungwana leswi pfunaka swiluva ku veka mihandzu | Descriptive. Explain with "(pollinators)" (check) |
| ladybird | ladybird | Loan word. Explain: "xivungwana xo tshwuka lexi dyaka aphid" (check) |
| aphids | aphid | Loan word. Explain: "swivungwana leswitsongo leswi mamaka ximilana" (check) |
| caterpillar / cutworm | xivungu xa matluka / xivungu xo tsema swimilana | Descriptive (check) |
| termites | muhlwa | (check) |
| ants | switsotswana | (check) |
| snails / slugs | tihunyi / slug | (check). Uncertain |
| frogs | swiketlane | (check) |
| lizards | mpfalabyana | (check) |
| spiders | vasasavi | (check) |
| companion planting | ku byala swimilana leswi pfunanaka | Descriptive. Explain with "(companion planting)" |
| crop rotation | ku hundzuluxa swibyariwa | app: ts.ts `allSectionCropRotation` ("Ku Hundzuluxa Swakudya"). Either noun works |
| trap crop | ximilana xo phasa swivungu | Descriptive. Explain with "(trap crop)" |
| intercropping | ku byala swibyariwa swo hambana swin'we | Descriptive |
| agroforestry | ku rima mirhi, swibyariwa na swifuwo swin'we | Descriptive. Explain with "(agroforestry)" (check) |
| monoculture | ku byala muxaka wun'we ntsena | Descriptive |
| slugs and snails | ti-slug na tisinayele | Loan words, used in ch. 8–9 instead of *tihunyi* above, which is the word for firewood (§11). Reviewer to decide (check) |
| owl / barn owl | xikhova / swikhova | (check) |
| eagle | gama / magama | (check) |
| jackal | mhungubye / timhungubye | (check) |
| rats and mice | makondlo | (check) |
| snake | nyoka / tinyoka | (check) |
| scorpion | tisikopiyoni | Loan word (check) |
| mosquito | nsuna / tinsuna | (check) |
| fly (insect) | nhongana / tinhongana | (check) |
| mole | mfuku / timfuku | (check) |
| dragonfly / toad | ti-dragonfly / ti-toad | Loan words (check) |

## 9. Ecology

| English | Xitsonga | Notes |
|---|---|---|
| ecosystem | ntumbuluko lowu hanyaka swin'we | Descriptive. Explain with "(ecosystem)" (check) |
| biodiversity | ku hambana-hambana ka swihanyi | Drafts have "ku hambana-hambana ka swihanyisi". The reviewer should confirm *swihanyi* or *swihanyisi* (check) |
| diversity | ku hambana-hambana | app: drafts |
| habitat | ndhawu yo tshama ya swiharhi | Descriptive. Explain with "(habitat)" |
| succession (natural) | ku landzelelana ka swimilana | Descriptive. Explain with "(succession)" |
| pioneer plants | swimilana swo rhanga | Descriptive (check) |
| forest | khwati | (check) |
| grassland | nhova ya byanyi | Descriptive. Explain with "(grassland)" (check) |
| land degradation | ku onhaka ka misava | Follows *misava leyi onhakeke* (check) |
| wild / uncultivated land (Zone 5) | nhova | app: drafts ("Zone 5 yi tshikiwile yi ri nhova") |
| balance (ecological) | ku ringanana ka ntumbuluko | Descriptive (check) |
| producers / consumers / decomposers | vahumesi / vadyi / vabolisi | Coined in ch. 9. Explain with the English in brackets (check) |
| food chain | nketani ya swakudya / tinketani ta swakudya | (check) |
| ecosystem services | mimpfuno ya ntumbuluko | Explain with "(ecosystem services)" (check) |
| pollination | ku hluvukisa swiluva | Explain with "(pollination)" (check) |
| grassland | madyelo ya byanyi | Explain with "(grassland)" (check) |
| bush encroachment | ku nghenelela ka swihlahla | Explain with "(bush encroachment)" (check) |
| hedgerow | lufenisi leri hanyaka / malufenisi lama hanyaka | Same as "living fence" (§6). Explain with "(hedgerows)" (check) |
| polyculture | swibyariwa swo tala swin'we | Explain with "(polycultures)" (check) |

## 10. Tools

| English | Xitsonga | Notes |
|---|---|---|
| tools | switirhisiwa | app: ts.ts `toolsSectionLabel` |
| hand tools | switirhisiwa swa voko | app: ts.ts `landPrepHandToolsLabel` |
| spade / shovel | xifosholo | app: ts.ts `landPrepHandToolsLabel` |
| garden fork | foroko | app: ts.ts `landPrepHandToolsLabel` |
| hoe | xikomu | app: ts.ts `landPrepHandToolsLabel` (changed from *khuwu* 2026-09-26) (check) |
| axe | xihloka | (check) |
| wheelbarrow | kiriwa | Loan word (check) |
| watering can | xibya xo cheleta | app: ts.ts `waterDeliveryBucketDesc` |
| bucket | bakiti / xikotlo | app: drafts (*bakiti*), ts.ts `waterDeliveryBucketDesc` (*xikotlo*) |
| tape measure | thepi yo pima | app: drafts |
| compass | khompasi | app: drafts |
| tractor | thirakitara | app: ts.ts `landPrepTractorLabel` (changed from "Thlakela" 2026-09-26) (check) |

## 11. Home and appropriate technology

| English | Xitsonga | Notes |
|---|---|---|
| appropriate technology | thekinoloji leyi faneleke | Explain on first use: "switirhisiwa swo olova, swa ntsengo wa le hansi, leswi vanhu va nga swi endlaka no swi lunghisa (appropriate technology)" (check) |
| firewood | tihunyi | (check) |
| charcoal / coal | malahla | (check) |
| smoke | musi | (check) |
| to cook | ku sweka | |
| stove | xitofu | Loan word |
| rocket stove | xitofu xa rocket | Explain on first use: "xitofu lexi tirhisaka tihunyi titsongo naswona xi humesaka musi wutsongo (rocket stove)" |
| wonder bag | saka ro sweka (wonder bag) | Explain on first use: "saka leri hlayisaka ku hisa leswaku swakudya swi hetisa ku vupfa handle ka ndzilo" (check) |
| solar cooker | xitofu xa dyambu | Descriptive. Explain with "(solar cooker)" |
| solar dryer | xiomisi xa dyambu | Descriptive. Explain with "(solar dryer)" (check) |
| solar geyser | giza ya dyambu | Loan word + descriptive (check) |
| solar power / solar panel | matimba ya dyambu / phaneli ya dyambu | app: ts.ts `allSectionSunSolar` |
| electricity | gezi | app: drafts |
| biogas | gasi ya vulongo | Explain on first use: "gasi yo sweka leyi humaka eka vulongo na thyaka ra swakudya (biogas)" (check) |
| biogas digester | xiendli xa gasi ya vulongo | Descriptive. Explain with "(biogas digester)" (check) |
| energy saving | ku ponisa matimba | (check) |
| fuel (petrol, diesel) | mafurha | (check) |
| fossil fuels | mafurha ya le hansi ka misava | Descriptive. Explain with "(fossil fuels)" (check) |
| storage shed | khele ro hlayisa | app: ts.ts `infraStorageShed` |

## 12. Safety words

| English | Xitsonga | Notes |
|---|---|---|
| safety / safe | vuhlayiseki / swi hlayisekile | app: drafts |
| Safety / Tip / Note (callout labels) | Vuhlayiseki / Xiletelo / Xitsundzuxo | Bold labels at the start of callout boxes (check) |
| danger / risk | khombo | app: ts.ts `statFrostRisk`, drafts |
| poison / toxic | chefu / swa chefu | (check) |
| explosive (gas) | leswi nga buluka | Descriptive (check) |
| ventilation (fresh air) | ku nghena ka moya lowuntshwa | Descriptive (check) |
| allergy (to bee stings) | ku nga amukeli ku lumiwa hi nyoxi | Descriptive (check) |
| children | vana | |
| cover (a tank or pond) | funengeta | app: drafts ("Hlayisa thanki yi funengetiwile") |

## App clean-up log (2026-09-26)

Claude cleaned up the Xitsonga app wording on 2026-09-26. This is still a **machine draft**: nothing here was checked by a fluent speaker. Items marked **(check)** are the least certain and need a decision from the reviewer. English source strings and keys were not changed.

### What changed and why

- **Wrong-language strings.** `lib/locales/ts.ts` lines ~527–724 (climate cards, climate zones, home screen, navigation, My Records, AI report, POPIA consent) were written with siSwati, isiZulu and Sepedi words (*manzi, metsi, mvula, xichelo, xirhanguri, nhlanu, tihlahla, kotula, rhengela, Tidomasi, Nkulukumba, hakuna, vala, mapa*). Every string there was re-translated from the English source (`T_en` in `lib/i18n.tsx`, same key). Several also had the wrong meaning (for example `homeStatTemp` said "Ku tsema" = to cut, `popiaGetStarted` said "Tshika" = stop/cancel, `myRecordsCropLabel` said "Rito" = word, `navTaskPlanner` said "swirho" = members, `insightLowSoilCarbon` followed an older English text).
- **Rest of ts.ts.** Contour layer *Mipfhuka* (= distances) → *Tikhanthura*; winter *xixika* → *vuxika*; hoe *khuwu* → *xikomu*; tractor *Thlakela* → *Thirakitara*; compost, kraal manure, greywater aligned with this glossary; `buttonBack` / `reportToolbarBack` said "Hlwela emahlweni" (= be late ahead) → "Tlhelela endzhaku"; typo "emhlweni" fixed.
- **Course drafts.** *tizoniti / tisekitara* → *ti-zone / ti-sector*; principle 9 "swa le hansi" (= low) → "swo nonoka" (slow); *ti-swale / swale* → *xisele / swisele*; *mheho* → *moya*; *xisirhelelo xa mheho* → *xisivela-moya*; *jarata* → *ntanga*; *ximilani* → *ximilana*; *ndzelekani / ndzilekana* → *ndzilakano*; *vutsireledzi* → *nsirhelelo*; *compost / manyoro ya compost* → *khompositi / monyolo wa khompositi*; *tangi / matangi* → *thanki / tithanki*; *gavhu* → *gatara*; greywater and mulch given Xitsonga with the English in brackets.
- **Swale lesson translated.** `water-harvesting-l1` title, picture description, body and key points 0 and 2 were exact English holds. They are now Xitsonga machine drafts (status `machine-draft`) and their 14 hold entries were removed. The two l1 quiz items stay as exact-English holds (earthwork safety judgement). The Water Harvesting draft is not yet wired to learners (`lib/course-localization.ts` only loads the Introduction and Reading the Landscape drafts), so nothing unreviewed reaches a learner from this change. Safety and water-law holds in lessons 2–4, and every hold in the live Introduction and Reading the Landscape drafts, were left as they are.

### New or changed app terms (add to the tables after review)

| English | Xitsonga | Notes |
|---|---|---|
| mentor | muleteri | From *ku letela* (to train/guide). Replaces *Mulayeri*. *Mulayi* (adviser) is an alternative (check) |
| student / learner | mudyondzi / vadyondzi | Replaces *Xifundzi* (not Xitsonga) |
| funder | museketeri wa mali | Descriptive; replaces *Mutiveki* (check) |
| farmer (role label) | murimi | Replaces *Nkulukumba* |
| dashboard | dashboard / tidashboard | Loan word; replaces *swiboto / boto* (check) |
| records (My Records) | tirhekhodo | Loan word; replaces *Swirekodo / Swirekhodi* (check) |
| to sell / sale | ku xavisa | Replaces Sepedi-style *rhengela / xirhengelo* |
| buyer | muxavi |  |
| income | muholo | Matches ts.ts `goalGenerateIncomeLabel`; replaces *xuma* |
| invoice | invoyisi | Loan word (check) |
| hour(s) | awara / tiawara | Replaces *tihora* |
| desert | mananga |  |
| steppe (dry grassland plain) | rivala ra byanyi | Descriptive (check) |
| humid subtropical | subtropical yo tsakama | Loan + descriptive (check) |
| protection | nsirhelelo | Replaces *vutsireledzi* (Tshivenḓa-like) |
| survey / questionnaire | mpapa wa swivutiso | Matches ts.ts `siteQuestionnaireTitle` |
| adviser (trained local) | mutsundzuxi | Used in `water-harvesting-l1` (check) |
| to slow (water) | ku nonokisa | Used in `water-harvesting-l1` (check) |
| terraces | titerasi (terraces) | Loan word (check) |
| grass barriers | mindzilakano ya byanyi (grass barriers) | Descriptive (check) |
| plough | pulawu | Loan word (check) |
| programme (NGO) | nongonoko / minongonoko | (check) |
| back (button) | tlhelela endzhaku |  |
| get started | sungula | Matches ts.ts `start` |
| optional | (loko u lava) | Matches ts.ts `shapeNamingLinkToPlaceHeader` |

### `lib/locales/ts.ts` — every string changed (old → new)

- `layersButtonCollapsedContours`: "Mipfhuka" → "Tikhanthura"
- `layerToggleContours`: "Mipfhuka" → "Tikhanthura"
- `guideMapLayersDesc`: "Cinca sathelayiti / topo kutani u pfula mipfhuka na vutlakuko." → "Cinca sathelayiti / topo kutani u pfula tikhanthura na vutlakuko."
- `statWinterMin`: "Vutsongo bya xixika" → "Vutsongo bya vuxika" **(check)**
- `windWinterLabel`: "Xixika (wu hunga WU HUMA EKA)" → "Vuxika (wu hunga WU HUMA EKA)" **(check)**
- `stepLandAndSoil`: "Misava na misava" → "Ndhawu na misava"
- `goalRestoreTheLandDesc`: "Swakudya swo funengeta, ku endla monyolo, ku pfuxeta" → "Swimilana swo funengeta misava, ku endla khompositi, ku pfuxeta"
- `waterSourceGreyWater`: "Mati lama tirhisiweke" → "Mati lama tirhisiweke (greywater)"
- `landPrepHandToolsLabel`: "Switirhisiwa swa voko (xifosholo, foroko, khuwu)" → "Switirhisiwa swa voko (xifosholo, foroko, xikomu)" **(check)**
- `landPrepTractorLabel`: "Thlakela / hi muchini" → "Thirakitara / hi muchini" **(check)**
- `landPrepAnimalDesc`: "Khuwu kumbe xirimi xa ndhavuko" → "Pulawu kumbe xirimi xa ndhavuko" **(check)**
- `soilAmendmentCompost`: "Monyolo" → "Monyolo wa khompositi" **(check)**
- `soilAmendmentKraalManure`: "Manyhi ya xivala" → "Vulongo bya xivala"
- `cropGrainMaize`: "Mavele / mavele" → "Timbewu / mavele" **(check)**
- `infraCompostBay`: "Ndhawu ya monyolo" → "Ndhawu ya khompositi"
- `practiceFullyOrganicDesc`: "A ku na swakucha, swi sekeriwe eka monyolo" → "A ku na khemikhali, swi sekeriwe eka khompositi"
- `practiceConventionalDesc`: "Ku tirhisiwa monyolo wa swakucha na swidlayi swa swivungu" → "Ku tirhisiwa monyolo wa khemikhali na swidlayi swa swivungu"
- `buttonBack`: "Hlwela emahlweni" → "Tlhelela endzhaku"
- `reportToolbarBack`: "Hlwela emahlweni" → "Tlhelela endzhaku"
- `climateZone`: "Ndhawu ya mbhete wa moya" → "Muxaka wa maxelo"
- `goodForGrowing`: "Ku lulamile ku byala" → "Swi kahle ku kurisa"
- `rainfallMmMonth`: "Mvula — mm / n'hweti" → "Mpfula — mm / n'hweti"
- `monthlyTempC`: "Ku tshisa ka n'hweti — °C" → "Tempheracha ya n'hweti — °C"
- `sunlightHoursDay`: "Nyimpi ya dyambu — tihora / siku" → "Dyambu — tiawara / siku"
- `frostGrowingSeason`: "Xichelo & nkarhi wa ku kula" → "Xirhami & nguva yo kurisa"
- `wantFullClimateReport`: "U lava xiviko lexinene xa mbhete wa moya?" → "U lava xiviko lexi heleleke xa maxelo?"
- `climateReportDesc`: "Masiku ya xichelo, ET, xifuwo xa vuvabyi & khalenda ya ku byala" → "Masiku ya xirhami, ET, khombo ra mavabyi & khalendara yo byala"
- `prevailingWind`: "Lowu tfumaka" → "Moya lowu tolovelekeke" **(check)**
- `inWinter`: "xirhanguri" → "hi vuxika"
- `frostFreePrefix`: "Ku hava xichelo ≈" → "A ku na xirhami ≈"
- `lightFrostPrefix`: "Xichelo lexitsongo:" → "Xirhami lexitsongo:"
- `plantTenderMidAug`: "Byala tirimba ta mbyafuri kusukela pakati ka Aug" → "Byala swimilana leswi nga tiyeliki xirhami ku sukela exikarhi ka Awu" **(check)**
- `winterLowPrefix`: "Ehansi xirhanguri ≈" → "Le hansi hi vuxika ≈"
- `summerHighPrefix`: "Ehenhla nhlanu ≈" → "Le henhla hi ximumu ≈"
- `lifeGuideIndigenousPlants`: "Tirimba ta ntiyiso leti akariwaka" → "Swimilana swa ndhavuko swo katsa"
- `lifeGuideVegetables`: "Swirivo swa mbhete lowu wa moya" → "Matsavu ya maxelo lawa"
- `lifeGuideFruitTrees`: "Tihlahla ta swakudya swa misava" → "Mirhi ya mihandzu"
- `lifeGuideIndigenousFruit`: "Swakudya swa ntiyiso" → "Mihandzu ya ndhavuko"
- `lifeGuideNutTrees`: "Tihlahla ta manati & swiriso" → "Mirhi ya tinati & swibyariwa"
- `lifeGuideAnimalSystems`: "Switirhisiwa swa swifuwo" → "Maendlelo ya swifuwo"
- `climatePatternWinter`: "Mvula ya xirhanguri" → "Mpfula ya vuxika"
- `climatePatternSummer`: "Mvula ya nhlanu" → "Mpfula ya ximumu"
- `climatePatternYearRound`: "Mvula ya lembe hinkwaro" → "Mpfula ya lembe hinkwaro"
- `climateFrostExpected`: "Xichelo xi laveka" → "Xirhami xi languteriwile"
- `climateLightFrost`: "Xifuwo xa xichelo lexitsongo" → "Khombo ra xirhami lexitsongo"
- `climateFrostFree`: "Ku hava xichelo" → "A ku na xirhami"
- `climateWetLabel`: "Manzi" → "Ku tsakama"
- `climateDryLabel`: "Omile" → "Ku oma"
- `insightSemiArid`: "Ndhawu leyi omeke — {mm} mm/yr. Ku kuma metsi ku fanele ku etla emahlweni ka ku byala tihlahla ta swakudya." → "Ndhawu leyi omeke hi xiphemu — {mm} mm/lembe. Ku hlengeleta mati ku fanele ku rhanga, emahlweni ka ku byala mirhi ya swakudya."
- `insightModerateRain`: "{mm} mm/yr — mvula ya xiyimo xa xikati. Mulch na maswali ya atolosa nkarhi lowu sebenzaka wa ku kula swinene." → "{mm} mm/lembe — mpfula ya xikarhi. Xifunengeto (mulch) na swisele (swales) swi lehisa ngopfu nkarhi lowu u nga kurisaka ha wona."
- `insightStrongRain`: "{mm} mm/yr — mvula leyi tima. Aka soil-carbon ku hlayisa kelelo ematikwini ya ku oma." → "{mm} mm/lembe — mpfula yo tala. Tlakusa khaboni ya misava leswaku yi khoma ku tsakama hi tin'hweti to oma."
- `insightFrostExpected`: "Xichelo xi laveka ({tempC}°C ku tshika ko fika tlase ka xirhanguri). Hlayisa tirimba to tika Aug–Sep hi tikhurumeto na tindhawu to phakama to lebisaka enyakatfo." → "Xirhami xi languteriwile ({tempC}°C le hansi hi vuxika). Sirhelela swibyariwa leswi nga tiyeliki xirhami hi Awu–Sep hi swifunengeto na tindhawu titsongo to hisa leti languteke en'walungu."
- `insightLightFrost`: "Xifuwo xa xichelo lexitsongo ({tempC}°C ku tshika ko fika tlase ka xirhanguri). Byala tihlahla leti sungulaka ku tika eka mabindzi lawa phakameke kumbe eka tindzhuti to lebisaka enyakatfo." → "Khombo ra xirhami lexitsongo ({tempC}°C le hansi hi vuxika). Byala mirhi leyi chavaka xirhami eka mibhedhi leyi tlakukeke kumbe eka ndhawu yo rhelela leyi languteke en'walungu."
- `insightFrostFree`: "Ku hava xichelo lembe hinkwaro ({tempC}°C ko tlase). Tihlahla ta swakudya ta tropiki ti tirha apha." → "A ku na xirhami lembe hinkwaro ({tempC}°C le hansi). Mirhi ya swakudya ya tindhawu to hisa (tropical na subtropical) yi nga mila kahle laha."
- `insightHighWind`: "Ku langutiseka ka moya wo tika ({kmh} km/h gama). Tikhuselo ta moya ehenhla ka {dir} i vuxokoxoko byo xonga bya ku sungula." → "Moya wa matimba ({kmh} km/h hi xiyimo). Swisivela-moya etlhelweni ra {dir} hi swona swo sungula leswi nga ta ku vuyerisa ngopfu."
- `insightModerateWind`: "Moya wa xiyimo xa xikati wu huma {dir}. Murhi wo le mossini wa xiyimo xa moya wu hunguta ku gandza ka swiriso swinene." → "Moya wa xikarhi wu huma eka {dir}. Layini yin'we ya swihlahla (hedge) etlhelweni leri moya wu taka hi rona yi hunguta ngopfu ku karhateka ka swibyariwa." **(check)**
- `insightLowSoilCarbon`: "Khaboni ya misava yo fika tlase ({oc}%). Khompose, rimilobye ra kraal na vundzhe byo tika swi ta phindha swiphemu swa wena ematikwini mambirhi." → "Khaboni ya misava leyi vikiweke ({oc}%). Kambela laha yi humaka kona na xikambelo xa misava; swilo swa ntumbuluko leswi faneleke swi nga pfuna, kambe ku engeteleka ka ntshovelo a ku tiyisekisiwi."
- `insightGoodSoilCarbon`: "Khaboni ya misava leyi amukelekaka ({oc}%). Hlayisa hi khompose na ku limela ko fika tlase ku hlayisa swiphetho." → "Khaboni ya misava leyi amukelekaka ({oc}%). Yi hlayise hi khompositi na ku rima katsongo leswaku u nga lahlekeriwi hi leswi u swi kumeke."
- `climateRainfallInsight`: "Mvula yo tala yi na {wet}. Hlayisa metsi ya sitombu ku pfumela nkarhi wa ku oma wa {dry}." → "Mpfula yo tala yi na hi {wet}. Hlayisa mati ya swidzedze leswaku ma ku hundzisa nguva yo oma ya {dry}."
- `reportEvidenceDocsLabel`: "Vumbhoni & tiphepa" → "Vumbhoni & matsalwa"
- `reportFullLibraryLink`: "Laburari hinkwayo" → "Layiburari hinkwayo" **(check)**
- `reportGroupWater`: "Manzi" → "Mati"
- `reportGroupStructures`: "Tivumba & ku fikelela" → "Swiako & ku fikelela"
- `reportGroupSoil`: "Misava & tindhawu ta ku kula" → "Misava & mibhedhi yo byala"
- `reportGroupTrees`: "Tihlahla & tirimba leti nga kona" → "Mirhi & swimilana leswi nga kona"
- `reportGroupAnimals`: "Switirhisiwa swa swifuwo" → "Maendlelo ya swifuwo"
- `reportGroupSitePhotos`: "Tifoto ta ndhawu" → "Swifaniso swa ndhawu"
- `reportAddWater`: "Engetela manzi" → "Engetela mati"
- `reportAddStructures`: "Engetela tivumba & ku fikelela" → "Engetela swiako & ku fikelela"
- `reportAddSoil`: "Engetela misava & tindhawu ta ku kula" → "Engetela misava & mibhedhi yo byala"
- `reportAddTrees`: "Engetela tihlahla & tirimba leti nga kona" → "Engetela mirhi & swimilana leswi nga kona"
- `reportAddAnimals`: "Engetela switirhisiwa swa swifuwo" → "Engetela maendlelo ya swifuwo"
- `reportItemSingular`: "xintshuxo" → "nchumu"
- `reportItemPlural`: "swintshuxo" → "swilo"
- `reportPhotosCount`: "{n} tifoto" → "swifaniso swa {n}"
- `zoneHumidSubtropicalSummerRain`: "Ntango ya subtropical leyi na mpfula — mpfula ya nhloboyi" → "Subtropical yo tsakama · mpfula ya ximumu" **(check)**
- `zoneHumidSubtropicalMistBelt`: "Ntango ya subtropical leyi na mpfula — bele ra mhunguti" → "Subtropical yo tsakama · ndhawu ya nkungu" **(check)**
- `zoneMediterraneanCoastal`: "Ntango ya Mediterranean — enkarhini wa lwandle" → "Mediterranean · kusuhi na lwandle"
- `zoneMediterraneanMaritime`: "Ntango ya Mediterranean — ya lwandle" → "Mediterranean · maxelo ya lwandle"
- `zoneHumidSubtropical`: "Ntango ya subtropical leyi na mpfula" → "Subtropical yo tsakama" **(check)**
- `zoneTemperateOceanic`: "Ntango ya temperate ya lwandle" → "Maxelo ya xikarhi · ya lwandle" **(check)**
- `zoneSemiAridHotDesert`: "Ntango leyi pfumala mpfula — hahlamarhi leri tshisaka" → "Yo oma hi xiphemu · mananga yo hisa" **(check)**
- `zoneSemiAridColdDesert`: "Ntango leyi pfumala mpfula — hahlamarhi leri titimaka" → "Yo oma hi xiphemu · mananga yo titimela" **(check)**
- `zoneSemiAridHotSteppe`: "Ntango leyi pfumala mpfula — nyika ya stephe leyi tshisaka" → "Yo oma hi xiphemu · rivala ra byanyi ro hisa" **(check)**
- `zoneSemiAridColdSteppe`: "Ntango leyi pfumala mpfula — nyika ya stephe leyi titimaka" → "Yo oma hi xiphemu · rivala ra byanyi ro titimela" **(check)**
- `zoneAlpineMontane`: "Ntango ya tintshava" → "Maxelo ya tintshava"
- `summaryWarmWetSummer`: "Nhloboyi yi tshisa naswona yi na mpfula, xirhanguri xi phola naswona xi omile, ku na mhunguti enkarhini wa matateni. Mpfula ya nhloboyi leyi tshembhekilaka na nkarhi mule lowu pfumalaka ku helela ka xirhanguri swi lava ku tsarhiwa mimela vu-nyaka hinkwawu — endlela plani xa nkarhi wo oma wa xirhanguri na zimphunga za ntambama nhloboyi." → "Ximumu xo hisa xi ri na mpfula, na vuxika lebyi nga titimeliki ngopfu naswona byi omile, ku ri na nkungu wa nimixo minkarhi yo tala. Mpfula ya ximumu leyi tshembekaka na nguva yo leha leyi nga riki na xirhami swi ku pfumelela ku kurisa nkarhi wo tala wa lembe — kunguhata hi ku ya hi vuxika byo oma na swidzedze swa ximumu swa nindzhenga."
- `summaryReliableRainfall`: "Mpfula yi tshembheka vu-nyaka hinkwawu na vuximunhana byo faneleka naswona ku hava nkarhi mule wo oma. Swi lava ku tlhava minhlampfi mingi hi ku ya emahlweni — languta vusweti bya mpfula na timbetwa ta timhandzu emahlweni ka nxangu wa xombexi." → "Mpfula leyi tshembekaka lembe hinkwaro, mahiselo lama ringaneleke naswona a ku na nguva yo leha yo oma. Swi kahle ku kurisa swibyariwa swo tala nkarhi hinkwawo — khathalela ku tsakama ka moya na mavabyi, ku nga ri dyandza."
- `summaryWetMildWinter`: "Xirhanguri xi na mpfula naswona xi phola, nhloboyi yi tshisa naswona yi oma. Nkarhi wa mpfula ya xirhanguri yo tshila i swa nkarhi wa ku tsarhiwa mimela loku kulu; nhloboyi yi lava timhandzu leti xiximaka xombexi kumbe leti xisiwaka." → "Vuxika bya mpfula lebyi nga titimeliki ngopfu, na ximumu xo hisa naswona xi omile. Nguva ya mpfula leyi titimelaka hi yona nkarhi wa wena lowukulu wo kurisa; hi ximumu u lava swibyariwa leswi tiyelaka dyandza kumbe leswi cheletiwaka."
- `summarySemiAridSteppe`: "Nyika ya stephe leyi pfumalaka mpfula — mpfula ya xikongomelo na ku tshika loku kulu ka nkarhi. Ku hlengeleta mati na ku tirhisa swixelelo swi rhangeriwa ku yelelela nkarhi wa ku mela." → "Rivala ra byanyi leri omeke hi xiphemu — mpfula ya xikarhi leyi cincaka ngopfu hi minguva. Ku hlengeleta mati na ku funengeta misava (mulch) i swa nkoka leswaku u lehisa nkarhi wo kurisa."
- `summaryAridDesert`: "Hahlamarhi ra ku pfumala mati — mpfula yo olova naswona leyi nga tshembhekiki. Ku hlengeleta mati ku fanele ku endliwa emahlweni ka ku tsarhiwa swakudya swi tano tirha." → "Makumu ya mananga lama omeke — mpfula yi le hansi naswona a yi tshembeki. Ku hlengeleta mati ku fanele ku lunghisiwa emahlweni ka loko u sungula ku humesa swakudya swo tala."
- `summaryHighAltitude`: "Xifundzankulu lexi hanyisekaka na xirhanguri xo titima na nkarhi mutsongo wa ku mela. Tirhisa tindzhawu tincunyana leti vangamaka dzuwa naswona u tirhise minhlobo leyi tshembhelaka xirhanguri." → "Ndhawu ya le henhla leyi nga na vuxika byo titimela na nguva yo kurisa leyi komeke. Tirhisa ngopfu tindhawu titsongo to hisa leti languteke dyambu, u tlhela u byala mixaka leyi tiyelaka xirhami."
- `surveySectionLabel`: "Nhluvukiso wa xifundzankulu" → "Mpapa wa swivutiso wa ndhawu"
- `surveyStepsOf6`: "{n} eka swigavo swa 6" → "Magoza {n} eka 6"
- `surveyOpenButton`: "Tata nhluvukiso" → "Tata mpapa wa swivutiso"
- `surveyUpdateButton`: "Hlayisa nhluvukiso" → "Pfuxeta mpapa wa swivutiso"
- `surveyGoalFood`: "Tshireletso ya swakudya" → "Vusirhelelo bya swakudya"
- `surveyGoalIncome`: "Tumbulula mali" → "Endla muholo"
- `surveyGoalSoil`: "Buyisela misava" → "Pfuxeta misava"
- `surveyGoalEducation`: "Xifundzankulu xa xikombo" → "Ndhawu yo kombisa" **(check)**
- `homeLastSite`: "Ndhawu ya makumu" → "Ndhawu yo hetelela"
- `homeReopenMap`: "Vula mapa nakambe" → "Pfula mepe nakambe"
- `homeStatRain`: "Mvula" → "Mpfula"
- `homeStatTemp`: "Ku tsema" → "Mahiselo"
- `homeStatASL`: "Nkondzo wa le henhla" → "Vutlakuko"
- `homeLimaSuggests`: "Lima yi ringeta" → "Lima u ringanyeta"
- `homeSurveyNew`: "Lavisisa ndhawu yintshwa" → "Kambela ndhawu yintshwa"
- `homeSurveyDesc`: "Veka pin naswona Lima yi ta hlaya mayelano ya ntima, misava na mati." → "Veka pini kutani Lima u ta hlaya maxelo, misava na mati ya kona."
- `homeOpenMap`: "Vula mapa" → "Pfula mepe"
- `homeQuickFinance`: "Imali" → "Timali"
- `homeQuickFinanceDesc`: "Nkuvo na swipheto" → "Muholo & tihakelo"
- `homeQuickStudyDesc`: "Khosi ya permaculture" → "Khoso ya permaculture"
- `homeQuickContact`: "Landzela" → "Vulavurisana" **(check)**
- `homeQuickContactDesc`: "Mulayeri · Nhlangano" → "Muleteri · Nhlangano" **(check)**
- `homeQuickJournal`: "Tsariwa ra siku" → "Buku ya nsimu"
- `homeQuickCropPlanner`: "Munyikisi wa Milaka" → "Pulani ya swibyariwa"
- `homeQuickCropPlannerDesc`: "Rindza nkarhi wa ku byala" → "Kunguhata nguva"
- `homeQuickMyRecords`: "Swirekodo Swa Mina" → "Tirhekhodo ta Mina" **(check)**
- `homeQuickMyRecordsDesc`: "Milaka na ku xava" → "Swibyariwa & ku xavisa"
- `homeDashboards`: "Swiboto swa vutihlamuleri" → "Tidashboard" **(check)**
- `homeDashboardsHide`: "Fihla" → "Tumbeta"
- `homeDashboardsSummary`: "Nkulukumba · Mulayeri · Nhlangano · Mutiveki · Xifundzi" → "Murimi · Muleteri · Nhlangano · Museketeri wa mali · Mudyondzi" **(check)**
- `homeRoleFarmerLabel`: "Nkulukumba" → "Murimi"
- `homeRoleFarmerDesc`: "Lavisisa ndhawu — ntima, misava, mati, switiviso swa AI" → "Xopaxopa ndhawu — maxelo, misava, mati, swiviko swa AI"
- `homeRoleMentorLabel`: "Mulayeri" → "Muleteri" **(check)**
- `homeRoleMentorDesc`: "Fambisa khosi, vitela tipolasi, pfumela nkucetelo" → "Fambisa khoso, endzela mapurasi, tiyisisa ku ya emahlweni ka vadyondzi"
- `homeRoleStudentLabel`: "Xifundzi" → "Mudyondzi"
- `homeRoleStudentDesc`: "Dyondza permaculture, nhangu ku ringana nhangu" → "Dyondza permaculture, goza hi goza"
- `homeRoleNGODesc`: "Boto ya nhluvukiso & tekelo M&E" → "Dashboard ya nongonoko & nkatsakanyo wa M&E"
- `homeRoleFunderLabel`: "Mutiveki" → "Museketeri wa mali" **(check)**
- `homeRoleFunderDesc`: "Languta mpfuneto hi ku hlaya ntsena" → "Languta vuyelo bya ntirho — ku hlaya ntsena"
- `homeSurveysLabel`: "Tilavisiso" → "Mipapa ya swivutiso"
- `homeSurveysDesc`: "Hlamula tilavisiso ta nsimu · Tinhlangano ti aka ti roma" → "Hlamula mipapa ya swivutiso ya nsimu · Minhlangano yi yi endla yi tlhela yi yi rhumela"
- `homeLimaVisionDesc`: "Teka swifaniso swa nsimu kumbe ku kotula — Lima yi swi hlaya" → "Teka xifaniso xa mubhedhi kumbe xa ntshovelo — Lima u xi hlaya"
- `homeFooter`: "ImbewuField · yi kulisiwa na wena" → "ImbewuField · yi kurisiwa na wena"
- `navSectionFarmTools`: "Switirhisiwa swa Ntelo" → "Switirhisiwa swa Purasi"
- `navTaskPlanner`: "Mulawuri wa Swirho" → "Pulani ya Mintirho"
- `navGardenSurvey`: "Vuneto bya Mpela-ntsha" → "Mpapa wa Swivutiso wa Ntanga"
- `navNGODashboard`: "Boto ya NGO" → "Dashboard ya Nhlangano" **(check)**
- `navMyAccount`: "Akhaonto ya Mina" → "Akhawunti ya Mina"
- `navCloseMenu`: "Vala menyu" → "Pfala menyu"
- `myRecordsTitle`: "Swirekhodi Swa Mina" → "Tirhekhodo ta Mina" **(check)**
- `myRecordsSubtitle`: "Leswi u byalaka · leswi u rhengelaka · mipfana ku suka eka mufundzisi wa wena" → "Leswi u swi byalaka · leswi u swi xavisaka · tidizayini leti humaka eka muleteri wa wena"
- `myRecordsSignInTitle`: "Ngena ku hlayisa swirekhodi swa wena" → "Nghena leswaku u hlayisa tirhekhodo ta wena"
- `myRecordsSignInBody`: "Landela leswi u byalaka ni leswi u rhengelaka — data ya wena yi va na wena." → "Landzelela leswi u swi byalaka ni leswi u swi xavisaka — datha ya wena yi tshama na wena."
- `myRecordsSignInButton`: "Ya ku ngena" → "Yana eku ngheneni"
- `myRecordsLogProductionHeader`: "Tsala ntlhelo" → "Tsala ntshovelo"
- `myRecordsCropLabel`: "Rito" → "Xibyariwa"
- `myRecordsCropPlaceholder`: "xik. Spinach" → "xik. Xipinichi" **(check)**
- `myRecordsCropSalePlaceholder`: "xik. Tidomasi" → "xik. Matamatisi" **(check)**
- `myRecordsKgHarvestedLabel`: "Kg leyi kotuleka" → "Kg leyi tshoveriweke"
- `myRecordsPhotoLabel`: "Xifaniso xa tintlhelo (a swi laveki)" → "Xifaniso xa ntshovelo (loko u lava)"
- `myRecordsProdValidationError`: "Vito ra rito na kg ya positive swi laveka." → "Vito ra xibyariwa na kg leyi tlulaka 0 swa laveka."
- `myRecordsSaveError`: "Ku hlayisa ku pfukile. Ringeta nakambe." → "Ku hlayisa ku tsandzekile. Ringeta nakambe."
- `myRecordsSaveHarvest`: "Hlayisa kotulo" → "Hlayisa ntshovelo"
- `myRecordsLogSaleHeader`: "Tsala xirhengelo" → "Tsala ku xavisa"
- `myRecordsKgSoldLabel`: "Kg leyi rhengelekeke" → "Kg leyi xavisiweke"
- `myRecordsAmountLabel`: "Xifundzisi (R)" → "Mali (R)"
- `myRecordsBuyerLabel`: "Murhengeli (a swi laveki)" → "Muxavi (loko u lava)"
- `myRecordsBuyerPlaceholder`: "xik. Ntshavo" → "xik. Makete"
- `myRecordsSaleValidationError`: "Rito, kg na xifundzisi (R) swi laveka." → "Xibyariwa, kg na mali (R) swa laveka."
- `myRecordsSaveSale`: "Hlayisa xirhengelo" → "Hlayisa ku xavisa & invoyisi" **(check)**
- `myRecordsNoHarvests`: "Hakuna tikotulo leti tsalekeke ku fikela sweswi." → "A ku na ntshovelo lowu tsariweke ku fikela sweswi."
- `myRecordsTotalHarvested`: "hinkwayo leyi kotuleke" → "hinkwaswo leswi tshoveriweke"
- `myRecordsTopsLabel`: "enhloko" → "yi rhangela" **(check)**
- `myRecordsNoSales`: "Hakuna tirhengelo leti tsalekeke ku fikela sweswi." → "A ku na ku xavisa loku tsariweke ku fikela sweswi."
- `myRecordsTotalRevenue`: "xuma hinkwaxo" → "muholo hinkwawo"
- `myRecordsKgSoldSuffix`: "kg leyi rhengelekeke" → "kg leyi xavisiweke"
- `myRecordsNoDesigns`: "Hakuna mipfana leyi amukelekeke na wena ku fikela sweswi." → "A ku si avelaniwa tidizayini na wena."
- `myRecordsUntitledDesign`: "Nhlelo wa le ka vito" → "Dizayini leyi nga riki na vito"
- `myRecordsSharedPrefix`: "Yi amukeleka" → "Yi avelaniwile"
- `myRecordsOpenButton`: "Vula" → "Pfula"
- `myRecordsRecentHarvests`: "Tikotulo ta sweswi" → "Ntshovelo wa sweswinyana"
- `myRecordsSalesHeader`: "Tirhengelo ta sweswi" → "Ku xavisa ka sweswinyana"
- `myRecordsSharedWithMe`: "Yi amukeleka na mina" → "Leswi avelaniweke na mina"
- `insightsSelectLocation`: "Hlawula ndhawu kutani" → "Hlawula ndhawu ku sungula"
- `insightsReportTitle`: "Ripoti ya AI ya Permaculture" → "Xiviko xa AI xa Permaculture"
- `insightsReportSubtitle`: "Mati · Misava · Swihlopha · Khalenteri · Swivumelwano swa ku hatlisa" → "Mati · Misava · Mintlawa ya swimilana · Khalendara · Swo hatlisa ku endla"
- `insightsAnalysing`: "Ku kambela..." → "Ku xopaxopa..."
- `insightsAnalyseSite`: "Kambela ndhawu" → "Xopaxopa ndhawu"
- `insightsEmptyPrompt`: "Yi tirhisa ku rhoma ka wena ka nkoka, tikhangu ta mvula, pH ya misava + OC, na biome ku tlhela ripoti ya nkoka ya ndhawu" → "Yi tirhisa ku rhelela ka ndhawu ya wena hi ku kongoma, nkarhi wa mpfula, pH ya misava + OC, na biome ku endla xiviko xa ndhawu ya wena ntsena"
- `popiaTitle`: "Data ya wena, nkhetso wa wena" → "Datha ya wena, ku hlawula ka wena"
- `popiaBody`: "Hi hlayisa vunhundzisi bya purasi ya wena eka ku tshembeha na ku byi tirhisa ku ku pfuna wena fela. U nga cincisa switirhisiwa leswi nkarhi wihi na wihi eka app." → "Hi hlayisa vuxokoxoko bya purasi ra wena hi vuhlayiseki naswona hi byi tirhisa ntsena ku ku pfuna. U nga cinca swilulamiso leswi nkarhi wihi na wihi eka app."
- `popiaStoreLabel`: "Hlayisa data ya mina ya purasi na swimali" → "Hlayisa datha ya mina ya purasi na ya timali"
- `popiaStoreDesc`: "Yi hlayisiwile ka ku tshembeka eka limu leswaku yi nga lahleki. Yi laveka ku tirhisa app." → "Yi hlayisiwa hi vuhlayiseki eka cloud leswaku yi nga lahleki. Swa laveka ku tirhisa app."
- `popiaShareLabel`: "Amukelana na NGO ya mina ka swivumelwano leswi nga tiviwiki" → "Avelana mimbuyelo leyi nga kombiki mavito na NGO ya mina"
- `popiaShareDesc`: "Yi pfuna tipulograma ku kambela ntlawa. U nga yi dyimisa nkarhi wihi na wihi." → "Swi pfuna minongonoko ku landzelela vuyelo. U nga swi tima nkarhi wihi na wihi."
- `popiaAgreeButton`: "Ndzi vumelana, ya emahlweni" → "Ndza pfumela, yana emahlweni"
- `popiaStorageRequired`: "Ku hlayisa eka limu ku laveka ku tirhisa ImbewuField." → "Ku hlayisa eka cloud swa laveka ku tirhisa ImbewuField."
- `popiaGoalTitle`: "U lava yini swinene eka misava ya wena?" → "I yini leswi u swi lavaka ngopfu eka misava ya wena?"
- `popiaGoalBody`: "Lima yi tirhisa leswi ku lungisela swivumelwano swa yona ku wena." → "Lima u tirhisa leswi ku lulamisela wena switsundzuxo swa yena."
- `popiaGoalFeedLabel`: "Dyisa vunhwarhwa bya mina" → "Wundla ndyangu wa mina"
- `popiaGoalFeedDesc`: "Ku ala ka ku tiyeka ka mirihi eka lembe" → "Matsavu lama nga heriki lembe hinkwaro"
- `popiaGoalIncomeLabel`: "Kuma xuma" → "Kuma muholo"
- `popiaGoalIncomeDesc`: "Lima yi ya eka tirito ta ntshavo leti u nga ti rhengelaka" → "Lima u tshikelela swibyariwa swa makete leswi u nga swi xavisaka"
- `popiaGoalSoilLabel`: "Buyisela misava ya mina" → "Pfuxeta misava ya mina"
- `popiaGoalSoilDesc`: "Tirito ta pfuneto na tilegume ku buyisela misava" → "Swimilana swo funengeta misava na swimilana swa tinyawa (legumes) ku pfuxeta misava" **(check)**
- `popiaGetStarted`: "Tshika" → "Sungula"
- `studentContinue`: "Yana emhlweni u dyondza" → "Yana emahlweni u dyondza"

### `lib/course-translation-drafts-ts.ts` — replacements (old → new, number of places)

- "Mahanyelo, misinya ya milawu na ti-pattern — masungulo" → "Mahanyelo, misinya ya milawu na mavumbeko (patterns) — masungulo" (1)
- "tanihi swiyimiso leswi hanyaka leswi faneleke ku sireleriwa" → "tanihi maendlelo lama hanyaka lama faneleke ku sirheleriwa" (1)
- "ndhambi leyi onhaka ti-swale ta wena" → "ndhambi leyi onhaka swisele (swales) swa wena" (1)
- "tanihi mbewu, manyoro ya compost, kumbe" → "tanihi mbewu, monyolo wa khompositi (compost), kumbe" (1)
- "masalela ma hundzuka compost, compost yi hundzuka misava" → "masalela ma hundzuka khompositi, khompositi yi hundzuka misava" (1)
- "tirhisa swintlhantlho leswitsongo naswona swa le hansi (bakiti ri nga cheleta bed handle ka gezi)" → "tirhisa swintlhantlho leswitsongo naswona swo nonoka (bakiti ri nga cheleta mubhedhi handle ka gezi)" (1)
- "Murimi u lava ku cela ti-swale ku hlengeleta" → "Murimi u lava ku cela swisele (swales) ku hlengeleta" (1)
- "Kopisa maendlelo ya swale ya muakelani" → "Kopisa maendlelo ya xisele ya muakelani" (1)
- "pulani leyi fanaka ya swale yi lulamela" → "pulani leyi fanaka ya xisele yi lulamela" (1)
- "Tihuku ti pfaleriwa ekule na jarata" → "Tihuku ti pfaleriwa ekule na ntanga" (1)
- "Jarata, mirhi ya mihandzu na xivala xa tihuku swi hleriwile leswaku tihuku ti tirhisa bed leyi nga riki na nchumu" → "Ntanga, mirhi ya mihandzu na xivala xa tihuku swi hleriwile leswaku tihuku ti tirhisa mubhedhi lowu nga riki na nchumu" (1)
- "Zone 2 i jarata lerikulu na xivala" → "Zone 2 i ntanga lowukulu na xivala" (1)
- "dyambu, mheho, mpfula, ndhambi, ndzilo. Xiyisisa laha mheho ya matimba yi humaka kona" → "dyambu, moya, mpfula, ndhambi, ndzilo. Xiyisisa laha moya wa matimba wu humaka kona" (1)
- "tlhelo leri mheho yi humaka eka rona" → "tlhelo leri moya wu humaka eka rona" (1)
- "U xiyisisa mheho leyi onhaka yi huma en'walungu-vupeladyambu eka purasi ra Highveld. Xisirhelelo xa mheho (windbreak) xi fanele ku ya kwihi?" → "U xiyisisa moya lowu onhaka wu huma en'walungu-vupeladyambu eka purasi ra Highveld. Xisivela-moya (windbreak) xi fanele ku ya kwihi?" (1)
- "Ndzelekani wa dzonga-vuxa" → "Ndzilakano wa dzonga-vuxa" (1)
- "Ndzelekani wa n'walungu-vupeladyambu, exikarhi ka mheho na swimilana" → "Ndzilakano wa n'walungu-vupeladyambu, exikarhi ka moya na swimilana" (1)
- "Swisirhelelo swa mheho a swi laveki hikuva mimheho i ya tinguva" → "Swisivela-moya a swi laveki hikuva mimoya yi hunga hi tinguva" (1)
- "Mpfimo wa mati" → "Mpimo wa mati" (1)
- "swimilani" → "swimilana" (5)
- "ximilani ntsena" → "ximilana ntsena" (1)
- "etlhelo ra n'walungu ra jarata ya yena" → "etlhelo ra n'walungu ra ntanga wa yena" (1)
- "laha vutsireledzi byi lavekaka kona" → "laha nsirhelelo wu lavekaka kona" (1)
- "u nga se veka vutsireledzi" → "u nga se veka nsirhelelo" (1)
- "leyi tsirelekeke ehandle" → "leyi sirhelelekeke ehandle" (1)
- "n'walungu, miako, mati, na ndzilekana —" → "n'walungu, miako, mati, na ndzilakano —" (1)
- "Veka tizoniti na tisekitara ta wena ehenhla" → "Veka ti-zone na ti-sector ta wena ehenhla" (1)
- "Veka tizoniti na tisekitara ehenhla ka mepe" → "Veka ti-zone na ti-sector ehenhla ka mepe" (1)

### `lib/course-translation-drafts-ts-water-harvesting.ts`

- `l1 title`: exact English hold → new Xitsonga machine draft **(check)**: "Swisele (swales) na Makhurhana ya Misava (berms): Ku Nonokisa Mati eNdhawini yo Rhelela"
- `l1 infographicAlt`: exact English hold → new Xitsonga machine draft **(check)**: "Xifaniso xa miehleketo xa xisele (swale) lexi ringaneke eka khanthura, xi tsemakanyiwile exikarhi, xi ri na khurhana ra misava (berm) ehansi ka xona. Miseve yi komba mati lama khulukaka ma nonoka naswona ma hangalaka; ku nghena ka mati emisaveni swi titshege hi misava na ndhawu."
- `l1 body`: exact English hold → new Xitsonga machine draft **(check)**: "Muxaka wun'we wa xisele (swale) i mugodi wo leha lowu ringaneke, lowu celiweke eka khanthura. Wu nonokisa mati lama khulukaka (runoff) wu tlhela wu ma hangalasa, leswaku man'wana ma nghena emisaveni leyi faneleke. Swisele swin'wana swi dizayiniwa swi rhelela katsongo hi ndlela leyi lawulekaka, leswaku swi yisa mati lama taleke hi ku nonoka eka ndhawu leyi hlayisekeke yo huma. Ndlela leyi faneleke misava ya wena yi titshege hi misava, ku rhelela, ku humesa mati na ku khuluka ka mati ya xidzedze. Kombela mutsundzuxi wa laha kaya loyi a leteriweke leswaku a kambela layini, ndlela ya mati lama taleke na ndhawu leyi ma yaka kona u nga si cela. ¶ Misava leyi celiweke yi endla khurhana ra misava (berm) etlhelweni ra le hansi, laha mirhi yi nga byariwaka kona loko dizayini ya ndhawu yi fanerile. ¶ Mirhi leyi byariweke kona yi nga tirhisa ku tsakama loku hlayisiweke emisaveni endzhaku ka mpfula, swi ya hi ndhawu. ¶ Mpfula ya matimba yi nga tata xisele hi ku hatlisa ku tlula hilaha mati ma nghenaka hakona emisaveni. Kunguhatela ndlela leyi hlayisekeke ya mati lama taleke u nga si cela. ¶ Ndlela ya kona a yi fanelanga ku kukula misava ya ndhawu yo rhelela kumbe ku rhumela mati lama onhaka eka muakelani. Xisele kumbe damu leri nga ehansi swi fanele ku kota ku ma amukela hi vuhlayiseki. ¶ Kombela mutsundzuxi wa laha kaya loyi a leteriweke leswaku a kambela misava, ku rhelela na ku khuluka ka mati ya xidzedze. Xifaniso a hi dizayini yo aka ha yona. ¶ Ku rhelela ntsena a ku ku byeli loko xisele xi fanerile. Misava, ku humesa mati, misava leyi nga tiyangiki na mati lama taka hi le henhla ka ndhawu yo rhelela hinkwaswo swa nkoka. ¶ Hlayisa misava yi funengetekile kahle. Kuma nkambelo wa laha kaya u nga si cela eka misava yo rhelela ngopfu, leyi tsakameke kumbe leyi nga tiyangiki. Mindzilakano ya byanyi (grass barriers) na titerasi (terraces) na swona swi lava dizayini leyi faneleke ndhawu."
- `l1 keyPoints[0]`: exact English hold → new Xitsonga machine draft **(check)**: "Xisele lexi ringaneke eka khanthura xi nga khoma mati lama khulukaka leswaku ma nghena emisaveni eka ndhawu leyi faneleke; swisele swin'wana swi lava ku rhelela loku dizayiniweke na ndlela leyi hlayisekeke yo humesa mati"
- `l1 keyPoints[2]`: exact English hold → new Xitsonga machine draft **(check)**: "Kambela misava, ku humesa mati, ku rhelela na ku khuluka ka mati ya xidzedze u nga si cela"
- "yi nghena eka gavhu kutani yi rhelela hi phayiphi yi nghena etangini, laha ku nga na first-flush diverter leyitsongo leyi hambanaka na phayiphi tangi ri nga si fikeleleka" → "yi nghena eka gatara kutani yi rhelela hi phayiphi yi nghena ethankini, laha ku nga na first-flush diverter leyitsongo leyi hambanaka na phayiphi thanki yi nga si fikeleleka"
- "Matangi ya Mati ya Mpfula" → "Tithanki ta Mati ya Mpfula"
- "u nga si hlanganisa tangi." → "u nga si hlanganisa thanki."
- "lama hundzaka gavhu" → "lama hundzaka gatara"
- "loko tangi ri tele" → "loko thanki yi tele"
- "Sayizi ya tangi yi" → "Sayizi ya thanki yi"
- "sayizi ya tangi leyi u yi lavaka" → "sayizi ya thanki leyi u yi lavaka"
- "Hlayisa tangi ri funengetiwile" → "Hlayisa thanki yi funengetiwile"
- "tigavhu" → "tigatara"
- "tangi ra mati ya mpfula" → "thanki ya mati ya mpfula"
- "nxavo wa tangi lerikulu ngopfu leri kumekaka" → "nxavo wa thanki leyikulu ngopfu leyi kumekaka"
- "Ku kunguhatela tangi" → "Ku kunguhatela thanki"
- "mati ya tangi lama" → "mati ya thanki lama"
- "Yi sivela tangi ku tala" → "Yi sivela thanki ku tala"
- ""Greywater: Kamba u nga si Tirhisa Nakambe"" → ""Mati lama Tirhisiweke (greywater): Kamba u nga si ma Tirhisa Nakambe""
- "swiletelo swa greywater swi nga hambana" → "swiletelo swa mati lama tirhisiweke (greywater) swi nga hambana"
- "Misava na mulch a swi dlai" → "Misava na xifunengeto (mulch) a swi dlai"
- Removed the 14 `holds` entries for `water-harvesting-l1` title, infographicAlt, body[0]–body[7], keyPoints[0] and keyPoints[2] (two entries each for the key points).


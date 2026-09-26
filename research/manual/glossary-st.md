# Sesotho (st) glossary — Permaculture Manual

> **Machine-drafted glossary.** A fluent Sesotho speaker, ideally someone with farming or
> extension experience, must review it before it is treated as final. Terms marked **(check)**
> are ones the drafter is unsure of. Where no everyday Sesotho word exists, the glossary gives
> a short phrase that describes the thing. On first use in a chapter, put the English in brackets
> after it, e.g. "mokero o latelang contour (swale)".

Translators use this file for every chapter in `public/manual/st/`, so that all chapters agree
with each other and with the app. If you need a new term, add it here (see `STYLE.md`).

## How to use this glossary

- **Orthography: South African, not Lesotho.** The source handbook was written in Lesotho, and
  many of the app's Sesotho strings also use Lesotho spelling. Always convert. Common changes:
  *li-* → *di-* (lijalo → dijalo), *ea* → *ya*, *oa* → *wa*, *u* → *o* (you),
  *tš* → *tsh* (tšimo → tshimo), *ch* → *tjh* (cheka → tjheka), *kh* → *kg* where the sound is
  the fricative (khomo → kgomo, khoho → kgoho, mokhoa → mokgwa), *oe/oa* → *we/wa*
  (moea → moya), *li/lu* → *di/du* inside words (leholimo → lehodimo, seliba → sediba).
- **Register.** Plain, spoken, rural Sesotho, the way an extension officer would explain it in
  the village. Short phrases are better than coined "academic" words.
- **Loan words.** Where farmers already use the English word (permaculture, compost, mulch,
  pH, tanka, A-frame), the loan word is fine. Explain it once in plain Sesotho on first use.
- **Numbers and units** (mm, m, kg, °C) stay exactly as in the English.
- **"app:" in the notes** means the term is already used in the app. Paths are short forms:
  `st.ts` = `lib/locales/st.ts`; `drafts-st` = `lib/course-translation-drafts-st.ts`;
  `drafts-st-<topic>` = `lib/course-translation-drafts-st-<topic>.ts`. Where the app uses
  Lesotho spelling, the glossary gives the SA spelling of the same word.

## Inconsistencies found in the app (for the reviewer)

These were fixed in the app on 2026-09-26 (see "App clean-up log" at the end of this file).
The manual follows the choice in this glossary. Some "app:" notes below still quote the old
Lesotho spelling of a term; the app now uses the SA spelling given in the Sesotho column.

- **compost** appears as "Mantle" in `st.ts` (`soilAmendmentCompost`). *Mantle* means
  faeces/dung and is wrong. The drafts use "compost", "manyolo a litlama" and
  "Manyolo a Bolaang" (*bolaang* = "that kills"; *bodileng* = "rotted" was probably meant).
  The glossary uses **kompose (compost)**.
- **swale** appears four ways: "Mokero (swale)" in `st.ts`, "Mekoti (swales)", "foro e lekaneng
  moeling (level contour swale)" and "li-swale" in the drafts. *Mekoti* means holes/pits.
  The glossary follows the map UI: **mokero (swale)**.
- **garden bed**: `drafts-st-small-livestock` records that an earlier draft turned "garden bed"
  into a sleeping bed. Never write *bethe* on its own: say **bethe ya serapa**.
- **chicken / duck**: `drafts-st-small-livestock` has "Dikgogo" and "madada", which are
  Setswana/Sepedi forms. Sesotho is **kgoho / dikgoho** and **letata / matata**.
- **frost**: the drafts use "serame (sa phoka)" but some climate strings in `st.ts` use "lehla".
  The glossary uses **serame**.
- **nitrogen** appears as "nitrogen", "naetrojene" and "naeterojene". The glossary uses
  **naetrojene**.

## Core ideas and ethics

| English | Sesotho | Notes |
|---|---|---|
| permaculture | permaculture | Loan word. app: `st.ts` (`tagline`), all drafts. Explain on first use: "mokgwa wa ho rala polasi le lehae o sebetsang le tlhaho, e seng kgahlanong le yona". |
| ethics | melao ya boitshwaro | app: drafts-st "Melao ea boitshwaro (ethics)", SA spelling. |
| Earth Care / Care for the Earth | Tlhokomelo ya Lefatshe | app: drafts-st "Tlhokomelo ea Lefatše", SA spelling. |
| People Care / Care for People | Tlhokomelo ya Batho | app: drafts-st. |
| Fair Share / Share our Resources | Karolelano e Lokileng | app: drafts-st. The source calls this ethic "Share our Resources"; use the same term. |
| principle (design principle) | molao-motheo (pl. melao-motheo) | app: drafts-st "Melao-motheo e Leshome le Metso e 'Meli". |
| design (noun) / to design | moralo / ho rala | app: `st.ts` (`tabDesign` "Moralo"), drafts-st "Ho Rala le Tlhaho". |
| pattern | mokgwa (pl. mekgwa) | app: drafts-st "mekhoa (patterns)", SA spelling. Add "(pattern)" on first use because *mokgwa* also means "method". |
| system | tsamaiso | app: drafts-st. |
| yield | kotulo / tlhahiso | app: `st.ts` ("Ngola tlhahiso", "Boloka kotulo"). *Kotulo* = harvest; *tlhahiso* = what the land produces. |
| surplus | tse setseng / masalla | app: drafts-st "se setseng (surplus)". |
| waste | ditshila / matlakala | app: drafts-st "litšila", SA spelling. |
| resource | mohlodi (pl. mehlodi) | app: drafts-st-plant-guilds "mehlodi". |
| energy | matla | app: drafts-st "Ho Hlophisa Polasi ka Matla". |
| renewable | e ntjhafalang | (check) Explain: "e sa feleng, e boelang e be teng". |
| biomass | biomass (dimela le masalla a tsona) | Loan word. app: drafts-st "biomass". Explain on first use. |
| diversity | mefutafuta | app: drafts-st "mefuta-futa". |
| biodiversity | mefutafuta ya dintho tse phelang | app: drafts-st "(biodiversity)". |
| edge | mathoko / moeli | app: drafts-st "Mathoko le libaka tse ka thoko". |
| sustainable | e tsitsitseng, e ka tswelang pele nako e telele | (check) Descriptive phrase; add "(sustainable)" on first use. |
| homestead | lehae / setsha sa lehae | app: `st.ts` (`shapeCategoryHomePlot` "Setsha sa lehae"). |
| smallholder farmer | molemi e monyane / sehwai se senyane | app: drafts use "Molemi" and "Sehoai" (Lesotho; SA *sehwai*). |
| farmer | molemi | app: drafts-st "Molemi". `st.ts` role label uses "Molemisi"; *molemi* is the everyday word. |
| mentor | moeletsi | app: `st.ts` (`homeRoleMentorLabel`). App role name, do not change. |
| student | moithuti | app: `st.ts` (`homeRoleStudentLabel`). |
| NGO | mokgatlo | app: `st.ts` (`homeRoleNGOLabel`). |
| funder | motshehetsi | app: `st.ts` "Motšehetsi", SA spelling. |
| extension officer / adviser | moeletsi wa temo | app: drafts-st-reading-landscape "moeletsi oa lehae ea koetlisitsoeng (trained local adviser)". |
| stability | botsitso | (check) Used in the definition of permaculture. |
| resilience | matla a ho iphodisa | (check) Explain: recovers after drought, fire or damage. |
| cycle (natural) | potoloho (pl. dipotoloho) | (check) |
| closed loop | potoloho e kwetsweng (closed loop) | (check) |
| agroforestry | temo e kopanyang difate, dijalo le diphoofolo (agroforestry) | (check) |
| monoculture | temo ya sejalo se le seng (monoculture) | (check) |
| food security | tshireletso ya dijo | (check) |
| Safety / Tip / Note (callout labels) | Polokeho / Keletso / Hlokomela | (check) Manual callout labels. |
| Key points (chapter summary) | Dintlha tsa bohlokwa | (check) |
| Saying (proverb) | Maele | (check) Used before Holmgren's sayings in chapter 1. |

## The 12 design principles

| English | Sesotho | Notes |
|---|---|---|
| 1. Observe and interact (with nature) | Shebella mme o sebedisane le tlhaho | app: drafts-st "sheba 'me u sebelisane (observe and interact)", SA spelling. |
| 2. Catch and store energy | Tshwara mme o boloke matla | app: drafts-st "tšoara le ho boloka matla (catch and store energy)". |
| 3. Obtain a yield | Fumana kotulo | (check) Not yet in app. |
| 4. Apply self-regulation and accept feedback | Itaole mme o amohele dipontsho (feedback) | (check) Explain "feedback" as "seo naha e o bontshang sona ka mora seo o se entseng". |
| 5. Use and value renewable resources and services | Sebedisa mme o ananele mehlodi le ditshebeletso tse ntjhafalang | (check) Not yet in app. |
| 6. Produce no waste | O se ke wa hlahisa ditshila | app: drafts-st "u se ke ua hlahisa litšila (produce no waste)". |
| 7. Design from patterns to details | Rala ho tloha mekgweng ho ya dintlheng | (check) Not yet in app. |
| 8. Integrate rather than segregate | Kopanya ho e na le ho arola | app: drafts-st "'kopanya ho e-na le ho arola'". |
| 9. Use small and slow solutions | Sebedisa ditharollo tse nyane le tse diehang | app: drafts-st "litharollo tse nyane le tse liehang". |
| 10. Use and value diversity | Sebedisa mme o ananele mefutafuta | app: drafts-st "sebelisa le ho ananela mefuta-futa". |
| 11. Use edges and value the marginal | Sebedisa mathoko mme o ananele tse ka thoko | app: drafts-st "ho ananela tse ka thoko (use edges and value the marginal)". |
| 12. Creatively use and respond to change | Sebedisa phetoho ka bohlale mme o arabele ho yona | (check) Not yet in app. |

## Planning, site and climate

| English | Sesotho | Notes |
|---|---|---|
| site assessment | tlhahlobo ya setsha | app: drafts-st-water-harvesting "tlhahlobo ea setsha". |
| site map | mmapa wa setsha | app: drafts-st-reading-landscape "Mmapa oa setša (site map)". |
| observe / observation | ho shebella / tlhokomelo | app: drafts-st-reading-landscape. |
| zone | Zone (sebaka) | app: drafts-st keeps "Zone 1", "Zone 3" and glosses "Libaka (Zones)". Write "Zone 1" etc. unchanged. Explain once: "sebaka se arotsweng ho ya ka hore o se etela hangata hakae". Avoid bare *sebaka*, which just means "place". |
| Zone 0 (the house) | Zone 0 (ntlo le lelapa) | Explain on first use. |
| sector | lekala (pl. makala) | app: drafts-st "Makala (Sectors)". Add "(sector)" on first use; *lekala* also means tree branch. |
| sector planning | moralo wa makala | Built from the app term. |
| slope | letswapo | app: drafts-st-water-harvesting "Letsoapong" (Lesotho spelling); drafts-st-reading-landscape also uses "moepa". (check) |
| contour (line) | mola wa contour | Loan word. app: drafts-st-reading-landscape "contour". Explain: "mola o kopanyang dintlha tse bophahamong bo lekanang". |
| aspect | lehlakore leo naha e shebileng ho lona | app: drafts-st-reading-landscape "pono ea sebaka (aspect)". The descriptive phrase is clearer; either is acceptable. |
| north / south / east / west | leboya / borwa / botjhabela / bophirima | app: drafts-st "leboea", "boroa", "bochabela", SA spelling. |
| north-facing slope | letswapo le shebileng leboya | app: drafts-st-reading-landscape "Miepa e shebileng leboea". In South Africa these are the warm slopes. |
| topography | sebopeho sa naha | app: drafts-st-reading-landscape "Ho Bala Sebopeho sa Naha", "boemo ba naha (topography)". |
| microclimate | boemo ba lehodimo ba sebaka se senyane | (check) Add "(microclimate)" on first use. |
| climate | boemo ba lehodimo | app: `st.ts` (`tabClimate` "Boemo ba leholimo"), SA spelling. |
| climate change | phetoho ya boemo ba lehodimo | Built from the app term. |
| weather | maemo a lehodimo | app: drafts-st-vegetables-staples "maemo a lehodimo". |
| season | sehla (pl. dihla) | app: drafts-st "sehla se feletseng". |
| dry season / rainy season | sehla sa komello / sehla sa dipula | app: drafts-st-water-harvesting "Sehla sa Komelelo". |
| rainfall | pula | app: `st.ts` (`statAnnualRainfall`). |
| frost | serame | app: drafts-st-reading-landscape "serame sa phoka (frost)", `st.ts` (`calendarFrost`). |
| frost hollow / frost pocket | sekoti sa serame | app: drafts-st-reading-landscape "sekoti se tsejoang sa serame (frost hollow)". |
| hail | sefako | app: drafts-st "Tšenyo ea sefako". |
| drought | komello | app: `st.ts` (`challengeDrought`), drafts-st "komello". |
| veld (natural rangeland) | naha (veld) / naha ya tlhaho | (check) |
| grassland | naha ya jwang | (check) |
| stream | molatswana (pl. melatswana) | (check) |
| permit / licence | lengolo la tumello (permit) / laesense | (check) |
| flood | morwallo | app: drafts-st "moroallo" (Lesotho spelling). |
| wind | moya | app: `st.ts` (`windSectionHeader` "Moea"), SA spelling. |
| windbreak | sesireletsi sa moya | app: drafts-st "Sesireletsi sa moea (windbreak)". `st.ts` uses "Thibela-moea"; the drafts' phrase is clearer. |
| fire | mollo | app: drafts-st. |
| firebreak | lebanta le thibelang mollo | (check) Add "(firebreak)" on first use. |
| sunlight | kganya ya letsatsi | app: drafts-st-food-forest "khanya", SA spelling. |
| shade | moriti | app: drafts-st-reading-landscape. |
| shade cloth | lesela la moriti | app: drafts-st-reading-landscape "Lesela la moriti (shade cloth)". |
| tunnel (greenhouse) | tonele ya polasetiki | (check) `st.ts` has "Ntlo ea limela / tunnel ea polasetiki". |
| thermal belt | lebanta le futhumetseng (thermal belt) | (check) Ch. 03. The warmer band part-way up a slope. |
| thermal mass | dintho tse bolokang mocheso (thermal mass) | (check) Ch. 03. |
| roof overhang / eave | marulelo a fetang lerako (roof overhang, eave) | (check) Ch. 03. |
| white frost / black frost | serame se sesweu / serame se setsho (black frost) | (check) Ch. 03. |
| frost cloth | lesela la serame (frost cloth) | (check) Ch. 03. |
| sun trap | serai sa letsatsi (sun trap) | (check) Ch. 03. |
| nurse tree | sefate se hodisang (nurse tree) | (check) Ch. 03. |
| heatwave | leqhubu la mocheso (pl. maqhubu a mocheso) (heatwave) | (check) Ch. 03. |
| hydrology | thuto ya metsi (hydrology) | (check) Ch. 03. |
| rain gauge | sesupa-pula (rain gauge) | (check) Ch. 03. |
| temperate / arid / semi-arid climate | boemo ba lehodimo ba mahareng (temperate) / bo omileng (arid) / bo batlang bo omile (semi-arid) | (check) Ch. 03. |
| flood plain | sebaka se aparelwang ke merwallo (flood plain) | (check) Ch. 03. |
| tropical cyclone | sefefo se matla sa tropike (tropical cyclone) | (check) Ch. 03. |
| planned grazing | makgulo a rerilweng (planned grazing) | (check) Ch. 03. |
| community seed bank | banka ya dipeo ya setjhaba | (check) Ch. 03. |

## Water and earthworks

| English | Sesotho | Notes |
|---|---|---|
| earthworks | mesebetsi ya ho tjheka mobu | app: drafts-st-reading-landscape "mesebetsi ea ho cheka mobu (earthworks)". |
| to dig | ho tjheka | app: drafts "cheka" (Lesotho spelling). |
| rainwater harvesting | ho kotula metsi a pula | app: drafts-st-water-harvesting "Ho Kotula Metsi"; `st.ts` also "ho bokella metsi". |
| catchment | sebaka se bokellang metsi | app: drafts "sebaka se kgoboketsang metsi (catchment)"; `st.ts` "sebaka sa ho bokella". |
| runoff | metsi a phallang | app: drafts-st-water-harvesting. |
| infiltration | ho kena ha metsi mobung | app: drafts-st-water-harvesting "ho teba ha metsi". |
| erosion | kgoholeho ya mobu | app: `st.ts` and drafts "khoholeho ea mobu", SA spelling. (check) |
| swale | mokero (swale) | app: `st.ts` (`waterCategorySwale` "Mokero (swale)"). Explain: "foro e tjhekwang ho latela contour ho thibela le ho kenya metsi mobung". See inconsistencies above. |
| level contour swale | mokero o lekaneng o latelang contour | app: drafts-st-water-harvesting "foro e lekaneng moeling (level contour swale)". (check) |
| berm (mound below a swale) | lerako la mobu (berm) | app: drafts use "mekoallo (berms)"; `st.ts` "Lerako la ho thibela metsi" (contour bank). (check) |
| contour bank | lerako la contour | app: `st.ts` (`waterCategoryContourBank`). |
| trench | foro | app: drafts-st-water-harvesting "foro". |
| pit | sekoti (pl. dikoti) | app: drafts. |
| spillway / safe overflow | tsela ya metsi a tletseng | app: drafts-st-water-harvesting "tsela ea metsi a tletseng (spillway)". |
| first-flush diverter | sekgelo sa metsi a pele (first-flush diverter) | app: drafts-st-water-harvesting "sekhelo sa ho qala ha phallo". (check) Always explain what it does. |
| dam / earth dam | letamo / letamo la mobu | app: `st.ts` (`waterStorageEarthDam`), drafts-st-water-harvesting. |
| dam wall | lerako la letamo | app: drafts-st-water-harvesting. |
| pond | letangwana (pl. matangwana) | app: drafts-st-water-harvesting "Matangwana". |
| sand dam | letamo la lehlabathe (sand dam) | Explain: "lerako le hahwang mokoting wa noka e omang, le bolokang metsi ka hara lehlabathe". |
| rainwater tank | tanka ya metsi a pula | app: drafts-st-water-harvesting "ditanka tsa metsi a pula". |
| gutter | korobo (pl. dikorobo) | app: `st.ts` "Likorobo" (Lesotho spelling). (check) |
| roof catchment | ho bokella metsi marulelong | app: `st.ts` (`stepRoofCatchment`). |
| borehole | borehole (sediba se tjhekilweng) | Loan word. app: drafts-st keeps "borehole"; `st.ts` has "Seliba" (Lesotho). |
| spring (water) | sediba / mohlodi wa metsi | app: drafts-st "sediba se arolelanoang". |
| groundwater / water table | metsi a ka tlasa lefatshe | app: drafts-st-reading-landscape "metsi a ka tlas'a lefatše". |
| greywater | metsi a ditshila a malapeng (greywater) | app: drafts-st-water-harvesting "Metsi a Litšila a Malapeng (Greywater)". Add the safety note: never on leafy greens eaten raw. |
| irrigation | nosetso / ho nosetsa | app: `st.ts`, drafts. |
| drip irrigation | nosetso ya marothodi | app: `st.ts` (`waterDeliveryDripLabel` "Nosetso ea marotholi"), SA spelling. |
| hand watering | ho nosetsa ka letsoho | app: `st.ts` (`waterDeliveryBucketLabel`). |
| watering can | kanna ya ho nosetsa | (check) |
| bottle irrigation | nosetso ka dibotlolo | Descriptive. Explain the method on first use. |
| micro-jet spray | di-micro-jet (difafatsi tse nyane) | Loan word; explain. |
| sprinkler | sefafatsi | app: `st.ts` (`waterDeliverySprinklerLabel`). |
| pipe / hosepipe | phaephe | app: `st.ts` "phaepe". (check) spelling. |
| tap | pompo | app: `st.ts` (`waterSourceMunicipalTap`). |
| A-frame (level) | A-frame | Loan word. app: drafts-st-reading-landscape. Explain: "sesebediswa sa lepolanka se bontshang dintlha tse bophahamong bo lekanang". |
| drainage | ho tsholla metsi / tsamaiso ya metsi | app: drafts-st-reading-landscape "tsamaiso ea metsi (drainage)"; drafts-st-vegetables-staples "di tsholola metsi". |
| waterlogged | o tletse metsi | app: `st.ts` (`soilConditionClay` "o tletse metsi"). |
| evaporation | mouwane / ho fetoha mouwane | app: drafts "mouoane", SA spelling. |
| runoff coefficient | palo ya phallo (runoff coefficient) | (check) Ch. 07. Explain: the share of rain that runs off, a number between 0 and 1. |
| living sponge (soil) | sepontjhe se phelang (living sponge) | (check) Ch. 07. |
| infiltration basin | sekotlolo sa ho kenya metsi mobung (infiltration basin) | (check) Ch. 07. Small basin: *sekotlolwana*. |
| diversion drain / diversion mound | foro e kgelosang metsi / lerakwana le kgelosang metsi | (check) Ch. 07. |
| gully | donga (gully) | (check) Ch. 07. |
| watercourse | tsela ya metsi ya tlhaho (watercourse) | (check) Ch. 07. River, stream, spring, wetland or drainage line. |
| volume (of water) | bongata ba metsi (volume) | (check) Ch. 07. Not *bophahamo* (= height). |
| bedrock | lefika le tiileng le ka tlasa mobu (bedrock) | (check) Ch. 07. |
| corrugated iron | lesenke (pl. masenke) | (check) Ch. 07. |
| mosquito | monwang (pl. menwang) | (check) Ch. 07. |
| peg (for marking) | thupana (peg) | (check) Ch. 07. |
| level mark (A-frame) | letshwao la ho lekalekana (level mark) | (check) Ch. 07. |
| dripper / emitter | serothisi (pl. dirothisi) | (check) Ch. 07. |
| filter | sefe (filter) | (check) Ch. 07. |
| water pressure | kgatello (pressure) | (check) Ch. 07. |
| impact sprinkler | sefafatsi se otlang (impact sprinkler) | (check) Ch. 07. |
| blackwater (toilet water) | metsi a ntlwana (blackwater) | (check) Ch. 07. |
| grease trap | sethibela mafura (grease trap) | (check) Ch. 07. |

## Beds, ground preparation and seeds

| English | Sesotho | Notes |
|---|---|---|
| garden bed | bethe ya serapa | (check) Never bare *bethe* (see inconsistencies). drafts-st-vegetables-staples uses "lae / dilae". |
| raised bed | bethe ya serapa e phahamisitsweng | (check) |
| double-reach bed | bethe ya serapa e fihlelwang ho tswa mahlakoreng a mabedi (double-reach bed) | Explain: 1 to 1.2 m wide, so you never step on it. app: drafts-st-vegetables-staples describes the idea. |
| keyhole bed | bethe ya serapa e bopehileng jwaloka lesoba la senotlolo (keyhole bed) | Explain on first use. |
| mandala bed | bethe ya serapa e tjhitja (mandala) | Explain on first use. |
| terrace (bed) | mothati (terrace) | (check) |
| trench bed / pit bed | bethe ya foro / bethe ya sekoti | Descriptive; explain on first use. |
| no-dig method | mokgwa wa ho se tjhekolle mobu (no-dig) | app: `st.ts` (`landPrepNoneDesc` "mokhoa oa ho se chekolle"). |
| to plough / till | ho lema ka mohoma / ho tjhekolla | app: `st.ts` (`landPrepAnimalDesc` "Mohoma"). |
| compaction / compacted soil | ho kitlana ha mobu / mobu o kitlaneng | app: drafts-st-soil-health "mobu o kitlaneng"; other drafts use "ho teteana", "ho katana". |
| seed | peo (pl. dipeo) | app: drafts-st-seeds-sovereignty. |
| seed saving | ho boloka peo | app: drafts-st-seeds-sovereignty "Ho Boloka Peo". |
| seed sovereignty | boipuso ba peo | app: drafts-st-seeds-sovereignty "Boipuso ba Peo (Seed Sovereignty)". |
| open-pollinated | peo e tswalang se tshwanang (open-pollinated) | (check) app keeps "open-pollinated". Explain: seed you can save and replant. |
| hybrid (seed) | hybrid | Loan word. app: drafts-st-vegetables-staples "peo ya hybrid". |
| to germinate | ho mela | app: drafts-st-vegetables-staples "e liehang ho mela". |
| seedling | semela se senyane | app: drafts-st "semela se senyenyane". Avoid *dipeo* (seeds) for seedlings. |
| seedling nursery | kereche ya dimela tse nyane | app: drafts-st-reading-landscape "kereche ea lipeo". (check) |
| to transplant | ho hloma | app: drafts-st-vegetables-staples "Hloma dijalo". |
| direct sowing | ho jala ka kotloloho | app: drafts-st-vegetables-staples. |
| to sow / to plant | ho jala / ho lema | app: drafts. *Ho jala* = sow seed; *ho lema* = plant, farm. |
| crop | sejalo (pl. dijalo) | app: drafts (SA *dijalo*; `st.ts` has Lesotho *lijalo*). |
| staple crop | sejalo sa sehlooho | app: drafts-st-vegetables-staples "Dijalo tsa Sehlooho". |
| vegetables | meroho | app: `st.ts` (`cropVegetables`). |
| kitchen garden | serapa sa kitjhene | (check) Or "serapa se haufi le ntlo". |
| vegetable garden | serapa sa meroho | app: `st.ts` (`shapeCategoryVegetableGarden`). |
| field | tshimo (pl. masimo) | app: `st.ts` "Tšimo", SA spelling. |
| intercropping | temo e kopantsweng | app: drafts-st-vegetables-staples. |
| succession planting | ho jala ka tatellano | app: drafts-st-vegetables-staples "Temo e Latellanang". |
| hungry gap | sekgeo sa tlala | app: drafts-st-vegetables-staples "sekgeo sa tlala (hungry gap)". |
| harvest | kotulo / ho kotula | app: `st.ts` (`myRecordsSaveHarvest`). |
| weed | mofoka (pl. mefoka) | app: drafts-st-food-forest, drafts-st-soil-health. |
| to weed | ho hlaola | Common verb. |
| pollinator | kokonyana e tsamaisang phofo ya dipalesa (pollinator) | app: drafts-st-food-forest has a longer phrase. (check) |
| market garden | serapa sa mmaraka (market garden) | (check) Ch. 04. |
| retail / wholesale price | theko ya ho rekisa ka bonngwe (retail) / ka bongata (wholesale) | (check) Ch. 04. |
| vine cuttings (sweet potato) | dikotwana tsa methapo (vine cuttings) | (check) Ch. 04. |
| ridge / mound (planting) | mola o phahamisitsweng wa mobu (ridge) / qubu e nyane ya mobu (mound) | (check) Ch. 04. |
| perennial / annual (plant) | semela se phelang dilemo tse ngata / semela sa sehla se le seng | (check) Ch. 04. |
| pollen / nectar | phofo / lero la dipalesa (nectar) | (check) Ch. 05. |
| vertical gardening | serapa se emeng (vertical gardening) | (check) Growing on walls and fences. |
| sunken bed | bethe ya serapa e tebileng (sunken bed) | (check) Ch. 07. |
| sheet mulching (lasagne bed) | ho kwahela ka mulch ka mekgahlelo (sheet mulching) | (check) Ch. 07. |
| soil solarisation | ho futhumatsa mobu ka letsatsi (solarisation) | (check) Ch. 07. |
| tarping / tarp | ho kwahela ka tarp / tarp (tarpaulin) | (check) Ch. 07. Loan word. |
| stale seedbed | bethe ya serapa e hlwekisitsweng pele (stale seedbed) | (check) Ch. 07. |
| banana circle | sedikadikwe sa dibanana (banana circle) | (check) Ch. 07. |
| herbicide | sebolayamefoka (pl. dibolayamefoka) | (check) Ch. 07. |

## Soil and fertility

| English | Sesotho | Notes |
|---|---|---|
| soil | mobu | app: everywhere. |
| topsoil / subsoil | mobu wa kahodimo / mobu wa ka tlase | Descriptive. |
| loam / loamy soil | mobu o motle o kopaneng (loam) | (check) Explain: a mix of sand, silt and clay. |
| clay | letsopa | app: `st.ts` (`textureClay`). |
| sand / sandy soil | lehlabathe / mobu wa lehlabathe | app: `st.ts` (`textureSand`), drafts-st-vegetables-staples. |
| silt | seretse se setle (silt) | app: `st.ts` (`textureSilt` "Seretse"). *Seretse* on its own means mud. (check) |
| organic matter | dintho tsa tlhaho tse bolang | app: drafts-st-soil-health "dintho tsa tlhaho (organic matter)". |
| humus | humus (mobu o motsho o nonneng) | Loan word; explain. |
| soil fertility | monono wa mobu | app: drafts-st-small-livestock "Monono". |
| nutrients | phepo / dimatlafatsi | app: drafts-st-vegetables-staples "phepo"; drafts-st-food-forest "limatlafatsi". |
| pH (acid / alkaline) | pH (asiti / alkali) | app: `st.ts` (`phAcidic`, `phAlkaline`). |
| nitrogen | naetrojene | app: drafts-st-plant-guilds "naetrojene". |
| nitrogen fixer | semela se lokisang naetrojene | app: drafts-st-plant-guilds "Limela tse lokisang naetrojene", "semela se lokisang nitrogen (nitrogen fixer)". |
| legume | semela sa dinawa | app: drafts-st-plant-guilds "Limela tsa dinawa (legumes)". |
| root nodules | mafito a metso | app: drafts-st-plant-guilds. (check) |
| soil life / soil organisms | ditshedi tsa mobu | app: drafts-st-soil-health "setshedi sa mobu". |
| soil test | teko ya mobu | app: drafts-st-soil-health. |
| manure | manyolo a diphoofolo | app: `st.ts` "Manyolo". Say "a diphoofolo" because *manyolo* alone can mean any fertiliser. |
| kraal manure | manyolo a lesaka | app: `st.ts` (`soilAmendmentKraalManure` "Manyolo a lešaka"). |
| chemical fertiliser | manyolo a dikhemikhale | app: `st.ts` (`practiceConventionalDesc`). |
| green manure | manyolo a matala (green manure) | Explain: "dimela tse lengwang ebe di kopanngwa le mobu ho o nontsha". |
| cover crop | dijalo tse sireletsang mobu | app: drafts-st-soil-health "(cover crops)". |
| mulch | mulch (sekwahelo sa mobu) | Loan word. app: drafts use "mulch"; `st.ts` has "Sekoahelo". Explain once as "sekwahelo sa mobu sa jwang, makgasi kapa patsi e sitsweng". |
| to mulch | ho kwahela mobu ka mulch | app: drafts-st-soil-health "Ho Sebedisa Mulch". |
| compost | kompose (compost) | app: drafts-st-soil-health "compost". See inconsistencies. Explain: "manyolo a entsweng ka masalla a dimela le manyolo a bodileng". |
| compost heap | qubu ya kompose | app: drafts-st-soil-health "qubu ya compost". |
| greens / browns (compost) | tse tala / tse sootho | app: drafts-st-soil-health "tse sootho, tse tala". |
| straw | jwang bo omileng | app: drafts-st-soil-health "jwang bo omileng (straw)". |
| wood ash | molora | Common word. |
| worm (earthworm) | seboko (pl. diboko) | app: drafts-st-soil-health "diboko". For caterpillar, say *seboko se senyang* or name the pest, to avoid mixing the two up. |
| worm farm / worm bin | polasi ya diboko / moqomo wa diboko | app: drafts-st-soil-health "mapolasi a diboko", "moqomong wa diboko". |
| worm castings | manyolo a diboko | app: drafts-st-soil-health "manyolo a phethilweng a diboko (worm castings)". |
| worm-bin liquid / worm tea | metsi a rothang moqomong wa diboko | app: drafts-st-soil-health "mokelikeli o rothang". Keep the safety note. |
| liquid manure / compost tea | metsi a manyolo (liquid manure) | (check) |

## Trees and food forest

| English | Sesotho | Notes |
|---|---|---|
| tree | sefate (pl. difate) | app: everywhere (SA *difate*; `st.ts` has *lifate*). |
| food forest | moru wa dijo | app: drafts-st-food-forest "Moru oa Lijo". |
| layer (of a food forest) | mokgahlelo (pl. mekgahlelo) | app: drafts-st-food-forest "mekhahlelo", SA spelling. |
| canopy (tall tree layer) | mokgahlelo wa difate tse telele (canopy) | app: drafts-st-food-forest "lifateng tse telele". |
| understorey (lower tree layer) | mokgahlelo wa difate tse nyane ka tlasa tse telele (understorey) | Descriptive. |
| shrub | sehlahla (pl. dihlahla) | Common word. |
| herb | setlama (pl. ditlama) | app: drafts-st "litlama", `st.ts` (`cropHerbsMedicinal`). |
| ground cover | dimela tse kwahelang mobu | app: drafts-st-plant-guilds "semela se kwahelang mobu". |
| climber / vine | semela se palamang | app: drafts-st-vegetables-staples "morara o palamang". |
| root crop | sejalo sa metso | app: drafts-st-vegetables-staples "sejalo sa metso". |
| guild | sehlopha sa dimela (guild) | app: drafts-st-plant-guilds "sehlopha sa dimela (guild)". |
| support plant | semela sa tshehetso | app: drafts-st-plant-guilds "dimela tsa tshehetso". |
| pioneer plant | dimela tsa pele (pioneer plants) | Explain: plants that grow first on bare ground. |
| fruit tree | sefate sa ditholwana | app: `st.ts` (`cropFruitTrees`), drafts-st-plant-guilds. |
| orchard | serapa sa difate tsa ditholwana | app: `st.ts` (`shapeCategoryOrchard`). |
| indigenous plant | semela sa tlhaho | app: `st.ts` (`cropIndigenousPlants`), drafts-st-food-forest. |
| invasive alien plant | semela se tswang kantle se hlaselang naha (invasive alien) | Always explain: planting a listed invader is against the law in South Africa. |
| to prune | ho poma | app: drafts-st-plant-guilds "ho poma". drafts-st-food-forest also uses "ho faola". |
| thinning | ho fokotsa dimela | app: drafts-st-plant-guilds "Ho fokotsa (thinning)". |
| chop and drop | ho poma le ho siya fatshe e le mulch (chop and drop) | Descriptive. |
| leaf litter | makgasi a weleng | app: drafts-st-food-forest "Makhasi a oeleng", SA spelling. |
| planting hole | sekoti sa ho lema | Descriptive. |
| perennial (plant) | semela se phelang dilemo tse ngata (perennial) | (check) Descriptive; used in ch. 06. |
| annual (plant) | semela sa selemo se le seng (annual) | (check) "Se phela sehla se le seng". |
| biennial | se phelang dihla tse pedi (biennial) | (check) |
| deciduous | sefate se lahlang makgasi mariha (deciduous) | (check) |
| evergreen | sefate se dulang se le setala (evergreen) | (check) |
| coppicing | ho poma sefate haufi le fatshe (coppicing) | (check) Shoots = *ditlhomo*. |
| to graft / grafted | ho hlomathisa / se hlomathisitsweng | (check) |
| rootstock | motso wa motheo (rootstock) | (check) |
| graft union | lefito la ho hlomathisa (graft union) | (check) |
| root ball | bolo ya metso (root ball) | (check) Explain: roots plus the soil holding them. |
| planting basin | besine ya ho lema | (check) Shallow dish around a plant that holds water. |
| canopy width | bophara ba makala a sefate (canopy) | (check) |
| hedge | lerako la dihlahla (hedge) | (check) |
| living fence | terata e phelang | (check) |
| stake (for a young tree) | thupa e tshehetsang | (check) |
| inoculant (legume) | inoculant (phofo ya dibaktheria tse lokisang naetrojene) | (check) Loan word; explain. |
| winter chill / cold | mohatsela (wa mariha) | (check) Keep *serame* for frost only. |
| succulent | semela se nang le makgasi a metsi (succulent) | (check) |
| timber | lepolanka | (check) |
| plant nursery (shop) | kereche ya dimela (nursery) | (check) See seedling nursery. |
| sweet thorn *Vachellia karroo* | mooka | (check) |
| wild olive *Olea europaea* subsp. *cuspidata* | mohlware | (check) |
| wilde als *Artemisia afra* | lengana | (check) |
| buffalo thorn *Ziziphus mucronata* | mokgalo | (check) |
| ouhout *Leucosidea sericea* | tjhetjhe | (check) Lesotho *cheche*; SA spelling unsure. |
| hedge / living fence | legora la dimela (pl. magora) | (check) |

## Crops and plants

| English | Sesotho | Notes |
|---|---|---|
| maize | poone | app: `st.ts` (`cropGrainMaize`), drafts. |
| sorghum | mabele | Common word. |
| wheat | koro | Common word. |
| beans | dinawa | app: drafts-st-vegetables-staples. |
| peas | dierekisi | Loan word. |
| pumpkin | mokopu | drafts-st-vegetables-staples has "mopotse" (a gourd). (check) |
| potato | tapole (pl. ditapole) | Common word. |
| sweet potato | patata | (check) app keeps "sweet potato". |
| amadumbe (taro) | amadumbe (taro) | app: drafts-st-vegetables-staples. |
| cabbage | khabetjhe | Loan word. |
| spinach | sepinatjhe | Loan word. `st.ts` placeholder uses "Spinache". |
| carrot | sehwete (pl. dihwete) | Common word. |
| onion | eie (pl. dieie) | (check) spelling. |
| tomato | tamati (pl. ditamati) | app: drafts-st-vegetables-staples "Ditamati". |
| chilli / pepper | pelepele | app: drafts-st-vegetables-staples. |
| garlic | konofolo | Loan word. |
| beetroot | beteruti | (check) |
| lettuce | lettuce | Loan word, as in app drafts-st-vegetables-staples. |
| peach | perekisi | Common word. |
| apple | apole | Loan word. |
| fig | feiye | (check) |
| pearl millet | leotsa (pearl millet) | (check) Ch. 04. |
| jugo bean (Bambara groundnut) | ditloo | (check) Ch. 04. |
| groundnut | matokomane | (check) Ch. 04. |
| cassava | kasava | (check) Ch. 04. |
| watermelon / gourd | lehapu / mopotse (gourds) | (check) Ch. 04. |
| oats / barley | habore / harese | (check) Ch. 04. |
| lucerne | lusene | (check) Ch. 05. |
| wild olive (*Olea europaea* subsp. *cuspidata*) | mohlware | (check) Ch. 05. Other fodder-tree common names kept in English. |
| aloe | kgapa (pl. dikgapa) | (check) Ch. 05. |
| grape / vine | morara | app: drafts-st-vegetables-staples uses *morara* for a climbing vine. |
| comfrey | comfrey | Loan word; no Sesotho name. Explain what it is used for. |
| aloe | lekgala (pl. makgala) | (check) |
| gourd | mopotse (pl. mepotse) | (check) See "pumpkin". |
| sprouts (sprouted seeds) | dipeo tse melang (sprouts) | (check) |
| nectar / pollen | lero la dipalesa (nectar) / phofo (pollen) | (check) |
| marigold / nasturtium | marigold / nasturtium | Loan words; no common Sesotho names. |
| fodder | furu / dijo tsa diphoofolo | app: `st.ts` (`cropFodder` "Lijo tsa liphoofolo"). |
| grain (cereal) | dijothollo | (check) Never *lehlaka* (reed). |
| amaranth (morogo) | theepe | (check) |
| sunflower | sonobolomo | (check) |
| calabash / bottle gourd | mohope (pl. mehope) | (check) |
| quince / apricot / plum | kwepere / apolekose / plamu | (check) Loan words. |

## Animals

| English | Sesotho | Notes |
|---|---|---|
| livestock | diphoofolo / mehlape | app: `st.ts` (`allSectionAnimalsLivestock` "Liphoofolo le Mehlape"). |
| chicken | kgoho (pl. dikgoho) | app: `st.ts` (`livestockChickens` "Likhoho"), SA spelling. See inconsistencies. |
| duck | letata (pl. matata) | (check) See inconsistencies. |
| bee | notshi (pl. dinotshi) | app: `st.ts` (`livestockBees` "Linotši"), SA spelling. |
| beehive | ntlo ya dinotshi | (check) |
| honey | mahe a dinotshi | Common word. |
| beekeeping | ho rua dinotshi | Common verb *ho rua* (to keep animals). |
| goat | poli (pl. dipodi) | app: `st.ts` "Lipoli". |
| sheep | nku (pl. dinku) | Common word. |
| cattle | kgomo (pl. dikgomo) | app: `st.ts` (`livestockCattle` "Likhomo"), SA spelling. |
| pig | kolobe (pl. dikolobe) | app: `st.ts` (`livestockPigs` "Likolobe"). |
| rabbit | mmutla | Common word. |
| kraal | lesaka | app: `st.ts` (`infraLivestockKraal` "Lešaka"), SA spelling. |
| chicken house / coop | ntlo ya dikgoho | Descriptive. |
| chicken run | lebala la dikgoho | app: drafts have "lesaka la likhoho (chicken run)". (check) |
| animal tractor / chicken tractor | lesaka le tsamaiswang la dikgoho (chicken tractor) | Explain: "lesaka le se nang fatshe le sutiswang". |
| grazing | makgulo | app: `st.ts` (`shapeCategoryGrazing` "Makhulo"), SA spelling. |
| omnivore | phoofolo e jang tsohle (omnivore) | (check) Ch. 05. |
| grit (for poultry) | majwana (grit) | (check) Ch. 05. |
| gizzard | gizzard (karolo ya mpa e silang dijo) | (check) Local word unknown to drafter. |
| perch / roost | thupa ya ho robala (perch) | (check) Ch. 05. |
| nest box | lebokose la sehlaha | (check) Ch. 05. |
| drinker (poultry) | senwelo (pl. dinwelo) | (check) Ch. 05. |
| chick | tsuonyana (pl. ditsuonyana) | (check) Ch. 05. |
| rooster | mokoko | Common word. |
| breed | mofutana (breed) | (check) Ch. 05. |
| flock | mohlape (flock) | Ch. 05. |
| pecking order | pecking order (tatellano ya maemo) | (check) Ch. 05. |
| predator (of livestock) | diphoofolo tse jang dikgoho (predators) | (check) Ch. 05; mongoose and genet kept as loan words (dimongoose, di-genet). |
| vaccine / to vaccinate | moento / ho enta | (check) Ch. 05. |
| Newcastle disease | lefu la Newcastle | Ch. 05. |
| state veterinarian | ngaka ya diphoofolo ya mmuso | (check) Ch. 05. |
| animal health technician | setsebi sa bophelo bo botle ba diphoofolo | (check) Ch. 05. |
| biosecurity | tshireletso kgahlanong le mafu (biosecurity) | (check) Ch. 05. |
| swill (kitchen waste for pigs) | swill (masalla a dijo a kitjhene) | Ch. 05. Keep the boiling rule. |
| African swine fever | African swine fever (feberu ya dikolobe ya Afrika) | (check) Ch. 05. |
| castrated | e fakotsweng | (check) Ch. 05. |
| goose | goose (pl. di-goose) | (check) Ch. 05. Loan word; local word unknown to drafter. |
| turkey | kalakune (pl. dikalakune) | (check) Ch. 05. |
| colony (bees) | sehlopha sa dinotshi (colony) | (check) Ch. 05. |
| comb (bees) | mahlaku a boka (combs) | (check) Ch. 05. |
| beeswax | boka | (check) Ch. 05. |
| swarming | ho fudua ha dinotshi (swarming) | (check) Ch. 05. |
| bee sting / to be stung | ho longwa ke notshi | (check) Ch. 05. |
| smoker / veil (beekeeping) | sesebediswa sa mosi (smoker) / lesela la sefahleho (veil) | (check) Ch. 05. |
| hay / silage | furu e omisitsweng (hay) / silage | (check) Ch. 05. |
| cut-and-carry fodder | furu e kutwang e isetswa diphoofolo (cut-and-carry) | (check) Ch. 05. |
| browse (tree leaves eaten by animals) | makgasi a jewang ke diphoofolo (browse) | (check) Ch. 05. |
| pods | dikgapetla (pods) | (check) Ch. 05. |

## Pests and balanced ecology

| English | Sesotho | Notes |
|---|---|---|
| pest | sesenyi (pl. disenyi) | app: drafts-st-vegetables-staples "disenyi". |
| insect | kokonyana (pl. dikokonyana) | app: drafts-st-plant-guilds "dikokonyana". |
| beneficial insects | dikokonyana tse thusang | app: drafts-st-plant-guilds "dikokonyana tse thusang". |
| predator | sebatana se jang disenyi (predator) | (check) Explain: animals and insects that eat pests. |
| disease | lefu (pl. mafu) | app: drafts-st-vegetables-staples "Disenyi le Mafu". |
| germs | dikokwanahloko | (check) |
| aphid | di-aphid (dikokonyana tse nyane tse monyang dimela) | app: drafts-st-vegetables-staples "di-aphid". |
| caterpillar | seboko se senyang (caterpillar) | (check) See "worm". |
| cutworm | seboko se kgaolang dimela (cutworm) | (check) |
| snail / slug | kgofu / kgofu e se nang kgaketla | (check) |
| ladybird | ladybird | (check) Local name unknown to drafter; explain that it eats aphids. |
| praying mantis | praying mantis | (check) Local name unknown to drafter. |
| wasp | bobi | (check) |
| spider | sekgo | Common word. |
| frog | sehwaswa | Common word. |
| lizard | mokgodutswane | (check) |
| birds | dinonyana | Common word. |
| companion planting | ho lema dimela tse thusanang (companion planting) | app: drafts-st-plant-guilds "limela tse thusanang". |
| crop rotation | phetolo ya dijalo | app: `st.ts` (`allSectionCropRotation` "Phetolo ea Lijalo"), SA spelling. |
| homemade spray | sefafatsi se entsweng hae | Keep the safety warnings; never recommend tobacco spray. |
| registered product | sehlahiswa se ngodisitsweng | app: drafts-st-vegetables-staples. |
| ecosystem | tikoloho ya tlhaho (ecosystem) | Explain on first use. |
| succession (ecological) | tatellano ya tlhaho (succession) | Explain. Do not confuse with succession planting. |
| habitat | bodulo ba diphoofolo le dimela (habitat) | app: drafts-st-food-forest uses "tikoloho ea lehae". |
| wildlife | diphoofolo tsa naha | app: drafts-st-food-forest. |
| wetland | mohlaba (wetland) | (check) |
| trap crop (sacrificial crop) | sejalo sa leraba (trap crop) | (check) Ch. 10. |
| ant / ants | bohlwa | (check) Ch. 10. |
| termite | di-termite | (check) Ch. 10. Loan word; local word unsure. |
| parasitic wasp | bobi ba parasite (pl. mabobi a parasite) (parasitic wasp) | (check) Ch. 10. |
| larva (pl. larvae) | setshwinyana (pl. ditshwinyana) (larvae) | (check) Ch. 10. |
| fruit fly / maggot | ntsintsi ya ditholwana (fruit fly) / diboko tsa dintsintsi (maggots) | (check) Ch. 10. |
| mole-rat | kgoto ya mobu (pl. dikgoto tsa mobu) (mole-rat) | (check) Ch. 10. Golden mole kept as loan word "di-golden mole". |
| porcupine | noko (pl. dinoko) | Ch. 10. |
| chameleon | leobu (pl. maobu) | (check) Ch. 10. |
| owl | sephooko (pl. diphooko) | (check) Ch. 10. |
| honeydew / sooty mould | lero le monate le tswekere (honeydew) / hlobo e ntsho (sooty mould) | (check) Ch. 10. |
| tobacco / snuff | koae / koae ya nko (snuff) | (check) Ch. 10. Never recommend tobacco spray. |
| heavy / light feeders | dijalo tse jang haholo / tse jang hanyane (heavy / light feeders) | (check) Ch. 10. |
| moth | serurubele sa bosiu (pl. dirurubele tsa bosiu) | (check) Ch. 10. |

## Home and appropriate technology

| English | Sesotho | Notes |
|---|---|---|
| appropriate technology | theknoloji e loketseng | (check) Explain: simple tools you can make and repair locally. |
| renewable energy | matla a ntjhafalang | (check) |
| solar energy | matla a letsatsi | app: `st.ts` (`allSectionSunSolar` "Letsatsi le Matla a Letsatsi"). |
| solar geyser | geyser ya letsatsi | Loan word. |
| solar cooker | setofo sa letsatsi (solar cooker) | Explain on first use. |
| sun drying | ho omisa ka letsatsi | app: drafts-st-seeds-sovereignty "Ho Omisa". |
| solar dryer | seomisi sa letsatsi (solar dryer) | (check) Explain on first use. |
| wonder bag | wonder bag (mokotla o phehang ka mocheso o bolokilweng) | Loan word; explain on first use. |
| rocket stove | setofo sa rokete (rocket stove) | Explain on first use. Keep the safety note. |
| biogas | kgase ya manyolo (biogas) | (check) Explain; keep the safety note (can explode; needs fresh air). |
| biogas digester | tanka ya biogas (biogas digester) | (check) |
| firewood | patsi | Common word. |
| smoke | mosi | Common word. |
| fresh air / ventilation | moya o hlwekileng o kenang | Descriptive. |
| mould (on food) | hlobo | (check) Ch. 11. |
| paraffin | parafene | (check) Ch. 11. |
| brazier (imbawula) | mbawula (imbawula) | (check) Ch. 11. |
| carbon monoxide | carbon monoxide | (check) Ch. 11. Loan word; explain as a gas you cannot see or smell that kills. |
| slurry / digestate (from a digester) | slurry | (check) Ch. 11. Loan word. |
| drying rack / netting | rakana / letlowa | (check) Ch. 11. |
| hay box | lebokose la jwang (hay box) | (check) Ch. 11. |
| insulation | insulation (sekwahelo se thibelang mocheso) | (check) Ch. 11. Loan word; explain on first use. |

## Tools

| English | Sesotho | Notes |
|---|---|---|
| hand tools | disebediswa tsa letsoho | app: `st.ts` (`landPrepHandToolsLabel` "Lisebelisoa tsa letsoho"), SA spelling. |
| spade / shovel | kharafu | (check) |
| garden fork | fereko | app: `st.ts` (`landPrepHandToolsLabel`). |
| hoe | kepe | (check) |
| rake | reke | (check) |
| plough | mohoma | app: `st.ts` (`landPrepAnimalDesc`). |
| wheelbarrow | kiribae | (check) |
| axe | selepe | Common word. |
| bucket | emere | app: `st.ts` (`waterDeliveryBucketDesc` "Emere"). |
| tape measure | tepi ya ho metha | app: drafts-st-reading-landscape "tepi e methang (tape measure)". |
| compass | khampase | app: drafts-st-reading-landscape. |
| fence | terata | app: `st.ts` (`sectionFencing`). |

## App clean-up log (2026-09-26)

Machine clean-up of the Sesotho app strings (`st.ts`, about 408 strings) and the course drafts
(all `drafts-st*` files, about 292 draft strings). A fluent Sesotho reviewer should check it.
English strings, keys, `sourceEnglish`, review statuses and `{placeholders}` were not changed.
Items marked **(check)** are the ones the drafter is least sure of.

### 1. Orthography: Lesotho → South African (word by word, all files)

| Old (Lesotho) | New (SA) | Examples |
|---|---|---|
| *li-* prefix and concord | *di-* | lijalo → dijalo, lifate → difate, libaka → dibaka, linepe → dinepe, lintlha → dintlha, "li ka" → "di ka" |
| *ea* / *oa* (possessive, verbs) | *ya* / *wa* | naha ea hau → naha ya hao, ebe oa se boloka → ebe wa se boloka, tsamaea → tsamaya |
| passive *-oe*, *-oang*, *-oeng* | *-we*, *-wang*, *-weng* | bolokiloe → bolokilwe, hakantsoeng → hakantsweng, lengoang → lengwang |
| *tš*, *š* | *tsh*, *s* | tšoaea → tshwaya, tšimo → tshimo, Motšehetsi → Motshehetsi, lešaka → lesaka |
| *kh* (fricative) | *kg* | khetha → kgetha, khutlo → kgutlo, makhulo → makgulo, mokhoa → mokgwa, khoholeho → kgoholeho, likhoho → dikgoho, likhomo → dikgomo |
| *kh* (aspirated k in loan words) | kept | khalendara, khabone, khamera, khoase, khampase, dikhemikhale |
| *ch* | *tjh* | cheka → tjheka, lecha → letjha, sechaba → setjhaba, mocheso → motjheso, lichelete → ditjhelete |
| *u* (you), *hau* | *o*, *hao* | "u ka" → "o ka", ea hau → ya hao |
| *l* before *i*/*u* inside words | *d* | leholimo → lehodimo, seliba → sediba, moeli → moedi, bobeli → bobedi, sebelisa → sebedisa, lula → dula, lumella → dumella, qalile → qadile |
| apostrophe forms | double consonant / *nngwe* | 'mapa → mmapa, 'mala → mmala, 'maraka → mmaraka, 'me → mme, e 'ngoe → e nngwe, 'meli → mmedi, e-s'o → eso |
| *oe*/*oa* vowel pairs | *we*/*wa*/*ya* | moea → moya, leboea → leboya, boroa → borwa, bohlokoa → bohlokwa, leoatle → lewatle, khoeli → kgwedi, joale → jwale, joalo → jwalo, tsoa → tswa |
| macron *ō* | plain *o* | hōla → hola, se hōlang → se holang (st.ts `photoPromptBody`, `photoLabelWhatsGrowing`, `sectionCropsGrowing`; drafts-st intro L3 quiz) |

### 2. Terms fixed to match this glossary

- **compost**: "Mantle" (= dung), "mantle", "Manyolo a Bolaang" (= "manure that kills"),
  "compost", "khomporo", "mafelo" → **kompose (compost)**. st.ts `soilAmendmentCompost`,
  `infraCompostBay`, `practiceFullyOrganicDesc`, `goalRestoreTheLandDesc`, `insightLowSoilCarbon`,
  `insightGoodSoilCarbon`; drafts-st-soil-health module title and description, lesson 2 title,
  body, key points and quiz; drafts-st intro. *Mantle* is kept where it really means droppings:
  drafts-st-soil-health L2 body ("mantle a diphoofolo tsa lapeng", pet faeces) and
  drafts-st-water-harvesting (roof and dam lessons, bird/animal droppings).
- **swale**: "li-swale", "swale", "maswale", "Mekoti", "mekoting", "foro e lekaneng moeling",
  "mokeremete" → **mokero (swale)**, plural **mekero (swales)**; "level contour swale" →
  **mokero o lekaneng o latelang contour**. st.ts `insightModerateRain`; drafts-st-water-harvesting
  description, L1 alt, title, key point, quiz; drafts-st-reading-landscape L1 body and quiz;
  drafts-st intro L1 body and L2 quiz. drafts-st-water-harvesting L1 quiz option "Whether the
  trench can be made deeper" now says *mokero* because the trench there is the swale **(check)**.
- **channel / furrow** (not a swale): st.ts `photoDetailWaterDrainage` "mekero" → "diforo tsa
  metsi"; `waterDeliveryFloodLabel` "Tlhohlonono / mokero" → "Ho tlatsa ka metsi / foro";
  `waterDeliveryFloodDesc` "a matha mekerong" → "a phalla ka diforo".
- **berm**: "mekoallo" → **marako a mobu (berms)** (drafts-st-water-harvesting description and
  L1 title) **(check)**.
- **chicken / duck** (drafts-st-small-livestock description and L1 title): "Dikgogo", "madada",
  "dinotshe" → **dikgoho**, **matata**, **dinotshi**.
- **garden bed**: bare "bethe", "lae / dilae", "libetete tsa ho mela" → **bethe ya serapa /
  dibethe tsa serapa**. drafts-st-vegetables-staples (description, L1 alt, title, key point,
  quiz; L2 alt), drafts-st-reading-landscape (L2 body, quiz option and rationale; L3
  body and quiz), st.ts `reportGroupSoil`, `reportAddSoil`, `insightLightFrost`,
  `homeLimaVisionDesc` ("mobu" → "bethe ya serapa", English says "bed").
- **frost**: "lehla" (st.ts) and "serame sa phoka" (drafts) → **serame**. st.ts
  `frostGrowingSeason`, `climateReportDesc`, `frostFreePrefix`, `lightFrostPrefix`,
  `climateFrostExpected`, `climateLightFrost`, `climateFrostFree`, `insightFrostExpected`,
  `insightLightFrost`, `insightFrostFree`; drafts-st-reading-landscape L2 body, key point and
  quiz, L3 title ("Moya, Serame, le Boemo ba Naha"), body, key point and rationale, L4 body.
- **nitrogen**: "nitrogen", "naeterojene" → **naetrojene** (drafts-st-plant-guilds quiz options;
  drafts-st-soil-health quiz options; drafts-st-vegetables-staples beans lesson and quiz).
- **slope**: "moepa", "miepa", "terapo" → **letswapo / matswapo**, with the concords changed from
  class *o* to class *le* ("moepa o mong le o mong" → "letswapo le leng le le leng").
  drafts-st-reading-landscape L1 alt, body and quizzes, L2 alt and key point, L3 alt; st.ts
  `photoTip`, `notesPlaceholder`, `insightsEmptyPrompt` ("hotla"). **(check)**
- **windbreak**: "Thibela-moea", "Likhuselo tsa moea" → **sesireletsi / disireletsi sa moya**
  (st.ts `windbreakDesignHeader`, `allSectionWindWindbreaks`, `insightHighWind`).
- **mulch**: st.ts `soilAmendmentMulch` "Sekoahelo" → "Mulch"; `summarySemiAridSteppe`
  "ditshipi" (= irons) → "mulch".
- **borehole**: st.ts `waterSourceBorehole` "Seliba" → "Sediba se tjhekilweng (borehole)";
  `guideAddWaterPointDesc` "sehlohlolong" (not a water word) → "boreholeng, sedibeng" and the
  garbled "Beha pinmeng" → "Beha pini" (also `guideSavePlaceDesc`) **(check)**.
- **greywater**: st.ts `waterSourceGreyWater` "Metsi a sebelisitsoeng" → "Metsi a ditshila a
  malapeng".
- **pond**: st.ts `waterStoragePond` "Letsha" (= lake) → **letangwana** **(check)**.
- **map**: "'Mapa", "mephe" → **mmapa** (st.ts `tabMap`, `navDesignMap`, `homeOpenMap`,
  `homeReopenMap` and all map hints).
- **contours**: st.ts `layerToggleContours`, `layersButtonCollapsedContours`,
  `guideMapLayersDesc` "Mokhoa" (= method) → "Di-contour".
- **parcel**: st.ts `parcelsSectionLabel`, `parcelDefaultName`, `parcelAddButton`,
  `labelsParcelsAndWaterToggle` "Koticheng / Likoticheng" → "Karolo ya naha / Dikarolo tsa naha"
  **(check)**.
- **mentor** (role name): st.ts `myRecordsSubtitle` "motlhokomedi" (supervisor) → "moeletsi",
  matching the app role merge (English still says "supervisor").
- **tunnel**: drafts-st-reading-landscape "Kotopo" → "Tonele".

### 3. Mistranslations rewritten from the English (st.ts, non-mechanical)

These strings were wrong in meaning, not just spelling, and were rewritten from the English:
`statEToSub` (evapotranspiration → "mouwane"), `phNeutral`, `hand tools` list in
`landPrepHandToolsLabel` (spade, fork, hoe → kharafu, fereko, kepe), `waterDeliveryBucketDesc`
("chefo" = poison → "kanna ya ho nosetsa"), `inWinter`, `winterLowPrefix`, `climatePatternWinter`
("selemo se sele" → "mariha"), `climateWetLabel` ("Molumo" → "Nako ya pula"),
`plantTenderMidAug`, `lifeGuideIndigenousPlants`, `lifeGuideVegetables`, `lifeGuideFruitTrees`,
`lifeGuideIndigenousFruit`, `lifeGuideNutTrees`, `lifeGuideAnimalSystems`, `insightSemiArid`,
`insightStrongRain`, `insightFrostExpected`, `insightLightFrost`, `insightFrostFree`,
`insightHighWind`, `insightModerateWind`, `insightLowSoilCarbon`, `insightGoodSoilCarbon`,
`climateRainfallInsight`, `zoneHumidSubtropical*` ("e nang le pula" → "e mongobo";
mist belt → "lebanta la mohodi"), `zoneSemiArid*` ("sekaka" → "lehwatata"), `summaryWarmWetSummer`,
`summaryReliableRainfall`, `summaryWetMildWinter`, `summarySemiAridSteppe`, `summaryAridDesert`,
`summaryHighAltitude`, `surveyStepsOf6`, `surveyGoalSoil` and `popiaGoalSoilLabel` ("Busa" →
"Tsosolosa"), `surveyGoalEducation`, `homeStatASL`, `homeQuickFinanceDesc`, `homeDashboards`,
`homeRoleMentorDesc`, `homeRoleNGODesc`, `homeRoleFunderDesc`, `navFieldJournal` ("Puku" →
"Buka"), `navGardenSurvey` ("Tsimu" → "Serapa"), `navCloseMenu`, `myRecordsCropLabel` and the
validation errors ("Selallo" → "Sejalo"), `myRecordsKgHarvestedLabel`, `myRecordsTotalHarvested`
("khwetsweng" → "kotutsweng"), `myRecordsBuyerLabel` ("Morekisi" = seller → "Moreki" = buyer),
placeholders "bv." (Afrikaans) → "mohl.", `insightsReportSubtitle` ("Mekhatlo" → "Dihlopha tsa
dimela" for guilds), `popiaTitle`, `popiaStoreDesc`, `popiaShareDesc` ("kabo" → "tshusumetso"
for impact), `popiaGoalTitle`, `popiaGoalFeedDesc`, `popiaGoalIncomeDesc`, `popiaGoalSoilDesc`.
These are the strings a reviewer should read first. **(check)** all of them.

### 4. Left as they were (for the reviewer)

- drafts-st-small-livestock L1 body keeps "Di fata hara **masala** a dimela" (a test pins it);
  other drafts write *masalla*. Pick one. **(check)**
- `st.ts` role label "Molemisi" (farmer) and `sectionPresetFarmer` "Sehwai" were not changed
  (app role names).
- "dipokotho tsa serame (frost pockets)" in drafts-st-reading-landscape was kept; this glossary
  prefers *sekoti sa serame* for frost hollow. **(check)**
- `navManual` ("Buka ya Permaculture") was kept as it is.

## Kept in English (26 Sep 2026)

Rory's decision (see `research/manual/KEEP-ENGLISH.md`): the words below stay in **English** in
the Sesotho manual, and `content/manual/st/12-glossary.md` explains them all. This section
**overrides** the Sesotho column of the tables above for these words. In chapters 00 to 11 the
first use in each chapter is written in bold with a short Sesotho explanation in brackets, e.g.
"**di-swale** (mekero e tshwarang metsi)"; later uses are plain English.

**Grammar used.** An English noun is treated as a class 9/10 loan noun: singular with no prefix
and concord *e* ("swale e", "compost e ngata", "food forest ya hao", "windbreak e ntle"); plural
with the hyphenated prefix *di-* and concord *di/tse* ("di-swale tse", "di-legume", "di-predator",
"di-ecosystem"). Locatives use *ho* ("ho swale", "ho food forest", "ho worm farm") instead of
*-ng*. Concords of the old Sesotho noun were changed to match (e.g. *mokero o* → *swale e*,
*lerako la mobu le* → *berm e*, *metsi a ditshila a* → *greywater e*, *moru wa dijo o* →
*food forest e*). The English root is never changed ("compost", not *kompose*).

| English (kept) | Sesotho phrase(s) replaced in chapters 00 to 11 |
|---|---|
| Animal tractor | diterekere tsa diphoofolo; lesaka le tsamaiswang (la dikgoho); masaka a dikgoho a tsamaiswang; diphoofolo tse sebetsang jwaloka terekere; terekere ya diphoofolo (*chicken tractor* kept as the English alias) |
| Annual | (semela) sa selemo se le seng; sa sehla se le seng; dijalo tsa selemo se le seng; "Sa (hlabula/mariha) sa selemo se le seng" in the ch. 05 and ch. 06 tables |
| Appropriate technology | theknoloji e loketseng (ch. 11, including the chapter title) |
| Berm | lerako la mobu (only where it means the bank below a swale; "lerako la mobu" for a dam wall kept) |
| Biodiversity | mefutafuta ya dintho tse phelang (plain *mefutafuta* = "diversity" kept) |
| Biogas digester | tanka ya biogas; ditanka tsa biogas |
| Biomass | was already English; only bolded/explained where first used |
| Biosecurity | tshireletso kgahlanong le mafu |
| Blackwater | metsi a ntlwana |
| Canopy | makala a sefate (canopy width); boholo ba makala a tsona; makala a maholo |
| Carbon to nitrogen ratio | not replaced: ch. 08 describes the ratio in words ("dikarolo tse 25 ho isa ho tse 30 tsa khabone ho karolo e 1 ya naetrojene") and never names it |
| Catchment | sebaka se bokellang metsi; dibaka tse bokellang metsi |
| Chop and drop | ho poma le ho siya fatshe |
| Climate change | phetoho ya boemo ba lehodimo (also the ch. 03 section heading) |
| Companion planting | ho lema dimela tse thusanang |
| Compost | kompose (every occurrence, incl. "qubu ya kompose" → "qubu ya compost", "tee ya kompose" → "tee ya compost") |
| Contour | was already English ("mola wa contour") |
| Coppicing | ho poma sefate haufi le fatshe; difate tse pomilweng haufi le fatshe (coppiced); se mela hape ha se kutilwe |
| Crop rotation | phetolo ya dijalo (plain *phetolo* = "rotation" kept) |
| Double-reach bed | dibethe tsa serapa tse fihlelwang ho tswa mahlakoreng a mabedi (ch. 07 heading) |
| Drip irrigation | nosetso ya marothodi; mela/dikhiti tsa marothodi; "Marothodi" in the ch. 07 table |
| Ecosystem | tikoloho ya tlhaho; ditikoloho tsa tlhaho (the ch. 09 title "tikoloho ya tlhaho" = ecology, kept) |
| Edge | mathoko (only in the permaculture sense, ch. 01 and ch. 06) |
| Erosion | kgoholeho ya mobu |
| Firebreak | lebanta le thibelang mollo; mabanta a thibelang mollo |
| First-flush diverter | sekgelo sa metsi a pele |
| Fodder | **kept local**: *furu* (see note below) |
| Food forest | moru wa dijo; meru ya dijo |
| Frost pocket | dikoti tsa serame; sekoti sa serame |
| Grafting | ho hlomathisa; se hlomathisitsweng; lefito la ho hlomathisa |
| Green manure | manyolo a matala |
| Greywater | metsi a ditshila a malapeng |
| Groundcover | dimela tse kwahelang mobu; se kwahela mobu |
| Guild | dihlopha tsa dimela |
| Habitat | bodulo (ba diphoofolo le dimela); mahae (habitats) — *bodulo* meaning shelter or worm bedding kept |
| Humus | was already English |
| Indigenous | **kept local**: *(sa/tsa) tlhaho* (see note below) |
| Infiltration | ho kenya metsi mobung, in "dikotlolo tsa ho kenya metsi mobung" → "dikotlolo tsa infiltration" |
| Invasive species | dimela tse (tswang kantle tse) hlaselang naha; semela se hlaselang naha; mefuta e hlaselang naha; (tlhapi) e hlaselang naha. The adjective in "mefoka e hlaselang haholo" (very invasive weeds) and "disenyi tse ntjha tse hlaselang" kept |
| Keyhole bed | lesoba la senotlolo (keyhole) in the ch. 07 mandala/keyhole section |
| Legume | dimela/dijalo tsa dinawa; semela sa dinawa; "Semela sa dinawa" in the ch. 05, 06 and 08 tables |
| Microclimate | boemo ba lehodimo ba sebaka se senyane; maemo a lehodimo a dibaka tse nyane |
| Mulch | was already English (sekwahelo sa mobu used as the explanation) |
| Nitrogen fixer | dimela tse lokisang naetrojene, where the English has the noun "nitrogen fixer(s)". The adjective "nitrogen-fixing" stays "se lokisang naetrojene" |
| Organic matter | dintho tsa tlhaho tse bolang (ch. 07 to 10); "organic material" (dintho tsa tlhaho) kept |
| Perennial | dimela tse phelang dilemo tse ngata; se phela dilemo tse ngata (tables) |
| Permaculture | was already English |
| pH | was already English |
| Pollinator | ditsamaisi tsa phofo; dikokonyana tse tsamaisang phofo ya dipalesa |
| Predator | dibatana (tse jang disenyi); diphoofolo tse jang dikgoho; diphoofolo tse di tsomang; diphoofolo tse a jang |
| Rocket stove | setofo sa rokete; ditofo tsa rokete |
| Rootstock | metso ya motheo; motso wa motheo |
| Runoff | metsi a phallang; phallo (where it means runoff). "Palo ya phallo (runoff coefficient)" kept as a term, and ordinary "flowing water" kept |
| Sector | lekala; makala (ch. 02 and ch. 03, including the ch. 03 title "Moralo wa makala" → "Moralo wa di-sector") |
| Slurry | was already English |
| Solar dryer | seomisi sa letsatsi; diomisi tsa letsatsi |
| Succession | tatellano ya tlhaho ("ho jala ka tatellano" = succession planting is a different term, not touched) |
| Swale | mokero; mekero; mekerong |
| Thermal mass | dintho tse bolokang mocheso |
| Topsoil | mobu wa kahodimo |
| Trap crop | dijalo tsa leraba; sejalo sa leraba; semela sa leraba (trap plant) |
| Understorey | not used in chapters 00 to 11 (ch. 06 layer 2 is "low-tree layer" in the English) |
| Windbreak | sesireletsi sa moya; disireletsi tsa moya |
| Wonder bag | was already English |
| Worm farm | polasi ya diboko; polasing ya diboko |
| Worm tea | "tee ya diboko"; "worm tea" in quotes |
| Zone | was already English ("Zone 1", "di-Zone") |

**Left local, and why (for the reviewer):**

- **Fodder → *furu*.** *Furu* is the ordinary Sesotho farm word (app: `st.ts` `cropFodder`), not a
  coined phrase, so it was left in chapters 00 to 11. The glossary chapter explains *Fodder* and
  gives *furu* in brackets. Switch to "fodder" if the reviewer prefers strict consistency.
- **Indigenous → *(sa/tsa) tlhaho*.** Everyday Sesotho ("dimela tsa tlhaho", "sa tlhaho" in the
  tree tables), and "indigenous" is an adjective that does not take a noun prefix cleanly.
- **Edge** in its everyday sense (edges of fields, beds, a bed's border) stays *mathoko*; the
  principle name "Sebedisa mathoko mme o ananele tse ka thoko" was kept as in the principles table.
- **Canopy** in ch. 03 ("moriti o mosesane wa difate tsa pele", a light canopy of pioneer trees)
  kept, because *moriti* (shade) reads naturally there.
- **Climate** without "change" (boemo ba lehodimo), "a changing climate" (boemo ba lehodimo bo
  fetohang) and "As the climate gets hotter" were left, since the term is "climate change".
- **Carbon to nitrogen ratio** and **Understorey** do not appear as terms in chapters 00 to 11.

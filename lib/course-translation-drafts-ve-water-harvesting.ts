/** Unpublished, source-paired Tshivenda machine draft for Water Harvesting. Unreviewed safety-critical wording remains exact English where needed. */
import type { TshivendaCourseModuleDraft, TshivendaSourcePair } from './course-translation-drafts-ve.ts';

const pair = (sourceEnglish: string, tshivendaDraft: string, reviewStatus: TshivendaSourcePair['reviewStatus'] = 'machine-draft'): TshivendaSourcePair => ({
  sourceEnglish, tshivendaDraft, reviewStatus,
});

const hold = (sourceEnglish: string): TshivendaSourcePair => pair(sourceEnglish, sourceEnglish, 'hold');

export const TSHIVENDA_WATER_HARVESTING_DRAFT: TshivendaCourseModuleDraft = {
  id: "water-harvesting",
  language: "ve",
  reviewStatus: "machine-draft",
  sourceMetadata: {
    durationMins: 35,
    category: "water"
  },
  title: {
    sourceEnglish: "Water Harvesting",
    tshivendaDraft: "U Kuvhanganya Maḓi",
    reviewStatus: "machine-draft"
  },
  description: {
    sourceEnglish: "Swales, berms, dams, rainwater tanks and greywater — slow, spread and sink every drop.",
    tshivendaDraft: "Swales, berms, dams, rainwater tanks na greywater — fhungudzani luvhilo, phaḓaladzani nahone sink every drop.",
    reviewStatus: "machine-draft"
  },
  lessons: [
    {
      id: "water-harvesting-l1",
      infographicAlt: {
        sourceEnglish: "Concept cross-section of a level contour swale with a raised mound below it. Arrows show runoff slowing and spreading; infiltration depends on the soil and site.",
        tshivendaDraft: "Tshifanyiso tsha muhumbulo tsha cross-section ya level contour swale i re na mound yo takuwaho fhasi hayo. Misevhe i sumbedza runoff i tshi fhungudza luvhilo na u phaḓalala; infiltration i ḓitika nga mavu na fhethu.",
        reviewStatus: "machine-draft"
      },
      title: {
        sourceEnglish: "Swales and Berms: Slowing Water on the Slope",
        tshivendaDraft: "Swales na Berms: U Fhungudza Luvhilo lwa Maḓi kha U Sendama ha Mavu",
        reviewStatus: "machine-draft"
      },
      body: {
        sourceEnglish: "One kind of swale is a level trench on contour. It slows and spreads runoff so some water can soak into suitable soil. Other swales are designed with a slight, controlled grade to carry excess water slowly to a safe outlet. Which approach fits your land depends on the soil, slope, drainage and storm flow. Have a trained local adviser check the line, overflow and receiving point before digging.\n\nThe excavated soil forms a berm on the downhill side, where trees can be planted when the site design is suitable.\n\nTrees planted there may draw on moisture stored in the soil after rain, depending on the site.\n\nHeavy rain can fill a swale faster than water soaks into the soil. Plan a safe overflow before digging.\n\nThe route must not erode the slope or send damaging water to a neighbour. A downstream swale or dam must be able to receive it safely.\n\nAsk a trained local adviser to assess the soil, slope and storm flow. A picture is not a construction design.\n\nSlope alone does not tell you whether a swale is suitable. Soil, drainage, unstable ground and the water arriving from upslope all matter.\n\nKeep good ground cover. Get a local assessment before digging on steep, wet or unstable land. Grass barriers and terraces also need a design suited to the site.",
        tshivendaDraft: "Lushaka luthihi lwa swale ndi level trench on contour. I fhungudza luvhilo na u phaḓaladza runoff, uri maḓi maṅwe a kone u dzhena kha mavu o teaho. Dziṅwe swales dzi itelwa u vha na slight, controlled grade uri dzi hwale maḓi o engedzeaho nga u ongologa a tshi ya kha safe outlet. Nḓila ine ya fanelea land yaṋu i bva kha mavu, slope, drainage na storm flow. Musi ni sa athu u bwa, humbelani trained local adviser uri a sedze line, overflow na receiving point.\n\nMavu o bwiwaho a vhumba berm nga thungo ya downhill, hune miri ya nga ṱavhiwa arali site design yo tea.\n\nMiri yo ṱavhiwaho henefho i nga shumisa moisture yo vhulungwaho mavuni nga murahu ha mvula, zwi tshi ya nga fhethu.\n\nMvula khulwane i nga ḓadza swale nga luvhilo lu fhiraho lune maḓi a dzhena ngalwo mavuni. Pulani safe overflow ni sa athu u bwa.\n\nNḓila a i tei u erode slope kana u rumela maḓi a tshinyaho kha muhura. Swale ya downstream kana damu ḽa downstream ḽi fanela u kona u ṱanganedza maḓi ayo safely.\n\nHumbelani trained local adviser uri a ṱole mavu, slope na storm flow. Tshifanyiso a si construction design.\n\nSlope fhedzi a i sumbedzi arali swale yo tea. Mavu, drainage, unstable ground na maḓi ane a bva upslope zwoṱhe zwi na ndeme.\n\nVhulungani ground cover yavhuḓi. Wanani local assessment ni sa athu u bwa kha steep, wet kana unstable land. Grass barriers na terraces na zwone zwi ṱoḓa design yo teaho site.",
        reviewStatus: "machine-draft"
      },
      keyPoints: [
        {
          sourceEnglish: "A level contour swale can hold runoff for infiltration on a suitable site; other swales need a designed grade and safe outlet",
          tshivendaDraft: "Level contour swale i nga fara runoff uri hu vhe na infiltration kha site yo teaho; dziṅwe swales dzi ṱoḓa designed grade na safe outlet",
          reviewStatus: "machine-draft"
        },
        {
          sourceEnglish: "Keep good ground cover and plan a safe overflow",
          tshivendaDraft: "Vhulungani ground cover yavhuḓi nahone ni pulane safe overflow",
          reviewStatus: "machine-draft"
        },
        {
          sourceEnglish: "Assess soil, drainage, slope and storm flow before digging",
          tshivendaDraft: "Ṱolani mavu, drainage, slope na storm flow ni sa athu u bwa",
          reviewStatus: "machine-draft"
        },
        {
          sourceEnglish: "A concept picture is not a construction design",
          tshivendaDraft: "Tshifanyiso tsha muhumbulo a si construction design",
          reviewStatus: "machine-draft"
        }
      ],
      quiz: [
        {
          question: {
            sourceEnglish: "A farmer planned a level contour swale. After heavy rain, one end holds most of the water. What should the farmer check before changing the earthwork?",
            tshivendaDraft: "Mulimi o pulana level contour swale. Nga murahu ha mvula khulwane, magumo mathihi a fara vhunzhi ha maḓi. Mulimi u tea u ṱola mini a sa athu u shandula earthwork?",
            reviewStatus: "machine-draft"
          },
          options: [
            {
              sourceEnglish: "Whether the trench can be made deeper without a site check",
              tshivendaDraft: "Arali trench i tshi nga itwa yo dzikaho u fhira hu si na site check",
              reviewStatus: "machine-draft"
            },
            {
              sourceEnglish: "The intended design and measured levels with a trained local adviser; an unintended low point may be present",
              tshivendaDraft: "Design yo pulaniwaho na measured levels zwi tshi ṱolwa na trained local adviser; fhethu hu re fhasi hu songo pulaniwaho hu nga vha hone.",
              reviewStatus: "machine-draft"
            },
            {
              sourceEnglish: "Whether a new dam at the lowest point will catch every overflow",
              tshivendaDraft: "Arali dam ntswa kha lowest point i tshi ḓo fara overflow iṅwe na iṅwe",
              reviewStatus: "machine-draft"
            },
            {
              sourceEnglish: "Whether the soil should be compacted to stop all infiltration",
              tshivendaDraft: "Arali mavu a tshi tea u compacted uri hu imiswe infiltration yoṱhe",
              reviewStatus: "machine-draft"
            }
          ],
          sourceCorrectIndex: 1,
          rationale: {
            sourceEnglish: "A level contour design should spread water along its length. Uneven filling may indicate an unintended low point, but some swales are intentionally graded to a safe outlet. Check the actual design, soil and overflow route before altering it.",
            tshivendaDraft: "Level contour design i tea u phaḓaladza maḓi kha vhulapfu hayo. U ḓala hu sa lingani hu nga sumbedza fhethu hu re fhasi hu songo pulaniwaho, fhedzi dziṅwe swales dzi itwa nga khole dzi na grade ya u ya kha safe outlet. Ṱolani design ya vhukuma, mavu na overflow route ni sa athu u i shandula.",
            reviewStatus: "machine-draft"
          }
        },
        {
          question: {
            sourceEnglish: "A farmer wants to control erosion on steep land. What should she do before digging?",
            tshivendaDraft: "Mulimi u ṱoḓa u langa erosion kha steep land. U tea u ita mini a sa athu u bwa?",
            reviewStatus: "machine-draft"
          },
          options: [
            {
              sourceEnglish: "Standard swales dug as deep as possible",
              tshivendaDraft: "Standard swales dzo bwiwaho dza dzika nga hune zwa konadzea ngaho",
              reviewStatus: "machine-draft"
            },
            {
              sourceEnglish: "Keep ground covered and get a site assessment for suitable erosion controls",
              tshivendaDraft: "Itani uri mavu a dzule o funengetea nahone ni wane site assessment ya erosion controls dzo teaho",
              reviewStatus: "machine-draft"
            },
            {
              sourceEnglish: "A large dam at the bottom to catch all runoff",
              tshivendaDraft: "Dam khulwane fhasi uri i fare runoff yoṱhe",
              reviewStatus: "machine-draft"
            },
            {
              sourceEnglish: "Compacting the soil surface with a roller",
              tshivendaDraft: "U compact-a nṱha ha mavu nga roller",
              reviewStatus: "machine-draft"
            }
          ],
          sourceCorrectIndex: 1,
          rationale: {
            sourceEnglish: "Slope alone is not enough to choose an earthwork. Soil, drainage, stability and storm flow must also be assessed.",
            tshivendaDraft: "Slope fhedzi a yo ngo lingana u khetha earthwork. Mavu, drainage, stability na storm flow na zwone zwi tea u ṱolwa.",
            reviewStatus: "machine-draft"
          }
        }
      ]
    },
    {
      id: "water-harvesting-l2",
      infographicAlt: {
        sourceEnglish: "A farm dam cut through the middle: water flowing in at one end, the stored body of water, a spillway at the top edge for overflow, and a planted bank holding the soil.",
        tshivendaDraft: "Dam ya bulasini yo sumbedzwaho yo tsheiwa vhukati: maḓi a tshi elela a tshi dzhena kha magumo mathihi, maḓi o vhulungwaho, spillway kha muṅwenda wa nṱha ya overflow, na bank yo ṱavhiwaho zwimela ine ya fara mavu.",
        reviewStatus: "machine-draft"
      },
      title: {
        sourceEnglish: "Farm Dams and Ponds: Storing Water for the Dry Season",
        tshivendaDraft: "Madamu na Zwidziva zwa Bulasini: U Vhulunga Maḓi a Tshifhinga tsha u Oma",
        reviewStatus: "machine-draft"
      },
      body: {
        sourceEnglish: "A dam or pond can store runoff, but the amount available depends on local rain, the catchment, losses and how much water you use.\n\nRainfall seasons differ across South Africa. Use local records and plan for dry periods; a full dam is not guaranteed.\n\nBefore changing a watercourse or building storage works, check the required authorisation with the water authority.\n\nA dam needs a site investigation and a design by a suitably qualified person. Catchment runoff, soil, foundations, downstream risk and a safe spillway all matter.\n\nDo not assume that annual rainfall tells you the size of a flood or the storage you will have.\n\nAn uncontrolled overflow can erode and breach the wall. Plan a safe route for excess water before construction.\n\nWater can be lost through evaporation and seepage. Check the water level and look for leaks or erosion.\n\nKeep the spillway clear and maintain the bank cover specified in the design. Do not plant trees on an earth dam wall.\n\nAnimals can damage banks and add manure to the water. Their presence does not make the water clean or safe.",
        tshivendaDraft: "Dam kana pond i nga vhulunga runoff, fhedzi maḓi ane a wanala a bva kha mvula ya henefho, catchment, maḓi a xelaho na uri ni shumisa maḓi mangana.\n\nTshifhinga tsha mvula tshi a fhambana u mona na Afurika Tshipembe. Shumisani rekhodo dza henefho nahone ni pulanele zwifhinga zwo omaho; dam yo ḓalaho a yo khwaṱhisedzwi.\n\nMusi ni sa athu u shandula watercourse kana u fhaṱa storage works, ṱolani authorisation ine ya ṱoḓea kha water authority.\n\nDam i ṱoḓa site investigation na design yo itwaho nga suitably qualified person. Catchment runoff, mavu, foundations, downstream risk na safe spillway zwoṱhe zwi na ndeme.\n\nNi songo humbula uri mvula ya ṅwaha woṱhe i ni vhudza vhuhulwane ha flood kana storage ine na ḓo vha nayo.\n\nOverflow i songo langiwaho i nga erode na breach wall. Pulani nḓila yo tsireledzeaho ya maḓi o engedzeaho ni sa athu u thoma construction.\n\nMaḓi a nga xela nga evaporation na seepage. Sedzani water level, ni ṱole leaks kana erosion.\n\nItani uri spillway i dzule i si na zwine zwa i thivhela nahone ni ṱhogomele bank cover yo bulwaho kha design. Ni songo ṱavha miri kha earth dam wall.\n\nZwipuka zwi nga tshinya banks nahone zwa engedza manure kha maḓi. U vha hone hadzo a hu iti uri maḓi a vhe o kunaho kana o tsireledzeaho.",
        reviewStatus: "machine-draft"
      },
      keyPoints: [
        {
          sourceEnglish: "A dam needs a site assessment and qualified design",
          tshivendaDraft: "Dam i ṱoḓa site assessment na design yo itwaho nga qualified person.",
          reviewStatus: "machine-draft"
        },
        {
          sourceEnglish: "Design a safe spillway before construction",
          tshivendaDraft: "Itani design ya safe spillway ni sa athu u thoma construction",
          reviewStatus: "machine-draft"
        },
        {
          sourceEnglish: "Check required water authorisations before building",
          tshivendaDraft: "Ṱolani authorisations a ṱoḓeaho a maḓi ni sa athu fhaṱa.",
          reviewStatus: "machine-draft"
        },
        {
          sourceEnglish: "Maintain bank cover and keep trees off an earth dam wall",
          tshivendaDraft: "Ṱhogomelani bank cover nahone ni ite uri miri i si vhe kha earth dam wall",
          reviewStatus: "machine-draft"
        }
      ],
      quiz: [
        {
          question: {
            sourceEnglish: "A farmer builds a dam wall with no spillway. After an exceptional storm it overflows. What's the likely result?",
            tshivendaDraft: "Mulimi u fhaṱa dam wall i si na spillway. Nga murahu ha storm i songo ḓoweleaho, dam i a overflow. Ndi mvelelo ifhio ine ya nga tevhela?",
            reviewStatus: "machine-draft"
          },
          options: [
            {
              sourceEnglish: "The water irrigates lower fields beneficially",
              tshivendaDraft: "Maḓi a sheledza masimu a re fhasi nga ndila ya vhuyedzo.",
              reviewStatus: "machine-draft"
            },
            {
              sourceEnglish: "It overtops and erodes the wall, risking a catastrophic breach",
              tshivendaDraft: "Maḓi a fhira nga nṱha ha wall na u erode wall, zwa ita uri hu vhe na khombo ya catastrophic breach.",
              reviewStatus: "machine-draft"
            },
            {
              sourceEnglish: "The dam stays full and overflow drains harmlessly",
              tshivendaDraft: "Dam i dzula yo ḓala nahone overflow i bva nga ndila i si na khombo.",
              reviewStatus: "machine-draft"
            },
            {
              sourceEnglish: "Storage capacity increases permanently",
              tshivendaDraft: "Storage capacity i engedzea tshifhinga tshoṱhe.",
              reviewStatus: "machine-draft"
            }
          ],
          sourceCorrectIndex: 1,
          rationale: {
            sourceEnglish: "Without a designed overflow route, excess water finds its own way over the wall — and that uncontrolled flow is what erodes and eventually breaches it.",
            tshivendaDraft: "Hu si na overflow route yo itwaho nga design, maḓi o engedzeaho a wana ndila yao ya u fhira nga nṱha ha wall — nahone ndi u elela honoho hu songo langiwaho hune ha erode wall na u fhedza hu tshi i breach.",
            reviewStatus: "machine-draft"
          }
        },
        {
          question: {
            sourceEnglish: "Which action helps protect an earth dam?",
            tshivendaDraft: "Ndi vhukando vhufhio vhune ha thusa u tsireledza earth dam?",
            reviewStatus: "machine-draft"
          },
          options: [
            {
              sourceEnglish: "A deep, exposed dam with no bank vegetation",
              tshivendaDraft: "Dam yo dzikaho, exposed, i si na zwimela kha bank",
              reviewStatus: "machine-draft"
            },
            {
              sourceEnglish: "Maintain the designed bank cover and keep the spillway clear",
              tshivendaDraft: "Ṱhogomelani bank cover yo bulwaho kha design nahone ni ite uri spillway i dzule i si na zwine zwa i thivhela",
              reviewStatus: "machine-draft"
            },
            {
              sourceEnglish: "A full concrete lining and plastic cover",
              tshivendaDraft: "Concrete lining yo fhelelaho na plastic cover.",
              reviewStatus: "machine-draft"
            },
            {
              sourceEnglish: "A larger surface area to spread evaporation evenly",
              tshivendaDraft: "Surface area khulwane u phaḓaladza evaporation nga ndinganelo.",
              reviewStatus: "machine-draft"
            }
          ],
          sourceCorrectIndex: 1,
          rationale: {
            sourceEnglish: "A clear spillway and maintained banks help the dam work as designed. Trees should not be planted on an earth dam wall.",
            tshivendaDraft: "Spillway i si na zwine zwa i thivhela na banks dzi ṱhogomelwaho zwi thusa dam uri i shume nga nḓila yo bulwaho kha design. Miri a i tei u ṱavhiwa kha earth dam wall.",
            reviewStatus: "machine-draft"
          }
        }
      ]
    },
    {
      id: "water-harvesting-l3",
      infographicAlt: {
        sourceEnglish: "Rain running off a roof into a gutter and down a pipe into a tank, with a small first-flush diverter branching off before the tank to throw away the dirty first water.",
        tshivendaDraft: "Maḓi a mvula a tshi elela a tshi bva kha ṱhanga a dzhena kha gutter nahone a tsa nga pipe a dzhena kha tank, hu na first-flush diverter ṱhukhu i bva kha pipe musi i sa athu u swika kha tank uri i bvise maḓi a u thoma a re na tshika.",
        reviewStatus: "machine-draft"
      },
      title: {
        sourceEnglish: "Rainwater Tanks and Roof Catchment: Collecting and Protecting Water",
        tshivendaDraft: "Thanngi dza maḓi a mvula na Roof Catchment: U kuvhanganya na u tsireledza maḓi",
        reviewStatus: "machine-draft"
      },
      body: {
        sourceEnglish: "Your roof can collect rainwater. The amount depends on roof area, rainfall and losses.\n\nCheck whether the roof material is suitable for rainwater collection before connecting a tank.\n\nUse the roof area seen from above and local rainfall records. Then allow for water that misses the gutter, is diverted or overflows a full tank.\n\nAn annual total does not tell you how much water will be available during a dry spell. Compare supply with the uses you plan.\n\nRoof runoff can carry dust, droppings and other contamination. A first-flush diverter keeps some of the first runoff out of the tank.\n\nThe required diversion depends on the roof and system. Use the supplier's sizing and maintenance instructions; there is no single volume for every roof.\n\nA diverter does not make the remaining water safe to drink.\n\nTank size depends on water demand, rain, roof area and the length of dry periods.\n\nList the intended uses and estimate their demand from your own records. Compare that with supply through the seasons.\n\nPlan what you will do when stored water runs low. A province name alone cannot tell you the tank size you need.\n\nKeep the tank covered, screen openings against insects, and maintain the roof, gutters and diverter. Keep rainwater separate from drinking-water pipes.\n\nWater that looks clear may still contain germs or chemicals. Ask the local health authority about testing and treatment suited to the intended use.\n\nA basic filter alone is not a drinking-water guarantee. Water used on food crops also needs a safety assessment.",
        tshivendaDraft: "Ṱhanga ya ṋu i nga kuvhanganya madi a mvula. Madi ane a wanala a bva kha vhuhulwane ha ṱhanga, mvula na madi a xelaho.\n\nṰolani arali roof material yo tea u kuvhanganya maḓi a mvula musi ni sa athu u ṱumanya tank.\n\nShumisani vhuhulwane ha ṱhanga vhune ha vhonala u bva nṱha na rekhodo dza mvula dza henefho. Nga murahu ni dzhiele nṱha maḓi ane a si dzhene kha gutter, ane a diverted kana ane a overflow kha tank yo ḓalaho.\n\nTshivhalo tsha ṅwaha woṱhe a tshi ni vhudzi uri hu ḓo vha na maḓi mangana kha dry spell. Vhambedzani supply na mishumo ine na pulana u shumisa maḓi hayo.\n\nRunoff ya ṱhanga i nga hwala buse, droppings na iṅwe contamination. First-flush diverter i thivhela maṅwe maḓi a runoff ya u thoma uri a si dzhene kha tank.\n\nDiversion ine ya ṱoḓea i ḓitika nga ṱhanga na system. Shumisani ndaela dza supplier dza sizing na maintenance; a hu na volume nthihi ine ya shuma kha ṱhanga iṅwe na iṅwe.\n\nDiverter a i iti uri maḓi o salaho a vhe o tsireledzea u nwiwa.\n\nVhuhulwane ha tank vhu bva kha water demand, mvula, vhuhulwane ha ṱhanga na vhulapfu ha dry periods.\n\nṄwalani mishumo yo pulaniwaho nahone ni anganyele demand yayo ni tshi shumisa rekhodo dzaṋu. Vhambedzani demand yayo na supply u mona na zwifhinga zwa ṅwaha.\n\nPulannani zwine na ḓo ita musi maḓi o vhulungwaho a tshi sala e maṱuku. Dzina ḽa vundu fhedzi a ḽi ni vhudzi vhuhulwane ha tank ine na i ṱoḓa.\n\nItani uri tank i dzule yo fukedzwaho; vheani screen kha zwikhala uri zwikhokhonono zwi si dzhene, nahone ni ṱhogomele ṱhanga, gutters na diverter. Vhulungani maḓi a mvula o fhambanywa na pipes dza maḓi a u nwa.\n\nMaḓi ane a vhonala o kuna a nga kha ḓi vha na germs kana chemicals. Vhudzisani local health authority nga testing na treatment zwo teaho mushumo wo pulaniwaho.\n\nBasic filter fhedzi a i khwaṱhisedzi uri maḓi o lugela u nwa. Maḓi ane a shumiswa kha food crops na one a ṱoḓa safety assessment.",
        reviewStatus: "machine-draft"
      },
      keyPoints: [
        {
          sourceEnglish: "Roof area, rain, demand and losses determine useful storage",
          tshivendaDraft: "Vhuhulwane ha ṱhanga, mvula, water demand na maḓi a xelaho zwi laula maḓi ane a nga vhulungwa uri a shumisee.",
          reviewStatus: "machine-draft"
        },
        {
          sourceEnglish: "Size and maintain the first-flush diverter for the roof",
          tshivendaDraft: "Khethani sizing ya first-flush diverter yo teaho ṱhanga nahone ni i ṱhogomele",
          reviewStatus: "machine-draft"
        },
        {
          sourceEnglish: "Clear water can still contain germs or chemicals",
          tshivendaDraft: "Maḓi ane a vhonala o kuna a nga kha ḓi vha na germs kana chemicals.",
          reviewStatus: "machine-draft"
        },
        {
          sourceEnglish: "Testing and treatment must match the intended use",
          tshivendaDraft: "Testing na treatment zwi tea u tea mushumo wo pulaniwaho",
          reviewStatus: "machine-draft"
        }
      ],
      quiz: [
        {
          question: {
            sourceEnglish: "What information is needed to choose a rainwater tank?",
            tshivendaDraft: "Ndi mafhungo afhio ane a ṱoḓea u khetha rainwater tank?",
            reviewStatus: "machine-draft"
          },
          options: [
            {
              sourceEnglish: "Only the province where the farm is located",
              tshivendaDraft: "Vundu ḽine bulasi ya vha khaḽo fhedzi.",
              reviewStatus: "machine-draft"
            },
            {
              sourceEnglish: "Roof area, rainfall pattern, water demand and collection losses",
              tshivendaDraft: "Vhuhulwane ha ṱhanga, pattern ya mvula, water demand na maḓi a xelaho musi a tshi kuvhanganywa.",
              reviewStatus: "machine-draft"
            },
            {
              sourceEnglish: "Only the amount of rain in one storm",
              tshivendaDraft: "Tshivhalo tsha mvula ya storm nthihi fhedzi.",
              reviewStatus: "machine-draft"
            },
            {
              sourceEnglish: "Only the price of the biggest available tank",
              tshivendaDraft: "Mutengo wa tank khulwanesa ine ya wanala fhedzi.",
              reviewStatus: "machine-draft"
            }
          ],
          sourceCorrectIndex: 1,
          rationale: {
            sourceEnglish: "Tank planning must compare usable supply with demand through wet and dry periods. One fixed regional size cannot do that.",
            tshivendaDraft: "U pulana tank hu tea u vhambedza supply ine ya nga shumiswa na demand kha zwifhinga zwa mvula na zwa u oma. Sayizi nthihi ya region yo tiwaho a i nga koni u ita zwenezwo.",
            reviewStatus: "machine-draft"
          }
        },
        {
          question: {
            sourceEnglish: "Why does a first-flush diverter matter even for irrigation-only tank water?",
            tshivendaDraft: "Ndi ngani first-flush diverter i tshi vha na ndeme na musi maḓi a tank a tshi shumiswa kha u sheledza fhedzi?",
            reviewStatus: "machine-draft"
          },
          options: [
            {
              sourceEnglish: "It doesn't matter for irrigation, only drinking water",
              tshivendaDraft: "A i na ndeme kha u sheledza, i na ndeme kha maḓi a u nwa fhedzi.",
              reviewStatus: "machine-draft"
            },
            {
              sourceEnglish: "The first flush carries concentrated droppings, dust and pathogens that can contaminate edible crops",
              tshivendaDraft: "First flush i hwala concentrated droppings, buse na pathogens dzine dza nga contaminate zwimela zwine zwa ḽiwa.",
              reviewStatus: "machine-draft"
            },
            {
              sourceEnglish: "It's more acidic and changes soil pH over time",
              tshivendaDraft: "I na acidity nnzhi u fhira nahone i shandula soil pH nga tshifhinga.",
              reviewStatus: "machine-draft"
            },
            {
              sourceEnglish: "It stops the tank overfilling in storms",
              tshivendaDraft: "I thivhela tank uri i sa ḓadzehe nga maḓi manzhi nga storms.",
              reviewStatus: "machine-draft"
            }
          ],
          sourceCorrectIndex: 1,
          rationale: {
            sourceEnglish: "Diverting early runoff can reduce contamination, but it does not guarantee that later water is safe. Assess quality for the intended use.",
            tshivendaDraft: "U divert-a runoff ya u thoma zwi nga fhungudza contamination, fhedzi a zwi khwaṱhisedzi uri maḓi a tevhelaho a tsireledzea. Ṱolani quality u ya nga mushumo wo pulaniwaho.",
            reviewStatus: "machine-draft"
          }
        }
      ]
    },
    {
      id: "water-harvesting-l4",
      title: pair("Greywater: Check Before Reuse", "Greywater: Ṱolani ni sa athu u shumisa hafhu", "machine-draft"),
      body: pair("Used household water can contain germs, salts, cleaning products and other substances. Guidance does not define every source in the same way. South African guidance differs on kitchen water and laundry water.\n\nDo not include toilet water, water from nappies, washing a sick person or washing animals in a reuse plan. Do not reuse water containing harmful chemicals.\n\nBefore any reuse, ask the municipality and a qualified local sanitation adviser to check the exact source, the household's water and sanitation services, the intended use and the site. If this advice is unavailable or unclear, do not reuse the water.\n\nA generic picture is not a farm design. Soil and mulch do not disinfect wastewater. Keep it away from drinking-water plumbing and prevent contact with people or animals. Do not spray it, let it pool, or allow it to run off the property into a street, drain or watercourse.\n\nIf a reuse system is already operating and the water smells bad, pools or harms plants, stop using it and seek qualified local advice.", "Maḓi o shumiswaho hayani a nga vha na germs, salts, zwibveledzwa zwa u kunakisa na zwiṅwe zwithu. Tsivhudzo a i ṱalusi tshiko tshiṅwe na tshiṅwe nga nḓila nthihi. Tsivhudzo ya Afurika Tshipembe i fhambana nga ha maḓi a khishini na maḓi a u ṱanzwa zwiambaro.\n\nNi songo katela maḓi a toilet, maḓi a bvaho kha nappies, maḓi a u ṱanzwa muthu a lwalaho kana a u ṱanzwa zwipuka kha pulane ya u shumisa maḓi hafhu. Ni songo dovha na shumisa maḓi a re na chemicals dzi vhaisaho.\n\nNi sa athu u shumisa maḓi hafhu na luthihi, humbelani masipala na qualified local sanitation adviser uri vha ṱole exact source, tshumelo dza maḓi na sanitation dza muṱa, mushumo wo pulaniwaho na fhethu. Arali nyeletshedzo iyi i siho kana i sa pfali, ni songo shumisa maḓi hafhu.\n\nTshifanyiso tshi angaredzaho a si farm design. Mavu na mulch a zwi disinfect wastewater. Vheani wastewater kule na drinking-water plumbing nahone ni thivhele uri i kwame vhathu kana zwipuka. Ni songo i fafadzela, ni songo i tendela i tshi pool, nahone ni songo i tendela i tshi elela i tshi bva kha property i tshi ya tshiṱaraṱani, kha drain kana watercourse.\n\nArali system ya u shumisa maḓi hafhu yo no thoma u shuma, nahone tshiṅwe tsha izwi tsha itea: maḓi a tshi nukha zwavhi, a tshi kuvhangana fhethu huthihi, kana a tshi tshinya zwimela, litshani u a shumisa ni humbele qualified local advice.", "machine-draft"),
      keyPoints: [
        pair("Water sources and greywater guidance can differ", "Tshiko tsha maḓi na tsivhudzo ya greywater zwi nga fhambana.", "machine-draft"),
        pair("Check the source, service status, intended use and site locally before any reuse", "Kha vhupo haṋu, ṱolani tshiko, service status, mushumo wo pulaniwaho na fhethu ni sa athu u shumisa maḓi hafhu na luthihi.", "machine-draft"),
        pair("Soil and mulch do not disinfect wastewater", "Mavu na mulch a zwi disinfect wastewater", "machine-draft"),
        pair("Prevent contact, spray, pooling, runoff and drinking-water cross-connections", "Thivhelani u kwama, u fafadzela, maḓi a tshi ima fhethu huthihi, runoff na drinking-water cross-connections", "machine-draft"),
      ],
      quiz: [
        {
          question: pair("What should happen before any household washwater is reused?", "Hu fanela u itea mini ni sa athu u shumisa hafhu maḓi afhio na afhio a u ṱanzwa a muṱa?", "machine-draft"),
          options: [
            pair("Direct it below mulch around a tree", "Livhisani maḓi fhasi ha mulch u mona na muri.", "machine-draft"),
            pair("Ask the municipality and a qualified sanitation adviser to check the source, service status, intended use and site", "Humbelani masipala na qualified sanitation adviser uri vha ṱole tshiko, service status, mushumo wo pulaniwaho na fhethu", "machine-draft"),
            pair("Use it if it looks clear", "A shumiseni arali a tshi vhonala o kuna", "machine-draft"),
            pair("Use it only on plants that are not eaten raw", "I shumiseni kha zwimela fhedzi zwine zwi sa ḽiwe zwi songo bikiwa.", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Guidance differs on some water sources and on the service conditions for reuse. A qualified local check is needed before deciding whether any source and use are suitable or allowed.", "Tsivhudzo i a fhambana nga ha zwiṅwe zwiko zwa maḓi na service conditions dza u shumisa maḓi hafhu. Qualified local check i a ṱoḓea ni sa athu u dzhia tsheo ya uri tshiko tshifhio na tshifhio na mushumo ufhio na ufhio zwine zwa humbulwa zwo tea kana zwo tendelwa.", "machine-draft"),
        },
        {
          question: pair("Why check the exact water source and cleaning products before considering reuse?", "Ndi ngani ri tshi fanela u ṱola tshiko tsha maḓi tshone na zwibveledzwa zwa u kunakisa ri sa athu humbula nga ha u shumisa maḓi hafhu?", "machine-draft"),
          options: [
            pair("All cleaning products are safe if the water is diluted", "Zwibveledzwa zwoṱhe zwa u kunakisa zwo tsireledzea arali maḓi o vanganywa na maṅwe.", "machine-draft"),
            pair("Water composition and product effects vary, so the actual source and products need assessment", "Water composition na mvelelo dza zwibveledzwa zwi a fhambana; ngauralo tshiko tsha vhukuma na zwibveledzwa zwi ṱoḓa assessment.", "machine-draft"),
            pair("The water can be reused when it has no smell", "Maḓi a nga shumiswa hafhu arali a si na munukho.", "machine-draft"),
            pair("Mulch removes every harmful substance", "Mulch i bvisa zwithu zwoṱhe zwi vhaisaho.", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Used water can contain different germs, salts and chemicals. Neither clear appearance, lack of smell nor mulch proves that it is safe or suitable.", "Maḓi o shumiswaho a nga vha na germs, salts na chemicals zwo fhambanaho. U vhonala o kuna a zwi sumbedzi uri maḓi o tsireledzea kana o tea; u sa vha na munukho a zwi sumbedzi zwenezwo; na mulch a i sumbedzi zwenezwo.", "machine-draft"),
        },
      ],
    },
  ]
};

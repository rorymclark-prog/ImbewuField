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
    tshivendaDraft: "Swales, berms, dams, rainwater tanks and greywater — slow, spread and sink every drop.",
    reviewStatus: "hold"
  },
  lessons: [
    {
      id: "water-harvesting-l1",
      infographicAlt: {
        sourceEnglish: "Concept cross-section of a level contour swale with a raised mound below it. Arrows show runoff slowing and spreading; infiltration depends on the soil and site.",
        tshivendaDraft: "Concept cross-section of a level contour swale with a raised mound below it. Arrows show runoff slowing and spreading; infiltration depends on the soil and site.",
        reviewStatus: "hold"
      },
      title: {
        sourceEnglish: "Swales and Berms: Slowing Water on the Slope",
        tshivendaDraft: "Swales and Berms: U Fhungudza Luvhilo lwa Maḓi kha U Sendama ha Mavu",
        reviewStatus: "machine-draft"
      },
      body: {
        sourceEnglish: "One kind of swale is a level trench on contour. It slows and spreads runoff so some water can soak into suitable soil. Other swales are designed with a slight, controlled grade to carry excess water slowly to a safe outlet. Which approach fits your land depends on the soil, slope, drainage and storm flow. Have a trained local adviser check the line, overflow and receiving point before digging.\n\nThe excavated soil forms a berm on the downhill side, where trees can be planted when the site design is suitable.\n\nTrees planted there may draw on moisture stored in the soil after rain, depending on the site.\n\nHeavy rain can fill a swale faster than water soaks into the soil. Plan a safe overflow before digging.\n\nThe route must not erode the slope or send damaging water to a neighbour. A downstream swale or dam must be able to receive it safely.\n\nAsk a trained local adviser to assess the soil, slope and storm flow. A picture is not a construction design.\n\nSlope alone does not tell you whether a swale is suitable. Soil, drainage, unstable ground and the water arriving from upslope all matter.\n\nKeep good ground cover. Get a local assessment before digging on steep, wet or unstable land. Grass barriers and terraces also need a design suited to the site.",
        tshivendaDraft: "Lushaka luthihi lwa swale ndi a level trench on contour. I fhungudza luvhilo na u phaḓaladza runoff, uri maḓi maṅwe a kone u dzhena kha suitable soil. Other swales are designed with a slight, controlled grade to carry excess water slowly to a safe outlet. Nḓila ine ya fanelea shango ḽaṋu i bva kha soil, slope, drainage na storm flow. Musi ni sa athu u bwa, humbelani trained local adviser uri a sedze line, overflow na receiving point.\n\nMavu o excavated a vhumba berm nga thungo ya le downhill, hune miri ya nga ṱavhiwa arali site design yo tea.\n\nMiri yo ṱavhiwaho henefho i nga shumisa moisture yo vhulungwaho mavuni nga murahu ha mvula, zwi tshi ya nga site.\n\nHeavy rain can fill a swale faster than water soaks into the soil. Pulani safe overflow ni sa athu u bwa.\n\nRoute a i tei u erode slope kana u rumela damaging water kha neighbour. Swale kana dam ya fhasi i tea u kona u ṱanganedza maḓi ayo nga vhuḓi.\n\nHumbelani trained local adviser uri a assess soil, slope na storm flow. Tshifanyiso a si construction design.\n\nSlope fhedzi a i sumbedzi arali swale i suitable. Soil, drainage, unstable ground na maḓi ane a bva upslope zwoṱhe zwi na ndeme.\n\nKeep good ground cover. Wanani local assessment ni sa athu u bwa kha fhethu ha steep, wet kana unstable. Grass barriers na terraces na zwone zwi ṱoḓa design yo teaho site.",
        reviewStatus: "machine-draft"
      },
      keyPoints: [
        {
          sourceEnglish: "A level contour swale can hold runoff for infiltration on a suitable site; other swales need a designed grade and safe outlet",
          tshivendaDraft: "A level contour swale can hold runoff for infiltration on a suitable site; other swales need a designed grade and safe outlet",
          reviewStatus: "hold"
        },
        {
          sourceEnglish: "Keep good ground cover and plan a safe overflow",
          tshivendaDraft: "Keep good ground cover and plan a safe overflow",
          reviewStatus: "hold"
        },
        {
          sourceEnglish: "Assess soil, drainage, slope and storm flow before digging",
          tshivendaDraft: "Assess soil, drainage, slope and storm flow before digging",
          reviewStatus: "hold"
        },
        {
          sourceEnglish: "A concept picture is not a construction design",
          tshivendaDraft: "A concept picture is not a construction design",
          reviewStatus: "hold"
        }
      ],
      quiz: [
        {
          question: {
            sourceEnglish: "A farmer planned a level contour swale. After heavy rain, one end holds most of the water. What should the farmer check before changing the earthwork?",
            tshivendaDraft: "A farmer planned a level contour swale. After heavy rain, one end holds most of the water. What should the farmer check before changing the earthwork?",
            reviewStatus: "hold"
          },
          options: [
            {
              sourceEnglish: "Whether the trench can be made deeper without a site check",
              tshivendaDraft: "Whether the trench can be made deeper without a site check",
              reviewStatus: "hold"
            },
            {
              sourceEnglish: "The intended design and measured levels with a trained local adviser; an unintended low point may be present",
              tshivendaDraft: "The intended design and measured levels with a trained local adviser; an unintended low point may be present",
              reviewStatus: "hold"
            },
            {
              sourceEnglish: "Whether a new dam at the lowest point will catch every overflow",
              tshivendaDraft: "Whether a new dam at the lowest point will catch every overflow",
              reviewStatus: "hold"
            },
            {
              sourceEnglish: "Whether the soil should be compacted to stop all infiltration",
              tshivendaDraft: "Whether the soil should be compacted to stop all infiltration",
              reviewStatus: "hold"
            }
          ],
          sourceCorrectIndex: 1,
          rationale: {
            sourceEnglish: "A level contour design should spread water along its length. Uneven filling may indicate an unintended low point, but some swales are intentionally graded to a safe outlet. Check the actual design, soil and overflow route before altering it.",
            tshivendaDraft: "A level contour design should spread water along its length. Uneven filling may indicate an unintended low point, but some swales are intentionally graded to a safe outlet. Check the actual design, soil and overflow route before altering it.",
            reviewStatus: "hold"
          }
        },
        {
          question: {
            sourceEnglish: "A farmer wants to control erosion on steep land. What should she do before digging?",
            tshivendaDraft: "A farmer wants to control erosion on steep land. What should she do before digging?",
            reviewStatus: "hold"
          },
          options: [
            {
              sourceEnglish: "Standard swales dug as deep as possible",
              tshivendaDraft: "Standard swales dug as deep as possible",
              reviewStatus: "hold"
            },
            {
              sourceEnglish: "Keep ground covered and get a site assessment for suitable erosion controls",
              tshivendaDraft: "Keep ground covered and get a site assessment for suitable erosion controls",
              reviewStatus: "hold"
            },
            {
              sourceEnglish: "A large dam at the bottom to catch all runoff",
              tshivendaDraft: "A large dam at the bottom to catch all runoff",
              reviewStatus: "hold"
            },
            {
              sourceEnglish: "Compacting the soil surface with a roller",
              tshivendaDraft: "Compacting the soil surface with a roller",
              reviewStatus: "hold"
            }
          ],
          sourceCorrectIndex: 1,
          rationale: {
            sourceEnglish: "Slope alone is not enough to choose an earthwork. Soil, drainage, stability and storm flow must also be assessed.",
            tshivendaDraft: "Slope alone is not enough to choose an earthwork. Soil, drainage, stability and storm flow must also be assessed.",
            reviewStatus: "hold"
          }
        }
      ]
    },
    {
      id: "water-harvesting-l2",
      infographicAlt: {
        sourceEnglish: "A farm dam cut through the middle: water flowing in at one end, the stored body of water, a spillway at the top edge for overflow, and a planted bank holding the soil.",
        tshivendaDraft: "A farm dam cut through the middle: water flowing in at one end, the stored body of water, a spillway at the top edge for overflow, and a planted bank holding the soil.",
        reviewStatus: "hold"
      },
      title: {
        sourceEnglish: "Farm Dams and Ponds: Storing Water for the Dry Season",
        tshivendaDraft: "Madamu na Zwidziva zwa Bulasini: U Vhulunga Maḓi a Tshifhinga tsha Gomelelo",
        reviewStatus: "machine-draft"
      },
      body: {
        sourceEnglish: "A dam or pond can store runoff, but the amount available depends on local rain, the catchment, losses and how much water you use.\n\nRainfall seasons differ across South Africa. Use local records and plan for dry periods; a full dam is not guaranteed.\n\nBefore changing a watercourse or building storage works, check the required authorisation with the water authority.\n\nA dam needs a site investigation and a design by a suitably qualified person. Catchment runoff, soil, foundations, downstream risk and a safe spillway all matter.\n\nDo not assume that annual rainfall tells you the size of a flood or the storage you will have.\n\nAn uncontrolled overflow can erode and breach the wall. Plan a safe route for excess water before construction.\n\nWater can be lost through evaporation and seepage. Check the water level and look for leaks or erosion.\n\nKeep the spillway clear and maintain the bank cover specified in the design. Do not plant trees on an earth dam wall.\n\nAnimals can damage banks and add manure to the water. Their presence does not make the water clean or safe.",
        tshivendaDraft: "Dam kana pond i nga vhulunga runoff, fhedzi maḓi ane a wanala a bva kha mvula ya henefho, catchment, losses na uri ni shumisa maḓi mangana.\n\nTshifhinga tsha mvula tshi a fhambana u mona na Afurika Tshipembe. Shumisani local records nahone ni pulanele dry periods; dam yo ḓalaho a yo khwaṱhisedzwi.\n\nMusi ni sa athu u shandula watercourse kana u fhaṱa storage works, ṱolani authorisation ine ya ṱoḓea kha water authority.\n\nDam i ṱoḓa site investigation na design yo itwaho nga suitably qualified person. Catchment runoff, soil, foundations, downstream risk na safe spillway zwoṱhe zwi na ndeme.\n\nNi songo humbula uri annual rainfall i ni vhudza size ya flood kana storage ine na ḓo vha nayo.\n\nOverflow i songo langiwaho i nga erode na breach wall. Pulani safe route ya excess water ni sa athu u thoma construction.\n\nMaḓi a nga xela nga evaporation na seepage. Sedzani water level, ni ṱole leaks kana erosion.\n\nKeep the spillway clear and maintain the bank cover specified in the design. Ni songo ṱavha trees kha earth dam wall.\n\nAnimals can damage banks and add manure to the water. U vha hone hadzo a hu iti uri maḓi a vhe clean kana safe.",
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
          tshivendaDraft: "Design a safe spillway before construction",
          reviewStatus: "hold"
        },
        {
          sourceEnglish: "Check required water authorisations before building",
          tshivendaDraft: "Ṱolani authorisations a ṱoḓeaho a maḓi ni sa athu fhaṱa.",
          reviewStatus: "machine-draft"
        },
        {
          sourceEnglish: "Maintain bank cover and keep trees off an earth dam wall",
          tshivendaDraft: "Maintain bank cover and keep trees off an earth dam wall",
          reviewStatus: "hold"
        }
      ],
      quiz: [
        {
          question: {
            sourceEnglish: "A farmer builds a dam wall with no spillway. After an exceptional storm it overflows. What's the likely result?",
            tshivendaDraft: "Mulimi u fhaṱa dam wall i si na spillway. Nga murahu ha exceptional storm, dam i a overflow. Ndi mvelelo ifhio ine ya nga tevhela?",
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
            tshivendaDraft: "Without a designed overflow route, excess water i wana ndila yayo ya u fhira nga nṱha ha wall — and that uncontrolled flow is what erodes and eventually breaches it.",
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
              tshivendaDraft: "A deep, exposed dam with no bank vegetation",
              reviewStatus: "hold"
            },
            {
              sourceEnglish: "Maintain the designed bank cover and keep the spillway clear",
              tshivendaDraft: "Maintain the designed bank cover and keep the spillway clear",
              reviewStatus: "hold"
            },
            {
              sourceEnglish: "A full concrete lining and plastic cover",
              tshivendaDraft: "Full concrete lining na plastic cover.",
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
            tshivendaDraft: "A clear spillway and maintained banks help the dam work as designed. Trees a dzi tei u ṱavhiwa kha earth dam wall.",
            reviewStatus: "machine-draft"
          }
        }
      ]
    },
    {
      id: "water-harvesting-l3",
      infographicAlt: {
        sourceEnglish: "Rain running off a roof into a gutter and down a pipe into a tank, with a small first-flush diverter branching off before the tank to throw away the dirty first water.",
        tshivendaDraft: "Rain running off a roof into a gutter and down a pipe into a tank, with a small first-flush diverter branching off before the tank to throw away the dirty first water.",
        reviewStatus: "hold"
      },
      title: {
        sourceEnglish: "Rainwater Tanks and Roof Catchment: Collecting and Protecting Water",
        tshivendaDraft: "Rainwater Tanks and Roof Catchment: U kuvhanganya na u tsireledza maḓi",
        reviewStatus: "machine-draft"
      },
      body: {
        sourceEnglish: "Your roof can collect rainwater. The amount depends on roof area, rainfall and losses.\n\nCheck whether the roof material is suitable for rainwater collection before connecting a tank.\n\nUse the roof area seen from above and local rainfall records. Then allow for water that misses the gutter, is diverted or overflows a full tank.\n\nAn annual total does not tell you how much water will be available during a dry spell. Compare supply with the uses you plan.\n\nRoof runoff can carry dust, droppings and other contamination. A first-flush diverter keeps some of the first runoff out of the tank.\n\nThe required diversion depends on the roof and system. Use the supplier's sizing and maintenance instructions; there is no single volume for every roof.\n\nA diverter does not make the remaining water safe to drink.\n\nTank size depends on water demand, rain, roof area and the length of dry periods.\n\nList the intended uses and estimate their demand from your own records. Compare that with supply through the seasons.\n\nPlan what you will do when stored water runs low. A province name alone cannot tell you the tank size you need.\n\nKeep the tank covered, screen openings against insects, and maintain the roof, gutters and diverter. Keep rainwater separate from drinking-water pipes.\n\nWater that looks clear may still contain germs or chemicals. Ask the local health authority about testing and treatment suited to the intended use.\n\nA basic filter alone is not a drinking-water guarantee. Water used on food crops also needs a safety assessment.",
        tshivendaDraft: "Ṱhanga ya ṋu i nga kuvhanganya madi a mvula. Madi ane a wanala a bva kha vhuhulwane ha ṱhanga, mvula na madi a xelaho.\n\nṰolani arali roof material yo tea u kuvhanganya maḓi a mvula musi ni sa athu u ṱumanya tank.\n\nShumisani roof area ine ya vhonala u bva nṱha na local rainfall records. Then allow for water that misses the gutter, is diverted or overflows a full tank.\n\nTshivhalo tsha ṅwaha woṱhe a tshi ni vhudzi uri hu ḓo vha na maḓi mangana kha dry spell. Vhambedzani supply na mishumo ine na pulana u shumisa maḓi hayo.\n\nRoof runoff i nga hwala buse, droppings na iṅwe contamination. First-flush diverter i thivhela maṅwe maḓi a first runoff uri a si dzhene kha tank.\n\nDiversion ine ya ṱoḓea i ḓitika nga roof na system. Shumisani supplier sizing na maintenance instructions; a hu na volume nthihi ine ya shuma kha roof yoṱhe.\n\nDiverter a i iti uri maḓi o salaho a vhe o tsireledzea u nwiwa.\n\nTank size i bva kha water demand, mvula, roof area na vhulapfu ha dry periods.\n\nṄwalani intended uses nahone ni anganyele demand yayo ni tshi shumisa records dzaṋu. Vhambedzani na supply u mona na seasons.\n\nPulannani zwine na ḓo ita musi maḓi o vhulungwaho a tshi fhungudzea. Dzina ḽa province ḽiṱhihi a ḽi ni vhudzi tank size ine na i ṱoḓa.\n\nItani uri tank i dzule yo tibifhiwa; screen openings against insects, nahone ni maintain roof, gutters na diverter. Keep rainwater separate from drinking-water pipes.\n\nMaḓi ane a vhonala o kuna a nga kha ḓi vha na germs kana chemicals. Vhudzisani local health authority nga testing na treatment zwo teaho intended use.\n\nBasic filter fhedzi a si drinking-water guarantee. Maḓi ane a shumiswa kha food crops na one a ṱoḓa safety assessment.",
        reviewStatus: "machine-draft"
      },
      keyPoints: [
        {
          sourceEnglish: "Roof area, rain, demand and losses determine useful storage",
          tshivendaDraft: "Vhuhulwane ha roof, mvula, water demand na losses zwi laula maḓi ane a nga vhulungwa uri a shumisee.",
          reviewStatus: "machine-draft"
        },
        {
          sourceEnglish: "Size and maintain the first-flush diverter for the roof",
          tshivendaDraft: "Size and maintain the first-flush diverter for the roof",
          reviewStatus: "hold"
        },
        {
          sourceEnglish: "Clear water can still contain germs or chemicals",
          tshivendaDraft: "Maḓi o clear a nga kha ḓi vha na germs kana chemicals.",
          reviewStatus: "machine-draft"
        },
        {
          sourceEnglish: "Testing and treatment must match the intended use",
          tshivendaDraft: "Testing and treatment must match the intended use",
          reviewStatus: "hold"
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
              tshivendaDraft: "Province ine farm ya vha khayo fhedzi.",
              reviewStatus: "machine-draft"
            },
            {
              sourceEnglish: "Roof area, rainfall pattern, water demand and collection losses",
              tshivendaDraft: "Vhuhulwane ha roof, pattern ya mvula, water demand na losses dza u kuvhanganya.",
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
            tshivendaDraft: "U pulana tank hu tea u vhambedza supply ine ya nga shumiswa na demand kha wet na dry periods. Sayizi nthihi ya region yo tiwaho a i nga koni u ita zwenezwo.",
            reviewStatus: "machine-draft"
          }
        },
        {
          question: {
            sourceEnglish: "Why does a first-flush diverter matter even for irrigation-only tank water?",
            tshivendaDraft: "Ndi ngani first-flush diverter i tshi thusa na musi maḓi a tank a tshi shumiswa kha irrigation fhedzi?",
            reviewStatus: "machine-draft"
          },
          options: [
            {
              sourceEnglish: "It doesn't matter for irrigation, only drinking water",
              tshivendaDraft: "A i na mushumo kha irrigation; i thusa kha drinking water fhedzi.",
              reviewStatus: "machine-draft"
            },
            {
              sourceEnglish: "The first flush carries concentrated droppings, dust and pathogens that can contaminate edible crops",
              tshivendaDraft: "First flush i hwala concentrated droppings, dust na pathogens dzine dza nga contaminate crops dzine dza ḽiwa.",
              reviewStatus: "machine-draft"
            },
            {
              sourceEnglish: "It's more acidic and changes soil pH over time",
              tshivendaDraft: "It's more acidic nahone i shandula soil pH nga tshifhinga.",
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
            tshivendaDraft: "U divert-a early runoff zwi nga fhungudza contamination, fhedzi a zwi khwaṱhisedzi uri maḓi a tevhelaho a tsireledzea. Ṱolani quality u ya nga intended use.",
            reviewStatus: "machine-draft"
          }
        }
      ]
    },
    {
      id: "water-harvesting-l4",
      title: pair("Greywater: Check Before Reuse", "Greywater: Ṱolani ni sa athu u shumisa hafhu", "machine-draft"),
      body: pair("Used household water can contain germs, salts, cleaning products and other substances. Guidance does not define every source in the same way. South African guidance differs on kitchen water and laundry water.\n\nDo not include toilet water, water from nappies, washing a sick person or washing animals in a reuse plan. Do not reuse water containing harmful chemicals.\n\nBefore any reuse, ask the municipality and a qualified local sanitation adviser to check the exact source, the household's water and sanitation services, the intended use and the site. If this advice is unavailable or unclear, do not reuse the water.\n\nA generic picture is not a farm design. Soil and mulch do not disinfect wastewater. Keep it away from drinking-water plumbing and prevent contact with people or animals. Do not spray it, let it pool, or allow it to run off the property into a street, drain or watercourse.\n\nIf a reuse system is already operating and the water smells bad, pools or harms plants, stop using it and seek qualified local advice.", "Maḓi o shumiswaho hayani a nga vha na germs, salts, cleaning products na zwiṅwe zwithu. Tsivhudzo a i ṱalusi tshiko tshiṅwe na tshiṅwe nga nḓila nthihi. Tsivhudzo ya Afurika Tshipembe i fhambana nga ha kitchen water na laundry water.\n\nNi songo katela toilet water, water from nappies, a u ṱanzwa muthu a lwalaho kana washing animals kha reuse plan. Ni songo dovha na shumisa maḓi a re na harmful chemicals.\n\nBefore any reuse, humbelani municipality na qualified local sanitation adviser uri vha ṱole exact source, household water na sanitation services, intended use na site. Arali nyeletshedzo iyi i siho kana i unclear, ni songo shumisa maḓi hafhu.\n\nTshifanyiso tshi angaredzaho a si farm design. Soil and mulch do not disinfect wastewater. Keep wastewater away from drinking-water plumbing and prevent contact with people or animals. Do not spray it, let it pool, or allow it to run off the property into a street, drain or watercourse.\n\nArali reuse system i tshi khou shuma nahone the water smells bad, pools or harms plants, litshani u a shumisa ni humbele qualified local advice.", "machine-draft"),
      keyPoints: [
        pair("Water sources and greywater guidance can differ", "Tshiko tsha maḓi na tsivhudzo ya greywater zwi nga fhambana.", "machine-draft"),
        pair("Check the source, service status, intended use and site locally before any reuse", "Check the source, service status, intended use and site locally before any reuse", "hold"),
        pair("Soil and mulch do not disinfect wastewater", "Soil and mulch do not disinfect wastewater", "hold"),
        pair("Prevent contact, spray, pooling, runoff and drinking-water cross-connections", "Prevent contact, spray, pooling, runoff and drinking-water cross-connections", "hold"),
      ],
      quiz: [
        {
          question: pair("What should happen before any household washwater is reused?", "Hu fanela u itea mini before any household washwater is reused?", "machine-draft"),
          options: [
            pair("Direct it below mulch around a tree", "Livhisani maḓi fhasi ha mulch u mona na muri.", "machine-draft"),
            pair("Ask the municipality and a qualified sanitation adviser to check the source, service status, intended use and site", "Ask the municipality and a qualified sanitation adviser to check the source, service status, intended use and site", "hold"),
            pair("Use it if it looks clear", "Use it if it looks clear", "hold"),
            pair("Use it only on plants that are not eaten raw", "I shumiseni kha zwimela fhedzi zwine zwi sa ḽiwe zwi songo bikiwa.", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Guidance differs on some water sources and on the service conditions for reuse. A qualified local check is needed before deciding whether any source and use are suitable or allowed.", "Guidance differs on some water sources and on the service conditions for reuse. A qualified local check is needed before deciding whether any source and use are suitable or allowed.", "hold"),
        },
        {
          question: pair("Why check the exact water source and cleaning products before considering reuse?", "Ndi ngani ri tshi fanela u ṱola exact water source na cleaning products ri sa athu humbula nga ha reuse?", "machine-draft"),
          options: [
            pair("All cleaning products are safe if the water is diluted", "Zwibveledzwa zwoṱhe zwa u kunakisa zwo tsireledzea arali maḓi o vanganywa na maṅwe.", "machine-draft"),
            pair("Water composition and product effects vary, so the actual source and products need assessment", "Water composition na effects dza products zwi a fhambana; ngauralo source ya vhukuma na products zwi ṱoḓa assessment.", "machine-draft"),
            pair("The water can be reused when it has no smell", "Maḓi a nga shumiswa hafhu arali a si na munukho.", "machine-draft"),
            pair("Mulch removes every harmful substance", "Mulch i bvisa zwithu zwoṱhe zwi vhaisaho.", "machine-draft"),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Used water can contain different germs, salts and chemicals. Neither clear appearance, lack of smell nor mulch proves that it is safe or suitable.", "Used water can contain different germs, salts and chemicals. Neither clear appearance, lack of smell nor mulch proves that it is safe or suitable.", "hold"),
        },
      ],
    },
  ]
};

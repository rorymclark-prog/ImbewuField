/** Unpublished, source-paired Tshivenda machine draft for Water Harvesting. Safety-critical instructional fields remain held in exact English. */
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
        tshivendaDraft: "Mikubo (Swales) na Ṱhanga dza Mavu (Berms): U Fhungudza Luvhilo lwa Maḓi kha U Sendama ha Mavu",
        reviewStatus: "machine-draft"
      },
      body: {
        sourceEnglish: "One kind of swale is a level trench on contour. It slows and spreads runoff so some water can soak into suitable soil. Other swales are designed with a slight, controlled grade to carry excess water slowly to a safe outlet. Which approach fits your land depends on the soil, slope, drainage and storm flow. Have a trained local adviser check the line, overflow and receiving point before digging.\n\nThe excavated soil forms a berm on the downhill side, where trees can be planted when the site design is suitable.\n\nTrees planted there may draw on moisture stored in the soil after rain, depending on the site.\n\nHeavy rain can fill a swale faster than water soaks into the soil. Plan a safe overflow before digging.\n\nThe route must not erode the slope or send damaging water to a neighbour. A downstream swale or dam must be able to receive it safely.\n\nAsk a trained local adviser to assess the soil, slope and storm flow. A picture is not a construction design.\n\nSlope alone does not tell you whether a swale is suitable. Soil, drainage, unstable ground and the water arriving from upslope all matter.\n\nKeep good ground cover. Get a local assessment before digging on steep, wet or unstable land. Grass barriers and terraces also need a design suited to the site.",
        tshivendaDraft: "One kind of swale is a level trench on contour. It slows and spreads runoff so some water can soak into suitable soil. Other swales are designed with a slight, controlled grade to carry excess water slowly to a safe outlet. Which approach fits your land depends on the soil, slope, drainage and storm flow. Have a trained local adviser check the line, overflow and receiving point before digging.\n\nThe excavated soil forms a berm on the downhill side, where trees can be planted when the site design is suitable.\n\nTrees planted there may draw on moisture stored in the soil after rain, depending on the site.\n\nHeavy rain can fill a swale faster than water soaks into the soil. Plan a safe overflow before digging.\n\nThe route must not erode the slope or send damaging water to a neighbour. A downstream swale or dam must be able to receive it safely.\n\nAsk a trained local adviser to assess the soil, slope and storm flow. A picture is not a construction design.\n\nSlope alone does not tell you whether a swale is suitable. Soil, drainage, unstable ground and the water arriving from upslope all matter.\n\nKeep good ground cover. Get a local assessment before digging on steep, wet or unstable land. Grass barriers and terraces also need a design suited to the site.",
        reviewStatus: "hold"
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
        tshivendaDraft: "A dam or pond can store runoff, but the amount available depends on local rain, the catchment, losses and how much water you use.\n\nRainfall seasons differ across South Africa. Use local records and plan for dry periods; a full dam is not guaranteed.\n\nBefore changing a watercourse or building storage works, check the required authorisation with the water authority.\n\nA dam needs a site investigation and a design by a suitably qualified person. Catchment runoff, soil, foundations, downstream risk and a safe spillway all matter.\n\nDo not assume that annual rainfall tells you the size of a flood or the storage you will have.\n\nAn uncontrolled overflow can erode and breach the wall. Plan a safe route for excess water before construction.\n\nWater can be lost through evaporation and seepage. Check the water level and look for leaks or erosion.\n\nKeep the spillway clear and maintain the bank cover specified in the design. Do not plant trees on an earth dam wall.\n\nAnimals can damage banks and add manure to the water. Their presence does not make the water clean or safe.",
        reviewStatus: "hold"
      },
      keyPoints: [
        {
          sourceEnglish: "A dam needs a site assessment and qualified design",
          tshivendaDraft: "A dam needs a site assessment and qualified design",
          reviewStatus: "hold"
        },
        {
          sourceEnglish: "Design a safe spillway before construction",
          tshivendaDraft: "Design a safe spillway before construction",
          reviewStatus: "hold"
        },
        {
          sourceEnglish: "Check required water authorisations before building",
          tshivendaDraft: "Check required water authorisations before building",
          reviewStatus: "hold"
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
            tshivendaDraft: "A farmer builds a dam wall with no spillway. After an exceptional storm it overflows. What's the likely result?",
            reviewStatus: "hold"
          },
          options: [
            {
              sourceEnglish: "The water irrigates lower fields beneficially",
              tshivendaDraft: "The water irrigates lower fields beneficially",
              reviewStatus: "hold"
            },
            {
              sourceEnglish: "It overtops and erodes the wall, risking a catastrophic breach",
              tshivendaDraft: "It overtops and erodes the wall, risking a catastrophic breach",
              reviewStatus: "hold"
            },
            {
              sourceEnglish: "The dam stays full and overflow drains harmlessly",
              tshivendaDraft: "The dam stays full and overflow drains harmlessly",
              reviewStatus: "hold"
            },
            {
              sourceEnglish: "Storage capacity increases permanently",
              tshivendaDraft: "Storage capacity increases permanently",
              reviewStatus: "hold"
            }
          ],
          sourceCorrectIndex: 1,
          rationale: {
            sourceEnglish: "Without a designed overflow route, excess water finds its own way over the wall — and that uncontrolled flow is what erodes and eventually breaches it.",
            tshivendaDraft: "Without a designed overflow route, excess water finds its own way over the wall — and that uncontrolled flow is what erodes and eventually breaches it.",
            reviewStatus: "hold"
          }
        },
        {
          question: {
            sourceEnglish: "Which action helps protect an earth dam?",
            tshivendaDraft: "Which action helps protect an earth dam?",
            reviewStatus: "hold"
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
              tshivendaDraft: "A full concrete lining and plastic cover",
              reviewStatus: "hold"
            },
            {
              sourceEnglish: "A larger surface area to spread evaporation evenly",
              tshivendaDraft: "A larger surface area to spread evaporation evenly",
              reviewStatus: "hold"
            }
          ],
          sourceCorrectIndex: 1,
          rationale: {
            sourceEnglish: "A clear spillway and maintained banks help the dam work as designed. Trees should not be planted on an earth dam wall.",
            tshivendaDraft: "A clear spillway and maintained banks help the dam work as designed. Trees should not be planted on an earth dam wall.",
            reviewStatus: "hold"
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
        tshivendaDraft: "Dzithanngi dza Maḓi a Mvula na U Kuvhanganya Maḓi kha Mutombo: U Kuvhanganya na U Tsireledza Maḓi",
        reviewStatus: "machine-draft"
      },
      body: {
        sourceEnglish: "Your roof can collect rainwater. The amount depends on roof area, rainfall and losses.\n\nCheck whether the roof material is suitable for rainwater collection before connecting a tank.\n\nUse the roof area seen from above and local rainfall records. Then allow for water that misses the gutter, is diverted or overflows a full tank.\n\nAn annual total does not tell you how much water will be available during a dry spell. Compare supply with the uses you plan.\n\nRoof runoff can carry dust, droppings and other contamination. A first-flush diverter keeps some of the first runoff out of the tank.\n\nThe required diversion depends on the roof and system. Use the supplier's sizing and maintenance instructions; there is no single volume for every roof.\n\nA diverter does not make the remaining water safe to drink.\n\nTank size depends on water demand, rain, roof area and the length of dry periods.\n\nList the intended uses and estimate their demand from your own records. Compare that with supply through the seasons.\n\nPlan what you will do when stored water runs low. A province name alone cannot tell you the tank size you need.\n\nKeep the tank covered, screen openings against insects, and maintain the roof, gutters and diverter. Keep rainwater separate from drinking-water pipes.\n\nWater that looks clear may still contain germs or chemicals. Ask the local health authority about testing and treatment suited to the intended use.\n\nA basic filter alone is not a drinking-water guarantee. Water used on food crops also needs a safety assessment.",
        tshivendaDraft: "Your roof can collect rainwater. The amount depends on roof area, rainfall and losses.\n\nCheck whether the roof material is suitable for rainwater collection before connecting a tank.\n\nUse the roof area seen from above and local rainfall records. Then allow for water that misses the gutter, is diverted or overflows a full tank.\n\nAn annual total does not tell you how much water will be available during a dry spell. Compare supply with the uses you plan.\n\nRoof runoff can carry dust, droppings and other contamination. A first-flush diverter keeps some of the first runoff out of the tank.\n\nThe required diversion depends on the roof and system. Use the supplier's sizing and maintenance instructions; there is no single volume for every roof.\n\nA diverter does not make the remaining water safe to drink.\n\nTank size depends on water demand, rain, roof area and the length of dry periods.\n\nList the intended uses and estimate their demand from your own records. Compare that with supply through the seasons.\n\nPlan what you will do when stored water runs low. A province name alone cannot tell you the tank size you need.\n\nKeep the tank covered, screen openings against insects, and maintain the roof, gutters and diverter. Keep rainwater separate from drinking-water pipes.\n\nWater that looks clear may still contain germs or chemicals. Ask the local health authority about testing and treatment suited to the intended use.\n\nA basic filter alone is not a drinking-water guarantee. Water used on food crops also needs a safety assessment.",
        reviewStatus: "hold"
      },
      keyPoints: [
        {
          sourceEnglish: "Roof area, rain, demand and losses determine useful storage",
          tshivendaDraft: "Roof area, rain, demand and losses determine useful storage",
          reviewStatus: "hold"
        },
        {
          sourceEnglish: "Size and maintain the first-flush diverter for the roof",
          tshivendaDraft: "Size and maintain the first-flush diverter for the roof",
          reviewStatus: "hold"
        },
        {
          sourceEnglish: "Clear water can still contain germs or chemicals",
          tshivendaDraft: "Clear water can still contain germs or chemicals",
          reviewStatus: "hold"
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
            tshivendaDraft: "What information is needed to choose a rainwater tank?",
            reviewStatus: "hold"
          },
          options: [
            {
              sourceEnglish: "Only the province where the farm is located",
              tshivendaDraft: "Only the province where the farm is located",
              reviewStatus: "hold"
            },
            {
              sourceEnglish: "Roof area, rainfall pattern, water demand and collection losses",
              tshivendaDraft: "Roof area, rainfall pattern, water demand and collection losses",
              reviewStatus: "hold"
            },
            {
              sourceEnglish: "Only the amount of rain in one storm",
              tshivendaDraft: "Only the amount of rain in one storm",
              reviewStatus: "hold"
            },
            {
              sourceEnglish: "Only the price of the biggest available tank",
              tshivendaDraft: "Only the price of the biggest available tank",
              reviewStatus: "hold"
            }
          ],
          sourceCorrectIndex: 1,
          rationale: {
            sourceEnglish: "Tank planning must compare usable supply with demand through wet and dry periods. One fixed regional size cannot do that.",
            tshivendaDraft: "Tank planning must compare usable supply with demand through wet and dry periods. One fixed regional size cannot do that.",
            reviewStatus: "hold"
          }
        },
        {
          question: {
            sourceEnglish: "Why does a first-flush diverter matter even for irrigation-only tank water?",
            tshivendaDraft: "Why does a first-flush diverter matter even for irrigation-only tank water?",
            reviewStatus: "hold"
          },
          options: [
            {
              sourceEnglish: "It doesn't matter for irrigation, only drinking water",
              tshivendaDraft: "It doesn't matter for irrigation, only drinking water",
              reviewStatus: "hold"
            },
            {
              sourceEnglish: "The first flush carries concentrated droppings, dust and pathogens that can contaminate edible crops",
              tshivendaDraft: "The first flush carries concentrated droppings, dust and pathogens that can contaminate edible crops",
              reviewStatus: "hold"
            },
            {
              sourceEnglish: "It's more acidic and changes soil pH over time",
              tshivendaDraft: "It's more acidic and changes soil pH over time",
              reviewStatus: "hold"
            },
            {
              sourceEnglish: "It stops the tank overfilling in storms",
              tshivendaDraft: "It stops the tank overfilling in storms",
              reviewStatus: "hold"
            }
          ],
          sourceCorrectIndex: 1,
          rationale: {
            sourceEnglish: "Diverting early runoff can reduce contamination, but it does not guarantee that later water is safe. Assess quality for the intended use.",
            tshivendaDraft: "Diverting early runoff can reduce contamination, but it does not guarantee that later water is safe. Assess quality for the intended use.",
            reviewStatus: "hold"
          }
        }
      ]
    },
    {
      id: "water-harvesting-l4",
      title: {
        sourceEnglish: "Greywater: Check Before Reuse",
        tshivendaDraft: "Greywater: Check Before Reuse",
        reviewStatus: "hold"
      },
      body: {
        sourceEnglish: "Used household water can contain germs, salts, cleaning products and other substances. Guidance does not define every source in the same way. South African guidance differs on kitchen water and laundry water.\n\nDo not include toilet water, water from nappies, washing a sick person or washing animals in a reuse plan. Do not reuse water containing harmful chemicals.\n\nBefore any reuse, ask the municipality and a qualified local sanitation adviser to check the exact source, the household's water and sanitation services, the intended use and the site. If this advice is unavailable or unclear, do not reuse the water.\n\nA generic picture is not a farm design. Soil and mulch do not disinfect wastewater. Keep it away from drinking-water plumbing and prevent contact with people or animals. Do not spray it, let it pool, or allow it to run off the property into a street, drain or watercourse.\n\nIf a reuse system is already operating and the water smells bad, pools or harms plants, stop using it and seek qualified local advice.",
        tshivendaDraft: "Used household water can contain germs, salts, cleaning products and other substances. Guidance does not define every source in the same way. South African guidance differs on kitchen water and laundry water.\n\nDo not include toilet water, water from nappies, washing a sick person or washing animals in a reuse plan. Do not reuse water containing harmful chemicals.\n\nBefore any reuse, ask the municipality and a qualified local sanitation adviser to check the exact source, the household's water and sanitation services, the intended use and the site. If this advice is unavailable or unclear, do not reuse the water.\n\nA generic picture is not a farm design. Soil and mulch do not disinfect wastewater. Keep it away from drinking-water plumbing and prevent contact with people or animals. Do not spray it, let it pool, or allow it to run off the property into a street, drain or watercourse.\n\nIf a reuse system is already operating and the water smells bad, pools or harms plants, stop using it and seek qualified local advice.",
        reviewStatus: "hold"
      },
      keyPoints: [
        {
          sourceEnglish: "Water sources and greywater guidance can differ",
          tshivendaDraft: "Water sources and greywater guidance can differ",
          reviewStatus: "hold"
        },
        {
          sourceEnglish: "Check the source, service status, intended use and site locally before any reuse",
          tshivendaDraft: "Check the source, service status, intended use and site locally before any reuse",
          reviewStatus: "hold"
        },
        {
          sourceEnglish: "Soil and mulch do not disinfect wastewater",
          tshivendaDraft: "Soil and mulch do not disinfect wastewater",
          reviewStatus: "hold"
        },
        {
          sourceEnglish: "Prevent contact, spray, pooling, runoff and drinking-water cross-connections",
          tshivendaDraft: "Prevent contact, spray, pooling, runoff and drinking-water cross-connections",
          reviewStatus: "hold"
        }
      ],
      quiz: [
        {
          question: {
            sourceEnglish: "What should happen before any household washwater is reused?",
            tshivendaDraft: "What should happen before any household washwater is reused?",
            reviewStatus: "hold"
          },
          options: [
            {
              sourceEnglish: "Direct it below mulch around a tree",
              tshivendaDraft: "Direct it below mulch around a tree",
              reviewStatus: "hold"
            },
            {
              sourceEnglish: "Ask the municipality and a qualified sanitation adviser to check the source, service status, intended use and site",
              tshivendaDraft: "Ask the municipality and a qualified sanitation adviser to check the source, service status, intended use and site",
              reviewStatus: "hold"
            },
            {
              sourceEnglish: "Use it if it looks clear",
              tshivendaDraft: "Use it if it looks clear",
              reviewStatus: "hold"
            },
            {
              sourceEnglish: "Use it only on plants that are not eaten raw",
              tshivendaDraft: "Use it only on plants that are not eaten raw",
              reviewStatus: "hold"
            }
          ],
          sourceCorrectIndex: 1,
          rationale: {
            sourceEnglish: "Guidance differs on some water sources and on the service conditions for reuse. A qualified local check is needed before deciding whether any source and use are suitable or allowed.",
            tshivendaDraft: "Guidance differs on some water sources and on the service conditions for reuse. A qualified local check is needed before deciding whether any source and use are suitable or allowed.",
            reviewStatus: "hold"
          }
        },
        {
          question: {
            sourceEnglish: "Why check the exact water source and cleaning products before considering reuse?",
            tshivendaDraft: "Why check the exact water source and cleaning products before considering reuse?",
            reviewStatus: "hold"
          },
          options: [
            {
              sourceEnglish: "All cleaning products are safe if the water is diluted",
              tshivendaDraft: "All cleaning products are safe if the water is diluted",
              reviewStatus: "hold"
            },
            {
              sourceEnglish: "Water composition and product effects vary, so the actual source and products need assessment",
              tshivendaDraft: "Water composition and product effects vary, so the actual source and products need assessment",
              reviewStatus: "hold"
            },
            {
              sourceEnglish: "The water can be reused when it has no smell",
              tshivendaDraft: "The water can be reused when it has no smell",
              reviewStatus: "hold"
            },
            {
              sourceEnglish: "Mulch removes every harmful substance",
              tshivendaDraft: "Mulch removes every harmful substance",
              reviewStatus: "hold"
            }
          ],
          sourceCorrectIndex: 1,
          rationale: {
            sourceEnglish: "Used water can contain different germs, salts and chemicals. Neither clear appearance, lack of smell nor mulch proves that it is safe or suitable.",
            tshivendaDraft: "Used water can contain different germs, salts and chemicals. Neither clear appearance, lack of smell nor mulch proves that it is safe or suitable.",
            reviewStatus: "hold"
          }
        }
      ]
    }
  ]
};

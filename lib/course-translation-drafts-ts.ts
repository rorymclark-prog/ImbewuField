/** Unpublished, source-paired Xitsonga course draft. This file is review data only. */
export type XitsongaDraftReviewStatus = 'machine-draft' | 'hold';

export interface XitsongaSourcePair {
  sourceEnglish: string;
  xitsongaDraft: string;
  reviewStatus: XitsongaDraftReviewStatus;
}

export interface XitsongaCourseQuizDraft {
  question: XitsongaSourcePair;
  options: XitsongaSourcePair[];
  /** Answer index copied unchanged from the English source. */
  sourceCorrectIndex: number;
  rationale: XitsongaSourcePair;
}

export interface XitsongaCourseLessonDraft {
  id: string;
  infographicAlt?: XitsongaSourcePair;
  title: XitsongaSourcePair;
  body: XitsongaSourcePair;
  keyPoints: XitsongaSourcePair[];
  quiz: XitsongaCourseQuizDraft[];
}

export interface XitsongaCourseModuleDraft {
  id: string;
  language: 'ts';
  reviewStatus: 'machine-draft';
  sourceMetadata: { durationMins: number; category: string };
  title: XitsongaSourcePair;
  description: XitsongaSourcePair;
  lessons: XitsongaCourseLessonDraft[];
  holds: Array<{ lessonId: string; field: string; sourceText: string; reason: string }>;
}

export const XITSONGA_INTRO_PERMACULTURE_DRAFT: XitsongaCourseModuleDraft = {
  "id": "intro-permaculture",
  "language": "ts",
  "reviewStatus": "machine-draft",
  "sourceMetadata": {
    "durationMins": 20,
    "category": "foundation"
  },
  "title": {
    "sourceEnglish": "Introduction to Permaculture",
    "xitsongaDraft": "Ngheniso eka Permaculture",
    "reviewStatus": "machine-draft"
  },
  "description": {
    "sourceEnglish": "Ethics, principles and patterns — the foundation for everything else you will build.",
    "xitsongaDraft": "Mahanyelo, misinya ya milawu na ti-pattern — masungulo ya hinkwaswo leswi u nga ta swi aka.",
    "reviewStatus": "machine-draft"
  },
  "lessons": [
    {
      "id": "intro-permaculture-l1",
      "title": {
        "sourceEnglish": "The Three Ethics: Earth Care, People Care, Fair Share",
        "xitsongaDraft": "Mahanyelo Manharhu: Ku Hlayisa Misava, Ku Hlayisa Vanhu, Ku Avelana hi Ku Ringana",
        "reviewStatus": "machine-draft"
      },
      "body": {
        "sourceEnglish": "Permaculture rests on three ethics. Earth Care means treating soil, water, plants and animals as living systems to protect, not resources to use up. People Care means your family's needs come first, then your community's. Fair Share means taking only what you need and returning the surplus — seeds, food, water, knowledge — back into the system.\n\nThese aren't abstract ideas. A farmer who sells every egg and vegetable but keeps nothing back for the family table is skipping People Care. A community that fences off a shared spring is breaking Fair Share.\n\nEthics matter because they help you decide when there's no rulebook — a neighbour asking to graze cattle after a drought, a flood damaging your swales. Build these three into how you think before you build anything on the ground.",
        "xitsongaDraft": "Permaculture yi seketeriwe eka mahanyelo manharhu. Ku Hlayisa Misava swi vula ku teka misava, mati, swimilana na swiharhi tanihi swiyimiso leswi hanyaka leswi faneleke ku sireleriwa, ku nga ri switirhisiwa swo hela hi ku tirhisiwa. Ku Hlayisa Vanhu swi vula leswaku swilaveko swa ndyangu wa wena swi rhanga emahlweni, kutani ku landzela swa vaaki va ka n'wina. Ku Avelana hi Ku Ringana swi vula ku teka ntsena leswi u swi lavaka kutani u vuyisela leswi saleke — mbewu, swakudya, mati, vutivi — endzeni ka maendlelo ya nsimu.\n\nLawa a hi mianakanyo ntsena leyi nga riki ya xiviri. Murimi loyi a xavisaka matandza hinkwawo na matsavu kambe a nga siyi nchumu etafuleni ra ndyangu u tlula Ku Hlayisa Vanhu. Vaaki lava biyelaka xihlovo lexi avelaneriwaka va tlula Ku Avelana hi Ku Ringana.\n\nMahanyelo i ya nkoka hikuva ma ku pfuna ku endla swiboho loko ku nga ri na buku ya milawu — muakelani loyi a kombelaka ku risa tihomu endzhaku ka dyandza, kumbe ndhambi leyi onhaka ti-swale ta wena. Aka mahanyelo lawa manharhu eka ndlela leyi u anakanyaka ha yona u nga si aka nchumu emisaveni.",
        "reviewStatus": "machine-draft"
      },
      "keyPoints": [
        {
          "sourceEnglish": "Earth Care: protect soil, water, and biodiversity",
          "xitsongaDraft": "Ku Hlayisa Misava: sirelela misava, mati na ku hambana-hambana ka swihanyisi",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "People Care: your family's needs come before market production",
          "xitsongaDraft": "People Care: your family's needs come before market production",
          "reviewStatus": "hold"
        },
        {
          "sourceEnglish": "Fair Share: return surplus to the system — seeds, water, food, knowledge",
          "xitsongaDraft": "Ku Avelana hi Ku Ringana: vuyisela leswi saleke eka maendlelo ya nsimu — mbewu, mati, swakudya, vutivi",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Ethics guide decisions when there's no rulebook",
          "xitsongaDraft": "Mahanyelo ma kongomisa swiboho loko ku nga ri na buku ya milawu",
          "reviewStatus": "machine-draft"
        }
      ],
      "quiz": [
        {
          "question": {
            "sourceEnglish": "A farmer sells all his surplus maize but keeps nothing for composting or seed saving. Which ethic is he most failing?",
            "xitsongaDraft": "A farmer sells all his surplus maize but keeps nothing for composting or seed saving. Which ethic is he most failing?",
            "reviewStatus": "hold"
          },
          "options": [
            {
              "sourceEnglish": "Earth Care only",
              "xitsongaDraft": "Ku Hlayisa Misava ntsena",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "People Care only",
              "xitsongaDraft": "Ku Hlayisa Vanhu ntsena",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Fair Share — he returns nothing to the system",
              "xitsongaDraft": "Ku Avelana hi Ku Ringana — a nga vuyiseli nchumu eka maendlelo ya nsimu",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "All three equally",
              "xitsongaDraft": "Hinkwaswo swinharhu hi ku ringana",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 2,
          "rationale": {
            "sourceEnglish": "Fair Share means returning some of what you take — as seed, compost, or food for others. Selling everything and keeping nothing back breaks that cycle.",
            "xitsongaDraft": "Ku Avelana hi Ku Ringana swi vula ku vuyisela swin'wana swa leswi u swi tekaka — tanihi mbewu, manyoro ya compost, kumbe swakudya swa van'wana. Ku xavisa hinkwaswo handle ko siya swin'wana swi tshova ndzhendzeleko wolowo.",
            "reviewStatus": "machine-draft"
          }
        },
        {
          "question": {
            "sourceEnglish": "Your borehole serves your household. Neighbours ask for water too. Which action best reflects all three ethics?",
            "xitsongaDraft": "Mugodi wa wena wa borehole wu tirhela muti wa wena. Vaakelani va kombela mati na vona. Hi xihi xiendlo lexi kombisaka kahle mahanyelo hinkwawo manharhu?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "Sell access to the highest bidder",
              "xitsongaDraft": "Xavisa mpfumelelo eka loyi a nyikaka mali yo tala swinene",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Keep all the borehole water for a larger irrigation area",
              "xitsongaDraft": "Hlayisa mati hinkwawo ya borehole ma tirhela ndhawu leyikulu ya ku cheleta ntsena",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Find out if sharing is allowed and if the borehole can serve all users. Only then agree how to share fairly and keep watching the water level.",
              "xitsongaDraft": "Kuma leswaku xana ku avelana swa pfumeleriwa naswona borehole yi nga kota ku tirhela vatirhisi hinkwavo. Hi kona ntsena mi nga pfumelelanaka hi ndlela yo avelana hi ku ringana naswona mi ya emahlweni mi languta xiyimo xa mati.",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Cap the borehole to preserve groundwater only",
              "xitsongaDraft": "Pfala borehole ku hlayisa mati ya le hansi ka misava ntsena",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 2,
          "rationale": {
            "sourceEnglish": "First find out what water use is allowed and whether the source can serve all users without taking too much. If sharing is allowed and there is enough water, agree how to share fairly. Monitoring helps you notice change; it does not give permission to take more water.",
            "xitsongaDraft": "Rhanga u kuma leswaku hi kwihi ku tirhisiwa ka mati loku pfumeleriwaka na loko xihlovo xi nga kota ku tirhela vatirhisi hinkwavo handle ko teka mati yo tala ngopfu. Loko ku avelana ku pfumeleriwa naswona mati ma ringene, pfumelelanani hi ndlela yo avelana hi ku ringana. Ku xiyisisa swi ku pfuna ku vona ku cinca; a swi nyiki mpfumelelo wo teka mati yo tala.",
            "reviewStatus": "machine-draft"
          }
        }
      ]
    },
    {
      "id": "intro-permaculture-l2",
      "title": {
        "sourceEnglish": "Twelve Principles: Designing with Nature",
        "xitsongaDraft": "Misinya ya Milawu ya Khume-Mbirhi: Ku Endla Pulani na Ntumbuluko",
        "reviewStatus": "machine-draft"
      },
      "body": {
        "sourceEnglish": "David Holmgren set out twelve design principles in Essence of Permaculture. Bill Mollison and David Holmgren co-originated the permaculture concept. Three useful starting points for this lesson are: observe and interact — watch your land through a full season before major earthworks; catch and store energy — notice rain, sun and biomass before they leave your property; and use edges and value the marginal — a fence line or strip beside a path can be a useful place to observe.\n\nOthers worth knowing: produce no waste (scraps become compost, compost becomes soil), use small and slow solutions (a bucket can irrigate a bed without electricity), and use and value diversity. Hail injury to maize depends on the storm and the crop’s growth stage.\n\nPick two or three principles that speak to your biggest problem and apply them hard. The rest become obvious as you go.",
        "xitsongaDraft": "David Holmgren u boxile misinya ya milawu ya khume-mbirhi yo endla pulani eka Essence of Permaculture. Bill Mollison na David Holmgren va sungurile miehleketo ya permaculture swin'we. Three useful starting points for this lesson are: observe and interact — watch your land through a full season before major earthworks; catch and store energy — notice rain, sun and biomass before they leave your property; and use edges and value the marginal — a fence line or strip beside a path can be a useful place to observe.\n\nSwin'wana leswi nga swa nkoka ku swi tiva: u nga humesi thyaka (masalela ma hundzuka compost, compost yi hundzuka misava), tirhisa swintlhantlho leswitsongo naswona swa le hansi (bakiti ri nga cheleta bed handle ka gezi), naswona tirhisa u tlhela u teka ku hambana-hambana ku ri ka nkoka. Hail injury to maize depends on the storm and the crop’s growth stage.\n\nHlawula misinya ya milawu yimbirhi kumbe yinharhu leyi vulavulaka hi xiphiqo xa wena lexikulu kutani u yi tirhisa hi matimba. Leyin'wana yi ta va erivaleni loko u ri karhi u ya emahlweni.",
        "reviewStatus": "machine-draft"
      },
      "keyPoints": [
        {
          "sourceEnglish": "Observe your land for a full season before major earthworks",
          "xitsongaDraft": "Xiyisisa tiko ra wena hi nguva hinkwayo u nga si sungula mintirho leyikulu ya ku cela misava",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Catch and store rain, sun, and biomass before they leave your property",
          "xitsongaDraft": "Catch and store rain, sun, and biomass before they leave your property",
          "reviewStatus": "hold"
        },
        {
          "sourceEnglish": "Edges and margins can be useful places to observe what grows well",
          "xitsongaDraft": "Edges and margins can be useful places to observe what grows well",
          "reviewStatus": "hold"
        },
        {
          "sourceEnglish": "Hail injury to maize depends on the storm and the crop’s growth stage",
          "xitsongaDraft": "Hail injury to maize depends on the storm and the crop’s growth stage",
          "reviewStatus": "hold"
        }
      ],
      "quiz": [
        {
          "question": {
            "sourceEnglish": "A farmer wants to dig swales to harvest rainwater. What should she do first, following 'observe and interact'?",
            "xitsongaDraft": "Murimi u lava ku cela ti-swale ku hlengeleta mati ya mpfula. I yini leswi a faneleke ku rhanga a swi endla, hi ku landza 'xiyisisa u tlhela u tirhisana'?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "Dig immediately after the first good rain",
              "xitsongaDraft": "Cela hi ku hatlisa endzhaku ka mpfula yo sungula leyinene",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Watch where water flows and pools across at least one wet season",
              "xitsongaDraft": "Watch where water flows and pools across at least one wet season",
              "reviewStatus": "hold"
            },
            {
              "sourceEnglish": "Copy a neighbour's swale layout",
              "xitsongaDraft": "Kopisa maendlelo ya swale ya muakelani",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Assume the same swale design fits every site",
              "xitsongaDraft": "Anakanya leswaku pulani leyi fanaka ya swale yi lulamela ndhawu yin'wana na yin'wana",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 1,
          "rationale": {
            "sourceEnglish": "A wet season shows more than one storm, but observation is only a first step. Check the soil, slope, drainage and safe overflow route with a trained local adviser before digging.",
            "xitsongaDraft": "A wet season shows more than one storm, but observation is only a first step. Check the soil, slope, drainage and safe overflow route with a trained local adviser before digging.",
            "reviewStatus": "hold"
          }
        },
        {
          "question": {
            "sourceEnglish": "Which layout best applies 'integrate rather than segregate'?",
            "xitsongaDraft": "Hi rihi hlelelo leri tirhisaka kahle 'hlanganisa ku ri na ku hambanisa'?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "Chickens penned far from the garden",
              "xitsongaDraft": "Tihuku ti pfaleriwa ekule na jarata",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Garden, fruit trees and a chicken run arranged so chickens use an empty bed after harvest, then the farmer checks safe management before edible crops return",
              "xitsongaDraft": "Jarata, mirhi ya mihandzu na xivala xa tihuku swi hleriwile leswaku tihuku ti tirhisa bed leyi nga riki na nchumu endzhaku ka ntshovelo, kutani murimi a kamba mahlayisele yo sirheleleka swimilana leswi dyiwaka swi nga si vuyiseriwa",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Separate paddocks for each crop",
              "xitsongaDraft": "Tindhawu to hambana eka ximilana xin'wana na xin'wana",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "All animals kept off the cultivated zone",
              "xitsongaDraft": "Swiharhi hinkwaswo swi hlayisiwa ekule na ndhawu leyi rimiwaka",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 1,
          "rationale": {
            "sourceEnglish": "Integration puts each element to work for its neighbours — here, chickens clean up pests and add fertility instead of sitting idle in a fixed pen. Fresh manure can carry germs, so check safe management before edible crops return.",
            "xitsongaDraft": "Integration puts each element to work for its neighbours — here, chickens clean up pests and add fertility instead of sitting idle in a fixed pen. Fresh manure can carry germs, so check safe management before edible crops return.",
            "reviewStatus": "hold"
          }
        }
      ]
    },
    {
      "id": "intro-permaculture-l3",
      "title": {
        "sourceEnglish": "Zones and Sectors: Organising Your Farm by Energy",
        "xitsongaDraft": "Ti-Zone na Ti-Sector: Ku Hlela Purasi ra Wena hi Matimba",
        "reviewStatus": "machine-draft"
      },
      "body": {
        "sourceEnglish": "Zones and sectors help you cut wasted labour. Zones run 0 to 5 by how often you visit. Zone 0 is the house. In this example, Zone 1 is near the house and holds what you pick often — herbs, salad greens. Zone 2 is the main garden and chicken run, visited once or twice a day. Zone 3 is the main field, visited weekly. Zone 4 is semi-wild — fruit trees and fodder needing occasional attention. Zone 5 is left wild.\n\nSectors are the energies arriving from outside — sun, wind, rain, flood, fire. Watch where strong wind comes from on your farm. Nearby weather-station records can help you check wind direction. Watch where rainwater enters and flows across your land. Draw arrows for what you observe.\n\nSketch zones and sectors on paper and you have the skeleton of your design.",
        "xitsongaDraft": "Ti-zone na ti-sector ti ku pfuna ku hunguta ntirho lowu tlangisiwaka. Ti-zone ti famba ku sukela eka 0 kufika eka 5 hi ku ya hi minkarhi leyi u endzelaka ha yona. Zone 0 i yindlu. In this example, Zone 1 is near the house and holds what you pick often — herbs, salad greens. Zone 2 i jarata lerikulu na xivala xa tihuku, leswi endzeriwaka kan'we kumbe kambirhi hi siku. Zone 3 i nsimu leyikulu, leyi endzeriwaka vhiki na vhiki. Zone 4 yi lo sala yi ri le xikarhi ka ku rimiwa na nhova — mirhi ya mihandzu na swakudya swa swifuwo leswi lavaka nyingiso minkarhi yin'wana. Zone 5 yi tshikiwile yi ri nhova.\n\nTi-sector i matimba lama nghenaka ma huma ehandle — dyambu, mheho, mpfula, ndhambi, ndzilo. Xiyisisa laha mheho ya matimba yi humaka kona eka purasi ra wena. Matsalwa ya xitichi xa maxelo xa le kusuhi ma nga ku pfuna ku kamba tlhelo leri mheho yi humaka eka rona. Watch where rainwater enters and flows across your land. Dirowa miseve eka leswi u swi vonaka.\n\nDirowa ti-zone na ti-sector ephepheni kutani u va na rhambu ra pulani ya wena.",
        "reviewStatus": "machine-draft"
      },
      "keyPoints": [
        {
          "sourceEnglish": "In this example, Zone 1 near the house holds often-picked herbs",
          "xitsongaDraft": "In this example, Zone 1 near the house holds often-picked herbs",
          "reviewStatus": "hold"
        },
        {
          "sourceEnglish": "Zones organise labour by how often you need to visit",
          "xitsongaDraft": "Ti-zone ti hlela mintirho hi ku ya hi minkarhi leyi u lavaka ku endzela ha yona",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Sectors map incoming sun, wind, rainwater, flood and fire",
          "xitsongaDraft": "Sectors map incoming sun, wind, rainwater, flood and fire",
          "reviewStatus": "hold"
        },
        {
          "sourceEnglish": "A simple sketch of zones and sectors is enough to start designing",
          "xitsongaDraft": "Mpfapfarhuto wo olova wa ti-zone na ti-sector wu ringene ku sungula ku endla pulani",
          "reviewStatus": "machine-draft"
        }
      ],
      "quiz": [
        {
          "question": {
            "sourceEnglish": "You plant herbs in Zone 3, the main field far from the house. What problem does this create?",
            "xitsongaDraft": "You plant herbs in Zone 3, the main field far from the house. What problem does this create?",
            "reviewStatus": "hold"
          },
          "options": [
            {
              "sourceEnglish": "Herbs grow too large",
              "xitsongaDraft": "Herbs grow too large",
              "reviewStatus": "hold"
            },
            {
              "sourceEnglish": "The extra walk may mean you pick or check them less often",
              "xitsongaDraft": "The extra walk may mean you pick or check them less often",
              "reviewStatus": "hold"
            },
            {
              "sourceEnglish": "Herbs cross-pollinate with main crops",
              "xitsongaDraft": "Herbs cross-pollinate with main crops",
              "reviewStatus": "hold"
            },
            {
              "sourceEnglish": "Zone 3 gets too much sun for herbs",
              "xitsongaDraft": "Zone 3 gets too much sun for herbs",
              "reviewStatus": "hold"
            }
          ],
          "sourceCorrectIndex": 1,
          "rationale": {
            "sourceEnglish": "Put a crop you pick often near a daily path. A distant bed adds walking and may be checked less often.",
            "xitsongaDraft": "Put a crop you pick often near a daily path. A distant bed adds walking and may be checked less often.",
            "reviewStatus": "hold"
          }
        },
        {
          "question": {
            "sourceEnglish": "You observe damaging wind coming from the north-west on a Highveld farm. Where should a windbreak go?",
            "xitsongaDraft": "U xiyisisa mheho leyi onhaka yi huma en'walungu-vupeladyambu eka purasi ra Highveld. Xisirhelelo xa mheho (windbreak) xi fanele ku ya kwihi?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "South-east boundary",
              "xitsongaDraft": "Ndzelekani wa dzonga-vuxa",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "North-west boundary, between the wind and the crops",
              "xitsongaDraft": "Ndzelekani wa n'walungu-vupeladyambu, exikarhi ka mheho na swimilana",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Centre of the property",
              "xitsongaDraft": "Exikarhi ka ndhawu ya purasi",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Windbreaks aren't needed since winds are seasonal",
              "xitsongaDraft": "Swisirhelelo swa mheho a swi laveki hikuva mimheho i ya tinguva",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 1,
          "rationale": {
            "sourceEnglish": "A windbreak works by standing between the wind source and what it would damage — so it belongs on the side the wind actually comes from.",
            "xitsongaDraft": "A windbreak works by standing between the wind source and what it would damage — so it belongs on the side the wind actually comes from.",
            "reviewStatus": "hold"
          }
        }
      ]
    }
  ],
  "holds": [
    {
      "lessonId": "intro-permaculture-l1",
      "field": "keyPoints[1]",
      "sourceText": "People Care: your family's needs come before market production",
      "reason": "Held in the exact English source pending fluent Xitsonga review because the current proposal may change this meaning."
    },
    {
      "lessonId": "intro-permaculture-l1",
      "field": "quiz[0].q",
      "sourceText": "A farmer sells all his surplus maize but keeps nothing for composting or seed saving. Which ethic is he most failing?",
      "reason": "The maize term in this question is uncertain; keep the exact source until a fluent reviewer confirms it."
    },
    {
      "lessonId": "intro-permaculture-l2",
      "field": "body",
      "sourceText": "Three useful starting points for this lesson are: observe and interact — watch your land through a full season before major earthworks; catch and store energy — notice rain, sun and biomass before they leave your property; and use edges and value the marginal — a fence line or strip beside a path can be a useful place to observe.",
      "reason": "Held in the exact English source pending fluent local review because changing this safety condition could mislead a learner."
    },
    {
      "lessonId": "intro-permaculture-l2",
      "field": "body",
      "sourceText": "Hail injury to maize depends on the storm and the crop’s growth stage.",
      "reason": "The hail and maize wording is kept exact so the storm and growth-stage condition cannot be broadened."
    },
    {
      "lessonId": "intro-permaculture-l2",
      "field": "keyPoints[1]",
      "sourceText": "Catch and store rain, sun, and biomass before they leave your property",
      "reason": "Held in the exact English source pending fluent Xitsonga review because the current proposal may change this meaning."
    },
    {
      "lessonId": "intro-permaculture-l2",
      "field": "keyPoints[2]",
      "sourceText": "Edges and margins can be useful places to observe what grows well",
      "reason": "Held in the exact English source pending fluent Xitsonga review because the current proposal may change this meaning."
    },
    {
      "lessonId": "intro-permaculture-l2",
      "field": "keyPoints[3]",
      "sourceText": "Hail injury to maize depends on the storm and the crop’s growth stage",
      "reason": "Held in the exact English source pending fluent Xitsonga review because the current proposal may change this meaning."
    },
    {
      "lessonId": "intro-permaculture-l2",
      "field": "quiz[0].options[1]",
      "sourceText": "Watch where water flows and pools across at least one wet season",
      "reason": "Held in the exact English source pending fluent local review because changing this safety condition could mislead a learner."
    },
    {
      "lessonId": "intro-permaculture-l2",
      "field": "quiz[0].rationale",
      "sourceText": "A wet season shows more than one storm, but observation is only a first step. Check the soil, slope, drainage and safe overflow route with a trained local adviser before digging.",
      "reason": "Held in the exact English source pending fluent local review because changing this safety condition could mislead a learner."
    },
    {
      "lessonId": "intro-permaculture-l2",
      "field": "quiz[1].rationale",
      "sourceText": "Integration puts each element to work for its neighbours — here, chickens clean up pests and add fertility instead of sitting idle in a fixed pen. Fresh manure can carry germs, so check safe management before edible crops return.",
      "reason": "Held in the exact English source pending fluent local review because changing this safety condition could mislead a learner."
    },
    {
      "lessonId": "intro-permaculture-l3",
      "field": "body",
      "sourceText": "In this example, Zone 1 is near the house and holds what you pick often — herbs, salad greens.",
      "reason": "The Xitsonga word chosen for herbs is uncertain; keep this example exact until reviewed."
    },
    {
      "lessonId": "intro-permaculture-l3",
      "field": "body",
      "sourceText": "Watch where rainwater enters and flows across your land.",
      "reason": "Held in the exact English source pending fluent local review because changing this safety condition could mislead a learner."
    },
    {
      "lessonId": "intro-permaculture-l3",
      "field": "keyPoints[0]",
      "sourceText": "In this example, Zone 1 near the house holds often-picked herbs",
      "reason": "The Xitsonga word chosen for herbs is uncertain; keep this example exact until reviewed."
    },
    {
      "lessonId": "intro-permaculture-l3",
      "field": "keyPoints[2]",
      "sourceText": "Sectors map incoming sun, wind, rainwater, flood and fire",
      "reason": "Held in the exact English source pending fluent Xitsonga review because the current proposal may change this meaning."
    },
    {
      "lessonId": "intro-permaculture-l3",
      "field": "quiz[0].q",
      "sourceText": "You plant herbs in Zone 3, the main field far from the house. What problem does this create?",
      "reason": "The Xitsonga word chosen for herbs is uncertain; keep this quiz item exact until reviewed."
    },
    {
      "lessonId": "intro-permaculture-l3",
      "field": "quiz[0].options[0]",
      "sourceText": "Herbs grow too large",
      "reason": "The Xitsonga word chosen for herbs is uncertain; keep this quiz option exact until reviewed."
    },
    {
      "lessonId": "intro-permaculture-l3",
      "field": "quiz[0].options[1]",
      "sourceText": "The extra walk may mean you pick or check them less often",
      "reason": "The Xitsonga word chosen for herbs is uncertain; keep this quiz option exact until reviewed."
    },
    {
      "lessonId": "intro-permaculture-l3",
      "field": "quiz[0].options[2]",
      "sourceText": "Herbs cross-pollinate with main crops",
      "reason": "The Xitsonga word chosen for herbs is uncertain; keep this quiz option exact until reviewed."
    },
    {
      "lessonId": "intro-permaculture-l3",
      "field": "quiz[0].options[3]",
      "sourceText": "Zone 3 gets too much sun for herbs",
      "reason": "The Xitsonga word chosen for herbs is uncertain; keep this quiz option exact until reviewed."
    },
    {
      "lessonId": "intro-permaculture-l3",
      "field": "quiz[0].rationale",
      "sourceText": "Put a crop you pick often near a daily path. A distant bed adds walking and may be checked less often.",
      "reason": "The rationale uses the held herb term; keep it exact until reviewed."
    },
    {
      "lessonId": "intro-permaculture-l3",
      "field": "quiz[1].rationale",
      "sourceText": "A windbreak works by standing between the wind source and what it would damage — so it belongs on the side the wind actually comes from.",
      "reason": "Keep the exact rationale tied to the scenario where damaging wind was observed from the north-west on a Highveld farm; do not broaden it into a general claim."
    }
  ]
};

/** Reading Landscape Xitsonga draft; review status and holds live on each source pair. */
export const XITSONGA_READING_LANDSCAPE_DRAFT: XitsongaCourseModuleDraft = {
  "id": "reading-landscape",
  "language": "ts",
  "reviewStatus": "machine-draft",
  "sourceMetadata": {
    "durationMins": 25,
    "category": "design"
  },
  "title": {
    "sourceEnglish": "Reading the Landscape",
    "xitsongaDraft": "Ku Hlaya Vutshamo bya Misava",
    "reviewStatus": "machine-draft"
  },
  "description": {
    "sourceEnglish": "Identify water flow, sun angles, wind patterns and topography on your site.",
    "xitsongaDraft": "Kuma matirhele ya mati, ku languta ka dyambu, mimoya na swiyimo swa misava eka ndhawu ya wena.",
    "reviewStatus": "machine-draft"
  },
  "lessons": [
    {
      "id": "reading-landscape-l1",
      "infographicAlt": {
        "sourceEnglish": "A hillside seen from the side, with arrows showing where rain runs down the slope, where it collects in a hollow, and where it soaks in as the ground flattens.",
        "xitsongaDraft": "Tlhelo ra ntshava ri voniwa hi le tlhelo, ri ri na miseve leyi kombaka laha mpfula yi rhelelaka kona hi le henhla ka ndhawu yo rhelela, laha yi hlengeletanaka kona exikheleni, na laha yi nghenaka kona eka misava loko misava yi phatsama.",
        "reviewStatus": "machine-draft"
      },
      "title": {
        "sourceEnglish": "Understanding Water Flow: Where Rain Goes on Your Land",
        "xitsongaDraft": "Ku Twisisa Ku Khuluka ka Mati: Laha Mpfula yi Yaka Kona eka Misava ya Wena",
        "reviewStatus": "machine-draft"
      },
      "body": {
        "sourceEnglish": "Before you harvest water, learn where it already goes. Watch from a safe place during heavy rain. When it is safe afterward, walk your land. Look for rills, places where water fans out, where it ponds, and where it leaves your property. Some excess water needs a safe route away so it does not cause damage.\n\nAn A-frame level can help you mark points at the same height and trace a contour line. Its marks are an observation, not a design or approval for earthworks. Before digging a swale, dam, or other structure, have the site assessed. Soil, slope, drainage, storm flow, and a safe overflow route all matter. Ask a trained local adviser.\n\nThere is no one placement rule for every slope. Observe where water moves and gathers. Poorly laid contours can increase erosion, and soil that takes in water slowly can hold too much. Choose any water works for the site and plan a safe route for excess water.",
        "xitsongaDraft": "Loko u nga se hlengeleta mati, tiva laha ma tshamaka ma ya kona. Hlalela u ri endhawini leyi hlayisekeke loko ku na mpfula ya matimba. Loko swi hlayisekile endzhaku, fambafamba eka misava ya wena. Languta mikhandlu leyitsongo ya mati, tindhawu laha mati ma hangalakaka kona, laha ma halakaka ma yima, na laha ma humaka kona eka ndhawu ya wena. Mati man'wana lama taleke ma lava ndlela leyi hlayisekeke yo famba leswaku ma nga endli khombo.\n\nAn A-frame level can help you mark points at the same height and trace a contour line. Its marks are an observation, not a design or approval for earthworks. Before digging a swale, dam, or other structure, have the site assessed. Soil, slope, drainage, storm flow, and a safe overflow route all matter. Ask a trained local adviser.\n\nThere is no one placement rule for every slope. Observe where water moves and gathers. Poorly laid contours can increase erosion, and soil that takes in water slowly can hold too much. Choose any water works for the site and plan a safe route for excess water.",
        "reviewStatus": "machine-draft"
      },
      "keyPoints": [
        {
          "sourceEnglish": "Watch from a safe place during rain, then walk the land when it is safe",
          "xitsongaDraft": "Hlalela u ri endhawini leyi hlayisekeke loko mpfula yi na, kutani u fambafamba eka misava loko swi hlayisekile",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "An A-frame can mark points at the same height, but it does not show whether earthworks are suitable",
          "xitsongaDraft": "A-frame yi nga fungha tindhawu leti nga eka ku leha loku fanaka, kambe a yi kombisi loko ku cela misava ku fanerile",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Water works and safe overflow routes need a site assessment",
          "xitsongaDraft": "Swivumbeko swa mati na tindlela leti hlayisekeke ta ku khuluka ka mati lama taleke swi lava ku kamberiwa ka ndhawu",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Some excess water needs a safe route away to prevent damage",
          "xitsongaDraft": "Mati man'wana lama taleke ma lava ndlela leyi hlayisekeke yo famba ku sivela khombo",
          "reviewStatus": "machine-draft"
        }
      ],
      "quiz": [
        {
          "question": {
            "sourceEnglish": "What can an A-frame level help you find?",
            "xitsongaDraft": "I yini lexi A-frame level yi nga ku pfunaka ku xi kuma?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "Points at the same height along a contour",
              "xitsongaDraft": "Tindhawu leti nga eka ku leha loku fanaka eka khanthura",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Whether a swale is safe to build on this slope",
              "xitsongaDraft": "Whether a swale is safe to build on this slope",
              "reviewStatus": "hold"
            },
            {
              "sourceEnglish": "How much stormwater the soil can absorb",
              "xitsongaDraft": "Mpfimo wa mati ya xidzedze lawa misava yi nga ma nwaka",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Where a dam spillway should be built",
              "xitsongaDraft": "Where a dam spillway should be built",
              "reviewStatus": "hold"
            }
          ],
          "sourceCorrectIndex": 0,
          "rationale": {
            "sourceEnglish": "An A-frame can help mark points at the same height. It does not assess soil, drainage, storm flow, or whether earthworks are suitable.",
            "xitsongaDraft": "An A-frame can help mark points at the same height. It does not assess soil, drainage, storm flow, or whether earthworks are suitable.",
            "reviewStatus": "hold"
          }
        },
        {
          "question": {
            "sourceEnglish": "You observe fast runoff on a sloped KZN site. What should you do before digging a water structure?",
            "xitsongaDraft": "U xiya mati lama khulukaka hi ku tsutsuma eka ndhawu yo rhelela ya KZN. I yini lexi u faneleke ku xi endla u nga se cela xivumbeko xa mati?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "Put it as high on the slope as possible",
              "xitsongaDraft": "Xi veke ehenhla ngopfu hi laha swi kotekaka kona eka ku rhelela",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Check the soil, slope, drainage and storm flow, and plan a safe overflow with a trained local adviser",
              "xitsongaDraft": "Check the soil, slope, drainage and storm flow, and plan a safe overflow with a trained local adviser",
              "reviewStatus": "hold"
            },
            {
              "sourceEnglish": "Put it wherever water first appears",
              "xitsongaDraft": "Xi veke kun'wana na kun'wana laha mati ma sungulaka ku humelela kona",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Follow the same high, middle and bottom rule used on other farms",
              "xitsongaDraft": "Landzelela nawu wolowo wa le henhla, exikarhi na le hansi lowu tirhisiwaka eka mapurasi man'wana",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 1,
          "rationale": {
            "sourceEnglish": "A placement rule cannot show whether a structure suits the site. Poorly laid contours can increase erosion, and excess water needs a safe route.",
            "xitsongaDraft": "A placement rule cannot show whether a structure suits the site. Poorly laid contours can increase erosion, and excess water needs a safe route.",
            "reviewStatus": "hold"
          }
        }
      ]
    },
    {
      "id": "reading-landscape-l2",
      "infographicAlt": {
        "sourceEnglish": "A slope with the sun in the north. Shadows from the building and the tree fall south, down the slope.",
        "xitsongaDraft": "Ndhawu yo rhelela leyi nga na dyambu en'walungwini. Mindzhuti leyi humaka eka muako na murhi yi wela edzongeni, ehansi ka ndhawu yo rhelela.",
        "reviewStatus": "machine-draft"
      },
      "title": {
        "sourceEnglish": "Sun Angles, Shade, and Aspect: Getting the Most from Sunlight",
        "xitsongaDraft": "Tindhawu ta Ku Languta ka Dyambu, Ndzhuti, na Xiyimo: Ku Kuma Vumbhuri Byo Tala eka Ku Vonakala ka Dyambu",
        "reviewStatus": "machine-draft"
      },
      "body": {
        "sourceEnglish": "In much of South Africa, especially in winter, the sun is to the north. Its path changes with the season and your location. North-facing slopes often receive more sun and can be warmer and drier. South-facing slopes are often cooler and moister. Frost can collect in low hollows where cold air settles. Watch your own site before choosing where to plant tender crops or place buildings.\n\nWinter sun is lower and farther north than summer sun. A wall or shade cloth can shade a bed longer in winter than in summer. Before placing anything permanent, stand in the spot at 8am, midday, and 4pm on a winter's day and watch where the shade falls.\n\nPawpaw and young citrus are sensitive to frost. Keep tender plants out of known low frost pockets. Observe local frost before planting.",
        "xitsongaDraft": "Eka tindhawu to tala ta South Africa, ngopfu-ngopfu hi vuxika, dyambu ri le n'walungwini. Ndlela ya rona yi cinca hi tinguva na ndhawu ya wena. Tindhawu to rhelela leti languteke n'walungwini ti tala ku kuma dyambu ro tala naswona ti nga hisa no oma swinene. Tindhawu to rhelela leti languteke dzongeni ti tala ku titimela no tsakamanyana. Xirhami xi nga hlengeletana eka swikhele swa le hansi laha moya wo titimela wu wisaka kona. Xiya ndhawu ya wena u nga se hlawula laha u nga byalaka swimilani leswi tsaneke kumbe ku veka miako.\n\nDyambu ra vuxika ri le hansi naswona ri le n'walungwini swinene ku tlula dyambu ra ximumu. Khumbi kumbe shade cloth swi nga sirhelela mubhedhi hi ndzhuti nkarhi wo leha hi vuxika ku tlula hi ximumu. U nga se veka nchumu wo tshama hilaha ku nga heriki, yima eka ndhawu yoleyo hi 8am, nhlikanhi, na 4pm hi siku ra vuxika u languta laha ndzhuti wu welaka kona.\n\nPawpaw and young citrus are sensitive to frost. Keep tender plants out of known low frost pockets. Observe local frost before planting.",
        "reviewStatus": "machine-draft"
      },
      "keyPoints": [
        {
          "sourceEnglish": "North-facing slopes often get more direct sun; south-facing slopes are often cooler and moister",
          "xitsongaDraft": "Tindhawu to rhelela leti languteke n'walungwini ti tala ku kuma dyambu ro kongoma; tindhawu to rhelela leti languteke dzongeni ti tala ku titimela no tsakamanyana",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Winter sun is lower and farther north; check local shade before building",
          "xitsongaDraft": "Dyambu ra vuxika ri le hansi naswona ri le kule en'walungwini; kambela ndzhuti wa laha kaya u nga se aka",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Cold air can collect in low hollows; aspect is only one site factor",
          "xitsongaDraft": "Moya wo titimela wu nga hlengeletana eka swikhele swa le hansi; tlhelo leri ndhawu yi languteke kona i nchumu wun'we ntsena eka swilo swa ndhawu",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Check local frost before placing tender pawpaw or young citrus",
          "xitsongaDraft": "Kambela xirhami xa laha kaya u nga se veka pawpaw leyi tsaneke kumbe citrus leyitsongo",
          "reviewStatus": "machine-draft"
        }
      ],
      "quiz": [
        {
          "question": {
            "sourceEnglish": "Where should a farmer first look for a frost-tender young pawpaw on a Highveld smallholding?",
            "xitsongaDraft": "Hi kwihi laha murimi a faneleke ku rhanga a languta kona pawpaw leyitsongo leyi tsaneke eka xirhami eka purasi leritsongo ra Highveld?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "The lowest point where cold air collects",
              "xitsongaDraft": "Ndhawu ya le hansi ngopfu laha moya wo titimela wu hlengeletanaka kona",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "A cold, shaded hollow",
              "xitsongaDraft": "Xikhele xo titimela, lexi nga na ndzhuti",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "A sunny spot outside a known frost hollow, after checking the site's frost pattern",
              "xitsongaDraft": "Ndhawu leyi nga na dyambu ehandle ka xikhele lexi tiviwaka xa xirhami, endzhaku ko kambela matirhele ya xirhami ya ndhawu",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "A position chosen without checking the site",
              "xitsongaDraft": "Ndhawu leyi hlawuriweke handle ko kambela ndhawu",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 2,
          "rationale": {
            "sourceEnglish": "Cold air can collect in low places. A sunnier site outside a known frost pocket may reduce risk, but local frost observations must guide the final position.",
            "xitsongaDraft": "Cold air can collect in low places. A sunnier site outside a known frost pocket may reduce risk, but local frost observations must guide the final position.",
            "reviewStatus": "hold"
          }
        },
        {
          "question": {
            "sourceEnglish": "A farmer plans shade cloth on the north side of her garden. What should she check before fixing it in place?",
            "xitsongaDraft": "Murimi u kunguhata shade cloth etlhelo ra n'walungu ra jarata ya yena. I yini lexi a faneleke ku xi kambela a nga se yi tiyisa endhawini?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "Where its shadow falls on the bed in winter",
              "xitsongaDraft": "Laha ndzhuti wa yona wu welaka kona eka mubhedhi hi vuxika",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Whether it redirects frost away",
              "xitsongaDraft": "Loko swi hambanisa xirhami xi ya kule",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Whether the sun is always overhead at noon",
              "xitsongaDraft": "Loko dyambu ri tshama ri ri henhla ka nhloko hi nhlikanhi",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Only whether it reduces summer evaporation",
              "xitsongaDraft": "Ntsena loko swi hunguta ku hisa loku omisaka mati hi ximumu",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 0,
          "rationale": {
            "sourceEnglish": "Winter sun is lower and farther north. Shade cloth can change the hours of sun on a bed. Check the actual shadows at 8am, midday, and 4pm before fixing it in place.",
            "xitsongaDraft": "Winter sun is lower and farther north. Shade cloth can change the hours of sun on a bed. Check the actual shadows at 8am, midday, and 4pm before fixing it in place.",
            "reviewStatus": "hold"
          }
        }
      ]
    },
    {
      "id": "reading-landscape-l3",
      "infographicAlt": {
        "sourceEnglish": "A farm from above with arrows showing wind direction, cold air draining downhill into a frost hollow, and the direction of the slope.",
        "xitsongaDraft": "Purasi ri langutiwa hi le henhla ri ri na miseve leyi kombaka tlhelo ra moya, moya wo titimela wu khulukela ehansi eka xikhele xa xirhami, na tlhelo ra ku rhelela ka misava.",
        "reviewStatus": "machine-draft"
      },
      "title": {
        "sourceEnglish": "Wind, Frost, and Topography: Reading the Invisible Forces",
        "xitsongaDraft": "Moya, Xirhami, na Swiyimo swa Misava: Ku Hlaya Matimba Lama nga Vonekiki",
        "reviewStatus": "machine-draft"
      },
      "body": {
        "sourceEnglish": "Wind can damage crops on a smallholding. The direction and strength of damaging wind change with region, season and your site's ridges and gaps. Walk the land on windy days. Record where the wind comes from and what it affects. Check local weather records before deciding where shelter is needed.\n\nOn a clear, still night, cold air can flow downhill and collect in low places. These places can be colder than nearby slopes. Frost patterns also depend on the site. Compare candidate places through the local frost season. Check local minimum-temperature records where available. If records are not available, keep observing across cold nights and ask a local agriculture adviser before choosing a permanent home for tender seedlings.\n\nFrost is ice that forms on a cold surface. Mist alone does not show that ice has formed, and frost damage can happen without visible ice. Look for ice and plant damage, compare low ground with slopes, and check minimum temperatures where you can. Mark places where cold or damage lasts longest. Keep sensitive plants away from the cold pockets you observe.\n\nFor tomatoes troubled by late blight, airflow and morning sun can help leaves dry. Late blight can still spread during prolonged cool, damp weather. Moving a bed alone will not control it; seek local crop-health guidance too.",
        "xitsongaDraft": "Moya wu nga onha swibyariwa eka purasi leritsongo. Tlhelo na matimba ya moya lowu onhaka swi cinca hi muganga, nguva na tinhlonge na minxaxamelo ya ndhawu ya wena. Fambafamba eka misava hi masiku ya moya. Tsala laha moya wu humaka kona na leswi wu khumbaka swona. Kambela matimu ya maxelo ya laha kaya u nga se teka xiboho xa laha vutsireledzi byi lavekaka kona.\n\nOn a clear, still night, cold air can flow downhill and collect in low places. These places can be colder than nearby slopes. Frost patterns also depend on the site. Compare candidate places through the local frost season. Check local minimum-temperature records where available. If records are not available, keep observing across cold nights and ask a local agriculture adviser before choosing a permanent home for tender seedlings.\n\nFrost is ice that forms on a cold surface. Mist alone does not show that ice has formed, and frost damage can happen without visible ice. Look for ice and plant damage, compare low ground with slopes, and check minimum temperatures where you can. Mark places where cold or damage lasts longest. Keep sensitive plants away from the cold pockets you observe.\n\nFor tomatoes troubled by late blight, airflow and morning sun can help leaves dry. Late blight can still spread during prolonged cool, damp weather. Moving a bed alone will not control it; seek local crop-health guidance too.",
        "reviewStatus": "machine-draft"
      },
      "keyPoints": [
        {
          "sourceEnglish": "Observe damaging wind direction on your site before placing shelter",
          "xitsongaDraft": "Xiya tlhelo ra moya lowu onhaka eka ndhawu ya wena u nga se veka vutsireledzi",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Cold air can drain downhill on clear, still nights and collect in low ground",
          "xitsongaDraft": "Moya wo titimela wu nga khulukela ehansi hi vusiku byo tenga, lebyi rhuleke wu hlengeletana eka misava ya le hansi",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Compare cold-night plant damage and temperatures across your site; visible frost is not the only sign",
          "xitsongaDraft": "Pimanisa ku onheka ka swimilani hi vusiku byo titimela na mahiselo eka ndhawu ya wena hinkwayo; xirhami lexi vonekaka a hi xona ntsena xikombiso",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Airflow and drying may help reduce wet leaves, but do not alone control late blight",
          "xitsongaDraft": "Ku famba ka moya na ku omisa swi nga pfuna ku hunguta matluka lama tsakamaka, kambe swona swoxe a swi lawuli late blight",
          "reviewStatus": "machine-draft"
        }
      ],
      "quiz": [
        {
          "question": {
            "sourceEnglish": "Where should a farmer first look when placing a frost-sensitive seedling nursery on a Highveld smallholding?",
            "xitsongaDraft": "Hi kwihi laha murimi a faneleke ku rhanga a languta kona loko a veka nursery ya swimilani leswi tsaneke eka xirhami eka purasi leritsongo ra Highveld?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "A known frost hollow at the valley bottom",
              "xitsongaDraft": "Xikhele lexi tiviwaka xa xirhami ehansi ka nkova",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "An exposed ridgeline without checking the wind",
              "xitsongaDraft": "Laha nhlonge yi pfulekeke kona handle ko kambela moya",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "A sunny, sheltered place outside an observed frost hollow, after checking the site's cold-night pattern",
              "xitsongaDraft": "Ndhawu leyi nga na dyambu, leyi tsirelekeke ehandle ka xikhele xa xirhami lexi xiyiwaka, endzhaku ko kambela matirhele ya vusiku byo titimela ya ndhawu",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "The place with the most shade, without checking frost",
              "xitsongaDraft": "Ndhawu leyi nga na ndzhuti wo tala ngopfu, handle ko kambela xirhami",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 2,
          "rationale": {
            "sourceEnglish": "Cold air can settle in low places on clear, still nights. Compare candidate nursery sites through the local frost season. Check local minimum-temperature records or ask a local agriculture adviser before making a permanent choice. Visible frost is not the only sign of frost damage, and no hillside position guarantees freedom from frost.",
            "xitsongaDraft": "Cold air can settle in low places on clear, still nights. Compare candidate nursery sites through the local frost season. Check local minimum-temperature records or ask a local agriculture adviser before making a permanent choice. Visible frost is not the only sign of frost damage, and no hillside position guarantees freedom from frost.",
            "reviewStatus": "hold"
          }
        },
        {
          "question": {
            "sourceEnglish": "A KZN farmer's tomatoes repeatedly develop late blight during cool, damp spells. Which bed position may help leaves dry, alongside local crop-health advice?",
            "xitsongaDraft": "A KZN farmer's tomatoes repeatedly develop late blight during cool, damp spells. Which bed position may help leaves dry, alongside local crop-health advice?",
            "reviewStatus": "hold"
          },
          "options": [
            {
              "sourceEnglish": "A sealed, unventilated tunnel",
              "xitsongaDraft": "A sealed, unventilated tunnel",
              "reviewStatus": "hold"
            },
            {
              "sourceEnglish": "A place with good airflow and morning sun",
              "xitsongaDraft": "Ndhawu leyi nga na ku famba lokunene ka moya na dyambu ra nimixo",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "A low spot near a dam",
              "xitsongaDraft": "Ndhawu ya le hansi kusuhi na damu",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "A shaded south wall",
              "xitsongaDraft": "Khumbi ra le dzongeni leri nga na ndzhuti",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 1,
          "rationale": {
            "sourceEnglish": "Airflow and morning sun can help leaves dry. Late blight is favoured by prolonged cool, damp weather, and moving the bed alone is not a complete control plan.",
            "xitsongaDraft": "Airflow and morning sun can help leaves dry. Late blight is favoured by prolonged cool, damp weather, and moving the bed alone is not a complete control plan.",
            "reviewStatus": "hold"
          }
        }
      ]
    },
    {
      "id": "reading-landscape-l4",
      "infographicAlt": {
        "sourceEnglish": "A hand-drawn site map on paper showing north, the buildings, the water, and the boundary — rough, as a farmer would draw it.",
        "xitsongaDraft": "Mepe wa ndhawu lowu dirowiweke hi voko ephepheni wu kombaka n'walungu, miako, mati, na ndzilekana — wo hambana-hambana, hilaha murimi a nga wu dirowaka hakona.",
        "reviewStatus": "machine-draft"
      },
      "title": {
        "sourceEnglish": "Making a Simple Site Map: Your Design Starts on Paper",
        "xitsongaDraft": "Ku Endla Mepe Wo Olova wa Ndhawu: Dizayini ya Wena yi Sungula eka Phepha",
        "reviewStatus": "machine-draft"
      },
      "body": {
        "sourceEnglish": "A site map needs paper, a tape measure, a compass, and time to walk your land. Walk the boundary and make a first sketch. Mark it 'not to scale' until you have checked its distances. Mark north. Add the house, trees, water, roads, fences. Draw arrows for summer and winter wind, shade patterns, and where water flows in rain.\n\nNote where frost sits longest, where the ground smells damp in dry months, and where khakibos or blackjack grow thick. These plants can grow in disturbed places, but their presence alone does not show whether soil is compacted. Check the soil before deciding what the patch means for your design.\n\nOverlay your zones and sectors on the same sketch. Update it season by season. A pencil sketch you actually use is worth more than a perfect one drawn once.",
        "xitsongaDraft": "Mepe wa ndhawu wu lava phepha, thepi yo pima, khompasi, na nkarhi wo fambafamba eka misava ya wena. Famba hi le mindzilakaneni u endla xifaniso xo sungula. Xi tsale 'not to scale' kukondza u kambela mipimo ya kona. Fungha n'walungu. Engetela yindlu, mirhi, mati, magondzo, mitsheto. Dirowa miseve ya moya wa ximumu na vuxika, matirhele ya ndzhuti, na laha mati ma khulukaka kona eka mpfula.\n\nNote where frost sits longest, where the ground smells damp in dry months, and where khakibos or blackjack grow thick. These plants can grow in disturbed places, but their presence alone does not show whether soil is compacted. Check the soil before deciding what the patch means for your design.\n\nVeka tizoniti na tisekitara ta wena ehenhla ka xifaniso xolexo. Xi pfuxete hi nguva na nguva. Xifaniso xa phensele lexi u xi tirhisaka kahle xi ni nkoka ku tlula lexi hetisekeke lexi dirowiweke kan'we ntsena.",
        "reviewStatus": "machine-draft"
      },
      "keyPoints": [
        {
          "sourceEnglish": "A site map needs only paper, a tape measure, a compass, and observation",
          "xitsongaDraft": "Mepe wa ndhawu wu lava ntsena phepha, thepi yo pima, khompasi, na ku xiyisisa",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Mark water flow, wind direction, frost pockets, and existing vegetation",
          "xitsongaDraft": "Fungha ku khuluka ka mati, tlhelo ra moya, swikhele swa xirhami, na swimilani leswi nga kona",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Mark thick khakibos or blackjack growth for a closer soil check; it does not prove compaction",
          "xitsongaDraft": "Fungha ku mila ko tlhuma ka khakibos kumbe blackjack leswaku u kambisisa misava kahle; a swi tiyisekisi ku sindzeka ka misava",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Overlay zones and sectors on your base map to complete the design skeleton",
          "xitsongaDraft": "Veka tizoniti na tisekitara ehenhla ka mepe wa wena wa masungulo ku hetisa rimba ra dizayini",
          "reviewStatus": "machine-draft"
        }
      ],
      "quiz": [
        {
          "question": {
            "sourceEnglish": "You notice thick blackjack growing in one corner every year. What should you do next?",
            "xitsongaDraft": "U xiya blackjack leyi tlhumeke yi mila eka khona yin'we lembe na lembe. I yini lexi u faneleke ku xi endla lexi landzelaka?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "The soil there is exceptionally fertile",
              "xitsongaDraft": "Misava ya kwalaho yi nonile ngopfu hi ndlela yo hlawuleka",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "That area has a higher water table",
              "xitsongaDraft": "Ndhawu yoleyo yi na xiteji xa le henhla xa mati ya le hansi ka misava",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Mark the patch and check the soil; the plant alone cannot show compaction",
              "xitsongaDraft": "Fungha ndhawu yoleyo u tlhela u kambela misava; ximilani ntsena a xi nge kombisi ku sindzeka ka misava",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Blackjack only grows in shade, so there's a hidden seep",
              "xitsongaDraft": "Blackjack yi mila ntsena endzhutini, kutani ku na mati lama nghenaka lama tumbeleke",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 2,
          "rationale": {
            "sourceEnglish": "Blackjack can grow in disturbed ground, but its presence alone does not diagnose compaction. Observe and check the soil before deciding what the patch means for your design.",
            "xitsongaDraft": "Blackjack can grow in disturbed ground, but its presence alone does not diagnose compaction. Observe and check the soil before deciding what the patch means for your design.",
            "reviewStatus": "hold"
          }
        },
        {
          "question": {
            "sourceEnglish": "Why mark summer and winter wind separately on your site map?",
            "xitsongaDraft": "Hikwalaho ka yini u fungha moya wa ximumu na wa vuxika hi ku hambana eka mepe wa wena wa ndhawu?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "Wind direction never changes in SA",
              "xitsongaDraft": "Tlhelo ra moya a ri cinci eka SA",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "They can come from different directions, changing where windbreaks and tender crops should go",
              "xitsongaDraft": "Yi nga huma eka matlhelo yo hambana, leswi cincaka laha swisivela-moya na swimilani leswi tsaneke swi faneleke ku ya kona",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Wind only matters in winter on the Highveld",
              "xitsongaDraft": "Moya wu na nkoka ntsena hi vuxika eka Highveld",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Wind direction only affects buildings",
              "xitsongaDraft": "Tlhelo ra moya ri khumba ntsena miako",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 1,
          "rationale": {
            "sourceEnglish": "Seasonal wind shifts mean a windbreak or crop placement that works for one season can be wrong for the other — so both need marking separately.",
            "xitsongaDraft": "Seasonal wind shifts mean a windbreak or crop placement that works for one season can be wrong for the other — so both need marking separately.",
            "reviewStatus": "hold"
          }
        }
      ]
    }
  ],
  "holds": [
    {
      "lessonId": "reading-landscape-l1",
      "field": "body",
      "sourceText": "An A-frame level can help you mark points at the same height and trace a contour line. Its marks are an observation, not a design or approval for earthworks. Before digging a swale, dam, or other structure, have the site assessed. Soil, slope, drainage, storm flow, and a safe overflow route all matter. Ask a trained local adviser.",
      "reason": "Retain the exact English source so this site-dependent safety statement is not narrowed, broadened, or turned into a guarantee before fluent local review."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "body",
      "sourceText": "There is no one placement rule for every slope. Observe where water moves and gathers. Poorly laid contours can increase erosion, and soil that takes in water slowly can hold too much. Choose any water works for the site and plan a safe route for excess water.",
      "reason": "Retain the exact English source so this site-dependent safety statement is not narrowed, broadened, or turned into a guarantee before fluent local review."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "quiz[0].rationale",
      "sourceText": "An A-frame can help mark points at the same height. It does not assess soil, drainage, storm flow, or whether earthworks are suitable.",
      "reason": "Retain the exact English source so this site-dependent safety statement is not narrowed, broadened, or turned into a guarantee before fluent local review."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "quiz[1].options[1]",
      "sourceText": "Check the soil, slope, drainage and storm flow, and plan a safe overflow with a trained local adviser",
      "reason": "Retain the exact English source so this site-dependent safety statement is not narrowed, broadened, or turned into a guarantee before fluent local review."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "quiz[1].rationale",
      "sourceText": "A placement rule cannot show whether a structure suits the site. Poorly laid contours can increase erosion, and excess water needs a safe route.",
      "reason": "Retain the exact English source so this site-dependent safety statement is not narrowed, broadened, or turned into a guarantee before fluent local review."
    },
    {
      "lessonId": "reading-landscape-l2",
      "field": "body",
      "sourceText": "Pawpaw and young citrus are sensitive to frost. Keep tender plants out of known low frost pockets. Observe local frost before planting.",
      "reason": "Retain the exact English source so this site-dependent safety statement is not narrowed, broadened, or turned into a guarantee before fluent local review."
    },
    {
      "lessonId": "reading-landscape-l2",
      "field": "quiz[0].rationale",
      "sourceText": "Cold air can collect in low places. A sunnier site outside a known frost pocket may reduce risk, but local frost observations must guide the final position.",
      "reason": "Retain the exact English source so this site-dependent safety statement is not narrowed, broadened, or turned into a guarantee before fluent local review."
    },
    {
      "lessonId": "reading-landscape-l2",
      "field": "quiz[1].rationale",
      "sourceText": "Winter sun is lower and farther north. Shade cloth can change the hours of sun on a bed. Check the actual shadows at 8am, midday, and 4pm before fixing it in place.",
      "reason": "Retain the exact English source so this site-dependent safety statement is not narrowed, broadened, or turned into a guarantee before fluent local review."
    },
    {
      "lessonId": "reading-landscape-l3",
      "field": "body",
      "sourceText": "On a clear, still night, cold air can flow downhill and collect in low places. These places can be colder than nearby slopes. Frost patterns also depend on the site. Compare candidate places through the local frost season. Check local minimum-temperature records where available. If records are not available, keep observing across cold nights and ask a local agriculture adviser before choosing a permanent home for tender seedlings.",
      "reason": "Retain the exact English source so this site-dependent safety statement is not narrowed, broadened, or turned into a guarantee before fluent local review."
    },
    {
      "lessonId": "reading-landscape-l3",
      "field": "body",
      "sourceText": "Frost is ice that forms on a cold surface. Mist alone does not show that ice has formed, and frost damage can happen without visible ice. Look for ice and plant damage, compare low ground with slopes, and check minimum temperatures where you can. Mark places where cold or damage lasts longest. Keep sensitive plants away from the cold pockets you observe.",
      "reason": "Retain the exact English source so this site-dependent safety statement is not narrowed, broadened, or turned into a guarantee before fluent local review."
    },
    {
      "lessonId": "reading-landscape-l3",
      "field": "body",
      "sourceText": "For tomatoes troubled by late blight, airflow and morning sun can help leaves dry. Late blight can still spread during prolonged cool, damp weather. Moving a bed alone will not control it; seek local crop-health guidance too.",
      "reason": "Retain the exact English source so this site-dependent safety statement is not narrowed, broadened, or turned into a guarantee before fluent local review."
    },
    {
      "lessonId": "reading-landscape-l3",
      "field": "quiz[0].rationale",
      "sourceText": "Cold air can settle in low places on clear, still nights. Compare candidate nursery sites through the local frost season. Check local minimum-temperature records or ask a local agriculture adviser before making a permanent choice. Visible frost is not the only sign of frost damage, and no hillside position guarantees freedom from frost.",
      "reason": "Retain the exact English source so this site-dependent safety statement is not narrowed, broadened, or turned into a guarantee before fluent local review."
    },
    {
      "lessonId": "reading-landscape-l3",
      "field": "quiz[1].rationale",
      "sourceText": "Airflow and morning sun can help leaves dry. Late blight is favoured by prolonged cool, damp weather, and moving the bed alone is not a complete control plan.",
      "reason": "Retain the exact English source so this site-dependent safety statement is not narrowed, broadened, or turned into a guarantee before fluent local review."
    },
    {
      "lessonId": "reading-landscape-l4",
      "field": "body",
      "sourceText": "Note where frost sits longest, where the ground smells damp in dry months, and where khakibos or blackjack grow thick. These plants can grow in disturbed places, but their presence alone does not show whether soil is compacted. Check the soil before deciding what the patch means for your design.",
      "reason": "Retain the exact English source so this site-dependent safety statement is not narrowed, broadened, or turned into a guarantee before fluent local review."
    },
    {
      "lessonId": "reading-landscape-l4",
      "field": "quiz[0].rationale",
      "sourceText": "Blackjack can grow in disturbed ground, but its presence alone does not diagnose compaction. Observe and check the soil before deciding what the patch means for your design.",
      "reason": "Retain the exact English source so this site-dependent safety statement is not narrowed, broadened, or turned into a guarantee before fluent local review."
    },
    {
      "lessonId": "reading-landscape-l4",
      "field": "quiz[1].rationale",
      "sourceText": "Seasonal wind shifts mean a windbreak or crop placement that works for one season can be wrong for the other — so both need marking separately.",
      "reason": "Retain the exact English source so this site-dependent safety statement is not narrowed, broadened, or turned into a guarantee before fluent local review."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "quiz[0].options[1]",
      "sourceText": "Whether a swale is safe to build on this slope",
      "reason": "Technical or agronomic wording remains exact English until a fluent Xitsonga reviewer can verify it."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "quiz[0].options[3]",
      "sourceText": "Where a dam spillway should be built",
      "reason": "Technical or agronomic wording remains exact English until a fluent Xitsonga reviewer can verify it."
    },
    {
      "lessonId": "reading-landscape-l2",
      "field": "body",
      "sourceText": "shade cloth",
      "reason": "Technical or agronomic wording remains exact English until a fluent Xitsonga reviewer can verify it."
    },
    {
      "lessonId": "reading-landscape-l3",
      "field": "quiz[1].options[0]",
      "sourceText": "A sealed, unventilated tunnel",
      "reason": "Technical or agronomic wording remains exact English until a fluent Xitsonga reviewer can verify it."
    },
    {
      "lessonId": "reading-landscape-l4",
      "field": "body",
      "sourceText": "not to scale",
      "reason": "Keep the standard scale warning exact on a field map until reviewed."
    },
    {
      "lessonId": "reading-landscape-l3",
      "field": "quiz[1].q",
      "sourceText": "A KZN farmer's tomatoes repeatedly develop late blight during cool, damp spells. Which bed position may help leaves dry, alongside local crop-health advice?",
      "reason": "Keep the crop and disease context exact until a fluent reviewer confirms the Xitsonga wording."
    }
  ]
};

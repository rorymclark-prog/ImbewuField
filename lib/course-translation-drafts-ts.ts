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

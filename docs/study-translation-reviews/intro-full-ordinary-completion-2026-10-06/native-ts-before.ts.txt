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
    "xitsongaDraft": "Mahanyelo, misinya ya milawu na mavumbeko (patterns) — masungulo ya hinkwaswo leswi u nga ta swi aka.",
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
      "infographicAlt": {
        "sourceEnglish": "The three ethics as three linked circles of equal size: a hand holding soil for Earth Care, two people for People Care, and a basket passing between hands for Fair Share.",
        "xitsongaDraft": "Mahanyelo lawa manharhu ma kombisiwa hi swirhendzevutana swinharhu leswi hlanganisiweke, leswi ringanaka hi vukulu: voko leri khomeke misava ra Ku Hlayisa Misava; vanhu vambirhi va Ku Hlayisa Vanhu; na baskiti leri hundziseriwaka hi mavoko ra Ku Avelana hi Ku Ringana.",
        "reviewStatus": "machine-draft"
      },
      "body": {
        "sourceEnglish": "Permaculture rests on three ethics. Earth Care means treating soil, water, plants and animals as living systems to protect, not resources to use up. People Care means your family's needs come first, then your community's. Fair Share means taking only what you need and returning the surplus — seeds, food, water, knowledge — back into the system.\n\nThese aren't abstract ideas. A farmer who sells every egg and vegetable but keeps nothing back for the family table is skipping People Care. A community that fences off a shared spring is breaking Fair Share.\n\nEthics matter because they help you decide when there's no rulebook — a neighbour asking to graze cattle after a drought, a flood damaging your swales. Build these three into how you think before you build anything on the ground.",
        "xitsongaDraft": "Permaculture yi seketeriwe eka mahanyelo manharhu. Ku Hlayisa Misava swi vula ku teka misava, mati, swimilana na swiharhi tanihi maendlelo lama hanyaka lama faneleke ku sirheleriwa, ku nga ri switirhisiwa swo hela hi ku tirhisiwa. Ku Hlayisa Vanhu swi vula leswaku swilaveko swa ndyangu wa wena swi rhanga emahlweni, kutani ku landzela swa vaaki va ka n'wina. Ku Avelana hi Ku Ringana swi vula ku teka ntsena leswi u swi lavaka kutani u vuyisela leswi saleke — mbewu, swakudya, mati, vutivi — endzeni ka maendlelo ya nsimu.\n\nLawa a hi mianakanyo ntsena leyi nga riki ya xiviri. Murimi loyi a xavisaka matandza hinkwawo na matsavu kambe a nga siyi nchumu etafuleni ra ndyangu u tlula Ku Hlayisa Vanhu. Vaaki lava biyelaka xihlovo lexi avelaneriwaka va tlula Ku Avelana hi Ku Ringana.\n\nMahanyelo i ya nkoka hikuva ma ku pfuna ku endla swiboho loko ku nga ri na buku ya milawu — muakelani loyi a kombelaka ku risa tihomu endzhaku ka dyandza, kumbe ndhambi leyi onhaka swisele (swales) swa wena. Aka mahanyelo lawa manharhu eka ndlela leyi u anakanyaka ha yona u nga si aka nchumu emisaveni.",
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
          "xitsongaDraft": "People Care: swilaveko swa ndyangu wa wena swi rhanga market production",
          "reviewStatus": "machine-draft"
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
            "xitsongaDraft": "Murimi u xavisa all his surplus maize kambe a nga hlayisi xilo xa composting kumbe seed saving. Hi yihi ethic leyi a tsandzekaka ku yi landzelela ngopfu?",
            "reviewStatus": "machine-draft"
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
            "xitsongaDraft": "Ku Avelana hi Ku Ringana swi vula ku vuyisela swin'wana swa leswi u swi tekaka — tanihi mbewu, monyolo wa khompositi (compost), kumbe swakudya swa van'wana. Ku xavisa hinkwaswo handle ko siya swin'wana swi tshova ndzhendzeleko wolowo.",
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
      "infographicAlt": {
        "sourceEnglish": "Twelve design principles arranged as segments around a central seedling, each shown as a simple picture — an eye for observing, a droplet for catching water, a sun for energy, a loop for returning waste.",
        "xitsongaDraft": "Misinya ya milawu ya dizayini ya khume-mbirhi yi vekiwile hi swiphemu leswi rhendzeleke ximilana lexi nga exikarhini. Xiphemu xin’wana ni xin’wana xi kombisiwa hi xifaniso xo olova — tihlo ra ku xiyisisa, thonsi ra ku khoma mati, dyambu ra eneji, na xirhendzevutana lexi kombisaka ku vuyisa thyaka.",
        "reviewStatus": "machine-draft"
      },
      "body": {
        "sourceEnglish": "David Holmgren set out twelve design principles in Essence of Permaculture. Bill Mollison and David Holmgren co-originated the permaculture concept. Three useful starting points for this lesson are: observe and interact — watch your land through a full season before major earthworks; catch and store energy — notice rain, sun and biomass before they leave your property; and use edges and value the marginal — a fence line or strip beside a path can be a useful place to observe.\n\nOthers worth knowing: produce no waste (scraps become compost, compost becomes soil), use small and slow solutions (a bucket can irrigate a bed without electricity), and use and value diversity. Hail injury to maize depends on the storm and the crop’s growth stage.\n\nPick two or three principles that speak to your biggest problem and apply them hard. The rest become obvious as you go.",
        "xitsongaDraft": "David Holmgren u hlamuserile misinya ya milawu ya dizayini ya khume-mbirhi eka Essence of Permaculture. Bill Mollison na David Holmgren va sungule nongoti wa permaculture swin'we. Tindlela tinharhu to sungula leti pfunaka eka dyondzo leyi hi leti: observe and interact — languta ndhawu ya wena eka nguva leyi heleleke u nga si endla earthworks letikulu; catch and store energy — xiya mpfula, dyambu na biomass loko swi nga si suka eka ndhawu ya wena; na use edges and value the marginal — layini ya fence kumbe xiphemu xa misava lexi nga etlhelo ka ndlela (strip) xi nga va ndhawu leyi pfunaka ku xiyisisa.\n\nTin'wana leti faneleke ku tiviwa: produce no waste (masalela ma hundzuka compost, compost yi hundzuka misava), use small and slow solutions (bakiti ri nga cheleta planting bed handle ka gezi), na use and value diversity. Ku onhaka ka maize hi xihangu swi ya hi storm na growth stage ya xibyariwa.\n\nHlawula misinya ya milawu yimbirhi kumbe yinharhu leyi fambelanaka ni xiphiqo xa wena lexikulu, u yi tirhisa hi ku tiyimisela. Leyin'wana yi ta sungula ku vonaka loko u ri karhi u ya.",
        "reviewStatus": "machine-draft"
      },
      "keyPoints": [
        {
          "sourceEnglish": "Observe your land for a full season before major earthworks",
          "xitsongaDraft": "Xiyisisa ndhawu ya wena eka nguva leyi heleleke u nga si sungula major earthworks",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Catch and store rain, sun, and biomass before they leave your property",
          "xitsongaDraft": "Hlengeleta u tlhela u hlayisa mpfula, dyambu na biomass swi nga si suka eka ndhawu ya wena",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Edges and margins can be useful places to observe what grows well",
          "xitsongaDraft": "Edges na margins swi nga va tindhawu leti pfunaka ku xiyisisa leswi kulaka kahle",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Hail injury to maize depends on the storm and the crop’s growth stage",
          "xitsongaDraft": "Ku onhaka ka maize hi xihangu swi ya hi storm na growth stage ya ximilana",
          "reviewStatus": "machine-draft"
        }
      ],
      "quiz": [
        {
          "question": {
            "sourceEnglish": "A farmer wants to dig swales to harvest rainwater. What should she do first, following 'observe and interact'?",
            "xitsongaDraft": "Murimi u lava ku cela swales ku hlengeleta mati ya mpfula. I yini lexi a faneleke ku sungula hi xona, a landzela observe and interact?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "Dig immediately after the first good rain",
              "xitsongaDraft": "Cela hi ku hatlisa endzhaku ka mpfula leyinene yo sungula",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Watch where water flows and pools across at least one wet season",
              "xitsongaDraft": "Xiyisisa laha mati ma khulukaka kona ni laha ma hlengeletanaka kona eka nguva ya mpfula yin’we kumbe ku tlurisa",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Copy a neighbour's swale layout",
              "xitsongaDraft": "Kopisa ndlela leyi swale ya muakelani yi endliweke ha yona",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Assume the same swale design fits every site",
              "xitsongaDraft": "Anakanya leswaku design leyi fanaka ya swale ya faneleka eka ndhawu yin’wana ni yin’wana",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 1,
          "rationale": {
            "sourceEnglish": "A wet season shows more than one storm, but observation is only a first step. Check the soil, slope, drainage and safe overflow route with a trained local adviser before digging.",
            "xitsongaDraft": "Nguva ya mpfula yi komba swidzedze swo tala ku tlula xin’we, kambe ku xiyisisa i goza ro sungula ntsena. Kambela misava, slope, drainage na safe overflow route swin’we na mutsundzuxi wa le ndhawini ya wena loyi a leteriweke u nga si cela.",
            "reviewStatus": "machine-draft"
          }
        },
        {
          "question": {
            "sourceEnglish": "Which layout best applies 'integrate rather than segregate'?",
            "xitsongaDraft": "Hi rihi hlelelo leri tirhisaka kahle integrate rather than segregate?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "Chickens penned far from the garden",
              "xitsongaDraft": "Tihuku ti pfaleriwe ekule na ntanga",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Garden, fruit trees and a chicken run arranged so chickens use an empty bed after harvest, then the farmer checks safe management before edible crops return",
              "xitsongaDraft": "Ntanga, mirhi ya mihandzu na chicken run swi hleriwe leswaku tihuku ti tirhisa planting bed leyi nga riki na swin'wana endzhaku ka harvest, kutani murimi u kambela safe management loko edible crops ti nga si vuya",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Separate paddocks for each crop",
              "xitsongaDraft": "Paddocks to hambana eka crop yin’wana ni yin’wana",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "All animals kept off the cultivated zone",
              "xitsongaDraft": "Swiharhi hinkwaswo swi hlayisiwa swi nga ngheni eka cultivated zone",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 1,
          "rationale": {
            "sourceEnglish": "Integration puts each element to work for its neighbours — here, chickens clean up pests and add fertility instead of sitting idle in a fixed pen. Fresh manure can carry germs, so check safe management before edible crops return.",
            "xitsongaDraft": "Ku hlanganisa swi endla leswaku element yin’wana ni yin’wana yi tirhela leswi nga ekusuhi na yona — laha, tihuku ti basisa pests ni ku engetela fertility, ematshan'weni yo tshamela eka fixed pen ti nga endli nto. Fresh manure yi nga rhwala germs, hikokwalaho kambela safe management loko edible crops ti nga si vuya.",
            "reviewStatus": "machine-draft"
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
      "infographicAlt": {
        "sourceEnglish": "Illustrated example farm: numbered markers 0 to 5 follow a winding footpath from the house and near garden, past chickens and a field, toward trees and a wilder riverside area. The markers are examples, not fixed boundaries or distances.",
        "xitsongaDraft": "Xikombiso xa purasi lexi kombisiweke hi swifaniso: tinomboro ta 0 ku ya eka 5 ti landzelela ndlela yo famba hi milenge leyi jikajikaka ku suka endlwini ni le xirhapeni xa le kusuhi, ti hundza tihuku ni nsimu, ti ya eka mirhi ni a wilder riverside area. Tinomboro leti i swikombiso ntsena; a hi mindzilakano leyi tiyisiweke kumbe mipfhuka leyi tiyisiweke.",
        "reviewStatus": "machine-draft"
      },
      "body": {
        "sourceEnglish": "Zones and sectors help you cut wasted labour. Zones run 0 to 5 by how often you visit. Zone 0 is the house. In this example, Zone 1 is near the house and holds what you pick often — herbs, salad greens. Zone 2 is the main garden and chicken run, visited once or twice a day. Zone 3 is the main field, visited weekly. Zone 4 is semi-wild — fruit trees and fodder needing occasional attention. Zone 5 is left wild.\n\nSectors are the energies arriving from outside — sun, wind, rain, flood, fire. Watch where strong wind comes from on your farm. Nearby weather-station records can help you check wind direction. Watch where rainwater enters and flows across your land. Draw arrows for what you observe.\n\nSketch zones and sectors on paper and you have the skeleton of your design.",
        "xitsongaDraft": "Zones na sectors swi ku pfuna ku hunguta ntirho lowu tlangisiwaka. Zones ti sukela eka 0 ku ya eka 5 hi ku ya hi ku tala ka minkarhi leyi u endzelaka ha yona. Zone 0 i yindlu. Eka example leyi, Zone 1 yi le kusuhi na yindlu naswona yi na leswi u swi tshovelaka nkarhi na nkarhi — herbs na salad greens. Zone 2 i ntanga lowukulu na xivala xa tihuku, leswi u swi endzelaka kan’we kumbe kambirhi hi siku. Zone 3 i nsimu leyikulu, leyi u yi endzelaka vhiki na vhiki. Zone 4 yi le ka semi-wild — mirhi ya mihandzu na fodder leyi lavaka nyingiso minkarhi yin’wana. Zone 5 yi tshikiwile yi ri nhova.\n\nSectors i energy leyi nghenaka yi huma ehandle — dyambu, moya, mpfula, flood na fire. Xiya laha moya lowu tiyeke wu humaka kona epurasini ra wena. Matsalwa ya weather station ya le kusuhi ma nga ku pfuna ku kambela tlhelo leri moya wu humaka eka rona. Xiya laha mati ya mpfula ma nghenaka kona ni laha ma khulukaka kona eka ndhawu ya wena. Dirowa miseve ya leswi u swi vonaka.\n\nDirowa zones na sectors ephepheni kutani u va na motheo wa design ya wena.",
        "reviewStatus": "machine-draft"
      },
      "keyPoints": [
        {
          "sourceEnglish": "In this example, Zone 1 near the house holds often-picked herbs",
          "xitsongaDraft": "Eka example leyi, Zone 1 leyi nga kusuhi na yindlu yi na herbs leti u ti tshovelaka nkarhi na nkarhi",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Zones organise labour by how often you need to visit",
          "xitsongaDraft": "Ti-zone ti hlela mintirho hi ku ya hi minkarhi leyi u lavaka ku endzela ha yona",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Sectors map incoming sun, wind, rainwater, flood and fire",
          "xitsongaDraft": "Sectors ti komba energy leyi nghenaka: dyambu, moya, mati ya mpfula, flood na ndzilo",
          "reviewStatus": "machine-draft"
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
            "xitsongaDraft": "U byala herbs eka Zone 3, main field leyi nga ekule na yindlu. Xana leswi swi vanga xiphiqo xihi?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "Herbs grow too large",
              "xitsongaDraft": "Herbs ti kula ngopfu",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "The extra walk may mean you pick or check them less often",
              "xitsongaDraft": "Ku famba mpfhuka wo engetela swi nga endla leswaku u tshovela kumbe u kambela herbs hi minkarhi yitsongo.",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Herbs cross-pollinate with main crops",
              "xitsongaDraft": "Herbs ti cross-pollinate na crops letikulu",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Zone 3 gets too much sun for herbs",
              "xitsongaDraft": "Zone 3 yi kuma sun yo tala ngopfu eka herbs",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 1,
          "rationale": {
            "sourceEnglish": "Put a crop you pick often near a daily path. A distant bed adds walking and may be checked less often.",
            "xitsongaDraft": "Veka crop leyi u yi tshovelaka nkarhi na nkarhi ekusuhi na ndlela leyi u yi tirhisaka siku na siku. Bed leyi nga ekule yi engetela ku famba naswona yi nga endla leswaku u yi kambela hi minkarhi yitsongo.",
            "reviewStatus": "machine-draft"
          }
        },
        {
          "question": {
            "sourceEnglish": "You observe damaging wind coming from the north-west on a Highveld farm. Where should a windbreak go?",
            "xitsongaDraft": "U xiyisisa damaging wind coming from the North-west on a Highveld farm. Windbreak yi fanele ku ya kwihi?",
            "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "South-east boundary",
              "xitsongaDraft": "Ndzilakana wa South-east",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "North-west boundary, between the wind and the crops",
              "xitsongaDraft": "Ndzilakana wa North-west, vhukati ka moya na crops",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Centre of the property",
              "xitsongaDraft": "Exikari ka property",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Windbreaks aren't needed since winds are seasonal",
              "xitsongaDraft": "Swisivela-moya a swi laveki hikuva mimoya yi hunga hi tinguva",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 1,
          "rationale": {
            "sourceEnglish": "A windbreak works by standing between the wind source and what it would damage — so it belongs on the side the wind actually comes from.",
            "xitsongaDraft": "Windbreak yi tirha hi ku yima vhukati ka laha moya wu humaka kona ni leswi wu nga swi onhaka. Hikokwalaho yi fanele ku va eka tlhelo leri moya wu humaka eka rona hakunene.",
            "reviewStatus": "machine-draft"
          }
        }
      ]
    }
  ],
  "holds": [
    {
      "lessonId": "intro-permaculture-l1",
      "field": "keyPoints[1]",
      "sourceText": "People Care",
      "reason": "Retain the named permaculture ethic exactly while translating the family-needs-before-market-production priority around it."
    },
    {
      "lessonId": "intro-permaculture-l1",
      "field": "quiz[0].q",
      "sourceText": "all his surplus maize",
      "reason": "Retain the exact crop, ownership, and all-of-surplus wording because Xitsonga concord for the English crop anchor is uncertain."
    },
    {
      "lessonId": "intro-permaculture-l1",
      "field": "quiz[0].q",
      "sourceText": "composting",
      "reason": "Retain the named soil-input practice exact within the unreviewed negative clause."
    },
    {
      "lessonId": "intro-permaculture-l1",
      "field": "quiz[0].q",
      "sourceText": "seed saving",
      "reason": "Retain the named seed practice exact within the unreviewed negative clause."
    },
    {
      "lessonId": "intro-permaculture-l1",
      "field": "quiz[0].q",
      "sourceText": "ethic",
      "reason": "Retain the formal ethics-category term exact in the final question."
    },
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
        "xitsongaDraft": "Loko u nga se hlengeleta mati, tiva laha ma tshamaka ma ya kona. Hlalela u ri endhawini leyi hlayisekeke loko ku na mpfula ya matimba. Loko swi hlayisekile endzhaku, fambafamba eka misava ya wena. Languta mikhandlu leyitsongo ya mati, tindhawu laha mati ma hangalakaka kona, laha ma halakaka ma yima, na laha ma humaka kona eka ndhawu ya wena. Mati man'wana lama taleke ma lava ndlela leyi hlayisekeke yo famba leswaku ma nga endli khombo.\n\nA-frame level yi nga ku pfuna ku fungha points at the same height ni ku landzelela contour line. Its marks are an observation; a hi design kumbe mpfumelelo wa earthworks. U nga se cela swale, dam, kumbe xivumbeko xin’wana, tiyisisa leswaku ndhawu yi kamberiwile. Soil, slope, drainage, storm flow, na ndlela leyi hlayisekeke yo khulukisa mati lama taleke i swa nkoka. Vutisa trained local adviser.\n\nA ku na nawu wun’we wa ndhawu lowu faneleke eka slope yin’wana ni yin’wana. Xiya laha mati ma fambaka kona ni laha ma hlengeletanaka kona. Tikhontara leti endliweke hi ndlela yo biha ti nga engetela erosion, naswona misava leyi tswongaka mati hi ku nonoka yi nga khoma mati yo tala ngopfu. Hlawula any water works for the site, kutani u kunguhata ndlela leyi hlayisekeke yo humesa mati lama taleke.",
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
          "xitsongaDraft": "A-frame yi nga fungha points at the same height, kambe a yi kombisi loko earthworks ti fanerile",
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
              "xitsongaDraft": "Points at the same height along a contour",
              "reviewStatus": "hold"
            },
            {
              "sourceEnglish": "Whether a swale is safe to build on this slope",
              "xitsongaDraft": "Xana a swale yi hlayisekile ku akiwa eka slope leyi",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "How much stormwater the soil can absorb",
              "xitsongaDraft": "Mpimo wa mati ya xidzedze lawa misava yi nga ma nwaka",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Where a dam spillway should be built",
              "xitsongaDraft": "Laha a dam spillway yi faneleke ku akiwa kona",
              "reviewStatus": "machine-draft"
            }
          ],
          "sourceCorrectIndex": 0,
          "rationale": {
            "sourceEnglish": "An A-frame can help mark points at the same height. It does not assess soil, drainage, storm flow, or whether earthworks are suitable.",
            "xitsongaDraft": "A-frame yi nga ku pfuna ku fungha points at the same height. A yi kambeli misava, drainage, storm flow, kumbe loko earthworks ti fanerile.",
              "reviewStatus": "machine-draft"
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
              "xitsongaDraft": "Xi veke ehenhla ngopfu hi laha swi kotekaka kona eka slope",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "Check the soil, slope, drainage and storm flow, and plan a safe overflow with a trained local adviser",
              "xitsongaDraft": "Kambela misava, ndhawu leyi rhelelaka, ku humesa mati na storm flow, kutani u kunguhata ndlela leyi hlayisekeke yo humesa mati lama taleke u ri ni mutsundzuxi wa swa vurimi wa laha kaya loyi a leteriweke.",
              "reviewStatus": "machine-draft"
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
            "xitsongaDraft": "Nawu wa ndhawu a wu kombisi loko xivumbeko xi fanele ndhawu yoleyo. Tikhontara leti endliweke hi ndlela yo biha ti nga engetela erosion, naswona mati yo tala ma lava ndlela leyi hlayisekeke yo huma.",
              "reviewStatus": "machine-draft"
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
        "xitsongaDraft": "Eka tindhawu to tala ta South Africa, ngopfu-ngopfu hi vuxika, dyambu ri le n'walungwini. Ndlela ya rona yi cinca hi tinguva na ndhawu ya wena. Tindhawu to rhelela leti languteke n'walungwini ti tala ku kuma dyambu ro tala naswona ti nga hisa no oma swinene. Tindhawu to rhelela leti languteke dzongeni ti tala ku titimela no tsakamanyana. Xirhami xi nga hlengeletana eka swikhele swa le hansi laha moya wo titimela wu wisaka kona. Xiya ndhawu ya wena u nga se hlawula laha u nga byalaka swimilana leswi tsaneke kumbe ku veka miako.\n\nDyambu ra vuxika ri le hansi naswona ri le n'walungwini swinene ku tlula dyambu ra ximumu. Khumbi kumbe shade cloth swi nga sirhelela mubhedhi hi ndzhuti nkarhi wo leha hi vuxika ku tlula hi ximumu. U nga se veka nchumu wo tshama hilaha ku nga heriki, yima eka ndhawu yoleyo hi 8am, nhlikanhi, na 4pm hi siku ra vuxika u languta laha ndzhuti wu welaka kona.\n\nPawpaw na young citrus swi khumbeka hi frost. Hlayisa swimilana leswi tsaneke swi ri ekule ni tindhawu ta le hansi leti tiviwaka hi ku hlengeleta frost. Xiya frost ya laha kaya u nga se byala.",
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
          "xitsongaDraft": "Kambela xirhami xa laha kaya u nga se veka pawpaw leyi tsaneke kumbe young citrus",
              "reviewStatus": "machine-draft"
        }
      ],
      "quiz": [
        {
          "question": {
            "sourceEnglish": "Where should a farmer first look for a frost-tender young pawpaw on a Highveld smallholding?",
            "xitsongaDraft": "Hi kwihi laha murimi a faneleke ku rhanga a languta kona young pawpaw leyi tsaneke eka xirhami eka purasi leritsongo ra Highveld?",
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
            "xitsongaDraft": "Moya wo titimela wu nga hlengeletana etindhawini ta le hansi. Ndhawu leyi nga na dyambu swinene ehandle ka frost pocket leyi tiviwaka yi nga ha hunguta khombo; kambe leswi u swi vonaka hi frost ya ndhawu swi fanele ku kongomisa ndhawu yo hetelela.",
              "reviewStatus": "machine-draft"
          }
        },
        {
          "question": {
            "sourceEnglish": "A farmer plans shade cloth on the north side of her garden. What should she check before fixing it in place?",
            "xitsongaDraft": "Murimi u kunguhata shade cloth etlhelo ra n'walungu ra ntanga wa yena. I yini lexi a faneleke ku xi kambela a nga se yi tiyisa endhawini?",
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
            "xitsongaDraft": "Dyambu ra vuxika ri le hansi naswona ri ya en’walungwini swinene. Shade cloth yi nga cinca tiawara leti dyambu ri voningaka mubhedhi ha tona. Kambela ndzhuti wa xiviri hi 8am, nhlikanhi, na 4pm u nga se yi tiyisa endhawini.",
              "reviewStatus": "machine-draft"
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
        "xitsongaDraft": "Moya wu nga onha swibyariwa eka purasi leritsongo. Tlhelo na matla ya moya lowu onhaka swi cinca hi muganga, nguva na your site's ridges and gaps. Fambafamba eka misava hi masiku ya moya. Tsala laha moya wu humaka kona ni leswi wu swi khumbaka. Kambela matsalwa ya maxelo ya laha kaya u nga se teka xiboho xa laha nsirhelelo wu lavekaka kona.\n\nEka vusiku byo tenga ni byo rhula, moya wo titimela wu nga khulukela ehansi wu tlhela wu hlengeletana etindhawini ta le hansi. Tindhawu leti ti nga titimela ku tlurisa tindhawu to rhelela leti nga ekusuhi. Maendlelo ya frost na wona ya ya hi ndhawu. Pimanisa tindhawu leti nga hlawuriwaka through the local frost season. Kambela matsalwa ya mahiselo ya le hansi swinene ya laha kaya loko ma kumeka. Loko ma nga ri kona, yana mahlweni u ri karhi u languta eka vusiku byo titimela, u tlhela u vutisa mutsundzuxi wa swa vurimi wa laha kaya u nga si hlawula ndhawu ya nkarhi wo leha ya tender seedlings.\n\nFrost i ice leyi vumbekaka ehenhla ka surface leyi titimelaka. Mist ntsena a yi kombisi leswaku ice yi vumbekile, naswona frost damage yi nga endleka handle ka ice leyi vonakaka. Languta ice ni ku onhaka ka swimilana, pimanisa misava ya le hansi ni tindhawu to rhelela, u tlhela u kambela minimum temperatures laha swi kotekaka. Fungha tindhawu laha cold or damage swi tshamaka kona nkarhi wo leha ngopfu. Hlayisa swimilana leswi khumbekaka hi ku olova swi ri ekule ni cold pockets leti u ti vonaka.\n\nEka matamatisi lama karhatiwaka hi late blight, ku famba ka moya ni dyambu ra nimixo swi nga pfuna leswaku matluka ma oma. Late blight yi nga ya mahlweni yi hangalaka loko ku titimela ni ku tsakama swi teka nkarhi wo leha. Ku rhurhisa mubhedhi ntsena a swi nge yi lawuli; tlhela u lava xitsundzuxo xa rihanyo ra swimilana xa laha kaya.",
              "reviewStatus": "machine-draft"
      },
      "keyPoints": [
        {
          "sourceEnglish": "Observe damaging wind direction on your site before placing shelter",
          "xitsongaDraft": "Xiya tlhelo ra moya lowu onhaka eka ndhawu ya wena u nga se veka nsirhelelo",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Cold air can drain downhill on clear, still nights and collect in low ground",
          "xitsongaDraft": "Moya wo titimela wu nga khulukela ehansi hi vusiku byo tenga, lebyi rhuleke wu hlengeletana eka misava ya le hansi",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Compare cold-night plant damage and temperatures across your site; visible frost is not the only sign",
          "xitsongaDraft": "Pimanisa ku onheka ka swimilana hi vusiku byo titimela na mahiselo eka ndhawu ya wena hinkwayo; xirhami lexi vonekaka a hi xona ntsena xikombiso",
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
            "xitsongaDraft": "Hi kwihi laha murimi a faneleke ku rhanga a languta kona loko a veka nursery ya swimilana leswi tsaneke eka xirhami eka purasi leritsongo ra Highveld?",
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
              "xitsongaDraft": "An exposed ridgeline handle ko kambela moya",
              "reviewStatus": "machine-draft"
            },
            {
              "sourceEnglish": "A sunny, sheltered place outside an observed frost hollow, after checking the site's cold-night pattern",
              "xitsongaDraft": "Ndhawu leyi nga na dyambu, leyi sirhelelekeke ehandle ka xikhele xa xirhami lexi xiyiwaka, endzhaku ko kambela matirhele ya vusiku byo titimela ya ndhawu",
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
            "xitsongaDraft": "Moya wo titimela wu nga hlengeletana etindhawini ta le hansi hi vusiku byo tenga ni byo rhula. Pimanisa tindhawu leti nga tirhisiwaka ku veka nursery through the local frost season. Kambela matsalwa ya mahiselo ya le hansi swinene ya laha kaya kumbe u vutisa mutsundzuxi wa swa vurimi wa laha kaya u nga se teka xiboho xa ndhawu ya nkarhi wo leha. Frost leyi vonakaka a hi yona ntsena mhaka leyi kombisaka frost damage, naswona a ku na ndhawu ya le xintshabyanini leyi tiyisekisaka leswaku a ku nge vi na frost.",
              "reviewStatus": "machine-draft"
          }
        },
        {
          "question": {
            "sourceEnglish": "A KZN farmer's tomatoes repeatedly develop late blight during cool, damp spells. Which bed position may help leaves dry, alongside local crop-health advice?",
            "xitsongaDraft": "Matamatisi ya murimi wa KZN ma khomiwa hi late blight hi ku phindha-phindha loko ku titimela ni ku tsakama. Hi yihi ndhawu ya mubedhi leyi nga pfunaka matluka ku oma, swin’we ni xitsundzuxo xa rihanyo ra swimilana xa laha kaya?",
              "reviewStatus": "machine-draft"
          },
          "options": [
            {
              "sourceEnglish": "A sealed, unventilated tunnel",
              "xitsongaDraft": "Tunnel leyi pfariweke, leyi nga riki na ndlela yo nghenisa ni ku humesa moya",
              "reviewStatus": "machine-draft"
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
            "xitsongaDraft": "Ku famba ka moya ni dyambu ra nimixo swi nga pfuna leswaku matluka ma oma. Late blight yi tsakela ku titimela loku tekaka nkarhi wo leha ni ku tsakama, naswona ku rhurhisa mubedhi ntsena a hi kungu leri heleleke ro lawula vuvabyi.",
              "reviewStatus": "machine-draft"
          }
        }
      ]
    },
    {
      "id": "reading-landscape-l4",
      "infographicAlt": {
        "sourceEnglish": "A hand-drawn site map on paper showing north, the buildings, the water, and the boundary — rough, as a farmer would draw it.",
        "xitsongaDraft": "Mepe wa ndhawu lowu dirowiweke hi voko ephepheni wu kombaka n'walungu, miako, mati, na ndzilakano — wo hambana-hambana, hilaha murimi a nga wu dirowaka hakona.",
        "reviewStatus": "machine-draft"
      },
      "title": {
        "sourceEnglish": "Making a Simple Site Map: Your Design Starts on Paper",
        "xitsongaDraft": "Ku Endla Mepe Wo Olova wa Ndhawu: Dizayini ya Wena yi Sungula eka Phepha",
        "reviewStatus": "machine-draft"
      },
      "body": {
        "sourceEnglish": "A site map needs paper, a tape measure, a compass, and time to walk your land. Walk the boundary and make a first sketch. Mark it 'not to scale' until you have checked its distances. Mark north. Add the house, trees, water, roads, fences. Draw arrows for summer and winter wind, shade patterns, and where water flows in rain.\n\nNote where frost sits longest, where the ground smells damp in dry months, and where khakibos or blackjack grow thick. These plants can grow in disturbed places, but their presence alone does not show whether soil is compacted. Check the soil before deciding what the patch means for your design.\n\nOverlay your zones and sectors on the same sketch. Update it season by season. A pencil sketch you actually use is worth more than a perfect one drawn once.",
        "xitsongaDraft": "Mepe wa ndhawu wu lava phepha, thepi yo pima, khompasi, na nkarhi wo fambafamba eka misava ya wena. Famba hi le mindzilakaneni u endla xifaniso xo sungula. Xi tsale 'not to scale' kukondza u kambela mipimo ya kona. Fungha n'walungu. Engetela yindlu, mirhi, mati, magondzo, fences. Dirowa miseve ya moya wa ximumu na vuxika, matirhele ya ndzhuti, na laha mati ma khulukaka kona eka mpfula.\n\nTsala laha frost yi tshamaka kona nkarhi wo leha ngopfu, laha misava yi nun’hwaka yi tsakama hi tin’hweti leti omeke, ni laha khakibos kumbe blackjack yi milaka yi talile. Swimilana leswi swi nga kula etindhawini leti kavanyetiweke, kambe ku va kona ka swona ntsena a ku kombisi leswaku misava yi tsindziyerile. Kambela misava u nga se teka xiboho xa leswi ndhawu leyi yi vulaka swona eka design ya wena.\n\nVeka ti-zone na ti-sector ta wena ehenhla ka xifaniso xolexo. Xi pfuxete hi nguva na nguva. Xifaniso xa phensele lexi u xi tirhisaka kahle xi ni nkoka ku tlula lexi hetisekeke lexi dirowiweke kan'we ntsena.",
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
          "xitsongaDraft": "Fungha ku khuluka ka mati, tlhelo ra moya, swikhele swa xirhami, na swimilana leswi nga kona",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Mark thick khakibos or blackjack growth for a closer soil check; it does not prove compaction",
          "xitsongaDraft": "Fungha ku mila ko tlhuma ka khakibos kumbe blackjack leswaku u kambisisa misava kahle; a swi tiyisekisi ku sindzeka ka misava",
          "reviewStatus": "machine-draft"
        },
        {
          "sourceEnglish": "Overlay zones and sectors on your base map to complete the design skeleton",
          "xitsongaDraft": "Veka ti-zone na ti-sector ehenhla ka mepe wa wena wa masungulo ku hetisa rimba ra dizayini",
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
              "xitsongaDraft": "Fungha ndhawu yoleyo u tlhela u kambela misava; ximilana ntsena a xi nge kombisi ku sindzeka ka misava",
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
            "xitsongaDraft": "Blackjack yi nga kula etindhawini leti kavanyetiweke, kambe ku va kona ka yona ntsena a ku kombisi compaction. Xiya u tlhela u kambela misava u nga se teka xiboho xa leswi ndhawu yoleyo yi vulaka swona eka design ya wena.",
              "reviewStatus": "machine-draft"
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
              "xitsongaDraft": "Ti nga huma eka matlhelo yo hambana, leswi cincaka laha windbreaks ni swimilana leswi tsaneke swi faneleke ku ya kona",
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
            "xitsongaDraft": "Ku cinca ka moya hi nguva swi vula leswaku windbreak kumbe ndhawu yo byala leyi tirhaka eka nguva yin’we yi nga va yi nga ri kahle eka nguva yin’wana. Hikolaho fungha tlhelo ra moya wa ximumu ni ra vuxika hi ku hambana.",
              "reviewStatus": "machine-draft"
          }
        }
      ]
    }
  ],
  "holds": [
    {
      "lessonId": "reading-landscape-l3",
      "field": "body",
      "sourceText": "through the local frost season",
      "reason": "Preserve the full observation-season duration; during-season wording is insufficient."
    },
    {
      "lessonId": "reading-landscape-l3",
      "field": "quiz[0].rationale",
      "sourceText": "through the local frost season",
      "reason": "Preserve the full observation-season duration; during-season wording is insufficient."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "body",
      "sourceText": "trained local adviser",
      "reason": "Keep the required adviser qualification exact."
    },
    {
      "lessonId": "reading-landscape-l3",
      "field": "body",
      "sourceText": "your site's ridges and gaps",
      "reason": "Keep the site-landform terms exact until a fluent reviewer confirms the meaning."
    },
    {
      "lessonId": "reading-landscape-l3",
      "field": "body",
      "sourceText": "minimum temperatures",
      "reason": "Keep minimum-temperature terminology exact until reviewed."
    },
    {
      "lessonId": "reading-landscape-l2",
      "field": "body",
      "sourceText": "shade cloth",
      "reason": "Technical or agronomic wording remains exact English until a fluent Xitsonga reviewer can verify it."
    },
    {
      "lessonId": "reading-landscape-l4",
      "field": "body",
      "sourceText": "not to scale",
      "reason": "Keep the standard scale warning exact on a field map until reviewed."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "body",
      "sourceText": "points at the same height",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "body",
      "sourceText": "A-frame level",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "body",
      "sourceText": "contour line",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "body",
      "sourceText": "earthworks",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "body",
      "sourceText": "swale",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "body",
      "sourceText": "dam",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "body",
      "sourceText": "Soil, slope, drainage, storm flow",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "body",
      "sourceText": "erosion",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "body",
      "sourceText": "design",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "keyPoints[1]",
      "sourceText": "points at the same height",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "keyPoints[1]",
      "sourceText": "A-frame",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "keyPoints[1]",
      "sourceText": "earthworks",
      "reason": "Retain broad earthworks scope; digging soil alone narrows the source suitability warning. Independent semantic review accepted this technical English repair, not fluent approval."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "quiz[0].rationale",
      "sourceText": "drainage",
      "reason": "Retain the specific site-drainage assessment condition rather than general water movement. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "quiz[0].rationale",
      "sourceText": "storm flow",
      "reason": "Storm flow must not be narrowed to water during hailstorms. Independent semantic review accepted this technical English repair, not fluent approval."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "quiz[0].rationale",
      "sourceText": "points at the same height",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "quiz[0].rationale",
      "sourceText": "A-frame",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "quiz[0].rationale",
      "sourceText": "earthworks",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "quiz[0].options[0]",
      "sourceText": "Points at the same height along a contour",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "quiz[1].rationale",
      "sourceText": "erosion",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "quiz[1].options[0]",
      "sourceText": "slope",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "quiz[1].options[1]",
      "sourceText": "storm flow",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l2",
      "field": "body",
      "sourceText": "young citrus",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l2",
      "field": "body",
      "sourceText": "frost",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l2",
      "field": "keyPoints[3]",
      "sourceText": "young citrus",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l2",
      "field": "quiz[0].q",
      "sourceText": "young pawpaw",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l2",
      "field": "quiz[0].rationale",
      "sourceText": "frost pocket",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l3",
      "field": "body",
      "sourceText": "tender seedlings",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l3",
      "field": "body",
      "sourceText": "cold pockets",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l3",
      "field": "body",
      "sourceText": "frost damage",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l3",
      "field": "body",
      "sourceText": "Frost",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l3",
      "field": "body",
      "sourceText": "ice",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l3",
      "field": "body",
      "sourceText": "surface",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l3",
      "field": "body",
      "sourceText": "Mist",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l3",
      "field": "body",
      "sourceText": "late blight",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l3",
      "field": "quiz[0].rationale",
      "sourceText": "frost damage",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l3",
      "field": "quiz[1].q",
      "sourceText": "late blight",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l4",
      "field": "body",
      "sourceText": "frost",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l4",
      "field": "body",
      "sourceText": "design",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l4",
      "field": "body",
      "sourceText": "fences",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l4",
      "field": "quiz[0].rationale",
      "sourceText": "compaction",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l4",
      "field": "quiz[0].rationale",
      "sourceText": "design",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l4",
      "field": "quiz[1].rationale",
      "sourceText": "windbreak",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l4",
      "field": "quiz[1].options[1]",
      "sourceText": "windbreaks",
      "reason": "Exact source-bound technical English retained in a mixed unreviewed draft; surrounding ordinary prose independently checked. Facilitator review remains pending."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "body",
      "sourceText": "Its marks are an observation",
      "reason": "Narrow exact English retained to preserve the observation-versus-design distinction or any-waterworks scope; ordinary surrounding text remains an unreviewed machine draft."
    },
    {
      "lessonId": "reading-landscape-l1",
      "field": "body",
      "sourceText": "any water works for the site",
      "reason": "Narrow exact English retained to preserve the observation-versus-design distinction or any-waterworks scope; ordinary surrounding text remains an unreviewed machine draft."
    }
  ]
};

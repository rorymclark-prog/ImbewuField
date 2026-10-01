/** Source-paired Tshivenda machine draft. The learner UI shows it with its exact English source. */
export type TshivendaDraftReviewStatus = 'machine-draft' | 'hold';

export interface TshivendaSourcePair {
  sourceEnglish: string;
  tshivendaDraft: string;
  reviewStatus: TshivendaDraftReviewStatus;
}

export interface TshivendaCourseQuizDraft {
  question: TshivendaSourcePair;
  options: TshivendaSourcePair[];
  /** Answer index copied unchanged from the English source. */
  sourceCorrectIndex: number;
  rationale: TshivendaSourcePair;
}

export interface TshivendaCourseLessonDraft {
  id: string;
  infographicAlt?: TshivendaSourcePair;
  title: TshivendaSourcePair;
  body: TshivendaSourcePair;
  keyPoints: TshivendaSourcePair[];
  quiz: TshivendaCourseQuizDraft[];
}

export interface TshivendaCourseModuleDraft {
  id: string;
  language: 've';
  reviewStatus: 'machine-draft';
  sourceMetadata: { durationMins: number; category: string };
  title: TshivendaSourcePair;
  description: TshivendaSourcePair;
  lessons: TshivendaCourseLessonDraft[];
}

const pair = (sourceEnglish: string, tshivendaDraft: string): TshivendaSourcePair => ({
  sourceEnglish,
  tshivendaDraft,
  reviewStatus: 'machine-draft',
});

const hold = (sourceEnglish: string): TshivendaSourcePair => ({
  sourceEnglish,
  tshivendaDraft: sourceEnglish,
  reviewStatus: 'hold',
});

export const TSHIVENDA_INTRO_PERMACULTURE_DRAFT: TshivendaCourseModuleDraft = {
  id: "intro-permaculture",
  language: 've',
  reviewStatus: 'machine-draft',
  sourceMetadata: {
    durationMins: 20,
    category: "foundation",
  },
  title: pair(
    "Introduction to Permaculture",
    "U thomiwa ha Permaculture",
  ),
  description: pair(
    "Ethics, principles and patterns — the foundation for everything else you will build.",
    "Milayo ya vhuḓifari (ethics), maitele na mivhumbeleo (patterns) — mutheo wa zwoṱhe zwine na ḓo zwi fhaṱa.",
  ),
  lessons: [
    {
      id: "intro-permaculture-l1",
      infographicAlt: pair(
        "The three ethics as three linked circles of equal size: a hand holding soil for Earth Care, two people for People Care, and a basket passing between hands for Fair Share.",
        "Milayo miraru ya vhuḓifari sa zwitendeledzi zwiraru zwo ṱanganelanaho zwa vhuhulwane vhu no lingana: tshanḓa tsho farelaho mavu u itela u Ṱhogomela Mavu na Mupo (Earth Care), vhathu vhavhili u itela u Ṱhogomela Vhathu (People Care), na tshitundu tshi no khou fhiriselwa vhukati ha zwanḓa u itela u Kovhelana ho Fanelaho (Fair Share).",
      ),
      title: pair(
        "The Three Ethics: Earth Care, People Care, Fair Share",
        "Milayo Miraru ya Vhuḓifari: U Ṱhogomela Mavu na Mupo, U Ṱhogomela Vhathu, U Kovhelana ho Fanelaho",
      ),
      body: pair(
        "Permaculture rests on three ethics. Earth Care means treating soil, water, plants and animals as living systems to protect, not resources to use up. People Care means your family's needs come first, then your community's. Fair Share means taking only what you need and returning the surplus — seeds, food, water, knowledge — back into the system.\n\nThese aren't abstract ideas. A farmer who sells every egg and vegetable but keeps nothing back for the family table is skipping People Care. A community that fences off a shared spring is breaking Fair Share.\n\nEthics matter because they help you decide when there's no rulebook — a neighbour asking to graze cattle after a drought, a flood damaging your swales. Build these three into how you think before you build anything on the ground.",
        "Permaculture yo thewa kha milayo miraru ya vhuḓifari. U Ṱhogomela Mavu na Mupo (Earth Care) zwi amba u dzhia mavu, maḓi, zwimela na zwipuka sa maitele a no tshila a fanelaho u tsireledzwa, hu si zwiko zwine zwa fanela u fhedzwa. U Ṱhogomela Vhathu (People Care) zwi amba uri ṱhoḓea dza muṱa waṋu dzi dzia u ranga, ha kona u tevhela dza tshitshavha tsha haṋu. U Kovhelana ho Fanelaho (Fair Share) zwi amba u dzhia fhedzi zwine na zwi ṱoḓa nahone na vhuedzedza zwo salaho (surplus) — mbeu, zwiḽiwa, maḓi, nḓivho — murahu kha maitele.\n\nHezwi a si mihumbulo fhedzi i sa vhonali. Mulimi ane a rengisa makumba oṱhe na miroho yoṱhe fhedzi a si siele ṱafula ḽa muṱa tshithu u khou pfuka u Ṱhogomela Vhathu. Tshitshavha tshine tsha thivhela tshisima tshi kovhelanwaho nga lufhenḓe tshi khou pwanya u Kovhelana ho Fanelaho.\n\nMilayo ya vhuḓifari ndi ya ndeme ngauri i ni thusa u dzhia tsheo musi hu si na bugu ya milayo — muhura ane a khou humbela u fulisa kholomo nga murahu ha gomelelo, mandindi ane a khou tshinyadza dzi-swale dzaṋu. Fhaṱani hezwi zwiraru kha nḓila ine na humbula ngayo musi ni sa athu fhaṱa tshithu fhasi.",
      ),
      keyPoints: [
        pair(
          "Earth Care: protect soil, water, and biodiversity",
          "U Ṱhogomela Mavu na Mupo: tsireledzani mavu, maḓi, na u fhambana ha zwitshili (biodiversity)",
        ),
        pair(
          "People Care: your family's needs come before market production",
          "U Ṱhogomela Vhathu: ṱhoḓea dza muṱa waṋu dzi ranga zwi no bviselwa makete",
        ),
        pair(
          "Fair Share: return surplus to the system — seeds, water, food, knowledge",
          "U Kovhelana ho Fanelaho: vhuedzedzani zwo salaho kha maitele — mbeu, maḓi, zwiḽiwa, nḓivho",
        ),
        pair(
          "Ethics guide decisions when there's no rulebook",
          "Milayo ya vhuḓifari i livhisa tsheo musi hu si na bugu ya milayo",
        ),
      ],
      quiz: [
        {
          question: pair(
            "A farmer sells all his surplus maize but keeps nothing for composting or seed saving. Which ethic is he most failing?",
            "Mulimi u rengisa mavhele (maize) oṱhe o salaho fhedzi a si vhulunge tshithu u itela u ita khomposo (composting) kana u vhulunga mbeu. Ndi ufhio mulayo wa vhuḓifari une a khou u kundelwa zwihulwane?",
          ),
          options: [
            pair(
              "Earth Care only",
              "U Ṱhogomela Mavu na Mupo fhedzi",
            ),
            pair(
              "People Care only",
              "U Ṱhogomela Vhathu fhedzi",
            ),
            pair(
              "Fair Share — he returns nothing to the system",
              "U Kovhelana ho Fanelaho — ha humiseli tshithu kha maitele",
            ),
            pair(
              "All three equally",
              "Zwoṱhe zwiraru nga u lingana",
            ),
          ],
          sourceCorrectIndex: 2,
          rationale: pair(
            "Fair Share means returning some of what you take — as seed, compost, or food for others. Selling everything and keeping nothing back breaks that cycle.",
            "U Kovhelana ho Fanelaho zwi amba u vhuedzedza tshiṅwe tsha zwine na dzhia — sa mbeu, khomposo, kana zwiḽiwa zwa vhaṅwe. U rengisa zwoṱhe na u sa vhulunga tshithu murahu zwi pwanya wonoyo mudzinginyo.",
          ),
        },
        {
          question: pair(
            "Your borehole serves your household. Neighbours ask for water too. Which action best reflects all three ethics?",
            "Tshisima tshaṋu tsha borehole tshi shumela muṱa waṋu. Vhahura vha khou humbela maḓi-vho. Ndi tshifhio tshiito tshine tsha sumbedza zwavhuḓi milayo yoṱhe miraru ya vhuḓifari?",
          ),
          options: [
            pair(
              "Sell access to the highest bidder",
              "Rengisani thendelo ya u shumisa kha ane a khou badela tshelede nnzhi tshoṱhe",
            ),
            pair(
              "Keep all the borehole water for a larger irrigation area",
              "Vhulungani maḓi oṱhe a borehole u itela fhethu huhulwane ha u sheledza",
            ),
            pair(
              "Find out if sharing is allowed and if the borehole can serve all users. Only then agree how to share fairly and keep watching the water level.",
              "Wanani uri naa u kovhelana ho tendelwa na uri borehole i nga kona u shumela vhashumisi vhoṱhe. Ndi hone fhedzi ni tshi tendelana nga ha nḓila ya u kovhelana nga nḓila yo teaho nahone ni bvele phanḓa u sedza vhuimo ha maḓi.",
            ),
            pair(
              "Cap the borehole to preserve groundwater only",
              "Tibani borehole u itela u tsireledza maḓi a re nga fhasi ha mavu fhedzi",
            ),
          ],
          sourceCorrectIndex: 2,
          rationale: pair(
            "First find out what water use is allowed and whether the source can serve all users without taking too much. If sharing is allowed and there is enough water, agree how to share fairly. Monitoring helps you notice change; it does not give permission to take more water.",
            "U ranga u wana uri ndi kushumisele-ḓe kwa maḓi kwo tendelwaho na uri naa tshiko tshi nga kona u shumela vhashumisi vhoṱhe hu si na u dzhia zwinzhi lwo kalaho. Arali u kovhelana ho tendelwa nahone maḓi e o eḓana, tendelanani nga ha nḓila ya u kovhelana nga nḓila yo teaho. U sedza zwi ni thusa u vhona tshanduko; a zwi ṋei thendelo ya u dzhia maḓi manzhi.",
          ),
        },
      ],
    },
    {
      id: "intro-permaculture-l2",
      infographicAlt: pair(
        "Twelve design principles arranged as segments around a central seedling, each shown as a simple picture — an eye for observing, a droplet for catching water, a sun for energy, a loop for returning waste.",
        "Maitele a fumi na mavhili a mufhaṱo o vhekanywaho sa zwipiḓa u monymona na tshimela tshiṱuku tsha vhukati, tshiṅwe na tshiṅwe tsho sumbedzwa sa tshifanyiso tsho leluwaho — iṱo ḽa u sedza, ḓoḓi ḽa u fara maḓi, ḓuvha ḽa maanḓa, na mudzinginyo wa u vhuedzedza mitshelo na malaṱwa.",
      ),
      title: pair(
        "Twelve Principles: Designing with Nature",
        "Maitele a Fumi na Mavhili: U Ita design na Mupo",
      ),
      body: pair(
        "David Holmgren set out twelve design principles in Essence of Permaculture. Bill Mollison and David Holmgren co-originated the permaculture concept. Three useful starting points for this lesson are: observe and interact — watch your land through a full season before major earthworks; catch and store energy — notice rain, sun and biomass before they leave your property; and use edges and value the marginal — a fence line or strip beside a path can be a useful place to observe.\n\nOthers worth knowing: produce no waste (scraps become compost, compost becomes soil), use small and slow solutions (a bucket can irrigate a bed without electricity), and use and value diversity. Hail injury to maize depends on the storm and the crop’s growth stage.\n\nPick two or three principles that speak to your biggest problem and apply them hard. The rest become obvious as you go.",
        "David Holmgren o vhea maitele a design a fumi na mavhili kha Essence of Permaculture. Bill Mollison na David Holmgren vho thoma muhumbulo wa permaculture vhoṱhe. Maitele mararu a vhuedzaho u thoma ngao kha hei ngudo ndi haya: observe and interact — sedzani land yaṋu kha khalaṅwaha yoṱhe ni sa athu ita major earthworks; catch and store energy — ṱhogomelani mvula, ḓuvha na biomass zwi sa athu bva kha ndaka yaṋu; na use edges and value the marginal — muduba wa fence kana tshipiḓa tshi re tsini na nḓila (strip) tshi nga vha fhethu hu vhuedzaho ha u sedza.\n\nMaṅwe maitele ane zwa vhuedza u a ḓivha ndi haya: produce no waste (masalela a vha compost, compost ya vha mavu); use small and slow solutions (bakete ḽi nga sheledza planting bed hu si na muḓagasi); na use and value diversity. Hail injury kha maize i ya nga storm na growth stage ya crop.\n\nKhethani maitele mavhili kana mararu ane a tshimbidzana na thaidzo yaṋu khulwanesa, nahone ni a shumise nga mafulufulu. Maṅwe a ḓo tou vha khagala musi ni tshi khou bvela phanḓa.",
      ),
      keyPoints: [
        pair(
          "Observe your land for a full season before major earthworks",
          "Sedzani land yaṋu kha khalaṅwaha yoṱhe ni sa athu ita major earthworks",
        ),
        pair(
          "Catch and store rain, sun, and biomass before they leave your property",
          "Farani nahone ni vhulunge mvula, ḓuvha na biomass zwi sa athu bva kha ndaka yaṋu",
        ),
        pair(
          "Edges and margins can be useful places to observe what grows well",
          "Edges na margins zwi nga vha fhethu hu vhuedzaho ha u sedza zwine zwa aluwa zwavhuḓi",
        ),
        pair(
          "Hail injury to maize depends on the storm and the crop’s growth stage",
          "Hail injury kha maize i ya nga storm na growth stage ya crop",
        ),
      ],
      quiz: [
        {
          question: pair(
            "A farmer wants to dig swales to harvest rainwater. What should she do first, following 'observe and interact'?",
            "Mulimi u ṱoḓa u bwa swales u itela u kuvhanganya maḓi a mvula. Ndi mini zwine a fanela u ranga u zwi ita a tshi tevhedza observe and interact?",
          ),
          options: [
            pair(
              "Dig immediately after the first good rain",
              "Bwani nga u ṱavhanya nga murahu ha mvula ya u ranga yavhuḓi",
            ),
            pair(
              "Watch where water flows and pools across at least one wet season",
              "Sedzani hune maḓi a elela hone na hune a kuvhangana hone kha at least one wet season",
            ),
            pair(
              "Copy a neighbour's swale layout",
              "Kopisani kuitele kwa swale ya muhura",
            ),
            pair(
              "Assume the same swale design fits every site",
              "Humbulani uri design nthihi ya swale i lingana na site iṅwe na iṅwe",
            ),
          ],
          sourceCorrectIndex: 1,
          rationale: pair(
            "A wet season shows more than one storm, but observation is only a first step. Check the soil, slope, drainage and safe overflow route with a trained local adviser before digging.",
            "Khalaṅwaha ya mvula i sumbedza madumbu a no fhira ḽithihi, fhedzi u sedza ndi vhukando ha u ranga fhedzi. Musi ni sa athu bwa, na mueletshedzi wa henefho o gudedzwaho, tolani mavu, slope, drainage na safe overflow route.",
          ),
        },
        {
          question: pair(
            "Which layout best applies 'integrate rather than segregate'?",
            "Ndi layout ifhio ine ya shumisa zwavhuḓi integrate rather than segregate?",
          ),
          options: [
            pair(
              "Chickens penned far from the garden",
              "Khuhu dzo valelwaho kule na tsimu",
            ),
            pair(
              "Garden, fruit trees and a chicken run arranged so chickens use an empty bed after harvest, then the farmer checks safe management before edible crops return",
              "Tsimu, miri ya mitshelo na chicken run zwo vhekanywa nga nḓila ine khuhu dza shumisa planting bed i si na zwimela nga murahu ha harvest; nga murahu mulimi u tola safe management musi edible crops dzi sa athu vhuya",
            ),
            pair(
              "Separate paddocks for each crop",
              "Paddocks dzo fhambanaho dza crop iṅwe na iṅwe",
            ),
            pair(
              "All animals kept off the cultivated zone",
              "Zwifuwo zwoṱhe zwi dzule nnḓa ha cultivated zone",
            ),
          ],
          sourceCorrectIndex: 1,
          rationale: pair(
            "Integration puts each element to work for its neighbours — here, chickens clean up pests and add fertility instead of sitting idle in a fixed pen. Fresh manure can carry germs, so check safe management before edible crops return.",
            "Integration i ita uri element iṅwe na iṅwe i shumele zwine zwa vha tsini nayo — hafha, khuhu dzi clean up pests na u engedza fertility, nṱhani ha u dzula dzi sa shumi kha fixed pen. Fresh manure i nga hwalela germs, ngauralo tola safe management musi edible crops dzi sa athu vhuya.",
          ),
        },
      ],
    },
    {
      id: "intro-permaculture-l3",
      // The earlier draft described rings that the replacement picture does not show.
      infographicAlt: hold("Illustrated example farm: numbered markers 0 to 5 follow a winding footpath from the house and near garden, past chickens and a field, toward trees and a wilder riverside area. The markers are examples, not fixed boundaries or distances."),
      title: pair(
        "Zones and Sectors: Organising Your Farm by Energy",
        "Zoune na Sekithara: U Dzudzanya Bulasi Yaṋu nga Maanḓa",
      ),
      // Keep field observations paired to their exact source while the Tshivenda prose remains a marked review draft.
      body: pair(
        "Zones and sectors help you cut wasted labour. Zones run 0 to 5 by how often you visit. Zone 0 is the house. In this example, Zone 1 is near the house and holds what you pick often — herbs, salad greens. Zone 2 is the main garden and chicken run, visited once or twice a day. Zone 3 is the main field, visited weekly. Zone 4 is semi-wild — fruit trees and fodder needing occasional attention. Zone 5 is left wild.\n\nSectors are the energies arriving from outside — sun, wind, rain, flood, fire. Watch where strong wind comes from on your farm. Nearby weather-station records can help you check wind direction. Watch where rainwater enters and flows across your land. Draw arrows for what you observe.\n\nSketch zones and sectors on paper and you have the skeleton of your design.",
        "Zones na sectors zwi thusa u fhungudza mushumo u sa ṱoḓei. Zones dzi bva kha 0 u ya kha 5, zwi tshi tevhedza uri ni dalela fhethu honoho lunzhi-lini. Zone 0 ndi nnḓu. Kha tsumbo iyi, Zone 1 i tsini na nnḓu nahone i na zwine na zwi ka lunzhi — herbs na muroho wa saladi. Zone 2 ndi serapa tshihulwane na chicken run, zwine zwa dalelwa luthihi kana luvhili nga ḓuvha. Zone 3 ndi tsimu khulwane, ine ya dalelwa vhege iṅwe na iṅwe. Zone 4 ndi semi-wild — miri ya mitshelo na fodder zwine zwa ṱoḓa ṱhogomelo nga zwiṅwe zwifhinga. Zone 5 yo siwa i wild.\n\nSectors ndi energy dzi no swika dzi tshi bva nnḓa — ḓuvha, muya, mvula, mandindi na mulilo. Sedzani hune muya u re na maanḓa wa bva hone bulasini yaṋu. Rekhodo dza weather station ya tsini dzi nga thusa u sedza thungo ya muya. Sedzani hune maḓi a mvula a dzhena hone na hune a elela hone kha land yaṋu. Olani misevhe u sumbedza zwe na zwi vhona.\n\nOlani zones na sectors kha bammbiri, nahone ni vha ni na motheo wa pulane yaṋu.",
      ),
      keyPoints: [
        pair(
          "In this example, Zone 1 near the house holds often-picked herbs",
          "Kha tsumbo iyi, Zone 1 i re tsini na nnḓu i na herbs dzine na dzi ka lunzhi.",
        ),
        pair(
          "Zones organise labour by how often you need to visit",
          "Zoune dzi dzudzanya mishumo nga nḓila ine na fanela u dalela ngayo",
        ),
        pair(
          "Sectors map incoming sun, wind, rainwater, flood and fire",
          "Sekithara dzi ita mmapa wa ḓuvha ḽi no ḓa, muya, maḓi a mvula, mandindi na mulilo",
        ),
        pair(
          "A simple sketch of zones and sectors is enough to start designing",
          "Nyolo yo leluwaho ya zones na sectors yo lingana u thoma design.",
        ),
      ],
      quiz: [
        {
          question: pair(
            "You plant herbs in Zone 3, the main field far from the house. What problem does this create?",
            "Ni ṱavha herbs kha Zone 3, tsimu khulwane i re kule na nnḓu. Hezwi zwi vhanga thaidzo-ḓe?",
          ),
          options: [
            pair(
              "Herbs grow too large",
              "Herbs dzi aluwa zwihulwane lwo kalaho",
            ),
            pair(
              "The extra walk may mean you pick or check them less often",
              "Lwendo lwo engedzeaho lu nga amba uri ni nga ka kana u sedza herbs less often",
            ),
            pair(
              "Herbs cross-pollinate with main crops",
              "Herbs dzi cross-pollinate na zwimela zwihulwane",
            ),
            pair(
              "Zone 3 gets too much sun for herbs",
              "Zone 3 i wana ḓuvha ḽinzhi lwo kalaho kha herbs",
            ),
          ],
          sourceCorrectIndex: 1,
          rationale: pair(
            "Put a crop you pick often near a daily path. A distant bed adds walking and may be checked less often.",
            "Vheani tshimela tshine na tshi ka lunzhi tsini ha nḓila ya ḓuvha ḽiṅwe na ḽiṅwe. Bed i re kule i engedza u tshimbila nahone i nga tolwa less often.",
          ),
        },
        {
          // Keep the observed north-west condition paired with its boundary answer and rationale.
          question: pair(
            "You observe damaging wind coming from the north-west on a Highveld farm. Where should a windbreak go?",
            "Musi ni tshi vhona “damaging wind coming from the north-west on a Highveld farm”, windbreak i fanela u vhewa ngafhi?",
          ),
          options: [
            pair(
              "South-east boundary",
              "Moedi wa South-east",
            ),
            pair(
              "North-west boundary, between the wind and the crops",
              "Moedi wa North-west, vhukati ha muya na zwimela",
            ),
            pair(
              "Centre of the property",
              "Vhukati ha land yaṋu",
            ),
            pair(
              "Windbreaks aren't needed since winds are seasonal",
              "Windbreaks a dzi ṱoḓei ngauri mimuya i ya nga khalaṅwaha",
            ),
          ],
          sourceCorrectIndex: 1,
          rationale: pair(
            "A windbreak works by standing between the wind source and what it would damage — so it belongs on the side the wind actually comes from.",
            "Windbreak i shuma nga u ima vhukati ha hune muya wa bva hone na tshine ya nga tshi tshinya — ngauralo i fanela u vha kha sia ḽine muya wa bva khaḽo zwa vhukuma.",
          ),
        },
      ],
    },
  ],
};

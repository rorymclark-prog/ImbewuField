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
        "Maitele a Fumi na Mavhili: U Fhaṱa na Mupo",
      ),
      body: hold(
        "David Holmgren set out twelve design principles in Essence of Permaculture. Bill Mollison and David Holmgren co-originated the permaculture concept. Three useful starting points for this lesson are: observe and interact — watch your land through a full season before major earthworks; catch and store energy — notice rain, sun and biomass before they leave your property; and use edges and value the marginal — a fence line or strip beside a path can be a useful place to observe.\n\nOthers worth knowing: produce no waste (scraps become compost, compost becomes soil), use small and slow solutions (a bucket can irrigate a bed without electricity), and use and value diversity. Hail injury to maize depends on the storm and the crop’s growth stage.\n\nPick two or three principles that speak to your biggest problem and apply them hard. The rest become obvious as you go.",
      ),
      keyPoints: [
        pair(
          "Observe your land for a full season before major earthworks",
          "Sedzani mavu aṋu tshifhinga tshoṱhe tsha khalaṅwaha musi ni sa athu ita mishumo mihulwane ya mavu",
        ),
        pair(
          "Catch and store rain, sun, and biomass before they leave your property",
          "Farani nahone ni vhulunge mvula, ḓuvha, na biomass musi zwi sa athu bva tshitentsini tshaṋu",
        ),
        pair(
          "Edges and margins can be useful places to observe what grows well",
          "Magumo na thungo zwi nga vha fhethu hu no vhuedza ha u sedza zwine zwa aluwa zwavhuḓi",
        ),
        pair(
          "Hail injury to maize depends on the storm and the crop’s growth stage",
          "Tshenyo ya tshifhango kha mavhele (maize) i bva kha dumbu na vhuimo ha u aluwa ha zwimela",
        ),
      ],
      quiz: [
        {
          question: pair(
            "A farmer wants to dig swales to harvest rainwater. What should she do first, following 'observe and interact'?",
            "Mulimi u ṱoḓa u bwa dzi-swale u itela u kuvhanganya maḓi a mvula. Ndi mini zwine a fanela u ranga u zwi ita a tshi tevhedza 'sedzani nahone ni shumisane' (observe and interact)?",
          ),
          options: [
            pair(
              "Dig immediately after the first good rain",
              "Bwani nga u ṱavhanya nga murahu ha mvula ya u ranga yavhuḓi",
            ),
            hold(
              "Watch where water flows and pools across at least one wet season",
            ),
            pair(
              "Copy a neighbour's swale layout",
              "Kopisani kuitele kwa dzi-swale dza muhura",
            ),
            pair(
              "Assume the same swale design fits every site",
              "Humbulani uri muvhumbeleo muthihi wa swale u lingana fhethu hoṱhe",
            ),
          ],
          sourceCorrectIndex: 1,
          rationale: pair(
            "A wet season shows more than one storm, but observation is only a first step. Check the soil, slope, drainage and safe overflow route with a trained local adviser before digging.",
            "Khalaṅwaha ya mvula i sumbedza madumbu a no fhira ḽithihi, fhedzi u sedza ndi vhukando ha u ranga fhedzi. Tolani mavu, u sendama ha mavu (slope), u elela ha maḓi (drainage) na gondo ḽo tsireledzeaho ḽa maḓi o kalaho na mueletshedzi wa henefho o gudedzwaho musi ni sa athu bwa.",
          ),
        },
        {
          question: pair(
            "Which layout best applies 'integrate rather than segregate'?",
            "Ndi ufhio muvhumbeleo une wa shumisa zwavhuḓi 'ṱanganyani u fhira u fhambanya' (integrate rather than segregate)?",
          ),
          options: [
            pair(
              "Chickens penned far from the garden",
              "Khuhu dzo valelwaho kule na tsimu",
            ),
            pair(
              "Garden, fruit trees and a chicken run arranged so chickens use an empty bed after harvest, then the farmer checks safe management before edible crops return",
              "Tsimu, miri ya mitshelo na danga ḽa khuhu zwo vhekanywaho uri khuhu dzi shumise ndima i si na tshithu nga murahu ha khaṋo, mulimi a kona u tola ndaulo yo tsireledzeaho musi zwimela zwi ḽiwaho zwi sa athu vhuya",
            ),
            pair(
              "Separate paddocks for each crop",
              "Zwipiḓa zwo fhambanaho zwa tshimela tshiṅwe na tshiṅwe",
            ),
            pair(
              "All animals kept off the cultivated zone",
              "Zwipuka zwoṱhe zwo thivhelwa kule ha fhethu hu no khou limiwa",
            ),
          ],
          sourceCorrectIndex: 1,
          rationale: pair(
            "Integration puts each element to work for its neighbours — here, chickens clean up pests and add fertility instead of sitting idle in a fixed pen. Fresh manure can carry germs, so check safe management before edible crops return.",
            "U ṱanganya zwi ita uri tshipiḓa tshiṅwe na tshiṅwe tshi shumele vhahura vhatsho — hafha, khuhu dzi laṱa zwikhokhonono nahone dza nontshisa mavu nṱhani ha u dzula zwo ralo dangani ḽo imaho. Manyaga maswa a nga hwalela zwitzhili, nga zwenezwo tolani ndaulo yo tsireledzeaho musi zwimela zwi ḽiwaho zwi sa athu vhuya.",
          ),
        },
      ],
    },
    {
      id: "intro-permaculture-l3",
      infographicAlt: pair(
        "Rings spreading outward from a house. The ring closest to the door is tended every day; each ring further out is visited less often and left wilder.",
        "Maringi a no ṱanḓavhuwa u bva nnḓuni u ya nnḓa. Ringi ḽi re tsini tsini na vothi ḽi ṱhogomelwa ḓuvha ḽiṅwe na ḽiṅwe; ringi ḽiṅwe na ḽiṅwe ḽi re kule ḽi dalelwa lwa si gathi nahone ḽa siilwa ḽo fana na ḓaka.",
      ),
      title: pair(
        "Zones and Sectors: Organising Your Farm by Energy",
        "Zoune na Sekithara: U Dzudzanya Bulasi Yaṋu nga Maanḓa",
      ),
      body: hold(
        "Zones and sectors help you cut wasted labour. Zones run 0 to 5 by how often you visit. Zone 0 is the house. In this example, Zone 1 is near the house and holds what you pick often — herbs, salad greens. Zone 2 is the main garden and chicken run, visited once or twice a day. Zone 3 is the main field, visited weekly. Zone 4 is semi-wild — fruit trees and fodder needing occasional attention. Zone 5 is left wild.\n\nSectors are the energies arriving from outside — sun, wind, rain, flood, fire. Watch where strong wind comes from on your farm. Nearby weather-station records can help you check wind direction. Watch where rainwater enters and flows across your land. Draw arrows for what you observe.\n\nSketch zones and sectors on paper and you have the skeleton of your design."
      ),
      keyPoints: [
        pair(
          "In this example, Zone 1 near the house holds often-picked herbs",
          "Kha tsumbo iyi, Zoune 1 i re tsini na nnḓu i fara zwilavhele zwine zwa kiwa lunzhi",
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
          "Muolo wo leluwaho wa zoune na sekithara wo lingana u thoma mufhaṱo",
        ),
      ],
      quiz: [
        {
          question: pair(
            "You plant herbs in Zone 3, the main field far from the house. What problem does this create?",
            "Ni ṱavha zwilavhele kha Zoune 3, tsimu khulwane i re kule na nnḓu. Hezwi zwi vhanga thaidzo-ḓe?",
          ),
          options: [
            pair(
              "Herbs grow too large",
              "Zwilavhele zwi aluwa zwihulwane lwo kalaho",
            ),
            pair(
              "The extra walk may mean you pick or check them less often",
              "Lwendo lwo engedzeaho lu nga amba uri ni zwi ka kana u zwi tola lwa si gathi",
            ),
            pair(
              "Herbs cross-pollinate with main crops",
              "Zwilavhele zwi ṱanganyisa mbeu (cross-pollinate) na zwimela zwihulwane",
            ),
            pair(
              "Zone 3 gets too much sun for herbs",
              "Zoune 3 i wana ḓuvha ḽinzhisa kha zwilavhele",
            ),
          ],
          sourceCorrectIndex: 1,
          rationale: pair(
            "Put a crop you pick often near a daily path. A distant bed adds walking and may be checked less often.",
            "Vheani tshimela tshine na tshi ka lunzhi tsini ha nḓila ya ḓuvha ḽiṅwe na ḽiṅwe. Ndima i re kule i engedza u tshimbila nahone i nga tolwa lwa si gathi.",
          ),
        },
        {
          question: hold(
            "You observe damaging wind coming from the north-west on a Highveld farm. Where should a windbreak go?"
          ),
          options: [
            pair(
              "South-east boundary",
              "Mukano wa tshipembe-vhubvaḓuvha (south-east)",
            ),
            hold(
              "North-west boundary, between the wind and the crops"
            ),
            pair(
              "Centre of the property",
              "Vhukati ha tshitentsi",
            ),
            pair(
              "Windbreaks aren't needed since winds are seasonal",
              "Zwithivhela-muya a zwi ṱoḓei ngauri mimiya ndi ya zwifhinga zwa khalaṅwaha",
            ),
          ],
          sourceCorrectIndex: 1,
          rationale: pair(
            "A windbreak works by standing between the wind source and what it would damage — so it belongs on the side the wind actually comes from.",
            "Tshithivhela-muya tshi shuma nga u ima vhukati ha tshiko tsha muya na zwine zwa nga tshinyala — ngauralo tshi fanela u vha kha thungo ine muya wa khou bva khayo.",
          ),
        },
      ],
    },
  ],
};

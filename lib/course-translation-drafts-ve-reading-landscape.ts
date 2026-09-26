/** Unpublished, source-paired Tshivenda draft for Reading the Landscape. */
import type { TshivendaCourseModuleDraft, TshivendaSourcePair } from './course-translation-drafts-ve.ts';

const pair = (sourceEnglish: string, tshivendaDraft: string, reviewStatus: TshivendaSourcePair['reviewStatus'] = 'machine-draft'): TshivendaSourcePair => ({
  sourceEnglish,
  tshivendaDraft,
  reviewStatus,
});

const hold = (sourceEnglish: string): TshivendaSourcePair => ({
  sourceEnglish,
  tshivendaDraft: sourceEnglish,
  reviewStatus: 'hold',
});

export const TSHIVENDA_READING_LANDSCAPE_DRAFT: TshivendaCourseModuleDraft = {
  id: 'reading-landscape',
  language: 've',
  reviewStatus: 'machine-draft',
  sourceMetadata: {
    durationMins: 25,
    category: 'design',
  },
  title: pair(
    "Reading the Landscape",
    "U Vhala Muvhumbeleo wa Mavu na Mupo (Reading the Landscape)",
  ),
  description: pair(
    "Identify water flow, sun angles, wind patterns and topography on your site.",
    "Ṱhogomelani u elela ha maḓi, dzi-angle dza ḓuvha, maitele a muya na muvhumbeleo wa fhethu (topography) kha tshitentsi tshaṋu.",
  ),
  lessons: [
    {
      id: "reading-landscape-l1",
      infographicAlt: pair(
        "A hillside seen from the side, with arrows showing where rain runs down the slope, where it collects in a hollow, and where it soaks in as the ground flattens.",
        "Thungo ya thavha i re thungo, i na misevhe i sumbedzaho hune mvula ya elela fhasi kha mukonḓo (slope), hune ya kuvhangana hone kha mulindi, na hune ya nwela hone kha mavu musi fhasi ho vha luvhande.",
      ),
      title: pair(
        "Understanding Water Flow: Where Rain Goes on Your Land",
        "U Pfesesa u Elela ha Maḓi: Hune Mvula ya Ya Hone Muvuni waṋu",
      ),
      body: hold(
"Before you harvest water, learn where it already goes. Watch from a safe place during heavy rain. When it is safe afterward, walk your land. Look for rills, places where water fans out, where it ponds, and where it leaves your property. Some excess water needs a safe route away so it does not cause damage.\n\nAn A-frame level can help you mark points at the same height and trace a contour line. Its marks are an observation, not a design or approval for earthworks. Before digging a swale, dam, or other structure, have the site assessed. Soil, slope, drainage, storm flow, and a safe overflow route all matter. Ask a trained local adviser.\n\nThere is no one placement rule for every slope. Observe where water moves and gathers. Poorly laid contours can increase erosion, and soil that takes in water slowly can hold too much. Choose any water works for the site and plan a safe route for excess water.",
      ),
      keyPoints: [
        pair(
          "Watch from a safe place during rain, then walk the land when it is safe",
          "Sedzani ni fhethu ho tsireledzeaho musi hu tshi na mvula, nahone ni tshimbile muvuni musi zwo no tsireledzea",
        ),
        hold(
"An A-frame can mark points at the same height, but it does not show whether earthworks are suitable",
      ),
        pair(
          "Water works and safe overflow routes need a site assessment",
          "Mishumo ya maḓi na nḓila dzo tsireledzeaho dza u bva ha maḓi a tsalelo (safe overflow routes) zwi ṱoḓa u toliwa ha tshitentsi",
        ),
        pair(
          "Some excess water needs a safe route away to prevent damage",
          "Maḓi maṅwe a re manzhisa a ṱoḓa nḓila yo tsireledzeaho ya u bva u thivhela tshenyo",
        ),
      ],
      quiz: [
        {
          question: pair(
            "What can an A-frame level help you find?",
            "Level ya A-frame i nga ni thusa u wana mini?",
          ),
          options: [
            hold(
"Points at the same height along a contour",
      ),
            pair(
              "Whether a swale is safe to build on this slope",
              "Arali swale yo tsireledzea u fhaṱwa kha hoyu mukonḓo (slope)",
            ),
            hold(
"How much stormwater the soil can absorb",
      ),
            pair(
              "Where a dam spillway should be built",
              "Hune tshiitavhuyo (spillway) tsha damu tsha fanela u fhaṱwa hone",
            ),
          ],
          sourceCorrectIndex: 0,
          rationale: hold(
"An A-frame can help mark points at the same height. It does not assess soil, drainage, storm flow, or whether earthworks are suitable.",
      ),
        },
        {
          question: pair(
            "You observe fast runoff on a sloped KZN site. What should you do before digging a water structure?",
            "Ni vhona u elela ha maḓi ho ṱavhanyaho kha tshitentsi tshi re na mukonḓo KZN. Ni fanela u ita mini musi ni sa athu gweva tshifhaṱo tsha maḓi?",
          ),
          options: [
            pair(
              "Put it as high on the slope as possible",
              "Tshi vheeni nṱha nga hune zwa konadzea ngaho kha mukonḓo (slope)",
            ),
            pair(
              "Check the soil, slope, drainage and storm flow, and plan a safe overflow with a trained local adviser",
              "Tolani mavu, mukonḓo (slope), u bva ha maḓi na u elela ha dumbu, nahone ni pulane nḓila yo tsireledzeaho ya u bva ha maḓi (safe overflow) na mutoli wa henefho o gudiswaho (trained local adviser)",
            ),
            pair(
              "Put it wherever water first appears",
              "Tshi vheeni hoṱhe hune maḓi a thoma u vhonala hone",
            ),
            pair(
              "Follow the same high, middle and bottom rule used on other farms",
              "Tevhelani mulayo muthihi wa nṱha, vhukati na fhasi u shumiswaho kha maṅwe mapfamo",
            ),
          ],
          sourceCorrectIndex: 1,
          rationale: pair(
            "A placement rule cannot show whether a structure suits the site. Poorly laid contours can increase erosion, and excess water needs a safe route.",
            "Mulayo wa fhethu a u koni u sumbedza arali tshifhaṱo tsho fanela tshitentsi. Dzi-contour dzo vhewaho lwo khakheaho dzi nga engedza mugumelo wa mavu (erosion), nahone maḓi maṅwe a re manzhisa a ṱoḓa nḓila yo tsireledzeaho.",
          ),
        },
      ],
    },
    {
      id: "reading-landscape-l2",
      infographicAlt: pair(
        "A slope with the sun in the north. Shadows from the building and the tree fall south, down the slope.",
        "Mukonḓo (slope) u re na ḓuvha devhula (north). Mirunzi i bvaho kha tshifhaṱo na muri i wela tshipembe (south), u tsa mukonḓo.",
      ),
      title: pair(
        "Sun Angles, Shade, and Aspect: Getting the Most from Sunlight",
        "Dzi-angle dza Ḓuvha, Murunzi, na Tshivhumbeleo tsha Mupo (Aspect): U Wana Zwinzhi kha Tshedza tsha Ḓuvha",
      ),
      body: pair(
        "In much of South Africa, especially in winter, the sun is to the north. Its path changes with the season and your location. North-facing slopes often receive more sun and can be warmer and drier. South-facing slopes are often cooler and moister. Frost can collect in low hollows where cold air settles. Watch your own site before choosing where to plant tender crops or place buildings.\n\nWinter sun is lower and farther north than summer sun. A wall or shade cloth can shade a bed longer in winter than in summer. Before placing anything permanent, stand in the spot at 8am, midday, and 4pm on a winter's day and watch where the shade falls.\n\nPawpaw and young citrus are sensitive to frost. Keep tender plants out of known low frost pockets. Observe local frost before planting.",
        "Kha zwipiḓa zwinzhi zwa South Africa, zwiholisesa vhuriga (winter), ḓuvha ḽi vha ḽi devhula (north). Nḓila yaḽo i shanduka hu tshi tevhedzwa khalanwaha na vhuimo haṋu. Mikonḓo yo lavhelesaho devhula (north-facing slopes) lunzhi i wana ḓuvha ḽinzhisa nahone i nga duderana ya dovha ya oma. Mikonḓo yo lavhelesaho tshipembe (south-facing slopes) lunzhi i fhola ya vha na vhunyisi. Vhurontho/tshiṱaṱha (frost) tshi nga kuvhangana kha milindi i re fhasi hune muya wo rotholaho wa dzula hone. Ṱhogomelani tshitentsi tshaṋu musi ni sa athu nanga hune na ḓo ṱavha zwimela zwi sa konḓeleliho vhurontho (tender crops) kana u vhea zwifhaṱo.\n\nḒuvha ḽa vhuriga ḽi fhasi nahone ḽi kule devhula u fhira ḓuvha ḽa tshilimo. Luvhondo kana lilaṱa ḽa murunzi (shade cloth) zwi nga thivhela ndima lwa tshifhinga tshilapfu vhuriga u fhira tshilimo. Musi ni sa athu vhea tshithu tshi sa rembuluswi, imani henefho fhethu nga 8am, masiari, na 4pm nga ḓuvha ḽa vhuriga nahone ni sedze hune murunzi wa wela hone.\n\nPawpaw na citrus ṱhukhu zwi tshinyadzwa lwo leluwaho nga vhurontho (frost). Ivhani kule ha zwimela zwi sa konḓeleliho fhethu ho ḓoweleaho ha milindi ya vhurontho (frost pockets). Ṱhogomelani vhurontho ha henefho musi ni sa athu ṱavha.",
      ),
      keyPoints: [
        pair(
          "North-facing slopes often get more direct sun; south-facing slopes are often cooler and moister",
          "Mikonḓo yo lavhelesaho devhula lunzhi i wana ḓuvha ḽa thwii ḽinzhisa; mikonḓo yo lavhelesaho tshipembe lunzhi i a fhola ya dovha ya vha na vhunyisi",
        ),
        hold(
"Winter sun is lower and farther north; check local shade before building",
      ),
        pair(
          "Cold air can collect in low hollows; aspect is only one site factor",
          "Muya wo rotholaho u nga kuvhangana kha milindi i re fhasi; tshivhumbeleo tsha thungo (aspect) ndi tshiṅwe fhedzi tsha zwithu zwa tshitentsi",
        ),
        pair(
          "Check local frost before placing tender pawpaw or young citrus",
          "Tolani vhurontho (frost) ha henefho musi ni sa athu vhea pawpaw i sa konḓeleliho kana citrus ṱhukhu",
        ),
      ],
      quiz: [
        {
          question: pair(
            "Where should a farmer first look for a frost-tender young pawpaw on a Highveld smallholding?",
            "Mulimi u fanela u thoma u sedza ngafhi u itela pawpaw ṱhukhu i sa konḓeleliho vhurontho (frost-tender) kha tshitentsi tshiṱuku tsha Highveld?",
          ),
          options: [
            pair(
              "The lowest point where cold air collects",
              "Fhethu ho tsaho tshoṱhe hune muya wo rotholaho wa kuvhangana hone",
            ),
            pair(
              "A cold, shaded hollow",
              "Mulindini wo rotholaho, u re na murunzi",
            ),
            pair(
              "A sunny spot outside a known frost hollow, after checking the site's frost pattern",
              "Fhethu hu re na ḓuvha nnda ha mulindi wo ḓoweleaho wa vhurontho (frost hollow), nga murahu ha u tola maitele a vhurontho kha tshitentsi",
            ),
            pair(
              "A position chosen without checking the site",
              "Vhuimo ho nangiwaho hu songo toliwa tshitentsi",
            ),
          ],
          sourceCorrectIndex: 2,
          rationale: pair(
            "Cold air can collect in low places. A sunnier site outside a known frost pocket may reduce risk, but local frost observations must guide the final position.",
            "Muya wo rotholaho u nga kuvhangana fhethu ho tsaho. Fhethu hu re na ḓuvha nnda ha mulindi wo ḓoweleaho wa vhurontho (frost pocket) hu nga fhungudza khombo, fhedzi ṱhogomelo dza vhurontho ha henefho dzi fanela u livhisa vhuimo ha u fhedzisela.",
          ),
        },
        {
          question: hold(
"A farmer plans shade cloth on the north side of her garden. What should she check before fixing it in place?",
      ),
          options: [
            pair(
              "Where its shadow falls on the bed in winter",
              "Hune murunzi waḽo wa wela hone ndimani nga vhuriga",
            ),
            pair(
              "Whether it redirects frost away",
              "Arali ḽi tshi fhirisela vhurontho (frost) kule",
            ),
            pair(
              "Whether the sun is always overhead at noon",
              "Arali ḓuvha ḽi tshi dzula ḽi nṱha ha ṱhoho masiari vhukati",
            ),
            pair(
              "Only whether it reduces summer evaporation",
              "Fhedzi arali ḽi tshi fhungudza u fhufha ha maḓi (evaporation) nga tshilimo",
            ),
          ],
          sourceCorrectIndex: 0,
          rationale: pair(
            "Winter sun is lower and farther north. Shade cloth can change the hours of sun on a bed. Check the actual shadows at 8am, midday, and 4pm before fixing it in place.",
            "Ḓuvha ḽa vhuriga ḽi fhasi nahone ḽi kule devhula. Lilaṱa ḽa murunzi (shade cloth) ḽi nga shandukisa awara dza ḓuvha ndimani. Tolani mirunzi ya vhukuma nga 8am, masiari, na 4pm musi ni sa athu ḽi vhea fhethu.",
          ),
        },
      ],
    },
    {
      id: "reading-landscape-l3",
      infographicAlt: pair(
        "A farm from above with arrows showing wind direction, cold air draining downhill into a frost hollow, and the direction of the slope.",
        "Bulasi i vhonwaho i nṱha i na misevhe i sumbedzaho thungo ya muya, muya wo rotholaho u tshi tsa thavhani u tshi ya mulindini wa vhurontho (frost hollow), na thungo ya mukonḓo (slope).",
      ),
      title: pair(
        "Wind, Frost, and Topography: Reading the Invisible Forces",
        "Muya, Vhurontho (Frost), na Muvhumbeleo wa Mavu: U Vhala Maanḓa a sa Vhonali",
      ),
      body: hold(
"Wind can damage crops on a smallholding. The direction and strength of damaging wind change with region, season and your site's ridges and gaps. Walk the land on windy days. Record where the wind comes from and what it affects. Check local weather records before deciding where shelter is needed.\n\nOn a clear, still night, cold air can flow downhill and collect in low places. These places can be colder than nearby slopes. Frost patterns also depend on the site. Compare candidate places through the local frost season. Check local minimum-temperature records where available. If records are not available, keep observing across cold nights and ask a local agriculture adviser before choosing a permanent home for tender seedlings.\n\nFrost is ice that forms on a cold surface. Mist alone does not show that ice has formed, and frost damage can happen without visible ice. Look for ice and plant damage, compare low ground with slopes, and check minimum temperatures where you can. Mark places where cold or damage lasts longest. Keep sensitive plants away from the cold pockets you observe.\n\nFor tomatoes troubled by late blight, airflow and morning sun can help leaves dry. Late blight can still spread during prolonged cool, damp weather. Moving a bed alone will not control it; seek local crop-health guidance too.",
      ),
      keyPoints: [
        pair(
          "Observe damaging wind direction on your site before placing shelter",
          "Ṱhogomelani thungo ya muya u tshinyadzaho kha tshitentsi tshaṋu musi ni sa athu vhea tsireledzo",
        ),
        hold(
"Cold air can drain downhill on clear, still nights and collect in low ground",
      ),
        pair(
          "Compare cold-night plant damage and temperatures across your site; visible frost is not the only sign",
          "Vhambedzani tshenyo ya zwimela ya vhusiku vhu rotholaho na mufhiso kha tshitentsi tshaṋu; vhurontho (frost) vhu vhonalaho a si tshone fhedzi tshiswayo",
        ),
        pair(
          "Airflow and drying may help reduce wet leaves, but do not alone control late blight",
          "U elela ha muya na u oma zwi nga thusa u fhungudza maṱari a re na maḓi, fhedzi zwi zwoṱhe a zwi langi late blight",
        ),
      ],
      quiz: [
        {
          question: pair(
            "Where should a farmer first look when placing a frost-sensitive seedling nursery on a Highveld smallholding?",
            "Mulimi u fanela u thoma u sedza ngafhi musi a tshi vhea vhudzulo ha mbeu dzi sa konḓeleliho vhurontho kha tshitentsi tshiṱuku tsha Highveld?",
          ),
          options: [
            pair(
              "A known frost hollow at the valley bottom",
              "Mulindi wo ḓoweleaho wa vhurontho (frost hollow) fhasi kheleleni",
            ),
            pair(
              "An exposed ridgeline without checking the wind",
              "Mutumba wo vuleaho hu songo toliwa muya",
            ),
            pair(
              "A sunny, sheltered place outside an observed frost hollow, after checking the site's cold-night pattern",
              "Fhethu hu re na ḓuvha, ho tsireledzeaho nnda ha mulindi wa vhurontho wo vhonwaho, nga murahu ha u tola maitele a vhusiku vhu rotholaho kha tshitentsi",
            ),
            pair(
              "The place with the most shade, without checking frost",
              "Fhethu hu re na murunzi munzhisa, hu songo toliwa vhurontho",
            ),
          ],
          sourceCorrectIndex: 2,
          rationale: hold(
"Cold air can settle in low places on clear, still nights. Compare candidate nursery sites through the local frost season. Check local minimum-temperature records or ask a local agriculture adviser before making a permanent choice. Visible frost is not the only sign of frost damage, and no hillside position guarantees freedom from frost.",
      ),
        },
        {
          question: pair(
            "A KZN farmer's tomatoes repeatedly develop late blight during cool, damp spells. Which bed position may help leaves dry, alongside local crop-health advice?",
            "Matamati (tomatoes) a mulimi wa KZN a bvela phanḓa u vha na late blight kha zwifhinga zwo rotholaho, zwi re na vhunyisi. Ndi vhuimo vhufhio ha ndima vhune ha nga thusa maṱari u oma, hu tshi tevhedzwa na nyeletshedzo dza mutakalo wa zwimela dza henefho?",
          ),
          options: [
            pair(
              "A sealed, unventilated tunnel",
              "Bani ḽo valeaho, ḽi si na muya (unventilated tunnel)",
            ),
            pair(
              "A place with good airflow and morning sun",
              "Fhethu hu re na u elela ha muya ho nakaho na ḓuvha ḽa matsheloni",
            ),
            pair(
              "A low spot near a dam",
              "Fhethu ho tsaho tsini ha damu",
            ),
            pair(
              "A shaded south wall",
              "Luvhondo lwo lavhelesaho tshipembe (south) lu re na murunzi",
            ),
          ],
          sourceCorrectIndex: 1,
          rationale: hold(
"Airflow and morning sun can help leaves dry. Late blight is favoured by prolonged cool, damp weather, and moving the bed alone is not a complete control plan.",
      ),
        },
      ],
    },
    {
      id: "reading-landscape-l4",
      infographicAlt: pair(
        "A hand-drawn site map on paper showing north, the buildings, the water, and the boundary — rough, as a farmer would draw it.",
        "Mmepe wa tshitentsi (site map) wo olwaho nga tshanḓa baphani u sumbedzaho devhula (north), zwifhaṱo, maḓi, na mukano — zwi songo vhudzwaho, sa zwine mulimi a nga zwi ola ngaho.",
      ),
      title: pair(
        "Making a Simple Site Map: Your Design Starts on Paper",
        "U Ita Mmepe wo Lelewaho wa Tshitentsi (Site Map): Nyolo yaṋu i Thoma Baphani",
      ),
      body: pair(
        "A site map needs paper, a tape measure, a compass, and time to walk your land. Walk the boundary and make a first sketch. Mark it 'not to scale' until you have checked its distances. Mark north. Add the house, trees, water, roads, fences. Draw arrows for summer and winter wind, shade patterns, and where water flows in rain.\n\nNote where frost sits longest, where the ground smells damp in dry months, and where khakibos or blackjack grow thick. These plants can grow in disturbed places, but their presence alone does not show whether soil is compacted. Check the soil before deciding what the patch means for your design.\n\nOverlay your zones and sectors on the same sketch. Update it season by season. A pencil sketch you actually use is worth more than a perfect one drawn once.",
        "Mmepe wa tshitentsi (site map) u ṱoḓa bapha, theiphi yo kalaho (tape measure), khamphasi (compass), na tshifhinga tsha u tshimbila muvuni waṋu. Tshimbilani mukanoni nahone ni ite nyolo ya u thoma. I swayeni 'not to scale' u swikela ni tshi tola vhukule hayo. Swayani devhula (north). Engedzani nndu, miri, maḓi, bada, mitsheto. Olani misevhe ya muya wa tshilimo na wa vhuriga, maitele a murunzi, na hune maḓi a elela hone musi hu tshi na mvula.\n\nṰhogomelani hune vhurontho ha dzula tshifhinga tshilapfusesa, hune mavu a nunukha vhunyisi kha miṅwedzi yo omaho, na hune khakibos kana blackjack zwa mela zwo tsitsikana. Zwino zwimela zwi nga mela fhethu ho vhilinganywaho (disturbed places), fhedzi u vha hone hazwo fhedzi a zwi sumbedzi arali mavu o tsitsikana (compacted). Tolani mavu musi ni sa athu dzhia tsheo ya uri tsinde ḽenelo ḽi amba mini kha nyolo yaṋu.\n\nVheani dzi-zone na dzi-sector dzaṋu kha yeneyo nyolo ya u thoma. I vusuluseni khalanwaha nga khalanwaha. Nyolo ya penisela ine na i shumisa vhukuma i na ndeme khulwane u fhira yo nakiswaho yo olwaho luthihi fhedzi.",
      ),
      keyPoints: [
        pair(
          "A site map needs only paper, a tape measure, a compass, and observation",
          "Mmepe wa tshitentsi u ṱoḓa fhedzi bapha, theiphi yo kalaho, khamphasi, na ṱhogomelo",
        ),
        pair(
          "Mark water flow, wind direction, frost pockets, and existing vegetation",
          "Swayani u elela ha maḓi, thungo ya muya, milindi ya vhurontho, na zwimela zwi re hone",
        ),
        hold(
          "Mark thick khakibos or blackjack growth for a closer soil check; it does not prove compaction",
        ),
        pair(
          "Overlay zones and sectors on your base map to complete the design skeleton",
          "Vheani dzi-zone na dzi-sector kha mmepe waṋu wa mutheo u itela u fhedzisa marambo a nyolo",
        ),
      ],
      quiz: [
        {
          question: pair(
            "You notice thick blackjack growing in one corner every year. What should you do next?",
            "Ni vhona blackjack yo tsitsikanaho i tshi mela kha khoṋa iṅwe ṅwaha muṅwe na muṅwe. Ni fanela u ita mini zwi no tevhela?",
          ),
          options: [
            pair(
              "The soil there is exceptionally fertile",
              "Mavu a henefho o nona nga nḓila yo khetheaho",
            ),
            pair(
              "That area has a higher water table",
              "Henefho fhethu hu na maḓi a re fhasi ha mavu a re nṱha vhukuma (higher water table)",
            ),
            pair(
              "Mark the patch and check the soil; the plant alone cannot show compaction",
              "Swayani henefho fhethu nahone ni tole mavu; tshimela tshi tshoṱhe a tshi koni u sumbedza u tsitsikana ha mavu (compaction)",
            ),
            pair(
              "Blackjack only grows in shade, so there's a hidden seep",
              "Blackjack i mela fhedzi murunzini, ngauralo hu na fhethu hu no bva maḓi ho dzumbamaho",
            ),
          ],
          sourceCorrectIndex: 2,
          rationale: pair(
            "Blackjack can grow in disturbed ground, but its presence alone does not diagnose compaction. Observe and check the soil before deciding what the patch means for your design.",
            "Blackjack i nga mela kha mavu o vhilinganywaho, fhedzi u vha hone hayo hu hoṱhe a zwi sumbedzi u tsitsikana ha mavu (compaction). Ṱhogomelani nahone ni tole mavu musi ni sa athu dzhia tsheo ya uri tsinde ḽenelo ḽi amba mini kha nyolo yaṋu.",
          ),
        },
        {
          question: pair(
            "Why mark summer and winter wind separately on your site map?",
            "Ndi ngani ni tshi swaya muya wa tshilimo na wa vhuriga thungo kha mmepe waṋu wa tshitentsi (site map)?",
          ),
          options: [
            pair(
              "Wind direction never changes in SA",
              "Thungo ya muya a i shanduki na kathihi kha SA",
            ),
            hold(
"They can come from different directions, changing where windbreaks and tender crops should go",
      ),
            pair(
              "Wind only matters in winter on the Highveld",
              "Muya u vha wa ndeme fhedzi vhuriga ngei Highveld",
            ),
            pair(
              "Wind direction only affects buildings",
              "Thungo ya muya i kwama zwifhaṱo fhedzi",
            ),
          ],
          sourceCorrectIndex: 1,
          rationale: pair(
            "Seasonal wind shifts mean a windbreak or crop placement that works for one season can be wrong for the other — so both need marking separately.",
            "U shanduka ha muya kha khalanwaha zwi amba uri tsireledzo ya muya (windbreak) kana u vhewa ha zwimela hune ha shuma kha iṅwe khalanwaha zwi nga vha zwo khakhea kha iṅwe — ngauralo zwoṱhe zwi fanela u swaywa thungo.",
          ),
        },
      ],
    },
  ],
};

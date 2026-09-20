export type ModuleCategory = "foundation" | "water" | "soil" | "plants" | "design" | "business" | "seeds";

export interface QuizQuestion {
  q: string;
  options: string[];
  correct: number;
  rationale: string;
}

export interface Lesson {
  id: string;
  title: string;
  body: string;
  keyPoints: string[];
  quiz: QuizQuestion[];
  /**
   * Farmer-facing still image — a diagram or infographic (typically generated from this
   * lesson's content via NotebookLM, then proofread). Optional: most lessons have none yet.
   * See docs/COURSE-VISUAL-ASSETS.md for how to add one and where the file goes.
   */
  infographicUrl?: string;
  /**
   * Alt text for infographicUrl — required by convention whenever infographicUrl is set (not
   * enforced by the type, since most lessons legitimately have neither field). It matters for
   * accessibility, and it's what a farmer reads on a failed image load on a slow connection.
   * tests/course-content.test.ts fails the build if one is set without the other.
   */
  infographicAlt?: string;
  /**
   * Facilitator/training video. Deliberately never rendered as an inline player for farmers —
   * KZN connectivity cannot stream video per-visit. The student page renders this as a plain
   * external link labelled as facilitator material, so a farmer never accidentally streams it.
   */
  videoUrl?: string;
  /**
   * Cross-links to other lessons worth reading alongside this one. Every id here must resolve
   * to a real lesson somewhere in COURSE_MODULES — checked by tests/course-content.test.ts,
   * and defensively re-checked at render time (app/student/page.tsx) so a bad id is skipped
   * silently rather than showing a dead button.
   */
  relatedLessonIds?: string[];
}

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  durationMins: number;
  category: ModuleCategory;
  lessons: Lesson[];
}

export const COURSE_MODULES: CourseModule[] = [
  {
    id: "intro-permaculture",
    title: "Introduction to Permaculture",
    description: "Ethics, principles and patterns — the foundation for everything else you will build.",
    durationMins: 20,
    category: "foundation",
    lessons: [
      {
        id: "intro-permaculture-l1",
        infographicUrl: "/course-images/intro-permaculture/intro-permaculture-l1.jpg",
        infographicAlt: "The three ethics as three linked circles of equal size: a hand holding soil for Earth Care, two people for People Care, and a basket passing between hands for Fair Share.",
        title: "The Three Ethics: Earth Care, People Care, Fair Share",
        body: "Permaculture rests on three ethics. Earth Care means treating soil, water, plants and animals as living systems to protect, not resources to use up. People Care means your family's needs come first, then your community's. Fair Share means taking only what you need and returning the surplus — seeds, food, water, knowledge — back into the system.\n\nThese aren't abstract ideas. A farmer who sells every egg and vegetable but keeps nothing back for the family table is skipping People Care. A community that fences off a shared spring is breaking Fair Share.\n\nEthics matter because they help you decide when there's no rulebook — a neighbour asking to graze cattle after a drought, a flood damaging your swales. Build these three into how you think before you build anything on the ground.",
        keyPoints: [
          "Earth Care: protect soil, water, and biodiversity",
          "People Care: your family's needs come before market production",
          "Fair Share: return surplus to the system — seeds, water, food, knowledge",
          "Ethics guide decisions when there's no rulebook",
        ],
        quiz: [
          {
            q: "A farmer sells all his surplus maize but keeps nothing for composting or seed saving. Which ethic is he most failing?",
            options: [
              "Earth Care only",
              "People Care only",
              "Fair Share — he returns nothing to the system",
              "All three equally",
            ],
            correct: 2,
            rationale: "Fair Share means returning some of what you take — as seed, compost, or food for others. Selling everything and keeping nothing back breaks that cycle.",
          },
          {
            q: "You have a borehole producing more water than your household needs. Which action reflects all three ethics?",
            options: [
              "Sell access to the highest bidder",
              "Keep the surplus for irrigation expansion only",
              "Share access with neighbours while monitoring the water table",
              "Cap the borehole to preserve groundwater only",
            ],
            correct: 2,
            rationale: "Sharing serves People Care and Fair Share, while monitoring the water table protects the resource for Earth Care — the other options serve only one ethic each.",
          },
        ],
      },
      {
        id: "intro-permaculture-l2",
        infographicUrl: "/course-images/intro-permaculture/intro-permaculture-l2.jpg",
        infographicAlt: "Twelve design principles arranged as segments around a central seedling, each shown as a simple picture — an eye for observing, a droplet for catching water, a sun for energy, a loop for returning waste.",
        title: "Twelve Principles: Designing with Nature",
        body: "Bill Mollison and David Holmgren distilled permaculture into twelve design principles. Three matter most for South African smallholders: observe and interact — watch your land through a full season before major earthworks; catch and store energy — harvest rain, sun and biomass before they leave your property; and use edges and value the marginal — the fence line or stream bank is often your most productive spot.\n\nOthers worth knowing: produce no waste (scraps become compost, compost becomes soil), use small and slow solutions (a bucket can irrigate a bed without electricity), and use and value diversity — a monoculture maize field can be wiped out by one hailstorm; a mixed planting rarely is.\n\nPick two or three principles that speak to your biggest problem and apply them hard. The rest become obvious as you go.",
        keyPoints: [
          "Observe your land for a full season before major earthworks",
          "Catch and store rain, sun, and biomass before they leave your property",
          "Edges and margins are often your most productive zones",
          "Diversity protects against a single event — hail, drought, or pest outbreak",
        ],
        quiz: [
          {
            q: "A farmer wants to dig swales to harvest rainwater. What should she do first, following 'observe and interact'?",
            options: [
              "Dig immediately after the first good rain",
              "Watch where water flows and pools across at least one wet season",
              "Copy a neighbour's swale layout",
              "Hire a civil engineer to survey the contours",
            ],
            correct: 1,
            rationale: "One storm shows you one moment. A full season shows you the pattern — which is what your swale design actually needs to match.",
          },
          {
            q: "Which layout best applies 'integrate rather than segregate'?",
            options: [
              "Chickens penned far from the garden",
              "Garden, fruit trees and chicken run arranged so chickens rotate through beds after harvest",
              "Separate paddocks for each crop",
              "All animals kept off the cultivated zone",
            ],
            correct: 1,
            rationale: "Integration puts each element to work for its neighbours — here, chickens clean up pests and add fertility instead of sitting idle in a fixed pen.",
          },
        ],
      },
      {
        id: "intro-permaculture-l3",
        infographicUrl: "/course-images/intro-permaculture/intro-permaculture-l3.jpg",
        infographicAlt: "Rings spreading outward from a house. The ring closest to the door is tended every day; each ring further out is visited less often and left wilder.",
        title: "Zones and Sectors: Organising Your Farm by Energy",
        body: "Zones and sectors are permaculture's main tool for cutting wasted labour. Zones run 0 to 5 by how often you visit. Zone 0 is the house. Zone 1, right outside the kitchen door, holds what you pick daily — herbs, salad greens. Zone 2 is the main garden and chicken run, visited once or twice a day. Zone 3 is the main field, visited weekly. Zone 4 is semi-wild — fruit trees and fodder needing occasional attention. Zone 5 is left wild.\n\nSectors are the energies arriving from outside — sun, wind, rain, flood, fire. A Lowveld farm facing north-west gets hot dry berg winds in August — that tells you where to plant a windbreak. A KZN farm has a summer rain sector from the north-east.\n\nSketch zones and sectors on paper and you have the skeleton of your design.",
        keyPoints: [
          "Zone 1, nearest the house, holds daily-harvest crops like herbs",
          "Zones organise labour by how often you need to visit",
          "Sectors map incoming energies: sun, wind, frost, flood, fire",
          "A simple sketch of zones and sectors is enough to start designing",
        ],
        quiz: [
          {
            q: "You plant herbs in Zone 3, the main field far from the house. What problem does this create?",
            options: [
              "Herbs grow too large",
              "You harvest rarely because the walk is long, so herbs bolt or get neglected",
              "Herbs cross-pollinate with main crops",
              "Zone 3 gets too much sun for herbs",
            ],
            correct: 1,
            rationale: "Herbs need daily picking to stay productive. Placed far from the house, that daily visit stops happening — and the plants suffer for it.",
          },
          {
            q: "A Highveld farm gets hot, dry north-westerly winds in August. Where should a windbreak go?",
            options: [
              "South-east boundary",
              "North-west boundary, between the wind and the crops",
              "Centre of the property",
              "Windbreaks aren't needed since winds are seasonal",
            ],
            correct: 1,
            rationale: "A windbreak works by standing between the wind source and what it would damage — so it belongs on the side the wind actually comes from.",
          },
        ],
      },
    ],
  },
  {
    id: "reading-landscape",
    title: "Reading the Landscape",
    description: "Identify water flow, sun angles, wind patterns and topography on your site.",
    durationMins: 25,
    category: "design",
    lessons: [
      {
        id: "reading-landscape-l1",
        infographicUrl: "/course-images/reading-landscape/reading-landscape-l1.jpg",
        infographicAlt: "A hillside seen from the side, with arrows showing where rain runs down the slope, where it collects in a hollow, and where it soaks in as the ground flattens.",
        title: "Understanding Water Flow: Where Rain Goes on Your Land",
        body: "Before you harvest water, learn where it already goes. Walk your land during and right after heavy rain — this is the single most useful observation you can make. Watch for rills, places where water fans out, where it ponds, and where it leaves your property. Every exit point is a resource lost.\n\nBuild an A-frame level from three poles and a weighted string. Two people can trace contour lines — points at the same height — across a two-hectare property in a morning. No surveyor needed. These lines guide where you place swales, dams, and tree rows.\n\nThe rule is: slow it high, sink it mid, control it low. The higher up the slope you slow water, the moister your land stays, and the less it erodes lower down.",
        keyPoints: [
          "Walk your land during and after heavy rain to see where water actually goes",
          "An A-frame level traces contour lines with no expensive equipment",
          "Slow water high on the slope, sink it mid-slope, control it at the bottom",
          "Every point water exits your land is a resource you've lost",
        ],
        quiz: [
          {
            q: "You want to trace contours on a 1.5-hectare slope with no survey budget. What's most practical?",
            options: [
              "Hire a civil engineer",
              "Estimate contours by eye",
              "Build an A-frame level and walk it yourself",
              "Use a spirit level on a board every 5 metres",
            ],
            correct: 2,
            rationale: "An A-frame level is nearly free to build and accurate enough for farm earthworks — you don't need survey-grade precision to place a swale correctly.",
          },
          {
            q: "On a sloped KZN site, where is the top priority to slow and sink water?",
            options: [
              "At the bottom where it collects",
              "In the middle in a large dam",
              "As high up the slope as possible",
              "At the boundary",
            ],
            correct: 2,
            rationale: "Water picks up speed and erosive force as it runs downhill. Slowing it near the top prevents that damage before it starts.",
          },
        ],
      },
      {
        id: "reading-landscape-l2",
        infographicUrl: "/course-images/reading-landscape/reading-landscape-l2.jpg",
        infographicAlt: "A slope with the sun in the north. Shadows from the building and the tree fall south, down the slope.",
        title: "Sun Angles, Shade, and Aspect: Getting the Most from Sunlight",
        body: "In South Africa the sun tracks across the northern sky, so north-facing slopes run warmer and drier, and south-facing slopes stay cooler and moister — frost can sit in south-facing hollows long after it clears elsewhere. This decides where you plant tender crops and site buildings.\n\nWinter sun sits lower and further north than summer sun. A wall that casts no shade in summer can shade a bed for hours in winter. Before placing anything permanent, stand in the spot at 8am, midday, and 4pm on a winter's day and watch where the shade falls.\n\nFor frost-sensitive plants — pawpaw, young citrus — a north-facing wall that radiates heat at night can be the difference between life and death.",
        keyPoints: [
          "North-facing slopes are warmer and drier; south-facing slopes are cooler and moister",
          "Winter sun sits lower and further north — shade patterns shift a lot between seasons",
          "Frost pools in south-facing hollows on the Highveld",
          "Check shadow patterns at 8am, midday, and 4pm in winter before placing permanent structures",
        ],
        quiz: [
          {
            q: "Where's the best position for a frost-tender young pawpaw on a Highveld smallholding?",
            options: [
              "Lowest point where cold air drains to",
              "South-facing slope",
              "Against a north-facing wall that radiates heat at night",
              "Under an existing large tree",
            ],
            correct: 2,
            rationale: "A north-facing wall absorbs heat by day and releases it at night — exactly when frost damage happens.",
          },
          {
            q: "A farmer builds 2m shade cloth on the north side of her garden in autumn. What happens in winter?",
            options: [
              "It blocks low winter sun and shades the garden most of the day",
              "It redirects frost away",
              "No effect, since the sun is overhead at noon",
              "It reduces evaporation and helps the crops",
            ],
            correct: 0,
            rationale: "Winter sun sits much lower in the sky. A structure that only shaded briefly in summer can block the low winter sun for most of the day.",
          },
        ],
      },
      {
        id: "reading-landscape-l3",
        infographicUrl: "/course-images/reading-landscape/reading-landscape-l3.jpg",
        infographicAlt: "A farm from above with three sets of arrows: the direction the wind usually comes from, cold air draining downhill into a frost hollow, and the direction the land slopes.",
        title: "Wind, Frost, and Topography: Reading the Invisible Forces",
        body: "Wind is one of the most damaging, most ignored forces on a smallholding. Highveld farms face hot, dry north-westerlies in August and September. KZN escarpment farms face cold south-westerly fronts in winter and humid easterlies that bring fungal disease in summer. Know your region's pattern before you plant.\n\nOn a clear, still night, cold air can flow downhill and collect in low places. These places can be colder than nearby slopes.\n\nFrost is ice that forms on a cold surface. Mist alone does not prove there is frost. Walk the land after a cold night. Look for frost on plants and compare low ground with slopes. Mark places where frost lasts longest. Keep sensitive plants away from those cold pockets.",
        keyPoints: [
          "Know your region's dominant wind — Highveld north-westerlies, KZN easterlies",
          "Frost flows downhill and pools in low ground — valleys frost first and last",
          "Ridgelines deflect wind; hills cast rain shadows on their leeward side",
          "A cold winter dawn walk shows you exactly where frost pools",
        ],
        quiz: [
          {
            q: "Where should you site your most frost-sensitive seedling nursery on a Highveld farm?",
            options: [
              "In a valley bottom",
              "On an exposed ridgeline",
              "A gently sloping north-facing hillside above the frost-pool zone",
              "Under large shade trees",
            ],
            correct: 2,
            rationale: "This position stays above where cold air settles at night, while the north-facing aspect adds daytime warmth.",
          },
          {
            q: "A KZN farmer's tomatoes get late blight every summer. Fungal disease needs humidity and still air. Where should she move the bed?",
            options: [
              "A sealed, unventilated tunnel",
              "Somewhere with good airflow and morning sun that dries leaves quickly",
              "A low spot near a dam",
              "A shaded south wall",
            ],
            correct: 1,
            rationale: "Airflow and morning sun dry the leaf surface fast, which is exactly what starves fungal disease of the damp conditions it needs.",
          },
        ],
      },
      {
        id: "reading-landscape-l4",
        infographicUrl: "/course-images/reading-landscape/reading-landscape-l4.jpg",
        infographicAlt: "A hand-drawn site map on paper showing north, the buildings, the water, and the boundary — rough, as a farmer would draw it.",
        title: "Making a Simple Site Map: Your Design Starts on Paper",
        body: "A site map needs paper, a tape measure, a compass, and a morning to walk your land. Pace the boundary and sketch it to scale. Mark north. Add the house, trees, water, roads, fences. Draw arrows for summer and winter wind, shade patterns, and where water flows in rain.\n\nNote where frost sits longest, where the ground smells damp in dry months, and where khakibos or blackjack grow thick — both are pioneer weeds that mean disturbed or compacted soil.\n\nOverlay your zones and sectors on the same sketch. Update it season by season. A pencil sketch you actually use is worth more than a perfect one drawn once.",
        keyPoints: [
          "A site map needs only paper, a tape measure, a compass, and observation",
          "Mark water flow, wind direction, frost pockets, and existing vegetation",
          "Thick khakibos or blackjack growth signals disturbed or compacted soil",
          "Overlay zones and sectors on your base map to complete the design skeleton",
        ],
        quiz: [
          {
            q: "You notice thick blackjack growing in one corner every year. What does this most likely tell you?",
            options: [
              "The soil there is exceptionally fertile",
              "That area has a higher water table",
              "The soil has been disturbed or compacted and pioneers are colonising it",
              "Blackjack only grows in shade, so there's a hidden seep",
            ],
            correct: 2,
            rationale: "Blackjack and khakibos are classic pioneer species — they move into ground that's been disturbed or compacted, and their presence is a useful diagnostic.",
          },
          {
            q: "Why mark summer and winter wind separately on your site map?",
            options: [
              "Wind direction never changes in SA",
              "They can come from different directions, changing where windbreaks and tender crops should go",
              "Wind only matters in winter on the Highveld",
              "Wind direction only affects buildings",
            ],
            correct: 1,
            rationale: "Seasonal wind shifts mean a windbreak or crop placement that works for one season can be wrong for the other — so both need marking separately.",
          },
        ],
      },
    ],
  },
  {
    id: "water-harvesting",
    title: "Water Harvesting",
    description: "Swales, berms, dams, rainwater tanks and greywater — slow, spread and sink every drop.",
    durationMins: 35,
    category: "water",
    lessons: [
      {
        id: "water-harvesting-l1",
        infographicUrl: "/course-images/water-harvesting/water-harvesting-l1.jpg",
        infographicAlt: "A slope cut through the middle: a shallow ditch dug along the contour with a raised mound below it. Arrows show rain slowing, spreading sideways, and soaking into the soil instead of running away.",
        title: "Swales and Berms: Slowing Water on the Slope",

        body: "A swale is a level trench dug exactly on contour — not angled, perfectly level end to end — so water fills it evenly and soaks in rather than running off. The excavated soil forms a berm on the downhill side. Trees planted there draw on stored water long after the rain has stopped.\n\nOn the Highveld, storms can drop 50 to 80mm an hour, so size your swale with a safe overflow point at one end, leading to the next swale or a dam. An overflow with nowhere to go can breach the berm and create the very gully you were trying to prevent.\n\nSwales work well on 1 to 15% slopes. Above 15 to 20%, use vetiver grass contour lines or terraces instead — test a 60cm pit with water first; if it drains within the hour, plan for drier conditions.",
        keyPoints: [
          "A swale is a level trench on contour — it sinks water, it doesn't direct it",
          "The berm (downhill mound of excavated soil) is where you plant trees",
          "Include a safe overflow point so storms don't breach the berm",
          "Above 15-20% slope, use vetiver grass lines or terraces instead",
        ],
        quiz: [
          {
            q: "After heavy rain, one end of your swale fills fast while the other stays dry. What went wrong?",
            options: [
              "The swale is too wide",
              "It's not level — dug at a slight angle instead of true contour",
              "The downhill berm is too high",
              "The soil is too sandy to hold water at all",
            ],
            correct: 1,
            rationale: "A swale only works if every point sits at the same height. Even a slight angle sends water to the low end instead of spreading evenly.",
          },
          {
            q: "A farmer on a steep 25% slope in the KZN Midlands wants to slow erosion. What's most appropriate?",
            options: [
              "Standard swales dug as deep as possible",
              "Vetiver grass planted in contour lines",
              "A large dam at the bottom to catch all runoff",
              "Compacting the soil surface with a roller",
            ],
            correct: 1,
            rationale: "Above roughly 15-20%, swales become hard to maintain and risk slipping. Vetiver's dense root mat holds the slope instead.",
          },
        ],
      },
      {
        id: "water-harvesting-l2",
        infographicUrl: "/course-images/water-harvesting/water-harvesting-l2.jpg",
        infographicAlt: "A farm dam cut through the middle: water flowing in at one end, the stored body of water, a spillway at the top edge for overflow, and a planted bank holding the soil.",
        title: "Farm Dams and Ponds: Storing Water for the Dry Season",
        body: "A well-sited dam stores a season's rain to carry you through the dry months. In summer-rainfall South Africa, rain falls October to March, then largely stops — a dam makes you far less dependent on boreholes or municipal supply through winter.\n\nSite your dam by two rules: maximise the catchment draining toward it, and design the spillway before you build the wall. A 2-hectare catchment at 700mm annual rainfall can fill 200,000 to 400,000 litres in a good season. Skip the spillway and one exceptional storm can overtop and breach the wall — a disaster that costs more to fix than the dam itself.\n\nIn Limpopo and hot parts of KZN, evaporation can strip 2 metres of depth a year. Shade trees on the western and northern banks cut this significantly. Ducks aerate the water; indigenous bulrushes stabilise the banks.",
        keyPoints: [
          "Size the dam to the catchment area draining toward it",
          "Design the spillway before the wall — an overtopped wall can breach catastrophically",
          "Shade trees on the western and northern banks cut evaporation significantly in hot regions",
          "Ducks and indigenous bulrushes turn a dam into a working ecosystem, not just storage",
        ],
        quiz: [
          {
            q: "A farmer builds a dam wall with no spillway. After an exceptional storm it overflows. What's the likely result?",
            options: [
              "The water irrigates lower fields beneficially",
              "It overtops and erodes the wall, risking a catastrophic breach",
              "The dam stays full and overflow drains harmlessly",
              "Storage capacity increases permanently",
            ],
            correct: 1,
            rationale: "Without a designed overflow route, excess water finds its own way over the wall — and that uncontrolled flow is what erodes and eventually breaches it.",
          },
          {
            q: "In Limpopo, what combination best reduces evaporation from an open dam?",
            options: [
              "A deep, exposed dam with no bank vegetation",
              "Shade trees on the western and northern banks, plus ducks for aeration",
              "A full concrete lining and plastic cover",
              "A larger surface area to spread evaporation evenly",
            ],
            correct: 1,
            rationale: "Shade cuts direct heat gain on the water surface — a practical, low-cost combination that measurably reduces loss in hot, high-evaporation regions.",
          },
        ],
      },
      {
        id: "water-harvesting-l3",
        infographicUrl: "/course-images/water-harvesting/water-harvesting-l3.jpg",
        infographicAlt: "Rain running off a roof into a gutter and down a pipe into a tank, with a small first-flush diverter branching off before the tank to throw away the dirty first water.",
        title: "Rainwater Tanks and Roof Catchment: Harvesting Clean Water",
        body: "Your roof is a harvesting surface. Each square metre collects roughly 0.9 litres per millimetre of rain, once you allow for splash and evaporation losses. A 100 square metre corrugated iron roof in Pietermaritzburg, at 800mm a year, yields close to 72,000 litres — enough for a family garden and most non-drinking needs.\n\nFit a first-flush diverter: the first 20 to 30 litres off any roof carries bird droppings, dust, and leaf litter, and should be diverted before clean water reaches the tank. For drinking water, add a filter downstream. For irrigation, untreated tank water is fine.\n\nMatch tank size to your dry season, not just one dry spell. In KZN, 5,000 litres may bridge a two-to-three-week gap. On the Highveld's longer dry season, 20,000 to 30,000 litres is more realistic.",
        keyPoints: [
          "Roof catchment yield: about 0.9 litres per square metre per mm of rain",
          "A first-flush diverter removes the dirty first flush from every rain event",
          "Match tank size to your dry season length, not a single dry spell",
          "Keep tanks sealed against light and mosquitoes; filter before drinking",
        ],
        quiz: [
          {
            q: "An 80m² iron roof gets 600mm of rain a year. Using the 0.9 litres per m² per mm figure, how much can she expect to harvest?",
            options: [
              "About 24,000 litres",
              "About 43,200 litres",
              "About 80,000 litres",
              "About 6,000 litres",
            ],
            correct: 1,
            rationale: "80 times 600 times 0.9 equals 43,200 litres. The 0.9 factor already accounts for normal splash and evaporation losses.",
          },
          {
            q: "Why does a first-flush diverter matter even for irrigation-only tank water?",
            options: [
              "It doesn't matter for irrigation, only drinking water",
              "The first flush carries concentrated droppings, dust and pathogens that can contaminate edible crops",
              "It's more acidic and changes soil pH over time",
              "It stops the tank overfilling in storms",
            ],
            correct: 1,
            rationale: "Even irrigation water touches edible crops directly. Keeping the contaminated first flush out protects food safety, not just drinking quality.",
          },
        ],
      },
      {
        id: "water-harvesting-l4",
        infographicUrl: "/course-images/water-harvesting/water-harvesting-l4.jpg",
        infographicAlt: "Water from an indoor basin running through a buried pipe out to a mulched planting basin. The pipe stays underground the whole way — never an open channel.",
        title: "Greywater Recycling: A Free Daily Water Source",
        body: "Greywater is used washwater from your bath, basin, and laundry — not toilet water, which is blackwater and needs separate, careful handling. Kept clean of harsh chemicals, greywater is a free daily source of irrigation water that would otherwise be wasted.\n\nUse plain soap and avoid bleach, strong disinfectants, or water from washing nappies — these can damage soil life and plant roots. Direct greywater into a mulch-filled basin around fruit trees rather than onto bare ground, so it filters through organic matter before reaching roots.\n\nNever use greywater on leafy vegetables, root vegetables eaten raw, or seedlings — the risk of contact with bacteria is too high. Fruit trees, established shrubs, and non-edible landscaping are the right use. Check your municipality's rules before installing a permanent greywater system.",
        keyPoints: [
          "Greywater is washwater from bath, basin, and laundry — never toilet water",
          "Use plain soap; avoid bleach, strong disinfectants, and nappy-wash water",
          "Direct greywater to mulch basins around fruit trees, never onto raw-eaten vegetables",
          "Check your municipality's greywater rules before installing a permanent system",
        ],
        quiz: [
          {
            q: "Which use of greywater is safe?",
            options: [
              "Watering lettuce that will be eaten raw",
              "Irrigating an established fruit tree through a mulch basin",
              "Watering seedlings in a nursery tray",
              "Filling a fishpond",
            ],
            correct: 1,
            rationale: "Fruit trees with mulch filtration keep greywater away from food that's eaten unwashed or uncooked — that's the safe use case.",
          },
          {
            q: "Why avoid bleach or strong disinfectant in water destined for greywater reuse?",
            options: [
              "They make the water too alkaline for any plant",
              "They can kill the soil organisms and harm plant roots that greywater is meant to feed",
              "They cause tanks to corrode faster",
              "They attract more mosquitoes",
            ],
            correct: 1,
            rationale: "The whole value of greywater comes from feeding soil life and plant roots — harsh chemicals undermine exactly what you're trying to use the water for.",
          },
        ],
      },
    ],
  },
  {
    id: "soil-health",
    title: "Soil Health & Composting",
    description: "Build living soil with compost, mulch, cover crops and worm farms.",
    durationMins: 20,
    category: "soil",
    lessons: [
      {
        id: "soil-health-l1",
        infographicUrl: "/course-images/soil-health/soil-health-l1.jpg",
        infographicAlt: "A spade cut through the ground showing dark crumbly topsoil above pale subsoil, with worm channels. Beside it, a jar of soil settled into three layers — sand, silt and clay.",
        title: "Understanding Your Soil: The Foundation of Everything",
        body: "Healthy soil is alive. A teaspoon of good topsoil holds more organisms than there are people on Earth — bacteria, fungi, and the underground fungal threads that move nutrients between plants. Years of monoculture, overgrazing, or stubble-burning strip that life out, leaving soil that depends on bought fertiliser to produce anything.\n\nDig a 30cm hole and look. Healthy topsoil is dark, smells like rain or mushrooms, and shows worm channels. Degraded soil is pale, compacted, and smells of nothing or sour.\n\nTry the jar test: fill a jar one-third with soil, top up with water and a drop of dish soap, shake, and let it settle for a day. Sand settles first, then silt, with clay staying suspended longest — showing you your soil's texture.",

        keyPoints: [
          "Healthy soil is a living ecosystem — bacteria, fungi, and worms process nutrients for plants",
          "Healthy soil smells earthy; degraded soil smells sour or of nothing",
          "The jar test separates sand, silt, and clay with no equipment",
          "Compost and mulch improve every South African soil type",
        ],
        quiz: [
          {
            q: "After the jar test, a farmer sees thick sand at the bottom and cloudy clay-tinted water on top. What does this mean for watering?",
            options: [
              "Sandy soil retains water well, so water less often",
              "Sandy soil drains fast and holds little water — mulch heavily and add organic matter often",
              "The soil is balanced and needs no changes",
              "High clay content means it will crack and needs gypsum",
            ],
            correct: 1,
            rationale: "The dominant sand fraction means water drains through quickly. Mulch and organic matter are what slow that down and hold moisture for roots.",
          },
          {
            q: "A farmer finds pale, compacted soil with no worms and a sour smell. What's the most likely cause?",
            options: [
              "Too much organic matter, causing low-oxygen conditions",
              "Years of heavy mulching depleting minerals",
              "Continuous cropping, chemical use, or burning has killed most soil life",
              "The soil type is naturally poor and can't improve",
            ],
            correct: 2,
            rationale: "This combination of signs points to biological degradation from years of harsh management — not a fixed trait of the soil, which is the encouraging part: it can be rebuilt.",
          },
        ],
      },
      {
        id: "soil-health-l2",
        infographicUrl: "/course-images/soil-health/soil-health-l2.jpg",
        infographicAlt: "A compost heap cut open, showing alternating layers of dry brown material and fresh green material, heat rising from the middle, and an arrow showing it being turned.",
        title: "Making and Using Compost",
        body: "Compost is decomposed organic matter that rebuilds soil structure and feeds soil life. A hot heap reaches usable compost in four to six weeks in warm, humid KZN, or eight to twelve weeks on the cooler Highveld. Aim for a core temperature of 55 to 65C, this speeds decomposition and kills most weed seeds and pathogens.\n\nBalance carbon (dry grass, straw, cardboard, maize stalks) with nitrogen (fresh grass, kitchen scraps, manure): 20 to 30cm of browns to every 5 to 10cm of greens. Too much green turns the heap slimy and ammonia-smelling; too much brown keeps it cold for months.\n\nAvoid meat, dairy, cooked scraps, and diseased plants. Keep wattle seed pods out, the hard seed coat survives ordinary composting heat, so pods can spread the plant through finished compost. Bark alone, without pods, is safe, it just breaks down slowly. Turn every five to seven days and keep the heap moist, not wet.",
        keyPoints: [
          "Hot compost needs a heap temperature of 55-65°C to kill weed seeds and pathogens",
          "Layer 20-30cm of browns to every 5-10cm of greens",
          "Wattle seed pods survive ordinary composting heat and can spread through finished compost — keep pods out, though bark alone is fine",
          "Never add meat, dairy, diseased plants, or soil with persistent herbicide residue",
        ],
        quiz: [
          {
            q: "A farmer's compost heap smells strongly of ammonia and is wet and slimy. What's the fix?",
            options: [
              "Add more nitrogen-rich green material",
              "Add more dry carbon material like straw and turn the heap",
              "Stop turning it and let it cool",
              "Add more water — the smell means it's too dry",
            ],
            correct: 1,
            rationale: "Ammonia and sliminess are the signature of too much nitrogen-rich green material relative to carbon — more browns rebalance the mix and let air back in.",
          },
          {
            q: "Why should a farmer keep wattle seed pods out of the compost heap, even though wattle bark itself is fine to include?",
            options: [
              "Wattle bark makes the heap too hot",
              "Seed pods are hard-coated and can survive ordinary composting heat, letting the plant spread through finished compost",
              "Bark attracts termites that damage the heap structure",
              "Pods release a gas that kills beneficial soil microbes",
            ],
            correct: 1,
            rationale: "Wattle seed needs much higher heat than a normal compost heap reaches to lose viability — so pods can ride through the whole process and germinate wherever the compost is used.",
          },
        ],
      },
      {
        id: "soil-health-l3",
        infographicUrl: "/course-images/soil-health/soil-health-l3.jpg",
        infographicAlt: "Two patches of soil under the same sun: bare ground cracked and dry, mulched ground still dark and moist.",
        title: "Mulching and Cover Crops: Protecting and Building Soil",
        body: "Bare soil is exposed soil. A South African summer storm can drop 60mm in thirty minutes — enough to strip topsoil that took centuries to form. A 5 to 10cm mulch layer of straw, dry grass or wood chips cuts erosion sharply, keeps soil several degrees cooler in summer — sometimes up to 10°C on hot Highveld days — suppresses weeds, and feeds soil life as it breaks down.\n\nCover crops protect bare ground between main seasons. On the Highveld, oats or lupins sown after maize harvest cover the soil through frost months, then get slashed in before spring planting. In KZN, sunn hemp grows fast in summer and adds a large amount of nitrogen-rich biomass. Cowpea fixes nitrogen and tolerates the Lowveld's early-summer dry spell.\n\nWorm farms turn kitchen scraps into rich castings in three to four weeks. The liquid leachate, diluted 1:10 with water, makes a strong root feed.",
        keyPoints: [
          "A 5-10cm mulch layer cuts soil temperature, suppresses weeds, and prevents erosion",
          "Cover crops like sunn hemp or lupins protect soil between seasons and add organic matter",
          "Legume cover crops fix nitrogen for free, cutting your fertiliser bill",
          "Worm farm leachate, diluted 1:10, is a strong liquid root feed",
        ],
        quiz: [
          {
            q: "A Highveld farmer harvests maize in April and leaves the field bare all winter. What are the two main risks?",
            options: [
              "Overheating in winter sun and waterlogging from rain",
              "Frost kills soil life and weeds take over early",
              "Wind erosion of dry topsoil and loss of soil structure from spring storm impact",
              "Soil pH drops and nitrogen builds up",
            ],
            correct: 2,
            rationale: "Bare winter soil has nothing holding it against wind, and nothing to absorb the force of the first heavy spring rain — both strip topsoil directly.",
          },
          {
            q: "Worm farm leachate is a strong fertiliser but must be diluted before use. Why?",
            options: [
              "It's too cold for roots undiluted",
              "Undiluted, it's concentrated enough to burn plant roots",
              "It contains worm eggs that could hatch and damage roots",
              "Only seedlings need dilution",
            ],
            correct: 1,
            rationale: "Leachate is far more concentrated than any diluted feed — applied neat, it can scorch the very roots it's meant to nourish.",
          },
        ],
      },
    ],
  },
  {
    id: "vegetables-staples",
    title: "Vegetables and Staple Crops",
    description: "Bed prep, succession planting, staple crops and pest management — the daily work of growing food.",
    durationMins: 30,
    category: "plants",
    lessons: [
      {
        id: "vegetables-staples-l1",
        infographicUrl: "/course-images/vegetables-staples/vegetables-staples-l1.jpg",
        infographicAlt: "A raised bed about 1.2 metres wide, with paths on both sides, so a person can reach the middle from either side without ever standing on the growing soil.",
        title: "Preparing and Planting Your Beds",
        body: "Good beds start before you plant a single seed. No-dig beds — layers of compost and mulch over the existing ground — suit most smallholder soils and save labour; double-digging, loosening two spade-depths down, suits compacted or heavy clay soil that needs deeper drainage.\n\nKeep beds 1 to 1.2m wide, so you can reach the centre from either side without ever standing on the growing area — compaction is the enemy of root growth. Raised beds help in high-rainfall areas with poor drainage; sunken beds hold moisture better in dry regions.\n\nTransplant seedlings for crops that need a head start — tomatoes, brassicas — and direct-seed fast growers like beans and carrots, which resent root disturbance. Crowded plants compete for light and water and underperform badly; space for your climate, not the seed packet's minimum. This weekend, mark out and prepare one 1.2m by 3m bed.",
        keyPoints: [
          "Keep beds 1-1.2m wide so you never need to step on the growing area",
          "No-dig suits most soils; double-dig only compacted or heavy clay ground",
          "Transplant crops needing a head start; direct-seed crops that resent root disturbance",
          "Crowded plants underperform — space generously for your local climate",
        ],
        quiz: [
          {
            q: "Why keep a vegetable bed to 1-1.2m wide rather than wider?",
            options: [
              "Wider beds get too much sun",
              "You can reach the centre from either side without stepping on the growing area, avoiding compaction",
              "Narrow beds drain better in all conditions",
              "It's a fixed rule with no practical reason",
            ],
            correct: 1,
            rationale: "Stepping on growing soil compacts it and damages roots — a bed you can reach into from both sides means you never have to.",
          },
          {
            q: "Which crop is best suited to direct-seeding rather than transplanting?",
            options: [
              "Tomatoes, which need an early start",
              "Brassicas, which need protection while small",
              "Beans, which resent root disturbance",
              "Peppers, which are slow to germinate",
            ],
            correct: 2,
            rationale: "Beans and other quick, sensitive-rooted crops establish poorly after transplant shock — sowing them straight into the bed avoids that setback entirely.",
          },
        ],
      },
      {
        id: "vegetables-staples-l2",
        infographicUrl: "/course-images/vegetables-staples/vegetables-staples-l2.jpg",
        infographicAlt: "One bed over three seasons: a fast crop is harvested, then a new sowing goes in beside a slower crop that is still growing, so the bed is never empty.",
        title: "Succession Planting and Intercropping",
        body: "Succession planting stops the feast-or-famine cycle. Instead of sowing all your spinach or lettuce at once, sow a short row every two to three weeks — you harvest steadily instead of drowning in one glut then running short for a month.\n\nIntercropping puts complementary plants together. The Three Sisters — maize, beans, and pumpkin — is the classic southern African example: maize gives beans a climbing frame, beans fix nitrogen for the maize, and pumpkin's broad leaves shade out weeds beneath both.\n\nEvery region has a hungry gap — weeks between one harvest ending and the next beginning, when stored food runs low before fresh food arrives. Know when yours falls, and plan a succession sowing specifically to fill it.",
        keyPoints: [

          "Sow small successive batches every 2-3 weeks instead of one large planting",
          "The Three Sisters — maize, beans, pumpkin — is southern Africa's classic intercrop",
          "Each region has a hungry gap between harvests — plan a sowing specifically to fill it",
          "Intercropped plants should support each other, not just share space",
        ],
        quiz: [
          {
            q: "Why sow lettuce in small batches every 2-3 weeks instead of all at once?",
            options: [
              "It uses less seed overall",
              "It gives a steady harvest instead of a glut followed by a gap",
              "Lettuce germinates better in small batches",
              "It reduces pest pressure",
            ],
            correct: 1,
            rationale: "A single large sowing matures all at once — staggering the sowing spreads the harvest out to match what a household can actually use.",
          },
          {
            q: "In the Three Sisters planting, what job does the bean plant do for the system?",
            options: [
              "It shades out weeds",
              "It fixes nitrogen that feeds the maize and pumpkin",
              "It climbs the pumpkin vines",
              "It repels pests from the maize",
            ],
            correct: 1,
            rationale: "Beans are the nitrogen-fixing partner in this trio — maize provides the climbing structure and pumpkin covers the ground, but nitrogen comes from the beans.",
          },
        ],
      },
      {
        id: "vegetables-staples-l3",
        infographicUrl: "/course-images/vegetables-staples/vegetables-staples-l3.jpg",
        infographicAlt: "Three staple crops together: a tall grain stalk, a climbing vine on a pole, and a root crop shown half below the ground.",
        title: "Staple Crops: Maize, Beans, and Root Vegetables",
        body: "A staple crop is calorie-dense, stores well, and often carries cultural weight. Maize is southern Africa's central staple — choose open-pollinated varieties over hybrids if you want to save seed, since hybrid seed won't breed true to the parent plant next season.\n\nBeans, both Phaseolus and Vigna species, are the most important protein crop for most smallholders — productive, storable dry, and nitrogen-fixing in the ground while they grow.\n\nSweet potatoes are drought-tolerant, productive even on poor soil, and give you both a root harvest and edible leaves. Amadumbe, or taro, is an underused traditional staple well suited to KZN and coastal conditions, tolerating wetter ground than maize.\n\nGrowing at least two staples together, not relying on one alone, protects your household against any single crop failing in a bad season.",
        keyPoints: [
          "Open-pollinated maize lets you save seed; hybrid seed won't breed true next season",
          "Beans are the key protein crop — productive, storable, and nitrogen-fixing",
          "Sweet potato is drought-tolerant and gives both a root harvest and edible leaves",
          "Amadumbe (taro) is an underused traditional staple suited to wetter KZN and coastal ground",
        ],
        quiz: [
          {
            q: "Why choose open-pollinated maize over a hybrid variety if you plan to save your own seed?",
            options: [
              "Open-pollinated varieties yield more",
              "Hybrid seed won't breed true — the next generation won't match the parent plant",
              "Open-pollinated maize is always more drought-tolerant",
              "Hybrids can't be planted in South Africa",
            ],
            correct: 1,
            rationale: "Hybrids are a one-time genetic cross — their seed grows into something different from the parent, which defeats the purpose of saving it.",
          },
          {
            q: "Why is amadumbe (taro) a good staple choice for parts of KZN?",
            options: [
              "It thrives on very dry, sandy soil",
              "It tolerates wetter ground than maize, suiting coastal and high-rainfall conditions",
              "It requires no cultivation at all",
              "It's the only staple that stores for multiple years",
            ],
            correct: 1,
            rationale: "Amadumbe actually prefers damper ground where maize would struggle — it fills a niche other staples can't handle well.",
          },
        ],
      },
      {
        id: "vegetables-staples-l4",
        infographicUrl: "/course-images/vegetables-staples/vegetables-staples-l4.jpg",
        infographicAlt: "A pest on a leaf, and three ways to deal with it without chemicals: a beneficial insect, a physical barrier, and picking it off by hand.",
        title: "Pest and Disease Management Without Chemicals",
        body: "Pests usually signal a system out of balance — a stressed plant, a monoculture, or natural predators disrupted by chemical use. Address the imbalance and the pest pressure often eases on its own.\n\nThe basic neem spray — neem oil, a small amount of soft soap as an emulsifier, and water — is a non-negotiable tool for any smallholder facing soft-bodied pests like aphids.\n\nBiological controls do the rest: ladybirds hunt aphids, braconid wasps parasitise caterpillars, spiders take whitefly. Companion planting supports them — basil near tomatoes, nasturtium drawing pests from brassicas, marigold alongside legumes.\n\nBefore reaching for any treatment, check whether it's really a pest problem at all. Yellow leaves are just as often a soil or watering issue as a bug problem — treating the wrong cause wastes time and money.",
        keyPoints: [
          "Pests often signal an imbalance — plant stress, monoculture, or disrupted natural predators",
          "The neem, soft soap, and water spray is a core non-chemical tool for soft-bodied pests",
          "Companion planting (basil/tomato, nasturtium/brassica, marigold/legume) supports natural pest control",
          "Yellow leaves are as often a soil or water problem as a pest problem — check before treating",
        ],
        quiz: [
          {
            q: "What's the basic recipe for a neem spray against soft-bodied pests like aphids?",
            options: [
              "Neem oil and water only",
              "Neem oil, a small amount of soft soap as an emulsifier, and water",
              "Neem oil and vinegar",
              "Neem leaves boiled in water",
            ],
            correct: 1,
            rationale: "Soap acts as an emulsifier, letting the oil mix into water and coat the pests properly — without it, the oil just separates out.",
          },
          {
            q: "A farmer's brassica leaves are turning yellow. Before assuming pests, what should she check first?",
            options: [
              "Whether it's actually a soil nutrient or watering issue",
              "Whether the moon phase is right for treatment",
              "Whether her neighbour has the same problem",
              "Whether it's aphids specifically",
            ],
            correct: 0,
            rationale: "Yellowing has several common causes, and a soil or watering issue needs a completely different fix than a pest does — checking first avoids wasted treatment.",
          },
        ],
      },
    ],
  },
  {
    id: "seeds-sovereignty",
    title: "Seeds and Seed Sovereignty",
    description: "Save, store and share seed — freedom from buying seed every season.",
    durationMins: 25,
    category: "seeds",
    lessons: [
      {
        id: "seeds-sovereignty-l1",
        infographicUrl: "/course-images/seeds-sovereignty/seeds-sovereignty-l1.jpg",
        infographicAlt: "Two seed packets. Seed from the first grows into five identical plants. Seed saved from hybrid plants grows into five different, uneven ones.",
        title: "Why Seed Saving Matters",
        body: "Open-pollinated seed breeds true, season after season — plant it, save it, and the next generation matches the parent. Hybrid, or F1, seed is a one-time cross bred for uniform commercial traits; its saved seed grows into something unpredictable, often far less productive. That's not an accident — it's what keeps farmers buying new seed every season.\n\nSeed sovereignty means the freedom to grow, save, and share seed without depending on a seed company for every planting. It matters more as climate becomes less predictable: a wide pool of locally adapted varieties gives your household and community more chance of having something that survives a bad season.\n\nThis season, pick one crop and commit to saving seed from your best plant — not your biggest harvest, your healthiest plant.",
        keyPoints: [
          "Open-pollinated seed breeds true; hybrid (F1) seed does not",
          "Seed sovereignty means freedom from depending on a seed company every season",
          "Genetic diversity across many saved varieties is real protection against climate unpredictability",
          "Select seed from your healthiest plant, not simply your biggest harvest",
        ],
        quiz: [
          {
            q: "Why won't seed saved from a hybrid (F1) tomato breed true next season?",
            options: [
              "Hybrid seed is sterile and won't germinate at all",
              "Hybrid seed is a one-time genetic cross — its offspring vary unpredictably from the parent",
              "Hybrids only grow in commercial greenhouses",
              "Hybrid seed loses viability faster in storage",
            ],
            correct: 1,
            rationale: "F1 hybrids are bred by crossing two specific parent lines — their seed carries a mixed, unpredictable genetic recombination, not a stable copy of the parent.",
          },
          {
            q: "When selecting a parent plant to save seed from, what should guide your choice?",
            options: [
              "Whichever plant produced the single largest fruit",
              "The healthiest, most disease-free, well-shaped plant, even if not the biggest yielder",
              "Whichever plant matured first, regardless of health",
              "Any plant — selection doesn't affect future seed quality",
            ],
            correct: 1,
            rationale: "You're selecting for the traits you want to carry forward — health and vigour matter more long-term than one plant's single biggest harvest.",
          },
        ],
      },
      {
        id: "seeds-sovereignty-l2",
        infographicUrl: "/course-images/seeds-sovereignty/seeds-sovereignty-l2.jpg",
        infographicAlt: "Two ways to save seed. Dry method: pods dry on the plant, then seed is collected. Wet method: seed ferments in water until a film forms, then is rinsed and dried.",
        title: "How to Save Seed: Dry and Wet Methods",
        body: "Dry-method crops — beans, peas, maize, sunflower — are left to dry fully on the plant before you collect and store the seed. Simple and low-risk.\n\nWet-method crops — tomatoes, cucumbers, squash — need their seed separated from pulp that contains natural germination inhibitors. Scoop the seed and pulp into a jar with a little water, let it ferment two to three days until a light mould film forms on top, then rinse and dry the seed thoroughly before storing.\n\nIsolation distance matters to keep varieties pure. Tomatoes self-pollinate and need very little isolation. Maize cross-pollinates by wind over long distances and needs real separation between varieties, or hand-pollination if you're growing more than one type in a small space. Try the tomato fermentation method this season — it's the easiest wet-method entry point.",
        keyPoints: [
          "Dry-method crops (beans, maize, sunflower) simply dry on the plant before collection",

          "Wet-method crops (tomato, cucumber) need pulp fermented off before drying the seed",
          "Tomatoes need little isolation; maize needs real distance between varieties to stay pure",
          "Fermenting tomato seed for 2-3 days removes natural germination inhibitors",
        ],
        quiz: [
          {
            q: "Why ferment tomato seed in water for a few days before drying it, rather than drying it straight from the fruit?",
            options: [
              "Fermentation improves the seed's flavour",
              "It removes the pulp's natural germination inhibitors, which otherwise prevent good germination",
              "It kills any pests inside the fruit",
              "It's purely traditional with no practical function",
            ],
            correct: 1,
            rationale: "The gel around tomato seeds actively suppresses germination in nature — fermentation breaks that down so the seed germinates reliably next season.",
          },
          {
            q: "Why does maize need much greater isolation distance than tomatoes to keep a variety pure?",
            options: [
              "Maize seed is more fragile",
              "Maize is wind-pollinated and crosses easily over distance; tomatoes mostly self-pollinate",
              "Tomatoes don't cross-pollinate at all under any conditions",
              "Maize flowers for a shorter period",
            ],
            correct: 1,
            rationale: "Wind carries maize pollen far further than insect or self-pollination moves tomato pollen — that difference in pollination method drives the isolation requirement.",
          },
        ],
      },
      {
        id: "seeds-sovereignty-l3",
        infographicUrl: "/course-images/seeds-sovereignty/seeds-sovereignty-l3.jpg",
        infographicAlt: "Seed envelopes stored in a sealed container, kept cool, dark and dry. Beside it, ten seeds on a damp cloth — some sprouted, some not — as a germination test.",
        title: "Drying, Storing, and Sharing Seed",
        body: "Dry seed properly before storing it: paper envelopes, not plastic, in a shaded, airy spot — never direct sun or sealed heat. The three enemies of seed viability are heat, light, and moisture; get all three low and seed can last for years.\n\nLabel every envelope with crop, variety, and date saved. Store in a cool, dark, dry place — a sealed container with a little rice or dried milk powder as a moisture absorber works well.\n\nBefore a new planting season, test a small batch for germination so you're not relying on seed that's quietly lost its viability.\n\nOrganise a seed swap with neighbours this season. What one household saves well, several households can share — and the whole group's variety diversity grows with every swap.",
        keyPoints: [
          "Dry seed in shade with good airflow; never in direct sun or sealed heat",
          "Store labelled seed cool, dark, and dry — heat, light, and moisture are the three enemies of viability",
          "Test a small batch for germination before relying on stored seed for planting",
          "Seed swaps grow everyone's variety diversity faster than saving alone",
        ],
        quiz: [
          {
            q: "What are the three main enemies of stored seed viability?",
            options: [
              "Wind, insects, and fungus",
              "Heat, light, and moisture",
              "Cold, darkness, and dryness",
              "Soil contact, pests, and rodents",
            ],
            correct: 1,
            rationale: "Keeping seed cool, dark, and dry directly counters all three — which is exactly why a sealed container in a shaded cupboard works so well.",
          },
          {
            q: "Why test a small batch of stored seed for germination before planting season?",
            options: [
              "It's a legal requirement for seed sharing",
              "Seed can quietly lose viability in storage, and testing avoids relying on seed that won't grow",
              "It improves the seed's flavour",
              "It's only necessary for hybrid seed",
            ],
            correct: 1,
            rationale: "A germination test catches seed that's died in storage before you've committed a whole season's planting to it.",
          },
        ],
      },
    ],
  },
  {
    "id": "plant-guilds",
    "title": "Plant Selection & Guilds",
    "description": "Choose useful plant partners, return mulch and manage the guild as trees grow.",
    "durationMins": 20,
    "category": "plants",
    "lessons": [
        {
            "id": "plant-guilds-l1",
            "title": "Nitrogen Fixers: Choose and Manage Support Plants",
            "body": "These bacteria convert nitrogen from the air into forms the legume can use.\n\nFind nodules on a spare legume plant. Nodulation and growth depend on the plant, suitable bacteria and growing conditions.\n\nReturn suitable leafy prunings, fallen leaves and crop residues as mulch. Soil organisms release nutrients during decomposition.\n\nThis takes time. A living legume is not an instant fertiliser pipe into the fruit tree.\n\nIt is indigenous to KwaZulu-Natal. In suitable warm conditions, manage this short-lived shrub or small tree as a support plant.\n\nAllow room for its growth. Prune for mulch and reassess it when shade or water competition increases.\n\nSesbania punicea is the invasive red sesbania. Its pods have four lengthwise wings. Confirm identity using reliable botanical guidance.\n\nCheck the full name before planting. Respect the agreed project species list, including any restriction on Sesbania sesban.\n\nUse a sunny, freely draining position. It is a short-lived support shrub; frost and waterlogging can limit it.\n\nDecide whether each plant mainly supplies peas or leafy material. Frequent severe cutting can damage it and reduce the food harvest.\n\nCowpea covers sunny gaps. Pigeon pea provides food and leafy material. Managed Sesbania sesban can supply taller temporary support.\n\nAdd suitable flowering and mulch plants. Keep the mango trunk clear and manage light, water and access.\n\nCount woody supports across the spaces between fruit trees. Sow suitable ground cover by area.\n\nThere is no universal number per fruit tree. Adjust density to water, soil, plant size and your ability to prune and thin.",
            "keyPoints": [
                "Legumes work with rhizobia in root nodules; fixation depends on suitable conditions.",
                "Return useful cut material to the soil; nutrient release takes time.",
                "Use suitable seasonal cover, support shrubs and temporary trees.",
                "Manage support density as plants grow; there is no universal count per fruit tree."
            ],
            "quiz": [
                {
                    "q": "When does nitrogen in cut legume material become available to other plants?",
                    "options": [
                        "Immediately when it is cut",
                        "As soil organisms decompose the material",
                        "Only when the fruit tree touches the legume",
                        "It can never become available"
                    ],
                    "correct": 1,
                    "rationale": "Decomposition releases nutrients over time. The rate depends on the material and growing conditions."
                },
                {
                    "q": "What should decide how many support plants you establish?",
                    "options": [
                        "The same fixed number at every site",
                        "Water, soil, plant size and the care you can provide",
                        "Always placing every support uphill",
                        "Planting as many trees as will physically fit"
                    ],
                    "correct": 1,
                    "rationale": "Support plants need resources and management too. Observe growth and competition, then adjust."
                }
            ],
            "infographicUrl": "/course-decks/plant-guilds/en/slide-15.jpg",
            "infographicAlt": "Conceptual guild teaching illustration; confirm plant identity with reliable botanical guidance."
        },
        {
            "id": "plant-guilds-l2",
            "title": "Mulch Plants and Helpful Insects",
            "body": "The clip shows a branch cut: the support tree remains standing. Leave enough healthy foliage for the plant to recover.\n\nMatch cutting to the species. Avoid frequent severe cuts on pigeon pea, especially when growing it for peas.\n\nMulch protects the surface, helps conserve moisture and returns organic material.\n\nLeave access for watering and inspection. Cut material into manageable pieces and keep observing moisture and decomposition.\n\nObtain the correct cultivar. Bocking 14 does not spread by viable seed, but root pieces can regrow.\n\nPlace it where it has room and sufficient moisture. Cut leaves as it recovers; do not crowd the young fruit tree.\n\nMany ladybirds eat aphids; some parasitoid wasps attack crop pests. Flowering members such as African basil can add resources.\n\nWatch which insects visit and whether damage changes. A flowering plant does not guarantee pest control.\n\nTulbaghia violacea has narrow leaves and lilac flowers. Place a clump where it has light and room to grow.\n\nObserve visiting insects. Do not promise that a ring of wild garlic will repel pests or cure an outbreak.",
            "keyPoints": [
                "Pruning cuts branches while keeping the support plant.",
                "Return suitable cut leaves as mulch while keeping the trunk clear.",
                "Bocking 14 does not spread by viable seed, but root pieces can regrow.",
                "Flowering plants can support useful insects; watch actual visits and crop damage."
            ],
            "quiz": [
                {
                    "q": "What does the branch-cutting clip show?",
                    "options": [
                        "Removing the whole support tree",
                        "Pruning a retained support tree for light and mulch",
                        "Harvesting the fruit tree",
                        "Proof that root competition has stopped"
                    ],
                    "correct": 1,
                    "rationale": "A branch falls, while the support tree remains standing. That is pruning and chop-and-drop."
                },
                {
                    "q": "How should you assess flowering plants used to support helpful insects?",
                    "options": [
                        "Assume they will eliminate pests",
                        "Observe insect visitors and changes in crop damage",
                        "Remove all flowers before they open",
                        "Count every flowering plant as a nitrogen fixer"
                    ],
                    "correct": 1,
                    "rationale": "Flowers can supply resources, but their presence does not guarantee pest control."
                }
            ],
            "infographicUrl": "/course-decks/plant-guilds/en/slide-29.jpg",
            "infographicAlt": "Conceptual guild teaching illustration; confirm plant identity with reliable botanical guidance."
        },
        {
            "id": "plant-guilds-l3",
            "title": "Build a Guild and Adjust It as It Grows",
            "body": "Combine the support functions your site needs: nitrogen fixation, food, mulch, flowers and ground cover. Some plants serve several functions.\n\nKeep the trunk area and path open. Reassess each member as the mango and its neighbours grow.\n\nKeep its vines away from the young fruit tree and retain a route for care. Its roots also use water and nutrients.\n\nWhere resources are tight, compare living cover with an ordinary mulch basin.\n\nPlant into a suitable season, mulch and maintain establishment water. Keep the access gap open.\n\nStart with the number of support plants you can care for. Observe survival and growth before adding more.\n\nCut down selected competing supports to open space. Suitable cut material can stay as mulch: this is thinning through chop-and-drop.\n\nManage regrowth to keep the opening. Check light, soil moisture and growth; thinning does not instantly stop root competition.\n\nCarry useful prunings back to established trees. Keep nearby plants only where they still perform well.\n\nMature fruit trees still need nutrients. Monitor growth, harvest and soil conditions; support plants do not remove that need.\n\nCheck fruit-tree growth, shade, soil moisture, useful harvests and pest damage. Note what was cut, returned or removed.\n\nUse these observations to change the layout and care. A plant earns its place through what it does here.",
            "keyPoints": [
                "Give each plant a useful role while protecting the fruit tree's space.",
                "Living ground cover also competes for water and nutrients.",
                "Thin selected whole support plants when pruning no longer gives enough room.",
                "Suitable cut biomass can stay as mulch; manage regrowth to retain the opening."
            ],
            "quiz": [
                {
                    "q": "A support plant still crowds the mango after pruning. What can thinning involve?",
                    "options": [
                        "Only cutting another small twig",
                        "Cutting down a selected competing support and managing regrowth",
                        "Removing the mango instead",
                        "Always carrying all cut biomass off the site"
                    ],
                    "correct": 1,
                    "rationale": "Thinning reduces selected standing support plants. Suitable cut material may stay as mulch."
                },
                {
                    "q": "Is sweet potato always better than a mulch basin around a young fruit tree?",
                    "options": [
                        "Yes, because it never uses water",
                        "Yes, because it fixes nitrogen",
                        "No; compare its food and cover benefits with competition for resources",
                        "No, because no ground cover can ever be useful"
                    ],
                    "correct": 2,
                    "rationale": "Choose cover for the site. Keep access and the trunk area clear, and observe the young tree."
                }
            ],
            "infographicUrl": "/course-decks/plant-guilds/en/slide-37.jpg",
            "infographicAlt": "Conceptual guild teaching illustration; confirm plant identity with reliable botanical guidance."
        }
    ]
  },
  {
    id: "food-forest",
    title: "Food Forest Design",
    description: "Layer a multi-storey food system from tall canopy right down to root crops.",
    durationMins: 25,
    category: "design",
    lessons: [
      {
        id: "food-forest-l1",
        infographicUrl: "/course-images/food-forest/food-forest-l1.jpg",
        infographicAlt: "A food forest cut through from the side, showing seven layers stacked from tall canopy trees down through smaller trees, shrubs, herbs and ground cover, with root crops below the soil line and a climber on a trunk. Sunlight reaches down between the layers.",
        title: "The Seven Layers: How a Forest Feeds Itself",
        body: "An indigenous forest fills every vertical layer with different plants, each using the light and moisture available at its level. A food forest copies this using productive species instead. The seven layers: tall canopy (10m+), sub-canopy (4-8m), shrub (1-3m), herbaceous (under 1m), ground cover, root crops, and climbers using vertical space.\n\nFor a Highveld example: canopy might be a large Wild Fig or pecan; sub-canopy carries lemon, naartjie, and black mulberry; shrub layer holds Cape gooseberry and indigenous Wild Medlar; herbaceous layer holds vegetables and wild garlic; ground cover is sweet potato; climbers include granadilla.\n\nOnce established, a food forest needs far less labour than a vegetable garden the same size — no annual ploughing, no repeated planting. The first two to three years need real establishment work. By year three to five, the canopy closes and the system starts largely caring for itself.",
        keyPoints: [
          "Seven layers: canopy, sub-canopy, shrub, herbaceous, ground cover, root crops, climbers",
          "Each vertical layer uses different light and moisture, so layers don't compete with each other",
          "The first 2-3 years need real establishment work; by year 3-5 the system largely runs itself",
          "Pecan, black mulberry, Wild Plum, loquat, and quince are practical Highveld species",
        ],
        quiz: [
          {
            q: "A food forest has all seven layers planted. Which layer struggles most and needs the most attention in years 1-2?",
            options: [
              "Tall canopy trees, exposed to wind and frost",
              "The climbing layer, which grows too fast",
              "Herbaceous and ground cover layers, competing with weeds before canopy closes",
              "The root layer, blocked by tree roots",
            ],
            correct: 2,
            rationale: "Before the canopy closes and shades out competition, the low layers are fighting weeds on open, sunlit ground — that's where the establishment labour goes.",
          },
          {
            q: "Why is an established food forest more water-efficient than an annual vegetable garden of the same size, over ten years?",
            options: [
              "Deeper roots reach groundwater unavailable to vegetables",
              "Closed canopy and deep leaf-fall mulch cut evaporation, and the mixed root system holds more soil moisture",
              "Perennials use less water per kilogram of food",
              "Food forests need no irrigation at all",
            ],
            correct: 1,
            rationale: "Shade and mulch both reduce moisture loss from the soil surface — a compounding effect that a bare annual bed doesn't get.",
          },
        ],
      },
      {
        id: "food-forest-l2",
        infographicUrl: "/course-images/food-forest/food-forest-l2.jpg",
        infographicAlt: "A simple shape of South Africa divided into three growing areas by ground colour and terrain alone: a pale high inland plateau with hills, a green humid coastal strip, and a hot red-brown low-lying area. Different tree shapes stand in each.",
        title: "Species Selection for South African Food Forests",
        body: "Match species to your region before you plant — a mango that thrives on the KZN coast dies at the first Highveld frost, and a quince needing winter chill won't fruit in a frost-free coastal belt. Know your rainfall, minimum winter temperature, frost frequency, and summer humidity first.\n\nHighveld: canopy — pecan, walnut, indigenous fig; sub-canopy — apple, pear, plum, black mulberry, loquat, not in the Western Cape or forest biome; shrubs — rosemary, Wild Medlar, Cape gooseberry, Barbados cherry.\n\nKZN coast and Lowveld: canopy — mango, avocado, Natal Mahogany; sub-canopy — banana, pawpaw, litchi, Wild Fig; shrubs — Barbados cherry, Wild Dagga.\n\nLimpopo Lowveld: Marula, Mopane, baobab where appropriate — all edible and culturally significant.\n\nAim for at least 30% indigenous species throughout. They support the birds and insects that make a food forest function as an ecosystem, not just a fruit collection.",
        keyPoints: [
          "Match species to your frost zone, rainfall, and humidity before planting",
          "Highveld suits pecan, apple, black mulberry, Cape gooseberry, and indigenous figs",
          "KZN coast and Lowveld suits mango, avocado, banana, litchi, and Natal Mahogany",
          "Aim for at least 30% indigenous species to support birds, insects, and ecosystem function",
        ],
        quiz: [
          {
            q: "A Highveld farmer plants a young mango in a sheltered north-facing spot. What's the likely outcome after the first Highveld winter?",
            options: [
              "It thrives — the position offsets frost",
              "It fruits early from the temperature swings",
              "It's likely killed or badly damaged by frost, especially as a young tree",
              "It survives with heavy mulch but needs annual replacement",
            ],
            correct: 2,
            rationale: "No sheltered position on the Highveld reliably protects a young mango from a hard frost — it's simply the wrong species for that climate.",
          },
          {
            q: "Why does 30% indigenous species matter in a South African food forest?",
            options: [
              "Indigenous species produce more food per square metre",
              "They attract the birds and insects providing pest control, pollination, and seed dispersal, making the system more resilient",
              "Exotic species aren't legally permitted on smallholdings",
              "Indigenous species need less irrigation",
            ],
            correct: 1,
            rationale: "Local birds and insects evolved alongside indigenous plants — bringing enough of them into the system is what makes the ecosystem services actually function.",
          },
        ],
      },
      {
        id: "food-forest-l3",
        infographicUrl: "/course-images/food-forest/food-forest-l3.jpg",
        infographicAlt: "The same patch of ground at four stages, left to right: cardboard and mulch going down on bare soil, then fast low pioneer plants, then young canopy trees with lower layers filling in, and finally a settled layered planting.",
        title: "Establishing a Food Forest: Planting Sequence and Timeline",
        body: "A food forest is planted in sequence, not all at once, mimicking how nature rebuilds bare ground. First come nitrogen-fixing pioneers to improve soil and offer some shade. Then the main canopy and sub-canopy fruit trees. Then the lower layers, once the canopy gives some protection. Climbers and ground covers come last.\n\nFor a 500m² plot: year one, sheet-mulch with cardboard and 20cm of wood chips, plant pioneers at 2m spacing, and start a nursery. Year two, plant your main fruit trees and interplant comfrey and wild garlic beneath. Years three to four, thin the pioneers, the cuttings become mulch, as fruit trees take over. By year five, expect real harvests with minimal outside inputs.\n\nPlant at the start of the rainy season so rain does your establishment watering. Never plant into dry soil — transplant shock plus drought stress rarely allows recovery.",
        keyPoints: [
          "Plant in sequence: pioneers first, then canopy trees, then lower layers, then climbers",
          "Sheet mulch with cardboard and wood chips at the start — smothers grass, feeds soil",
          "Plant at the start of the rainy season so rain does the establishment watering",
          "A 500m² Highveld food forest can produce real harvests by year 5",
        ],
        quiz: [
          {
            q: "A farmer sheet-mulches a 500m² plot with cardboard and wood chips in September, before the rains. What's the cardboard's main job?",
            options: [
              "Creating a moisture barrier that blocks water from the soil",
              "Smothering existing grass while it decomposes and feeds soil organisms over following months",
              "Providing a stable base so wood chips don't shift",
              "Reflecting heat upward to warm the soil",
            ],
            correct: 1,
            rationale: "Cardboard cuts off light to existing grass, killing it, and then breaks down itself — feeding the soil rather than blocking it long-term.",
          },
          {
            q: "Why are pioneer nitrogen fixers planted first, then thinned in years 3-4?",
            options: [
              "They're the most expensive and need the longest growing period",
              "They improve soil fertility and shelter the fruit trees, then get removed before competing too hard for light",
              "They must be removed before setting seed or spreading",
              "Their roots inhibit fruit tree growth after 3 years",
            ],
            correct: 1,
            rationale: "Pioneers do their soil-building job early, then start competing with the maturing fruit trees for light — thinning at that point captures the benefit without the downside.",
          },
        ],
      },
    ],
  },
  {
    id: "small-livestock",
    title: "Small Livestock Integration",
    description: "Chickens, ducks and bees as system components — not afterthoughts.",
    durationMins: 20,
    category: "foundation",

    lessons: [
      {
        id: "small-livestock-l1",
        infographicUrl: "/course-images/small-livestock/small-livestock-l1.jpg",
        infographicAlt: "A moveable chicken pen shown in two positions along a strip of ground, with an arrow showing it being moved on. The ground it has left is scratched over and enriched.",
        title: "Chickens in the System: Pest Control, Fertility, and Food",
        body: "Chickens can help an empty bed after harvest. They scratch through plant remains and eat some insects and weed seeds. Their manure and bedding can be composted and returned to the soil. Foraging does not replace a balanced diet, clean water, shelter or daily care.\n\nA chicken tractor is a moveable, floorless pen. Move it before the ground becomes bare, muddy or heavily covered with manure. The right time depends on the birds, soil and weather. There is no single number of chickens that guarantees enough fertility for every plot.\n\nKeep chickens away from seedlings and crops being harvested for food. Fresh manure can carry germs. Ask an extension adviser how to manage manure safely before the next crop. Ducks scratch less, but can still damage plants and make wet ground muddy. Watch the birds and move them when needed.",
        keyPoints: [
          "Move the pen before birds damage the ground or manure builds up",
          "Match bird numbers and manure use to your soil, crops and feed supply",
          "Only put chickens in a bed after harvest — never around young seedlings",
          "Ducks scratch less, but still need supervision around plants and wet soil",
        ],
        quiz: [
          {
            q: "You want chickens to prepare an empty bed for replanting. When's the right time to put them in?",
            options: [
              "Right after planting seedlings, so they loosen soil around them",
              "After harvest, once the bed is cleared, before the next planting",
              "During the growing season once the canopy can withstand scratching",
              "Only in winter to avoid heat stress",
            ],
            correct: 1,
            rationale: "Use an empty bed after harvest. Keep fresh manure away from food crops and plan safe manure handling before replanting.",
          },
          {
            q: "Why are ducks better suited than chickens to an established food forest understorey?",
            options: [
              "Ducks produce more manure per day",
              "Ducks eat slugs and snails without the heavy scratching that disturbs roots and mulch",
              "Ducks are immune to Newcastle disease",
              "Ducks roost in trees, reducing ground compaction",
            ],
            correct: 1,
            rationale: "Ducks do not scratch like chickens. They can still trample or eat plants, so watch the ground and move them when needed.",
          },
        ],
      },
      {
        id: "small-livestock-l2",
        infographicUrl: "/course-images/small-livestock/small-livestock-l2.jpg",
        infographicAlt: "A beehive cut open showing the stacked frames inside, and a wide circle over a farm map showing how far the bees travel to forage.",
        title: "Bees: Pollination, Honey, and System Ecology",
        body: "Honeybees and other insects carry pollen between flowers. This helps many fruit and vegetable crops, including avocado. Different crops and varieties have different pollination needs. A hive does not guarantee higher yields everywhere: weather, water, plant health and other pollinators also matter.\n\nSouth Africa has two native honeybee subspecies: the Cape bee in the southern and south-western Cape, and the African honeybee across the north and east. Learn from an experienced local beekeeper before getting a hive. Keep hives away from busy paths, homes and places where children play. Morning sun can help; a safe location comes first.\n\nProvide flowering plants through the seasons and avoid exposing bees to pesticides. Active bees do not prove that the farm is free of chemicals or disease. All beekeepers must register with the national Department of Agriculture. Check the current rules before moving bees or hives. If a colony swarms repeatedly, ask a trained beekeeper to inspect it. Crowding is one possible cause, not a diagnosis.",
        keyPoints: [
          "Pollinators help many crops; the benefit depends on the crop and conditions",
          "Learn safe hive care from an experienced local beekeeper",
          "Choose a safe hive site away from busy paths and children",
          "All beekeepers must register with the national Department of Agriculture",
        ],
        quiz: [
          {
            q: "Avocado trees flower but set little fruit. What should the farmer check about pollination?",
            options: [
              "Assume pollination is always enough and check nothing",
              "Assume only one type of beetle can carry pollen",
              "Check whether insects are visiting flowers and carrying pollen; other causes of poor fruit set also need checking",
              "Assume poor fruit set always means frost damage",
            ],
            correct: 2,
            rationale: "Bees and other insects can move pollen between avocado flowers. Few visits can limit pollination, but weather and plant condition can also affect fruit set.",
          },
          {
            q: "A hive has swarmed repeatedly. What is the best next step?",
            options: [
              "Ask a trained beekeeper to inspect the colony, including space, queen and health",
              "Replace the queen without inspecting the colony",
              "Assume nothing can be checked or managed",
              "Turn the hive around without finding the cause",
            ],
            correct: 0,
            rationale: "Crowding can encourage swarming, but it is not the only cause. Inspection guides the response; adding space is not a guaranteed cure.",
          },
        ],
      },
      {
        id: "small-livestock-l3",
        infographicUrl: "/course-images/small-livestock/small-livestock-l3.jpg",
        infographicAlt: "A closed loop of four steps: animals produce manure, manure becomes compost, compost feeds the growing area, and the growing area feeds the animals.",
        title: "Integrating Livestock Cycles: Closing the Loop",
        body: "Animals can return some nutrients to the farm. Chickens eat suitable farm produce and insects, and manure can become compost for crops. Keep track of feed bought in and food sold or taken home. These nutrients still enter or leave the system. Scraps alone may not meet the animals' needs.\n\nGuinea fowl forage for insects and may eat ticks. Do not rely on them to protect people or livestock from ticks or tick-borne disease. Check animals and follow a local animal-health plan.\n\nFor each animal, ask: what can it eat here? What useful things does it produce? What else does it need? Include water, suitable feed, shelter, fencing and daily care.\n\nChickens following goats are not a proven replacement for goat worm control. Grazing management can help, but goats still need health checks and a parasite plan from a veterinary or animal-health adviser. Do not stop treatment because chickens have visited the grazing camp.",
        keyPoints: [
          "Use suitable farm resources while meeting the full needs of each animal",
          "Guinea fowl foraging does not replace tick checks or an animal-health plan",
          "Ask what each animal eats, produces and needs, including any bought inputs",
          "Do not replace goat worm control with chickens following the herd",
        ],
        quiz: [
          {
            q: "A farmer keeps guinea fowl. How should she manage ticks on her livestock?",
            options: [
              "Stop checking livestock because birds are present",
              "Keep checking animals and follow a local animal-health plan",
              "Assume ducks remove every tick",
              "Treat every animal without checking the problem or getting advice",
            ],
            correct: 1,
            rationale: "Birds may eat ticks, but that does not establish reliable protection from ticks or the diseases they carry.",
          },
          {
            q: "Chickens have foraged behind the goats. What should the farmer do about goat worms?",
            options: [
              "Continue health checks and the parasite plan agreed with an animal-health adviser",
              "Stop all worm checks because chickens were present",
              "Assume chicken manure kills every worm egg",
              "Assume moving the herd always makes treatment unnecessary",
            ],
            correct: 0,
            rationale: "Chickens are not a proven replacement for goat worm control. Grazing management and animal-health checks must work together.",
          },
        ],
      },
    ],
  },
  {
    id: "market-community",
    title: "Market Gardening & Community",
    description: "Record-keeping, selling surplus and building local food networks.",
    durationMins: 20,
    category: "business",
    lessons: [
      {
        id: "market-community-l1",
        infographicUrl: "/course-images/market-community/market-community-l1.jpg",
        infographicAlt: "A simple ruled record sheet with columns for what was harvested and where it went, beside a pile of harvested produce.",
        title: "Record-Keeping: Knowing What Your Farm Is Actually Producing",
        body: "Most smallholders undersell what their farm produces because they've never recorded it. Write down every kilogram of tomatoes, every dozen eggs, every bundle of morogo, and where it went — family, sold, gifted, composted — and your farm starts looking like an economy, not just a garden.\n\nOne season of records answers the questions that matter: which crops yield best per bed? Which cost more in seeds, water and compost than they return? Which months leave you buying food?\n\nFor pricing, records reveal your true cost of production. Selling below that cost because a neighbour charges less isn't competition, it's a loss draining your household. A simple cost sheet, including an honest hourly rate for your own labour, shows your real minimum price.",
        keyPoints: [
          "Record every harvest and where it went — family, sold, gifted, or composted",
          "One season of records shows which crops give the best return per bed and per hour",
          "Calculate your true cost of production before setting any selling price",
          "Records reveal which months you're food-insecure, guiding next season's planting",
        ],
        quiz: [
          {
            q: "A farmer sells tomatoes at R15/kg but her records show they cost R18/kg to produce. What should she do?",
            options: [
              "Keep selling at R15 — short-term loss builds relationships",
              "Stop growing tomatoes entirely",
              "Raise the price to at least R18, cut input costs, or shift labour to better crops",
              "Apply for a subsidy to cover the gap",
            ],
            correct: 2,
            rationale: "Selling below cost is a loss whatever the volume — the record shows exactly where the gap is, and there are three real ways to close it.",
          },
          {
            q: "A farmer's records show she's short of vegetables every June and July. What's the useful action here?",
            options: [
              "Buy vegetables at market each June and July",
              "Plant cold-tolerant winter crops in March-April so they're ready in June-July",
              "Accept her farm can't produce in winter",
              "The records show a soil fertility problem",
            ],
            correct: 1,
            rationale: "The record identifies exactly when the gap happens, which means she can plant specifically to fill it, months in advance.",
          },
        ],
      },

      {
        id: "market-community-l2",
        infographicUrl: "/course-images/market-community/market-community-l2.jpg",
        infographicAlt: "Three ways to sell from one farm: a roadside stall, a group delivery to a shop, and a box going straight to a household.",
        title: "Selling Surplus: Where to Sell and How to Price",
        body: "Know your customer before you sell. A formal farmers' market may pay premium prices but demands registration and a consistent weekly supply. An informal market or taxi rank stall pays less but asks nothing of you in return. A school or clinic buying direct may pay below retail but offers a stable, predictable order.\n\nDirect selling — door to door, a WhatsApp order group, weekly deliveries — usually pays best, since you keep the full price with no middleman. A box scheme, where customers subscribe to a regular vegetable box, gives predictable income and lets you plan production around real demand. Ten regular box customers can provide meaningful monthly income from a 200 to 500m² garden.\n\nTrust, built through farm visits and an honest reputation, matters more than expensive organic certification for most smallholders.",
        keyPoints: [
          "Match your selling channel to your customer — formal market, informal, direct, or box scheme",
          "Direct and box scheme sales remove the middleman and keep more of the price for you",
          "Ten regular box customers can provide meaningful income from a 200-500m² garden",
          "Community trust from farm visits often matters more than costly certification",
        ],
        quiz: [
          {
            q: "A smallholder has inconsistent weekly production — surplus some weeks, little in others. Which channel suits her best?",
            options: [
              "A formal market stall needing consistent weekly supply",
              "A box scheme needing the same produce weekly",
              "An informal market or neighbour sales with no fixed commitment",
              "A daily-delivery school contract",
            ],
            correct: 2,
            rationale: "This is the one channel that doesn't require her to promise a fixed amount every week — she sells what she actually has.",
          },
          {
            q: "Why can a box scheme be worth more than a market stall, even at similar prices per kilogram?",
            options: [
              "Box customers always pay more per kilogram",
              "Box schemes let you charge extra for packaging",
              "Committed subscription income lets you plan production around real demand instead of growing speculatively",
              "Box schemes avoid tax obligations",
            ],
            correct: 2,
            rationale: "The value here isn't the price — it's knowing in advance what you need to grow, instead of guessing and hoping it sells.",
          },
        ],
      },
      {
        id: "market-community-l3",
        infographicUrl: "/course-images/market-community/market-community-l3.jpg",
        infographicAlt: "Five small farms linked to one shared central point, where their separate harvests combine into one much larger crate.",
        title: "Building Community Food Networks: Strength in Numbers",
        body: "No smallholder farm stands alone. A seed swap between five neighbours turns five households' seed diversity into twenty-five, because each grower can focus on saving a few varieties well rather than many poorly. Tool sharing puts expensive items — a water pump, a grain mill — within reach of everyone.\n\nLocal food networks, whether a formal cooperative or an informal WhatsApp group, create demand close to home. Roughly a third of fresh fruit and vegetables grown by smallholders is lost between harvest and sale, from poor transport, packaging, and storage delays. Selling within walking distance removes most of that loss entirely.\n\nSkill sharing matters as much as material sharing. A farmer who's mastered grafting, or managing fungal disease in humid KZN summers, can transform ten neighbours' farms by teaching it. Document what you learn and pass it on.",
        keyPoints: [
          "Seed swaps between neighbours multiply variety diversity with the same total effort",
          "Tool sharing puts expensive equipment within reach of an entire group",
          "About a third of smallholder fruit and vegetables is lost between harvest and sale — local selling avoids most of this",
          "Monthly skills swaps build knowledge more durably than any single expert consultation",
        ],
        quiz: [
          {
            q: "Five smallholders each save three tomato varieties alone, or agree that each saves two varieties for the whole group. Which produces better seed?",
            options: [
              "Each saving alone, for full control",
              "Collective saving — each farmer specialises and gives fuller attention to isolation, selection, and storage",
              "Both approaches give the same result",
              "Collective saving only works with a shared seed bank",
            ],
            correct: 1,
            rationale: "Specialising in fewer varieties means more attention per variety — better isolation, better selection, better stored seed for everyone in the group.",
          },
          {
            q: "A smallholder's nearest formal market is 60km away, costing R150 in transport for 50kg of beans sold at R8/kg. What community network approach improves this?",
            options: [
              "Grow 100kg instead to justify the transport cost",
              "Process the beans to add value and justify the trip",
              "Sell locally via a WhatsApp group or community market, cutting the R150 transport cost and possibly getting R10/kg",
              "Join a cooperative for bulk transport rates",
            ],
            correct: 2,
            rationale: "Selling close to home removes the transport cost entirely and can even fetch a better price — the two biggest levers, solved together.",
          },
        ],
      },
    ],
  },
];

export const CATEGORY_COLORS: Record<ModuleCategory, string> = {
  foundation: "#1F4D2B",
  water:      "#235E86",
  soil:       "#8B5E3C",
  plants:     "#2D6B3C",
  design:     "#C07A1E",
  business:   "#5C5040",
  seeds:      "#B8860B",
};

export const TOTAL_MODULES = COURSE_MODULES.length;

/**
 * Flat lookup, built once at import time: lesson id -> the lesson plus the id of the module
 * that owns it. Exists so callers that only have a lesson id in hand — the student page's
 * "related lessons" row jumping between accordion sections, or a test checking a cross-link
 * resolves — don't each need to walk COURSE_MODULES themselves.
 */
export const LESSON_INDEX: Map<string, { lesson: Lesson; moduleId: string }> = new Map(
  COURSE_MODULES.flatMap((m) => m.lessons.map((l) => [l.id, { lesson: l, moduleId: m.id }] as const)),
);

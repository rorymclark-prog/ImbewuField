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
            q: "Your borehole serves your household. Neighbours ask for water too. Which action best reflects all three ethics?",
            options: [
              "Sell access to the highest bidder",
              "Keep all the borehole water for a larger irrigation area",
              "Find out if sharing is allowed and if the borehole can serve all users. Only then agree how to share fairly and keep watching the water level.",
              "Cap the borehole to preserve groundwater only",
            ],
            correct: 2,
            rationale: "First find out what water use is allowed and whether the source can serve all users without taking too much. If sharing is allowed and there is enough water, agree how to share fairly. Monitoring helps you notice change; it does not give permission to take more water.",
          },
        ],
      },
      {
        id: "intro-permaculture-l2",
        infographicUrl: "/course-images/intro-permaculture/intro-permaculture-l2.jpg",
        infographicAlt: "Twelve design principles arranged as segments around a central seedling, each shown as a simple picture — an eye for observing, a droplet for catching water, a sun for energy, a loop for returning waste.",
        title: "Twelve Principles: Designing with Nature",
        body: "David Holmgren set out twelve design principles in Essence of Permaculture. Bill Mollison and David Holmgren co-originated the permaculture concept. Three useful starting points for this lesson are: observe and interact — watch your land through a full season before major earthworks; catch and store energy — notice rain, sun and biomass before they leave your property; and use edges and value the marginal — a fence line or strip beside a path can be a useful place to observe.\n\nOthers worth knowing: produce no waste (scraps become compost, compost becomes soil), use small and slow solutions (a bucket can irrigate a bed without electricity), and use and value diversity. Hail injury to maize depends on the storm and the crop’s growth stage.\n\nPick two or three principles that speak to your biggest problem and apply them hard. The rest become obvious as you go.",
        keyPoints: [
          "Observe your land for a full season before major earthworks",
          "Catch and store rain, sun, and biomass before they leave your property",
          "Edges and margins can be useful places to observe what grows well",
          "Hail injury to maize depends on the storm and the crop’s growth stage",
        ],
        quiz: [
          {
            q: "A farmer wants to dig swales to harvest rainwater. What should she do first, following 'observe and interact'?",
            options: [
              "Dig immediately after the first good rain",
              "Watch where water flows and pools across at least one wet season",
              "Copy a neighbour's swale layout",
              "Assume the same swale design fits every site",
            ],
            correct: 1,
            rationale: "A wet season shows more than one storm, but observation is only a first step. Check the soil, slope, drainage and safe overflow route with a trained local adviser before digging.",
          },
          {
            q: "Which layout best applies 'integrate rather than segregate'?",
            options: [
              "Chickens penned far from the garden",
              "Garden, fruit trees and a chicken run arranged so chickens use an empty bed after harvest, then the farmer checks safe management before edible crops return",
              "Separate paddocks for each crop",
              "All animals kept off the cultivated zone",
            ],
            correct: 1,
            rationale: "Integration puts each element to work for its neighbours — here, chickens clean up pests and add fertility instead of sitting idle in a fixed pen. Fresh manure can carry germs, so check safe management before edible crops return.",
          },
        ],
      },
      {
        id: "intro-permaculture-l3",
        infographicUrl: "/course-images/intro-permaculture/intro-permaculture-l3.jpg",
        infographicAlt: "Rings spreading outward from a house. The ring closest to the door is tended every day; each ring further out is visited less often and left wilder.",
        title: "Zones and Sectors: Organising Your Farm by Energy",
        body: "Zones and sectors help you cut wasted labour. Zones run 0 to 5 by how often you visit. Zone 0 is the house. In this example, Zone 1 is near the house and holds what you pick often — herbs, salad greens. Zone 2 is the main garden and chicken run, visited once or twice a day. Zone 3 is the main field, visited weekly. Zone 4 is semi-wild — fruit trees and fodder needing occasional attention. Zone 5 is left wild.\n\nSectors are the energies arriving from outside — sun, wind, rain, flood, fire. Watch where strong wind comes from on your farm. Nearby weather-station records can help you check wind direction. Watch where rainwater enters and flows across your land. Draw arrows for what you observe.\n\nSketch zones and sectors on paper and you have the skeleton of your design.",
        keyPoints: [
          "In this example, Zone 1 near the house holds often-picked herbs",
          "Zones organise labour by how often you need to visit",
          "Sectors map incoming sun, wind, rainwater, flood and fire",
          "A simple sketch of zones and sectors is enough to start designing",
        ],
        quiz: [
          {
            q: "You plant herbs in Zone 3, the main field far from the house. What problem does this create?",
            options: [
              "Herbs grow too large",
              "The extra walk may mean you pick or check them less often",
              "Herbs cross-pollinate with main crops",
              "Zone 3 gets too much sun for herbs",
            ],
            correct: 1,
            rationale: "Put a crop you pick often near a daily path. A distant bed adds walking and may be checked less often.",
          },
          {
            q: "You observe damaging wind coming from the north-west on a Highveld farm. Where should a windbreak go?",
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
        body: "Before you harvest water, learn where it already goes. Watch from a safe place during heavy rain. When it is safe afterward, walk your land. Look for rills, places where water fans out, where it ponds, and where it leaves your property. Some excess water needs a safe route away so it does not cause damage.\n\nAn A-frame level can help you mark points at the same height and trace a contour line. Its marks are an observation, not a design or approval for earthworks. Before digging a swale, dam, or other structure, have the site assessed. Soil, slope, drainage, storm flow, and a safe overflow route all matter. Ask a trained local adviser.\n\nThere is no one placement rule for every slope. Observe where water moves and gathers. Poorly laid contours can increase erosion, and soil that takes in water slowly can hold too much. Choose any water works for the site and plan a safe route for excess water.",
        keyPoints: [
          "Watch from a safe place during rain, then walk the land when it is safe",
          "An A-frame can mark points at the same height, but it does not show whether earthworks are suitable",
          "Water works and safe overflow routes need a site assessment",
          "Some excess water needs a safe route away to prevent damage",
        ],
        quiz: [
          {
            q: "What can an A-frame level help you find?",
            options: [
              "Points at the same height along a contour",
              "Whether a swale is safe to build on this slope",
              "How much stormwater the soil can absorb",
              "Where a dam spillway should be built",
            ],
            correct: 0,
            rationale: "An A-frame can help mark points at the same height. It does not assess soil, drainage, storm flow, or whether earthworks are suitable.",
          },
          {
            q: "You observe fast runoff on a sloped KZN site. What should you do before digging a water structure?",
            options: [
              "Put it as high on the slope as possible",
              "Check the soil, slope, drainage and storm flow, and plan a safe overflow with a trained local adviser",
              "Put it wherever water first appears",
              "Follow the same high, middle and bottom rule used on other farms",
            ],
            correct: 1,
            rationale: "A placement rule cannot show whether a structure suits the site. Poorly laid contours can increase erosion, and excess water needs a safe route.",
          },
        ],
      },
      {
        id: "reading-landscape-l2",
        infographicUrl: "/course-images/reading-landscape/reading-landscape-l2.jpg",
        infographicAlt: "A slope with the sun in the north. Shadows from the building and the tree fall south, down the slope.",
        title: "Sun Angles, Shade, and Aspect: Getting the Most from Sunlight",
        body: "In much of South Africa, especially in winter, the sun is to the north. Its path changes with the season and your location. North-facing slopes often receive more sun and can be warmer and drier. South-facing slopes are often cooler and moister. Frost can collect in low hollows where cold air settles. Watch your own site before choosing where to plant tender crops or place buildings.\n\nWinter sun is lower and farther north than summer sun. A wall or shade cloth can shade a bed longer in winter than in summer. Before placing anything permanent, stand in the spot at 8am, midday, and 4pm on a winter's day and watch where the shade falls.\n\nPawpaw and young citrus are sensitive to frost. Keep tender plants out of known low frost pockets. Observe local frost before planting.",
        keyPoints: [
          "North-facing slopes often get more direct sun; south-facing slopes are often cooler and moister",
          "Winter sun is lower and farther north; check local shade before building",
          "Cold air can collect in low hollows; aspect is only one site factor",
          "Check local frost before placing tender pawpaw or young citrus",
        ],
        quiz: [
          {
            q: "Where should a farmer first look for a frost-tender young pawpaw on a Highveld smallholding?",
            options: [
              "The lowest point where cold air collects",
              "A cold, shaded hollow",
              "A sunny spot outside a known frost hollow, after checking the site's frost pattern",
              "A position chosen without checking the site",
            ],
            correct: 2,
            rationale: "Cold air can collect in low places. A sunnier site outside a known frost pocket may reduce risk, but local frost observations must guide the final position.",
          },
          {
            q: "A farmer plans shade cloth on the north side of her garden. What should she check before fixing it in place?",
            options: [
              "Where its shadow falls on the bed in winter",
              "Whether it redirects frost away",
              "Whether the sun is always overhead at noon",
              "Only whether it reduces summer evaporation",
            ],
            correct: 0,
            rationale: "Winter sun is lower and farther north. Shade cloth can change the hours of sun on a bed. Check the actual shadows at 8am, midday, and 4pm before fixing it in place.",
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
        body: "A site map needs paper, a tape measure, a compass, and time to walk your land. Walk the boundary and make a first sketch. Mark it 'not to scale' until you have checked its distances. Mark north. Add the house, trees, water, roads, fences. Draw arrows for summer and winter wind, shade patterns, and where water flows in rain.\n\nNote where frost sits longest, where the ground smells damp in dry months, and where khakibos or blackjack grow thick. These plants can grow in disturbed places, but their presence alone does not show whether soil is compacted. Check the soil before deciding what the patch means for your design.\n\nOverlay your zones and sectors on the same sketch. Update it season by season. A pencil sketch you actually use is worth more than a perfect one drawn once.",
        keyPoints: [
          "A site map needs only paper, a tape measure, a compass, and observation",
          "Mark water flow, wind direction, frost pockets, and existing vegetation",
          "Mark thick khakibos or blackjack growth for a closer soil check; it does not prove compaction",
          "Overlay zones and sectors on your base map to complete the design skeleton",
        ],
        quiz: [
          {
            q: "You notice thick blackjack growing in one corner every year. What should you do next?",
            options: [
              "The soil there is exceptionally fertile",
              "That area has a higher water table",
              "Mark the patch and check the soil; the plant alone cannot show compaction",
              "Blackjack only grows in shade, so there's a hidden seep",
            ],
            correct: 2,
            rationale: "Blackjack can grow in disturbed ground, but its presence alone does not diagnose compaction. Observe and check the soil before deciding what the patch means for your design.",
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

        body: "A swale is a level trench dug exactly on contour — not angled, perfectly level end to end — so water fills it evenly and soaks in rather than running off.\n\nThe excavated soil forms a berm on the downhill side.\n\nTrees planted there draw on stored water long after the rain has stopped.\n\nThe berm, the downhill mound of excavated soil, is where you plant trees.\n\nHeavy rain can fill a swale faster than water soaks into the soil. Plan a safe overflow before digging.\n\nThe route must not erode the slope or send damaging water to a neighbour. A downstream swale or dam must be able to receive it safely.\n\nAsk a trained local adviser to assess the soil, slope and storm flow. A picture is not a construction design.\n\nSlope alone does not tell you whether a swale is suitable. Soil, drainage, unstable ground and the water arriving from upslope all matter.\n\nKeep good ground cover. Get a local assessment before digging on steep, wet or unstable land. Grass barriers and terraces also need a design suited to the site.",
        keyPoints: [
          "A contour swale holds water for infiltration",
          "Keep good ground cover and plan a safe overflow",
          "Assess soil, drainage, slope and storm flow before digging",
          "A concept picture is not a construction design",
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
            q: "A farmer wants to control erosion on steep land. What should she do before digging?",
            options: [
              "Standard swales dug as deep as possible",
              "Keep ground covered and get a site assessment for suitable erosion controls",
              "A large dam at the bottom to catch all runoff",
              "Compacting the soil surface with a roller",
            ],
            correct: 1,
            rationale: "Slope alone is not enough to choose an earthwork. Soil, drainage, stability and storm flow must also be assessed.",
          },
        ],
      },
      {
        id: "water-harvesting-l2",
        infographicUrl: "/course-images/water-harvesting/water-harvesting-l2.jpg",
        infographicAlt: "A farm dam cut through the middle: water flowing in at one end, the stored body of water, a spillway at the top edge for overflow, and a planted bank holding the soil.",
        title: "Farm Dams and Ponds: Storing Water for the Dry Season",
        body: "A dam or pond can store runoff, but the amount available depends on local rain, the catchment, losses and how much water you use.\n\nRainfall seasons differ across South Africa. Use local records and plan for dry periods; a full dam is not guaranteed.\n\nBefore changing a watercourse or building storage works, check the required authorisation with the water authority.\n\nA dam needs a site investigation and a design by a suitably qualified person. Catchment runoff, soil, foundations, downstream risk and a safe spillway all matter.\n\nDo not assume that annual rainfall tells you the size of a flood or the storage you will have.\n\nAn uncontrolled overflow can erode and breach the wall. Plan a safe route for excess water before construction.\n\nWater can be lost through evaporation and seepage. Check the water level and look for leaks or erosion.\n\nKeep the spillway clear and maintain the bank cover specified in the design. Do not plant trees on an earth dam wall.\n\nAnimals can damage banks and add manure to the water. Their presence does not make the water clean or safe.",
        keyPoints: [
          "A dam needs a site assessment and qualified design",
          "Design a safe spillway before construction",
          "Check required water authorisations before building",
          "Maintain bank cover and keep trees off an earth dam wall",
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
            q: "Which action helps protect an earth dam?",
            options: [
              "A deep, exposed dam with no bank vegetation",
              "Maintain the designed bank cover and keep the spillway clear",
              "A full concrete lining and plastic cover",
              "A larger surface area to spread evaporation evenly",
            ],
            correct: 1,
            rationale: "A clear spillway and maintained banks help the dam work as designed. Trees should not be planted on an earth dam wall.",
          },
        ],
      },
      {
        id: "water-harvesting-l3",
        infographicUrl: "/course-images/water-harvesting/water-harvesting-l3.jpg",
        infographicAlt: "Rain running off a roof into a gutter and down a pipe into a tank, with a small first-flush diverter branching off before the tank to throw away the dirty first water.",
        title: "Rainwater Tanks and Roof Catchment: Collecting and Protecting Water",
        body: "Your roof can collect rainwater. The amount depends on roof area, rainfall and losses.\n\nUse the roof area seen from above and local rainfall records. Then allow for water that misses the gutter, is diverted or overflows a full tank.\n\nAn annual total does not tell you how much water will be available during a dry spell. Compare supply with the uses you plan.\n\nRoof runoff can carry dust, droppings and other contamination. A first-flush diverter keeps some of the first runoff out of the tank.\n\nThe required diversion depends on the roof and system. Use the supplier's sizing and maintenance instructions; there is no single volume for every roof.\n\nA diverter does not make the remaining water safe to drink.\n\nTank size depends on water demand, rain, roof area and the length of dry periods.\n\nList the intended uses and estimate their demand from your own records. Compare that with supply through the seasons.\n\nPlan what you will do when stored water runs low. A province name alone cannot tell you the tank size you need.\n\nKeep the tank covered, screen openings against insects, and maintain the roof, gutters and diverter. Keep rainwater separate from drinking-water pipes.\n\nWater that looks clear may still contain germs or chemicals. Ask the local health authority about testing and treatment suited to the intended use.\n\nA basic filter alone is not a drinking-water guarantee. Water used on food crops also needs a safety assessment.",
        keyPoints: [
          "Roof area, rain, demand and losses determine useful storage",
          "Size and maintain the first-flush diverter for the roof",
          "Clear water can still contain germs or chemicals",
          "Testing and treatment must match the intended use",
        ],
        quiz: [
          {
            q: "What information is needed to choose a rainwater tank?",
            options: [
              "Only the province where the farm is located",
              "Roof area, rainfall pattern, water demand and collection losses",
              "Only the amount of rain in one storm",
              "Only the price of the biggest available tank",
            ],
            correct: 1,
            rationale: "Tank planning must compare usable supply with demand through wet and dry periods. One fixed regional size cannot do that.",
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
            rationale: "Diverting early runoff can reduce contamination, but it does not guarantee that later water is safe. Assess quality for the intended use.",
          },
        ],
      },
      {
        id: "water-harvesting-l4",
        infographicUrl: "/course-images/water-harvesting/water-harvesting-l4.jpg",
        infographicAlt: "Water from an indoor basin running through a buried pipe out to a mulched planting basin. The pipe stays underground the whole way — never an open channel.",
        title: "Greywater: Reuse with Care",
        body: "Greywater is used water from washing. Toilet water needs separate handling. Washwater may still contain germs, salts and chemicals.\n\nDo not reuse water from nappies, sick people, animal washing or harmful chemicals. Ask the municipality which sources and uses are allowed.\n\nWhere local rules allow it, use suitable greywater below mulch around non-food planting. Keep people and animals away from the discharge.\n\nDo not spray it, let it pool, or let it run into a street, drain or watercourse. Mulch does not disinfect water.\n\nUse it promptly. Stored greywater needs specialist advice and appropriate treatment.\n\nKeep untreated greywater away from edible crops and places where people or animals can touch it. Never connect it to drinking-water pipes.\n\nCheck municipal rules before installing a greywater system. The right design depends on the source, soil, drainage and intended use.\n\nIf the water smells bad, pools or harms plants, stop using it and seek advice.",
        keyPoints: [
          "Greywater can contain germs, salts and chemicals",
          "Keep untreated greywater away from food and people",
          "Mulch does not disinfect water",
          "Check municipal rules and avoid spraying, pooling and runoff",
        ],
        quiz: [
          {
            q: "Where may suitable greywater be directed if local rules allow it?",
            options: [
              "Watering lettuce that will be eaten raw",
              "Below mulch around non-food planting, away from people and animals",
              "Watering seedlings in a nursery tray",
              "Filling a fishpond",
            ],
            correct: 1,
            rationale: "Keep greywater away from edible crops and contact with people or animals. Mulch is not disinfection; local rules and site conditions still apply.",
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
            rationale: "Some cleaning chemicals and salts can harm soil organisms and plants. Water sources and products must be assessed before reuse.",
          },
        ],
      },
    ],
  },
  {
    "id": "soil-health",
    "title": "Soil Health & Composting",
    "description": "Build living soil with compost, mulch, cover crops and worm farms.",
    "durationMins": 20,
    "category": "soil",
    "lessons": [
      {
        "id": "soil-health-l1",
        "infographicUrl": "/course-images/soil-health/soil-health-l1.jpg",
        "infographicAlt": "A spade cut through the ground showing dark crumbly topsoil above pale subsoil, with worm channels. Beside it, a jar of soil settled into three layers — sand, silt and clay.",
        "title": "Understanding Your Soil: The Foundation of Everything",
        "body": "Soil contains many kinds of living organisms. Bacteria and fungi help break down organic matter and cycle nutrients.\n\nSome fungi help roots take up nutrients. Worm channels can help water and air enter soil.\n\nLook at roots, soil structure and water movement as well as visible soil life.\n\nPut soil and water in a clear jar, with a little suitable dispersing detergent. Close and shake it, then leave it undisturbed.\n\nSand settles first. Silt settles next, while clay can remain suspended much longer.\n\nThis is a rough learning exercise. Clumps and unsettled clay can mislead you; use a soil laboratory when accurate texture is needed.\n\nA thick sand layer beneath cloudy water does not yet tell you the final proportions. Some fine particles may still be suspended.\n\nCompare the settled layers and feel the soil in the field.\n\nRecord what you see and what remains uncertain. Do not prescribe watering or soil treatments from one jar alone.\n\nCompaction, poor drainage and loss of organic matter can limit roots and soil life.\n\nPale colour or few worms do not prove that chemicals killed the soil. Worm activity also changes with moisture and season.\n\nLook for patterns across the field. Check management history, drainage and plant growth before choosing a remedy.",
        "keyPoints": [
          "Use several clues to assess soil condition",
          "Soil colour and worm counts alone do not diagnose the cause of a problem",
          "A jar exercise gives a rough indication of texture, not a complete soil test",
          "Check drainage, roots and management history before choosing a remedy"
        ],
        "quiz": [
          {
            "q": "A soil jar still has cloudy water above the sand layer. What should the farmer conclude?",
            "options": [
              "The soil definitely needs less water",
              "Fine particles may still be suspended; more observation is needed",
              "All the clay has already settled",
              "The crop definitely needs gypsum"
            ],
            "correct": 1,
            "rationale": "Cloudy water can contain unsettled fine particles. One early observation cannot establish the final proportions or the right treatment."
          },
          {
            "q": "A farmer finds compacted soil and few worms. What is the useful next step?",
            "options": [
              "Assume every soil organism has died",
              "Add a treatment without checking the site",
              "Check drainage, roots, moisture and management history",
              "Give up because the soil cannot improve"
            ],
            "correct": 2,
            "rationale": "Several observations help identify a problem. Worm activity varies with conditions, so few worms alone do not establish its cause."
          }
        ]
      },
      {
        "id": "soil-health-l2",
        "infographicUrl": "/course-images/soil-health/soil-health-l2.jpg",
        "infographicAlt": "A compost heap cut open, showing alternating layers of dry brown material and fresh green material, heat rising from the middle, and an arrow showing it being turned.",
        "title": "Making and Using Compost",
        "body": "Compost is organic matter broken down under managed conditions.\n\nFinished compost can improve soil structure and contribute nutrients.\n\nTime to readiness varies with materials, moisture, air and temperature. A province name or a fixed number of weeks is not a readiness test.\n\nMix dry browns with fresh greens. Avoid thick, wet layers that keep air out.\n\nIf the heap becomes slimy or smells strongly of ammonia, add dry browns and turn it.\n\nCheck moisture and air as the heap changes; one recipe does not suit every mix of materials.\n\nA hot centre does not prove that every part of a heap has been treated. Time, temperature and management all matter.\n\nKeep meat, dairy, diseased plants, pet waste and contaminated materials out of this simple household system.\n\nDo not assume home composting destroys every weed seed or disease organism. Use a recognised process where sanitation is required.\n\nKeep wattle seed pods out of the compost heap. An ordinary heap may not make every seed non-viable.\n\nUse only clean, untreated materials. Bark breaks down slowly; its name alone is not proof that it is free of contamination.\n\nCheck the heap and turn when it needs more air or mixing. Keep it moist rather than waterlogged.",
        "keyPoints": [
          "Balance browns, greens, moisture and air",
          "A hot centre does not prove the whole heap is sanitised",
          "Keep seed pods and contaminated materials out",
          "Judge readiness from the compost condition, not a fixed regional timetable"
        ],
        "quiz": [
          {
            "q": "A farmer's compost heap smells strongly of ammonia and is wet and slimy. What's the fix?",
            "options": [
              "Add more nitrogen-rich green material",
              "Add more dry carbon material like straw and turn the heap",
              "Stop turning it and let it cool",
              "Add more water — the smell means it's too dry"
            ],
            "correct": 1,
            "rationale": "A wet, slimy heap may need more air and drier material. Add dry browns and turn the heap to open it up. An ammonia smell can also suggest too much nitrogen-rich material. Check that the heap stays damp, not soggy."
          },
          {
            "q": "Why keep wattle seed pods out of an ordinary compost heap?",
            "options": [
              "Bark makes every heap too hot",
              "Some seeds may survive and spread when the compost is used",
              "Pods always attract termites",
              "Pods release a gas that kills every soil organism"
            ],
            "correct": 1,
            "rationale": "An ordinary heap may not expose every seed to conditions that make it non-viable. Excluding pods avoids spreading them with the compost."
          }
        ]
      },
      {
        "id": "soil-health-l3",
        "infographicUrl": "/course-images/soil-health/soil-health-l3.jpg",
        "infographicAlt": "Two patches of soil under the same sun: bare ground cracked and dry, mulched ground still dark and moist.",
        "title": "Mulching and Cover Crops: Protecting and Building Soil",
        "body": "Cover bare soil with suitable clean mulch, such as straw, dry grass or wood chips.\n\nMulch can reduce evaporation, soften the impact of rain and suppress weeds.\n\nKeep it clear of trunks and stems. Check moisture underneath and adjust the layer; more mulch is not always better.\n\nCover crops can protect ground between main crops. Choose for local weather, available water and the next planting.\n\nThe course examples include oats, lupins, sunn hemp and cowpea. Check local suitability before sowing.\n\nLegumes need suitable bacteria and growing conditions to fix nitrogen. Nutrients in their residues become available as the material decomposes.\n\nWorm farms can turn suitable food scraps and bedding into castings. Check the bin rather than expecting a fixed harvest date.\n\nLiquid draining from the bin is called leachate. It is not the same as a prepared worm-casting tea.\n\nLeachate can contain harmful organisms or substances. Do not use it on edible plants or assume that dilution makes it safe.\n\nA Highveld field left bare after the maize harvest faces two main risks.\n\nWinter wind can carry away dry topsoil.\n\nThe first heavy spring storm can strike bare ground and damage soil structure.\n\nCover crops, mulch, and organic matter keep soil in place and help it stay alive.",
        "keyPoints": [
          "Protect exposed soil with suitable cover",
          "Keep mulch away from trunks and stems",
          "Choose cover crops for local water, weather and the following crop",
          "Worm-bin leachate is not automatically safe fertiliser; keep it off edible plants"
        ],
        "quiz": [
          {
            "q": "A Highveld farmer harvests maize in April and leaves the field bare all winter. What are the two main risks?",
            "options": [
              "Overheating in winter sun and waterlogging from rain",
              "Frost kills soil life and weeds take over early",
              "Wind erosion of dry topsoil and loss of soil structure from spring storm impact",
              "Soil pH drops and nitrogen builds up"
            ],
            "correct": 2,
            "rationale": "Bare winter soil has nothing holding it against wind, and nothing to absorb the force of the first heavy spring rain — both strip topsoil directly."
          },
          {
            "q": "What should you remember about liquid draining from a worm bin?",
            "options": [
              "It is always safe on salad leaves",
              "It can contain harmful organisms or substances; dilution is not a safety guarantee",
              "It is identical to finished worm castings",
              "A fixed dilution makes every liquid safe"
            ],
            "correct": 1,
            "rationale": "Leachate is drainage from unfinished material. Its composition varies, so it must not be presented as a guaranteed safe feed for edible crops."
          }
        ]
      }
    ]
  },
  {
    "id": "vegetables-staples",
    "title": "Vegetables and Staple Crops",
    "description": "Bed prep, succession planting, staple crops and pest management — the daily work of growing food.",
    "durationMins": 30,
    "category": "plants",
    "lessons": [
      {
        "id": "vegetables-staples-l1",
        "infographicUrl": "/course-images/vegetables-staples/vegetables-staples-l1.jpg",
        "infographicAlt": "A raised bed about 1.2 metres wide, with paths on both sides, so a person can reach the middle from either side without ever standing on the growing soil.",
        "title": "Preparing and Planting Your Beds",
        "body": "Compacted soil loses its air spaces. Roots slow down. Water soaks in differently. The bed gets harder to work every season.\n\nThe protection is simple. Permanent paths, and a bed narrow enough to reach into from both sides.\n\nOne metre to one point two metres wide. That's the working number. At that width you can reach the centre from either path, and your feet never touch the growing area.\n\nNow think about your own beds. Can you reach the middle without stepping inside? Go and try it before you plant anything else.\n\nThere's no single bed shape that's right everywhere.\n\nStart with the least disturbance that solves your problem.\n\nNo-dig suits most garden soils. Leave the structure alone and build fertility on top.\n\nDo not dig wet clay. If compaction or poor drainage is severe, identify the cause with local advice before choosing deeper cultivation.\n\nRaised beds suit wet ground, where water needs somewhere to drain away to.\n\nSunken beds suit dry ground, where you want to catch and hold what rain you get.\n\nLook after heavy rain. Where does water sit or run off? Combine that observation with soil and drainage advice before choosing the bed.\n\nSome crops resent having their roots disturbed. They do better sown straight where they'll grow. Beans, carrots and maize belong in that group.\n\nOthers do better with a protected start in a nursery, then transplanting. Tomatoes and brassicas belong there.\n\nUse spacing guidance for the crop, variety and local conditions. Check the packet and local grower advice. Watch for crowding as plants develop.\n\nBefore you plant, mark the bed out.\n\nOne point two metres wide. Three metres long. One practice bed.\n\nUse pegs and string. Mark the rectangle, and mark both access paths.\n\nThen prepare for your own soil — no-dig first, and dig deeper only if your ground genuinely needs it.\n\nA string line turns an idea into a decision. Once the paths exist, keep them. Once the growing area exists, protect it.\n\nThat bed gets easier to improve every season, because you stopped walking on it.",
        "keyPoints": [
          "Keep beds 1-1.2m wide so you never need to step on the growing area",
          "Assess compaction and drainage before choosing deeper cultivation; do not work wet clay",
          "Transplant crops needing a head start; direct-seed crops that resent root disturbance",
          "Crowded plants underperform — space generously for your local climate"
        ],
        "quiz": [
          {
            "q": "Why keep a vegetable bed to 1-1.2m wide rather than wider?",
            "options": [
              "Wider beds get too much sun",
              "You can reach the centre from either side without stepping on the growing area, avoiding compaction",
              "Narrow beds drain better in all conditions",
              "It's a fixed rule with no practical reason"
            ],
            "correct": 1,
            "rationale": "Stepping on growing soil compacts it and damages roots — a bed you can reach into from both sides means you never have to."
          },
          {
            "q": "Which crop is best suited to direct-seeding rather than transplanting?",
            "options": [
              "Tomatoes, which need an early start",
              "Brassicas, which need protection while small",
              "Beans, which resent root disturbance",
              "Peppers, which are slow to germinate"
            ],
            "correct": 2,
            "rationale": "Beans and other quick, sensitive-rooted crops establish poorly after transplant shock — sowing them straight into the bed avoids that setback entirely."
          }
        ]
      },
      {
        "id": "vegetables-staples-l2",
        "infographicUrl": "/course-images/vegetables-staples/vegetables-staples-l2.jpg",
        "infographicAlt": "One bed over three seasons: a fast crop is harvested, then a new sowing goes in beside a slower crop that is still growing, so the bed is never empty.",
        "title": "Succession Planting and Intercropping",
        "body": "Succession planting is a calendar habit, not a special crop.\n\nChoose something your household actually eats often. Then sow a small amount of it, again and again.\n\nPlant a short row every two to three weeks.\n\nLess waste during a glut. Fresh food for longer. And the labour spreads out across the season instead of landing on you all at once.\n\nSeparate sowings may reduce the risk of losing everything at once. They do not guarantee a harvest if difficult conditions continue.\n\nWhich fast crop could you sow in small batches? Decide on one, and start it this week.\n\nHere's what it looks like in practice.\n\nSow one. Then two to three weeks later, sow two. Then sow three. Then sow four.\n\nWith suitable crop timing, harvests can begin to overlap. The first batch will not always be ready by the fourth sowing.\n\nTwo to three weeks is a starting rhythm, not a law. A cool-season leaf crop may hold longer. Heat may speed things up, or cause a failure.\n\nWatch what your own garden does, and adjust the interval. That observation is the skill.\n\nIntercropping is not just crowding different plants together. Each plant needs a job, and enough space to do it.\n\nThe Three Sisters is an example from Indigenous farming traditions in the Americas.\n\nMaize gives height and structure.\n\nBeans climb the maize, and store as protein.\n\nPumpkin spreads across the ground, shading the soil and holding moisture.\n\nTiming matters. Establish the maize first, so it's strong enough to carry the beans when they start to climb.\n\nThe plants can still compete. Give them suitable space, water and light. Beans fix nitrogen with root bacteria, but do not assume they immediately feed the maize; nutrients in residues are released during decomposition.\n\nA household may have a hungry gap: weeks when stored food runs low before the next harvest is ready.\n\nYours might come after stored maize runs out. It might come before winter greens are ready. It might come in a dry period when water limits the garden.\n\nDon't copy somebody else's calendar. Name your own months first.\n\nWrite them down. Then choose the crop and the sowing date that puts food into that gap.\n\nThat's planning backwards, and it's the difference between a garden that looks productive and a household that eats.",
        "keyPoints": [
          "Stagger sowings and adjust the interval for crop, weather and household use",
          "The Three Sisters comes from Indigenous farming traditions in the Americas",
          "Use household food records to identify and plan for a hungry gap",
          "Intercropped plants can still compete; manage space, timing and water"
        ],
        "quiz": [
          {
            "q": "Why sow lettuce in small batches every 2-3 weeks instead of all at once?",
            "options": [
              "It uses less seed overall",
              "It gives a steady harvest instead of a glut followed by a gap",
              "Lettuce germinates better in small batches",
              "It reduces pest pressure"
            ],
            "correct": 1,
            "rationale": "A single large sowing matures all at once — staggering the sowing spreads the harvest out to match what a household can actually use."
          },
          {
            "q": "When can nitrogen in bean crop residues become available to other plants?",
            "options": [
              "Immediately whenever a bean touches maize",
              "As soil organisms decompose the residues",
              "Only when pumpkin leaves shade them",
              "It can never be released"
            ],
            "correct": 1,
            "rationale": "Beans fix nitrogen with suitable root bacteria. Nitrogen in their residues is released through decomposition; growing beans beside maize does not guarantee immediate feeding."
          }
        ]
      },
      {
        "id": "vegetables-staples-l3",
        "infographicUrl": "/course-images/vegetables-staples/vegetables-staples-l3.jpg",
        "infographicAlt": "Three staple crops together: a tall grain stalk, a climbing vine on a pole, and a root crop shown half below the ground.",
        "title": "Staple Crops: Maize, Beans, and Root Vegetables",
        "body": "A staple earns its place because it feeds the household beyond the day of harvest.\n\nIt carries energy or protein. It stores, or it stays in the ground until you need it. And often it carries cultural memory too.\n\nOne staple leaves you vulnerable. Two or more give you options when weather or pests hit.\n\nGrow at least two. Not one.\n\nWhich staple does your household rely on most heavily right now? That's the one whose failure would hurt most — so that's the one that needs a companion.\n\nEach staple protects you against something different.\n\nMaize gives calories, and stores dry. Open-pollinated maize also lets you save your own seed, if you manage isolation and selection.\n\nBeans and cowpeas give a storable protein harvest.\n\nSweet potato tolerates dry periods, and its leaves are edible too.\n\nAmadumbe handles wetter ground, where other staples struggle.\n\nNotice that they fail in different conditions. That's the whole point.\n\nResilience doesn't mean nothing fails.\n\nIt means one failure doesn't finish your household's food plan.\n\nOne crop is one point of failure.\n\nTwo or more staples give you more ways to keep eating.\n\nDifferent crops use water, soil and seasons differently. That difference is the protection.",
        "keyPoints": [
          "Open-pollinated maize lets you save seed; hybrid seed won't breed true next season",
          "Beans are the key protein crop — productive, storable, and nitrogen-fixing",
          "Sweet potato is drought-tolerant and gives both a root harvest and edible leaves",
          "Amadumbe (taro) is an underused traditional staple suited to wetter KZN and coastal ground"
        ],
        "quiz": [
          {
            "q": "Why choose open-pollinated maize over a hybrid variety if you plan to save your own seed?",
            "options": [
              "Open-pollinated varieties yield more",
              "Hybrid seed won't breed true — the next generation won't match the parent plant",
              "Open-pollinated maize is always more drought-tolerant",
              "Hybrids can't be planted in South Africa"
            ],
            "correct": 1,
            "rationale": "Seed saved from an F1 hybrid may grow, but the next generation can vary. A stable open-pollinated variety with managed pollination is more predictable when saving seed."
          },
          {
            "q": "Why is amadumbe (taro) a good staple choice for parts of KZN?",
            "options": [
              "It thrives on very dry, sandy soil",
              "It tolerates wetter ground than maize, suiting coastal and high-rainfall conditions",
              "It requires no cultivation at all",
              "It's the only staple that stores for multiple years"
            ],
            "correct": 1,
            "rationale": "Amadumbe actually prefers damper ground where maize would struggle — it fills a niche other staples can't handle well."
          }
        ]
      },
      {
        "id": "vegetables-staples-l4",
        "infographicUrl": "/course-images/vegetables-staples/vegetables-staples-l4.jpg",
        "infographicAlt": "A pest on a leaf, and three ways to deal with it without chemicals: a beneficial insect, a physical barrier, and picking it off by hand.",
        "title": "Observe and Manage Pests and Disease",
        "body": "Pest pressure usually rises for a reason.\n\nPlants under stress. One crop dominating the ground. Or broad chemical use that has already removed the predators that were helping you.\n\nSo before you treat anything, look at the whole system.\n\nIs the plant short of water? Is the soil compacted, or hungry? Are predators already working on the problem for you?\n\nA yellow leaf is not automatically an insect. It can be water, nutrition, or root damage. Find out which before you act.\n\nWork through four steps, in order.\n\nOne. Observe. Look at the damage pattern, the underside of the leaf, the stem, and the plants nearby.\n\nTwo. Check for stress. Soil moisture, roots, spacing, nutrition, drainage.\n\nThree. Protect what's helping you. Beneficial insects are doing work you'd otherwise do yourself.\n\nFour. Only then, act — and start with the lightest thing that works. Physical removal, barriers or changes in crop care may help. Check that the action suits the problem and monitor the result.\n\nIf a treatment is needed, use a product registered for that crop and pest, and follow its label. This includes neem products. Check protection and harvest waiting instructions. Do not improvise mixtures or stronger doses.\n\nBe honest with yourself about which step you usually skip.",
        "keyPoints": [
          "Identify the cause before treating damage",
          "Check water, roots, nutrition and beneficial insects",
          "Use suitable physical or crop-care measures and monitor results",
          "If treatment is needed, use a registered product for the crop and pest and follow the label"
        ],
        "quiz": [
          {
            "q": "If a pest problem needs a treatment product, what should guide its use?",
            "options": [
              "An improvised stronger mixture",
              "A product registered for the crop and pest, used according to its label",
              "Any product described as natural",
              "A neighbour’s dose for a different crop"
            ],
            "correct": 1,
            "rationale": "Crop, pest, dose, protection and harvest waiting instructions matter. A natural origin does not make an improvised treatment safe or suitable."
          },
          {
            "q": "A farmer's brassica leaves are turning yellow. Before assuming pests, what should she check first?",
            "options": [
              "Whether it's actually a soil nutrient or watering issue",
              "Whether the moon phase is right for treatment",
              "Whether her neighbour has the same problem",
              "Whether it's aphids specifically"
            ],
            "correct": 0,
            "rationale": "Yellowing has several common causes, and a soil or watering issue needs a completely different fix than a pest does — checking first avoids wasted treatment."
          }
        ]
      }
    ]
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
        body: "Open-pollinated seed from a stable variety can produce similar plants when pollination is properly managed. F1 hybrids come from selected parents. Their saved seed can germinate, but the next generation varies; it may not keep the combination you wanted.\n\nSeed sovereignty includes the knowledge and choices needed to grow, save and share suitable seed. Keep the crop and variety identity with each batch.\n\nChoose healthy plants with useful traits. Start with a crop you know and ask a seed-saving mentor how to manage its pollination and selection.",
        keyPoints: [
          "Stable open-pollinated varieties need suitable pollination management",
          "Seed sovereignty means freedom from depending on a seed company every season",
          "Genetic diversity across many saved varieties is real protection against climate unpredictability",
          "Select healthy plants with useful traits; use crop-specific seed-saving guidance",
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
        infographicAlt: "Dry seed is collected from mature pods. The tomato wet-method example shows brief fermentation, rinsing and drying.",
        title: "How to Save Seed: Dry and Wet Methods",
        body: "Dry seed must mature before collection. Clean away chaff and damaged seed, then finish drying with shade and airflow.\n\nSeed in fleshy fruit needs a crop-specific method. Tomato seed can be briefly fermented to help remove its gel, then rinsed and dried thoroughly. Keep an active jar open or loosely covered. Fermentation is not required for every wet-seeded crop and does not guarantee disease-free seed.\n\nPollination matters too. Maize is wind-pollinated and can cross with other varieties. Tomatoes mostly self-pollinate, but crossing is possible. Check the crop and variety before planning isolation or saving seed.",
        keyPoints: [
          "Dry-method crops (beans, maize, sunflower) simply dry on the plant before collection",

          "Tomato fermentation removes gel; other wet seeds need their own processing method",
          "Tomatoes need little isolation; maize needs real distance between varieties to stay pure",
          "Rinse processed tomato seed and dry it thoroughly before storage",
        ],
        quiz: [
          {
            q: "What does brief fermentation help remove when processing tomato seed?",
            options: [
              "Fermentation improves the seed's flavour",
              "It helps remove the gel around the seed before rinsing and drying",
              "It kills any pests inside the fruit",
              "It's purely traditional with no practical function",
            ],
            correct: 1,
            rationale: "Fermentation helps separate tomato seed from its gel. It is not a guarantee of germination or disease-free seed; dry, store and test the batch.",
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
    "id": "food-forest",
    "title": "Food Forest Design",
    "description": "Layer a multi-storey food system from tall canopy right down to root crops.",
    "durationMins": 25,
    "category": "design",
    "lessons": [
      {
        "id": "food-forest-l1",
        "infographicUrl": "/course-images/food-forest/food-forest-l1.jpg",
        "infographicAlt": "A food forest cut through from the side, showing seven layers stacked from tall canopy trees down through smaller trees, shrubs, herbs and ground cover, with root crops below the soil line and a climber on a trunk. Sunlight reaches down between the layers.",
        "title": "The Seven Layers: How a Forest Feeds Itself",
        "body": "An indigenous forest fills the space from the highest branches to the roots.\n\nDifferent plants use the light and moisture available at their level.\n\nA food forest copies this pattern with productive species.\n\nThe result is not one crop in one row, but many useful layers growing together.\n\nThink of tall canopy, smaller trees, shrubs and herbaceous plants.\n\nGround cover protects the surface, root crops grow below it, and climbers use suitable supports.\n\nThe heights and spacing depend on the plants and site. These are planning layers, not fixed height bands.\n\nThe original Highveld example includes Wild Fig or pecan above lemon, naartjie and black mulberry.\n\nIt places Cape gooseberry and Wild Medlar with vegetables, wild garlic, sweet potato and granadilla.\n\nTreat this as a layout example, not permission to plant every species. Check identity, frost tolerance, mature size and local restrictions first.\n\nYoung plants need establishment care: moisture checks, weed control and protection from damage.\n\nAs plants grow, shade and leaf litter change conditions below them.\n\nCheck competition and access. Prune, thin or adjust lower planting when observations call for it; the system does not become care-free on a fixed birthday.",
        "keyPoints": [
          "Seven planning layers can combine useful plants at different heights",
          "Plants can compete for light, water and nutrients",
          "Establishment and ongoing care depend on observed conditions",
          "Confirm local suitability before copying any example planting"
        ],
        "quiz": [
          {
            "q": "Weeds are competing strongly with young lower-layer plants. What should guide the next action?",
            "options": [
              "Wait until the fifth year",
              "Add more plants regardless of water",
              "Check the affected plants and manage competition",
              "Assume all seven layers take care of themselves"
            ],
            "correct": 2,
            "rationale": "Observe actual competition and plant condition. A fixed establishment calendar cannot tell you which plants need care now."
          },
          {
            "q": "How can leaf litter and shade help protect soil moisture?",
            "options": [
              "They guarantee access to groundwater",
              "They can reduce water loss from the soil surface",
              "They guarantee higher yield per litre in every system",
              "They remove the need to check watering"
            ],
            "correct": 1,
            "rationale": "Shade and suitable mulch can reduce surface evaporation. Plant water demand and establishment needs still require attention."
          }
        ]
      },
      {
        "id": "food-forest-l2",
        "infographicUrl": "/course-images/food-forest/food-forest-l2.jpg",
        "infographicAlt": "A simple shape of South Africa divided into three growing areas by ground colour and terrain alone: a pale high inland plateau with hills, a green humid coastal strip, and a hot red-brown low-lying area. Different tree shapes stand in each.",
        "title": "Species Selection for South African Food Forests",
        "body": "Check local rainfall, frost, heat, soil and water availability before choosing plants.\n\nMango can suffer frost damage. Quince needs suitable winter chilling for reliable cropping.\n\nA regional label or a sheltered corner is not enough. Confirm each plant and variety with reliable local guidance.\n\nThe original list includes pecan, walnut and indigenous fig; apple, pear, plum, black mulberry and loquat; rosemary, Wild Medlar, Cape gooseberry and Barbados cherry.\n\nThis list is not a blanket recommendation. Check each plant against frost, soil, mature size and the approved local species list.\n\nKeep existing legal and project restrictions in force. Do not plant from a picture alone.\n\nThe original warm-region examples include mango, avocado, Natal Mahogany, banana, pawpaw, litchi, Wild Fig, Barbados cherry and Wild Dagga.\n\nMarula, Mopane and baobab also appear in the Limpopo examples. Local suitability still needs checking.\n\nUseful trees are not automatically edible. Confirm identity and safe use; a landscape photograph is not a food-identification guide.\n\nLocally appropriate indigenous plants can support habitat as part of the design.\n\nChoose for your ecosystem and the useful role of each plant. There is no sourced percentage target in this lesson.\n\nProtect existing natural vegetation. Do not turn healthy grassland into a food forest simply because trees are useful elsewhere.",
        "keyPoints": [
          "Match each plant and variety to the actual site",
          "Check identity, safe use and current local restrictions",
          "A regional example is not approval for every species on its list",
          "Use locally appropriate indigenous plants and protect existing natural habitat"
        ],
        "quiz": [
          {
            "q": "A grower wants to plant a young mango where hard frost occurs. What risk needs attention?",
            "options": [
              "It thrives — the position offsets frost",
              "It fruits early from the temperature swings",
              "It's likely killed or badly damaged by frost, especially as a young tree",
              "It survives with heavy mulch but needs annual replacement"
            ],
            "correct": 2,
            "rationale": "Young mango can be damaged by frost. Check actual site conditions and reliable local guidance rather than assuming a sheltered spot removes the risk."
          },
          {
            "q": "Why include locally appropriate indigenous plants in a design?",
            "options": [
              "They always yield more food per square metre",
              "They can support local habitat, pollinators and other wildlife",
              "Every introduced species is illegal",
              "They never need establishment care"
            ],
            "correct": 1,
            "rationale": "Choose plants for the local ecosystem and their role. This does not establish a universal percentage or remove the need to check suitability."
          }
        ]
      },
      {
        "id": "food-forest-l3",
        "infographicUrl": "/course-images/food-forest/food-forest-l3-mulch-layer-corrected.jpg",
        "infographicAlt": "The same patch of ground at four stages, left to right: loose mulch being spread over cardboard on soil, then fast low pioneer plants, then young canopy trees with lower layers filling in, and finally a settled layered planting.",
        "title": "Establishing a Food Forest: Observe and Adjust",
        "body": "Start by checking the site, water supply and care available. Protect exposed soil early.\n\nTemporary support plants may provide shelter and useful cut material where appropriate.\n\nMain trees and lower layers can be introduced as conditions allow. Ground cover need not wait until the end; avoid plants competing with young trees.\n\nBegin with an area you can water and maintain. Check existing vegetation before clearing.\n\nWhere appropriate, plain cardboard under suitable mulch can suppress unwanted growth. Keep water able to enter the soil and leave trunks clear.\n\nPlan spacing from mature plant size. Prepare nursery plants for the next suitable planting opportunity.\n\nWatch how shade, roots and available water affect neighbouring plants.\n\nComfrey and wild garlic appear in the original underplanting example; check their local suitability before use.\n\nPrune or thin support plants when needed, using methods suited to each species. Suitable clean cuttings can return as mulch. Do not wait for a fixed year if competition is already harming plants.\n\nChoose a planting opportunity when soil moisture and expected weather support establishment.\n\nRain can help, but check the root zone and keep a backup watering plan. Avoid planting into waterlogged ground.\n\nCheck young plants after planting. Harvest timing and outside inputs depend on the species, site and care; there is no guaranteed fifth-year result.",
        "keyPoints": [
          "Protect exposed soil early",
          "Plan the sequence around conditions and available care",
          "Check root-zone moisture even during the rainy season",
          "Manage competition as it develops; harvest dates are not guaranteed"
        ],
        "quiz": [
          {
            "q": "A farmer sheet-mulches a 500m² plot with cardboard and wood chips in September, before the rains. What's the cardboard's main job?",
            "options": [
              "Creating a moisture barrier that blocks water from the soil",
              "Smothering existing grass while it decomposes and feeds soil organisms over following months",
              "Providing a stable base so wood chips don't shift",
              "Reflecting heat upward to warm the soil"
            ],
            "correct": 1,
            "rationale": "Cardboard cuts off light to existing grass, killing it, and then breaks down itself — feeding the soil rather than blocking it long-term."
          },
          {
            "q": "When should a grower consider pruning or thinning temporary support plants?",
            "options": [
              "Only on a fixed anniversary",
              "When observed competition requires it, using methods suited to the species",
              "As soon as any leaf falls",
              "Never, because support plants cannot compete"
            ],
            "correct": 1,
            "rationale": "Temporary support plants can become competitors. Observe light, water and growth, then choose suitable management rather than relying on a fixed year."
          }
        ]
      }
    ]
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
        infographicAlt: "Bought feed enters the farm. Animals produce manure, some nutrients return to the growing area through fully composted manure, and food and other products leave the farm.",
        title: "Integrating Livestock Cycles: Nutrients Moving Through the Farm",
        body: "Some nutrients can return to the growing area in compost made from manure. Fresh manure can carry harmful germs. Compost manure fully before using it around food crops. Bought feed brings nutrients into the farm, while food and other products carry nutrients away. Keep track of feed bought in and food sold or taken home. Scraps alone may not meet the animals' needs.\n\nGuinea fowl forage for insects and may eat ticks. Do not rely on them to protect people or livestock from ticks or tick-borne disease. Check animals and follow a local animal-health plan.\n\nFor each animal, ask: what can it eat here? What useful things does it produce? What else does it need? Include water, suitable feed, shelter, fencing and daily care.\n\nChickens following goats are not a proven replacement for goat worm control. Grazing management can help, but goats still need health checks and a parasite plan from a veterinary or animal-health adviser. Do not stop treatment because chickens have visited the grazing camp.",
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
    "id": "market-community",
    "title": "Market Gardening & Community",
    "description": "Record-keeping, selling surplus and building local food networks.",
    "durationMins": 20,
    "category": "business",
    "lessons": [
      {
        "id": "market-community-l1",
        "infographicUrl": "/course-images/market-community/market-community-l1.jpg",
        "infographicAlt": "A simple ruled record sheet with columns for what was harvested and where it went, beside a pile of harvested produce.",
        "title": "Record-Keeping: Knowing What Your Farm Is Actually Producing",
        "body": "A harvest can feed the household, be sold, be shared, or be lost.\n\nRecording these different uses helps you see what the farm produces and what reaches customers.\n\nUse that information to protect household food and make better business decisions.\n\nWrite down every harvest as it happens.\n\nRecord kilograms of tomatoes, dozens of eggs, and bundles of morogo, then note where each went.\n\nUse the same simple habit for food kept at home, produce sold, produce gifted, and produce composted.\n\nDo not rely on memory at the end of the season.\n\nOne season of records answers practical questions.\n\nWhich crops give the best yield per bed? Which return the most for each hour of work?\n\nWhich crops use more seeds, water, and compost than they return?\n\nThe record also shows which months leave the household buying food.\n\nBefore setting a price, record production, packing and selling costs, including labour and transport.\n\nHere is a teaching example, not a market price: tomatoes cost R18 per kilogram but sell for R15 per kilogram. That price does not cover the stated cost.\n\nReview the price, costs and next planting. Check what customers will actually buy; a higher asking price is not a guaranteed sale.\n\nUse your record to find when household food runs short.\n\nChoose locally suitable crops and work backwards from the harvest you need. Check planting conditions and expected time to harvest.\n\nA date that works on another farm may not work here. Include a backup plan when rain, water or crops fail.",
        "keyPoints": [
          "Record harvest amounts and destinations separately from cash",
          "Include production and selling costs when assessing a price",
          "Label worked examples; use your actual costs for decisions",
          "Plan for food gaps using local growing conditions and harvest timing"
        ],
        "quiz": [
          {
            "q": "In this teaching example, tomatoes sell at R15/kg and cost R18/kg to produce. What should the farmer review?",
            "options": [
              "Keep selling at R15 — short-term loss builds relationships",
              "Stop growing tomatoes entirely",
              "The selling price, costs and whether another crop would give a better return",
              "Apply for a subsidy to cover the gap"
            ],
            "correct": 2,
            "rationale": "The example price is below the stated cost. Review the gap and customer demand before making the next production decision."
          },
          {
            "q": "A farmer's records show she's short of vegetables every June and July. What's the useful action here?",
            "options": [
              "Buy vegetables at market each June and July",
              "Work backwards from the food gap using suitable local crops and their harvest timing",
              "Accept her farm can't produce in winter",
              "The records show a soil fertility problem"
            ],
            "correct": 1,
            "rationale": "Records identify the gap. Crop choice and sowing dates must then match the local climate, water and expected harvest time."
          }
        ]
      },
      {
        "id": "market-community-l2",
        "infographicUrl": "/course-images/market-community/market-community-l2.jpg",
        "infographicAlt": "Three ways to sell from one farm: a roadside stall, a group delivery to a shop, and a box going straight to a household.",
        "title": "Selling Surplus: Where to Sell and How to Price",
        "body": "Ask what the customer needs: product, quantity, quality, delivery and payment date.\n\nCompare market fees, transport, packing and unsold produce as well as the selling price.\n\nCheck the market rules and local trading and food requirements. An informal stall does not automatically have no rules or costs.\n\nDirect selling can retain more of the sale price, but it also takes time, packing, transport and customer care.\n\nA box scheme supplies a regular selection to agreed customers.\n\nAgree the contents, price, payment and what happens when crops are short. Regular orders help planning only when customers and growers can keep the agreement.\n\nStart from what you can reliably supply and what customers want.\n\nCheck the costs and household food needs before promising regular boxes.\n\nGarden area or customer count alone does not predict income. Try a manageable arrangement and record the results.\n\nIf production changes from week to week, avoid promising a fixed delivery you cannot supply.\n\nOffer the surplus you have and agree clear terms with customers.\n\nDescribe your growing practices honestly. Check any certification or claim the buyer requires before using a label.",
        "keyPoints": [
          "Agree product, quantity, quality, delivery and payment",
          "Compare costs and losses as well as selling price",
          "Promise regular boxes only when supply and customer terms support them",
          "Check market rules and describe growing practices honestly"
        ],
        "quiz": [
          {
            "q": "A smallholder has inconsistent weekly production — surplus some weeks, little in others. Which channel suits her best?",
            "options": [
              "A formal market stall needing consistent weekly supply",
              "A box scheme needing the same produce weekly",
              "An informal market or neighbour sales with no fixed commitment",
              "A daily-delivery school contract"
            ],
            "correct": 2,
            "rationale": "This is the one channel that doesn't require her to promise a fixed amount every week — she sells what she actually has."
          },
          {
            "q": "How can agreed regular orders help a grower plan?",
            "options": [
              "Box customers always pay more per kilogram",
              "Box schemes let you charge extra for packaging",
              "Committed subscription income lets you plan production around real demand instead of growing speculatively",
              "Box schemes avoid tax obligations"
            ],
            "correct": 2,
            "rationale": "Confirmed orders give information about demand. Their value still depends on reliable supply, payment and the costs of fulfilling them."
          }
        ]
      },
      {
        "id": "market-community-l3",
        "infographicUrl": "/course-images/market-community/market-community-l3.jpg",
        "infographicAlt": "Five small farms linked to one shared central point, where their separate harvests combine into one much larger crate.",
        "title": "Building Community Food Networks: Strength in Numbers",
        "body": "Neighbours can share different varieties and the work of saving seed.\n\nRecord the crop, variety, source and collection date. Plan suitable isolation, selection, drying and storage for each crop.\n\nSharing does not automatically multiply diversity or improve quality. Check identity and germination before relying on shared seed.\n\nTool sharing puts expensive equipment within reach of the group.\n\nA water pump or grain mill may be beyond one household’s budget.\n\nShared use spreads the value across the group and helps each farm do work it could not do alone.\n\nHandle produce gently and keep suitable shade, packaging and storage through delivery.\n\nA nearby buyer may reduce the journey, but losses and selling costs still need measuring.\n\nCompare the money received after fees, transport and spoilage for each option. Do not assume the nearest buyer always gives the best return.\n\nNeighbours can demonstrate useful skills and compare what happened on their own farms.\n\nRecord the method, conditions and result so others can judge whether it may suit their land.\n\nSeek qualified advice for unfamiliar disease or technical problems. Shared experience and specialist help can work together.",
        "keyPoints": [
          "Record seed identity, source and quality when sharing",
          "Agree care, booking and repair responsibilities for shared tools",
          "Measure losses and net returns for each selling route",
          "Combine shared experience with qualified help when needed"
        ],
        "quiz": [
          {
            "q": "Neighbours want to share saved seed. What helps make the shared seed useful?",
            "options": [
              "Mix all varieties without labels",
              "Agree isolation, selection, labelling, storage and germination checks",
              "Assume sharing automatically improves every seed lot",
              "Rely only on the size of the group"
            ],
            "correct": 1,
            "rationale": "Sharing access is useful, but quality still depends on crop-specific seed-saving practices and reliable records."
          },
          {
            "q": "A grower is comparing a distant market with nearby customers. What should guide the decision?",
            "options": [
              "Always choose the highest headline price",
              "Always choose the shortest journey",
              "Compare money received after fees, transport, unsold produce and losses",
              "Assume joining a group removes all costs"
            ],
            "correct": 2,
            "rationale": "Distance affects costs, but it is not the only factor. Use actual returns and losses to compare the options."
          }
        ]
      }
    ]
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

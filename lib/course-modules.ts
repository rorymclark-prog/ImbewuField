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
  /** Primary references for a learner or facilitator who wants to check the instruction. */
  sources?: { title: string; url: string }[];
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
        body: "David Holmgren set out twelve design principles for permaculture. We begin with three useful principles for smallholders: observe and interact — watch your land through a full season before major earthworks; catch and store energy — harvest rain, sun and biomass before they leave your property; and use edges and value the marginal — the fence line or stream bank is often your most productive spot.\n\nOthers worth knowing: produce no waste (scraps become compost, compost becomes soil), use small and slow solutions (a bucket can irrigate a bed without electricity), and use and value diversity — different crops may respond differently to a hazard, but a mixed planting can also suffer serious damage.\n\nPick two or three principles that speak to your biggest problem and apply them hard. The rest become obvious as you go.",
        keyPoints: [
          "Observe your land for a full season before major earthworks",
          "Catch and store rain, sun, and biomass before they leave your property",
          "Edges and margins are often your most productive zones",
          "Diversity spreads risk; it does not guarantee a harvest",
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
              "Garden, trees and poultry arranged so hens use harvested beds while growing food stays fenced off",
              "Separate paddocks for each crop",
              "All animals kept off the cultivated zone",
            ],
            correct: 1,
            rationale: "Integration connects useful activities while protecting food. Fresh poultry manure can carry harmful germs: keep hens off growing food and plan a safe interval before the next harvest with your extension officer.",
          },
        ],
      },
      {
        id: "intro-permaculture-l3",
        infographicUrl: "/course-images/intro-permaculture/intro-permaculture-l3.jpg",
        infographicAlt: "Rings spreading outward from a house. The ring closest to the door is tended every day; each ring further out is visited less often and left wilder.",
        title: "Zones and Sectors: Organising Your Farm by Energy",
        body: "Zones and sectors help you plan work and understand your site. Zones run from 0 to 5 by how often activities need you. Zone 0 is the house. Zone 1 holds things you use or check most often, such as kitchen herbs and salad greens. Zone 2 can hold regularly tended plantings and poultry. Zone 3 can hold main field crops. Zone 4 can hold managed woodland and forage. Zone 5 is a wild area for observation and habitat. The numbers are not a care timetable: visit crops and animals as often as they need. A small plot may not have every zone.\n\nSectors show influences arriving from outside, such as sun, wind, rain, flood and fire. Directions differ between sites. Observe your own land, check local records and ask neighbours. In an example with damaging wind from the north-west, a windbreak belongs between that wind and the crops.\n\nSketch your boundary, house, frequently used areas and outside influences. Fit the zones to real paths and land; they do not need to be circles.",
        keyPoints: [
          "Zone 1 keeps frequently used plants and activities close to the house",
          "Zones organise labour by how often you need to visit",
          "Sectors map incoming energies: sun, wind, frost, flood, fire",
          "A simple sketch of zones and sectors is enough to start designing",
        ],
        quiz: [
          {
            q: "You plant herbs in Zone 3, the main field far from the house. What problem does this create?",
            options: [
              "Herbs grow too large",
              "The long walk makes frequent harvesting and checking less convenient",
              "Herbs cross-pollinate with main crops",
              "Zone 3 gets too much sun for herbs",
            ],
            correct: 1,
            rationale: "Put plants you use often where you can reach them easily. Harvest according to the plant and your needs; not every herb needs daily picking.",
          },
          {
            q: "In this example, damaging wind comes from the north-west. Where should a windbreak go?",
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
        body: "Before you harvest water, learn where it already goes.\n\nWalk after the storm, when it is safe. Stay away from lightning, fast water and unstable banks. Look for rills, places where water spreads or ponds, and where it leaves your property.\n\nMark useful places to retain water and the routes excess water needs to leave safely. Keeping every drop is not safe on every site.\n\nBuild a rigid A-frame from two equal legs, a crossbar and a weighted string hanging from the top. The weight must hang freely below the crossbar.\n\nCalibrate before use. Mark both foot positions on firm ground and mark where the settled string crosses the bar. Swap the legs onto the same two foot positions and mark the string again. Halfway between the two marks is the level mark. If they coincide, use that mark.\n\nKeep one foot fixed. Move the other across the slope until the settled string meets the level mark. Peg that foot position, pivot onto it, and repeat to trace a contour.\n\nRecheck calibration if the frame shifts. This marks level points; it does not design a dam or prove an earthwork is safe. Get suitable technical advice before digging.\n\nWater can gain speed and erode soil as it runs downhill.\n\nLook for safe places to slow it high on the slope, let it soak in where the soil and site are suitable, and guide excess water safely away.\n\nDo not force water into unstable or already waterlogged ground. Plan a safe overflow before earthworks. The aim is useful moisture without creating a new erosion or flooding problem.",
        keyPoints: [
          "Walk after a storm when it is safe; keep away from lightning, fast water and unstable banks",
          "Calibrate the A-frame before tracing level points across a slope",
          "Slow and retain water only where the soil and site are suitable; plan safe overflow",
          "Excess water needs a safe route out; retaining every drop is not safe on every site",
        ],
        quiz: [
          {
            q: "You want to mark level points for a first site sketch. Which low-cost tool can help?",
            options: [
              "Hire a civil engineer",
              "Estimate contours by eye",
              "Build and calibrate an A-frame level",
              "Use a spirit level on a board every 5 metres",
            ],
            correct: 2,
            rationale: "A calibrated A-frame can mark level points for a site sketch. It does not design a dam or show that an earthwork is safe; get suitable technical advice before digging.",
          },
          {
            q: "On a slope, where should you first look for a suitable place to slow runoff?",
            options: [
              "At the bottom where it collects",
              "In the middle in a large dam",
              "Higher on the slope, after checking soil, stability and a safe overflow route",
              "At the boundary",
            ],
            correct: 2,
            rationale: "Slowing runoff higher on a slope can reduce its erosive force. The site must be suitable; do not force infiltration into unstable or waterlogged ground.",
          },
        ],
      },
      {
        id: "reading-landscape-l2",
        infographicUrl: "/course-images/reading-landscape/reading-landscape-l2.jpg",
        infographicAlt: "A slope with the sun in the north. Shadows from the building and the tree fall south, down the slope.",
        title: "Sun Angles, Shade, and Aspect: Getting the Most from Sunlight",
        body: "In South Africa, winter midday sun is to the north.\n\nNorth-facing slopes tend to receive more winter sun and warmth than south-facing slopes. Actual moisture and frost also depend on shade, soil and where cold air settles.\n\nObserve your own site across the seasons before choosing positions for tender crops, trees and buildings.\n\nWinter sun sits lower than summer sun, so shadows change with the season.\n\nA wall or shade cloth north of a bed can block useful winter light. The effect depends on its height, distance from the bed and how much light passes through it.\n\nCheck the spot at 8am, midday, and 4pm on a winter's day. Mark the shadow edges on your sketch before placing anything permanent.\n\nA sun-warmed north-facing wall can offer a warmer position for frost-sensitive plants such as pawpaw and young citrus.\n\nA wall can store daytime warmth and release it at night. This can help, but it does not guarantee protection from a severe frost.\n\nCheck local frost conditions and the plant's needs. Avoid a hollow where cold air collects and plan any additional protection before planting.",
        keyPoints: [
          "North-facing slopes tend to receive more winter sun; check conditions on your own site",
          "Winter sun sits lower, so check how shadows change between seasons",
          "Cold air can collect in hollows; shade and local weather also affect frost",
          "Check shadow patterns at 8am, midday, and 4pm in winter before placing permanent structures",
        ],
        quiz: [
          {
            q: "Which position may offer useful winter warmth for a frost-tender young pawpaw?",
            options: [
              "Lowest point where cold air drains to",
              "South-facing slope",
              "Against a north-facing wall that radiates heat at night",
              "Under an existing large tree",
            ],
            correct: 2,
            rationale: "A sun-warmed wall can release heat at night. This may help, but severe frost can still damage the plant; check local conditions and plan any extra protection.",
          },
          {
            q: "A farmer plans shade cloth on the north side of her garden. What should she check before building?",
            options: [
              "How its height and distance could shade the bed from low winter sun",
              "It redirects frost away",
              "No effect, since the sun is overhead at noon",
              "It reduces evaporation and helps the crops",
            ],
            correct: 0,
            rationale: "Winter shadows depend on the structure, distance and sun angle. Observe the actual bed; a height alone cannot tell you how long it will be shaded.",
          },
        ],
      },
      {
        id: "reading-landscape-l3",
        infographicUrl: "/course-images/reading-landscape/reading-landscape-l3.jpg",
        infographicAlt: "A farm from above with three sets of arrows: the direction the wind usually comes from, cold air draining downhill into a frost hollow, and the direction the land slopes.",
        title: "Wind, Frost, and Topography: Reading the Invisible Forces",
        body: "Wind can damage a smallholding even when it is hard to see.\n\nObserve the directions damaging winds come from on your own site. Note the season, exposed ridges, gaps and sheltered places. Ask neighbours and check local weather records.\n\nWind patterns differ between sites. Use your observations when placing windbreaks and crops; do not copy a direction from another farm.\n\nOn clear, calm cold nights, cold air can drain downhill and collect in low ground.\n\nThese hollows can be colder than nearby slopes. The pattern depends on the land, barriers and weather.\n\nVisit safely at dawn in your local frost season. Look for ice crystals on surfaces and record where frost remains longest. Mist alone does not prove frost.\n\nFor a frost-sensitive nursery, look for a sheltered, gently sloping position above the places where cold air collects. A north-facing aspect can add winter warmth.\n\nFor tomatoes troubled by late blight, choose a site with good airflow and morning sun to help leaves dry.\n\nThis can reduce the time leaves stay wet. It does not cure late blight or replace disease identification and suitable management advice.",
        keyPoints: [
          "Observe wind directions and seasons on your own site and check local records",
          "Cold air can drain downhill and collect in low ground on calm, cold nights",
          "Mark exposed ridges, gaps and sheltered places rather than assuming one regional pattern",
          "Look for ice crystals on a safe dawn visit; mist alone does not prove frost",
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
            rationale: "This position may avoid the coldest hollow and receive winter sun. Check actual frost, wind and plant needs before placing the nursery.",
          },
          {
            q: "A farmer is choosing a tomato bed. Which site can help leaves dry after wet weather?",
            options: [
              "A sealed, unventilated tunnel",
              "Somewhere with good airflow and morning sun that dries leaves quickly",
              "A low spot near a dam",
              "A shaded south wall",
            ],
            correct: 1,
            rationale: "Airflow and morning sun can shorten the time leaves stay wet. They do not cure late blight or replace identifying and managing the disease.",
          },
        ],
      },
      {
        id: "reading-landscape-l4",
        infographicUrl: "/course-images/reading-landscape/reading-landscape-l4.jpg",
        infographicAlt: "A hand-drawn site map on paper showing north, the buildings, the water, and the boundary — rough, as a farmer would draw it.",
        title: "Making a Simple Site Map: Your Design Starts on Paper",
        body: "Start with paper, a tape measure, a compass and time to observe your land.\n\nSketch the boundary and mark north. Record measured distances where you can. If you use pacing, label the distances as estimates. Add the house, trees, water, roads and fences.\n\nDraw the patterns you have observed. Check important distances before using the sketch to place anything permanent.\n\nNotice where frost remains longest and check where the soil stays damp in dry months.\n\nRecord existing vegetation, including patches of khakibos or blackjack. Their presence alone does not prove the soil is compacted or tell you its fertility.\n\nCompare the soil beneath different patches. Look at its structure, moisture and how water enters it. Mark observations and unanswered questions on your map.\n\nMark summer and winter wind separately. They can come from different directions, so a windbreak or crop position that works in one season may be wrong in the other.\n\nOverlay your zones and sectors on the same base map.\n\nUpdate the sketch season by season. A pencil map you actually use is worth more than a perfect map drawn once.",
        keyPoints: [
          "A site map needs only paper, a tape measure, a compass, and observation",
          "Mark water flow, wind direction, frost pockets, and existing vegetation",
          "Vegetation is an observation to investigate, not proof of compaction or fertility",
          "Overlay zones and sectors on your base map to complete the design skeleton",
        ],
        quiz: [
          {
            q: "You notice thick blackjack in one corner. What should you do next?",
            options: [
              "Assume the soil is exceptionally fertile",
              "Assume it has a higher water table",
              "Record the patch and compare its soil structure and moisture with nearby ground",
              "Assume it proves there is a hidden seep",
            ],
            correct: 2,
            rationale: "A weed patch alone cannot diagnose compaction, fertility or a seep. Check the soil and record what you find before choosing an intervention.",
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
    description: "Swales, berms, dams, tanks and greywater: plan where water can soak in and where excess can leave safely.",
    durationMins: 35,
    category: "water",
    lessons: [
      {
        id: "water-harvesting-l1",
        sources: [{ title: 'Resource Conservation District: Slow it. Spread it. Sink it! (hosted by USDA NRCS)', url: 'https://www.nrcs.usda.gov/sites/default/files/2024-07/Home_Drainage_Guide.v25.pdf' }],
        infographicUrl: "/course-images/water-harvesting/water-harvesting-l1.jpg",
        infographicAlt: "A slope cut through the middle: a shallow ditch dug along the contour with a raised mound below it. Arrows show rain slowing, spreading sideways, and soaking into the soil instead of running away.",
        title: "Swales and Berms: Slowing Water on the Slope",

        body: "A swale is a level trench dug exactly on contour — not angled, perfectly level end to end — so water fills it evenly and soaks in rather than running off.\n\nThe excavated soil forms a berm on the downhill side.\n\nTrees planted there draw on stored water long after the rain has stopped.\n\nThe excavated soil forms a berm on the downhill side.\n\nThe berm, the downhill mound of excavated soil, is where you plant trees.\n\nTrees planted there draw on stored water long after the rain has stopped.\n\nA storm can bring more water than a swale can hold. Plan a stable overflow route before digging.\n\nTrace it to a place that can receive the excess without erosion or harm. Do not simply send it towards a neighbour, road or building.\n\nA second swale or dam is only an option if its capacity and overflow have also been checked.\n\nSlope alone does not tell you whether a swale is safe. Check soil depth, drainage, ground stability and what lies downhill.\n\nDo not dig into steep, unstable or waterlogged ground on the strength of this diagram. Get a competent local practitioner to assess the site.\n\nA small soil observation cannot prove that a large earthwork is safe.",
        keyPoints: [
          "A swale is a level trench on contour — it sinks water, it doesn't direct it",
          "The berm (downhill mound of excavated soil) is where you plant trees",
          "Include a safe overflow point so storms don't breach the berm",
          "Assess soil, drainage, slope stability and downstream risks before digging",
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
            q: "A farmer wants to slow erosion on a steep slope. What should happen before digging?",
            options: [
              "Standard swales dug as deep as possible",
              "A competent local practitioner assesses the site and suitable options",
              "A large dam at the bottom to catch all runoff",
              "Compacting the soil surface with a roller",
            ],
            correct: 1,
            rationale: "A slope percentage alone cannot establish safety. The soil, drainage, ground stability and land below all matter.",
          },
        ],
      },
      {
        id: "water-harvesting-l2",
        sources: [{ title: 'FAO: Manual on Small Earth Dams — design, spillways and maintenance', url: 'https://www.fao.org/4/i1531e/i1531e.pdf' }],
        infographicUrl: "/course-animations/water-harvesting/posters/dam-spillway.jpg",
        infographicAlt: "View from above: water enters a reservoir and excess flows around the earthen wall through a separate side spillway. Protective grass covers the wall; no trees grow on it. A process diagram, not a construction plan.",
        title: "Farm Dams and Ponds: Storing Water for the Dry Season",
        body: "Stored water can help through dry periods. How long it lasts depends on rainfall, losses and how much you use.\n\nRecord when rain actually arrives on your site. A yearly rainfall total does not tell you how much water will be available in the driest month.\n\nA dam wall holds water back. A spillway gives excess water a planned way around it.\n\nHave a competent dam designer assess the catchment, soil, flood flows and downstream consequences before any wall is built. Check the approvals needed locally.\n\nA bigger catchment also brings a bigger flood. Never build first and work out the spillway later.\n\nKeep trees and deep-rooted shrubs away from the dam wall, spillway and outlet. Their roots can damage these structures.\n\nMaintain the protective grass cover and keep the spillway clear. Report erosion, cracks or unexpected seepage to a competent dam practitioner.\n\nDo not dig out established roots from a dam wall yourself. Repairs need an assessed plan.",
        keyPoints: [
          "Have a competent dam designer assess catchment, flood flows, soil and downstream risks",
          "Design the spillway before the wall — an overtopped wall can breach catastrophically",
          "Keep trees and deep-rooted shrubs away from the dam wall and spillway",
          "Maintain protective grass cover and report erosion, cracks or unexpected seepage",
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
            q: "Which action helps protect an earthen dam wall?",
            options: [
              "Planting large trees directly on the wall",
              "Maintaining protective grass cover and keeping the spillway clear",
              "Blocking the spillway to store more water",
              "Digging established roots out of the wall without an assessed repair plan",
            ],
            correct: 1,
            rationale: "Grass protects against surface erosion while allowing inspection. Trees and deep roots can damage the wall; a clear spillway lets the designed overflow route work.",
          },
        ],
      },
      {
        id: "water-harvesting-l3",
        sources: [{ title: 'Water Research Commission: Resource Guidelines for Rainwater Harvesting', url: 'https://www.wrc.org.za/wp-content/uploads/mdocs/TT%20758%20web.pdf' }],
        infographicUrl: "/course-animations/water-harvesting/posters/first-flush.jpg",
        infographicAlt: "A cutaway of a roof-water system: the first-flush chamber is full and its float has closed it. Later runoff enters a covered tank. The visible stored water does not mean it is safe to drink.",
        title: "Rainwater Tanks and Roof Catchment",
        body: "Roof area, rainfall and collection losses determine potential harvest. Tank overflow and water use reduce what remains available.\n\nFor a calculation exercise, assume a 100 square metre roof, 800 millimetres of rain and a collection factor of 0.9. Multiply these to get 72,000 litres.\n\nThose are example inputs, not a rainfall forecast or a promise that a garden will have enough water.\n\nRoof runoff can carry droppings, dust and other contamination. Divert the first runoff before it enters the tank.\n\nThe amount to divert depends on roof area and local conditions. Follow a suitable design and the device instructions; there is no single volume for every roof.\n\nA first-flush diverter does not make water safe to drink.\n\nList the uses you want the tank to supply. Measure or estimate their daily demand.\n\nCompare that demand with local rainfall records, usable storage and the dry period you need to cover.\n\nA tank size on its own cannot tell you how many weeks it will last.\n\nKeep the tank covered and screen openings against insects. Maintain the roof, gutters and diverter.\n\nA filter alone does not guarantee safe drinking water. Drinking use needs suitable treatment, disinfection and water-quality checks with qualified advice.\n\nKeep untreated water away from edible plant parts. Keep any alternative supply separate from drinking-water plumbing.",
        keyPoints: [
          "Estimate potential harvest from roof area, local rainfall and a stated collection factor",
          "A first-flush diverter removes the dirty first flush from every rain event",
          "Match tank size to your dry season length, not a single dry spell",
          "Keep tanks covered; filtration alone does not guarantee safe drinking water",
        ],
        quiz: [
          {
            q: "In an exercise, assume an 80m² roof, 600mm of rain and a collection factor of 0.9. What is the calculated potential harvest?",
            options: [
              "About 24,000 litres",
              "About 43,200 litres",
              "About 80,000 litres",
              "About 6,000 litres",
            ],
            correct: 1,
            rationale: "80 times 600 times 0.9 equals 43,200 litres with these assumed inputs. Actual usable water also depends on rainfall timing, storage, overflow and demand.",
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
            rationale: "Keeping dirty first runoff out reduces contamination. It does not make later runoff safe to drink; keep untreated irrigation water off edible plant parts.",
          },
        ],
      },
      {
        id: "water-harvesting-l4",
        sources: [{ title: 'City of Cape Town: Alternative Water Systems — greywater guidance; check your own municipality’s requirements', url: 'https://www.capetown.gov.za/_documents/resource.capetown.gov.za/documentcentre/Documents/Procedures,%20guidelines%20and%20regulations/Guidelines%20for%20Alternative%20Water%20Installations.pdf' }],
        infographicUrl: "/course-animations/water-harvesting/posters/greywater-under-mulch.jpg",
        infographicAlt: "A cutaway shows basin water flowing through a pipe into soil under mulch, away from the tree trunk. Water remains below the surface and does not touch the fruit. Mulch does not disinfect it.",
        title: "Greywater Reuse: Keep People, Food and Soil Protected",
        body: "Greywater is used water from washing. Toilet water is different and must never enter this garden system.\n\nWashwater can still carry germs, salts and cleaning products. Reuse depends on its source, quality and where it will go. Do not assume that clear-looking water is safe.\n\nAvoid water containing bleach, harsh cleaners or nappy waste. Do not reuse it when someone in the household is ill. Plain soap is not a guarantee of suitability.\n\nUse suitable greywater promptly, within 24 hours. Stop if it ponds, smells or runs off.\n\nKeep it below mulch, away from people and animals. Mulch does not disinfect water.\n\nDo not use greywater on leafy vegetables, root vegetables or seedlings.\n\nA suitable system may supply established trees or non-edible plants while keeping water off edible parts. Get advice on water quality and stop if plants or soil show damage.\n\nCheck municipal requirements before fitting a permanent system. This lesson does not approve an installation.",
        keyPoints: [
          "Greywater is washwater from bath, basin, and laundry — never toilet water",
          "Avoid unsuitable washwater; use suitable greywater within 24 hours",
          "Keep greywater below mulch and away from people and edible plant parts; mulch does not disinfect",
          "Check your municipality's greywater rules before installing a permanent system",
        ],
        quiz: [
          {
            q: "With suitable water quality and local advice, which option reduces contact with greywater?",
            options: [
              "Watering lettuce that will be eaten raw",
              "Supplying an established tree below mulch, keeping water away from people and fruit",
              "Watering seedlings in a nursery tray",
              "Filling a fishpond",
            ],
            correct: 1,
            rationale: "Below-mulch delivery can reduce contact, but it does not disinfect. Use suitable water promptly; stop if it ponds or runs off.",
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
            rationale: "Cleaning products can harm soil organisms and roots. Reuse is a way to supply water when its quality is suitable, not a guarantee of fertiliser value.",
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
        body: "Bare soil is exposed soil. A South African summer storm can drop 60mm in thirty minutes — enough to strip topsoil that took centuries to form. A 5 to 10cm mulch layer of straw, dry grass or wood chips cuts erosion sharply, keeps soil several degrees cooler in summer — sometimes up to 10°C on hot Highveld days — suppresses weeds, and feeds soil life as it breaks down.\n\nCover crops protect bare ground between main seasons. On the Highveld, oats or lupins sown after maize harvest cover the soil through frost months, then get slashed in before spring planting. In KZN, sunn hemp grows fast in summer and adds a large amount of nitrogen-rich biomass. Cowpea fixes nitrogen and tolerates the Lowveld's early-summer dry spell.\n\nWorm farms turn suitable raw kitchen scraps into rich castings. Keep the bedding moist rather than waterlogged. The liquid draining out is leachate; it can carry harmful germs from material that has not finished breaking down. Do not use leachate on vegetables or other food crops, even when diluted. Dilution does not disinfect it.",
        keyPoints: [
          "A 5-10cm mulch layer cuts soil temperature, suppresses weeds, and prevents erosion",
          "Cover crops like sunn hemp or lupins protect soil between seasons and add organic matter",
          "Legume cover crops fix nitrogen for free, cutting your fertiliser bill",
          "Do not use worm-farm leachate on food crops, even when diluted",
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
            q: "Why should you keep worm-farm leachate off food crops, even after dilution?",
            options: [
              "It always contains too little water",
              "It may carry harmful germs, and dilution does not disinfect it",
              "It makes all soil permanently acidic",
              "It contains no nutrients at all",
            ],
            correct: 1,
            rationale: "Leachate drains through material that may not have finished breaking down. It can carry harmful germs. Adding water does not make it safe for vegetables or other food crops.",
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
        infographicUrl: "/course-art/vegetables-staples/bed-reach.jpg",
        infographicAlt: "A grower reaches the centre of a narrow pegged rectangular bed while kneeling on the path outside the growing soil.",
        title: "Preparing and Planting Your Beds",
        body: "Compacted soil loses its air spaces. Roots slow down. Water soaks in differently. The bed gets harder to work every season.\n\nThe protection is simple. Permanent paths, and a bed narrow enough to reach into from both sides.\n\nOne metre to one point two metres wide. That's the working number. At that width you can reach the centre from either path, and your feet never touch the growing area.\n\nNow think about your own beds. Can you reach the middle without stepping inside? Go and try it before you plant anything else.\n\nThere's no single bed shape that's right everywhere.\n\nStart with the least disturbance that solves your problem.\n\nNo-dig suits most garden soils. Leave the structure alone and build fertility on top.\n\nDouble-digging is hard work, and it should answer a real problem — compacted ground or heavy clay. Not habit.\n\nRaised beds suit wet ground, where water needs somewhere to drain away to.\n\nSunken beds suit dry ground, where you want to catch and hold what rain you get.\n\nLook at your own ground after heavy rain. Does water sit, or does it run off? That answer chooses your bed.\n\nSome crops do better sown straight where they will grow. Beans, carrots and maize belong in that group. Tomatoes and brassicas can start in a protected nursery before transplanting.\n\nUse guidance for the actual crop and cultivar, then check spacing against local soil, water, season and mature size. Do not assume every seed packet was written for a cooler, wetter country. Keep paths and enough room to tend the plants.\n\nBefore you plant, mark the bed out.\n\nOne point two metres wide. Three metres long. One practice bed.\n\nUse pegs and string. Mark the rectangle, and mark both access paths.\n\nThen prepare for your own soil — no-dig first, and dig deeper only if your ground genuinely needs it.\n\nA string line turns an idea into a decision. Once the paths exist, keep them. Once the growing area exists, protect it.\n\nThat bed gets easier to improve every season, because you stopped walking on it.",
        keyPoints: [
          "Keep beds 1-1.2m wide so you never need to step on the growing area",
          "No-dig suits most soils; double-dig only compacted or heavy clay ground",
          "Transplant crops needing a head start; direct-seed crops that resent root disturbance",
          "Check spacing for the actual crop and cultivar against local soil, water and season",
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
        sources: [{"title": "West Virginia University: succession planting", "url": "https://extension.wvu.edu/lawn-gardening-pests/news/2019/01/15/basics-of-succession-planting"}],
        infographicUrl: "/course-art/vegetables-staples/sowing-record.svg",
        infographicAlt: "Four record-keeping steps: sow, observe, sow again according to crop and season, and record actual harvest dates. These are not guaranteed maturity stages.",
        title: "Succession Planting and Intercropping",
        body: "Succession planting is a calendar habit. Choose a crop your household eats often, then sow small amounts at intervals.\n\nTwo to three weeks can be a starting rhythm for suitable crops, not a rule for every crop or season. Check days to harvest and record what actually happens.\n\nStaggering sowings can spread harvest and labour and reduce reliance on one planting. Heat, drought or pests may still affect several sowings. Adjust the plan from your observations.\n\nSow one small batch, record its date, then sow the next when your crop and season call for it.\n\nIn a two-to-three-week example, four sowings will be at different stages. The first is not automatically ready when the fourth is planted.\n\nCheck the crop and cultivar’s harvest time, then compare it with actual growth. Record the first and last harvest dates. Use those dates to adjust the next sowing interval and reduce gaps.\n\nIntercropping is not just crowding different plants together. Each plant needs a job, and enough space to do it.\n\nThe three sisters is the clearest example.\n\nMaize gives height and structure.\n\nBeans climb the maize, and store as protein.\n\nPumpkin spreads across the ground, shading the soil and holding moisture.\n\nTiming matters. Establish the maize first, so it's strong enough to carry the beans when they start to climb.\n\nThree crops share one piece of ground, but they can still compete for light, water and nutrients. Watch their growth and adjust spacing and timing.\n\nEvery place has a hungry gap. The weeks when the last harvest has run low and the next one isn't ready.\n\nYours might come after stored maize runs out. It might come before winter greens are ready. It might come in a dry period when water limits the garden.\n\nDon't copy somebody else's calendar. Name your own months first.\n\nWrite them down. Then choose the crop and the sowing date that puts food into that gap.\n\nThat's planning backwards, and it's the difference between a garden that looks productive and a household that eats.",
        keyPoints: [

          "Use small batches and adjust the sowing interval to crop, cultivar, season and harvest records",
          "The Three Sisters example combines maize, climbing beans and pumpkin; plan spacing and timing",
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
              "It provides a climbing bean crop that can be harvested and stored for protein",
              "It climbs the pumpkin vines",
              "It repels pests from the maize",
            ],
            correct: 1,
            rationale: "Maize provides structure, beans provide a protein crop and pumpkin covers ground. Nitrogen in legume residues returns through decomposition, not a guaranteed direct supply to neighbouring crops.",
          },
        ],
      },
      {
        id: "vegetables-staples-l3",
        infographicUrl: "/course-images/vegetables-staples/vegetables-staples-l3.jpg",
        infographicAlt: "Three staple crops together: a tall grain stalk, a climbing vine on a pole, and a root crop shown half below the ground.",
        title: "Staple Crops: Maize, Beans, and Root Vegetables",
        body: "A staple earns its place because it feeds the household beyond the day of harvest.\n\nIt carries energy or protein. It stores, or it stays in the ground until you need it. And often it carries cultural memory too.\n\nOne staple leaves you vulnerable. Two or more give you options when weather or pests hit.\n\nGrow at least two. Not one.\n\nWhich staple does your household rely on most heavily right now? That's the one whose failure would hurt most — so that's the one that needs a companion.\n\nEach staple protects you against something different.\n\nMaize gives calories, and stores dry. Open-pollinated maize also lets you save your own seed, if you manage isolation and selection.\n\nBeans and cowpeas give a storable protein harvest.\n\nSweet potato tolerates dry periods, and its leaves are edible too.\n\nAmadumbe handles wetter ground, where other staples struggle.\n\nNotice that they fail in different conditions. That's the whole point.\n\nResilience doesn't mean nothing fails.\n\nIt means one failure doesn't finish your household's food plan.\n\nOne crop is one point of failure.\n\nTwo or more staples give you more ways to keep eating.\n\nDifferent crops use water, soil and seasons differently. That difference is the protection.",
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
        infographicUrl: "/course-art/vegetables-staples/inspect-leaf.jpg",
        infographicAlt: "A grower inspects the underside of an attached leaf with a magnifying glass, with a blank notebook on the path. An illustrative observation scene, not a species-identification plate.",
        title: "Pest and Disease Management Without Chemicals",
        body: "Pest pressure usually rises for a reason.\n\nPlants under stress. One crop dominating the ground. Or broad chemical use that has already removed the predators that were helping you.\n\nSo before you treat anything, look at the whole system.\n\nIs the plant short of water? Is the soil compacted, or hungry? Are predators already working on the problem for you?\n\nA yellow leaf is not automatically an insect. It can be water, nutrition, or root damage. Find out which before you act.\n\nWork through four steps, in order.\n\nOne. Observe. Look at the damage pattern, the underside of the leaf, the stem, and the plants nearby.\n\nTwo. Check for stress. Soil moisture, roots, spacing, nutrition, drainage.\n\nThree. Protect what's helping you. Beneficial insects are doing work you'd otherwise do yourself.\n\nFour. Only then, act — and start with the lightest thing that works. Physical removal and better plant health solve most small outbreaks.\n\nIf you use a neem product, follow the label. Don't improvise a stronger mixture. Even lower-risk products harm the wrong insects when they're misused.\n\nBe honest with yourself about which step you usually skip.",
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
    id: "plant-guilds",
    title: "Plant Selection & Guilds",
    description: "Choose plants that support each other — nitrogen fixers, mulch plants, pest attractors.",
    durationMins: 20,
    category: "plants",
    lessons: [
      {
        id: "plant-guilds-l1",
        sources: [{"title": "World Agroforestry: Sesbania sesban", "url": "https://apps.worldagroforestry.org/treedb/AFTPDFS/Sesbania_sesban.PDF"}, {"title": "University of Minnesota: nitrogen in soils", "url": "https://extension.umn.edu/agriculture/crop-production/nutrient-management-for-minnesota-crops/understanding-nitrogen-in-soils"}],
        infographicUrl: "/course-art/plant-guilds/root-nodules.jpg",
        infographicAlt: "A schematic legume root with nodules and a magnified rhizobia inset; nutrient release through decomposition is explained separately.",
        title: "Nitrogen Fixers: Plants That Feed the Soil",
        body: "When soil is tired, find out what is limiting growth. Water, soil structure and different nutrients can all matter.\n\nLegumes can fix nitrogen through their partnership with rhizobia. Mulch returns plant material to the soil, and flowers can support helpful insects.\n\nChoose each plant for the conditions and the job your garden actually needs.\n\nLegumes partner with soil bacteria called rhizobia in root nodules. The bacteria convert nitrogen from the air into forms the legume can use.\n\nNitrogen in cut leaves and dead roots returns to the soil as organisms decompose that material. Cutting does not make all of it immediately available to neighbouring crops.\n\nUseful nitrogen-fixing trees include Senegalia, formerly Acacia, species and relatives like flat-crown, Albizia adianthifolia.\n\nTagasaste suits the Western Cape and highland zones.\n\nIt self-seeds readily, so plant it with care near untransformed land.\n\nSesbania sesban suits warm, moist KZN coastal and Lowveld conditions. Do not confuse it with Sesbania punicea, the red-flowered invasive relative.\n\nSunn hemp is a fast-growing annual legume for suitable warm conditions.\n\nIts growth and nitrogen contribution depend on the stand, nodulation, soil and season. Do not budget a fixed fertiliser saving from the crop name alone.\n\nAfter cutting, decomposition takes time. Moisture, temperature and the material itself affect nutrient release; check local guidance before planting the next crop.\n\nPlace nitrogen fixers where their mature size, shade and water needs fit the fruit trees and paths. Leave access for cutting and carrying mulch.\n\nDo not rely on wind or downhill movement to deliver fertility to a tree. Return suitable cut material where mulch is needed.\n\nSesbania sesban is a short-lived shrub or small tree, not an annual. Thin or prune support plants when observation shows increasing competition.",
        keyPoints: [
          "Rhizobia in legume root nodules fix nitrogen from the air",
          "Residues return nutrients as they decompose; cutting is not instant fertiliser",
          "Sunn hemp is annual; Sesbania sesban is a short-lived shrub or small tree",
          "Choose placement from mature size, light, water and access; monitor competition"
        ],
        quiz: [
          {
            "q": "After a legume is cut, how do its residues contribute nitrogen to the soil?",
            "options": [
              "All nitrogen becomes available immediately",
              "Organisms decompose the residues; conditions affect the timing",
              "Wind carries nitrogen straight to fruit-tree roots",
              "The cut crop can no longer affect the soil"
            ],
            "correct": 1,
            "rationale": "Nitrogen in plant material returns through decomposition. Moisture, temperature and residue quality affect availability."
          },
          {
            "q": "Which description correctly distinguishes these two plants?",
            "options": [
              "Both are annual grasses",
              "Sunn hemp is an annual legume; Sesbania sesban is a short-lived shrub or small tree",
              "Sesbania sesban is an annual and sunn hemp is a fruit tree",
              "Both supply a guaranteed quantity of fertiliser"
            ],
            "correct": 1,
            "rationale": "Plant life cycle matters for placement and management. Neither plant name guarantees a fixed fertiliser saving."
          }
        ],
      },
      {
        id: "plant-guilds-l2",
        sources: [{"title": "SANBI: Tulbaghia violacea", "url": "https://pza.sanbi.org/tulbaghia-violacea"}],
        infographicUrl: "/course-art/plant-guilds/chop-and-drop.jpg",
        infographicAlt: "A grower places cut leaves on the soil while leaving the tree trunk clear; a parked wheelbarrow holds more leaves. The illustration does not establish cultivar identity.",
        title: "Mulch Plants and Pest Management",
        body: "Some plants grow deep, wide-ranging roots.\n\nThose roots can draw up minerals that other crops cannot reach.\n\nWhen you cut the plant and leave it on the ground, chop and drop returns that material to the surface.\n\nThis helps hold moisture, suppress weeds, and build steady organic matter, even when the exact fertility gain is debated.\n\nWatch the cut leaves lying around living plants. They protect the soil surface, hold moisture, and slowly become organic matter as soil life breaks them down.\n\nComfrey is a classic mulch plant because of its deep roots.\n\nUse Bocking 14 comfrey, Symphytum times uplandicum.\n\nThis cultivar is sterile and will not spread by seed.\n\nOrdinary comfrey can set viable seed and spread beyond where you planted it, so the cultivar choice matters.\n\nMany ladybirds eat aphids, and some parasitoid wasps attack caterpillars.\n\nFlowering plants such as African basil, borage and marigold can provide resources for useful insects. Observe which insects actually visit and whether crop damage changes.\n\nFlowers support pest management; they do not guarantee that an outbreak will stop. Use the Vegetables lesson to inspect damage and choose an appropriate response.\n\nWild garlic, Tulbaghia violacea, is a drought-tolerant flowering plant for suitable sites. Its leaves and flowers have food uses when correctly identified.\n\nUse it as part of a diverse planting, and observe insect visits. Do not promise that a ring of wild garlic will repel aphids or whitefly or cure an existing infestation.",
        keyPoints: [
          "Chop and drop protects the surface and returns organic material",
          "Use correctly sourced Bocking 14 comfrey when avoiding spread by seed",
          "Flowering plants can support useful insects; observe actual visitors",
          "Wild garlic is one member of a diverse planting, not a guaranteed pest remedy"
        ],
        quiz: [
          {
            "q": "Aphids are damaging a crop. What is a useful approach?",
            "options": [
              "Assume every yellow leaf is an aphid problem",
              "Inspect damage and predators, support useful insects and choose a response from the evidence",
              "Remove all flowers",
              "Assume wild garlic will cure the outbreak"
            ],
            "correct": 1,
            "rationale": "Flowers can support helpful insects, but an outbreak needs observation and an appropriate response. Companion plants do not guarantee control."
          },
          {
            "q": "Why choose the Bocking 14 comfrey cultivar when avoiding seed spread?",
            "options": [
              "It never needs water",
              "It is sterile and does not spread by seed",
              "It fixes nitrogen in nodules",
              "It has no roots"
            ],
            "correct": 1,
            "rationale": "The sterile cultivar does not spread by seed. Confirm cultivar identity when sourcing plants; an illustration cannot prove it."
          }
        ],
      },
      {
        id: "plant-guilds-l3",
        infographicUrl: "/course-art/plant-guilds/mango-guild.jpg",
        infographicAlt: "An illustrative mango guild with separate companion patches and access gaps. Plant identity and spacing must be checked on site.",
        title: "Building a Plant Guild: A Practical Example",
        body: "A plant guild is a group chosen to support a central tree, usually fruit or nut.\n\nMembers can produce food, fix nitrogen, supply mulch, support useful insects or cover the ground.\n\nThe plants still share light, water and space. Observe the guild, water during establishment and adjust plants that crowd the tree.\n\nLook at the central mango and the plants around it. Notice how the guild works as one team, with each plant supporting the tree in a different way.\n\nFor the mango example, assess sunlight and the mature size of Sesbania sesban before choosing its position. Keep room to reach both plants.\n\nPruning supplies mulch and can reduce shade. It does not end root competition for water and nutrients. Adjust pruning or spacing as the trees grow.\n\nPlace Bocking 14 comfrey where it has room to grow and be cut, keeping the mango trunk and root collar clear of mulch.\n\nUse wild garlic and African basil as flowering members where the site suits them. Watch which useful insects visit.\n\nSweet potato can cover ground and provide food, but its vines and roots also need space and water. Keep access to the mango clear.\n\nJudge each plant by what it does in your garden; no companion plant guarantees control of fruit flies or other pests.\n\nGive every guild plant a clear job and enough room to do it.\n\nA ground cover can protect soil and provide food, but it can also compete with a young tree. Compare it with mulch where water is limited.\n\nRecord growth, shade, soil moisture and crop damage. Change the guild when the evidence shows that a member needs more space or different care.",
        keyPoints: [
          "Give each guild member a clear role and growing room",
          "Pruning can reduce shade but does not remove root competition",
          "Keep the central tree trunk clear and leave access for care",
          "Monitor light, moisture, growth and pests, then adjust the guild"
        ],
        quiz: [
          {
            "q": "Why prune or thin a support plant that is crowding a young mango?",
            "options": [
              "Tall plants stop fixing nitrogen",
              "To reduce shade and obtain suitable mulch, while still monitoring root competition",
              "Pruning removes every competing root",
              "A fixed date guarantees the tree will be safe"
            ],
            "correct": 1,
            "rationale": "Pruning can reduce shade and provide mulch. The plants continue sharing water and nutrients, so spacing and growth still need checking."
          },
          {
            "q": "What should guide using sweet potato as ground cover near a young tree?",
            "options": [
              "It removes the tree’s need for water",
              "Its roots never compete",
              "Its food and soil-cover benefits, balanced against water, space and access",
              "Any living cover is always better than mulch"
            ],
            "correct": 2,
            "rationale": "Ground cover can have several useful roles, but the site must support both plants. Mulch may be more suitable where water or space is limited."
          }
        ],
      },
    ],
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
        body: "A food forest can give food from many levels of the same piece of land.\n\nIt can use light and moisture that a single crop would leave unused.\n\nThe first years need steady work.\n\nLater, shade, leaf-fall mulch, and mixed roots help the system care for itself.\n\nAn indigenous forest fills the space from the highest branches to the roots.\n\nDifferent plants use the light and moisture available at their level.\n\nA food forest copies this pattern with productive species.\n\nThe result is not one crop in one row, but many useful layers growing together.\n\nThe seven layers describe planting roles, not fixed heights for every species.\n\nCanopy and sub-canopy trees rise above shrubs and herbaceous plants. Ground covers spread over the surface, root crops grow below, and climbers use a suitable support.\n\nCheck mature size and light needs before fitting these layers together.\n\nUse this as a design example, not a planting list for every Highveld farm.\n\nA Wild Fig or pecan may occupy the canopy, with suitable smaller trees, shrubs and food crops below.\n\nCheck each species and cultivar against your frost, available water, mature size and light. Frost-sensitive plants such as granadilla need particular care in a cold site.\n\nThe first years need steady establishment work: watering, mulch, weed control and protection.\n\nAs trees grow, shade and leaf litter can reduce evaporation from the soil surface. They also change how much light and water the lower plants receive.\n\nThere is no fixed year when every food forest looks after itself. Keep observing, pruning and adjusting the planting.",
        keyPoints: [
          "Seven roles: canopy, sub-canopy, shrub, herbaceous, ground cover, root crops and climbers",
          "Mature size and light needs determine whether layers fit",
          "Shade and leaf litter can reduce surface evaporation, while trees still use water",
          "Establishment and ongoing care follow actual growth rather than a fixed year"
        ],
        quiz: [
          {
            "q": "Low plants in a new food forest are being crowded by weeds. What should guide the work?",
            "options": [
              "Wait until year five",
              "Ignore them because seven layers are planted",
              "Observe competition and maintain appropriate weed control, water and mulch",
              "Add more trees without checking light"
            ],
            "correct": 2,
            "rationale": "New plantings need care according to their condition. A design label or elapsed year does not remove competition."
          },
          {
            "q": "Which feature can reduce evaporation from the soil surface?",
            "options": [
              "Assuming roots always reach groundwater",
              "Suitable shade and a maintained mulch layer",
              "Planting every layer as densely as possible",
              "Stopping all establishment watering"
            ],
            "correct": 1,
            "rationale": "Shade and mulch can reduce surface moisture loss. They do not prove that the whole planting uses less water or needs no irrigation."
          }
        ],
      },
      {
        id: "food-forest-l2",
        infographicUrl: "/course-images/food-forest/food-forest-l2.jpg",
        infographicAlt: "A simple shape of South Africa divided into three growing areas by ground colour and terrain alone: a pale high inland plateau with hills, a green humid coastal strip, and a hot red-brown low-lying area. Different tree shapes stand in each.",
        title: "Species Selection for South African Food Forests",
        body: "Match each species and cultivar to your site before planting.\n\nRecord rainfall, minimum winter temperature, frost frequency, summer humidity and available water.\n\nA young mango can be badly damaged by frost; shelter does not guarantee protection. A quince cultivar may need winter chilling your site cannot supply. Ask a local grower or nursery to check the match.\n\nClimate decides which species belong.\n\nOn the Highveld, choose cold-tolerant trees and shrubs; on the KZN coast and Lowveld, choose warm-climate species.\n\nMatch every plant to your site.\n\nThe lesson names pecan, walnut, indigenous fig, apple, pear, plum, black mulberry, rosemary, Wild Medlar and Cape gooseberry as candidates to assess.\n\nConfirm the cultivar, mature size and local frost and water needs before buying. Barbados cherry is not a default choice for a frosty Highveld site.\n\nCheck current restrictions before planting loquat; do not plant it in the Western Cape or forest biome. Do not use a regional list as planting permission.\n\nWarm coastal and Lowveld sites may suit the mango, avocado, banana, pawpaw and litchi already named in this lesson. Check local conditions and mature size for each.\n\nThe lesson also names Natal Mahogany, Wild Fig, Barbados cherry, Wild Dagga, Marula, Mopane and baobab for different regional roles. These names are not a claim that every plant or every part is edible.\n\nConfirm the exact plant, its purpose and any food preparation with a reliable local source before using it.\n\nInclude suitable indigenous plants that support local birds and insects as well as your household goals.\n\nThe earlier 30% figure is a course planning target, not a universal ecological threshold. The species, placement and conditions matter.\n\nObserve flowering, visitors, crop damage and growth. Use that evidence to improve the mix.",
        keyPoints: [
          "Match species and cultivars to frost, water, rainfall and mature size",
          "A regional list does not establish suitability or planting permission",
          "Common names and native status do not prove that a plant part is edible",
          "Include suitable indigenous plants and assess their actual roles"
        ],
        quiz: [
          {
            "q": "Before planting a young mango on a frosty site, what should a grower do?",
            "options": [
              "Assume a wall prevents every frost",
              "Plant because a regional list includes mango",
              "Assess local frost and cultivar suitability with reliable local advice",
              "Use more mulch instead of checking climate"
            ],
            "correct": 2,
            "rationale": "Young mangoes can be damaged by frost. Shelter is a factor to assess, not a guarantee."
          },
          {
            "q": "How should the course’s 30% indigenous planting target be used?",
            "options": [
              "As proof that every plant is edible",
              "As a planning exercise alongside suitable species, placement and observed ecological roles",
              "As a rule that any non-native plant is illegal",
              "As proof that irrigation is unnecessary"
            ],
            "correct": 1,
            "rationale": "A percentage alone cannot guarantee ecological function. Choose suitable plants and observe the birds, insects and plant growth they support."
          }
        ],
      },
      {
        id: "food-forest-l3",
        sources: [{"title": "Oregon State University: sheet mulching", "url": "https://extension.oregonstate.edu/catalog/em-9559-sheet-mulching-lasagna-composting-cardboard"}],
        infographicUrl: "/course-art/food-forest/sheet-mulch.jpg",
        infographicAlt: "A grower covers overlapping plain cardboard with wood chips on a prepared plot; nursery plants wait beside the path.",
        title: "Establishing a Food Forest: Planting Sequence and Timeline",
        body: "A food forest is planted in sequence, not all at once.\n\nFirst come nitrogen-fixing pioneers to improve soil and offer shade.\n\nThen come the main canopy and sub-canopy fruit trees.\n\nLower layers follow when the canopy gives some protection.\n\nClimbers and ground covers come last.\n\nSheet-mulch first.\n\nPioneers build soil while fruit trees establish.\n\nAs shelter grows, plant the lower layers, ground covers, and climbers.\n\nFor the 500m² practice plot, assess weeds, drainage and water before choosing the first stage.\n\nIf sheet mulching suits the site, use clean, uncoated cardboard with tape and staples removed, and cover it with suitable mulch. Keep water able to reach the soil and leave tree trunks clear.\n\nChoose pioneer spacing from mature size and access needs. Start a nursery for the next stage; one fixed spacing and mulch depth will not suit every plot.\n\nUse the planting sequence as a guide, and let the site show when it is ready.\n\nEstablish suitable main fruit trees, then add lower plants where light, water and shelter allow.\n\nThin or prune pioneers before they crowd the fruit trees. Use suitable cuttings as mulch. The right moment depends on growth and competition, not a fixed year.\n\nPlant when the soil is moist and follow-up water is available. The start of a reliable rainy season can help, but rain may pause.\n\nCheck the root zone after planting and water when needed. Mulch helps protect surface moisture; it does not replace establishment care.\n\nHarvest timing and outside inputs depend on the species, planting material, weather and management. Do not promise a full harvest in a fixed year.",
        keyPoints: [
          "Prepare the site and plant in stages as conditions allow",
          "Use suitable clean sheet-mulch materials while retaining water access to soil",
          "Choose spacing from mature size, light and working access",
          "Check soil moisture and provide follow-up water during establishment"
        ],
        quiz: [
          {
            "q": "What is the main purpose of cardboard in suitable sheet mulching?",
            "options": [
              "Seal water away from roots",
              "Block light from weeds while the material gradually decomposes",
              "Replace every other soil assessment",
              "Guarantee a harvest within five years"
            ],
            "correct": 1,
            "rationale": "The barrier reduces light reaching weeds. It still needs suitable mulch, water penetration and care around tree trunks."
          },
          {
            "q": "When should support trees be thinned or pruned?",
            "options": [
              "Only when a fixed year arrives",
              "When their growth starts to crowd the main planting, using observed light and access needs",
              "Immediately because all support trees are harmful",
              "Never, because guild plants cannot compete"
            ],
            "correct": 1,
            "rationale": "Support plants need management as they grow. Suitable cuttings can become mulch, while the remaining planting retains space and light."
          }
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
        sources: [{"title": "Virginia Tech: using chicken manure safely", "url": "https://psdocs.spes.vt.edu/consumer/3_using_chicken_manure.pdf"}],
        infographicUrl: "/course-art/small-livestock/chicken-tractor.jpg",
        infographicAlt: "Two growers stand beside a stationary portable poultry enclosure on an empty strip; hens have feed, water and partial roof shade, with growing vegetables fenced separately.",
        title: "Chickens in the System: Pest Control, Fertility, and Food",
        body: "Small livestock can provide food and useful work, but every animal also needs daily care.\n\nChickens scratch, ducks forage, and bees visit flowers. These activities may help the farm, but animals can damage crops and contaminate food-growing areas.\n\nPlan feed, clean water, shelter, health care and safe separation from harvested food before adding animals.\n\nWatch the chicken tractor move across an empty bed, with feed, water and shelter kept with the birds.\n\nScratching disturbs old material and manure stays behind. The bed is not immediately ready for food crops: agree a safe manure and planting plan before the next crop.\n\nChickens forage and scratch through suitable areas, eating some insects and weed seeds. This does not replace balanced feed or health care.\n\nManure and bedding can become compost material when handled and composted properly. Fresh manure can carry disease-causing organisms.\n\nKeep birds, manure and dirty equipment away from harvested produce, packing surfaces and growing crops eaten raw. Wash hands after handling birds or manure.\n\nNever put chickens around seedlings: scratching can uproot them.\n\nAn empty bed after harvest may be part of a rotation only when food safety and animal care are planned. Removing the birds does not remove fresh manure or its risks.\n\nAsk a qualified local adviser about the manure-management and harvest interval required for the next crop. Keep animals out of areas where manure could contact edible produce.\n\nDucks eat slugs and snails without the heavy scratching typical of chickens.\n\nThey can still trample plants, foul water and leave manure. An established understorey is not automatically safe for ducks.\n\nPlan a suitable managed area with clean drinking water, shelter and adequate feed. Keep them away from produce and water used for food handling.\n\nMove a chicken tractor according to bird welfare, ground condition, weather and the farm’s manure plan. Inspect it daily.\n\nDo not keep birds in mud, overcrowding, heat or exhausted ground while waiting for a calendar date. Keep feed, water, shade and predator protection available.\n\nA fixed number of hens on a fixed plot cannot guarantee all its fertiliser needs. Use soil and crop evidence to judge fertility.",
        keyPoints: [
          "Plan balanced feed, clean water, shelter, protection and daily care",
          "Keep poultry and manure away from harvested food and raw-eaten crops",
          "An empty-bed rotation needs a safe manure and harvest plan",
          "Move pens according to birds and ground condition; no flock size guarantees fertility"
        ],
        quiz: [
          {
            "q": "What must happen before using chickens in an empty-bed rotation?",
            "options": [
              "Plant seedlings first",
              "Plan bird care and safe manure management before the next food crop",
              "Assume manure becomes safe when birds move",
              "Keep birds in one place until all vegetation is gone"
            ],
            "correct": 1,
            "rationale": "An empty bed avoids seedling damage, but manure and food safety still require a suitable plan."
          },
          {
            "q": "What is a fair comparison of ducks with chickens?",
            "options": [
              "Ducks cannot carry disease",
              "Ducks scratch less, but still need management and separation from food",
              "Ducks do not need drinking water",
              "Established plants cannot be damaged by ducks"
            ],
            "correct": 1,
            "rationale": "Less scratching does not eliminate trampling, manure or water-contamination risks."
          }
        ],
      },
      {
        id: "small-livestock-l2",
        sources: [{"title": "Department of Agriculture: beekeeper registration form, 2026 copy", "url": "https://wcba.co.za/wp-content/uploads/2026/02/DOA-BEEKEEPING-REGISTRATION-FORM.pdf"}, {"title": "Research review: insect pollinators in avocado production", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8647928/"}],
        infographicUrl: "/course-art/small-livestock/bees-and-flowers.jpg",
        infographicAlt: "Bees visit open flowers in the foreground, with a closed hive in a distant managed corner.",
        title: "Bees: Pollination, Honey, and System Ecology",
        body: "Watch the bees leave the hive and move among flowering crops.\n\nTheir movement carries pollen between flowers across the site.\n\nBees and other flower visitors help pollinate many food crops. Dependence on insect visits differs between crops and cultivars.\n\nIn avocado, flowers have female and male phases. Suitable flowering overlap and pollen movement can support fruit set, but weather and tree condition matter too.\n\nObserve flowers and visitors before assuming a hive alone will solve poor fruit set.\n\nSouth Africa has Cape and African honeybee subspecies. Their natural ranges and movement restrictions matter when sourcing colonies.\n\nGet help from an experienced local beekeeper before keeping or moving bees. Do not move colonies between regions on the strength of this lesson.\n\nBoth bee health and safe management need attention; a native colony is not automatically free of pests or disease.\n\nAssess a possible hive site with an experienced local beekeeper before bringing bees onto the land.\n\nConsider people, neighbours, livestock, paths, the flight path, water, forage, shelter and access for safe management. Morning sun may help, but one compass direction does not make a site safe.\n\nPlan training and protective equipment as well as the hive position.\n\nPlan suitable flowering resources through the year and observe colony health with a trained beekeeper. A busy colony does not prove that the site is chemically clean.\n\nBeekeepers must register with South Africa’s Department of Agriculture. Check its current registration and colony-movement requirements before starting, even with one hive.\n\nRepeated swarming needs an experienced inspection. Space is one possible factor, not a diagnosis; do not attempt a split from this lesson alone.",
        keyPoints: [
          "Pollination needs differ between crops and cultivars",
          "A hive does not by itself prove or guarantee good fruit set",
          "Assess sites and colony management with an experienced local beekeeper",
          "Check current Department of Agriculture registration and movement requirements"
        ],
        quiz: [
          {
            "q": "An avocado has poor fruit set. What is a useful next step?",
            "options": [
              "Assume all flowers self-pollinate",
              "Assume only beetles can pollinate it",
              "Observe flowering overlap, insect visits, weather and tree condition before choosing a response",
              "Buy a hive and stop investigating"
            ],
            "correct": 2,
            "rationale": "Pollen movement can matter, but fruit set has several causes. Observation helps distinguish them."
          },
          {
            "q": "A colony swarms repeatedly. What should a new beekeeper do?",
            "options": [
              "Get an experienced inspection before deciding how to manage it",
              "Split it immediately from this lesson alone",
              "Assume all native bees are disease-free",
              "Move the hive into a public path"
            ],
            "correct": 0,
            "rationale": "Space can be one factor in swarming. Management needs an informed assessment and safe handling."
          }
        ],
      },
      {
        id: "small-livestock-l3",
        sources: [{"title": "University of Minnesota: managing worms in sheep and goats", "url": "https://extension.umn.edu/agriculture/farm-operations-and-systems/small-farms/managing-barberpole-worms-in-sheep-and-goats"}],
        infographicUrl: "/course-animations/small-livestock/posters/livestock-nutrient-cycle.jpg",
        infographicAlt: "A diagram follows suitable feed to animals, manure to composting in a square heap, and finished compost to a growing bed.",
        title: "Integrating Livestock Cycles: Closing the Loop",
        body: "Watch nutrients move from plants to animals, then through manure and compost back to the growing bed.\n\nUse suitable farm-grown feed as part of a balanced diet, with clean water and daily care. Scraps and insects alone may not meet the animals’ needs.\n\nCollect and manage manure so it does not contaminate food or water. Properly managed composting comes before using this material in the food-growing loop.\n\nRecord purchased feed, work and health costs as well as useful outputs. Integration can reduce waste; it does not automatically remove outside inputs.\n\nGuinea fowl forage for insects and may eat ticks, but their presence is not a dependable tick-control programme.\n\nProtect livestock through regular observation and a veterinary parasite-management plan suited to the animals and site. Do not stop prescribed care because birds are present.\n\nAlso plan the flock’s feed, water, shelter, welfare and effects on neighbours.\n\nFor each animal, ask what it eats that you already have.\n\nAsk what it produces that helps another part of the system.\n\nThen ask what it needs that you can supply from within the system.\n\nThese questions show whether the animal closes a loop or creates another bought input.\n\nDo not rely on chickens following goats to prevent worms or replace treatment.\n\nWork with a veterinarian or trained livestock adviser on grazing, monitoring, testing where appropriate and targeted treatment. Rotation needs to fit the parasite, season and grazing conditions.\n\nWatch animal condition and keep records. An animal becoming weak or unwell needs prompt qualified attention.",
        keyPoints: [
          "Assess suitable feed and useful outputs alongside welfare and real costs",
          "Manage manure and composting before returning material to food-growing areas",
          "Guinea fowl do not replace a veterinary tick-management plan",
          "Chickens following goats are not a reliable substitute for worm monitoring or treatment"
        ],
        quiz: [
          {
            "q": "Ticks are affecting livestock. What should guide the response?",
            "options": [
              "Rely on birds alone",
              "Regular observation and a veterinary parasite-management plan",
              "Stop prescribed care when guinea fowl arrive",
              "Choose treatment solely from the weather"
            ],
            "correct": 1,
            "rationale": "Birds may forage on ticks, but their presence does not establish effective control. Follow qualified animal-health advice."
          },
          {
            "q": "What should a farmer do when planning grazing goats and chickens?",
            "options": [
              "Plan grazing, monitoring and treatment with qualified advice rather than assuming chickens prevent worms",
              "Assume chicken manure kills worm eggs",
              "Stop testing because the species differ",
              "Wait until every goat looks ill"
            ],
            "correct": 0,
            "rationale": "A rotation must fit the parasite and grazing conditions. Chickens do not justify abandoning needed monitoring or treatment."
          }
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
        sources: [{"title": "FAO: marketing costs", "url": "https://www.fao.org/4/a1298e/a1298e02.pdf"}],
        infographicUrl: "/course-images/market-community/market-community-l1.jpg",
        infographicAlt: "A simple ruled record sheet with columns for what was harvested and where it went, beside a pile of harvested produce.",
        title: "Record-Keeping: Knowing What Your Farm Is Actually Producing",
        body: "Without records, it is easy to miss what your farm produces and what it costs.\n\nA tomato, an egg, or a bundle of morogo can go to the family, a customer, a neighbour, or compost.\n\nRecord where the harvest goes. This helps you protect household food and compare business choices using your own evidence.\n\nWrite down every harvest as it happens.\n\nRecord kilograms of tomatoes, dozens of eggs, and bundles of morogo, then note where each went.\n\nUse the same simple habit for food kept at home, produce sold, produce gifted, and produce composted.\n\nDo not rely on memory at the end of the season.\n\nOne season of records answers practical questions.\n\nWhich crops give the best yield per bed? Which return the most for each hour of work?\n\nWhich crops use more seeds, water, and compost than they return?\n\nThe record also shows which months leave the household buying food.\n\nBefore setting a selling price, add the costs of producing and selling that harvest.\n\nInclude seeds, water, compost, packaging, transport, selling fees and your own labour. Record unsold produce and losses too.\n\nIn this example, the full cost is R18/kg and the selling price is R15/kg. That price does not cover the cost.\n\nCheck whether customers will pay a price that covers costs, whether costs can be reduced without harm, or whether another crop is a better use of the work. The figures are an exercise, not current market prices.\n\nUse your own record to name the months when household food runs short.\n\nWork backwards from that gap. Choose a suitable crop, check its time to harvest, and plan a sowing date for your local season and available water.\n\nDo not copy another farm's planting months. Record what actually grows and adjust the next plan.",
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
            q: "A farmer's records show a food gap. How should she plan to fill it?",
            options: [
              "Buy vegetables at market each June and July",
              "Choose a suitable crop and work backwards from harvest using her local season and available water",
              "Accept her farm can't produce in winter",
              "The records show a soil fertility problem",
            ],
            correct: 1,
            rationale: "The record identifies the gap. The crop, harvest time, local season and water supply determine when to sow; another farm’s months may not fit.",
          },
        ],
      },

      {
        id: "market-community-l2",
        sources: [{"title": "FAO: comparing market returns", "url": "https://www.fao.org/4/a1298e/a1298e06.pdf"}],
        infographicUrl: "/course-images/market-community/market-community-l2.jpg",
        infographicAlt: "Three ways to sell from one farm: a roadside stall, a group delivery to a shop, and a box going straight to a household.",
        title: "Selling Surplus: Where to Sell and How to Price",
        body: "Know your customer before planting for a sale.\n\nMarkets, roadside stalls, shops, schools and clinics have different requirements. Ask about quantity, quality, packaging, delivery, payment and permission to trade.\n\nConfirm the actual price and costs. A channel's name alone does not tell you what it will pay or whether an order will be regular.\n\nDirect sales remove a middleman, but packaging, travel, unsold produce and selling time still cost money.\n\nCompare what remains after all costs, not just the price per kilogram.\n\nIn a box scheme, customers agree to regular deliveries. This can help you plan demand, but income still depends on supplying what was agreed and receiving payment.\n\nBefore offering vegetable boxes, list what you can supply each week after keeping food for the household.\n\nCompare that supply with the number and size of boxes customers want. Check labour, water, packing, delivery and payment arrangements.\n\nStart with a commitment you can meet. Garden area and customer count alone cannot promise an income. Agree how you will handle a short harvest or a cancelled order.\n\nIf production changes from week to week, do not promise a fixed box you cannot fill.\n\nLook for neighbours or markets willing to buy the surplus actually available. Confirm their requirements and include selling costs in your decision.\n\nBuild trust through reliable supply and honest descriptions. Do not claim certification you do not hold; ask buyers what assurance they require.",
        keyPoints: [
          "Match your selling channel to your customer — formal market, informal, direct, or box scheme",
          "Compare income after packaging, travel, selling time, fees and losses for every channel",
          "Offer only the number and size of boxes your actual supply can support",
          "Describe production honestly and check the assurance each buyer requires",
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
            rationale: "Find buyers willing to take the surplus actually available. Confirm their requirements before promising supply; the market type alone does not guarantee flexibility.",
          },
          {
            q: "Why can a box scheme be worth more than a market stall, even at similar prices per kilogram?",
            options: [
              "Box customers always pay more per kilogram",
              "Box schemes let you charge extra for packaging",
              "Agreed orders can help you plan, provided you can fulfil them and account for costs and payment",
              "Box schemes avoid tax obligations",
            ],
            correct: 2,
            rationale: "Agreed demand can improve planning. It does not guarantee profit or payment; check supply, delivery, costs and cancellation terms.",
          },
        ],
      },
      {
        id: "market-community-l3",
        sources: [{"title": "FAO: community seed banks", "url": "https://openknowledge.fao.org/handle/20.500.14283/i3987e"}],
        infographicUrl: "/course-images/market-community/market-community-l3.jpg",
        infographicAlt: "Five small farms linked to one shared central point, where their separate harvests combine into one much larger crate.",
        title: "Building Community Food Networks: Strength in Numbers",
        body: "One farm can produce food.\n\nA group can share seed, tools, skills, and transport.\n\nSeparate growers become a stronger local food network, with each household contributing what it can.\n\nA seed-sharing group can widen access to the different varieties its members actually maintain.\n\nAgree who saves which variety and how the group will check isolation, selection, drying, labelling, storage and germination.\n\nCount distinct varieties. Sharing copies of the same variety does not create extra varieties, and joining a group does not automatically improve seed quality.\n\nUse the Seeds lesson to keep each batch identifiable and share what its record shows.\n\nTool sharing puts expensive equipment within reach of the group.\n\nA water pump or grain mill may be beyond one household’s budget.\n\nShared use spreads the value across the group and helps each farm do work it could not do alone.\n\nRecord how much produce is damaged, unsold or lost between harvest and sale, and where the loss happens.\n\nNearby buyers can reduce travel and delay. They do not remove the need for careful handling, clean containers, suitable storage and timely delivery.\n\nCompare the income left after transport, packaging, fees, labour and losses for each route. Use actual local prices and costs; a shorter journey does not guarantee a higher return.\n\nA farmer who has mastered grafting or managed fungal disease in humid KZN summers can teach ten neighbours.\n\nThat lesson may change ten farms, not just one.\n\nMonthly skills swaps build knowledge more durably than a single expert consultation.\n\nDocument what you learn, then pass it on so the knowledge stays in the community.",
        keyPoints: [
          "Seed sharing can widen access to distinct varieties when batches remain correctly identified",
          "Tool sharing puts expensive equipment within reach of an entire group",
          "Record actual losses and compare nearby routes using all handling and selling costs",
          "Monthly skills swaps build knowledge more durably than any single expert consultation",
        ],
        quiz: [
          {
            q: "What helps a seed-sharing group maintain useful diversity and seed quality?",
            options: [
              "Counting every packet as a different variety",
              "Agreeing who saves each distinct variety and checking isolation, selection, labels, storage and germination",
              "Assuming group seed is always better",
              "Mixing all the seed into one container",
            ],
            correct: 1,
            rationale: "Sharing can improve access, but variety identity and seed quality need deliberate work. Duplicate packets do not add new varieties, and a group does not guarantee better seed.",
          },
          {
            q: "A grower is comparing a distant market with nearby buyers. What should guide the decision?",
            options: [
              "Grow twice as much before checking demand",
              "Assume the highest price always leaves the most income",
              "Compare confirmed prices and demand after transport, packaging, fees, labour and likely losses",
              "Assume nearby sales have no costs",
            ],
            correct: 2,
            rationale: "A shorter trip may save costs, but the full comparison also includes price, demand, handling, selling time and losses. Use actual figures for both routes.",
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

export type ModuleCategory = 'foundation' | 'water' | 'soil' | 'plants' | 'design' | 'business';

export interface QuizQuestion {
  q: string;
  options: string[];
  correct: number;
}

export interface Lesson {
  id: string;
  title: string;
  body: string;
  keyPoints: string[];
  quiz: QuizQuestion[];
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
    id: 'intro-permaculture',
    title: 'Introduction to Permaculture',
    description: 'Ethics, principles and patterns — the foundation for everything else you will build.',
    durationMins: 45,
    category: 'foundation',
    lessons: [
      {
        id: 'intro-permaculture-l1',
        title: 'The Three Ethics: Earth Care, People Care, Fair Share',
        body: 'Permaculture is a design system built on three ethics that guide every decision on your land. Earth Care means treating the soil, water, plants, and animals as living systems that need protection — not just resources to extract from. People Care means making sure your farm meets your family\'s needs first, then your community\'s needs. Fair Share means taking only what you need and returning the surplus — whether that is seeds, food, knowledge, or water — back into the system.\n\nIn a South African context, these ethics are not abstract. Highveld farmers who strip mine their soil for maize monocultures every year are violating Earth Care. KZN smallholders who sell every egg and vegetable but keep nothing for the family larder are ignoring People Care. And communities that fence off springs or boreholes from neighbours are breaking Fair Share. Permaculture asks you to design your farm so all three ethics are served simultaneously.\n\nThe power of starting with ethics rather than techniques is that ethics help you make decisions when there is no manual. When a neighbour asks to graze their cattle on your land after a drought, or when a flood damages your swales, the ethics guide you toward the right answer faster than any rule. Build these three into your thinking before you build anything on the ground.',
        keyPoints: [
          'Earth Care: protect and restore soil, water, and biodiversity',
          'People Care: meet your family\'s needs before producing for market',
          'Fair Share: return surplus to the system — seeds, water, food, knowledge',
          'Ethics are decision-making tools, not just slogans',
        ],
        quiz: [
          {
            q: 'A farmer sells all his surplus maize but keeps nothing for composting or seed saving. Which ethic is he most failing to apply?',
            options: [
              'Earth Care only',
              'People Care only',
              'Fair Share — he is not returning anything to the system',
              'All three equally',
            ],
            correct: 2,
          },
          {
            q: 'You have a borehole that produces more water than your household needs. Which action best reflects all three ethics?',
            options: [
              'Sell water access to the highest bidder to cover your costs',
              'Keep the surplus for irrigation expansion only',
              'Share access with neighbouring households while monitoring the water table',
              'Cap the borehole to preserve groundwater for future generations only',
            ],
            correct: 2,
          },
        ],
      },
      {
        id: 'intro-permaculture-l2',
        title: 'Twelve Principles: Designing with Nature',
        body: 'Bill Mollison and David Holmgren developed twelve design principles that translate the three ethics into practical guidance. The most important for South African smallholders are: observe and interact (spend a full season watching your land before major earthworks), catch and store energy (harvest rain, sunlight and biomass before they leave your property), and use edges and value the marginal (the fence line, stream bank, or shadowed corner of your field is often the most productive zone).\n\nOther key principles include: produce no waste (kitchen scraps become compost, compost becomes soil, soil becomes food), use small and slow solutions (a 20-litre bucket system can irrigate a garden bed without electricity), and integrate rather than segregate (chickens near the vegetable garden eat pests; fruit trees near the house provide shade and harvest). On the Highveld, the principle of use and value diversity is critical — monoculture maize fields are devastated by hail in minutes, while a diverse polyculture loses only a fraction of its productivity to the same storm.\n\nYou do not need to memorise all twelve before starting. Pick two or three that speak directly to your biggest challenge — water, soil, or income — and apply them hard. The others will become obvious as your design matures. Every time something goes wrong on your farm, ask which principle you may have skipped, and you will learn faster than from any textbook.',
        keyPoints: [
          'Observe your land for at least one full season before major earthworks',
          'Catch and store energy: rain, sunlight, and biomass are free resources',
          'Edges and margins are often the most productive zones on a property',
          'Diversity protects against single events like hail, drought, or pest outbreak',
        ],
        quiz: [
          {
            q: 'A farmer wants to dig swales to harvest rainwater. According to the \'observe and interact\' principle, what should she do first?',
            options: [
              'Start digging immediately after the first good rain to see where water flows',
              'Watch where water naturally flows and pools across at least one wet season before digging',
              'Copy the swale layout from a neighbour\'s farm',
              'Hire a civil engineer to survey the contours',
            ],
            correct: 1,
          },
          {
            q: 'Which of these farm layouts best applies the principle of \'integrate rather than segregate\'?',
            options: [
              'Chickens kept in a fixed pen at the far end of the property, away from the garden',
              'Vegetable garden, fruit trees, and chicken run arranged so chickens can be rotated through garden beds after harvest',
              'Separate paddocks for each crop type to prevent cross-contamination',
              'All animals kept off the cultivated zone entirely to protect crops',
            ],
            correct: 1,
          },
        ],
      },
      {
        id: 'intro-permaculture-l3',
        title: 'Zones and Sectors: Organising Your Farm by Energy',
        body: 'The zone and sector system is permaculture\'s primary design tool for reducing unnecessary labour. Zones are numbered 0 to 5 and represent how often you visit a space. Zone 0 is the house. Zone 1 is just outside the kitchen door — this is where you plant herbs, lettuce, and things you pick daily. Zone 2 is the main vegetable garden and chicken run, visited once or twice a day. Zone 3 is the main crop field, visited weekly. Zone 4 is semi-wild — fruit trees and fodder plants that need occasional attention. Zone 5 is completely wild — forest, wetland, or bush left for nature.\n\nSectors are different: they describe the energies that flow across your land from outside — sun, wind, rain, flood, fire, and even the direction neighbours\' smoke drifts. A Lowveld farm facing north-west will receive the hot dry berg winds from that direction in August and September — this is a wind sector that determines where you plant a windbreak. A KZN farm will have a summer rain sector from the east or north-east, and a frost risk sector in the south-facing valleys. Mapping your sectors tells you where to invest in protection and where to harvest those energies.\n\nWhen you overlay zones and sectors on a simple sketch of your land, you have the skeleton of your permaculture design. The vegetable garden belongs in Zone 1 or 2 on the sheltered side away from the dominant wind sector. The dam belongs where the water sector tells you rain naturally collects. The windbreak goes between the farm and the prevailing wind sector. You do not need expensive software — a pencil sketch on paper, one full season of observation, and these two concepts are enough to design a resilient smallholding.',
        keyPoints: [
          'Zone 1 is most visited — herbs and daily harvest crops go here, nearest the house',
          'Zones 1–5 organise labour by frequency of visit, reducing wasted walking',
          'Sectors map incoming energies: sun, wind, frost, flood, fire',
          'Overlay zones and sectors on a site sketch to place every element correctly',
        ],
        quiz: [
          {
            q: 'You plant your herb garden in Zone 3 (the main crop field, far from the house). What problem will this create?',
            options: [
              'The herbs will grow too large because of the extra space',
              'You will harvest herbs infrequently because the walk is long, leading to bolting or neglect',
              'The herbs will cross-pollinate with the main crops',
              'Zone 3 receives too much sun for most herbs',
            ],
            correct: 1,
          },
          {
            q: 'A Highveld farm experiences hot, dry north-westerly winds in August. Where should a windbreak be planted?',
            options: [
              'On the south-east boundary to block the summer thunderstorm direction',
              'On the north-west boundary, between the prevailing wind and the crops',
              'In the centre of the property to divide the wind sector equally',
              'Windbreaks are not necessary on the Highveld because winds are seasonal',
            ],
            correct: 1,
          },
        ],
      },
    ],
  },
  {
    id: 'reading-landscape',
    title: 'Reading the Landscape',
    description: 'Identify water flow, sun angles, wind patterns and topography on your site.',
    durationMins: 60,
    category: 'design',
    lessons: [
      {
        id: 'reading-landscape-l1',
        title: 'Understanding Water Flow: Where Rain Goes on Your Land',
        body: 'Before you can harvest water, you must understand where it goes. Walk your land during and immediately after a heavy rain — this is the most important observation you can make. Look for where water concentrates into rills (small channels), where it fans out across flat areas, where it ponds, and where it exits your property. Every place water leaves your land is a place you have lost a resource. On typical KZN red clay soils, water will run off steep slopes before it can soak in; on Highveld black turf soils (vlei soils), water may pond for days even on flat ground.\n\nA simple A-frame level, which you can build from three poles and a piece of string with a weight, allows you to trace contour lines across your slope — lines where the land is at the same height all the way across. These contour lines are the guides for placing swales, dams, and tree planting lines. You do not need a surveyor. Two people and an A-frame can map the contours of a two-hectare property in a single morning.\n\nPay attention to the order in which rills join together. Small rills feed larger channels, which feed streams or gullies. In permaculture we say \'slow it high, sink it mid, control it low.\' The higher up the slope you can slow and sink water, the more evenly your land stays moist, and the less erosion happens at the bottom. In the Drakensberg foothills, a single uncontrolled gully can erode several tonnes of topsoil in one season — damage that takes decades to repair.',
        keyPoints: [
          'Observe water movement during and immediately after heavy rain — not before',
          'An A-frame level traces contour lines without expensive equipment',
          'Slow water high, sink it mid-slope, control it at the bottom',
          'Every point water exits your land is a lost resource and potential erosion site',
        ],
        quiz: [
          {
            q: 'You want to trace contour lines on your 1.5-hectare slope. Which approach is most practical for a smallholder with no budget for surveying equipment?',
            options: [
              'Hire a civil engineer with a theodolite',
              'Estimate contours visually by eye from a high point',
              'Build an A-frame level from poles and string and walk the contours yourself',
              'Use a spirit level on a long board, taking measurements every 5 metres',
            ],
            correct: 2,
          },
          {
            q: 'On a sloped KZN site, where is the highest priority location to slow and sink rainfall to prevent erosion?',
            options: [
              'At the bottom of the slope where water collects naturally',
              'In the middle of the slope in a large dam',
              'As high up the slope as possible, before water gains speed',
              'At the property boundary to prevent water leaving the site',
            ],
            correct: 2,
          },
        ],
      },
      {
        id: 'reading-landscape-l2',
        title: 'Sun Angles, Shade, and Aspect: Getting the Most from Sunlight',
        body: 'In South Africa, the sun travels across the northern sky. This means your north-facing slopes receive the most sunlight and are warmer and drier. Your south-facing slopes receive less direct sun, stay cooler and moister, and in higher altitude areas like the Drakensberg or the Mpumalanga escarpment, frost can sit in south-facing hollows long after it has cleared elsewhere. This has enormous consequences for where you plant tender crops, where you site buildings, and where you establish fruit trees.\n\nIn summer, the sun rises roughly in the south-east and sets in the south-west in South Africa, reaching high overhead around midday. In winter, the sun tracks lower in the sky and sits further north, meaning a tree or wall that casts no shade in summer can shade a vegetable bed for four to six hours in winter and kill your cold-season production. Before you place permanent structures — walls, shade cloth, large trees — stand in the spot at 8am, midday, and 4pm on a winter\'s day and observe what shade falls where.\n\nFor solar cooking, solar drying, and photovoltaic panels, north-facing positions maximise year-round collection. For protecting frost-sensitive crops like sweet basil, pawpaw, or young citrus, placing them against a north-facing wall that radiates heat at night can make the difference between life and death in the Highveld winter. Indigenous trees like the Weeping Boer-bean (Schotia brachypetala) can be positioned to cast cooling afternoon shade on the house from the west while keeping morning light open to the north.',
        keyPoints: [
          'North-facing slopes are warmer and drier; south-facing slopes are cooler and moister',
          'Winter sun tracks low and northward — shade patterns change dramatically between seasons',
          'Frost pools in south-facing hollows and low-lying frost pockets on the Highveld',
          'Permanent structures cast year-round shade — observe shadow at 8am, midday, and 4pm in winter before placing them',
        ],
        quiz: [
          {
            q: 'You want to plant a young pawpaw tree that cannot tolerate frost. On a Highveld smallholding, where is the best position?',
            options: [
              'In the lowest point of the garden where cold air drains to',
              'On a south-facing slope to stay cool in summer',
              'Against a north-facing wall that will radiate heat at night',
              'Under the canopy of an existing large tree for protection',
            ],
            correct: 2,
          },
          {
            q: 'A farmer builds a 2-metre shade cloth structure on the north side of her vegetable garden in autumn. What is the likely consequence in winter?',
            options: [
              'The structure will block the low winter sun and shade the garden for most of the day',
              'The structure will redirect frost away from the vegetables',
              'No effect — the sun is overhead at noon so north-side shade does not matter',
              'The shade will reduce evaporation and help the crops in dry winter months',
            ],
            correct: 0,
          },
        ],
      },
      {
        id: 'reading-landscape-l3',
        title: 'Wind, Frost, and Topography: Reading the Invisible Forces',
        body: 'Wind is one of the most damaging forces on a South African smallholding and one of the most consistently ignored in farm planning. The Highveld experiences fierce north-westerly and westerly winds in August and September — hot, dry berg winds that desiccate topsoil, strip moisture from leaves, and can destroy young seedlings in a single day. KZN farms near the escarpment face south-westerly cold fronts in winter and humid easterly winds that bring fungal disease pressure in summer. The Lowveld along the Limpopo faces dry north to north-westerly heat in October and November. Each region has its dominant wind sectors and each requires a different response.\n\nFrost behaves like water — it flows downhill at night and pools in low-lying areas and hollows. A flat valley bottom on the Highveld will frost weeks before and after the slopes above it. In the Drakensberg foothills, a saddle or gap in a ridgeline will funnel cold air like a river, creating a frost channel that can run two or three hundred metres into a protected valley. Knowing these frost channels determines where you site your most vulnerable crops and your seedling nursery.\n\nTopography — the shape of your land — controls all of these forces. A ridgeline deflects wind. A hill creates a rain shadow on its leeward side. A valley concentrates cold air and increases humidity. Reading your topography before planting means fewer expensive mistakes. Walk your property at dawn on a cold morning in June or July, when frost and cold air accumulation is visible as mist or frozen dew. The places that stay frosted longest are your Zone 4 and 5 areas — useful for hardy trees and wildlife but dangerous for tender crops.',
        keyPoints: [
          'Know your region\'s dominant wind direction — Highveld north-westerlies, KZN easterlies, Lowveld north winds',
          'Frost flows downhill and pools in low spots — valleys and hollows frost earliest and latest',
          'Ridgelines deflect wind; hills create rain shadows on their leeward sides',
          'A winter dawn walk reveals frost pockets and cold air channels visually',
        ],
        quiz: [
          {
            q: 'On a Highveld farm, where would you plant your most frost-sensitive seedling nursery?',
            options: [
              'In a valley bottom where cold air pools overnight',
              'On a flat ridgeline exposed to wind but frost-free',
              'On a gently sloping north-facing hillside above the frost-pool zone',
              'Under large shade trees that trap heat',
            ],
            correct: 2,
          },
          {
            q: 'A KZN farmer notices that her tomatoes develop late blight every summer. Knowing that fungal disease thrives in humid, low-airflow conditions, where should she relocate her tomato bed?',
            options: [
              'Into a sheltered, fully enclosed tunnel with no ventilation to protect from rain',
              'To a position with good airflow and morning sun that dries leaf surfaces quickly',
              'Into a low-lying area near a dam where humidity stays high',
              'Against a south-facing wall out of direct sun to reduce heat stress',
            ],
            correct: 1,
          },
        ],
      },
      {
        id: 'reading-landscape-l4',
        title: 'Making a Simple Site Map: Your Design Starts on Paper',
        body: 'A site map does not require an architect or a drone. You need a large piece of paper, a tape measure or estimated pacing, a compass or phone compass app, and a clear morning to walk the land. Start by pacing out the boundary of your property and sketching it roughly to scale on paper. Mark north at the top. Add the house, any existing trees, streams, dams, roads, and fences. Then draw arrows showing the dominant wind directions in summer and winter, shade patterns from existing buildings and trees, and the direction water flows during rain.\n\nNext, mark your observation notes: where frost sits longest, which corner smells damp in dry months (likely a seep or high water table), where weeds like khakibos (Tagetes minuta) or blackjack (Bidens pilosa) grow thickest (both are pioneer plants on disturbed soil — they are telling you something). Note which zones get the most foot traffic naturally. Often you will find you already intuitively walk to water, to shade, and away from wind — and your design should follow those natural pathways.\n\nOnce the base map is drawn, overlay your zone and sector analysis. Draw a rough zone boundary around the house and mark which areas fall into Zones 1 through 5 based on realistic visit frequency. Mark the wind and frost sectors with arrows or shading. This map is now your working design document. It will change as you observe more, but having it on paper forces clarity and helps you explain your plans to family members, funders, or a local extension officer. Keep it simple — a pencil sketch that you update seasonally is worth more than a perfect diagram done once.',
        keyPoints: [
          'A site map needs only paper, a tape measure, a compass, and your own observations',
          'Mark infrastructure, water flows, dominant winds, frost pockets, and vegetation on your map',
          'Pioneer weeds like khakibos and blackjack indicate disturbed or compacted soil — note where they grow',
          'Overlay zone and sector analysis onto your base map to complete the design skeleton',
        ],
        quiz: [
          {
            q: 'You notice dense stands of blackjack (Bidens pilosa) growing in one corner of your property every year. What is this most likely telling you about that area?',
            options: [
              'The soil in that corner is exceptionally fertile and well-structured',
              'That area has a higher water table than the rest of the property',
              'The soil has been disturbed or compacted and pioneer plants are colonising it',
              'Blackjack only grows in shade, so there must be a hidden water seep there',
            ],
            correct: 2,
          },
          {
            q: 'When drawing a site map, why is it important to mark the direction of dominant wind in both summer and winter separately?',
            options: [
              'Wind direction is the same year-round in South Africa so only one arrow is needed',
              'Summer and winter winds may come from different directions, affecting where windbreaks and tender crops should be placed',
              'Wind only matters in winter on the Highveld so only the winter direction needs marking',
              'Wind direction only affects the position of buildings, not crop placement',
            ],
            correct: 1,
          },
        ],
      },
    ],
  },
  {
    id: 'water-harvesting',
    title: 'Water Harvesting',
    description: 'Swales, berms, dams and rainwater tanks — slow, spread and sink every drop.',
    durationMins: 90,
    category: 'water',
    lessons: [
      {
        id: 'water-harvesting-l1',
        title: 'Swales and Berms: Slowing Water on the Slope',
        body: 'A swale is a level trench dug along a contour line — not across a slope at an angle, but perfectly level from end to end so water fills it evenly and sinks into the ground rather than flowing anywhere. Beside the swale on the downhill side, the excavated soil is mounded into a berm. Trees and shrubs planted on the berm access the water that sinks from the swale and are never thirsty, even months after the last rain. This is the single most powerful water harvesting technique for hillside smallholdings in summer-rainfall South Africa.\n\nOn a 1-hectare site with a gentle 3–5% slope, two or three well-placed swales can transform a dry hillside into a productive food forest zone. The spacing between swales depends on slope and rainfall intensity. On the Highveld where storms can deliver 50–80mm in an hour, swales need to be sized and spaced so they do not overflow — an overflow in a single heavy storm can breach a berm and create the very gully you were trying to prevent. Design your swale with a gentle overflow point at one end that leads water safely away to the next swale or to a dam.\n\nSwales are most effective on slopes of 1–15%. On steeper slopes (above 15–20%), swales become difficult to maintain and landslip risk increases — on steep KZN hillsides above 20%, use hillside ditches with a slight grade, vetiver grass contour lines, or terraces instead. Before digging any earthwork, know what your soil does when wet. Clay-heavy soils expand and can become unstable; sandy soils drain fast and swales may not hold water long enough. Dig a test pit 60cm deep and pour in water — if it drains within the hour, your site needs a different approach to water retention.',
        keyPoints: [
          'A swale is a level trench on contour — it sinks water, not directs it',
          'The berm (uphill mound from excavation) is where you plant trees to access stored water',
          'On Highveld, size swales for storm intensity — include a safe overflow point',
          'Slopes above 20% need vetiver grass lines or terraces rather than swales',
        ],
        quiz: [
          {
            q: 'You dig a swale but notice after a heavy rain that one end fills quickly while the other end stays dry. What went wrong?',
            options: [
              'The swale is too wide and water is spreading too slowly',
              'The swale is not level — it was dug on a slight angle rather than perfectly on contour',
              'The berm on the downhill side is too high and is blocking water entry',
              'The soil is too sandy to hold water in a swale at all',
            ],
            correct: 1,
          },
          {
            q: 'A farmer on a steep 25% slope in the KZN Midlands wants to slow water movement and reduce erosion. Which technique is most appropriate?',
            options: [
              'Dig standard swales on contour as deep as possible',
              'Plant vetiver grass (Chrysopogon zizanioides) in contour lines across the slope',
              'Build a large earth dam at the bottom of the slope to catch all runoff',
              'Compact the soil surface with a roller to reduce infiltration and control runoff speed',
            ],
            correct: 1,
          },
        ],
      },
      {
        id: 'water-harvesting-l2',
        title: 'Farm Dams and Ponds: Storing Water for the Dry Season',
        body: 'A well-positioned farm dam can store months of water from a single good rainy season and supply livestock, irrigation, and household needs through winter and into the following year. In summer-rainfall South Africa — most of the country east of the escarpment — rain falls between October and March and then largely stops. A farm without storage relies on boreholes or municipal supply through the dry months. A farm with a well-sited dam becomes largely water-independent.\n\nDam siting follows two rules: collect the maximum catchment area above the dam wall, and locate the spillway before you place the wall. The catchment is all the land that drains water toward your dam. A 2-hectare catchment of natural veld or cultivated land with 700mm annual rainfall can fill a dam of 200,000–400,000 litres in a good season — enough for a large vegetable garden and small livestock operation through winter. The spillway is critical: it is the overflow point that safely releases excess water during exceptional storms so the dam wall is never overtopped and eroded. A breached dam wall is catastrophic and rebuilding it costs more than the dam itself.\n\nIn Limpopo and the hotter parts of KZN where evaporation is high, a dam loses enormous volumes to the sky — sometimes 2 metres of water depth per year in exposed positions. Shade trees around the dam edge, and floating aquatic plants like water hyacinth (managed carefully — it is invasive and must not escape into natural waterways) can reduce evaporation significantly. Ducks on the dam aerate the water and control mosquito larvae. Indigenous edge plants like bulrushes (Typha capensis) stabilise the banks and provide habitat. A farm dam can be a productive ecosystem, not just a storage tank.',
        keyPoints: [
          'Size the dam for the catchment area above it — calculate the catchment before designing the dam',
          'The spillway must be designed before the wall — an overtopped wall can catastrophically breach',
          'High evaporation in Limpopo and the Lowveld means shade trees and aquatic plants save significant water',
          'Ducks, bulrushes, and edge planting make a dam a productive ecosystem',
        ],
        quiz: [
          {
            q: 'A farmer builds a dam wall across a small valley without installing a spillway. After an exceptional storm, the dam overflows. What is the most likely serious consequence?',
            options: [
              'The excess water will irrigate the lower fields beneficially',
              'Water will overtop and erode the wall, potentially causing a catastrophic breach',
              'The dam will simply remain full and the overflow will drain harmlessly downhill',
              'The higher water level will increase the dam\'s storage capacity permanently',
            ],
            correct: 1,
          },
          {
            q: 'In a Limpopo farm, which combination of strategies best reduces evaporation from an open farm dam?',
            options: [
              'Deep dam shape, exposed position with maximum wind, no vegetation on banks',
              'Shade trees on the western and northern banks, floating aquatic plants on the water surface, ducks for aeration',
              'Concrete lining and a sealed plastic cover over the entire dam surface',
              'Increasing the dam\'s surface area to spread evaporation more evenly',
            ],
            correct: 1,
          },
        ],
      },
      {
        id: 'water-harvesting-l3',
        title: 'Rainwater Tanks and Roof Catchment: Harvesting Clean Water',
        body: 'Your roof is a water harvesting surface. Every square metre of roof area collects roughly 0.9 litres of water per millimetre of rain (allowing for minor losses to splashing and evaporation). A modest 100-square-metre corrugated iron roof in Pietermaritzburg, which receives about 800mm of rain per year, can yield close to 72,000 litres annually — enough for a family\'s vegetable garden and much of their household non-drinking water needs. Connecting downpipes to a tank is one of the cheapest and fastest water interventions on any smallholding.\n\nFirst-flush diverters are essential. The first few millimetres of rain on any roof wash off bird droppings, dust, insects, and in areas with pine trees or wattle, acidic leaf litter — this water should be diverted away from your tank before the clean water enters. A simple first-flush diverter is a pipe section that fills and diverts the first 20–30 litres before switching flow to the tank. For drinking water, you also need a biosand filter or a ceramic pot filter downstream of the tank. For garden irrigation and livestock watering, untreated tank water is generally fine.\n\nTank size should be matched to the gap between your rainy seasons. In KZN, where rain falls in most months but peaks in summer, a 5,000-litre tank may bridge dry spells of two to three weeks adequately. On the Highveld where the dry season runs April to September, a smallholder wanting to maintain a winter garden may need 20,000–30,000 litres of storage, or must combine tank water with a dam, borehole, or municipal connection. Concrete tanks, corrugated steel tanks, or food-grade polyethylene tanks all work — the critical factor is keeping them sealed and covered to prevent light (which promotes algae) and mosquito breeding.',
        keyPoints: [
          'Roof catchment yield: approximately 0.9 litres per square metre per mm of rainfall',
          'A first-flush diverter removes the dirty first flush from every rain event',
          'Match tank volume to the length of your dry season, not just a single dry spell',
          'Keep tanks sealed against light and mosquitoes; filter water before drinking',
        ],
        quiz: [
          {
            q: 'A farmer has an 80m² corrugated iron roof and receives 600mm of rain per year. Approximately how many litres can she expect to harvest annually (ignoring losses)?',
            options: [
              'About 24,000 litres',
              'About 43,200 litres',
              'About 80,000 litres',
              'About 6,000 litres',
            ],
            correct: 1,
          },
          {
            q: 'Why is a first-flush diverter important even if the tank water is only used for irrigation?',
            options: [
              'It is not important for irrigation water — only drinking water tanks need a first-flush diverter',
              'The first flush contains concentrated bird droppings, dust, and pathogens that can introduce disease to edible crops',
              'The first flush is more acidic and will change the soil pH in irrigated beds over time',
              'First-flush diverters prevent the tank from overfilling during heavy storms',
            ],
            correct: 1,
          },
        ],
      },
    ],
  },
  {
    id: 'soil-health',
    title: 'Soil Health & Composting',
    description: 'Build living soil with compost, mulch, cover crops and worm farms.',
    durationMins: 75,
    category: 'soil',
    lessons: [
      {
        id: 'soil-health-l1',
        title: 'Understanding Your Soil: The Foundation of Everything',
        body: 'Healthy soil is not dirt. One teaspoon of healthy topsoil contains more living organisms than there are people on earth — bacteria, fungi, nematodes, protozoa, and the threads of mycorrhizal fungi that connect plants underground and transfer nutrients between them. South African smallholders often inherit degraded soils after decades of monoculture cropping, overgrazing, or burning stubble — soils that have lost most of their biological life and depend on chemical fertilisers to produce anything. Understanding what you have is the first step to rebuilding it.\n\nDig a 30cm deep hole in your garden and look at the profile. Healthy topsoil is dark, smells like rain or mushrooms, and has visible worm channels and fungal threads. Degraded soil is pale, compacted, smells sour or of nothing, and has few if any worms. On the Highveld, red clay topsoils (from the Acrisol family) are naturally low in organic matter and crack badly in dry season. In KZN, the red-yellow ferrallitic soils are leached of nutrients by high rainfall. In the Limpopo Lowveld, sandy soils hold little water and nutrients wash through quickly. Each of these soil types responds differently to organic matter additions — but all of them improve dramatically when compost and mulch are applied consistently.\n\nThe most practical soil test for a smallholder is the jar test. Fill a glass jar one-third with soil from your garden, add water to fill it and a drop of dishwashing liquid, shake well, and let it settle for 24 hours. Sand settles first (within 2 minutes), silt settles next (within an hour), and clay remains suspended longest (settling overnight or staying cloudy). Reading the proportions tells you your soil texture and guides how you manage water and organic matter.',
        keyPoints: [
          'Healthy soil is a living ecosystem — bacteria, fungi, and worms process nutrients for plants',
          'The smell test: healthy soil smells earthy and mushroomy; degraded soil smells sour or of nothing',
          'The jar test separates sand, silt, and clay to reveal your soil texture without equipment',
          'Organic matter additions consistently improve all South African soil types',
        ],
        quiz: [
          {
            q: 'After performing the jar test, a farmer sees a thick layer of sand at the bottom, a thin layer of silt in the middle, and the water is still slightly cloudy with clay. What does this tell her about managing water in her garden?',
            options: [
              'Sandy soil retains water well, so she needs to water less frequently',
              'Sandy soil drains quickly and holds little water — she needs heavy mulching and frequent organic matter additions',
              'The thin silt layer means her soil is balanced and needs no adjustment',
              'High clay content means the soil will crack in dry weather and needs gypsum',
            ],
            correct: 1,
          },
          {
            q: 'A farmer digs into his garden and finds pale, compacted soil with no visible worms and a sour smell. Which of the following is the most likely cause?',
            options: [
              'The soil has too much organic matter causing anaerobic conditions',
              'Years of heavy organic mulching have depleted the mineral content',
              'Degradation from continuous cropping, chemical use, or burning has killed most soil biology',
              'The soil type is naturally poor and cannot be improved with organic inputs',
            ],
            correct: 2,
          },
        ],
      },
      {
        id: 'soil-health-l2',
        title: 'Making and Using Compost',
        body: 'Compost is the foundation of a permaculture farm. It is decomposed organic matter that improves soil structure, feeds soil organisms, retains moisture, and slowly releases nutrients to plants. A hot compost heap, properly built, can produce usable compost in four to six weeks in the warm, humid months of KZN, or eight to twelve weeks on the cooler Highveld. The goal of hot composting is to raise the temperature at the centre of the heap to 55–65°C, which kills most weed seeds and pathogens while accelerating decomposition.\n\nThe key to hot compost is balancing carbon and nitrogen materials. Carbon materials (browns) include dry grass, straw, wood shavings, dried leaves, cardboard, and maize stalks. Nitrogen materials (greens) include fresh grass clippings, kitchen vegetable scraps, chicken manure, coffee grounds, and legume trimmings. A ratio of roughly 25–30 parts carbon to 1 part nitrogen by volume produces reliable hot compost. Too much nitrogen and the heap smells of ammonia and becomes slimy. Too much carbon and the heap stays cold and takes many months. On a practical level, this means layering a 20–30cm layer of browns with every 5–10cm layer of greens.\n\nIn South Africa, avoid composting meat, dairy, cooked food scraps, or diseased plant material. Do not add large amounts of wattle (Acacia mearnsii) bark — it is allelopathic and slow to decompose. Khakibos (Tagetes minuta) is excellent in compost and its allelopathic oils break down during decomposition. Avoid adding soil contaminated with persistent herbicide residues (especially aminopyralid or clopyralid, found in some commercial weedkillers) — this can persist through composting and damage crops. Turn your heap every five to seven days when active, keep it moist but not waterlogged, and you will have finished compost that looks and smells like dark, rich earth.',
        keyPoints: [
          'Hot compost needs a carbon-to-nitrogen ratio of approximately 25:1 by volume',
          'Browns (straw, dry leaves, cardboard) and greens (fresh scraps, manure) must be layered',
          'Heap temperature of 55–65°C kills weed seeds and pathogens — this is the goal',
          'Never add meat, dairy, diseased plants, or soil with persistent herbicide residues',
        ],
        quiz: [
          {
            q: 'A farmer\'s compost heap smells strongly of ammonia and is wet and slimy. What is the most likely problem and solution?',
            options: [
              'Too much carbon — add more nitrogen-rich green materials',
              'Too much nitrogen — add more dry carbon materials like straw or dry leaves and turn the heap',
              'The heap is too hot — stop turning it and let it cool down',
              'The heap needs more water — the ammonia smell indicates it is too dry',
            ],
            correct: 1,
          },
          {
            q: 'Why should you avoid adding large amounts of black wattle (Acacia mearnsii) bark to a compost heap?',
            options: [
              'Wattle bark contains nitrogen compounds that make the heap too hot',
              'Wattle bark is allelopathic and decomposes very slowly, slowing the whole composting process',
              'Wattle bark attracts termites that will damage the compost structure',
              'Wattle is an invasive species and its seeds will spread if added to compost',
            ],
            correct: 1,
          },
        ],
      },
      {
        id: 'soil-health-l3',
        title: 'Mulching and Cover Crops: Protecting and Building Soil',
        body: 'Bare soil is wounded soil. In South Africa, where summer storms can deliver 60mm of rain in thirty minutes, bare soil loses topsoil at rates that can take thousands of years to replace. A 5–10cm layer of mulch — straw, dry grass, wood chips, dried leaves — on the soil surface reduces erosion dramatically, moderates soil temperature (keeping it 8–12°C cooler than bare soil in summer), suppresses weeds, and feeds soil organisms as it decomposes from the bottom up. In the KZN Midlands and Natal interior, where kikuyu grass is commonly available as lawn clippings, a 10cm layer of dried kikuyu mulch on a vegetable bed can save watering every two to three days down to once a week.\n\nCover crops are fast-growing plants sown between main crop seasons to cover and protect the soil, add organic matter, and in the case of legumes, fix atmospheric nitrogen. In the Highveld winter, oats, barley, and lupins (Lupinus spp.) can be sown after the maize harvest to cover bare soil through the frost months and be slashed and incorporated before spring planting. In KZN, sunn hemp (Crotalaria juncea) grows fast in summer and produces enormous quantities of nitrogen-rich biomass. Cowpea (Vigna unguiculata) fixes nitrogen and is drought-tolerant enough for the Limpopo Lowveld in early summer before the main rains arrive.\n\nWorm farms (vermicompost) convert kitchen scraps and soft organic waste into concentrated worm castings — one of the richest soil amendments available. A simple wooden box or bathtub worm farm can process a household\'s kitchen scraps into premium compost in three to four weeks. Red wrigglers (Eisenia fetida), not common earthworms, are the species used in worm farms — they live in the organic material itself rather than in soil. The liquid leachate from a worm farm, diluted 1:10 with water, is an excellent liquid fertiliser applied directly to plant roots.',
        keyPoints: [
          'A 5–10cm mulch layer reduces soil temperature, suppresses weeds, and prevents erosion',
          'Cover crops like sunn hemp or lupins protect soil between main crop seasons and add organic matter',
          'Legume cover crops (cowpea, sunn hemp, lupins) fix atmospheric nitrogen — saving on fertiliser',
          'Worm farm leachate diluted 1:10 is a powerful liquid root fertiliser',
        ],
        quiz: [
          {
            q: 'A Highveld farmer harvests her maize in April and leaves the field bare through winter. What are the two main risks of this practice?',
            options: [
              'Soil will overheat in winter sun and waterlogging will occur from winter rain',
              'Frost will kill soil organisms and summer weeds will take over early',
              'Wind erosion of dry topsoil in August and loss of soil structure from rain impact in September storms',
              'Soil pH will drop and nitrogen will build up in the absence of plant uptake',
            ],
            correct: 2,
          },
          {
            q: 'A worm farm leachate is described as a liquid fertiliser, but it must be diluted before use. Why?',
            options: [
              'Undiluted leachate is too cold for plant roots and must be warmed by dilution',
              'Undiluted leachate is highly concentrated and can burn plant roots if applied directly',
              'The leachate contains worm eggs that will hatch in soil and damage roots',
              'Dilution is only necessary for seedlings — established plants can receive undiluted leachate',
            ],
            correct: 1,
          },
        ],
      },
    ],
  },
  {
    id: 'plant-guilds',
    title: 'Plant Selection & Guilds',
    description: 'Choose plants that support each other — nitrogen fixers, accumulators, pest attractors.',
    durationMins: 60,
    category: 'plants',
    lessons: [
      {
        id: 'plant-guilds-l1',
        title: 'Nitrogen Fixers: Plants That Feed the Soil',
        body: 'Nitrogen is the nutrient most limiting to plant growth in degraded South African soils, and it is available for free from the atmosphere if you grow the right plants. Legumes — the pea and bean family — form partnerships with soil bacteria called rhizobia, which take nitrogen gas from the air and convert it to a form plants can use. When legume roots die or the plants are cut, this nitrogen becomes available to neighbouring plants. This is the mechanism that makes cover crops, hedgerows, and food forest design so powerful: you are farming nitrogen from the air.\n\nFor South African conditions, the most useful nitrogen-fixing trees and shrubs include: Senegalia (Acacia) species like flat-crown (Albizia adianthifolia) and large-leaved false thorn; the introduced but productive tagasaste (Chamaecytisus palmensis) for the Western Cape and high-altitude zones; Sesbania sesban, which fixes enormous quantities of nitrogen and grows rapidly in warm, moist conditions such as KZN coastal and Lowveld sites; and the indigenous Natal Mahogany (Trichilia emetica), which, while not a legume, supports rich soil biology. For fast-growing annual nitrogen fixers, sunn hemp (Crotalaria juncea) can reach 2 metres in a single season and adds 150–200kg of nitrogen per hectare worth of biomass when slashed.\n\nPlanting nitrogen fixers in every food system zone ensures a continuous supply of fertility without purchasing synthetic nitrogen. Position them on the uphill side or windward side of fruit trees and vegetable beds so their leaf litter and root breakdown fertilises downhill neighbours. In a food forest, nitrogen-fixing trees are typically planted at twice the density of the canopy fruit trees in the early years, then progressively thinned as the fruit trees mature — each removed nitrogen fixer becomes mulch and soil amendment for the remaining trees.',
        keyPoints: [
          'Legume plants fix atmospheric nitrogen via rhizobia bacteria in root nodules',
          'Sunn hemp adds 150–200kg of nitrogen per hectare worth of biomass in a single season',
          'Position nitrogen fixers uphill or upwind of fruit trees so their fertility moves downhill',
          'In food forests, plant nitrogen fixers at twice the density of fruit trees and thin them as canopy closes',
        ],
        quiz: [
          {
            q: 'A farmer slashes her sunn hemp cover crop and incorporates it into the soil. When does the nitrogen become most available to her following vegetable crop?',
            options: [
              'Immediately — the nitrogen is released the moment the plant material is cut',
              'Over 2–6 weeks as soil organisms decompose the plant material and convert organic nitrogen',
              'Only after the next rain season, as nitrogen requires water to mineralise',
              'Never — incorporated green manure ties up nitrogen and makes it unavailable to following crops',
            ],
            correct: 1,
          },
          {
            q: 'Which of these plants is the most practical fast-growing annual nitrogen fixer for a KZN smallholder wanting to improve a degraded crop field in summer?',
            options: [
              'Tagasaste (Chamaecytisus palmensis) — a fast-growing shrub suited to KZN humidity',
              'Sesbania sesban — grows rapidly in warm moist conditions and fixes high quantities of nitrogen',
              'Oats (Avena sativa) — a winter grass that fixes nitrogen in cold conditions',
              'Khakibos (Tagetes minuta) — a pioneer that adds nitrogen through allelopathic root exudates',
            ],
            correct: 1,
          },
        ],
      },
      {
        id: 'plant-guilds-l2',
        title: 'Dynamic Accumulators and Pest Management Plants',
        body: 'Dynamic accumulators are plants with deep or wide-ranging root systems that mine minerals from subsoil layers that most shallow-rooted vegetables cannot reach. When these plants are cut and left as mulch (chop-and-drop) they deposit those deep minerals on the soil surface where vegetable roots can access them. Comfrey (Symphytum officinale) is the classic example — its roots penetrate over a metre deep and accumulate potassium, calcium, phosphorus, and trace minerals. Yarrow (Achillea millefolium) accumulates copper and potassium. Wild garlic (Tulbaghia violacea), an indigenous South African species, accumulates sulphur and is also a powerful pest repellent.\n\nPest management in permaculture relies on diversity and biology rather than sprays. Every pest species has natural predators — ladybirds eat aphids, wasps parasitise caterpillars, spiders and lizards eat whitefly. The goal is to attract and support these predators by providing flowering plants and habitat. Plants like African basil (Ocimum gratissimum), borage (Borago officinalis), fennel, and marigolds (Tagetes spp.) attract beneficial insects including hover flies, predatory wasps, and lacewings that control pest populations. Planting these throughout and around the vegetable garden creates a biological control system that becomes more effective with each passing year.\n\nIndigenous wild garlic (Tulbaghia violacea) deserves special mention for South African gardens. It is drought-tolerant, frost-hardy on the Highveld when established, produces attractive purple flowers all summer, and its sulphur compounds repel aphids, whitefly, and certain soil nematodes when planted around the border of beds or interplanted with vulnerable crops. It is also edible — leaves and flowers have a mild garlic flavour. It multiplies rapidly from division and can be freely shared with neighbours, making it a model Fair Share plant.',
        keyPoints: [
          'Dynamic accumulators mine deep minerals and deposit them on the surface through chop-and-drop mulching',
          'Comfrey accumulates potassium, calcium, and phosphorus from depths most vegetables cannot reach',
          'Indigenous wild garlic (Tulbaghia violacea) repels aphids, whitefly, and soil nematodes — and is edible',
          'Flowering plants like borage, African basil, and marigolds attract beneficial pest-controlling insects',
        ],
        quiz: [
          {
            q: 'A farmer has a severe aphid infestation on her brassicas. Rather than spraying, she wants a long-term biological solution. Which strategy best addresses this?',
            options: [
              'Plant comfrey around the brassica bed to accumulate potassium and strengthen the plants',
              'Interplant wild garlic and African basil around the bed and allow flowering plants to attract aphid predators like ladybirds',
              'Remove all flowering plants near the bed to prevent competing plants attracting more insects',
              'Apply compost tea weekly to boost plant immunity against aphid feeding',
            ],
            correct: 1,
          },
          {
            q: 'Why is the \'chop and drop\' practice with comfrey particularly valuable in a food forest?',
            options: [
              'Comfrey\'s allelopathic compounds suppress weeds when its leaves decompose on the surface',
              'Comfrey leaves contain high water content that irrigates tree roots as they decompose',
              'Comfrey\'s deep roots mine minerals from subsoil that fruit trees cannot access, and chopping deposits these on the surface',
              'Chopping comfrey stimulates its root nodules to fix more atmospheric nitrogen',
            ],
            correct: 2,
          },
        ],
      },
      {
        id: 'plant-guilds-l3',
        title: 'Building a Plant Guild: A Practical Example',
        body: 'A plant guild is a community of plants chosen to support one central productive plant — usually a fruit or nut tree. Each plant in the guild performs one or more functions: fixing nitrogen, accumulating minerals, attracting beneficials, repelling pests, providing ground cover, or producing food. A well-designed guild needs little input from the farmer after establishment because the plants look after each other.\n\nHere is a practical guild for a mango tree (Mangifera indica) in the KZN Lowveld or coastal zone. The central tree is the mango. One or two small Sesbania sesban plants on the north-east and north-west sides fix nitrogen and provide organic matter when cut back annually (cutting also prevents them shading the mango excessively). Comfrey is planted 60–80cm from the trunk in four positions around the tree — chop-and-drop provides a continuous potassium and calcium mulch. Wild garlic is planted in a ring at the outer edge of the guild to deter pests. African basil is placed between the comfrey to attract beneficial wasps that control fruit flies. A carpet of sweet potato (Ipomoea batatas) covers the ground between plants, suppressing weeds, retaining moisture, and providing a secondary food harvest.\n\nFor a Morula tree (Sclerocarya birrea) guild appropriate to the Limpopo Lowveld — where Morula is indigenous and culturally important — pair it with indigenous leguminous shrubs like Mundulea sericea (cork bush, which is also a nitrogen fixer), a ring of Mexican marigold (Tagetes erecta) for pest management, and interplanted Vigna unguiculata (cowpea) as both a nitrogen fixer and food crop. The Morula itself provides food, the seed oils have high market value, and the tree improves soil and provides shade for understorey crops.',
        keyPoints: [
          'A guild supports one central tree through a community of plants, each performing multiple functions',
          'Mango guilds in KZN: Sesbania (nitrogen), comfrey (minerals), wild garlic (pest), African basil (beneficials), sweet potato (ground cover)',
          'Morula guilds in Limpopo combine indigenous species with cultural and commercial value',
          'Every guild plant should have at least two functions — food, nitrogen, pest control, accumulation, or ground cover',
        ],
        quiz: [
          {
            q: 'In a mango guild, why are the Sesbania sesban plants cut back annually rather than allowed to grow tall?',
            options: [
              'Sesbania is allelopathic and its roots will damage the mango if not cut back',
              'Annual cutting prevents Sesbania from shading and competing with the mango while also providing organic mulch material',
              'Sesbania only fixes nitrogen in its first year — cutting forces a new flush of active root nodules',
              'Tall Sesbania attracts birds that eat mango fruit — cutting reduces this pest',
            ],
            correct: 1,
          },
          {
            q: 'Why is sweet potato a good ground cover choice within a mango guild rather than bare mulch alone?',
            options: [
              'Sweet potato roots compete with the mango for water, reducing the mango\'s irrigation needs',
              'Sweet potato is a legume that fixes nitrogen in the root zone of the mango',
              'Sweet potato covers the ground, suppresses weeds, retains moisture, and produces a harvestable food crop simultaneously',
              'Sweet potato\'s tubers aerate the soil around the mango\'s feeder roots',
            ],
            correct: 2,
          },
        ],
      },
    ],
  },
  {
    id: 'food-forest',
    title: 'Food Forest Design',
    description: 'Layer a multi-storey food system from tall canopy right down to root crops.',
    durationMins: 90,
    category: 'design',
    lessons: [
      {
        id: 'food-forest-l1',
        title: 'The Seven Layers: How a Forest Feeds Itself',
        body: 'A natural indigenous forest in South Africa occupies every vertical zone with different plants, each layer using the light, moisture, and nutrients available at its level. A food forest copies this structure but uses productive species — fruit, nuts, vegetables, herbs, and fibres — in each layer. The seven layers are: the tall canopy (10m+), the sub-canopy (4–8m), the shrub layer (1–3m), the herbaceous layer (under 1m), the ground cover (creeping and spreading plants), the root layer (underground crops), and the climbing layer (vines using vertical space).\n\nIn a food forest for the Highveld, a typical canopy species might be Natal Fig (Ficus natalensis) or a large pecan (Carya illinoinensis). The sub-canopy carries lemon, naartjie, mulberry (Morus spp.), and native species like the Wild Plum (Pappea capensis). The shrub layer holds guava, rosemary, indigenous medlar (Vangueria infausta), and nitrogen-fixing shrubs. The herbaceous layer contains vegetables, comfrey, wild garlic, and medicinal herbs. Ground cover is sweet potato, nasturtium, and creeping thyme. Root crops — sweet potatoes, ginger, turmeric — occupy the underground layer. Granadilla (Passiflora edulis) and kiwi fruit climb into the sub-canopy.\n\nThe key insight is that a food forest, once established, requires dramatically less labour than an annual vegetable garden of the same productive area. There is no annual plowing, no repeated planting, and the system builds its own fertility through leaf fall, deep root activity, and nitrogen fixation. The first two to three years require significant establishment work — mulching, watering, weeding around young plants. After year three to five, the food forest begins to close canopy, suppress its own weeds, and largely care for itself.',
        keyPoints: [
          'Seven layers: tall canopy, sub-canopy, shrub, herbaceous, ground cover, root crops, climbers',
          'A food forest requires far less annual labour than a vegetable garden once established after 3–5 years',
          'Every vertical zone uses different light, moisture, and nutrient levels — reducing competition',
          'Pecan, Natal Fig, Wild Plum, guava, and comfrey are practical Highveld food forest species',
        ],
        quiz: [
          {
            q: 'A food forest is fully planted with all seven layers. Which layer is most likely to struggle and need most attention in years 1–2?',
            options: [
              'The tall canopy trees — they are most exposed to wind and frost',
              'The climbing layer — vines grow too fast and will choke other plants',
              'The herbaceous and ground cover layers — they compete with weeds before the canopy closes enough to suppress them',
              'The root layer — underground crops cannot establish in the presence of tree roots',
            ],
            correct: 2,
          },
          {
            q: 'Why is a food forest more water-efficient than an annual vegetable garden of the same productive area over a 10-year period?',
            options: [
              'Food forest trees have deeper roots that access groundwater unavailable to annual vegetables',
              'The closed canopy and deep mulch from leaf fall reduce evaporation and the diverse root system holds more moisture in the soil profile',
              'Perennial plants transpire less water per kilogram of food produced than annual plants',
              'Food forests require no irrigation at all because rainfall is always sufficient',
            ],
            correct: 1,
          },
        ],
      },
      {
        id: 'food-forest-l2',
        title: 'Species Selection for South African Food Forests',
        body: 'Choosing the right species for your region is the most important decision in food forest design. A mango tree that thrives in the KZN coastal zone will be killed by the first hard frost in the Highveld. A quince that produces abundantly in the cold Natal Midlands will struggle to fruit in the frost-free coastal belt without adequate winter chilling hours. Before selecting species, know your annual rainfall, your minimum winter temperature, your frost frequency, and your summer humidity.\n\nFor the Highveld (Gauteng, parts of Mpumalanga and Free State): canopy trees — pecans, walnuts, large indigenous figs; sub-canopy — apples, pears, plums, quinces, Natal Plum (not frost-tolerant — avoid), mulberry, loquat; shrubs — rosemary, indigenous Wild Medlar (Vangueria infausta), guava (protect from hard frost as a young plant), Cape gooseberry (Physalis peruviana). For the KZN coast and Lowveld: canopy — mango, avocado, Natal Mahogany (Trichilia emetica); sub-canopy — banana, pawpaw, litchi, jacaranda (ornamental only), Wild Fig (Ficus spp.); shrubs — Barbados cherry (Malpighia emarginata), Wild Dagga (Leonotis leonurus — medicinal and pollinator attractor). For the Limpopo Lowveld: Morula (Sclerocarya birrea), Marula jam production has commercial value; Mopane (Colophospermum mopane) for soil; baobab (Adansonia digitata) where appropriate — all fruits are edible and culturally significant.\n\nAlways include at least 30% indigenous species in a South African food forest. Indigenous trees and shrubs support local bird populations, which control insects, disperse seed, and provide the complex interactions that make a food forest function as an ecosystem rather than just a collection of plants. A food forest with only exotic fruit trees is more fragile, less biodiverse, and provides fewer ecosystem services than one that integrates indigenous species throughout all layers.',
        keyPoints: [
          'Match species to your frost zone, rainfall, and humidity before purchasing or planting',
          'Highveld food forests suit pecans, apples, mulberry, Cape gooseberry, and indigenous figs',
          'KZN coastal and Lowveld suits mango, avocado, banana, litchi, and Natal Mahogany',
          'Include at least 30% indigenous species to support birds, insects, and ecosystem function',
        ],
        quiz: [
          {
            q: 'A Highveld farmer plants a young mango tree in a sheltered north-facing position. What is the most likely outcome after the first Highveld winter?',
            options: [
              'The mango will thrive because the north-facing position provides enough warmth to offset frost',
              'The mango will produce fruit unusually early due to the temperature fluctuations',
              'The mango will likely be killed or severely damaged by frost, especially as a young tree',
              'The mango will survive if mulched heavily but will need annual replacement',
            ],
            correct: 2,
          },
          {
            q: 'Why is a 30% indigenous species proportion important in a South African food forest design?',
            options: [
              'Indigenous species produce more food per square metre than exotic species',
              'Indigenous species attract the birds and insects that provide pest control, pollination, and seed dispersal, making the system more resilient',
              'Exotic species are not legally permitted on smallholdings under South African biodiversity law',
              'Indigenous species are more drought-tolerant and reduce the irrigation requirement of the whole food forest',
            ],
            correct: 1,
          },
        ],
      },
      {
        id: 'food-forest-l3',
        title: 'Establishing a Food Forest: Planting Sequence and Timeline',
        body: 'A food forest is not planted all at once. It is established in a sequence that mimics natural succession, with pioneer plants preparing the ground for the more valuable long-lived species. The planting sequence typically runs: first plant nitrogen fixers and pioneer shrubs to improve soil and provide some canopy; then plant main canopy and sub-canopy fruit trees; then fill in the lower layers once the canopy trees are established and providing some protection; then add climbers and ground covers as the final layer.\n\nIn practice, for a 500m² food forest plot on a degraded Highveld site, year one involves sheet mulching the entire area (lay cardboard over existing grass, cover with 20cm of wood chips or straw), planting nitrogen-fixing pioneer shrubs at 2m spacing, and establishing a nursery nearby to grow your own food forest seedlings. In year two, you plant your main fruit trees into the prepared ground and begin interplanting comfrey, wild garlic, and herbaceous plants between them. Year three to four, you thin the pioneer nitrogen fixers (the thinnings become mulch) and allow the fruit trees to begin establishing dominance. By year five, a Highveld food forest of mostly deciduous species should be producing its first significant fruit harvests while requiring minimal external inputs.\n\nWater is the critical limiting factor in establishment. In the first two summers, young food forest plants need regular watering — a drip irrigation system from a rainwater tank, or hand watering every two to three days in dry months. A thick mulch layer reduces this significantly. On the Highveld, plant at the start of the rainy season (October) so rain does most the watering in the first months. In KZN, plant at the break of the summer rains (October to November). In the Lowveld, plant at the first good rains in November. Never plant into dry soil — a plant stressed by transplant shock combined with drought stress rarely recovers fully.',
        keyPoints: [
          'Food forests are planted in sequence: pioneers first, then canopy trees, then lower layers',
          'Sheet mulch with cardboard and 20cm of wood chips at the start — kills grass and builds soil',
          'Plant at the start of the rainy season so rain does establishment watering naturally',
          'A 500m² Highveld food forest can produce significant harvests by year 5 with minimal inputs',
        ],
        quiz: [
          {
            q: 'A farmer sheet-mulches a 500m² plot with cardboard and wood chips in September (before the Highveld rains). What is the main purpose of the cardboard layer?',
            options: [
              'To create a moisture barrier that prevents water from penetrating to the soil',
              'To smother existing grass and weeds while decomposing to feed soil organisms over the following months',
              'To provide a stable planting platform that prevents the wood chips from moving',
              'Cardboard reflects heat upward and warms the soil for early spring planting',
            ],
            correct: 1,
          },
          {
            q: 'In the food forest planting sequence, why are pioneer nitrogen fixers planted first and then thinned out in years 3–4?',
            options: [
              'Pioneers are planted first because they are the most expensive and need the longest growing period',
              'Pioneers improve soil fertility and provide shelter for fruit trees, then are removed before they compete too strongly for light and space',
              'Pioneer nitrogen fixers must be removed before they set seed or they will spread invasively',
              'Pioneers are thinned because their allelopathic root compounds begin to inhibit fruit tree growth after three years',
            ],
            correct: 1,
          },
        ],
      },
    ],
  },
  {
    id: 'small-livestock',
    title: 'Small Livestock Integration',
    description: 'Chickens, ducks and bees as system components — not afterthoughts.',
    durationMins: 60,
    category: 'foundation',
    lessons: [
      {
        id: 'small-livestock-l1',
        title: 'Chickens in the System: Pest Control, Fertility, and Food',
        body: 'Chickens are among the most productive animals for a smallholding when integrated correctly into the system rather than kept in a fixed pen and fed purchased feed exclusively. A chicken scratching through a garden bed after harvest consumes pest larvae, snails, slugs, and weed seeds — providing genuine pest control that requires no sprays. Their manure, mixed with bedding material (straw, dried leaves, or wood shavings), produces some of the richest compost material available. And their eggs provide high-quality protein for the family before a single vegetable is sold.\n\nThe rotational chicken tractor system is ideal for smallholders. A chicken tractor is a portable pen without a floor — the chickens are moved across the land in a systematic rotation, spending a week or two on each bed before moving on. This concentrates their manure on a specific area without overloading it, while allowing the land to rest and the vegetation to recover between passes. On a 500m² vegetable plot, four to six chickens rotated in a portable pen can maintain fertility across the whole plot through the year without any purchased fertiliser.\n\nThe critical management challenge with chickens in a food forest or vegetable garden is timing. Chickens will scratch out seedlings, eat young transplants, and destroy mulch layers if allowed into a bed at the wrong time. The right time is after harvest, when a bed is empty and you want it cleared and fertilised before replanting. Chickens should not be allowed into the vegetable garden when plants are small and vulnerable. Ducks are gentler and less destructive than chickens — they eat slugs without scratching, making them better suited to established beds and food forest understorey.',
        keyPoints: [
          'Rotational chicken tractors provide fertility, pest control, and weed seed destruction without fixed pens',
          '4–6 chickens rotated through a 500m² plot can maintain fertility without purchased fertiliser',
          'Chickens must be timed correctly — only in beds after harvest, never around seedlings',
          'Ducks are less destructive than chickens and better suited to established food forest understorey',
        ],
        quiz: [
          {
            q: 'A farmer wants to use chickens to prepare an empty bed for replanting. When is the optimal time to put the chickens in?',
            options: [
              'Immediately after planting seedlings so the chickens scratch around them and loosen the soil',
              'After the main crop has been harvested and the bed is cleared, before the next planting',
              'During the growing season when the canopy is large enough to withstand chicken scratching',
              'In winter only, when the chickens will not cause heat stress from scratching',
            ],
            correct: 1,
          },
          {
            q: 'Why are ducks more suitable than chickens for working in an established food forest understorey?',
            options: [
              'Ducks produce more manure per day than chickens, providing more fertility',
              'Ducks eat slugs and snails without the vigorous scratching that chickens use, which would disturb roots and mulch',
              'Ducks are immune to Newcastle disease which is common in food forest environments',
              'Ducks roost in trees and cause less ground compaction than chickens',
            ],
            correct: 1,
          },
        ],
      },
      {
        id: 'small-livestock-l2',
        title: 'Bees: Pollination, Honey, and System Ecology',
        body: 'Honeybees (Apis mellifera) are essential pollinators for any food-producing system. Without adequate pollination, many fruit and vegetable crops produce poorly — watermelons, squash, beans, litchis, avocados, macadamias, and citrus all depend on bee visits. A food forest without a healthy bee population operating in or near it is operating at well below its productive potential. One or two hive boxes positioned thoughtfully on a smallholding can increase fruit and vegetable yields across the entire site.\n\nSouth African native honeybees are Apis mellifera scutellata — the Cape bee (A.m. capensis) in the south-western and southern Cape, and the African honeybee (A.m. scutellata) in the north and east. African bees are more defensive than European domesticated strains but are more resistant to varroa mite (Varroa destructor) which devastates European bee populations worldwide. For smallholders new to beekeeping, a single Langstroth hive or a simple log hive positioned away from foot traffic and facing north-east (so the first morning sun warms the hive entrance and activates the bees early) is a realistic starting point.\n\nBeyond honey and pollination, bees provide an important feedback signal about the health of your broader ecosystem. Healthy bee colonies with good foraging and no pesticide exposure are a sign of a biodiverse, chemically clean smallholding. Declining or absconding colonies signal problems: pesticide drift from a neighbour, a shortage of diverse flowering plants, or disease. Plant a bee forage calendar on your smallholding — a sequence of flowering plants that ensures something is always in bloom, from the late winter wattle flowers through to summer granadilla and autumn Mexican sage (Salvia leucantha). A smallholding with 12-month bee forage supports healthier, more productive colonies.',
        keyPoints: [
          'Bees significantly increase fruit and vegetable yields — a hive nearby is a productivity investment',
          'South African A.m. scutellata is more defensive but more varroa-resistant than European strains',
          'Position hives facing north-east, away from foot traffic, so morning sun warms the entrance',
          'Plant a 12-month flowering calendar to maintain healthy, productive colonies year-round',
        ],
        quiz: [
          {
            q: 'A farmer finds that her avocado trees have poor fruit set despite flowering well. She has no bees on the property. What is the most likely explanation?',
            options: [
              'Avocados are self-pollinating and bees are not involved — the problem is nutrient deficiency',
              'Avocados require pollination by specific beetle species, not bees',
              'Without bees visiting the flowers, the synchronised A and B flower-type mechanism fails and fruit set is poor',
              'Poor fruit set in avocados is caused by frost damage to flowers, not by pollination gaps',
            ],
            correct: 2,
          },
          {
            q: 'A beekeeper notices her hive has swarmed (left) three times in two seasons. Which of these is the most likely cause on a smallholding?',
            options: [
              'The hive is overcrowded and needs a supering box or split — swarming is the colony\'s natural reproduction response to confined space',
              'The queen is too old and the colony is replacing her by swarming',
              'African bees are more prone to swarming than European bees and this cannot be managed',
              'The north-east hive orientation is causing overheating, triggering swarm behaviour',
            ],
            correct: 0,
          },
        ],
      },
      {
        id: 'small-livestock-l3',
        title: 'Integrating Livestock Cycles: Closing the Loop',
        body: 'The true power of small livestock on a permaculture smallholding is in closing nutrient loops. On a conventional farm, purchased chicken feed enters the property, leaves as eggs and meat, and the manure is often a waste problem. On an integrated smallholding, chickens eat kitchen scraps, food forest pest insects, weed seeds, and surplus garden produce — and return their waste as fertility. The cost of keeping chickens drops dramatically, and the value they provide to the system increases. The same logic applies to ducks, guinea fowl, rabbits, and bees.\n\nGuinea fowl (Numida meleagris) are indigenous to southern Africa and are extraordinary tick and grasshopper controllers — far more effective than any spray. A small flock of eight to twelve guinea fowl free-ranging across a smallholding can dramatically reduce tick burdens on family members, pets, and any grazing animals present. They are loud and require a secure roost at night to protect them from predators, but their pest control value is difficult to overstate in the humid tick-heavy environments of KZN and Limpopo.\n\nWhen designing livestock into your system, ask three questions for each animal type: what does this animal eat that I already have on the property (reducing feed costs)? What does it produce that directly benefits another part of the system (closing a loop)? What does it need that I can provide from within the system (reducing inputs)? A chicken tractor behind a mobile dairy goat paddock is a classic integrated example: the goat grazes the pasture, the chickens follow and eat the larvae in the goat manure (breaking the worm life cycle and reducing internal parasite burdens), and both deposit fertility across the whole rotation.',
        keyPoints: [
          'Integrated livestock reduce purchased inputs by eating what the farm already produces',
          'Guinea fowl are indigenous SA tick and grasshopper controllers — effective in KZN and Limpopo',
          'For each animal, ask: what do they eat, what do they produce, and what do they need — all from within the system',
          'Chickens following goats in rotation break the parasitic worm life cycle and reduce deworming needs',
        ],
        quiz: [
          {
            q: 'A KZN farmer wants to reduce tick burdens on her livestock and family without chemical acaricides. Which integrated livestock strategy would be most effective?',
            options: [
              'Keep a fixed flock of 30 chickens in a large enclosed pen near the house',
              'Allow a flock of 10 guinea fowl to free-range across the property — they will hunt and eat ticks actively',
              'Introduce ducks to the property — their foraging behaviour naturally suppresses tick populations',
              'Plant pyrethrum daisies (Chrysanthemum cinerariifolium) as a natural acaricide — the flowers deter ticks',
            ],
            correct: 1,
          },
          {
            q: 'Chickens following grazing goats in a rotational paddock system reduces the need for chemical dewormers. Why?',
            options: [
              'Chickens eat the parasitic worm larvae in fresh goat manure before they mature and reinfect the goats',
              'The presence of chickens stresses goats, which activates immune responses against internal parasites',
              'Chicken manure is allelopathic to parasitic worm eggs and kills them in the soil',
              'Rotating paddocks alone reduces worm burden — the chickens are incidental in this benefit',
            ],
            correct: 0,
          },
        ],
      },
    ],
  },
  {
    id: 'market-community',
    title: 'Market Gardening & Community',
    description: 'Record-keeping, selling surplus and building local food networks.',
    durationMins: 45,
    category: 'business',
    lessons: [
      {
        id: 'market-community-l1',
        title: 'Record-Keeping: Knowing What Your Farm Is Actually Producing',
        body: 'Most smallholders underestimate the value of what their farm produces because they have never recorded it. When you write down every kilogram of tomatoes harvested, every dozen eggs collected, every bundle of morogo (leafy greens), and every litre of milk from a backyard goat, you begin to see your farm as an economy — not just a garden. Records do not need to be elaborate: a simple notebook with date, crop, quantity, and where it went (family, sold, gifted, composted) tells you everything you need to make better decisions.\n\nAfter one full growing season of records, you will be able to answer critical questions: which crops give the most yield per square metre of bed? Which crops cost more in inputs (seeds, water, compost) than they return in value? Which months are you most food-secure and which months are you most dependent on buying food? These answers directly guide next season\'s planting decisions and highlight where to invest in expanding production. For example, many smallholders discover that sweet potatoes and leafy greens consistently outperform tomatoes and peppers on a return-per-bed basis once labour and input costs are factored in.\n\nFor selling purposes, records allow you to calculate a realistic cost of production. A common mistake is pricing produce at market value without understanding whether that price covers your costs. If you buy seedlings, fertiliser, and netting, and spend significant labour hours, and then sell below cost because a neighbour is charging less at the market, you are running your garden at a loss and draining household resources. Even a simple cost sheet — seeds, soil amendments, water, and an honest estimate of your time at minimum wage — reveals your true minimum selling price.',
        keyPoints: [
          'Record every kilogram harvested, every dozen eggs, and where each went — family, sold, or gifted',
          'One season of records reveals which crops give the best return per bed and per labour hour',
          'Calculate your cost of production before setting prices — selling below cost is invisible loss',
          'Records help identify food insecurity months and guide replanting decisions for year-round production',
        ],
        quiz: [
          {
            q: 'A smallholder sells tomatoes at the local market for R15/kg. After recording costs for one season, she calculates that her tomatoes cost R18/kg to produce including seeds, compost, water, and her labour. What should she do?',
            options: [
              'Continue at R15/kg — selling at a loss short-term builds market relationships and will pay off later',
              'Stop growing tomatoes — they cannot be grown profitably by any smallholder',
              'Raise her price to at least R18/kg, reduce input costs through better design, or focus labour on more profitable crops',
              'Apply for a government subsidy to cover the R3/kg gap',
            ],
            correct: 2,
          },
          {
            q: 'A farmer\'s records show she consistently runs short of fresh vegetables in June and July (Highveld winter). What is the most useful action this record reveals?',
            options: [
              'She should buy vegetables at the market in June and July each year to fill the gap',
              'She should plant cold-tolerant winter crops like kale, spinach, and peas in March to April so they are producing in June and July',
              'Her farm is not suited to year-round production and she should focus only on summer crops',
              'The records indicate a soil fertility problem that causes winter production failure',
            ],
            correct: 1,
          },
        ],
      },
      {
        id: 'market-community-l2',
        title: 'Selling Surplus: Where to Sell and How to Price',
        body: 'Before taking produce to a market, know your customer. A formal farmers\' market in a suburban area may have customers willing to pay premium prices for organically grown, heirloom, or unusual varieties — but getting a stall may require registration fees, regular attendance, and a consistent supply they can count on week after week. An informal market or taxi rank stall may have lower prices but higher volume and no registration costs. A local school, clinic, or company that buys fresh produce directly may offer lower prices than retail but a stable, predictable order that is worth more than the higher price of an unpredictable street sale.\n\nDirect selling — going door-to-door in a neighbourhood, selling to a WhatsApp order group, or delivering weekly to regular customers — is often the highest-margin channel for a smallholder with transport. When you remove the middleman, you keep more of the retail price. A box scheme, where customers pay a weekly or monthly subscription for a mixed vegetable box, gives you predictable income and allows you to plan production around committed demand rather than hoping to sell what you have grown. Even a small group of ten regular box customers can provide a meaningful monthly income from a 200–500m² market garden.\n\nPricing should reflect your cost of production plus a realistic labour rate, seasonality (summer gluts lower prices; winter scarcity raises them), and the quality premium your farm can charge. Certified organic registration in South Africa (through Control Union or similar) is expensive and time-consuming for a smallholder. A more practical approach is to build a reputation in your community as a trustworthy, chemical-free grower — bring customers to the farm, show them your compost heaps and chicken tractors, and let the farm tell its own story. This trust, once built, is more durable than a certification label.',
        keyPoints: [
          'Know your customer — formal markets, informal markets, direct sales, and box schemes each suit different farmers',
          'Direct and box scheme sales remove the middleman and give you more of the retail price',
          '10 regular box customers can provide meaningful monthly income from a 200–500m² garden',
          'Community trust and farm visits replace expensive organic certification for most smallholders',
        ],
        quiz: [
          {
            q: 'A smallholder has inconsistent weekly production — some weeks she has surplus, other weeks very little. Which selling channel suits her best?',
            options: [
              'A formal farmers\' market stall that requires consistent weekly attendance and supply',
              'A weekly box scheme subscription requiring the same produce every week',
              'An informal market, taxi rank stall, or neighbour sales where she brings what she has and sells without a fixed commitment',
              'A direct supply contract with a local school canteen that requires daily delivery',
            ],
            correct: 2,
          },
          {
            q: 'Why is a box scheme (weekly vegetable subscription) often more valuable to a smallholder than selling the same produce at a market stall, even if the per-kilogram price is similar?',
            options: [
              'Box scheme customers always pay higher prices per kilogram than market customers',
              'Box schemes allow the farmer to charge for packaging and delivery, increasing margin significantly',
              'Committed subscription income allows the farmer to plan production around real demand rather than growing speculatively and hoping to sell',
              'Box schemes avoid all tax obligations because the income is subscription-based',
            ],
            correct: 2,
          },
        ],
      },
      {
        id: 'market-community-l3',
        title: 'Building Community Food Networks: Strength in Numbers',
        body: 'No smallholder farm is an island. The most resilient food producers in South Africa are connected to networks of other growers, buyers, skills-sharers, and resource-poolers. A seed swap between five neighbours transforms five households\' worth of seed diversity into twenty-five — because each grower can specialise in saving a few varieties perfectly rather than poorly saving many. Tool sharing within a group of smallholders means expensive items like a water pump, a wheelbarrow trolley, or a grain mill are accessible to everyone without each household buying one. These informal networks are the original permaculture communities.\n\nLocal food networks — whether they are formal community-supported agriculture (CSA) groups, informal WhatsApp marketplaces, or neighbourhood buy-nothing-but-food groups — create markets close to home and reduce the enormous post-harvest losses that occur when small-scale produce must travel long distances to formal markets. In South Africa, approximately 30–40% of food produced by smallholders is wasted because distribution infrastructure is lacking. A community food network addresses this directly by creating demand within walking or cycling distance of supply.\n\nSkill sharing is as valuable as material sharing. A farmer who has mastered grafting fruit trees, or who knows how to identify and manage common fungal diseases in the humid KZN summer, has knowledge that can transform ten neighbours\' farms if she teaches it. Organising a monthly skills swap — where members demonstrate and teach one skill to the group — builds collective knowledge that is more resilient than any single expert consultation. Document what you learn in your farm notebook and pass it on. The permaculture principle of \'obtain a yield\' applies to knowledge just as much as to tomatoes.',
        keyPoints: [
          'Seed swaps between 5 neighbours multiply variety diversity 5-fold with the same effort',
          'Tool sharing within a group makes expensive equipment accessible to everyone',
          'Community food networks reduce the 30–40% post-harvest losses smallholders face from distant markets',
          'Monthly skills swaps build collective farm knowledge more durably than individual expert consultations',
        ],
        quiz: [
          {
            q: 'Five smallholders each save seed from three different tomato varieties on their own. Alternatively, they agree that each farmer saves two varieties for the whole group. Which approach produces better seed quality for each farmer?',
            options: [
              'Each saving their own — they maintain full independence and variety selection control',
              'Collective saving — each farmer specialises in fewer varieties and can devote more attention to proper isolation, selection, and storage, producing better quality seed for everyone',
              'Both approaches produce the same outcome as long as all farmers save seed carefully',
              'Collective saving only works if the group can afford a seed bank storage facility',
            ],
            correct: 1,
          },
          {
            q: 'A smallholder produces 50kg of green beans but the nearest formal market is 60km away and transport costs R150. She sells the beans for R8/kg (R400 total). What community food network approach would most improve her profitability on the same crop?',
            options: [
              'Grow 100kg instead — the volume will justify the transport cost',
              'Process the beans by canning or drying to add value and justify the transport cost',
              'Sell within her neighbourhood via a WhatsApp group or local community market — eliminating the R150 transport cost and potentially selling at R10/kg to local buyers',
              'Join a formal cooperative that negotiates bulk transport rates on behalf of members',
            ],
            correct: 2,
          },
        ],
      },
    ],
  },
];

export const CATEGORY_COLORS: Record<ModuleCategory, string> = {
  foundation: '#1F4D2B',
  water:      '#235E86',
  soil:       '#8B5E3C',
  plants:     '#2D6B3C',
  design:     '#C07A1E',
  business:   '#5C5040',
};

export const TOTAL_MODULES = COURSE_MODULES.length;

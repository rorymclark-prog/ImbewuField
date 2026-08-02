// Design Studio — per-step "Why this step?" lessons (Lane 4, docs/DISCOVERABILITY-SIMPLE-PLAN.md).
//
// The Studio is 100% hardcoded English (no lib/i18n usage here — see DesignWizard.tsx and
// app/design/page.tsx for the same convention), so this is plain string data, not translation
// keys. Content is verbatim from the plan's section 4.2 final draft — do not paraphrase.

import type { WizardStep } from '@/lib/design-canvas';

export interface StepLesson {
  title: string;
  body: string;
  principle: string;
  tip: string;
  /** A named confusion this step invites, answered before the farmer hits it on site. Only added
   *  where two things a farmer places really are mistaken for each other — not a general FAQ. */
  didYouKnow?: { question: string; answer: string };
  /** Must exist in lib/course-modules.ts COURSE_MODULES. Omitted where the plan specifies none. */
  courseModuleId?: string;
}

export const DESIGN_STEP_LESSONS: Record<Exclude<WizardStep, 'glossy'>, StepLesson> = {
  base: {
    title: "Start with what's true",
    body: "Before you design anything, get the real picture: your boundary, your house, and what's already on the ground. Everything you place later is measured against these. If the base is wrong, every distance in your plan is wrong too.",
    principle: "Observe and interact — good design starts by seeing what's really there.",
    tip: 'Trace your boundary on the main map first — the Studio fits your satellite photo to it, so every bed you place is true to scale.',
    courseModuleId: 'reading-landscape',
  },
  sector: {
    title: "Read the land's energies",
    body: "Before you place a single thing, see how sun, wind, fire and water may move across your land. The app computes sun, slope, drainage and traced access for this property, and adds clearly marked regional wind and fire context. Design WITH these energies, not against them: put windbreaks against the hot wind, a firebreak on the fire side, swales across the way water runs, and keep tender crops out of frost pockets. In South Africa the strongest sun usually comes from the north. Confirm the regional wind and fire assumptions with your own observations or a local expert before you build.",
    principle: 'Design from patterns to details — read the big forces first, then place the small things.',
    tip: 'Fire comes from the dry-season wind — keep the fuel low and a firebreak clear on that side of your land.',
    courseModuleId: 'reading-landscape',
  },
  water: {
    title: 'Water first, everything else second',
    body: "Water is the heaviest thing to move and the first thing to run out. Catch it where it falls: tanks next to roofs, and swale lines across the slope, on contour, so rain sinks into your soil instead of washing away. A garden planned around water survives a dry month; one without doesn't.",
    principle: 'Catch and store energy — harvest rain in the wet season, spend it in the dry.',
    tip: 'Place a tank within 3 m of a roof downpipe. Every 10 mm of rain on a 100 m² roof gives you about 1,000 litres.',
    courseModuleId: 'water-harvesting',
  },
  // NEW with the Earthworks step (2026-08-01) — not from the 4.2 draft, which predates the
  // split of land-shaping out of Water. Written from the same source as the step's own one-liner
  // in lib/lesson-registry.ts ("Shape the land once, on contour, so water and soil stay where you
  // put them"), and deliberately carrying no measurements: swale spacing and bank batter depend on
  // slope, soil and rainfall, and this app does not invent agronomic numbers.
  earthworks: {
    title: 'Shape the land once',
    body: "Earthworks are the slowest thing to undo, and the first thing a machine should do while it can still reach the ground: swales dug along the contour, berms built from what comes out of them, terraces and banks cut into a slope. Get the levels right and every rain afterwards works for you — water walks slowly across your land instead of running off it. Get them wrong and you have moved a great deal of soil into the wrong place.",
    principle: 'Work with nature, not against it — follow the contour the land already has.',
    tip: 'Set your levels along the contour before you dig, and plant the bank as soon as it is shaped — a bare berm is the first thing a big rain takes away.',
    // THE ONE THING PEOPLE MIX UP ON THIS STEP, so it gets said in the lesson rather than left to
    // be discovered on site. Rory asked for it after the two structures rendered alike on sheet 05
    // and he had to ask which was which: "this needs to be in our study notes and also as a hey do
    // you know this tip on the design page, people may get confused."
    //
    // Deliberately no numbers beyond the grade range, which is the documented soil-conservation
    // practice rather than a recommendation this app is making for a particular farm. Whether a
    // given slope wants a swale or a bank depends on soil and rainfall, and that decision is
    // pointed at a person, not answered here.
    didYouKnow: {
      question: 'Swale or contour bank — what is the difference?',
      answer: 'A swale is a CUT: a level trench dug on contour, with the spoil heaped downhill as its bank. It soaks water into the ground where it falls, so it is laid dead level — any fall turns it into a drain and it scours. A contour bank is a HEAP: a raised ridge across the slope, often with no trench at all, laid on a slight grade (about 0.2–0.5%) to lead runoff to a safe outlet like a grassed waterway. In short: a swale keeps water where it falls, a bank moves it somewhere safe. Swales suit soil that drains; banks suit erodible cropland, and clay or dispersive soils where a swale would waterlog and slump the slope. If you are not sure which your land wants, ask someone who knows the soil before you dig.',
    },
    courseModuleId: 'water-harvesting',
  },
  zones: {
    title: 'Put things where your feet already go',
    body: 'Zones plan your energy, not just your space. Things you visit every day — herbs, veg beds, chickens — belong nearest the kitchen door. Things you visit weekly or monthly go further out. This one idea cuts real walking time over a season, and keeps your most-tended plants where you will actually notice if they need water.',
    principle: 'Zone planning — the more often you use it, the closer it lives.',
    tip: 'Stand at your kitchen door and count 20 steps. What you can reach is Zone 1 — keep your daily harvest inside it.',
    courseModuleId: 'intro-permaculture',
  },
  planting: {
    title: 'Right plant, right place',
    body: "Trees are the biggest, longest-living things you'll place — position them first and fit beds around them. In South Africa the midday sun sits in the north, so a tall tree on the north side of a bed steals its light. Give every fruit tree room for its full-grown size, not its seedling size.",
    principle: 'Use and value diversity — a mix of trees, beds and flowers confuses pests and feeds bees.',
    tip: 'Plant tall trees on the south or west of veg beds so winter sun still reaches them. A mango grows 10 m wide — measure that out before you dig.',
    courseModuleId: 'food-forest',
  },
  structures: {
    title: 'Buildings must work for the land',
    body: 'Sheds, coops and kraals are workers, not furniture: a roof catches water, a wall blocks wind, animals make manure for your compost. Place each structure where what it produces feeds the next thing along.',
    principle: 'Integrate rather than segregate — place things so they help each other.',
    tip: 'Put the compost bay on the path between kitchen and veg beds — scraps in on the way out, finished compost back on the way in.',
    courseModuleId: 'small-livestock',
  },
  review: {
    title: 'Look before you build',
    body: 'Walk through your design like a real morning: fetch water, feed the chickens, pick spinach. Are the paths short? Does anything shade the beds or block the tap? Changing it on the map costs nothing — changing it after digging costs a season.',
    principle: 'Apply self-regulation and accept feedback — check the plan before the spade hits the ground.',
    tip: "Show the design to one other person. A mentor sees in one minute what you've stopped noticing.",
  },
};

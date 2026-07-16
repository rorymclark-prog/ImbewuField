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
  water: {
    title: 'Water first, everything else second',
    body: "Water is the heaviest thing to move and the first thing to run out. Catch it where it falls: tanks next to roofs, and swale lines along the slope so rain sinks into your soil instead of washing away. A garden planned around water survives a dry month; one without doesn't.",
    principle: 'Catch and store energy — harvest rain in the wet season, spend it in the dry.',
    tip: 'Place a tank within 3 m of a roof downpipe. Every 10 mm of rain on a 100 m² roof gives you about 1,000 litres.',
    courseModuleId: 'water-harvesting',
  },
  zones: {
    title: 'Put things where your feet already go',
    body: 'Zones plan your energy, not just your space. Things you visit every day — herbs, veg beds, chickens — belong nearest the kitchen door. Things you visit weekly or monthly go further out. This one idea saves you hundreds of walking hours a year.',
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

export type ModuleCategory = 'foundation' | 'water' | 'soil' | 'plants' | 'design' | 'business';

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  durationMins: number;
  category: ModuleCategory;
}

export const COURSE_MODULES: CourseModule[] = [
  {
    id: 'intro-permaculture',
    title: 'Introduction to Permaculture',
    description: 'Ethics, principles and patterns — the foundation for everything else you will build.',
    durationMins: 45,
    category: 'foundation',
  },
  {
    id: 'reading-landscape',
    title: 'Reading the Landscape',
    description: 'Identify water flow, sun angles, wind patterns and topography on your site.',
    durationMins: 60,
    category: 'design',
  },
  {
    id: 'water-harvesting',
    title: 'Water Harvesting',
    description: 'Swales, berms, dams and rainwater tanks — slow, spread and sink every drop.',
    durationMins: 90,
    category: 'water',
  },
  {
    id: 'soil-health',
    title: 'Soil Health & Composting',
    description: 'Build living soil with compost, mulch, cover crops and worm farms.',
    durationMins: 75,
    category: 'soil',
  },
  {
    id: 'plant-guilds',
    title: 'Plant Selection & Guilds',
    description: 'Choose plants that support each other — nitrogen fixers, accumulators, pest attractors.',
    durationMins: 60,
    category: 'plants',
  },
  {
    id: 'food-forest',
    title: 'Food Forest Design',
    description: 'Layer a multi-storey food system from tall canopy right down to root crops.',
    durationMins: 90,
    category: 'design',
  },
  {
    id: 'small-livestock',
    title: 'Small Livestock Integration',
    description: 'Chickens, ducks and bees as system components — not afterthoughts.',
    durationMins: 60,
    category: 'foundation',
  },
  {
    id: 'market-community',
    title: 'Market Gardening & Community',
    description: 'Record-keeping, selling surplus and building local food networks.',
    durationMins: 45,
    category: 'business',
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

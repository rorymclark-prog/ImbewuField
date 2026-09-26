/** Unreviewed, source-paired Tshivenda Food Forest L1 learner draft. */
import type { TshivendaCourseModuleDraft, TshivendaSourcePair } from './course-translation-drafts-ve.ts';

const pair = (sourceEnglish: string, tshivendaDraft: string, reviewStatus: TshivendaSourcePair['reviewStatus'] = 'machine-draft'): TshivendaSourcePair => ({
  sourceEnglish, tshivendaDraft, reviewStatus,
});

const hold = (sourceEnglish: string): TshivendaSourcePair => pair(sourceEnglish, sourceEnglish, 'hold');

export const TSHIVENDA_FOOD_FOREST_DRAFT: TshivendaCourseModuleDraft = {
  id: 'food-forest',
  language: 've',
  reviewStatus: 'machine-draft',
  sourceMetadata: { durationMins: 25, category: 'design' },
  title: pair('Food Forest Design', 'Nzudzanyo ya Daka ḽa Zwiḽiwa'),
  description: pair(
    'Layer a multi-storey food system from tall canopy right down to root crops.',
    'Vhekanyani sisiteme ya zwiḽiwa ya miṱaṱo minzhi u bva nṱha kha canopy ya miri milapfu u swika fhasi kha zwimela zwa midzi (root crops).',
  ),
  lessons: [{
    id: 'food-forest-l1',
    infographicAlt: pair(
      'A food forest cross-section with a tall central tree, smaller trees, shrubs, upright plants, ground cover and a vine, with their roots branching through the soil; sunlight enters from the upper left.',
      'A food forest cross-section with a tall central tree, smaller trees, shrubs, upright plants, ground cover and a vine, with their roots branching through the soil; sunlight enters from the upper left.',
      'hold',
    ),
    title: pair('The Seven Layers: How a Forest Feeds Itself', 'Miṱaṱo ya Supa: Nḓila ine Daka ḽa ḓiṋea Zwiḽiwa Ngayo'),
    body: {
      sourceEnglish: [
        'An indigenous forest fills the space from the highest branches to the roots.',
        'Different plants use the light and moisture available at their level.',
        'A food forest copies this pattern with productive species.',
        'The result is not one crop in one row, but many useful layers growing together.',
        'Think of tall canopy, smaller trees, shrubs and herbaceous plants.',
        'Ground cover protects the surface, root crops grow below it, and climbers use suitable supports.',
        'The heights and spacing depend on the plants and site. These are planning layers, not fixed height bands.',
        'The original Highveld example includes Wild Fig or pecan above lemon, naartjie and black mulberry.',
        'It places Cape gooseberry and Wild Medlar with vegetables, wild garlic, sweet potato and granadilla.',
        'Treat this as a layout example, not permission to plant every species. Check identity, frost tolerance, mature size and local restrictions first.',
        'Young plants need establishment care: moisture checks, weed control and protection from damage.',
        'As plants grow, shade and leaf litter change conditions below them.',
        'Check competition and access. Prune, thin or adjust lower planting when observations call for it; the system does not become care-free on a fixed birthday.',
      ].join('\n\n'),
      tshivendaDraft: [
        'Daka ḽa mupo ḽi ḓadza fhethu u bva kha maṱavhi a nṱhesa u swika kha midzi.',
        'Different plants use the light and moisture available at their level.',
        'Daka ḽa zwiḽiwa ḽi edzisa nḓila heyi nga zwimela zwi bveledzaho.',
        'Mvelelo a si tshiliṋwa tshithihi kha muduba muthihi, fhedzi ndi zwigaba zwinzhi zwi vhuyedzaho zwi tshi aluwa zwo ṱangana.',
        'Humbulani nga ha matavhi malapfu a nṱha a no fuka daka, miri miṱuku, zwiṱaka na zwimela zwi si na thanda.',
        'Ground cover i tsireledza nṱha ha mavu, root crops dzi aluwa fhasi hayo, nahone climbers dzi shumisa zwitikhi zwo teaho u gonya.',
        'Vhulapfu na tshikhala tsha u ṱavha zwi bva kha zwimela na fhethu. Hezwi ndi zwigaba zwa u pulana, a si mielo ya vhulapfu yo tiwaho.',
        'The original Highveld example includes Wild Fig or pecan above lemon, naartjie and black mulberry.',
        'It places Cape gooseberry and Wild Medlar with vegetables, wild garlic, sweet potato and granadilla.',
        'Treat this as a layout example, not permission to plant every species. Check identity, frost tolerance, mature size and local restrictions first.',
        'Young plants need establishment care: moisture checks, weed control and protection from damage.',
        'As plants grow, shade and leaf litter change conditions below them.',
        'Check competition and access. Prune, thin or adjust lower planting when observations call for it; the system does not become care-free on a fixed birthday.',
      ].join('\n\n'),
      reviewStatus: 'machine-draft',
    },
    keyPoints: [
      pair('Seven planning layers can combine useful plants at different heights', 'Miṱaṱo ya supa ya u pulana i nga ṱanganya zwimela zwi re na mushumo kha vhulapfu ho fhambanaho'),
      hold('Plants can compete for light, water and nutrients'),
      hold('Establishment and ongoing care depend on observed conditions'),
      hold('Confirm local suitability before copying any example planting'),
    ],
    quiz: [
      {
        question: hold('Weeds are competing strongly with young lower-layer plants. What should guide the next action?'),
        options: [
          hold('Wait until the fifth year'),
          hold('Add more plants regardless of water'),
          hold('Check the affected plants and manage competition'),
          hold('Assume all seven layers take care of themselves'),
        ],
        sourceCorrectIndex: 2,
        rationale: hold('Observe actual competition and plant condition. A fixed establishment calendar cannot tell you which plants need care now.'),
      },
      {
        question: hold('How can leaf litter and shade help protect soil moisture?'),
        options: [
          hold('They guarantee access to groundwater'),
          hold('They can reduce water loss from the soil surface'),
          hold('They guarantee higher yield per litre in every system'),
          hold('They remove the need to check watering'),
        ],
        sourceCorrectIndex: 1,
        rationale: hold('Shade and suitable mulch can reduce surface evaporation. Plant water demand and establishment needs still require attention.'),
      },
    ],
  }],
};

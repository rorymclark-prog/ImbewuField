/** Unreviewed, source-paired Tshivenda Food Forest L1–L2 learner drafts. */
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
  title: pair('Food Forest Design', 'Pulane ya Ḓaka ḽa Zwiḽiwa'),
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
    title: pair('The Seven Layers: How a Forest Feeds Itself', 'Miṱaṱo ya Supa: Nḓila ine Ḓaka ḽa ḓiṋea Zwiḽiwa Ngayo'),
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
        'Ḓaka ḽa mupo ḽi ḓadza fhethu u bva kha maṱavhi a nṱhesa u swika kha midzi.',
        'Different plants use the light and moisture available at their level.',
        'Ḓaka ḽa zwiḽiwa ḽi edzisa nḓila heyi nga zwimela zwi bveledzaho.',
        'Mvelelo a si tshiliṅwa tshithihi kha muduba muthihi, fhedzi ndi miṱaṱo minzhi i vhuyedzaho zwi tshi aluwa zwo ṱangana.',
        'Humbulani nga ha maṱavhi malapfu a nṱha a no fuka ḓaka, miri miṱuku, zwiṱaka na zwimela zwi si na thanda.',
        'Ground cover i tsireledza nṱha ha mavu, root crops dzi aluwa fhasi hayo, nahone climbers dzi shumisa zwitikhi zwo teaho u gonya.',
        'Vhulapfu na tshikhala tsha u ṱavha zwi bva kha zwimela na fhethu. Heyi ndi miṱaṱo ya u pulana, a si mielo ya vhulapfu yo tiwaho.',
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
  }, {
    id: 'food-forest-l2',
    infographicAlt: hold(
      'A simple shape of South Africa divided into three growing areas by ground colour and terrain alone: a pale high inland plateau with hills, a green humid coastal strip, and a hot red-brown low-lying area. Different tree shapes stand in each.',
    ),
    title: pair(
      'Species Selection for South African Food Forests',
      'U Nanga Lushaka lwa Zwimela zwa Daka ḽa Zwiḽiwa ḽa Afrika Tshipembe',
    ),
    body: hold(
      [
        'Check local rainfall, frost, heat, soil and water availability before choosing plants.',
        'Mango can suffer frost damage. Quince needs suitable winter chilling for reliable cropping.',
        'A regional label or a sheltered corner is not enough. Confirm each plant and variety with reliable local guidance.',
        'The original list includes pecan, walnut and indigenous fig; apple, pear, plum, black mulberry and loquat; rosemary, Wild Medlar, Cape gooseberry and Barbados cherry.',
        'This list is not a blanket recommendation. Check each plant against frost, soil, mature size and the approved local species list.',
        'Keep existing legal and project restrictions in force. Do not plant from a picture alone.',
        'The original warm-region examples include mango, avocado, Natal Mahogany, banana, pawpaw, litchi, Wild Fig, Barbados cherry and Wild Dagga.',
        'Marula, Mopane and baobab also appear in the Limpopo examples. Local suitability still needs checking.',
        'Useful trees are not automatically edible. Confirm identity and safe use; a landscape photograph is not a food-identification guide.',
        'Locally appropriate indigenous plants can support habitat as part of the design.',
        'Choose for your ecosystem and the useful role of each plant. There is no sourced percentage target in this lesson.',
        'Protect existing natural vegetation. Do not turn healthy grassland into a food forest simply because trees are useful elsewhere.',
      ].join('\n\n'),
    ),
    keyPoints: [
      hold('Match each plant and variety to the actual site'),
      hold('Check identity, safe use and current local restrictions'),
      hold('A regional example is not approval for every species on its list'),
      hold('Use locally appropriate indigenous plants and protect existing natural habitat'),
    ],
    quiz: [
      {
        question: hold('A grower wants to plant a young mango where hard frost occurs. What risk needs attention?'),
        options: [
          hold('It thrives — the position offsets frost'),
          hold('It fruits early from the temperature swings'),
          hold("It's likely killed or badly damaged by frost, especially as a young tree"),
          hold('It survives with heavy mulch but needs annual replacement'),
        ],
        sourceCorrectIndex: 2,
        rationale: hold('Young mango can be damaged by frost. Check actual site conditions and reliable local guidance rather than assuming a sheltered spot removes the risk.'),
      },
      {
        question: hold('Why include locally appropriate indigenous plants in a design?'),
        options: [
          hold('They always yield more food per square metre'),
          hold('They can support local habitat, pollinators and other wildlife'),
          hold('Every introduced species is illegal'),
          hold('They never need establishment care'),
        ],
        sourceCorrectIndex: 1,
        rationale: hold('Choose plants for the local ecosystem and their role. This does not establish a universal percentage or remove the need to check suitability.'),
      },
    ],
  }],
};

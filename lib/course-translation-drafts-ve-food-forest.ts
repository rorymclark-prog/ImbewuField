/** Unreviewed, source-paired Tshivenda Food Forest L1–L3 learner drafts. */
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
        'Zwimela zwo fhambanaho zwi shumisa tshedza na u tsakama zwine zwa vha hone hune zwi aluwa hone.',
        'Ḓaka ḽa zwiḽiwa ḽi edzisa nḓila heyi nga zwimela zwi bveledzaho.',
        'Mvelelo a si tshiliṅwa tshithihi kha muduba muthihi, fhedzi ndi miṱaṱo minzhi i vhuyedzaho zwi tshi aluwa zwo ṱangana.',
        'Humbulani nga ha maṱavhi malapfu a nṱha a no fuka ḓaka, miri miṱuku, zwiṱaka na zwimela zwi si na thanda.',
        'Ground cover i tsireledza nṱha ha mavu, root crops dzi aluwa fhasi hayo, nahone climbers dzi shumisa zwitikhi zwo teaho u gonya.',
        'Vhulapfu na tshikhala tsha u ṱavha zwi bva kha zwimela na fhethu. Heyi ndi miṱaṱo ya u pulana, a si mielo ya vhulapfu yo tiwaho.',
        'The original Highveld example includes Wild Fig or pecan above lemon, naartjie and black mulberry.',
        'It places Cape gooseberry and Wild Medlar with vegetables, wild garlic, sweet potato and granadilla.',
        'Treat this as a layout example, not permission to plant every species. Check identity, frost tolerance, mature size and local restrictions first.',
        'Zwimela zwiṱuku zwi ṱoḓa ṱhogomelo musi zwi tshi thoma u ḓowela fhethu: sedzani u tsakama ha mavu, ni lange tsheṋe, ni zwi tsireledze kha u huvhala.',
        'Musi zwimela zwi tshi aluwa, murunzi na matoko a maṱari zwi shandula nyimele fhasi hazwo.',
        'Check competition and access. Prune, thin or adjust lower planting when observations call for it; the system does not become care-free on a fixed birthday.',
      ].join('\n\n'),
      reviewStatus: 'machine-draft',
    },
    keyPoints: [
      pair('Seven planning layers can combine useful plants at different heights', 'Miṱaṱo ya supa ya u pulana i nga ṱanganya zwimela zwi re na mushumo kha vhulapfu ho fhambanaho'),
      pair('Plants can compete for light, water and nutrients', 'Zwimela zwi nga ṱaṱisana nga ha tshedza, maḓi na pfushi.'),
      hold('Establishment and ongoing care depend on observed conditions'),
      pair('Confirm local suitability before copying any example planting', 'Khwaṱhisedzani uri zwimela zwo tea fhethu haṋu musi ni sa athu edzisa tsumbo ya u ṱavha.'),
    ],
    quiz: [
      {
        question: hold('Weeds are competing strongly with young lower-layer plants. What should guide the next action?'),
        options: [
          hold('Wait until the fifth year'),
          hold('Add more plants regardless of water'),
          pair('Check the affected plants and manage competition', 'Ṱolani zwimela zwo kwameaho nahone ni lange u ṱaṱisana hazwo.'),
          pair('Assume all seven layers take care of themselves', 'Humbulani uri miṱaṱo yoṱhe ya supa i a ḓiṱhogomela.'),
        ],
        sourceCorrectIndex: 2,
        rationale: pair('Observe actual competition and plant condition. A fixed establishment calendar cannot tell you which plants need care now.', 'Sedzani u ṱaṱisana hune ha khou itea na nyimele ya zwimela. Khalenda yo tiwaho ya u thoma u aluwa a i nga ni vhudzi uri ndi zwifhio zwimela zwi ṱoḓaho u ṱhogomelwa zwino.'),
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
    body: pair(
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
        'Zwimela zwa mupo (indigenous plants) zwi teaho fhethu zwi nga tikedza habitat sa tshipiḓa tsha design.',
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
  }, {
    id: 'food-forest-l3',
    infographicAlt: hold(
      'The same patch of ground at four stages, left to right: loose mulch being spread over cardboard on soil, then fast low pioneer plants, then young canopy trees with lower layers filling in, and finally a settled layered planting.',
    ),
    title: hold('Establishing a Food Forest: Observe and Adjust'),
    body: pair(
      [
        'Start by checking the site, water supply and care available. Protect exposed soil early.',
        'Temporary support plants may provide shelter and useful cut material where appropriate.',
        'Main trees and lower layers can be introduced as conditions allow. Ground cover need not wait until the end; avoid plants competing with young trees.',
        'Begin with an area you can water and maintain. Check existing vegetation before clearing.',
        'Where appropriate, plain cardboard under suitable mulch can suppress unwanted growth. Keep water able to enter the soil and leave trunks clear.',
        'Plan spacing from mature plant size. Prepare nursery plants for the next suitable planting opportunity.',
        'Watch how shade, roots and available water affect neighbouring plants.',
        'Comfrey and wild garlic appear in the original underplanting example; check their local suitability before use.',
        'Prune or thin support plants when needed, using methods suited to each species. Suitable clean cuttings can return as mulch. Do not wait for a fixed year if competition is already harming plants.',
        'Choose a planting opportunity when soil moisture and expected weather support establishment.',
        'Rain can help, but check the root zone and keep a backup watering plan. Avoid planting into waterlogged ground.',
        'Check young plants after planting. Harvest timing and outside inputs depend on the species, site and care; there is no guaranteed fifth-year result.',
      ].join('\n\n'),
      [
        'Start by checking the site, water supply and care available. Protect exposed soil early.',
        'Temporary support plants may provide shelter and useful cut material where appropriate.',
        'Main trees na lower layers zwi nga ḓiswa musi nyimele dzi tshi tendela. Ground cover need not wait until the end; avoid plants competing with young trees.',
        'Begin with an area you can water and maintain. Check existing vegetation before clearing.',
        'Where appropriate, plain cardboard under suitable mulch can suppress unwanted growth. Keep water able to enter the soil and leave trunks clear.',
        'Plan spacing from mature plant size. Prepare nursery plants for the next suitable planting opportunity.',
        'Watch how shade, roots and available water affect neighbouring plants.',
        'Comfrey and wild garlic appear in the original underplanting example; check their local suitability before use.',
        'Prune or thin support plants when needed, using methods suited to each species. Clean cuttings dzo teaho dzi nga dovha dza shumiswa sa mulch. Do not wait for a fixed year if competition is already harming plants.',
        'Choose a planting opportunity when soil moisture and expected weather support establishment.',
        'Rain can help, but check the root zone and keep a backup watering plan. Avoid planting into waterlogged ground.',
        'Check young plants after planting. Tshifhinga tsha harvest na outside inputs zwi bva kha species, fhethu na ndondolo; a hu na fifth-year result ine ya khwaṱhisedzwa.',
      ].join('\n\n'),
    ),
    keyPoints: [
      hold('Protect exposed soil early'),
      hold('Plan the sequence around conditions and available care'),
      hold('Check root-zone moisture even during the rainy season'),
      hold('Manage competition as it develops; harvest dates are not guaranteed'),
    ],
    quiz: [
      {
        question: hold('A farmer puts plain cardboard under suitable mulch where grass is growing. What can it help do?'),
        options: [
          hold('Creating a moisture barrier that blocks water from the soil'),
          hold('Block light and help suppress grass while it breaks down; check for regrowth'),
          hold("Providing a stable base so wood chips don't shift"),
          hold('Reflecting heat upward to warm the soil'),
        ],
        sourceCorrectIndex: 1,
        rationale: hold('Cardboard under suitable mulch can block light and reduce grass growth. Existing grass may regrow, so check the area. Keep water able to enter the soil and mulch clear of trunks.'),
      },
      {
        question: hold('When should a grower consider pruning or thinning temporary support plants?'),
        options: [
          hold('Only on a fixed anniversary'),
          hold('When observed competition requires it, using methods suited to the species'),
          hold('As soon as any leaf falls'),
          hold('Never, because support plants cannot compete'),
        ],
        sourceCorrectIndex: 1,
        rationale: hold('Temporary support plants can become competitors. Observe light, water and growth, then choose suitable management rather than relying on a fixed year.'),
      },
    ],
  }],
};

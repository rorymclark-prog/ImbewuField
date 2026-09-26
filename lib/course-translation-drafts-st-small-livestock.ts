/** Unreviewed, source-paired Sesotho Small Livestock L1 learner draft. */
import type { SesothoCourseModuleDraft, SesothoSourcePair } from './course-translation-drafts-st.ts';

const machineDraft = (sourceEnglish: string, sesothoDraft: string): SesothoSourcePair => ({
  sourceEnglish, sesothoDraft, reviewStatus: 'machine-draft',
});

const hold = (sourceEnglish: string): SesothoSourcePair => ({
  sourceEnglish, sesothoDraft: sourceEnglish, reviewStatus: 'hold',
});

export const SESOTHO_SMALL_LIVESTOCK_DRAFT: SesothoCourseModuleDraft = {
  id: 'small-livestock',
  language: 'st',
  reviewStatus: 'machine-draft',
  sourceMetadata: { durationMins: 20, category: 'foundation' },
  title: machineDraft('Small Livestock Integration', 'Kopanyo ya Diphoofolo tse Nyenyane'),
  description: machineDraft(
    'Chickens, ducks and bees as system components — not afterthoughts.',
    'Dikgogo, madada le dinotshe jwalo ka dikarolo tsa tsamaiso — e seng dintho tse hopolwang kamorao.',
  ),
  lessons: [{
    id: 'small-livestock-l1',
    infographicAlt: hold(
      'An illustration of a wheeled chicken pen shown in two positions along a strip of ground. An arrow points right; three chickens stand in the pen on the right, and a darker scratched patch lies between the two positions.',
    ),
    title: machineDraft(
      'Chickens in the System: Pest Control, Fertility, and Food',
      'Dikgogo Tsamaisong: Taolo ya Disenyi, Monono, le Dijo',
    ),
    // The first draft mistranslated garden bed as a sleeping bed and bedding as rubbish.
    // Keep those sentences and every animal-care and manure instruction in English.
    body: machineDraft(
      [
        'Chickens can help an empty bed after harvest. They scratch through plant remains and eat some insects and weed seeds. Their manure and bedding can be composted and returned to the soil. Foraging does not replace a balanced diet, clean water, shelter or daily care.',
        'A chicken tractor is a moveable, floorless pen. Move it before the ground becomes bare, muddy or heavily covered with manure. The right time depends on the birds, soil and weather. There is no single number of chickens that guarantees enough fertility for every plot.',
        'Keep chickens away from seedlings and crops being harvested for food. Fresh manure can carry germs. Ask an extension adviser how to manage manure safely before the next crop. Ducks scratch less, but can still damage plants and make wet ground muddy. Watch the birds and move them when needed.',
      ].join('\n\n'),
      [
        'Chickens can help an empty bed after harvest. Di fata hara masala a dimela mme di ja dikokonyana tse ding le dipeo tsa mefoka. Their manure and bedding can be composted and returned to the soil. Foraging does not replace a balanced diet, clean water, shelter or daily care.',
        'A chicken tractor is a moveable, floorless pen. Move it before the ground becomes bare, muddy or heavily covered with manure. The right time depends on the birds, soil and weather. There is no single number of chickens that guarantees enough fertility for every plot.',
        'Keep chickens away from seedlings and crops being harvested for food. Fresh manure can carry germs. Ask an extension adviser how to manage manure safely before the next crop. Ducks scratch less, but can still damage plants and make wet ground muddy. Watch the birds and move them when needed.',
      ].join('\n\n'),
    ),
    keyPoints: [
      hold('Move the pen before birds damage the ground or manure builds up'),
      hold('Match bird numbers and manure use to your soil, crops and feed supply'),
      hold('Only put chickens in a bed after harvest — never around young seedlings'),
      hold('Ducks scratch less, but still need supervision around plants and wet soil'),
    ],
    quiz: [
      {
        question: hold("You want chickens to prepare an empty bed for replanting. When's the right time to put them in?"),
        options: [
          hold('Right after planting seedlings, so they loosen soil around them'),
          hold('After harvest, once the bed is cleared, before the next planting'),
          hold('During the growing season once the canopy can withstand scratching'),
          hold('Only in winter to avoid heat stress'),
        ],
        sourceCorrectIndex: 1,
        rationale: hold('Use an empty bed after harvest. Keep fresh manure away from food crops and plan safe manure handling before replanting.'),
      },
      {
        question: hold('Why are ducks better suited than chickens to an established food forest understorey?'),
        options: [
          hold('Ducks produce more manure per day'),
          hold('Ducks eat slugs and snails without the heavy scratching that disturbs roots and mulch'),
          hold('Ducks are immune to Newcastle disease'),
          hold('Ducks roost in trees, reducing ground compaction'),
        ],
        sourceCorrectIndex: 1,
        rationale: hold('Ducks do not scratch like chickens. They can still trample or eat plants, so watch the ground and move them when needed.'),
      },
    ],
  }, {
    id: 'small-livestock-l2',
    infographicAlt: hold(
      'A beehive cut open showing the stacked frames inside, and a wide circle over a farm map showing how far the bees travel to forage.',
    ),
    title: machineDraft(
      'Bees: Pollination, Honey, and System Ecology',
      'Linotsi: Ho Tsamaisa Phofo ea Lipalesa, Mahe a Linotsi le Kamano ea Lintho Tlhahong',
    ),
    // Pollination, bee movement rules and hive care need fluent and local-practice review.
    body: machineDraft(
      "Honeybees and other insects carry pollen between flowers. This helps many fruit and vegetable crops, including avocado. Different crops and varieties have different pollination needs. A hive does not guarantee higher yields everywhere: weather, water, plant health and other pollinators also matter.\n\nSouth Africa has two native honeybee subspecies. The Cape honeybee is found in the Western Cape and parts of the Eastern Cape. The African honeybee is native to central and most of southern Africa. These broad natural ranges are not a guide for moving bees. The Department's control measures set a demarcation line for bee movement. Check current movement rules with the Department and an experienced local beekeeper before moving bees or hives.\n\nLearn from an experienced local beekeeper before getting a hive. Keep hives away from busy paths, homes and places where children play. Morning sun can help; a safe location comes first. Provide flowering plants through the seasons and avoid exposing bees to pesticides. Active bees do not prove that the farm is free of chemicals or disease. The national honey-bee control measures require registration for defined beekeeping activities, including managed hives for bee products, queen rearing, commercial pollination, and colony removal, eradication or relocation. Check with the Department if you are unsure whether the rules apply to your activity. If a colony swarms repeatedly, ask a trained beekeeper to inspect it. Crowding is one possible cause, not a diagnosis.",
      "Linotši le likokoanyana tse ling li jara phofshoana ea lipalesa pakeng tsa lipalesa. This helps many fruit and vegetable crops, including avocado. Different crops and varieties have different pollination needs. A hive does not guarantee higher yields everywhere: weather, water, plant health and other pollinators also matter.\n\nSouth Africa has two native honeybee subspecies. The Cape honeybee is found in the Western Cape and parts of the Eastern Cape. The African honeybee is native to central and most of southern Africa. These broad natural ranges are not a guide for moving bees. The Department's control measures set a demarcation line for bee movement. Check current movement rules with the Department and an experienced local beekeeper before moving bees or hives.\n\nLearn from an experienced local beekeeper before getting a hive. Keep hives away from busy paths, homes and places where children play. Morning sun can help; a safe location comes first. Provide flowering plants through the seasons and avoid exposing bees to pesticides. Active bees do not prove that the farm is free of chemicals or disease. The national honey-bee control measures require registration for defined beekeeping activities, including managed hives for bee products, queen rearing, commercial pollination, and colony removal, eradication or relocation. Check with the Department if you are unsure whether the rules apply to your activity. If a colony swarms repeatedly, ask a trained beekeeper to inspect it. Crowding is one possible cause, not a diagnosis.",
    ),
    keyPoints: [
      hold('Pollinators help many crops; the benefit depends on the crop and conditions'),
      hold('Learn safe hive care from an experienced local beekeeper'),
      hold('Choose a safe hive site away from busy paths and children'),
      hold('Register with the Department for activities covered by the national honey-bee control measures'),
    ],
    quiz: [
      {
        question: hold('Avocado trees flower but set little fruit. What should the farmer check about pollination?'),
        options: [
          hold('Assume pollination is always enough and check nothing'),
          hold('Assume only one type of beetle can carry pollen'),
          hold('Check whether insects are visiting flowers and carrying pollen; other causes of poor fruit set also need checking'),
          hold('Assume poor fruit set always means frost damage'),
        ],
        sourceCorrectIndex: 2,
        rationale: hold('Bees and other insects can move pollen between avocado flowers. Few visits can limit pollination, but weather and plant condition can also affect fruit set.'),
      },
      {
        question: hold('A hive has swarmed repeatedly. What is the best next step?'),
        options: [
          hold('Ask a trained beekeeper to inspect the colony, including space, queen and health'),
          hold('Replace the queen without inspecting the colony'),
          hold('Assume nothing can be checked or managed'),
          hold('Turn the hive around without finding the cause'),
        ],
        sourceCorrectIndex: 0,
        rationale: hold('Crowding can encourage swarming, but it is not the only cause. Inspection guides the response; adding space is not a guaranteed cure.'),
      },
    ],
  }],
};

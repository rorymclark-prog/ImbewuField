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
    'Dikgoho, matata le dinotshi jwalo ka dikarolo tsa tsamaiso — e seng dintho tse hopolwang kamorao.',
  ),
  lessons: [{
    id: 'small-livestock-l1',
    infographicAlt: hold(
      'An illustration of a wheeled chicken pen shown in two positions along a strip of ground. An arrow points right; three chickens stand in the pen on the right, and a darker scratched patch lies between the two positions.',
    ),
    title: machineDraft(
      'Chickens in the System: Pest Control, Fertility, and Food',
      'Dikgoho Tsamaisong: Taolo ya Disenyi, Monono, le Dijo',
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
  }],
};

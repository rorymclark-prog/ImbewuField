/** Unreviewed, source-paired Xitsonga concept sentences for Small Livestock L2. */
import type { XitsongaCourseModuleDraft, XitsongaSourcePair } from './course-translation-drafts-ts.ts';

const pair = (sourceEnglish: string, xitsongaDraft: string, reviewStatus: XitsongaSourcePair['reviewStatus'] = 'machine-draft'): XitsongaSourcePair => ({
  sourceEnglish,
  xitsongaDraft,
  reviewStatus,
});

const hold = (sourceEnglish: string): XitsongaSourcePair => pair(sourceEnglish, sourceEnglish, 'hold');

const sourceBody = 'Honeybees and other insects carry pollen between flowers. This helps many fruit and vegetable crops, including avocado. Different crops and varieties have different pollination needs. A hive does not guarantee higher yields everywhere: weather, water, plant health and other pollinators also matter.\n\nSouth Africa has two native honeybee subspecies. The Cape honeybee is found in the Western Cape and parts of the Eastern Cape. The African honeybee is native to central and most of southern Africa. These broad natural ranges are not a guide for moving bees. The Department\'s control measures set a demarcation line for bee movement. Check current movement rules with the Department and an experienced local beekeeper before moving bees or hives.\n\nLearn from an experienced local beekeeper before getting a hive. Keep hives away from busy paths, homes and places where children play. Morning sun can help; a safe location comes first. Provide flowering plants through the seasons and avoid exposing bees to pesticides. Active bees do not prove that the farm is free of chemicals or disease. The national honey-bee control measures require registration for defined beekeeping activities, including managed hives for bee products, queen rearing, commercial pollination, and colony removal, eradication or relocation. Check with the Department if you are unsure whether the rules apply to your activity. If a colony swarms repeatedly, ask a trained beekeeper to inspect it. Crowding is one possible cause, not a diagnosis.';
const sourceParagraphs = sourceBody.split('\n\n');
const draftParagraphs = [...sourceParagraphs];
draftParagraphs[0] = 'Honeybees and other insects carry pollen between flowers. This helps many fruit and vegetable crops, including avocado. Swimilani swo hambana na ti-variety to hambana swi na swilaveko swo hambana swa pollination. Hive a yi tiyisisi leswaku yields ti ta va ta le henhla hinkwako: weather, mati, rihanyu ra swimilani na pollinators tin\'wana na tona i swa nkoka.';

export const XITSONGA_SMALL_LIVESTOCK_DRAFT: XitsongaCourseModuleDraft = {
  id: 'small-livestock',
  language: 'ts',
  reviewStatus: 'machine-draft',
  sourceMetadata: { durationMins: 20, category: 'foundation' },
  title: hold('Small Livestock Integration'),
  description: hold('Chickens, ducks and bees as system components — not afterthoughts.'),
  lessons: [
    {
      id: 'small-livestock-l2',
      infographicAlt: hold('A beehive cut open showing the stacked frames inside, and a wide circle over a farm map showing how far the bees travel to forage.'),
      title: hold('Bees: Pollination, Honey, and System Ecology'),
      body: pair(sourceBody, draftParagraphs.join('\n\n')),
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
    },
  ],
  holds: [
    { lessonId: 'small-livestock-l2', field: 'body[0].sentences[0-1]', sourceText: 'Honeybees and other insects carry pollen between flowers. This helps many fruit and vegetable crops, including avocado.', reason: 'Pollination concept text not independently drafted for this batch; retain exact English.' },
    { lessonId: 'small-livestock-l2', field: 'body[1]', sourceText: sourceParagraphs[1], reason: 'Bee species, geographic ranges, movement restrictions, and local Department/beekeeper advice remain exact English.' },
    { lessonId: 'small-livestock-l2', field: 'body[2]', sourceText: sourceParagraphs[2], reason: 'Hive handling, site safety, pesticide and disease claims, registration and swarm diagnosis remain exact English.' },
    { lessonId: 'small-livestock-l2', field: 'infographicAlt', sourceText: 'A beehive cut open showing the stacked frames inside, and a wide circle over a farm map showing how far the bees travel to forage.', reason: 'The visual includes a foraging-distance concept; retain exact English.' },
  ],
};

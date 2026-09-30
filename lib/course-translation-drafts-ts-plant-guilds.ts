/** Unreviewed, source-paired Xitsonga concept sentences for Plant Guilds L2–L3. */
import type { XitsongaCourseModuleDraft, XitsongaSourcePair } from './course-translation-drafts-ts.ts';

const pair = (sourceEnglish: string, xitsongaDraft: string, reviewStatus: XitsongaSourcePair['reviewStatus'] = 'machine-draft'): XitsongaSourcePair => ({
  sourceEnglish,
  xitsongaDraft,
  reviewStatus,
});

const hold = (sourceEnglish: string): XitsongaSourcePair => pair(sourceEnglish, sourceEnglish, 'hold');

const bodyPair = (paragraphs: string[], translatedParagraphs: Record<number, string>): XitsongaSourcePair => pair(
  paragraphs.join('\n\n'),
  paragraphs.map((source, index) => translatedParagraphs[index] ?? source).join('\n\n'),
);

const mulchParagraph = 'Mulch protects the surface, helps conserve moisture and returns organic material.';
const guildFunctionsParagraph = 'Combine the support functions your site needs: nitrogen fixation, food, mulch, flowers and ground cover. Some plants serve several functions.';

export const XITSONGA_PLANT_GUILDS_DRAFT: XitsongaCourseModuleDraft = {
  id: 'plant-guilds',
  language: 'ts',
  reviewStatus: 'machine-draft',
  sourceMetadata: { durationMins: 20, category: 'plants' },
  title: hold('Plant Selection & Guilds'),
  description: hold('Choose useful plant partners, return mulch and manage the guild as trees grow.'),
  lessons: [
    {
      id: 'plant-guilds-l2',
      infographicAlt: hold('Conceptual guild teaching illustration; confirm plant identity with reliable botanical guidance.'),
      title: hold('Mulch Plants and Helpful Insects'),
      body: bodyPair([
        'The clip shows a branch cut: the support tree remains standing. Leave enough healthy foliage for the plant to recover.',
        'Match cutting to the species. Avoid frequent severe cuts on pigeon pea, especially when growing it for peas.',
        mulchParagraph,
        'Leave access for watering and inspection. Cut material into manageable pieces and keep observing moisture and decomposition.',
        'Obtain the correct cultivar. Bocking 14 does not spread by viable seed, but root pieces can regrow.',
        'Place it where it has room and sufficient moisture. Cut leaves as it recovers; do not crowd the young fruit tree.',
        'Many ladybirds eat aphids; some parasitoid wasps attack crop pests. Flowering members such as African basil can add resources.',
        'Watch which insects visit and whether damage changes. A flowering plant does not guarantee pest control.',
        'Tulbaghia violacea has narrow leaves and lilac flowers. Place a clump where it has light and room to grow.',
        'Observe visiting insects. Do not promise that a ring of wild garlic will repel pests or cure an outbreak.',
      ], {
        2: 'Mulch yi sirhelela misava ya le henhla, yi pfuna ku hlayisa ku tsakama naswona yi vuyisela organic material.',
      }),
      keyPoints: [
        hold('Pruning cuts branches while keeping the support plant.'),
        hold('Return suitable cut leaves as mulch while keeping the trunk clear.'),
        hold('Bocking 14 does not spread by viable seed, but root pieces can regrow.'),
        hold('Flowering plants can support useful insects; watch actual visits and crop damage.'),
      ],
      quiz: [
        {
          question: hold('What does the branch-cutting clip show?'),
          options: [
            hold('Removing the whole support tree'),
            hold('Pruning a retained support tree for light and mulch'),
            hold('Harvesting the fruit tree'),
            hold('Proof that root competition has stopped'),
          ],
          sourceCorrectIndex: 1,
          rationale: hold('A branch falls, while the support tree remains standing. That is pruning and chop-and-drop.'),
        },
        {
          question: hold('How should you assess flowering plants used to support helpful insects?'),
          options: [
            hold('Assume they will eliminate pests'),
            hold('Observe insect visitors and changes in crop damage'),
            hold('Remove all flowers before they open'),
            hold('Count every flowering plant as a nitrogen fixer'),
          ],
          sourceCorrectIndex: 1,
          rationale: hold('Flowers can supply resources, but their presence does not guarantee pest control.'),
        },
      ],
    },
    {
      id: 'plant-guilds-l3',
      infographicAlt: hold('Conceptual guild teaching illustration; confirm plant identity with reliable botanical guidance.'),
      title: hold('Build a Guild and Adjust It as It Grows'),
      body: bodyPair([
        guildFunctionsParagraph,
        'Keep the trunk area and path open. Reassess each member as the mango and its neighbours grow.',
        'Keep its vines away from the young fruit tree and retain a route for care. Its roots also use water and nutrients.',
        'Where resources are tight, compare living cover with an ordinary mulch basin.',
        'Plant into a suitable season, mulch and maintain establishment water. Keep the access gap open.',
        'Start with the number of support plants you can care for. Observe survival and growth before adding more.',
        'Cut down selected competing supports to open space. Suitable cut material can stay as mulch: this is thinning through chop-and-drop.',
        'Manage regrowth to keep the opening. Check light, soil moisture and growth; thinning does not instantly stop root competition.',
        'Carry useful prunings back to established trees. Keep nearby plants only where they still perform well.',
        'Mature fruit trees still need nutrients. Monitor growth, harvest and soil conditions; support plants do not remove that need.',
        'Check fruit-tree growth, shade, soil moisture, useful harvests and pest damage. Note what was cut, returned or removed.',
        'Use these observations to change the layout and care. A plant earns its place through what it does here.',
      ], {
        0: 'Combine the support functions your site needs: nitrogen fixation, food, mulch, flowers and ground cover. Swimilana swin\'wana swi tirha mintirho yo hlayanyana.',
        1: 'Siyisani ndhawu leyi rhendzeleke nsinya ni ndlela swi pfulekile. Tlhela u kambisisa ximilana xin\'wana ni xin\'wana loko mango ni swimilana leswi nga ekusuhi swi ri karhi swi kula.',
        5: 'Sungula hi nhlayo ya swimilana leswi pfunaka leyi u nga kotaka ku yi khathalela. Languta leswaku swa hanya ni ku kula ku fikela kwihi u nga si engetela swin\'wana.',
        8: 'Tlherisela swilo leswi tsemiweke leswi nga tirhisiwaka eminsinyeni leyi se yi dzimeke kahle. Hlayisa swimilana swa le kusuhi ntsena laha swa ha tirhaka kahle.',
        11: 'Tirhisa leswi u swi voneke ku cinca ndlela leyi swimilana swi vekiwaka ha yona ni ndlela leyi u swi khathalelaka ha yona. Ximilana xi fanele ku sala laha ntsena loko xi pfuna eka ndhawu leyi.',
      }),
      keyPoints: [
        hold("Give each plant a useful role while protecting the fruit tree's space."),
        hold('Living ground cover also competes for water and nutrients.'),
        hold('Thin selected whole support plants when pruning no longer gives enough room.'),
        hold('Suitable cut biomass can stay as mulch; manage regrowth to retain the opening.'),
      ],
      quiz: [
        {
          question: hold('A support plant still crowds the mango after pruning. What can thinning involve?'),
          options: [
            hold('Only cutting another small twig'),
            hold('Cutting down a selected competing support and managing regrowth'),
            hold('Removing the mango instead'),
            hold('Always carrying all cut biomass off the site'),
          ],
          sourceCorrectIndex: 1,
          rationale: hold('Thinning reduces selected standing support plants. Suitable cut material may stay as mulch.'),
        },
        {
          question: hold('Is sweet potato always better than a mulch basin around a young fruit tree?'),
          options: [
            hold('Yes, because it never uses water'),
            hold('Yes, because it fixes nitrogen'),
            hold('No; compare its food and cover benefits with competition for resources'),
            hold('No, because no ground cover can ever be useful'),
          ],
          sourceCorrectIndex: 2,
          rationale: hold('Choose cover for the site. Keep access and the trunk area clear, and observe the young tree.'),
        },
      ],
    },
  ],
  holds: [
    { lessonId: 'plant-guilds-l2', field: 'body[0]', sourceText: 'The clip shows a branch cut: the support tree remains standing. Leave enough healthy foliage for the plant to recover.', reason: 'Pruning method and recovery advice stay exact English.' },
    { lessonId: 'plant-guilds-l2', field: 'body[4]', sourceText: 'Obtain the correct cultivar. Bocking 14 does not spread by viable seed, but root pieces can regrow.', reason: 'Cultivar identity and propagation behaviour stay exact English.' },
    { lessonId: 'plant-guilds-l2', field: 'body[6]', sourceText: 'Many ladybirds eat aphids; some parasitoid wasps attack crop pests. Flowering members such as African basil can add resources.', reason: 'Species and biological pest-control claims stay exact English.' },
    { lessonId: 'plant-guilds-l2', field: 'body[7]', sourceText: 'Watch which insects visit and whether damage changes. A flowering plant does not guarantee pest control.', reason: 'Pest-control uncertainty stays exact English.' },
    { lessonId: 'plant-guilds-l2', field: 'body[8]', sourceText: 'Tulbaghia violacea has narrow leaves and lilac flowers. Place a clump where it has light and room to grow.', reason: 'Named-species description and placement instruction stay exact English.' },
    { lessonId: 'plant-guilds-l3', field: 'body[4]', sourceText: 'Plant into a suitable season, mulch and maintain establishment water. Keep the access gap open.', reason: 'Season, watering and access instructions stay exact English.' },
    { lessonId: 'plant-guilds-l3', field: 'body[7]', sourceText: 'Manage regrowth to keep the opening. Check light, soil moisture and growth; thinning does not instantly stop root competition.', reason: 'Management instruction and its uncertainty stay exact English.' },
    { lessonId: 'plant-guilds-l3', field: 'body[9]', sourceText: 'Mature fruit trees still need nutrients. Monitor growth, harvest and soil conditions; support plants do not remove that need.', reason: 'Ongoing monitoring and nutrient advice stay exact English.' },
  ],
};

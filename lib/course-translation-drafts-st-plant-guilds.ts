/** Unpublished, source-paired Sesotho machine draft; data only, not wired into learner Study. */
import type { SesothoCourseModuleDraft, SesothoDraftReviewStatus } from './course-translation-drafts-st.ts';

const pair = (sourceEnglish: string, sesothoDraft: string, reviewStatus: SesothoDraftReviewStatus = 'machine-draft') => ({ sourceEnglish, sesothoDraft, reviewStatus });

export const SESOTHO_PLANT_GUILDS_DRAFT: SesothoCourseModuleDraft = {
  id: 'plant-guilds',
  language: 'st',
  reviewStatus: 'machine-draft',
  sourceMetadata: { durationMins: 20, category: "plants" },
  title: pair("Plant Selection & Guilds", "Kgetho ya dimela le dihlopha tsa dimela (guilds)", 'machine-draft'),
  description: pair("Choose useful plant partners, return mulch and manage the guild as trees grow.", "Kgetha dimela tse thusanang, kgutlisetsa mulch mobung, mme o laole guild ha difate di ntse di hola.", 'machine-draft'),
  lessons: [
    {
      id: "plant-guilds-l1",
      title: pair("Nitrogen Fixers: Choose and Manage Support Plants", "Dimela tse lokisang naetrojene (nitrogen): kgetha le ho laola dimela tsa tshehetso", 'machine-draft'),
      body: pair("These bacteria convert nitrogen from the air into forms the legume can use.\n\nFind nodules on a spare legume plant. Nodulation and growth depend on the plant, suitable bacteria and growing conditions.\n\nReturn suitable leafy prunings, fallen leaves and crop residues as mulch. Soil organisms release nutrients during decomposition.\n\nThis takes time. A living legume is not an instant fertiliser pipe into the fruit tree.\n\nIt is indigenous to KwaZulu-Natal. In suitable warm conditions, manage this short-lived shrub or small tree as a support plant.\n\nAllow room for its growth. Prune for mulch and reassess it when shade or water competition increases.\n\nSesbania punicea is the invasive red sesbania. Its pods have four lengthwise wings. Confirm identity using reliable botanical guidance.\n\nCheck the full name before planting. Respect the agreed project species list, including any restriction on Sesbania sesban.\n\nUse a sunny, freely draining position. It is a short-lived support shrub; frost and waterlogging can limit it.\n\nDecide whether each plant mainly supplies peas or leafy material. Frequent severe cutting can damage it and reduce the food harvest.\n\nCowpea covers sunny gaps. Pigeon pea provides food and leafy material. Managed Sesbania sesban can supply taller temporary support.\n\nAdd suitable flowering and mulch plants. Keep the mango trunk clear and manage light, water and access.\n\nCount woody supports across the spaces between fruit trees. Sow suitable ground cover by area.\n\nThere is no universal number per fruit tree. Adjust density to water, soil, plant size and your ability to prune and thin.", "These bacteria convert nitrogen from the air into forms the legume can use.\n\nFind nodules on a spare legume plant. Nodulation and growth depend on the plant, suitable bacteria and growing conditions.\n\nReturn suitable leafy prunings, fallen leaves and crop residues as mulch. Soil organisms release nutrients during decomposition.\n\nThis takes time. A living legume is not an instant fertiliser pipe into the fruit tree.\n\nIt is indigenous to KwaZulu-Natal. In suitable warm conditions, manage this short-lived shrub or small tree as a support plant.\n\nAllow room for its growth. Prune for mulch and reassess it when shade or water competition increases.\n\nSesbania punicea is the invasive red sesbania. Its pods have four lengthwise wings. Confirm identity using reliable botanical guidance.\n\nCheck the full name before planting. Respect the agreed project species list, including any restriction on Sesbania sesban.\n\nUse a sunny, freely draining position. It is a short-lived support shrub; frost and waterlogging can limit it.\n\nDecide whether each plant mainly supplies peas or leafy material. Frequent severe cutting can damage it and reduce the food harvest.\n\nCowpea covers sunny gaps. Pigeon pea provides food and leafy material. Managed Sesbania sesban can supply taller temporary support.\n\nAdd suitable flowering and mulch plants. Keep the mango trunk clear and manage light, water and access.\n\nCount woody supports across the spaces between fruit trees. Sow suitable ground cover by area.\n\nThere is no universal number per fruit tree. Adjust density to water, soil, plant size and your ability to prune and thin.", 'hold'),
      infographicAlt: pair("Conceptual guild teaching illustration; confirm plant identity with reliable botanical guidance.", "Conceptual guild teaching illustration; confirm plant identity with reliable botanical guidance.", 'hold'),
      keyPoints: [
        pair("Legumes work with rhizobia in root nodules; fixation depends on suitable conditions.", "Dimela tsa dinawa (legumes) di sebetsa le rhizobia ka mafito a metso (root nodules); ho lokisa naetrojene ho itshetlehile ka maemo a loketseng.", 'machine-draft'),
        pair("Return useful cut material to the soil; nutrient release takes time.", "Return useful cut material to the soil; nutrient release takes time.", 'hold'),
        pair("Use suitable seasonal cover, support shrubs and temporary trees.", "Use suitable seasonal cover, support shrubs and temporary trees.", 'hold'),
        pair("Manage support density as plants grow; there is no universal count per fruit tree.", "Manage support density as plants grow; there is no universal count per fruit tree.", 'hold'),
      ],
      quiz: [
        {
          question: pair("When does nitrogen in cut legume material become available to other plants?", "Naetrojene e ka fumaneha neng ho dimela tse ding ka mora hore thepa ya semela sa dinawa e pomilweng e kgutlisetswe mobung?", 'machine-draft'),
          options: [
            pair("Immediately when it is cut", "Hang-hang ha e sehilwe", 'machine-draft'),
            pair("As soil organisms decompose the material", "Ha diphedi tsa mobu di bodisa thepa eo", 'machine-draft'),
            pair("Only when the fruit tree touches the legume", "Feela ha sefate sa tholwana se ama semela sa dinawa", 'machine-draft'),
            pair("It can never become available", "E ke ke ya fumaneha le ka mohla", 'machine-draft'),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Decomposition releases nutrients over time. The rate depends on the material and growing conditions.", "Decomposition releases nutrients over time. The rate depends on the material and growing conditions.", 'hold'),
        },
        {
          question: pair("What should decide how many support plants you establish?", "Ke eng e lokelang ho etsa qeto ya hore na o theha dimela tse kae tsa tshehetso?", 'machine-draft'),
          options: [
            pair("The same fixed number at every site", "Palo e tshwanang sebakeng se seng le se seng", 'machine-draft'),
            pair("Water, soil, plant size and the care you can provide", "Metsi, mobu, boholo ba semela le tlhokomelo eo o ka fanang ka yona", 'machine-draft'),
            pair("Always placing every support uphill", "Kamehla beha semela se seng le se seng ka lehlakoreng la thaba (uphill)", 'machine-draft'),
            pair("Planting as many trees as will physically fit", "Jala difate tse ngata kamoo sebaka se ka di amohelang ka teng", 'machine-draft'),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Support plants need resources and management too. Observe growth and competition, then adjust.", "Support plants need resources and management too. Observe growth and competition, then adjust.", 'hold'),
        },
      ],
    },
    {
      id: "plant-guilds-l2",
      title: pair("Mulch Plants and Helpful Insects", "Dimela tsa mulch le dikokonyana tse thusang", 'machine-draft'),
      body: pair("The clip shows a branch cut: the support tree remains standing. Leave enough healthy foliage for the plant to recover.\n\nMatch cutting to the species. Avoid frequent severe cuts on pigeon pea, especially when growing it for peas.\n\nMulch protects the surface, helps conserve moisture and returns organic material.\n\nLeave access for watering and inspection. Cut material into manageable pieces and keep observing moisture and decomposition.\n\nObtain the correct cultivar. Bocking 14 does not spread by viable seed, but root pieces can regrow.\n\nPlace it where it has room and sufficient moisture. Cut leaves as it recovers; do not crowd the young fruit tree.\n\nMany ladybirds eat aphids; some parasitoid wasps attack crop pests. Flowering members such as African basil can add resources.\n\nWatch which insects visit and whether damage changes. A flowering plant does not guarantee pest control.\n\nTulbaghia violacea has narrow leaves and lilac flowers. Place a clump where it has light and room to grow.\n\nObserve visiting insects. Do not promise that a ring of wild garlic will repel pests or cure an outbreak.", "The clip shows a branch cut: the support tree remains standing. Leave enough healthy foliage for the plant to recover.\n\nMatch cutting to the species. Avoid frequent severe cuts on pigeon pea, especially when growing it for peas.\n\nMulch protects the surface, helps conserve moisture and returns organic material.\n\nLeave access for watering and inspection. Cut material into manageable pieces and keep observing moisture and decomposition.\n\nObtain the correct cultivar. Bocking 14 does not spread by viable seed, but root pieces can regrow.\n\nPlace it where it has room and sufficient moisture. Cut leaves as it recovers; do not crowd the young fruit tree.\n\nMany ladybirds eat aphids; some parasitoid wasps attack crop pests. Flowering members such as African basil can add resources.\n\nWatch which insects visit and whether damage changes. A flowering plant does not guarantee pest control.\n\nTulbaghia violacea has narrow leaves and lilac flowers. Place a clump where it has light and room to grow.\n\nObserve visiting insects. Do not promise that a ring of wild garlic will repel pests or cure an outbreak.", 'hold'),
      infographicAlt: pair("Conceptual guild teaching illustration; confirm plant identity with reliable botanical guidance.", "Conceptual guild teaching illustration; confirm plant identity with reliable botanical guidance.", 'hold'),
      keyPoints: [
        pair("Pruning cuts branches while keeping the support plant.", "Pruning cuts branches while keeping the support plant.", 'hold'),
        pair("Return suitable cut leaves as mulch while keeping the trunk clear.", "Return suitable cut leaves as mulch while keeping the trunk clear.", 'hold'),
        pair("Bocking 14 does not spread by viable seed, but root pieces can regrow.", "Bocking 14 does not spread by viable seed, but root pieces can regrow.", 'hold'),
        pair("Flowering plants can support useful insects; watch actual visits and crop damage.", "Flowering plants can support useful insects; watch actual visits and crop damage.", 'hold'),
      ],
      quiz: [
        {
          question: pair("What does the branch-cutting clip show?", "Video ya ho seha lekala e bontsha eng?", 'machine-draft'),
          options: [
            pair("Removing the whole support tree", "Ho tlosa sefate sohle sa tshehetso", 'machine-draft'),
            pair("Pruning a retained support tree for light and mulch", "Pruning a retained support tree for light and mulch", 'hold'),
            pair("Harvesting the fruit tree", "Ho kotula sefate sa ditholwana", 'machine-draft'),
            pair("Proof that root competition has stopped", "Bopaki ba hore tlhodisano ya motso e emisitse", 'machine-draft'),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("A branch falls, while the support tree remains standing. That is pruning and chop-and-drop.", "A branch falls, while the support tree remains standing. That is pruning and chop-and-drop.", 'hold'),
        },
        {
          question: pair("How should you assess flowering plants used to support helpful insects?", "O ka lekola jwang dimela tse thunyang tse sebediswang ho thusa dikokonyana tse molemo?", 'machine-draft'),
          options: [
            pair("Assume they will eliminate pests", "Nka hore di tla fedisa dikokonyana tse senyang dijalo", 'machine-draft'),
            pair("Observe insect visitors and changes in crop damage", "Observe insect visitors and changes in crop damage", 'hold'),
            pair("Remove all flowers before they open", "Tlosa dithunya tsohle pele di buleha", 'machine-draft'),
            pair("Count every flowering plant as a nitrogen fixer", "Bala semela se seng le se seng se thunyang e le semela se lokisang naetrojene (nitrogen fixer)", 'machine-draft'),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Flowers can supply resources, but their presence does not guarantee pest control.", "Dithunya di ka fana ka mehlodi, empa ho ba teng ha tsona ha ho tiise hore dikokonyana tse senyang di a laoleha.", 'machine-draft'),
        },
      ],
    },
    {
      id: "plant-guilds-l3",
      title: pair("Build a Guild and Adjust It as It Grows", "Haha sehlopha sa dimela (guild), mme o se fetole ha se ntse se hola", 'machine-draft'),
      body: pair("Combine the support functions your site needs: nitrogen fixation, food, mulch, flowers and ground cover. Some plants serve several functions.\n\nKeep the trunk area and path open. Reassess each member as the mango and its neighbours grow.\n\nKeep its vines away from the young fruit tree and retain a route for care. Its roots also use water and nutrients.\n\nWhere resources are tight, compare living cover with an ordinary mulch basin.\n\nPlant into a suitable season, mulch and maintain establishment water. Keep the access gap open.\n\nStart with the number of support plants you can care for. Observe survival and growth before adding more.\n\nCut down selected competing supports to open space. Suitable cut material can stay as mulch: this is thinning through chop-and-drop.\n\nManage regrowth to keep the opening. Check light, soil moisture and growth; thinning does not instantly stop root competition.\n\nCarry useful prunings back to established trees. Keep nearby plants only where they still perform well.\n\nMature fruit trees still need nutrients. Monitor growth, harvest and soil conditions; support plants do not remove that need.\n\nCheck fruit-tree growth, shade, soil moisture, useful harvests and pest damage. Note what was cut, returned or removed.\n\nUse these observations to change the layout and care. A plant earns its place through what it does here.", "Combine the support functions your site needs: nitrogen fixation, food, mulch, flowers and ground cover. Some plants serve several functions.\n\nKeep the trunk area and path open. Reassess each member as the mango and its neighbours grow.\n\nKeep its vines away from the young fruit tree and retain a route for care. Its roots also use water and nutrients.\n\nWhere resources are tight, compare living cover with an ordinary mulch basin.\n\nPlant into a suitable season, mulch and maintain establishment water. Keep the access gap open.\n\nStart with the number of support plants you can care for. Observe survival and growth before adding more.\n\nCut down selected competing supports to open space. Suitable cut material can stay as mulch: this is thinning through chop-and-drop.\n\nManage regrowth to keep the opening. Check light, soil moisture and growth; thinning does not instantly stop root competition.\n\nCarry useful prunings back to established trees. Keep nearby plants only where they still perform well.\n\nMature fruit trees still need nutrients. Monitor growth, harvest and soil conditions; support plants do not remove that need.\n\nCheck fruit-tree growth, shade, soil moisture, useful harvests and pest damage. Note what was cut, returned or removed.\n\nUse these observations to change the layout and care. A plant earns its place through what it does here.", 'hold'),
      infographicAlt: pair("Conceptual guild teaching illustration; confirm plant identity with reliable botanical guidance.", "Conceptual guild teaching illustration; confirm plant identity with reliable botanical guidance.", 'hold'),
      keyPoints: [
        pair("Give each plant a useful role while protecting the fruit tree's space.", "Give each plant a useful role while protecting the fruit tree's space.", 'hold'),
        pair("Living ground cover also competes for water and nutrients.", "Living ground cover also competes for water and nutrients.", 'hold'),
        pair("Thin selected whole support plants when pruning no longer gives enough room.", "Thin selected whole support plants when pruning no longer gives enough room.", 'hold'),
        pair("Suitable cut biomass can stay as mulch; manage regrowth to retain the opening.", "Suitable cut biomass can stay as mulch; manage regrowth to retain the opening.", 'hold'),
      ],
      quiz: [
        {
          question: pair("A support plant still crowds the mango after pruning. What can thinning involve?", "Semela sa tshehetso se ntse se pitlaganya mango ka mora ho poma. Ho fokotsa (thinning) ho ka akarelletsa eng?", 'machine-draft'),
          options: [
            pair("Only cutting another small twig", "Ho seha lekala le lenyane feela", 'machine-draft'),
            pair("Cutting down a selected competing support and managing regrowth", "Cutting down a selected competing support and managing regrowth", 'hold'),
            pair("Removing the mango instead", "Ho tlosa mango", 'machine-draft'),
            pair("Always carrying all cut biomass off the site", "Kamehla tlosa masalla ohle a pomilweng setsheng", 'machine-draft'),
          ],
          sourceCorrectIndex: 1,
          rationale: pair("Thinning reduces selected standing support plants. Suitable cut material may stay as mulch.", "Thinning reduces selected standing support plants. Suitable cut material may stay as mulch.", 'hold'),
        },
        {
          question: pair("Is sweet potato always better than a mulch basin around a young fruit tree?", "Na sweet potato e dula e le molemo ho feta basin ya mulch ho potoloha sefate se senyane sa ditholwana?", 'machine-draft'),
          options: [
            pair("Yes, because it never uses water", "E, hobane ha e sebedise metsi", 'machine-draft'),
            pair("Yes, because it fixes nitrogen", "E, hobane e lokisa naetrojene", 'machine-draft'),
            pair("No; compare its food and cover benefits with competition for resources", "Tjhe; bapisa molemo wa yona wa dijo le wa ho kwahela mobu le tlhodisano bakeng sa mehlodi", 'machine-draft'),
            pair("No, because no ground cover can ever be useful", "Tjhe, hobane ha ho semela se kwahelang mobu se ka bang molemo", 'machine-draft'),
          ],
          sourceCorrectIndex: 2,
          rationale: pair("Choose cover for the site. Keep access and the trunk area clear, and observe the young tree.", "Choose cover for the site. Keep access and the trunk area clear, and observe the young tree.", 'hold'),
        },
      ],
    },
  ],
};

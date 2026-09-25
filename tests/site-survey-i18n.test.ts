// Regression test for a confirmed audit finding: components/SiteSurveySheet.tsx — the Site
// Survey questionnaire — was ENTIRELY unlocalized. Zero t() calls; every visible string (step
// titles, question labels/descriptions, free-text placeholders, header text, footer buttons) was
// a raw English literal, no matter which of the eleven languages the farmer had selected.
//
// The fix has two distinct shapes, mirrored from tests/farmer-i18n-gaps.test.ts:
//  1. REWIRED_EXISTING_KEYS — a large block of keys (~144) already sat in lib/i18n.tsx, already
//     fully translated in all eleven locales, but were never referenced by any t() call anywhere
//     in the codebase. Wiring SiteSurveySheet.tsx up to them unlocks real, already-written
//     translations for free.
//  2. NEW_SITE_SURVEY_KEYS — keys that began English-only. IsiZulu is now an explicitly marked
//     draft on the survey route; the other ten locale blocks keep their English fallback until
//     their own translation is prepared and reviewed.
//
// Run with:
//   node --import ./tests/register-alias.mjs --test tests/site-survey-i18n.test.ts

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const i18nSource = readFileSync(new URL('../lib/i18n.tsx', import.meta.url), 'utf8');
const surveySource = readFileSync(new URL('../components/SiteSurveySheet.tsx', import.meta.url), 'utf8');

// lib/i18n.tsx used to hold all eleven language dictionaries inline as one ~420KB module,
// shipped in full on every page load. It's since been split for bundle size: English (the
// only locale ever loaded eagerly) stays inline as T_en in lib/i18n.tsx, and the other ten
// locales live one-per-file under lib/locales/, lazy-loaded on demand. localeBlocks() below
// reassembles the same { locale, block } shape the original single-file regex produced, so
// the assertions after it read the same either way.
const OTHER_LOCALES = ['af', 'zu', 'xh', 'nso', 'tn', 'st', 'ts', 've', 'ss', 'nr'] as const;

function localeBlocks(): Array<{ locale: string; block: string }> {
  const enStart = i18nSource.indexOf('const T_en: Dict = {');
  const enEnd = i18nSource.indexOf('\n};', enStart);
  return [
    { locale: 'en', block: i18nSource.slice(enStart, enEnd) },
    ...OTHER_LOCALES.map((locale) => ({
      locale,
      block: readFileSync(new URL(`../lib/locales/${locale}.ts`, import.meta.url), 'utf8'),
    })),
  ];
}

// These keys were English-only when the survey launched. The current isiZulu work is explicitly
// a review draft, so it must be present only in ZU and carry a persistent notice in the survey.
// Other locales remain on their English fallback until their own reviewed translation exists.
const NEW_SITE_SURVEY_KEYS = [
  'surveyZuluDraftNotice',
  'surveySaveContinue',
  'surveyStepHouseholdInfo',
  'surveyStepLandLocation',
  'surveyStepCurrentProduction',
  'surveyStepLivestockPoultry',
  'surveyStepIncomeSales',
  'surveyStepResourcesInputs',
  'surveyCloseAriaLabel',
  'surveyDiscardConfirm',
  'surveyAdultsChip1',
  'surveyAdultsChipRange2to5',
  'surveyAdultsChipRange6to10',
  'surveyAdultsChipRange10Plus',
  'surveyAutoFillNote',
  'surveyEfficiencySuffix',
  'surveyNumInputDefaultPlaceholder',
  'surveyExistingGrowingAreaLabel',
  'surveyExistingGrowingAreaPlaceholder',
  'surveyExistingGrowingAreaHint',
  'surveyCurrentProductionSurveyLabel',
  'surveyReportWhatYouKnow',
  'surveyWhatDoYouProducePlaceholder',
  'surveyQtyPerYearLabel',
  'surveyUnitLabel',
  'surveyUnitPlaceholder',
  'surveyUsedByHouseholdLabel',
  'surveySoldLabel',
  'surveyIncomeEarnedLabel',
  'surveyHarvestMonthsLabel',
  'surveyFaoFoodGroupLabel',
  'surveyFoodGroupNotSure',
  'surveyFoodGroupsReportedCount',
  'surveyFoodGroupsNotReported',
  'surveyFaoHddsFooter',
  'surveyProdLeafyGreensLabel',
  'surveyProdLeafyGreensHint',
  'surveyProdOtherVegLabel',
  'surveyProdOtherVegHint',
  'surveyProdStapleCropsLabel',
  'surveyProdStapleCropsHint',
  'surveyProdFruitLabel',
  'surveyProdFruitHint',
  'surveyProdNutsBerriesLabel',
  'surveyProdNutsBerriesHint',
  'surveyProdEggsLabel',
  'surveyProdPoultryLabel',
  'surveyProdRabbitsLabel',
  'surveyProdHoneyLabel',
  'surveyProdOtherLabel',
  'surveyProdOtherHint',
  'surveyToggleSellProduceSub',
  'surveyIncomeSalesNote',
  'surveyMonthJan',
  'surveyMonthFeb',
  'surveyMonthMar',
  'surveyMonthApr',
  'surveyMonthMay',
  'surveyMonthJun',
  'surveyMonthJul',
  'surveyMonthAug',
  'surveyMonthSep',
  'surveyMonthOct',
  'surveyMonthNov',
  'surveyMonthDec',
  'surveyHddsCereals',
  'surveyHddsRootsTubers',
  'surveyHddsVegetables',
  'surveyHddsFruit',
  'surveyHddsMeatPoultry',
  'surveyHddsEggs',
  'surveyHddsFish',
  'surveyHddsPulsesNutsSeeds',
  'surveyHddsMilk',
  'surveyHddsOilsFats',
  'surveyHddsSugarsHoney',
  'surveyHddsSpicesBeverages',
] as const;

// Already existed, already fully translated in all eleven locales — pre-staged for this exact
// rewiring but never wired up. This is a representative subset (not exhaustive — ~144 keys total
// were rewired) covering every question section of the sheet, so a regression in the rewiring
// would be caught here without pinning every single key.
const REWIRED_EXISTING_KEYS = [
  'siteQuestionnaireTitle',
  'stepOfSteps',
  'stepChallenges',
  'sectionWhoIsThisSiteFor',
  'radioMeMyFamily',
  'radioMeMyFamilyDesc',
  'radioCommunityGroup',
  'radioCommunityGroupDesc',
  'sectionAdultsWhoWorkThisLand',
  'sectionApproximateNumberOfMembers',
  'chipUnder20',
  'chipMemberRange20To50',
  'chipMemberRange50Plus',
  'sectionGoalsSelectAll',
  'goalFoodSecurityLabel',
  'goalFoodSecurityDesc',
  'goalGenerateIncomeLabel',
  'goalGenerateIncomeDesc',
  'goalRestoreTheLandLabel',
  'goalRestoreTheLandDesc',
  'goalDemonstrateTeachLabel',
  'goalDemonstrateTeachDesc',
  'sectionWaterSources',
  'waterSourceMunicipalTap',
  'waterSourceBorehole',
  'waterSourceRiverStream',
  'waterSourceRainwater',
  'waterSourceGreyWater',
  'waterSourceNoneYet',
  'sectionHowDoesWaterReachPlants',
  'waterDeliveryDripLabel',
  'waterDeliveryDripDesc',
  'waterDeliverySprinklerLabel',
  'waterDeliverySprinklerDesc',
  'waterDeliveryPipedLabel',
  'waterDeliveryPipedDesc',
  'waterDeliveryGravityLabel',
  'waterDeliveryGravityDesc',
  'waterDeliveryBucketLabel',
  'waterDeliveryBucketDesc',
  'waterDeliveryFloodLabel',
  'waterDeliveryFloodDesc',
  'waterDeliveryNoneLabel',
  'waterDeliveryNoneDesc',
  'sectionWaterStorage',
  'waterStorageJojoTanks',
  'waterStorageEarthDam',
  'waterStoragePond',
  'waterStorageCistern',
  'waterStorageNone',
  'roofCatchmentWhyMattersLabel',
  'roofCatchmentWhyMattersText',
  'sectionMainBuildingRoofArea',
  'roofMainBuildingGuide',
  'roofMainPlaceholder',
  'roofMainHint',
  'sectionSecondaryRoofs',
  'roofSecondaryPlaceholder',
  'roofSecondaryHint',
  'toggleGuttersLabel',
  'toggleGuttersSub',
  'liveEstimateTitle',
  'liveEstimateTotalRoofArea',
  'liveEstimateAt600mmRain',
  'liveEstimatePerYear',
  'liveEstimateActualRainfallNote',
  'sectionHowIsLandPrepared',
  'landPrepHandToolsLabel',
  'landPrepHandToolsDesc',
  'landPrepTractorLabel',
  'landPrepTractorDesc',
  'landPrepAnimalLabel',
  'landPrepAnimalDesc',
  'landPrepNoneLabel',
  'landPrepNoneDesc',
  'sectionSoilCondition',
  'soilConditionHealthy',
  'soilConditionCompacted',
  'soilConditionSandy',
  'soilConditionClay',
  'soilConditionUnknown',
  'sectionSoilInputs',
  'soilAmendmentCompost',
  'soilAmendmentKraalManure',
  'soilAmendmentMulch',
  'soilAmendmentCommercialFert',
  'soilAmendmentNone',
  'sectionFencing',
  'fencingFull',
  'fencingPartial',
  'fencingNone',
  'sectionCropsGrowing',
  'cropVegetables',
  'cropFruitTrees',
  'cropHerbsMedicinal',
  'cropIndigenousPlants',
  'cropFodder',
  'cropGrainMaize',
  'cropNothing',
  'sectionLivestock',
  'livestockChickens',
  'livestockGoats',
  'livestockCattle',
  'livestockPigs',
  'livestockBees',
  'livestockNone',
  'sectionOtherInfrastructure',
  'infraShadeTunnel',
  'infraGreenhouse',
  'infraCompostBay',
  'infraStorageShed',
  'infraLivestockKraal',
  'sectionFarmingApproach',
  'practiceFullyOrganicLabel',
  'practiceFullyOrganicDesc',
  'practiceMostlyOrganicLabel',
  'practiceMostlyOrganicDesc',
  'practiceConventionalLabel',
  'practiceConventionalDesc',
  'practiceExperimentingLabel',
  'practiceExperimentingDesc',
  'sectionMainChallenges',
  'challengeDrought',
  'challengePests',
  'challengePoorSoil',
  'challengeLimitedWater',
  'challengeFunding',
  'challengeLabour',
  'challengeFlooding',
  'challengeMarket',
  'challengeNone',
  'toggleSellProduceLabel',
  'sectionCurrentOrTargetMarket',
  'marketFarmStall',
  'marketLocalCommunity',
  'marketWholesale',
  'marketNotSure',
  'sectionAnythingElseLimaShouldKnow',
  'notesPlaceholderHint',
  'photoTip',
  'notesPlaceholder',
  'buttonBack',
  'buttonNext',
  // The former Save & generate report promise is replaced by surveySaveContinue above.
] as const;

test('new SiteSurveySheet copy is available as an isiZulu draft while other locales keep fallback', () => {
  const blocks = localeBlocks();
  assert.ok(blocks.length >= 11, 'expected all eleven ImbewuField locales to be present');

  const en = blocks.find((b) => b.locale === 'en');
  assert.ok(en, 'no `en` locale block found in lib/i18n.tsx');
  const zu = blocks.find((b) => b.locale === 'zu');
  assert.ok(zu, 'no isiZulu locale block found');
  for (const key of NEW_SITE_SURVEY_KEYS) {
    assert.match(en!.block, new RegExp(`^  ${key}: ['"]`, 'm'), `${key} has no English source text in the en block`);
  }

  for (const { locale, block } of blocks) {
    if (locale === 'en') continue;
    for (const key of NEW_SITE_SURVEY_KEYS) {
      if (locale === 'zu') {
        assert.match(block, new RegExp(`^  ${key}: ['"]`, 'm'), `isiZulu draft is missing ${key}`);
        continue;
      }
      assert.doesNotMatch(
        block,
        new RegExp(`^  ${key}:`, 'm'),
        `${locale} must stay untouched — ${key} is English-only until a first-language reviewer supplies real words`,
      );
    }
  }
});

test('the rewired SiteSurveySheet keys were already fully translated in every locale', () => {
  const blocks = localeBlocks();
  for (const { locale, block } of blocks) {
    for (const key of REWIRED_EXISTING_KEYS) {
      assert.match(block, new RegExp(`^  ${key}: ['"]`, 'm'), `${locale} is missing ${key} — it should predate this change`);
    }
  }
});

test('the current production step shows draft choices beside their exact English source', () => {
  const pairedKeys = [
    ['surveyStepCurrentProduction', 'Current Production'],
    ['surveyGrowingResources', 'Growing & resources'],
    ['sectionCropsGrowing', 'Crops already growing (select all)'],
    ['cropVegetables', 'Vegetables'], ['cropFruitTrees', 'Fruit trees'], ['cropHerbsMedicinal', 'Herbs / medicinal'],
    ['cropIndigenousPlants', 'Indigenous plants'], ['cropFodder', 'Fodder / pasture'], ['cropGrainMaize', 'Grain / maize'], ['cropNothing', 'Nothing yet'],
    ['surveyExistingGrowingAreaLabel', 'Area currently under cultivation'],
    ['surveyCurrentProductionSurveyLabel', 'Current production survey'],
    ['surveyQtyPerYearLabel', 'Quantity / year'], ['surveyUnitLabel', 'Unit'], ['surveyUsedByHouseholdLabel', 'Used by household'],
    ['surveySoldLabel', 'Sold'], ['surveyIncomeEarnedLabel', 'Income earned (ZAR)'], ['surveyHarvestMonthsLabel', 'Harvest months'],
    ['surveyFaoFoodGroupLabel', 'FAO food group'],
  ] as const;
  for (const [key, english] of pairedKeys) {
    assert.ok(surveySource.includes(`paired('${key}', '${english}')`), `${key} must show its exact English source`);
    assert.ok(i18nSource.includes(`${key}: '${english}'`), `${key} source must match the English dictionary`);
  }
  assert.match(surveySource, /SurveyZuluDraftPair english="Rough size in square metres of what you already grow">\{t\('surveyExistingGrowingAreaHint'\)\}/);
  assert.ok(i18nSource.includes("surveyReportWhatYouKnow: 'Report what you know — leave anything blank if you are not sure. This helps us measure progress over time.'"));
  assert.match(surveySource, /SurveyZuluDraftPair english="Report what you know — leave anything blank if you are not sure\. This helps us measure progress over time\."\>\{t\('surveyReportWhatYouKnow'\)\}/);
  assert.match(surveySource, /SurveyZuluDraftPair english="Record what you already grow\. In the comprehensive survey, open only the production categories you want to record\.">\{tips\[step\]\}/);
  assert.match(surveySource, /SurveyZuluDraftPair english="A notebook, harvest record or sales record can help\. Do not add kilograms to bunches\. Leave figures blank when your records do not cover a full year\.">\{fieldGuides\[step\]\}/);

  const productionSources = [
    ['Leafy greens', 'Spinach, kale, cabbage, etc.'], ['Other vegetables', 'Tomatoes, onions, peppers, etc.'],
    ['Staple crops', 'Maize, beans, sweet potato, etc.'], ['Fruit', 'From trees or vines'],
    ['Nuts & berries', 'From trees or shrubs'], ['Eggs', ''], ['Poultry meat', ''],
    ['Rabbits', ''], ['Honey', ''], ['Other', 'Anything not listed above'],
  ] as const;
  for (const [label, hint] of productionSources) {
    assert.ok(surveySource.includes(`englishLabel: '${label}'`), `${label} category needs its English source`);
    if (hint) assert.ok(surveySource.includes(`englishHint: '${hint}'`), `${label} help needs its English source`);
  }
  assert.match(surveySource, /SurveyZuluDraftPair english=\{englishLabel\}>\{label\}/);
  assert.match(surveySource, /SurveyZuluDraftPair english=\{englishHint\}>\{hint\}/);
  assert.match(surveySource, /MONTH_ENGLISH = \['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'\]/);
  assert.match(surveySource, /SurveyZuluDraftPair english=\{MONTH_ENGLISH\[index\]\}>\{month\}/);
  assert.match(surveySource, /\(English: \$\{HDDS_ENGLISH\[value as HddsFoodGroup\]\}\)/);

  const zu = localeBlocks().find((block) => block.locale === 'zu');
  assert.ok(zu, 'no isiZulu locale block found');
  assert.ok(zu.block.includes('surveyProdLeafyGreensLabel: "Imifino enamahlamvu"'), 'the existing draft label must remain unchanged');
  assert.ok(zu.block.includes('surveyProdStapleCropsLabel: "Izitshalo eziyisisekelo"'), 'the existing draft category must remain unchanged');
});

test('Livestock & Poultry choices and help show each isiZulu draft beside its exact English source', () => {
  const pairedSources = [
    ['sectionLivestock', 'Livestock on site (select all)'],
    ['livestockChickens', 'Chickens / poultry'], ['livestockGoats', 'Goats'],
    ['livestockCattle', 'Cattle'], ['livestockPigs', 'Pigs'], ['livestockBees', 'Bees'],
    ['livestockNone', 'No livestock'],
    ['sectionOtherInfrastructure', 'Other infrastructure (select all)'],
    ['infraShadeTunnel', 'Shade tunnel'], ['infraGreenhouse', 'Greenhouse / polytunnel'],
    ['infraCompostBay', 'Compost bay'], ['infraStorageShed', 'Storage shed'],
    ['infraLivestockKraal', 'Livestock kraal'],
  ] as const;
  for (const [key, english] of pairedSources) {
    assert.ok(surveySource.includes(`paired('${key}', '${english}')`), `${key} must show its exact English source`);
    assert.ok(i18nSource.includes(`${key}: '${english}'`), `${key} source must match the English dictionary`);
  }
  assert.ok(surveySource.includes("paired('surveyGuideLivestock', 'Walk around the site and record what is there now. Put planned additions in your notes so they are not mistaken for existing resources.')"));
  assert.ok(surveySource.includes("paired('surveyTipLivestock', 'Choose the animals and structures that are already on the site. Leave unconfirmed details blank.')"));
});

test('SiteSurveySheet reads every question, label and button through t(), not hard-coded English', () => {
  for (const key of NEW_SITE_SURVEY_KEYS) {
    assert.ok(surveySource.includes(`t('${key}')`) || surveySource.includes(`paired('${key}', '`), `${key} is not referenced by SiteSurveySheet`);
  }
  for (const key of REWIRED_EXISTING_KEYS) {
    assert.ok(surveySource.includes(`t('${key}')`) || surveySource.includes(`paired('${key}', '`), `${key} is not referenced by SiteSurveySheet`);
  }

  // useLanguage must actually be imported and called — a stray literal key string with no t()
  // wiring would otherwise slip past the regex checks above.
  assert.match(surveySource, /import \{ useLanguage \} from '@\/lib\/i18n';/);
  assert.match(surveySource, /const \{ t \} = useLanguage\(\);/);
});

test('SiteSurveySheet no longer hard-codes its former English literals', () => {
  // The defect this guards against: the exact hard-coded strings that used to sit directly in
  // JSX, with zero t() calls anywhere in the file.
  assert.doesNotMatch(surveySource, /'Household Info'/, 'STEPS regressed to a hard-coded literal');
  assert.doesNotMatch(surveySource, /'Land & Location'/, 'STEPS regressed to a hard-coded literal');
  assert.doesNotMatch(surveySource, /function surveySteps[\s\S]*?\[\s*'Current Production'/, 'STEPS regressed to a hard-coded literal');
  assert.doesNotMatch(surveySource, /'Livestock & Poultry'/, 'STEPS regressed to a hard-coded literal');
  assert.doesNotMatch(surveySource, /'Income & Sales'/, 'STEPS regressed to a hard-coded literal');
  assert.doesNotMatch(surveySource, /'Resources & Inputs'/, 'STEPS regressed to a hard-coded literal');
  assert.doesNotMatch(surveySource, /aria-label="Site questionnaire"/, 'dialog aria-label regressed to a hard-coded literal');
  assert.doesNotMatch(surveySource, /aria-label="Close"/, 'close button aria-label regressed to a hard-coded literal');
  assert.doesNotMatch(surveySource, /Discard your answers so far\? This questionnaire has not been saved yet\./, 'discard-confirm prompt regressed to a hard-coded literal');
  assert.doesNotMatch(surveySource, /'Under 20', label: 'Under 20'/, 'member-count chip regressed to a hard-coded literal');
  assert.doesNotMatch(surveySource, /label: 'Leafy greens'/, 'production-row label regressed to a hard-coded display value');
  const hddsFunction = surveySource.slice(surveySource.indexOf('function hddsLabels'), surveySource.indexOf('const HDDS_ENGLISH'));
  assert.doesNotMatch(hddsFunction, /Roots & tubers/, 'HDDS labels regressed to hard-coded display values');
  assert.doesNotMatch(surveySource, /function monthLabels[\s\S]*?return \[\s*'Jan', 'Feb', 'Mar'/, 'MONTH_LABELS regressed to English display values');
  assert.doesNotMatch(surveySource, /Auto-filled from your traced shapes/, 'AutoFillNote regressed to a hard-coded literal');
  assert.doesNotMatch(surveySource, /placeholder=\{placeholder \?\? 'e\.g\. 120'\}/, 'NumInput default placeholder regressed to a hard-coded literal');
});

test('the accessible modal semantics a11y-modal-semantics.test.ts depends on survive the rewiring', () => {
  // These are byte-for-byte required by tests/a11y-modal-semantics.test.ts — this test does not
  // duplicate that file's assertions, it just guards that this change didn't quietly break them.
  assert.match(surveySource, /role="dialog"/);
  assert.match(surveySource, /aria-modal="true"/);
  assert.match(surveySource, /e\.key === 'Escape'/);
  assert.match(surveySource, /addEventListener\('keydown', onKey\)/);
  assert.match(surveySource, /role="switch"/);
  assert.match(surveySource, /aria-checked=\{on\}/);
});


test('Site Survey opening choices show exact English sources and hold uncertain phrases in English', () => {
  const zu = localeBlocks().find((block) => block.locale === 'zu');
  assert.ok(zu, 'no isiZulu locale block found');

  const pairedSources = [
    ['sectionWhoIsThisSiteFor', 'Who is this site for?'],
    ['radioMeMyFamily', 'Me / my family'],
    ['radioMeMyFamilyDesc', 'Household homestead or smallholding'],
    ['radioCommunityGroup', 'Community group / cooperative'],
    ['radioCommunityGroupDesc', 'Shared garden, coop, or NGO site'],
    ['sectionAdultsWhoWorkThisLand', 'Adults who work this land'],
    ['sectionApproximateNumberOfMembers', 'Approximate number of members'],
    ['sectionGoalsSelectAll', 'Goals for this site (select all that apply)'],
    ['goalFoodSecurityLabel', 'Food security'],
    ['goalFoodSecurityDesc', 'Feed the household or members year-round'],
    ['goalGenerateIncomeLabel', 'Generate income'],
    ['goalGenerateIncomeDesc', 'Sell surplus produce or value-added products'],
    ['goalRestoreTheLandLabel', 'Restore the land'],
    ['goalRestoreTheLandDesc', 'Cover crops, composting, rehabilitation'],
    ['goalDemonstrateTeachLabel', 'Demonstrate / teach'],
    ['goalDemonstrateTeachDesc', 'Training ground for others'],
  ] as const;

  for (const [key, english] of pairedSources) {
    assert.ok(surveySource.includes(`paired('${key}', '${english}')`), `${key} must display its exact English source`);
    assert.ok(i18nSource.includes(`${key}: '${english}'`), `${key} source must match the English dictionary`);
  }

  assert.ok(zu.block.includes("  radioCommunityGroupDesc: 'Shared garden, coop, or NGO site'"),
    'the uncertain community-site descriptor stays in English');
  assert.ok(zu.block.includes("  goalGenerateIncomeDesc: 'Sell surplus produce or value-added products'"),
    'the uncertain value-added wording stays in English');
  assert.ok(zu.block.includes("  goalRestoreTheLandLabel: 'Ukuvuselela umhlaba'"),
    'ecological restoration must not use wording that can mean land restitution');
});

test('Site Survey land choices show their exact English sources beside each isiZulu draft', () => {
  const pairedSources = [
    ['sectionHowIsLandPrepared', 'How is the land prepared?'],
    ['landPrepHandToolsLabel', 'Hand tools (spade, fork, hoe)'],
    ['landPrepHandToolsDesc', 'Manual soil work — limits depth and area'],
    ['landPrepTractorLabel', 'Tractor / mechanised'],
    ['landPrepTractorDesc', 'Deep tillage possible, larger areas'],
    ['landPrepAnimalLabel', 'Animal draft (ox, donkey)'],
    ['landPrepAnimalDesc', 'Traditional plough or cultivator'],
    ['landPrepNoneLabel', 'Not yet prepared / no-till'],
    ['landPrepNoneDesc', 'Starting from scratch or using no-dig method'],
    ['sectionSoilCondition', 'Soil condition (as you observe it)'],
    ['soilConditionHealthy', 'Healthy & loose'],
    ['soilConditionCompacted', 'Compacted / hard'],
    ['soilConditionSandy', 'Sandy / drains fast'],
    ['soilConditionClay', 'Clay / waterlogged'],
    ['soilConditionUnknown', 'Not sure'],
    ['sectionSoilInputs', 'Soil inputs already applied (select all)'],
    ['soilAmendmentCompost', 'Compost'],
    ['soilAmendmentKraalManure', 'Kraal manure'],
    ['soilAmendmentMulch', 'Mulch / woodchip'],
    ['soilAmendmentCommercialFert', 'Commercial fertiliser'],
    ['soilAmendmentNone', 'None yet'],
    ['sectionFencing', 'Fencing'],
    ['fencingFull', 'Fully fenced'],
    ['fencingPartial', 'Partly fenced'],
    ['fencingNone', 'No fencing'],
    ['surveyGuideLand', 'Look at several parts of the growing area. If the soil varies, describe the differences in your notes. Choose Not sure when you cannot tell.'],
    ['surveyTipLand', 'Look at the ground and how you work it. These are your observations, not a laboratory soil result.'],
  ] as const;

  for (const [key, english] of pairedSources) {
    assert.ok(surveySource.includes(`paired('${key}', '${english}')`), `${key} must display its exact English source`);
    assert.ok(i18nSource.includes(`${key}: '${english}'`) || i18nSource.includes(`${key}: "${english}"`),
      `${key} source must match the English dictionary`);
  }
});

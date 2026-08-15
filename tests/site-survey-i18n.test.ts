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
//  2. NEW_ENGLISH_ONLY_KEYS — ~75 keys genuinely new to the dictionary (step-tab labels, the
//     Current Production reporting grid, FAO HDDS food-group names, month abbreviations, the
//     discard-confirm prompt, etc.), added to the English (`en`) block ONLY. Per the absolute
//     rule this change worked under, no isiZulu (or any other language) may be coined here — the
//     other ten locale blocks are left untouched so the existing missing-key fallback
//     (T[lang]?.[key] ?? T.en[key] ?? key) serves English until a first-language reviewer
//     supplies the real words.
//
// Run with:
//   node --import ./tests/register-alias.mjs --test tests/site-survey-i18n.test.ts

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const i18nSource = readFileSync(new URL('../lib/i18n.tsx', import.meta.url), 'utf8');
const surveySource = readFileSync(new URL('../components/SiteSurveySheet.tsx', import.meta.url), 'utf8');

function localeBlocks(source: string): Array<{ locale: string; block: string }> {
  const starts = [...source.matchAll(/^  ([a-z]+): \{/gm)];
  return starts.map((match, index) => {
    const start = match.index ?? 0;
    const end = starts[index + 1]?.index ?? source.length;
    return { locale: match[1], block: source.slice(start, end) };
  });
}

// Brand new — did not exist anywhere in the dictionary before this change. (`stepChallenges` is
// reused as-is for the 7th step tab and is covered by the rewired list below, not here.)
const NEW_ENGLISH_ONLY_KEYS = [
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
  'buttonSaveAndGenerateReport',
] as const;

test('the new SiteSurveySheet keys exist in English only, and no other locale was touched', () => {
  const blocks = localeBlocks(i18nSource);
  assert.ok(blocks.length >= 11, 'expected all eleven ImbewuField locales to be present');

  const en = blocks.find((b) => b.locale === 'en');
  assert.ok(en, 'no `en` locale block found in lib/i18n.tsx');
  for (const key of NEW_ENGLISH_ONLY_KEYS) {
    assert.match(en!.block, new RegExp(`^    ${key}: ['"]`, 'm'), `${key} has no English source text in the en block`);
  }

  for (const { locale, block } of blocks) {
    if (locale === 'en') continue;
    for (const key of NEW_ENGLISH_ONLY_KEYS) {
      assert.doesNotMatch(
        block,
        new RegExp(`^    ${key}:`, 'm'),
        `${locale} must stay untouched — ${key} is English-only until a first-language reviewer supplies real words`,
      );
    }
  }
});

test('the rewired SiteSurveySheet keys were already fully translated in every locale', () => {
  const blocks = localeBlocks(i18nSource);
  for (const { locale, block } of blocks) {
    for (const key of REWIRED_EXISTING_KEYS) {
      assert.match(block, new RegExp(`^    ${key}: ['"]`, 'm'), `${locale} is missing ${key} — it should predate this change`);
    }
  }
});

test('SiteSurveySheet reads every question, label and button through t(), not hard-coded English', () => {
  for (const key of NEW_ENGLISH_ONLY_KEYS) {
    assert.match(surveySource, new RegExp(`t\\('${key}'\\)`), `${key} is not referenced by SiteSurveySheet`);
  }
  for (const key of REWIRED_EXISTING_KEYS) {
    assert.match(surveySource, new RegExp(`t\\('${key}'\\)`), `${key} is not referenced by SiteSurveySheet`);
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
  assert.doesNotMatch(surveySource, /'Current Production'/, 'STEPS regressed to a hard-coded literal');
  assert.doesNotMatch(surveySource, /'Livestock & Poultry'/, 'STEPS regressed to a hard-coded literal');
  assert.doesNotMatch(surveySource, /'Income & Sales'/, 'STEPS regressed to a hard-coded literal');
  assert.doesNotMatch(surveySource, /'Resources & Inputs'/, 'STEPS regressed to a hard-coded literal');
  assert.doesNotMatch(surveySource, /aria-label="Site questionnaire"/, 'dialog aria-label regressed to a hard-coded literal');
  assert.doesNotMatch(surveySource, /aria-label="Close"/, 'close button aria-label regressed to a hard-coded literal');
  assert.doesNotMatch(surveySource, /Discard your answers so far\? This questionnaire has not been saved yet\./, 'discard-confirm prompt regressed to a hard-coded literal');
  assert.doesNotMatch(surveySource, /'Under 20', label: 'Under 20'/, 'member-count chip regressed to a hard-coded literal');
  assert.doesNotMatch(surveySource, /Leafy greens/, 'production-row label regressed to a hard-coded literal');
  assert.doesNotMatch(surveySource, /Roots & tubers/, 'HDDS food-group label regressed to a hard-coded literal');
  assert.doesNotMatch(surveySource, /'Jan', 'Feb', 'Mar'/, 'MONTH_LABELS regressed to a hard-coded array of literals');
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

import { withBlindReviewedCorrectionReadScope } from './blind-reviewed-study-corrections-history-checks.ts';
import { blindReviewedSourceBefore } from './blind-reviewed-study-corrections-history-checks.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
// Validate the bounded current audit corrections before this dated predecessor claim.
import { readBlindReviewedHistoryFile as readFileSync } from './blind-reviewed-study-corrections-history-checks.ts';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MENTOR_ENGLISH_PENDING, CHAT_PANEL_ENGLISH_PENDING, NETWORK_FAILURE_ENGLISH_PENDING, PHOTO_UPLOAD_ENGLISH_PENDING, PROFILE_SHEET_ENGLISH_PENDING } from '../lib/i18n-pending.ts';

const folder = 'docs/study-translation-reviews/study-ui-due-unlock-2026-10-08/';
const root = fileURLToPath(new URL('../', import.meta.url));
const path = (file: string) => resolve(root, file);
const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const predecessorSourcePath = folder + 've-before.ts.txt';
const predecessorLocalePath = folder + 've-before.json';
const currentLocalePath = folder + 've-after.json';
const predecessorSource = readFileSync(path(predecessorSourcePath));
const predecessorLocaleBytes = readFileSync(path(predecessorLocalePath));
const currentLocaleBytes = readFileSync(path(currentLocalePath));
const predecessorLocale = JSON.parse(predecessorLocaleBytes.toString());
const currentLocale = JSON.parse(currentLocaleBytes.toString());

assert.equal(sha(predecessorSource), 'e9deff4c7b627e99378bbc574111e23dd346911fcc8d4afb3ac60358c910db0e', 'exact complete VE source before the due/unlock layer');
assert.equal(sha(predecessorLocaleBytes), 'e11dcd0b19061de333ad2b810408fde435f1b43605fdde7a68886c77f60e934a', 'exact complete VE dictionary before the due/unlock layer');
assert.equal(sha(currentLocaleBytes), '6f705e0b0bdf20992d3767477af2ce96f8f044bd7513f336a678df9348b6a0b9', 'exact complete VE dictionary after the due/unlock layer');

const acceptedAdditions: Record<string, string> = {
  studentDueToday: 'Zwi tea u itwa ṋamusi',
  studentDueTomorrow: 'Zwi tea u itwa matshelo',
  studentDaysOverdue: 'Zwo lenga nga maḓuvha a {count}',
  studentDueInDays: 'Zwi tea u itwa nga maḓuvha a {count}',
  studentDueDate: 'Zwi tea u itwa nga {date}',
  studentOpenedByMentor: 'Zwo vulwa nga mueletshedzi waṋu',
  studentFinishToUnlock: 'Fhedzisani ngudo ya “{title}” uri ni kone u vula izwi',
  studentSubmitToUnlock: 'Rumelani mushumo wa ngudo ya “{title}” uri ni kone u vula izwi',
  studentPractitioner: 'Muthu ane a shumisa Permaculture',
};
const expectedLocale = structuredClone(predecessorLocale);
for (const [key, value] of Object.entries(acceptedAdditions)) {
  assert.equal(Object.hasOwn(predecessorLocale, key), false, `${key}: absent from exact predecessor`);
  assert.equal(currentLocale[key], value, `${key}: exact accepted unreviewed draft`);
  expectedLocale[key] = value;
}
assert.deepEqual(currentLocale, expectedLocale, 'only the nine accepted VE labels are added; every pre-existing entry stays exact');

const WAVE_11_IMPORT = "import { CHAT_PANEL_ENGLISH_PENDING, DESIGN_STUDIO_ENGLISH_PENDING, JOURNAL_ENGLISH_PENDING, LIMA_ENGLISH_PENDING, MENTOR_ENGLISH_PENDING, NETWORK_FAILURE_ENGLISH_PENDING, PHOTO_UPLOAD_ENGLISH_PENDING, PROFILE_SHEET_ENGLISH_PENDING, type Dict }";
const WAVE_10_IMPORT = "import { DESIGN_STUDIO_ENGLISH_PENDING, JOURNAL_ENGLISH_PENDING, LIMA_ENGLISH_PENDING, MENTOR_ENGLISH_PENDING, type Dict }";
const WAVE_11_SPREADS = '  ...CHAT_PANEL_ENGLISH_PENDING,\n  ...PHOTO_UPLOAD_ENGLISH_PENDING,\n  ...PROFILE_SHEET_ENGLISH_PENDING,\n  ...NETWORK_FAILURE_ENGLISH_PENDING,\n';
const WAVE_11_ZULU_BLOCK = '\n\n  // Ask tab chat panel (components/ChatPanel.tsx) — wave 11';
/** Remove exactly the wave 11 import names, spreads and (isiZulu only) trailing draft block. */
function rewindWave11Locale(text: string): string {
  assert.equal(text.split(WAVE_11_IMPORT).length, 2, 'one wave 11 pending import');
  assert.equal(text.split(WAVE_11_SPREADS).length, 2, 'one wave 11 spread group');
  let before = text.replace(WAVE_11_IMPORT, WAVE_10_IMPORT).replace(WAVE_11_SPREADS, '');
  const block = before.indexOf(WAVE_11_ZULU_BLOCK);
  if (block >= 0) before = before.slice(0, block) + before.slice(before.lastIndexOf('\n};'));
  return before;
}
/** The five predecessor lines wave 11 reworded (water, Ask tab, soil hints, altitude), none in Studies. */
const WAVE_11_REWORDED = new Set([
  "  waterBalanceMinSafe: 'Min safe: {amount} kL',",
  "  tabAI: 'AI',",
  "  soilImprovementCompacted: 'Bulk density {bd} g/cm³ suggests compaction — deep-rooted cover crops and broadfork open the profile',",
  "  soilImprovementSandy: 'Sandy soil ({sand}%) — mulch heavily and boost CEC with compost and biochar',",
  "  homeStatASL: 'ASL',",
]);
function assertOnlyWave11Additions(before: string, live: string) {
  const liveLines = live.split('\n');
  const keyOf = (line: string) => /^ {2}([A-Za-z_$][\w$]*): /.exec(line)?.[1];
  const rewordedKeys = new Set([...WAVE_11_REWORDED].map(keyOf));
  const beforeKeys = new Set(before.split('\n').map(keyOf).filter(Boolean));
  const added: string[] = [];
  let at = 0, reworded = 0;
  for (const line of before.split('\n')) {
    if (WAVE_11_REWORDED.has(line)) { reworded++; continue; }
    const from = at;
    while (at < liveLines.length && liveLines[at] !== line) at++;
    assert.ok(at < liveLines.length, `predecessor line lost or reordered by wave 11: ${line.slice(0, 80)}`);
    added.push(...liveLines.slice(from, at));
    at++;
  }
  added.push(...liveLines.slice(at));
  assert.equal(reworded, WAVE_11_REWORDED.size, 'each named wave 11 rewording is accounted for once');
  // A later duplicate key in an object literal silently wins, so no added line may re-declare a
  // predecessor key other than the five named rewordings.
  for (const line of added) {
    const key = keyOf(line);
    if (key && !rewordedKeys.has(key)) assert.ok(!beforeKeys.has(key), `wave 11 re-declares predecessor key ${key}`);
  }
}

/** Wave 13 (copy, chrome and desktop tracks) rewords and deletes named non-Study lines. */
const WAVE_13_ENGLISH_REWORDED = new Set([
  "  completionStepCropPlan: 'Crop plan done',",
  "  drawFinishButton: 'Finish',",
  "  savedPlacesHeader: 'Saved Places',",
  "  siteReportOverline: 'Site report',",
  "  profileRoleNgo: 'NGO Staff',",
  "  bulkDensityOk: 'OK',",
  "  savedReportsHeader: 'Saved Reports',",
  "  noSavedReportsGenerateLink: 'Generate Full Report',",
  "  savedSitesHeader: 'Your Sites',",
  "  stepRoofCatchment: 'Roof Catchment',",
  "  stepWhatExists: 'What Exists',",
  "  evidenceSheetDismiss: 'Dismiss',",
  "  surveySectionLabel: 'Site survey',",
  "  homeQuickJournal: 'Journal',",
  "  homeRoleNGODesc: 'Programme dashboard & M&E roll-up',",
  "  homeRoleFunderDesc: 'Read-only impact oversight',",
  "  homeSurveysDesc: 'Answer field surveys · NGOs build & send',",
  "  navSectionFarmTools: 'Farm Tools',",
  "  navFieldJournal: 'Field Journal',",
  "  navTaskPlanner: 'Task Planner',",
  "  navManual: 'Permaculture Manual',",
  "  navGardenSurvey: 'Garden Survey',",
  "  navNGODashboard: 'Organisation Dashboard',",
  "  navMyAccount: 'My Account',",
  "  navDesignStudio: 'Design Studio',",
  "  navOfflineSync: 'Offline and sync',",
  "  tipsTitle: 'Tips & help',",
  "  studentProgressFirebase: 'Progress will save to Firebase once the backend is connected',",
  "  myRecordsSubtitle: 'What you grow · what you sell · designs from your supervisor',",
  "  addOpensStudioChip: 'Opens Studio',",
  "  loginBackendUnavailableNotice: 'Backend not connected yet — auth is unavailable. The app runs in tour mode.',",
  "  offlineTitle: 'Offline & sync',",
  "  offlineSyncNow: 'Sync now',",
  "  offlineQueueEmpty: 'No entries in this fieldwork queue. The money book uses its own sync system.',",
  "  offlineSyncComplete: 'Sync attempt finished. Any entries still listed below remain on this device.',",
  "  offlinePageOffline: 'Offline & sync',",
  "  offlinePageRecords: 'Money book & harvests',",
  "  reportsTitle: 'Saved sites & reports',",
  "  reportsIntro: 'Choose a site to prepare and generate its Site Analysis Report, or reopen a report you have already saved.',",
]);
const WAVE_13_ENGLISH_REMOVED = new Set([
  "  tabFinance: 'Finance',",
  "  homeQuickFinance: 'Finance',",
  "  homeQuickFinanceDesc: 'Income & costs',",
  "  navFacilitator: 'Design canvas',",
  "  navPracticeViews: 'Practice views',",
  "  navBrowseGardens: 'Browse gardens',",
  "  navTourWorkspace: 'Tour workspace',",
  "  navTourWorkspaceNote: 'Changes stay in this tour workspace.',",
  "  navChooseView: 'Choose view',",
]);
const WAVE_13_ZULU_REWORDED = new Set([
  "  tabAccount: 'I-akhawunti',",
  "  drawFinishButton: 'Qeda',",
  "  bulkDensityOk: 'Kulungile',",
  "  surveySectionLabel: 'Uphando lwendawo',",
  "  homeQuickContactDesc: 'Imeluleki · INhlangano',",
  "  homeQuickJournal: 'Ijenali',",
  "  homeDashboardsSummary: 'Umlimi · Imeluleki · INhlangano · Umxhasi · Umfundi',",
  "  homeRoleNGOLabel: 'INhlangano',",
  "  studentProgressFirebase: 'Inqubekela phambili izolondolozwa ku-Firebase uma iseva isixhunyiwe',",
  "  myRecordsSubtitle: 'Lokho okulima · lokho okudayisayo · imidwebo evela kumphathi wakho',",
  "  loginBackendUnavailableNotice: 'Uhlelo olungemuva alukaxhunywa — ukungena akutholakali. Uhlelo lokusebenza lusebenza njengohambo lokuluhlola.',",
  "  offlinePageJournal: 'Iphaphebhuku lasensimini',",
  "  offlinePageDesign: 'Isitudiyo sokuklama',",
  "  completionStepCropPlan: 'Uhlelo lwezitshalo lwenziwe',",
]);
const WAVE_13_ZULU_REMOVED = new Set([
  "  tabFinance: 'Ezezimali',",
  "  homeQuickFinance: 'Ezezimali',",
  "  homeQuickFinanceDesc: 'Imali engenayo nezindleko',",
  "  navFacilitator: 'Idizayini',",
  "  navPracticeViews: 'Izibonelo zokuzijwayeza',",
  "  navBrowseGardens: 'Bheka izingadi',",
  "  navTourWorkspace: 'Indawo yokusebenza yohambo',",
  "  navTourWorkspaceNote: 'Izinguquko zihlala kule ndawo yokusebenza yohambo.',",
  "  navChooseView: 'Khetha ukubuka',",
]);
/** Wave 14 (study track, 17 Oct 2026) respaced the four Study preview/guide action labels: the
 * space before the arrow became a non-breaking space so the arrow never wraps onto a line of its
 * own (key kept, value changed). The isiZulu and
 * study tracks also ADD keys (shared language-draft note, BRU zone wording, Home date names,
 * site-report biome drafts) and the checker already proves additions re-declare nothing. */
const WAVE_14_ENGLISH_REWORDED = new Set([
  "  studentDesignPreviewAction: 'Explore the design teaching preview \u00b7 English \u2192',",
  "  studentFinancePreviewAction: 'Explore the finance teaching preview \u00b7 English \u2192',",
  "  studentAppGuideAction: 'Read the guide \u00b7 English \u2192',",
  "  studentSampleTourAction: 'Explore mapping, planning and records in the sample tour \u2192',",
]);
const WAVE_14_ZULU_REWORDED = new Set([
  "  studentDesignPreviewAction: 'Hlola isifundo sokuklama \u00b7 ngesiNgisi \u2192',",
  "  studentFinancePreviewAction: 'Hlola okokufundisa ngezezimali \u00b7 ngesiNgisi \u2192',",
  "  studentAppGuideAction: 'Funda umhlahlandlela \u00b7 ngesiNgisi \u2192',",
  "  studentSampleTourAction: 'Hlola imephu, ukuhlela namarekhodi ohambweni lwesibonelo \u2192',",
]);
const WAVE_14_REMOVED = new Set<string>();
// Wave 19 (w19-40): the practice-version sign-in notice says "this device" instead of "this phone",
// because it shows on desktop too. Nothing else in the app dictionary changes; the named line is the
// exact wave 16 value.
const WAVE_19_ENGLISH_REWORDED = new Set([
  "  loginBackendUnavailableNotice: 'Sign-in is not available in this practice version. Everything you try here is kept on this phone.',",
]);
// Wave 15 (copy-07): English UI labels in the app dictionary go to sentence case; keys and every
// other line are unchanged. Each named line is the exact wave 14 value.
const WAVE_15_ENGLISH_REWORDED = new Set([
  "  designStudioLabel: 'Design Studio',",
  "  siteDesignOpenStudio: 'Open the Design Studio',",
  "  siteDesignSketchHeader: 'Sketch \u2192 AI Design',",
  "  statOrganicCarbon: 'Organic Carbon',",
  "  statBulkDensity: 'Bulk Density',",
  "  stepSiteAndGoals: 'Site & Goals',",
  "  stepLandAndSoil: 'Land & Soil',",
  "  reportToolbarTitle: 'Site Analysis Report',",
  "  reportPrintSubtitle: 'Permaculture Site Analysis Report',",
  "  reportSavedPlacesHeader: 'Saved Places \u00b7 GPS Points',",
  "  reportSatelliteViewHeader: 'Site Satellite View',",
  "  reportMonthlyRainfallHeader: 'Monthly Rainfall Pattern',",
  "  reportShareTitle: 'ImbewuField Site Analysis',",
  "  reportSiteAreaLabel: 'Site Area',",
  "  reportWaterStorageLabel: 'Water Storage',",
  "  reportExecutiveSummaryHeading: 'Executive Summary',",
  "  allSectionExecutiveSummary: 'Executive Summary',",
  "  allSectionSiteConditions: 'Site Conditions',",
  "  allSectionNaturalVegetationBiome: 'Natural Vegetation & Biome',",
  "  allSectionWaterHarvesting: 'Water Harvesting',",
  "  allSectionIrrigationPlan: 'Irrigation Plan',",
  "  allSectionSoilStrategy: 'Soil Strategy',",
  "  allSectionPlantingCalendar: 'Planting Calendar',",
  "  allSectionYearRoundFoodProduction: 'Year-Round Food Production',",
  "  allSectionFruitNutBerryTrees: 'Fruit, Nut & Berry Trees',",
  "  allSectionIndigenousTrees: 'Indigenous Trees',",
  "  allSectionAgroecosystemPlantingGuide: 'Agroecosystem Planting Guide',",
  "  allSectionCropRotation: 'Crop Rotation',",
  "  allSectionAnimalsLivestock: 'Animals & Livestock',",
  "  allSectionSunSolar: 'Sun & Solar',",
  "  allSectionWindWindbreaks: 'Wind & Windbreaks',",
  "  allSectionFireHazards: 'Fire & Hazards',",
  "  allSectionEconomicOpportunities: 'Economic Opportunities',",
  "  allSectionPlantGuilds: 'Plant Guilds',",
  "  allSectionZoneDesign: 'Zone Design',",
  "  allSectionSeasonalCalendar: 'Seasonal Calendar',",
  "  allSectionYear1Priorities: 'Year 1 Priorities',",
  "  homeQuickContactDesc: 'Mentor \u00b7 Organisation',",
  "  journalOpenRecords: 'Open My Records',",
  "  homeQuickMyRecords: 'My Records',",
  "  navPlantingCalendar: 'Planting Calendar',",
  "  studentPortal: 'Learning Portal',",
  "  studentPortalTitle: 'This is the Learning Portal',",
  "  studentMyStudies: 'My Studies',",
  "  studentOpenDesignStudio: 'Open Design Studio',",
  "  studentFinancePreviewTitle: 'Farm Finance',",
  "  studentFinancePreviewSimpleLabel: 'Farm Finance course',",
  "  myRecordsTitle: 'My Records',",
  "  insightsReportTitle: 'AI Permaculture Report',",
  "  coachStepDesignCta: 'Open the Studio',",
  "  addLabelHouse: 'House / Building',",
  "  surveyStepHouseholdInfo: 'Household Info',",
  "  surveyStepLandLocation: 'Land & Location',",
  "  surveyStepCurrentProduction: 'Current Production',",
  "  surveyStepLivestockPoultry: 'Livestock & Poultry',",
  "  surveyStepIncomeSales: 'Income & Sales',",
  "  surveyStepResourcesInputs: 'Resources & Inputs',",
  "  offlinePageRecords: 'My Records',",
  "  limaFieldGuideSubtitle: 'Field Guide \u00b7 ImbewuField',",
]);
/** Every predecessor line survives in order except the named rewordings (key kept, value changed)
 * and the named removals (dead keys deleted); added lines may not re-declare any predecessor key. */
function assertOnlyWaveChanges(before: string, live: string, reworded: Set<string>, removed: Set<string>, label: string, wave: string) {
  const liveLines = live.split('\n');
  const keyOf = (line: string) => /^ {2}([A-Za-z_$][\w$]*): /.exec(line)?.[1];
  const rewordedKeys = new Set([...reworded].map(keyOf));
  const beforeKeys = new Set(before.split('\n').map(keyOf).filter(Boolean));
  const added: string[] = [];
  let at = 0, rewordedSeen = 0, removedSeen = 0;
  for (const line of before.split('\n')) {
    if (reworded.has(line)) { rewordedSeen++; continue; }
    if (removed.has(line)) { removedSeen++; continue; }
    const from = at;
    while (at < liveLines.length && liveLines[at] !== line) at++;
    assert.ok(at < liveLines.length, `${label}: predecessor line lost or reordered by ${wave}: ${line.slice(0, 80)}`);
    added.push(...liveLines.slice(from, at));
    at++;
  }
  added.push(...liveLines.slice(at));
  assert.equal(rewordedSeen, reworded.size, `${label}: each named ${wave} rewording is accounted for once`);
  assert.equal(removedSeen, removed.size, `${label}: each named ${wave} removal is accounted for once`);
  const liveKeys = new Set<string>();
  for (const line of liveLines) {
    const key = keyOf(line);
    if (!key) continue;
    assert.ok(!liveKeys.has(key), `${label}: ${wave} declares ${key} twice`);
    liveKeys.add(key);
  }
  for (const line of added) {
    const key = keyOf(line);
    if (key && !rewordedKeys.has(key)) assert.ok(!beforeKeys.has(key), `${label}: ${wave} re-declares predecessor key ${key}`);
  }
}

export function ensureStudyUiDueUnlockCurrent() {
  return withBlindReviewedCorrectionReadScope(() => {
  // Wave 11 (lang-01) spreads four new English-pending groups (Ask chat, photo upload, profile
  // sheet, network failure) into every locale and adds unreviewed isiZulu drafts for them, all
  // outside Studies. Check each complete new file, then rewind exactly those additions so the
  // earlier whole-file pins below still bind byte for byte.
  const liveSource = readFileSync(path('lib/locales/ve.ts'));
  assert.equal(sha(liveSource), 'bb0983d867888c06e799cf8f82d4ef97332f0a47184e5f1ce8b8725ffd67be04', 'complete live VE source bytes after the wave 11 pending spreads');
  assert.equal(sha(rewindWave11Locale(liveSource.toString())), '0062c005b859e3723ce3ca24923cd8880d7f078c09f2b8c67f3df91a92790a69', 'complete live VE source bytes for the newest accepted layer');
  // Main #990 adds report-footnote keys to the shared app dictionary, outside
  // Studies. Check the complete new file before rewinding precisely its two
  // additions; the original whole-file Study predecessor check still binds.
  // Wave 11 adds non-Study keys across the app dictionary in many places, so the exact
  // predecessor is kept as a fixture: it must hash to the earlier whole-file pin, and every one
  // of its lines must survive in order in the live file except the five named non-Study edits.
  // Wave 13 (copy, chrome and desktop tracks) rewords nav/home labels to sentence case, renames
  // supervisor→mentor and the money book→My Records, deletes dead keys and adds new chrome keys,
  // none in Studies. Check the complete new file, then bind every older pin to the exact
  // pre-wave-13 fixture so the wave 11 and earlier proofs still hold byte for byte.
  // Wave 14 (isiZulu and study tracks) adds the shared language-draft note, BRU zone wording and
  // the Home date names, and keeps four Study action arrows from wrapping alone. Check the complete new file,
  // then bind the wave 13 proof to the exact pre-wave-14 fixture so it still holds byte for byte.
  // Wave 16 (copy-05) adds one English key, savedSiteUnavailable, for a saved site that no longer
  // exists; nothing is reworded or removed. Check the complete new file, then bind the wave 15 proof
  // to the exact pre-wave-16 fixture so it still holds byte for byte.
  // Wave 19 (w19-40) rewords one sign-in notice. Check the complete new file, then bind the wave 16
  // proof to the exact pre-wave-19 fixture so it still holds byte for byte.
  const liveDictionary = readFileSync(path('lib/i18n.tsx'), 'utf8');
  assert.equal(sha(liveDictionary), 'bf215f73f61fc9d04bb3e89949b1d0c6fb94832276d5a6e4c55ad04a4af80b32', 'complete app dictionary after the wave 19 edit');
  const englishBefore19 = readFileSync(path('tests/fixtures/i18n-before-wave-19.tsx.txt'), 'utf8');
  assert.equal(sha(englishBefore19), '965efb4d398e7996e9a8bbfa061fa608b931d3c9244ce735e40d5c7c280eb671', 'complete app dictionary after the wave 16 edits');
  assertOnlyWaveChanges(englishBefore19, liveDictionary, WAVE_19_ENGLISH_REWORDED, new Set(), 'app dictionary', 'wave 19');
  const liveEnglish = readFileSync(path('tests/fixtures/i18n-before-wave-16.tsx.txt'), 'utf8');
  assert.equal(sha(liveEnglish), '737049f60cfd7ea083460c212c5f3f7b985e8177ec03045f34619b7627331512', 'complete app dictionary after the wave 15 edits');
  assertOnlyWaveChanges(liveEnglish, englishBefore19, new Set(), new Set(), 'app dictionary', 'wave 16');
  const englishBefore15 = readFileSync(path('tests/fixtures/i18n-before-wave-15.tsx.txt'), 'utf8');
  assert.equal(sha(englishBefore15), '2485d3cc34a6b8e0b5bf964b8c8fd20ac8ec341be769ebf1094bce3987cdc282', 'complete app dictionary after the wave 14 edits remains exact');
  assertOnlyWaveChanges(englishBefore15, liveEnglish, WAVE_15_ENGLISH_REWORDED, WAVE_14_REMOVED, 'app dictionary', 'wave 15');
  const englishBefore14 = readFileSync(path('tests/fixtures/i18n-before-wave-14.tsx.txt'), 'utf8');
  assert.equal(sha(englishBefore14), '9d96cbcd3986b7955c1a326491a8c3bf5cbb9fe63d5185b2d4e05307f205a27b', 'complete app dictionary after the wave 13 edits remains exact');
  assertOnlyWaveChanges(englishBefore14, englishBefore15, WAVE_14_ENGLISH_REWORDED, WAVE_14_REMOVED, 'app dictionary', 'wave 14');
  const englishBefore13 = readFileSync(path('tests/fixtures/i18n-before-wave-13.tsx.txt'), 'utf8');
  assert.equal(sha(englishBefore13), 'c113a108d9c1cd9728cb39c172fc1cbf7aa35fa9de393e23779e96d84d0a845d', 'complete app dictionary after the wave 11 additions remains exact');
  assertOnlyWaveChanges(englishBefore13, englishBefore14, WAVE_13_ENGLISH_REWORDED, WAVE_13_ENGLISH_REMOVED, 'app dictionary', 'wave 13');
  const english = readFileSync(path('tests/fixtures/i18n-before-wave-11.tsx.txt'), 'utf8');
  assert.equal(sha(english), 'd37673fb5c1a65ea78b4981b9ef24ade6f174365c7c999f20c3f03bc8326f3c7', 'complete app dictionary after the reviewed report-footnote layer remains exact');
  assertOnlyWave11Additions(english, englishBefore13);
  const predecessor = english
    .replace('MENTOR_ENGLISH_PENDING, REPORT_FOOTNOTE_ENGLISH_PENDING, type Dict', 'MENTOR_ENGLISH_PENDING, type Dict')
    .replace('  ...REPORT_FOOTNOTE_ENGLISH_PENDING,\n', '');
  assert.equal(sha(predecessor), 'e59b3c22b8d89455c3862be6f418e52b3f47762ad504bcfa4e7f35cb1cc22318', 'canonical English Study source dictionary remains exact after only the two reviewed non-Study additions');
  assert.equal(sha(readFileSync(path('lib/learner-ui-english.ts'))), '7d29b6d32a551a57070489ad33ccee003a2ebdd84a13874360e976af20e6fe74', 'canonical English learner UI source remains exact');
  const liveZulu = readFileSync(path('lib/locales/zu.ts'), 'utf8');
  assert.equal(sha(liveZulu), '85491dec24d841716c326c009a1f772a8f44e18ebe259bb940b49652691a2bcf', 'complete isiZulu locale source after the wave 14 edits');
  const zuluBefore14 = readFileSync(path('tests/fixtures/zu-before-wave-14.ts.txt'), 'utf8');
  assert.equal(sha(zuluBefore14), '6d2d7aabb38ed86ff6fc114357bc9b767e9bccf7fc4ba3b54858c83c49c00046', 'complete isiZulu locale source after the wave 13 edits remains exact');
  assertOnlyWaveChanges(zuluBefore14, liveZulu, WAVE_14_ZULU_REWORDED, WAVE_14_REMOVED, 'isiZulu locale', 'wave 14');
  const zuluBefore13 = readFileSync(path('tests/fixtures/zu-before-wave-13.ts.txt'), 'utf8');
  assert.equal(sha(zuluBefore13), 'ff57af75e2a8583e76b193bc1a92855d0c259acdd75d39d859cba49f5dee95ce', 'complete isiZulu locale source after the wave 11 Ask drafts remains exact');
  assertOnlyWaveChanges(zuluBefore13, zuluBefore14, WAVE_13_ZULU_REWORDED, WAVE_13_ZULU_REMOVED, 'isiZulu locale', 'wave 13');
  assert.equal(sha(rewindWave11Locale(zuluBefore13)), '2462f4298e9e854c041328ec3c030e85efaffd08c9c1f3ab104a71dc8e5ba6dc', 'isiZulu locale source remains exact');
  });
}

/** Project the exact predecessor only after the complete current source hash validates. */
export function studyUiDueUnlockSourceBefore(file: string, bytes: string | Uint8Array): string | Uint8Array {
  return withBlindReviewedCorrectionReadScope(() => {
  bytes = blindReviewedSourceBefore(file, bytes);
  if (file !== 'lib/locales/ve.ts') return bytes;
  ensureStudyUiDueUnlockCurrent();
  const supplied = Buffer.from(bytes);
  const live = readFileSync(path(file));
  if (supplied.equals(predecessorSource)) return bytes;
  if (supplied.equals(live)) return typeof bytes === 'string' ? predecessorSource.toString() : predecessorSource;
  return bytes;
  });
}

/** The four non-Study English-pending groups wave 11 spreads into the VE dictionary. */
const WAVE_11_PENDING: Record<string, string> = { ...CHAT_PANEL_ENGLISH_PENDING, ...PHOTO_UPLOAD_ENGLISH_PENDING, ...PROFILE_SHEET_ENGLISH_PENDING, ...NETWORK_FAILURE_ENGLISH_PENDING };
/** Remove exactly the wave 11 pending keys, each only if it still holds its exact English source value. */
function rewindWave11Dictionary(actual: unknown): unknown {
  if (!actual || typeof actual !== 'object') return actual;
  const dict = actual as Record<string, unknown>;
  const keys = Object.keys(WAVE_11_PENDING);
  if (!keys.some(key => Object.hasOwn(dict, key))) return actual;
  const before = { ...dict };
  for (const key of keys) {
    assert.equal(Object.hasOwn(currentLocale, key), false, `${key}: wave 11 key is new, absent from the due/unlock dictionary`);
    assert.equal(dict[key], WAVE_11_PENDING[key], `${key}: wave 11 holds the exact English pending value`);
    delete before[key];
  }
  return before;
}

/** Wave 13 (copy-12, 16 Oct 2026) reworded the organisation role label inside the English-pending
 * groups. Every locale that still spreads those groups untranslated now carries the reworded
 * value, so dated owners see the exact pre-wave-13 label again. Wave 11's own group
 * (profileRoleNgo) is removed by rewindWave11Dictionary first; this handles the rest. */
const WAVE_13_PENDING_REWORDED: Record<string, { before: string; after: string }> = {
  mentorRoleNgo: { before: 'NGO Staff', after: 'Organisation staff' },
};
function rewindWave13PendingDictionary(actual: unknown): unknown {
  if (!actual || typeof actual !== 'object') return actual;
  const dict = actual as Record<string, unknown>;
  const keys = Object.keys(WAVE_13_PENDING_REWORDED).filter(key => Object.hasOwn(dict, key) && dict[key] === WAVE_13_PENDING_REWORDED[key].after);
  if (!keys.length) return actual;
  const before = { ...dict };
  for (const key of keys) {
    assert.equal((MENTOR_ENGLISH_PENDING as Record<string, string>)[key], WAVE_13_PENDING_REWORDED[key].after, `${key}: live English pending source holds the exact wave 13 wording`);
    before[key] = WAVE_13_PENDING_REWORDED[key].before;
  }
  return before;
}

/** Wave 15 (copy-07, 22 Oct 2026) put 17 English-pending labels into sentence case. Locales that
 * still spread those groups untranslated carry the new wording, so dated owners see the exact
 * pre-wave-15 label again. Each after value must be the live line in lib/i18n-pending.ts. */
const WAVE_15_PENDING_REWORDED: Record<string, { before: string; after: string }> = {
  journalOpenRecords: { before: 'Open My Records', after: 'Open my records' },
  speciesPickerTitle: { before: 'Plant Catalog', after: 'Plant catalog' },
  designPaletteElementsDragTitle: { before: 'Drag Elements panel', after: 'Drag elements panel' },
  designPrintTitle: { before: 'Print / Export', after: 'Print / export' },
  designPrintSheetBase: { before: 'Existing Site & Base', after: 'Existing site & base' },
  designPrintSheetSector: { before: 'Sector Analysis', after: 'Sector analysis' },
  designPrintSheetZones: { before: 'Permaculture Zones', after: 'Permaculture zones' },
  designPrintSheetWater: { before: 'Water & Irrigation', after: 'Water & irrigation' },
  designPrintSheetEarthworks: { before: 'Earthworks & Contour Setting-Out', after: 'Earthworks & contour setting-out' },
  designPrintSheetPlanting: { before: 'Planting & Agroforestry', after: 'Planting & agroforestry' },
  designPrintSheetStructures: { before: 'Livestock & Infrastructure', after: 'Livestock & infrastructure' },
  designPrintSheetAll: { before: 'Integrated Masterplan', after: 'Integrated masterplan' },
  designPrintSheetImplementation: { before: 'Implementation & Phasing', after: 'Implementation & phasing' },
  designGlossyPreviewTitle: { before: 'Preview & Export', after: 'Preview & export' },
  designGlossyExportShare: { before: 'Export & Share', after: 'Export & share' },
  designGlossyExactCanvas: { before: 'Design Map', after: 'Design map' },
  designGlossyAiHybrid: { before: 'AI Polished', after: 'AI polished' },
};
function rewindWave15PendingDictionary(actual: unknown): unknown {
  if (!actual || typeof actual !== 'object') return actual;
  const dict = actual as Record<string, unknown>;
  const keys = Object.keys(WAVE_15_PENDING_REWORDED).filter(key => Object.hasOwn(dict, key) && dict[key] === WAVE_15_PENDING_REWORDED[key].after);
  if (!keys.length) return actual;
  const pendingSource = readFileSync(path('lib/i18n-pending.ts'), 'utf8');
  const before = { ...dict };
  for (const key of keys) {
    assert.ok(pendingSource.includes(`\n  ${key}: '${WAVE_15_PENDING_REWORDED[key].after}',\n`), `${key}: live English pending source holds the exact wave 15 wording`);
    before[key] = WAVE_15_PENDING_REWORDED[key].before;
  }
  return before;
}

/** Project the exact prior dictionary; callers compare that result in the older history layer. */
export function studyUiDueUnlockLocaleBefore(actual: unknown): unknown {
  return withBlindReviewedCorrectionReadScope(() => {
  ensureStudyUiDueUnlockCurrent();
  actual = rewindWave13PendingDictionary(rewindWave11Dictionary(rewindWave15PendingDictionary(actual)));
  assert.deepEqual(currentLocale, JSON.parse(currentLocaleBytes.toString()));
  if (JSON.stringify(actual) === JSON.stringify(predecessorLocale)) return structuredClone(actual);
  if (JSON.stringify(actual) === JSON.stringify(currentLocale)) return structuredClone(predecessorLocale);
  return actual;
  });
}

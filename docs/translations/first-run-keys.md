# First-run copy awaiting a human translator

## What this is

ImbewuField is a permaculture planning app for South African smallholder farmers. Most of it
runs on an ordinary phone, often on a slow connection, and the person using it may be reading a
touchscreen app for the first time. The copy below is what she sees in roughly her first ten
minutes: the home screen, the map's first-time guidance, the "what should I do next" coach, and
the "+ Add" tool she uses to put things on her map.

**This document is a handoff, not a translation.** None of the English text below has been
machine-translated, and none should be. Every non-English locale file in `lib/locales/` is
missing every key on this page outright — not a rough or auto-translated version, just absent —
so right now a farmer in any of the ten other languages sees this exact English text. That is
worse than a bad translation, because the app otherwise looks fully translated to her: this is
the copy that teaches her how the app works, arriving in a language she may not read at the exact
moment she needs it most.

## Who should translate this

A fluent first-language speaker who also understands smallholder farming — the words for
"boundary," "bed," "harvest," and "tank" need to be the ones a farmer actually uses, not a
dictionary-literal translation. If you're unsure whether a word is the everyday farming term or
the formal/academic one, prefer the everyday one.

## Style: plain, physical, no metaphors

The English source deliberately avoids metaphor and idiom, and the translation should too:

- Concrete and physical: "Tap each corner of your land," not "outline your property."
- Second person, direct address: "your land," "your crop plan" — she is being spoken to, not
  described in the abstract.
- Short sentences. Where English uses an em dash to attach a second short clause ("Pick one —
  Lima will put the right tool in your hand"), it's fine to split that into two sentences if your
  language reads more naturally that way — the meaning matters more than the punctuation.
- Avoid idioms that won't survive translation. If an English phrase is idiomatic ("she's on the
  right track"), translate the plain meaning, not the image.

**"Lima" is the app's helper — a name, not a word.** It's presented as the character/persona
guiding her through the app ("Lima, your planting helper," "Lima measures it for you," "Lima
builds your planting calendar"). Leave "Lima" exactly as-is everywhere it appears — do not
translate it, transliterate it, or substitute a local equivalent, the same way you wouldn't
translate a person's name.

**Placeholders stay exactly as written.** Anything in curly braces — `{area}`, `{pct}`, `{site}`,
`{kg}`, `{ph}`, `{n}`, and so on — is filled in by the app at runtime with a real number or name.
Keep the placeholder token itself unchanged (same spelling, same braces); move it to wherever it
belongs in your language's word order, but don't translate or paraphrase what's inside the braces.

## How this list was produced, and the numbers

An earlier audit (against an older commit) reported 968 English keys, 715 present in all ten
non-English locale files, and 253 missing from all ten — with "253 keys missing in every
language" read as the accidental result of one translation pass happening and then new English
keys being added afterward, without ever touching the other ten locale files.

Re-measured against the current branch tip (`77f0e53`), by actually importing every locale
module and `lib/i18n.tsx`'s English dictionary and diffing their real key sets (not a text
search — this catches a key correctly whether it is written out directly or arrives from one of
the shared "pending" blocks in `lib/i18n-pending.ts`):

| | Audit (older commit) | Measured now (`77f0e53`) |
|---|---|---|
| Total English keys | 968 | **1,368** |
| Present in all 10 locales | 715 | **1,115** |
| **Missing from all 10 locales** | **253** | **253** |
| — of which, first-run (`welcome*`, `coach*`, `guided*`, `add*`) | 61 | **59** |

The total-missing count (253) still matches exactly. The English dictionary itself has grown a
lot since the audit (968 → 1,368 keys — mostly the Design Studio's own pending block, which is
tracked separately, see below), but the specific set of "added and never propagated to any
locale" keys landed at the same size. The first-run subset is 59, not 61 — two fewer than the
audit counted under "guided-flow keys." That bucket may have shrunk since the audit, or the audit
drew its line slightly differently; either way, 59 is what's actually in the ten locale files'
gap today, verified directly against source, not carried over from the older report.

Every locale is missing exactly the same 253 keys — there is no key that's translated in some
locales and missing in others. One clean, identical gap across all ten.

## Priority 1 — her first ten minutes (59 keys)

Ordered the way she actually meets them: home screen, then the map's first-time guidance, then
the "what's next" coach that follows her through setting up a site, then the "+ Add" tool she
uses along the way.

| Key | English text | Screen / context |
|---|---|---|
| `welcomeHeroTitle` | Let's find your land. | Home screen, hero card — the first thing a new farmer sees |
| `welcomeHeroSub` | One tap — Lima reads your soil, rain and climate. | Home screen, hero card |
| `welcomeFindLand` | Find my land | Home screen, hero card — primary button |
| `welcomeShowExample` | Show me an example first | Home screen, hero card — secondary button (opens the sample/demo site) |
| `guidedBarSearch` | Search your town, or tap your home on the map. | Map screen — first-time guidance banner, shown before she has placed a pin |
| `guidedBarLocate` | Use my location | Map screen — button in that same first-time banner |
| `coachOverline` | Next step | "What's next" coach card — small label above the current step's title |
| `coachStepBoundaryTitle` | Walk your boundary | Coach card — step 1 of 4 |
| `coachStepBoundaryBody` | Tap each corner of your land. Lima measures it for you. | Coach card — step 1 body |
| `coachStepBoundaryCta` | Trace now | Coach card — step 1 button |
| `coachStepSurveyTitle` | Tell Lima about this land | Coach card — step 2 of 4 |
| `coachStepSurveyBody` | A few quick questions — water, soil, what grows here. | Coach card — step 2 body |
| `coachStepSurveyCta` | Fill the survey | Coach card — step 2 button |
| `coachStepDesignTitle` | Design your farm | Coach card — step 3 of 4 |
| `coachStepDesignBody` | Place beds, trees and water on your real land. | Coach card — step 3 body |
| `coachStepDesignCta` | Open the Studio | Coach card — step 3 button |
| `coachStepCropTitle` | Make your crop plan | Coach card — step 4 of 4 |
| `coachStepCropBody` | Choose crops and Lima builds your planting calendar. | Coach card — step 4 body |
| `coachStepCropCta` | Plan crops | Coach card — step 4 button |
| `coachDoneTitle` | Your site is fully planned | Coach card — shown once all four steps are complete |
| `coachDoneBody` | Lima will keep watch. Come back to log harvests and journal. | Coach card — completion body |
| `coachDoneCta` | Done | Coach card — completion button |
| `coachDismiss` | Hide this tip | Coach card — dismiss control |
| `coachGoalFeed` | Your goal: feed the family — Lima favours year-round food crops. | Coach card — shown when her stated goal is feeding the household |
| `coachGoalIncome` | Your goal: earn income — Lima favours market crops. | Coach card — shown when her stated goal is income |
| `coachGoalSoil` | Your goal: restore the soil — Lima favours soil builders. | Coach card — shown when her stated goal is soil health |
| `addButton` | Add | Map screen — the "+" button that opens the add-tools sheet |
| `addSheetTitle` | What do you want to add? | Add-tools sheet — heading |
| `addSheetSub` | Pick one — Lima will put the right tool in your hand. | Add-tools sheet — subheading |
| `addSheetClose` | Close | Add-tools sheet — close button |
| `addGroupLand` | My land | Add-tools sheet — group heading |
| `addGroupGrowing` | Growing | Add-tools sheet — group heading |
| `addGroupWater` | Water | Add-tools sheet — group heading |
| `addGroupStructures` | Paths & structures | Add-tools sheet — group heading |
| `addOpensStudioChip` | Opens Studio | Add-tools sheet — badge shown when a row hands off to the Design Studio |
| `addOpensMapChip` | Opens map | Add-tools sheet — badge shown when a row hands off to the map |
| `addLabelBoundary` | Land boundary | Add-tools sheet — item label |
| `addHintBoundary` | Trace the edge of your land. | Add-tools sheet — item hint |
| `addLabelHouse` | House / Building | Add-tools sheet — item label |
| `addHintHouse` | Draw the outline of your house or main building. | Add-tools sheet — item hint |
| `addLabelLawn` | Lawn | Add-tools sheet — item label |
| `addHintLawn` | Draw a grass area that is already there. | Add-tools sheet — item hint |
| `addLabelVegGarden` | Veg garden (existing) | Add-tools sheet — item label |
| `addHintVegGarden` | Draw a garden that already grows. | Add-tools sheet — item hint |
| `addLabelVegBed` | New veg bed | Add-tools sheet — item label |
| `addHintVegBed` | Place a new bed to plant. | Add-tools sheet — item hint |
| `addLabelTree` | Tree | Add-tools sheet — item label |
| `addHintTree` | Mark a tree — existing or planned. | Add-tools sheet — item hint |
| `addLabelWaterTank` | Water tank | Add-tools sheet — item label |
| `addHintWaterTank` | Place a JoJo or tank. | Add-tools sheet — item hint ("JoJo" is a South African brand name used generically for a water tank — keep it, don't translate it) |
| `addLabelWaterBody` | Dam / pond | Add-tools sheet — item label |
| `addHintWaterBody` | Trace water on your land. | Add-tools sheet — item hint |
| `addLabelTap` | Tap | Add-tools sheet — item label (a water tap/faucet, not a touchscreen tap) |
| `addHintTap` | Mark a tap point. | Add-tools sheet — item hint |
| `addLabelPath` | Path | Add-tools sheet — item label |
| `addHintPath` | Draw a walking path. | Add-tools sheet — item hint |
| `addLabelFence` | Fence | Add-tools sheet — item label |
| `addHintFence` | Draw a fence line. | Add-tools sheet — item hint |
| `addToolsPanelRow` | Add to my map | Design Studio — the same add-tools entry point, worded for that surface |

## Also her first ten minutes — flagged in code, but not yet on any translator's desk

These seven keys are **not** in the 253 count above — they already exist in every locale file, so
they don't show up as "missing." They were added in the most recent onboarding rework
(`components/LimaBar.tsx`, the help strip on the home screen, and the quick-journal card next to
it) using the same "explicit English pending" pattern as the Design Studio block below: the real
English text is spread into every locale file on purpose, as a visible placeholder, rather than
silently falling back. That makes the gap honest in the code, but it's still English in all ten
languages on screen, and — unlike the Design Studio block — nobody has handed it to a translator
yet. Worth including in the same review pass, since it sits on the home screen next to the
first-run copy above.

| Key | English text | Screen / context |
|---|---|---|
| `limaWhoIs` | Lima, your planting helper | Home screen — introduces "Lima" by name the first time |
| `limaAskButton` | Ask for help | Home screen — help strip button |
| `limaPhotoButton` | Photo | Home screen — help strip button |
| `homeQuickJournalDesc` | Notes & photos | Home screen — quick-journal card description |
| `journalLocalOnlyNote` | Kept on this phone. | Field Journal screen |
| `journalWeightsLiveElsewhere` | Harvest weights and sales go in My Records. | Field Journal screen |
| `journalOpenRecords` | Open My Records | Field Journal screen — button |

(Guarded by `tests/gogo-first-run.test.ts`, which checks these keys are still spread into every
locale as explicit pending English, so they can't quietly disappear before a translator sees
them.)

**Not in this document:** the Design Studio has a much larger pending-English block of its own
(step guidance, the palette, print/export chrome, and more). It's real first-run-*adjacent* copy
for a farmer who opens the Studio, but it's already tracked with its own handoff list — see
`docs/i18n-needs-translation.md` — so it isn't duplicated here.

---

## Priority 2 — the remaining 194 keys (lower priority)

Everything else that's missing from all ten locales. Grouped by feature so related copy stays
together; still real, still worth a fluent reviewer's time, just not the first thing she sees.

### Household survey — 76 keys
`components/SiteSurveySheet.tsx`. The "tell us about your household and what you grow" form —
reached from the coach's "Fill the survey" step above, so it's close behind priority 1, but it's
a long form rather than first-contact copy.

| Key | English text |
|---|---|
| `surveyStepHouseholdInfo` | Household Info |
| `surveyStepLandLocation` | Land & Location |
| `surveyStepCurrentProduction` | Current Production |
| `surveyStepLivestockPoultry` | Livestock & Poultry |
| `surveyStepIncomeSales` | Income & Sales |
| `surveyStepResourcesInputs` | Resources & Inputs |
| `surveyCloseAriaLabel` | Close |
| `surveyDiscardConfirm` | Discard your answers so far? This questionnaire has not been saved yet. |
| `surveyDiscardBtn` | Discard answers |
| `surveyAdultsChip1` | 1 |
| `surveyAdultsChipRange2to5` | 2–5 |
| `surveyAdultsChipRange6to10` | 6–10 |
| `surveyAdultsChipRange10Plus` | 10+ |
| `surveyAutoFillNote` | Auto-filled from your traced shapes ({area} m²) — tap to adjust |
| `surveyEfficiencySuffix` | efficiency |
| `surveyNumInputDefaultPlaceholder` | e.g. 120 |
| `surveyExistingGrowingAreaLabel` | Area currently under cultivation |
| `surveyExistingGrowingAreaPlaceholder` | e.g. 200 |
| `surveyExistingGrowingAreaHint` | Rough size in square metres of what you already grow |
| `surveyCurrentProductionSurveyLabel` | Current production survey |
| `surveyReportWhatYouKnow` | Report what you know — leave anything blank if you are not sure. This helps us measure progress over time. |
| `surveyWhatDoYouProducePlaceholder` | What do you produce? |
| `surveyQtyPerYearLabel` | Quantity / year |
| `surveyUnitLabel` | Unit |
| `surveyUnitPlaceholder` | e.g. kg, bunches |
| `surveyUsedByHouseholdLabel` | Used by household |
| `surveySoldLabel` | Sold |
| `surveyIncomeEarnedLabel` | Income earned (ZAR) |
| `surveyHarvestMonthsLabel` | Harvest months |
| `surveyFaoFoodGroupLabel` | FAO food group |
| `surveyFoodGroupNotSure` | Not sure |
| `surveyFoodGroupsReportedCount` | {n} food groups reported. |
| `surveyFoodGroupsNotReported` | No food groups reported yet. |
| `surveyFaoHddsFooter` | This maps to the FAO Household Dietary Diversity Score used in your report. |
| `surveyProdLeafyGreensLabel` | Leafy greens |
| `surveyProdLeafyGreensHint` | Spinach, kale, cabbage, etc. |
| `surveyProdOtherVegLabel` | Other vegetables |
| `surveyProdOtherVegHint` | Tomatoes, onions, peppers, etc. |
| `surveyProdStapleCropsLabel` | Staple crops |
| `surveyProdStapleCropsHint` | Maize, beans, sweet potato, etc. |
| `surveyProdFruitLabel` | Fruit |
| `surveyProdFruitHint` | From trees or vines |
| `surveyProdNutsBerriesLabel` | Nuts & berries |
| `surveyProdNutsBerriesHint` | From trees or shrubs |
| `surveyProdEggsLabel` | Eggs |
| `surveyProdPoultryLabel` | Poultry meat |
| `surveyProdRabbitsLabel` | Rabbits |
| `surveyProdHoneyLabel` | Honey |
| `surveyProdOtherLabel` | Other |
| `surveyProdOtherHint` | Anything not listed above |
| `surveyToggleSellProduceSub` | Your production rows can record what was sold and income earned |
| `surveyIncomeSalesNote` | You can record what was sold and income earned against each item in the Current Production step. |
| `surveyMonthJan` | Jan |
| `surveyMonthFeb` | Feb |
| `surveyMonthMar` | Mar |
| `surveyMonthApr` | Apr |
| `surveyMonthMay` | May |
| `surveyMonthJun` | Jun |
| `surveyMonthJul` | Jul |
| `surveyMonthAug` | Aug |
| `surveyMonthSep` | Sep |
| `surveyMonthOct` | Oct |
| `surveyMonthNov` | Nov |
| `surveyMonthDec` | Dec |
| `surveyHddsCereals` | Cereals |
| `surveyHddsRootsTubers` | Roots & tubers |
| `surveyHddsVegetables` | Vegetables |
| `surveyHddsFruit` | Fruit |
| `surveyHddsMeatPoultry` | Meat & poultry |
| `surveyHddsEggs` | Eggs |
| `surveyHddsFish` | Fish |
| `surveyHddsPulsesNutsSeeds` | Pulses, nuts & seeds |
| `surveyHddsMilk` | Milk & dairy |
| `surveyHddsOilsFats` | Oils & fats |
| `surveyHddsSugarsHoney` | Sugars & honey |
| `surveyHddsSpicesBeverages` | Spices & beverages |

### Community — 52 keys
`app/community/*` — the farmer-to-farmer nearby/board/messages feature. Currently dark-launched
(gated behind a flag, not yet visible to farmers), which is part of why it's lower priority here.

| Key | English text |
|---|---|
| `communityTagline` | Farmer to farmer |
| `communityTabNearby` | Nearby |
| `communityTabBoard` | Board |
| `communityTabMessages` | Messages |
| `communityNearbyEmpty` | No farmers nearby have opted in yet. |
| `communityNearbyIntro` | Farmers who choose to be visible show up here as an approximate area — never their exact homestead. |
| `communityMessageButton` | Message |
| `communityReportButton` | Report |
| `communityViewProfile` | View profile |
| `communityEditProfileTitle` | Your community profile |
| `communityEditProfileIntro` | Share as much or as little as you like. Nothing here is visible until you save it. |
| `communityDisplayNameLabel` | Display name |
| `communityDisplayNamePlaceholder` | e.g. Thabo M. |
| `communityAreaLabel` | Area / district |
| `communityAreaHint` | Town or district — not your exact address |
| `communityAreaPlaceholder` | e.g. Bergville, KZN |
| `communityBioLabel` | About you |
| `communityBioPlaceholder` | What you grow, what you're into… |
| `communityCropsLabel` | What you grow |
| `communityPhotosLabel` | Produce photos |
| `communityPhotosHint` | Up to 4 photos |
| `communityShowOnMapLabel` | Show me on the community map |
| `communityShowOnMapHint` | Your location shows as an approximate ~1km area, never your exact homestead |
| `communitySaveProfile` | Save profile |
| `communityDeleteProfile` | Delete my community profile |
| `communityDeleteProfileConfirm` | Delete your community profile? This removes your profile and map pin. Your board posts stay until you close them individually. |
| `communityBoardTitle` | Trade board |
| `communityBoardEmpty` | Nothing posted yet — be the first. |
| `communityBoardNewPost` | New post |
| `communityBoardCategory` | Category |
| `communityBoardKind` | Type |
| `communityBoardKindHave` | Have |
| `communityBoardKindWant` | Want |
| `communityBoardKindFree` | Free |
| `communityBoardDescription` | Description |
| `communityBoardDescriptionPlaceholder` | e.g. Heirloom tomato seedlings, 20 available |
| `communityBoardPost` | Post |
| `communityBoardClose` | Mark as done |
| `communityBoardDelete` | Delete |
| `communityMessagesEmpty` | No conversations yet. |
| `communityMessageInputPlaceholder` | Write a message… |
| `communitySend` | Send |
| `communitySendError` | Message didn't send — check your connection and try again. |
| `communityPostError` | Couldn't post — check your connection and try again. |
| `communityContactError` | Couldn't open the conversation — check your connection and try again. |
| `communityReportReasonPlaceholder` | What's wrong? |
| `communityReportSubmit` | Submit report |
| `communityReportSent` | Report sent. Thank you. |
| `communityReportError` | Couldn't send the report — check your connection and try again. |
| `communitySignInRequired` | Sign in to use the community layer. |
| `communityLoadError` | Couldn't load the community layer right now. Check your connection and try again. |
| `communityRetry` | Retry |

### Everything else — 66 keys

**My Records (harvest & sales log) — `components/MyRecords.tsx`**

| Key | English text |
|---|---|
| `myRecordsGuidePriceLabel` | Guide price, July 2026: |
| `myRecordsGuidePriceRange` | shops about R{wholesale}/kg · direct/farm gate about R{retail}/kg. |
| `myRecordsGuidePriceForKg` | For {kg} kg, that is roughly R{low}–R{high}. |
| `myRecordsGuideEstimated` | Estimated guide — confirm the local price. |
| `myRecordsGuideSourced` | Sourced guide — enter the price you actually agreed. |
| `myRecordsGuideMissing` | No trustworthy guide price is stored for this crop. Enter the price you actually agreed. |
| `myRecordsLoadError` | Couldn't load your latest records. Check your connection and try again — what's shown below may be out of date or incomplete. |
| `myRecordsRetry` | Retry |
| `recordsOrchardIn` | Orchard in |
| `recordsOrchardOut` | Orchard out |
| `recordsOrchardOutNote` | Orchard is switched off, so {kg} kg is not in this total: {names}. Nothing was deleted — switch it back on to count it again. |
| `recordsOrchardOutNoteMoney` | Orchard is switched off, so {kg} kg is not in the weight above: {names}. The rand total still counts every sale, orchard included. |
| `myRecordsExampleHeading` | Example — what a logged entry looks like |
| `myRecordsExampleBadge` | Example |

**Map results panel — `components/DataPanel.tsx`**

| Key | English text |
|---|---|
| `soilImprovementPhAcidic` | pH {ph} is acidic — add agricultural lime (1–2 t/ha) |
| `soilImprovementPhAlkaline` | pH {ph} is alkaline — add elemental sulphur or pine-needle mulch |
| `soilImprovementLowCarbon` | Organic carbon {oc}% is low — layer compost 5 cm deep, add kraal manure or biochar |
| `soilImprovementCompacted` | Bulk density {bd} g/cm³ suggests compaction — deep-rooted cover crops and broadfork open the profile |
| `soilImprovementHighClay` | High clay ({clay}%) — gypsum + organic matter improve drainage and workability |
| `soilImprovementSandy` | Sandy soil ({sand}%) — mulch heavily and boost CEC with compost and biochar |
| `photoSkippedNote` | Some photos couldn't be read, so they weren't added. iPhone photos are often HEIC, which this browser can't open — try JPEG/PNG copies or screenshots. |
| `photoAnalyseError` | Couldn't analyse those photos — check your connection and try again, or skip and generate without them. |

**Saved reports list — `components/report/SavedReportsList.tsx`**

| Key | English text |
|---|---|
| `savedSitesHeader` | Your Sites |
| `savedSitesBackLink` | All sites |
| `unsavedSiteGroupLabel` | Not saved as a site |
| `savedReportCountSingular` | saved report |
| `savedReportCountPlural` | saved reports |

**Home screen — `app/home/page.tsx`, `components/home/HomeHeroCard.tsx`**

| Key | English text |
|---|---|
| `homeMainSite` | Main site |
| `homeSetAsMain` | Set as main site |
| `homeMainSiteLabel` | ★ Main |
| `homeUpcomingTasks` | Upcoming tasks |
| `homeTaskBoardViewPlan` | View full plan |
| `continueSiteTitle` | Continue with {site} |
| `continueSitePct` | {pct}% complete |
| `continueSiteCta` | Open my site |
| `startNewSite` | Start a new site |

**Manage-site menu — `components/SiteManageMenu.tsx`**

| Key | English text |
|---|---|
| `manageSite` | Manage this site |
| `renameSite` | Rename |
| `setMainSite` | Set as main site |
| `mainSiteAlready` | Main site |
| `deleteSite` | Delete site |
| `deleteSiteConfirm` | Delete this saved site? |
| `saveBtn` | Save |
| `cancelBtn` | Cancel |

**Map screen chrome — `components/Map.tsx`, `app/farmer/page.tsx`**

| Key | English text |
|---|---|
| `designStudioLabel` | Design Studio |
| `mapHeldTitle` | The map is taking a break |
| `mapHeldBody` | This page closed unexpectedly a few times in a row, so the map is paused to get you back in. Your reports, photos and places all still work below. |
| `mapHeldLoad` | Load the map |
| `printBaseMapButton` | Print base map |
| `labelsDesignToggle` | My design |
| `navPlantingCalendar` | Planting Calendar |
| `navCommunity` | Community |

**Settings, voice and sample mode**

| Key | English text | Context |
|---|---|---|
| `settingsGuideMe` | Guide me | Not currently wired to any screen — verify before translating |
| `settingsGuideMeDesc` | Show the next-step guide on your site report. | Not currently wired to any screen — verify before translating |
| `settingsVoiceLabel` | Lima reads aloud | Not currently wired to any screen — verify before translating |
| `settingsVoiceDesc` | Speak tips out loud when a voice is available. | Not currently wired to any screen — verify before translating |
| `ttsSpeakLabel` | Read aloud | `components/SpeakButton.tsx` — read-aloud control used across the app |
| `ttsStopLabel` | Stop reading | `components/SpeakButton.tsx` |
| `demoBannerLabel` | Example farm | `app/example/page.tsx` — sample/demo mode banner |
| `demoBannerBody` | This is what a finished site report looks like. | `app/example/page.tsx` |
| `demoExit` | Leave the example | `app/example/page.tsx` |

**A few standalone keys**

| Key | English text | Context |
|---|---|---|
| `lifeGuideSelectLocation` | Select a location on the map first | `components/LifeGuide.tsx` |
| `lifeGuideBuilding` | Building your living systems guide... | `components/LifeGuide.tsx` |
| `lifeGuideLoadError` | Could not load — check connection | `components/LifeGuide.tsx` |
| `insightsGenerateError` | Could not generate the report — check your connection and try again. | `components/InsightsPanel.tsx` |
| `popiaGoalPickOne` | Pick one to continue | `components/PopiaConsent.tsx` — data-consent screen |

## A note on the four "not currently wired" keys

`settingsGuideMe`, `settingsGuideMeDesc`, `settingsVoiceLabel`, `settingsVoiceDesc` have English
text defined but no code anywhere currently reads them (checked across `app/`, `components/`,
`lib/`). That's a separate, small housekeeping question for engineering — either they're about to
be wired up, or they're leftover from a shelved settings panel — not something to hold up
translation for. Translating them now costs little and means they're ready either way.

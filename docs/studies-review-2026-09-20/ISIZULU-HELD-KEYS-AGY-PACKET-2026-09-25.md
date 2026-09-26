# ImbewuField isiZulu review packet — AI draft, not approval

**Source:** `origin/main` commit `2796d624c2f75a0de3a05fd75d593f2812b0fa0d`. `node scripts/course-i18n-status.mjs` reports 1,441 English direct keys, 1,508 isiZulu direct keys, 1,427 shared, and 14 missing English keys. Key presence does not establish route coverage or translation quality.

**Preparation:** Agy was invoked through `/opt/homebrew/bin/agy` using its signed-in CLI, one non-interactive print turn. It returned `SUCCESS` in 33.63 seconds, one turn. Reported usage: 17,036 input tokens, 11,467 output tokens, 8,578 thinking tokens, 28,503 total. No price/cost field was returned. These are unreviewed AI drafts; I have not assessed their isiZulu fluency.

| Key | Exact English source | Agy isiZulu draft (review only) | Risk / review point |
|---|---|---|---|
| `designStudioLabel` | Design Studio | `I-Design Studio` (alternative: `Isitudiyo Sokuklama`) | Confirm preferred product term and short-label fit with a first-language reviewer. |
| `bookTabCharts` | Charts | `Amashadi` | Confirm this label matches the chart view and fits the tab. |
| `soilImprovementCompacted` | Bulk density {bd} g/cm³ suggests compaction — deep-rooted cover crops and broadfork open the profile | **HOLD** — provisional: `Ukuminyana kwenhlabathi ({bd} g/cm³) kusikisela ukugxilana — izitshalo zokumboza ezinezimpande ezijulile kanye ne-broadfork kuvula inhlabathi` | Soil diagnosis and treatment advice are held. Check terminology and the source claim with a qualified local agriculture reviewer; preserve `{bd}` and `g/cm³`. |
| `soilImprovementHighClay` | High clay ({clay}%) — gypsum + organic matter improve drainage and workability | **HOLD** — provisional: `Ubumba oluphezulu ({clay}%) — i-gypsum + izinsalela zemvelo kuthuthukisa ukuhamba kwamanzi nokulimeka kwenhlabathi` | Input and soil-effect claim held for qualified local review; preserve `{clay}%`. |
| `soilImprovementLowCarbon` | Organic carbon {oc}% is low — layer compost 5 cm deep, add kraal manure or biochar | **HOLD** — provisional: `I-organic carbon {oc}% iphansi — faka umquba ojulile ngo-5 cm, engeza umquba wesibaya noma i-biochar` | Contains an exact application depth and amendments; no endorsement. Check source, term choice and instruction with qualified local review; preserve `{oc}%` and `5 cm`. |
| `coachGoalSoil` | Your goal: restore the soil — Lima favours soil builders. | `Umgomo wakho: buyisela inhlabathi esimweni esihle — u-Lima ukhetha izitshalo ezakha inhlabathi.` | Owner/source review for the “Lima favours” claim and “soil builders” meaning, plus first-language review. |
| `soilImprovementPhAlkaline` | pH {ph} is alkaline — add elemental sulphur or pine-needle mulch | **HOLD** — provisional: `i-pH {ph} ine-alkaline — faka i-elemental sulphur noma umquba wezinaliti zikaphayini` | Soil treatment advice held; check terms and source claim with qualified local review; preserve `{ph}`. |
| `soilImprovementPhAcidic` | pH {ph} is acidic — add agricultural lime (1–2 t/ha) | **HOLD** — provisional: `i-pH {ph} ine-asidi — faka umcako wezolimo (1–2 t/ha)` | Exact rate and soil treatment advice held; preserve `{ph}` and `1–2 t/ha`; qualified local review required. |
| `coachGoalFeed` | Your goal: feed the family — Lima favours year-round food crops. | `Umgomo wakho: ukwondla umndeni — u-Lima ukhetha izitshalo zokudla zonyaka wonke.` | Owner/source review for the “Lima favours” claim and intended meaning; first-language review. |
| `soilImprovementSandy` | Sandy soil ({sand}%) — mulch heavily and boost CEC with compost and biochar | **HOLD** — provisional: `Inhlabathi enesihlabathi ({sand}%) — faka umquba wokumboza kakhulu futhi ukhuphule i-CEC nge-compost ne-biochar` | Soil advice and technical term CEC held; qualified local review for claim and comprehension; preserve `{sand}%`. |
| `coachGoalIncome` | Your goal: earn income — Lima favours market crops. | `Umgomo wakho: ukungenisa imali — u-Lima ukhetha izitshalo ezidayiswayo emakethe.` | Owner/source review for the “Lima favours” claim and intended meaning; do not infer an income guarantee; first-language review. |
| `bookTabSpent` | Spent | `Okusetshenzisiwe` | Confirm this distinguishes expenditure from other recorded use in the money book. |
| `bookTabSold` | Sold | `Okudayisiwe` | Confirm this matches the transaction category and fits the tab. |
| `bookTabPicked` | Picked | `Okukhiwe` (alternative: `Okuvuniwe`) | Reviewer to confirm whether the category means picking/plucking or the broader harvest recorded by the app. |

## Consequential English holds

Keep the existing isiZulu warning visible beside English consent details until a fluent isiZulu reviewer and a POPIA/privacy reviewer check the text against `lib/consent.ts`, `components/ConsentPanel.tsx`, current rules and data views. Any bilingual pair must preserve these exact boundaries and actions:

- Sharing scopes: “Your crop sales and the money you earned from them”; “What you paid for seed, tools and inputs”; “Your harvest weights per crop”; “Which course modules you have finished”; “The answers you gave in programme surveys”; “Your exact plot location. With this off, only the district is shown.”
- All six switches start off; recipient identity (named organisation or fallback); active-scope count; save failure means “sharing settings have not changed”; “Stop sharing everything” revokes all scopes.
- Offline/save states must distinguish a failed save from a successful save, pending server acknowledgement from completed sync, and a preserved conflict/refusal from a removed queue entry. The documented flow allows downloading a copy and deliberately removing a queued change before reconciliation. Initial use, sign-in and preparation require connectivity; remote permission changes are rechecked after reconnection.
- Keep English paired with draft isiZulu for consent, location precision, save failures, sync/conflict, queued deletion and soil treatment messages until reviewers confirm that the translated wording preserves each consequence. Do not treat this AI packet as POPIA interpretation or agricultural advice.

**Limitations:** Agy generated the candidate wording. No fluent isiZulu, farmer, agricultural extension, privacy or legal review was performed. No source files or media were changed, and nothing was published. Several explanatory claims in Agy’s raw response went beyond the supplied source and are intentionally omitted here.

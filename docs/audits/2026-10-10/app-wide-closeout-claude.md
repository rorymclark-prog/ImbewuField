# App-wide audit close-out — 2026-10-10

- Auditor: Claude (integrator session), with a read-only re-check subagent
- Reviewed revision: main at 142a5988 plus PR #990 (branch `swarm/w10-audit-leftovers`)
- Deployment inspected: not inspected in a browser for this close-out
- Previous audit: the September 2026 app-wide audit (92 findings across a11y, perf, dead code, i18n, convention, clutter, bug and security). It was kept in the integrator's working notes and never filed in this archive, so the finding IDs are carried forward here.
- Scope: all routes and roles (farmer, mentor, student, ngo, funder)
- Evidence type: source review (grep + reads) and the automated tests added by each wave

## What was already done

Ten swarm waves (PROGRESS.md build log, late September to 9 October) fixed the findings:
Simple mode, theme tokens, isiZulu coverage, Lucide icons, tap targets, dead code, rate limits,
security headers and route guards. On 9 October a re-check of every ID against the code found
three still open. They are fixed in PR #990.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| tour-discovery-no-i18n | [medium] The automatic 'tour is always here' popup is 100% hardcoded English | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| report-jargon-english-only-footnote | [medium] Report footnote is untranslated, jargon-dense technical codes inside an otherwise bilingual report | implemented | Implemented in PR #990: footnote values (Köppen, rainfall pattern, seasons) are looked up by language; isiZulu wording pending translator (lib/i18n-pending.ts). |
| small-tap-targets-map-toolbar | [low] Element-count steppers and the guide button fall well under the 44px target used everywhere else on this screen | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| money-4 | [medium] The edit/delete controls on every sale and cost row are well under the app's own 44px tap-target floor | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| learning-11 | [low] Submission self-check toggle buttons carry no programmatic pressed/checked state | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| org-02 | [high] Field-facing 'remove' controls are well under the app's own 44px tap-target floor | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| platform-07 | [medium] Offline page's isiZulu 'English source' toggle has a sub-standard tap target, repeated across the page | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| release-notes-bundle-weight | [low] A 2300+ line, ever-growing changelog is shipped to every phone even though only 5 lines are ever shown | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| weather-fetched-twice-per-load | [medium] WeatherWidget fetches the same forecast twice on every farmer page load | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| org-09 | [low] 'Portfolio map →' link on ngo/funder headers forces a full page reload instead of a client-side route | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| people-07 | [low] Community board and profile photo uploads send the full-resolution file with no client-side resize, unlike the app's demo/report photo path | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| survey-route-orphaned-duplicate | [medium] /survey is an orphaned duplicate of the real site survey, with its own disconnected data store | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| reportdocview-never-rendered | [medium] ReportDocView — a fully built, tested report component — is never mounted anywhere | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| learning-07 | [low] A live lesson page imports content from a dated docs review-staging folder | implemented | Lesson pages import lib/course-*.json; `sourceFile` strings pointing at docs/ are metadata only. |
| learning-08 | [low] Two guide routes duplicate the generic dynamic guide page for no reason | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| design-09 | [low] The Design Studio's Guided/Pro mode split is now unreachable dead code | implemented | Implemented in PR #990: dead `designMode` constant, prop and one-value type removed. |
| org-08 | [low] Funder page passes an emoji to BrandLogo that is silently ignored — a live trap for the emoji-icon rule | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| platform-09 | [low] The site-password gate (/gate, /api/gate) is fully vestigial but still deployed and reachable | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| update-system-english-only | [high] The entire app-update toast/guide subsystem is hardcoded English with no translation hook | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| money-2 | [medium] The lender-export button on the Picked tab is English-only while the card around it is fully bilingual | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| money-5 | [low] A null yield/turnover/price figure on the Crop performance card prints the English word 'Unknown', unlike every label around it | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| learning-04 | [medium] Assignment due-date month abbreviations are hardcoded English and never localized | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| learning-05 | [medium] Tips & Help page has no isiZulu support at all | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| learning-06 | [medium] The entire Farm Finance course (24 lessons + practical project) has zero isiZulu localisation | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| design-01 | [high] Crash-recovery and storage-full banners are English-only | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| design-03 | [medium] SpeciesPicker (Planting step) is entirely untranslated | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| design-06 | [low] BasePhotoImport.tsx mixes translated and hardcoded-English instructional copy | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| design-07 | [low] Print/Export's 9 plan-sheet names are hardcoded English | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| org-04 | [medium] Programme names (FIELD_PROGRAMMES) are English-only on the mentor's primary Fieldwork screen, unlike the focus tags right next to them | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| org-07 | [low] Surveys page's 'Learn' lesson link is hardcoded English, unlike the identical control on every sibling page | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| people-04 | [high] /contact is 100% English with no isiZulu, unlike every other farmer screen in this area | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| people-06 | [low] Community map popup's 'View profile' button is English-only inside an otherwise fully-translated feature | verified | Verified already translated during PR #990; no change. |
| platform-02 | [high] 9 of 11 supported languages are under half-translated, with no on-screen indication (unlike isiZulu) | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| data-vendor-badges-theme-panel | [medium] ThemePanel 'Data sources' section shows named vendor badges, against the no-vendor-badge rule | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| onboarding-popia-hardcoded-light-theme | [medium] The two mandatory first-run modals ignore the theme system and always render light-mode hexes | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| stale-paper-hex-scattered | [low] The deprecated '#F7F2E9' paper hex (superseded by #FFFEFA) is hand-copied across 4 files | implemented | Implemented in PR #990: new `--on-forest` token; guard tests/stale-paper-hex.test.ts. Crop planner files and app/global-error.tsx deliberately keep the literal. |
| lima-bar-hardcoded-muted-color | [low] LimaBar's 'who is Lima' caption hardcodes a colour instead of a theme token | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| nav-drawer-unicode-glyphs-for-icons | [low] PWAUpdateNotifier and UpdateGuide use raw Unicode glyphs ('⌃', '✕', '×') instead of Lucide icons | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| stale-supervisor-comment | [low] Landing-page comment still references the retired 'supervisor' role | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| era5-nasa-vendor-badge | [medium] Rainfall stat carries a raw data-vendor badge ('ERA5' / 'NASA') | implemented | Badge removed; vendor names remain only in report source lines. |
| emoji-icons-in-ui | [low] Emoji used as UI icons on the Design Studio button and the survey notes tip | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| hardcoded-theme-colors-farmer-page | [low] Hairline and banner colours hardcoded instead of theme tokens | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| money-1 | [high] Every money chart on /records hardcodes light-mode ink colours, so dark mode makes them unreadable | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| money-6 | [medium] /exchange hardcodes its entire palette instead of the theme tokens the rest of the money area uses | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| money-7 | [low] MyRecords error and accent colours are hardcoded instead of the theme-aware --danger/--orange tokens | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| money-8 | [low] FarmMetrics headings and the offline banner hardcode colours one line away from correctly-themed siblings | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| learning-01 | [high] Ochre used as text colour for 'due soon' assignment badges | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| learning-02 | [high] CATEGORY_COLORS.design (ochre) reused verbatim as text colour across module/lesson UI | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| design-02 | [medium] Emoji and non-Lucide glyphs used as UI icons throughout the Design Studio | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| design-05 | [medium] Ochre (#C07A1E) used as text colour, not a fill, in five Design Studio files | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| design-08 | [medium] /design and most of components/design paint every surface with hardcoded hex instead of theme tokens | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| crops-02 | [high] The flagship crop planner ignores the theme system almost entirely | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| crops-03 | [high] Crop planner and calendar use fixed phone px with zero responsive scaling | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| crops-06 | [medium] Emoji used as UI icons on the print page toolbar and legend | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| crops-08 | [low] Ochre used as an unfilled icon stroke colour instead of a fill | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| crops-09 | [low] /calendar has unconverted hardcoded brand-color hex despite otherwise using theme tokens | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| org-05 | [medium] Mentor/funder/surveys pages hardcode literal colours instead of the theme tokens, so they will not follow dark/slate mode the way this same app already does correctly els | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| people-02 | [high] Community, contact, messages and atlas pages hardcode light-mode hex colours instead of theme tokens — they cannot follow dark mode | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| people-03 | [medium] Field Journal (a core farmer screen) hardcodes 'system-ui, sans-serif' everywhere, so its text never renders in Public Sans | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| people-05 | [low] app/example/page.tsx uses the deprecated Paper colour value CLAUDE.md explicitly flags as still-live | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| platform-06 | [medium] Ochre fill colour used as error-message text on /login and /gate, contrary to the 'ochre is a fill only' rule | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| updates-page-raw-changelog | [high] /updates renders 150+ raw engineering changelog entries with commit SHAs to every farmer | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| datapanel-13-tab-overload | [high] DataPanel exposes 13 tabs in one scrolling strip, several in ambiguous jargon | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| overview-tab-block-stack | [medium] Overview tab always stacks nine distinct blocks with no way to collapse any of them | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| money-9 | [high] The phone 'Charts' tab on /records stacks seven distinct blocks on one screen | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| money-10 | [medium] The 'Crop performance' card is an expert per-square-metre unit-economics table, not a farmer-first summary | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| money-11 | [medium] /invoice bundles four advanced disclosures onto one page for what is often a quick farm-gate sale | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| learning-09 | [medium] Production-readiness badge is permanent farmer-facing UI, not a farmer decision | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| learning-10 | [low] Offline-download quality picker is explicitly for facilitators/funders, not farmers, but shows for everyone | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| design-10 | [low] /design-studio-2 is an unlinked, unauthenticated scaffold with a hardcoded real-looking farm name | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| crops-04 | [high] Advanced financial/optimisation tooling is bundled into the one farmer-facing bed planner | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| crops-05 | [medium] /calendar duplicates /cropplan's job as a second, non-personalised nav destination | implemented | Hidden from Simple-mode nav; still listed under All tools. |
| org-06 | [medium] /ngo exposes a 9-tab control strip with overlapping tools — the clearest Simple/All-tools case in this area | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| people-08 | [low] /atlas is a full unrestricted globe explorer sitting in the main nav next to core farming tools | implemented | Hidden from Simple-mode nav; still listed under All tools. |
| platform-08 | [medium] Offline page exposes developer-shaped debug affordances directly to farmers | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| harvest-fill-invisible-text | [high] Ochre-dim fill paired with same-tone ink text makes primary CTA text unreadable | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| tabbar-organisation-mislabel | [medium] Funder/NGO bottom-tab mislabels the Network destination as 'Organisation' | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| garden-survey-deep-link-dead-tap | [high] Menu 'Garden Survey' link is a dead tap for any farmer with no saved site yet | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| money-3 | [medium] Sample-mode invoice-sale linking writes to real device storage instead of the in-memory sandbox | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| learning-03 | [medium] Locked-module unlock reason embeds the English module title even in isiZulu mode | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| design-04 | [medium] Print/Export live preview swallows render failures and shows a misleading empty state | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| crops-01 | [high] /calendar's 'filtered to your planned crops' feature is permanently dead | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| crops-07 | [low] Print button stays enabled and produces a blank print job when no pages are selected | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| org-01 | [high] /assessments has zero navigation chrome — a dead-end screen | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| org-03 | [medium] Non-staff, non-farmer roles (funder, mentor) are shown the farmer 'answer this survey' flow, and nothing stops them submitting a response | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| platform-05 | [medium] Sign-up form always blames the password field for any error, never the email field | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| people-01 | [high] /atlas is a fully public, unauthenticated door to unlimited third-party API calls | implemented | Atlas uses the guarded, rate-limited /api/location-data; Mapbox geocoding uses the public token. |
| platform-01 | [high] Paid AI routes still run auth in log-only mode; nothing flags this in production | blocked | Auth enforcement is an owner decision (REQUIRE_API_AUTH); rate limits and AI spend cap are in place. |
| platform-03 | [medium] /api/contours has no auth and no rate limit, and its cache is trivially bypassed, while it bills a metered Mapbox endpoint | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| platform-04 | [medium] No baseline HTTP security headers anywhere in the app (no CSP, no X-Frame-Options) | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |
| platform-10 | [low] /api/build-info is unauthenticated, unrate-limited, forks git subprocesses per request, and can leak the server's filesystem path | implemented | Still public by design, now rate-limited (120/5 min) and git output cached per process. |
| platform-11 | [low] /api/site-features and /api/location-data are unauthenticated with no rate limiting, sharing the app's own upstream quota | implemented | Source re-check on 9 Oct: fixed by swarm waves 1–9 (see PROGRESS.md build log). |

## Verification

- Typecheck: clean on PR #990
- Full test suite: green in CI on PR #990 (both `test` jobs)
- Output inspected: not inspected in a browser for this close-out; earlier waves checked their screens at 390×844
- Other limits: the re-check was by source, not by device. New isiZulu strings are pending a first-language translator.

## Next continuation

1. Owner decisions: REQUIRE_API_AUTH enforcement (platform-01), translator review of `docs/translation/pending-isizulu.csv`.
2. The crop planner files still carry the old `#F7F2E9` literal. Convert them once the Codex crop/production work settles (guarded by tests/stale-paper-hex.test.ts).
3. Any further app-wide work should start from a fresh audit filed here, not from this list.

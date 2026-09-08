# Site report identity, saved settings and cover review

Rory's report review: selecting Ubhejane did not carry its name into the workspace, saved reports did not explain their settings, and the opening picture/layout needed attention.

Based on main b37644a, including PR #425's crop-plan preview and original saved-map loading. This branch is isolated from the ongoing studies work.

## Implemented

- Use the report's stored farm name, then its matching saved place, before falling back to its old label. Carry the identity into the workspace, sidebar, visual/ink cover, share text and PDF filename. Do not use the first unrelated saved place when generating facts.
- Save generation wording, depth, language, bilingual choice, requested sections, timestamp and provider/model returned by the report endpoint. Restore those choices on reopening. Older reports explicitly say their settings were not recorded.
- Display original settings separately from next-report controls. Editing controls and pressing Save cannot relabel existing advice. Full-report visual language follows the displayed version; summaries can still use the chosen language.
- Generating a new report gets a new report ID. Saving it preserves the earlier stored version; repeat saves keep the same ID and saved date.
- Keep optional saved site/water snapshots absent rather than substituting unrelated live props.
- Offer automatic/map/photo/no-picture cover choices, used by screen and full-colour PDF; retain the map-original loading introduced by PR #425. Ground-photo thumbnails are no longer stretched across the entire cover.
- Reduce title, outer and preparation-panel spacing; strengthen selected setting states.

## Checks and boundaries

The regression test mounts the actual ReportView, edits wording, saves, regenerates with a mocked network response, then saves twice. It verifies original settings/date/text survive, the new version is separate and repeated Save does not duplicate it. No paid generation is used. Storage tests cover legacy/corrupt settings and snapshot round-tripping.

The deployed desktop preview was inspected: Ubhejane appears in the header and cover, the opening layout is more compact, and saving a regenerated sample retains both versions. Two quick saves exposed identical minute-only labels, so rows now include seconds and a short report reference. The original troublesome photograph was unavailable and this sample workspace had no saved cover image; photo/map visual verification and phone layout remain outstanding. The local preview was blocked by the cloud browser; the hosted branch preview was accessible.

Provider/model selection and R18 pricing, report/photo allowances and API funding remain proposals. This branch does not change models, enforce economic quotas, buy credit, alter lesson content, mutate saved geometry or bump PLAN_VERSION.

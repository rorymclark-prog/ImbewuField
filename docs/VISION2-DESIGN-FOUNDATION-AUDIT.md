# Vision 2 design-foundation audit

Audited against `origin/main` on 6 August 2026. This is a source audit, not a
visual-device audit: no browser session was available in this environment.

## Design-pack dependency

`ImbewuField_Vision_2_Complete_Design_Pack/Design_System/` is not present in
this worktree. QD3 says Rory holds the zip and says to ask for it rather than
guess values. Do not add the missing four-level shadow ramp or alter the type
scale until those files are supplied.

No palette work was performed. In particular, no `hex -> var()` codemod was
run and no existing warm-paper colour was changed.

## What already exists

- `app/globals.css:16-29` already declares the specified font families,
  radius tokens, and three named shadow tokens.
- `app/globals.css:107-134` already has a type scale, weights and line heights.
- `app/globals.css:534-536` already respects `prefers-reduced-motion`.
- `app/globals.css:486-505` gives the opt-in primary and ghost button
  primitives a 44 px minimum height.

The queue premise that the app has no radius tokens, shadow ramp,
reduced-motion block or typography scale is therefore not true on current
`main`. Adding a second authority would make the visual system less reliable.

## Controls below the new touch floor

The proposed floor is 44 px for an action and 48 px for a field. These are
existing controls that have an explicit smaller size, or whose declared padding
and icon size make a smaller target unavoidable:

| Surface | Source | Current declared target | Required follow-up |
| --- | --- | --- | --- |
| Survey production fields and month buttons | `components/SiteSurveySheet.tsx:603-634` | 40 px | Raise fields to the 48 px field target; preserve the compact grid by checking it on phone first. |
| Survey switch | `components/SiteSurveySheet.tsx:101-105` | 44 x 26 px | Keep its visual track if desired, but give the control a 44 px tall hit area. |
| Lima text field and send action | `components/LimaBar.tsx:54-80` | 40 px | Raise the field to 48 px and send action to 44 px together. |
| Lima camera action | `components/LimaBar.tsx:85-93` | 22 px icon, no hit-area declaration | Give the icon a 44 px action wrapper. |
| Farmer header menu and appearance actions | `app/farmer/page.tsx:433-445`, `495-509` | 38 px and 40 px | Raise to 44 px; verify the 60 px header still has adequate vertical clearance. |
| Farmer map-layer action | `app/farmer/page.tsx:565-581` | 40 px | Raise to 44 px without changing its top/right collision guard. |
| Atlas search and clear action | `components/atlas/AtlasExplorer.tsx:143-165` | 42 px field; 14 px icon + 2 px padding | Raise field to 48 px and give clear action a 44 px hit target. |
| Evidence-catalogue close and chips | `components/EvidenceCatalogue.tsx:53-55`, `86-99` | 22 px icon + 4 px padding; 12.5 px text + 7 px padding | Give the close action a 44 px wrapper and audit chip wrapping after raising their height. |
| Standalone settings action | `components/SettingsButton.tsx:16-30` | text/icon with 4 px vertical padding | Add an explicit 44 px minimum height. |

Some controls may have a larger ancestor hit area at runtime; this audit makes no
such assumption. Each follow-up needs device inspection before it is called a
fix.

## Next safe step

Obtain the Design System directory from Rory, then reconcile its exact shadow
and type values with the already-existing tokens. Make one visual change set at
a time, beginning with the touch targets above, and inspect the mobile preview
after each set.

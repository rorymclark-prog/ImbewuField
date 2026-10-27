# Wave 28 keyboard focus in overlays — 27 October 2026

- Auditor: Claude (integrator), reviewing a Sonnet track.
- Reviewed revision: `swarm/w28-dialog-focus` (rorymclark-prog/imbewufield#1134, `8fe3faae` and `588393e3`), then the Lima launcher fix `111f47bd`, merged with the waves 24–27 integration (rorymclark-prog/imbewufield#1125). Built with `next build`, served with `next start` in sample mode.
- Previous audit: [Wave 27 farmer-facing error messages — 26 October 2026](../2026-10-26/wave-27-raw-errors-claude.md). This record adds `w28-01` to `w28-05`, and follows `w25`'s keyboard pass ([Wave 25](../2026-10-26/wave-25-forms-offline-keyboard-claude.md)).
- Scope: every custom (non-`<dialog>`) overlay a farmer or mentor opens from a button, except `components/design/DesignGlossy.tsx`, `components/crops/*`, `/plan` and `app/student/page.tsx`. Method: focus the trigger, press Enter, check focus moved in, press Tab 20 times, press Escape, and check where focus lands.

## Baseline (before this wave)

| Viewport | Overlay | Focus in after Enter | Tabs that left the overlay (of 20) | Focus after Escape |
| --- | --- | --- | --- | --- |
| 1280×800 | Settings, /records | no | 20 | not on the Settings button |
| 390×844 and 1280×800 | Drawer, /home and /mentor | not exposed as a dialog | — | Open navigation |
| 390×844 and 1280×800 | Lima launcher, /farmer and /mentor | **did not open** | — | — |

## Findings and disposition

| ID | Where | What the capture showed | Fix | Status |
| --- | --- | --- | --- | --- |
| w28-01 | Settings, Add sheet, evidence catalogue and sheet, profile sheet, POPIA consent, base-photo import, lesson link, confirm dialog, records entry dialog | Opening left focus on the opener, so a keyboard or switch user stayed on the page behind | `lib/use-dialog-focus.ts` moves focus to the first control, a `[data-autofocus]` control (Confirm keeps Cancel), or the container | Fixed |
| w28-02 | The same overlays | Tab walked the page behind the overlay: 20 of 20 Tabs left Settings | The hook traps Tab and Shift+Tab. A Tab inside a different `aria-modal` overlay is left to that overlay, so Settings opened from the drawer traps for itself | Fixed |
| w28-03 | The same overlays; base-photo import and lesson link | Escape left focus on an unrelated control; two overlays had no Escape at all | Focus returns to the opener if it is still on the page. Escape added to base-photo import and lesson link (captured, so it does not also close the drawer). POPIA consent keeps no Escape by design | Fixed |
| w28-04 | Navigation drawer | Not a dialog to assistive technology: no role, no name, no `aria-modal` | `role="dialog"`, `aria-modal` and a name while open; `inert` while closed is kept | Fixed |
| w28-05 | Lima launcher (draggable button) | Enter and Space did nothing: the launcher opened only from pointer events, and a keyboard click has none. The launcher also unmounts while Lima is open, so closing dropped focus on `<body>` | A click with `detail === 0` (keyboard) opens Lima; pointer taps still open on pointer-up. On close, focus returns to the re-mounted launcher when it was the opener | Fixed |

### Still open

- `DesignGlossy` overlays and the crop-plan screens are Codex's areas and were not changed.
- Not exercised in a browser: Add sheet, evidence catalogue and sheet, profile sheet, POPIA consent, base-photo import, lesson link, confirm dialog, records entry dialog. They are covered by the hook's unit tests and the source scan only.

## Verification

- **Rendered, after the fix:**

  | Viewport | Overlay | Focus in after Enter | Tabs that left (of 20) | Focus after Escape |
  | --- | --- | --- | --- | --- |
  | 1280×800 light, English | Settings, /records | yes ("Close settings") | 0 | Settings button |
  | 390×844 and 1280×800 | Drawer, /home and /mentor | yes ("Close menu") | 0 | Open navigation |
  | 390×844 light, English | Lima, /mentor and /samples | yes ("Close") | 0 | the launcher |
  | 1280×800 dark, isiZulu | Lima, /mentor and /samples | yes ("Vala") | 0 | the launcher |

  A mouse click (1280) and a touch tap (390) still open Lima.
- **Tests:** `tests/w28-dialog-focus.test.ts` covers:
  - the wrap/trap logic;
  - the hook against a DOM shim (focus in, trap, return, opener gone, container mode);
  - a source scan that every listed overlay calls the hook;
  - the launcher's keyboard and focus-return wiring.

  Updated to the new shape: `app-confirm`, `menu-button-coverage` and `settings-localization`. Renderer helpers stub the hook. `npx tsc --noEmit` is clean.

## Next continuation

Re-capture the live build once waves 24–28 are on `main`. Offer the hook to Codex for the `DesignGlossy` overlays.

# After-evidence for crop plan steps 1 and 2 (10 November 2026)

Measurements and screenshots taken after the fixes in `dbdf0d6b` (CP-057), `1cedb160` (step 1) and `676b2e22` (step 2), with the same committed scripts as the audit: [`../evidence-crop-plan-reaudit/README.md`](../evidence-crop-plan-reaudit/README.md) has the commands. The "before" files are in that folder.

Local dev server, public sample farm, headless Chromium. Not production, not a physical phone, no screen reader.

| File | What it shows |
| --- | --- |
| `measurements/keyboard-390-light.json`, `keyboard-1280-light.json` | The three crop sheets: dialog role, name, focus on open, Escape, Tab containment, focus return, Close button size |
| `measurements/phone-light-simple.json`, `phone-dark-simple.json`, `phone-light-full.json`, `phone-dark-full.json`, `desktop-light-full.json`, `phone-light-full-expanded.json` | Page totals after both steps |
| `measurements/weekly-target-flow.json` | The weekly-target card and review text after CP-057 |
| `after-06`, `after-08`, `after-09` | The calendar at 390px light and dark, and at 1280px |
| `after-07` | The pinned header and the fruit and animal notes |
| `after-12` | The weekly-target card |
| `after-14`, `after-15` | The crop picker and planting detail sheets |
| `after-18`, `after-19` | All tools on a phone: the "check / transplant" chip, and the calendar panned to its last month |

## Before and after

| Measure | Before | After |
| --- | --- | --- |
| Text-contrast failures, phone Simple light / dark | 23 / 43 | 0 / 0 |
| Text-contrast failures, phone All tools light / dark | 46 / 69 | 0 / 0 |
| Clipped crop names, phone Simple / All tools | 5 / 10 | 0 / 0 |
| Controls under 24px with no exception, All tools / every section open | 5 / 15 | 0 / 0 |
| Controls between 24px and 44px, phone Simple / All tools | 37 / 57 | 0 / 25 |
| Sheets with a dialog role and name | 0 of 3 | 3 of 3 |
| Sheets that take focus, hold Tab, close on Escape, return focus | 1, 0, 0, 0 of 3 | 3, 3, 3, 3 of 3 |
| Sheet Close button | 16–18px | 44px |
| h1 in the planner view | 0 | 1 |
| Weekly target total | "260.714286 kg" | "260.7 kg" |
| Calendar pan in All tools at 390px | stops about 140px short | reaches the last month |

## Limits

- The served-build stamp in each file is the commit the dev server started on; the working tree on top of it is what was measured. The keyboard files and the dark, desktop and expanded page files were taken before two last tap-size edits (the fruit and animal lanes, and the two 43px buttons) that do not touch what those files measure for contrast, dialogs or the 24px minimum. `phone-light-simple.json` and `phone-light-full.json` were taken after them.
- The 25 controls still between 24px and 44px in All tools are secondary chips and tabs ("Back to design", the chart tabs, "Plan it" and similar) and the five "check / transplant" chips. The chip stays 24px on purpose: at 44px its hit area covered part of its own bar and the lane above.
- The touch sizes apply at `(pointer: coarse)` or a window up to 767px wide. Only the width half was exercised; no touch device was used.
- Text under 12px is unchanged by these steps (91 runs in Simple, 167 in All tools): that is step 4.

# Dashboard visual review — 5 September 2026

Scope: live sample chooser, NGO/funder cohort and assessment screens, shared sample banner. This is a focused consistency pass, not a claim that every app route has been audited.

Observed in the live desktop browser: the chooser Account link was covered by the floating Back button; card actions had different baselines; cohort labels were faint brown on cream while assessments used green and white; the sample assessment screen had two independent language controls; the sample banner used small white text on bright ochre. Code inspection also found that the mobile MEL padding shorthand removed the bottom clearance for fixed navigation.

Changes use the existing green brand, white cards, sage page background and darker supporting text. Chart series colours and all figures retain their existing meaning. Navigation labels grow to 14px and keep horizontal scrolling; sample cards have role icons and aligned full-width actions. One parent language control now governs sample questions and results. The banner uses darker ochre and a shorter fictional-data label. The chooser registers the existing in-flow Back control.

Desktop browser comparison is required against the branch preview before merge. Mobile breakpoints are implemented at 1000px and 600px for the chooser, and the existing dashboard grids remain responsive. The available browser does not expose viewport resizing; physical phone/iPad layout is not verified here.

No changes to Design Studio, saved maps, report generation, permissions, crop calculations or sample financial records. The rest of the app still needs a separate route-by-route visual pass; avoid a global colour replacement because map overlays and printed reports have different needs.

// Unreviewed Afrikaans machine drafts keyed by the exact English (see index.ts).
// The Afrikaans twin of lib/locales/xh-inline/g50-ui-gaps-3.ts, for the English the third sample-mode browser
// sweep found on the Design scale exercise (2 Nov 2026):
//  - the "Simulated scale exercise" notice (lib/design-scale.ts SCALE_NOTICE, shown through DesignDraftCopy);
//  - the words written on the scale diagram itself (components/studies/DesignScaleDiagram.tsx): the
//    "MODEL ONLY" footer, "No gap" and "Outer width". The diagram's heading and bed names reuse the existing
//    "Supplied gap" / "Edges touch" / "Outlines overlap" and "Bed 1" / "Bed 2" drafts, so they add no keys.
// The Manual chapter's "read in English" link reads content/manual/af/ui.json, and the /tour and /atlas notices
// reuse existing drafts (the tour's disclosure sentence lives in g43-notices.ts), so they add no keys here.
const drafts: Record<string, string> = {
  // Scale exercise notice
  "Simulated scale exercise. These dimensions come from the app’s illustrative sample model, not a ground survey. They are not recommended bed or access widths. This is separate from the unmeasured busy-yard case.": "Gesimuleerde skaaloefening. Hierdie afmetings kom uit die app se illustratiewe voorbeeldmodel, nie uit 'n grondopmeting nie. Dit is nie aanbevole bedding- of toegangswydtes nie. Dit is apart van die ongemete besige-werf-geval.",
  // Scale diagram text
  "MODEL ONLY · not site measurements": "SLEGS MODEL · nie terreinmetings nie",
  "No gap": "Geen gaping",
  "Outer width: {width} m": "Buitewydte: {width} m",
};

export default drafts;

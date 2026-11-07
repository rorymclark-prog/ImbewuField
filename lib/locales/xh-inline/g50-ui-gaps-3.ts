// Unreviewed isiXhosa machine drafts keyed by the exact English (see index.ts).
// The English the third isiXhosa sample-mode browser sweep found on the Design scale exercise (2 Nov 2026):
//  - the "Simulated scale exercise" notice (lib/design-scale.ts SCALE_NOTICE, shown through DesignDraftCopy);
//  - the words written on the scale diagram itself (components/studies/DesignScaleDiagram.tsx): the
//    "MODEL ONLY" footer, "No gap" and "Outer width". The diagram's heading and bed names reuse the existing
//    "Supplied gap" / "Edges touch" / "Outlines overlap" and "Bed 1" / "Bed 2" drafts, so they add no keys.
// The manual chapter's "Read this chapter in English" link reads content/manual/xh/ui.json, and the /tour and
// /atlas notices reuse existing drafts, so they add no keys here either.
const drafts: Record<string, string> = {
  // Scale exercise notice
  "Simulated scale exercise. These dimensions come from the app’s illustrative sample model, not a ground survey. They are not recommended bed or access widths. This is separate from the unmeasured busy-yard case.": "Umsebenzi wokuziqhelisa wesikali olingiswayo. Le milinganiselo ivela kwimodeli yomzekelo ye-app, ayivelanga kuphando lomhlaba. Ayiyiyo ububanzi obucetyiswayo bebhedi okanye bendlela yokungena. Oku kwahlukile kwimeko yegceke elixakekileyo elingalinganiswanga.",
  // Scale diagram text
  "MODEL ONLY · not site measurements": "IMODELI KUPHELA · ayiyiyo imilinganiselo yendawo",
  "No gap": "Akukho msantsa",
  "Outer width: {width} m": "Ububanzi bangaphandle: {width} m",
};

export default drafts;

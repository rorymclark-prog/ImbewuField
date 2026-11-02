// Unreviewed Afrikaans machine drafts keyed by the exact English (see index.ts).
// The Afrikaans twin of lib/locales/xh-inline/g49-ui-gaps-2.ts, for the English gaps the second sample-mode
// browser sweep found (2 Nov 2026) and Afrikaans shares:
//  - the Farmer site-survey picker (components/SiteSurveySheet.tsx: "What are you preparing?" and its cards);
//  - the "Share this summary with funders" checkbox on /ngo and /assessments (components/SampleProgramme.tsx);
//  - the lead-in of the Design pathway notice (components/studies/DesignDraftCopy.tsx). The isiXhosa
//    lead-in is kept because Afrikaans must cover every isiXhosa key, and "Afrikaans draft." is the
//    Afrikaans reader's own lead-in for the same notice, with the Afrikaans twin of its sentence (the shared
//    notice used to show the English twice because only the isiXhosa sentence was drafted).
// The task-line wording on Home and the crop plan (lib/task-title-draft.ts) reuses the existing "Bed {n}" and
// "Due ..." drafts, so it adds no keys here.
// Terms: terrein = site, vraelys = questionnaire, produksieplan = production plan, befondsers = funders,
// konsep = draft, bewyse = evidence.
const drafts: Record<string, string> = {
  // Site survey picker
  "What are you preparing?": "Wat berei jy voor?",
  "Choose the purpose, then the questionnaire length. Your maps and production plan remain linked to this site.": "Kies die doel, kies dan die lengte van die vraelys. Jou kaarte en produksieplan bly aan hierdie terrein gekoppel.",
  "Understand the site, constraints and possibilities before detailed design.": "Verstaan die terrein, beperkings en moontlikhede voor gedetailleerde ontwerp.",
  "Bring the site survey, saved maps and whole-year production plan together. Missing evidence stays visible.": "Bring die terreinopname, gestoorde kaarte en die hele jaar se produksieplan bymekaar. Ontbrekende bewyse bly sigbaar.",
  // Programme assessments
  "Share this summary with funders": "Deel hierdie opsomming met befondsers",
  // Design pathway notice
  "isiXhosa draft.": "isiXhosa-konsep.",
  "Afrikaans draft.": "Afrikaanse konsep.",
  "Navigation, headings, lesson text and exercise prompts on this pathway are unreviewed Afrikaans drafts. Model measurements and narration remain in English.": "Navigasie, opskrifte, lesteks en oefenopdragte op hierdie leerpad is onhersiene Afrikaanse konsepte. Modelafmetings en vertelling bly in Engels.",
};

export default drafts;

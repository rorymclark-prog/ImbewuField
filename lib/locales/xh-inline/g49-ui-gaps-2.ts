// Unreviewed isiXhosa machine drafts keyed by the exact English (see index.ts).
// The English gaps the second isiXhosa sample-mode browser sweep found (2 Nov 2026):
//  - the Farmer site-survey picker (components/SiteSurveySheet.tsx: "What are you preparing?" and its cards);
//  - the "Share this summary with funders" checkbox on /ngo and /assessments (components/SampleProgramme.tsx);
//  - the "isiXhosa draft." lead-in of the Design pathway notice (components/studies/DesignDraftCopy.tsx).
// The task-line wording on Home and the crop plan (lib/task-title-draft.ts) reuses the existing "Bed {n}" and
// "Due ..." drafts, so it adds no keys here.
const drafts: Record<string, string> = {
  // Site survey picker
  "What are you preparing?": "Uwulungiselela ntoni?",
  "Choose the purpose, then the questionnaire length. Your maps and production plan remain linked to this site.": "Khetha injongo, uze ukhethe ubude bemibuzo. Iimephu zakho nesicwangciso semveliso zihlala zidityaniswe nale ndawo.",
  "Understand the site, constraints and possibilities before detailed design.": "Qonda indawo, izithintelo neenkalo ezinokwenzeka phambi koyilo oluneenkcukacha.",
  "Bring the site survey, saved maps and whole-year production plan together. Missing evidence stays visible.": "Dibanisa uphando lwendawo, iimephu ezigciniweyo nesicwangciso semveliso sonyaka wonke. Ubungqina obungekhoyo buhlala bubonakala.",
  // Programme assessments
  "Share this summary with funders": "Yabelana ngesishwankathelo esi nabaxhasi-mali",
  // Design pathway notice
  "isiXhosa draft.": "Idrafti yesiXhosa.",
};

export default drafts;

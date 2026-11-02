// Unreviewed isiXhosa machine drafts keyed by the exact English (see index.ts).
// The two sentences the report picker adds when a draft language is chosen:
//  - the prepared example's scope note (lib/report-summary.ts preparedExampleNote), shown under the
//    picker, in the example's settings panel and at the head of its exported summary PDF;
//  - the notice above an AI-written report in a draft language (components/ReportView.tsx).
// Every other sentence of the prepared example (status words, bed kinds, headings, basis paragraph,
// inventory and production-space fallbacks) already had a draft in g06-reports / g39-merge-reports.
const drafts: Record<string, string> = {
  "Prepared example of saved records. It is not a comprehensive site assessment, design report or evidence of progress. No new AI analysis.": "Umzekelo olungiselelweyo weerekhodi ezigciniweyo. Ayingovavanyo olubanzi lwendawo, ingxelo yoyilo okanye ubungqina benkqubela. Akukho hlalutyo lutsha lwe-AI.",
  "This report was written by AI in {language}. It has not been reviewed by a fluent speaker; check figures against the English source.": "Le ngxelo ibhalwe yi-AI, ulwimi: {language}. Ayikahlolwa ngumntu othetha ulwimi kakuhle; jonga amanani ngokuthelekisa nomthombo wesiNgesi.",
};

export default drafts;

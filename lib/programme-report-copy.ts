import { reportVisualText } from './report-visuals';
import { PROGRAMME_METRIC_ZU, PROGRAMME_PDF_ZU } from './programme-report-copy-data';

export type ProgrammeReportLanguage = 'en'|'zu'|'st'|'ts'|'ve';
export const isProgrammeDraftLanguage = (language: string): language is Exclude<ProgrammeReportLanguage,'en'> => ['zu','st','ts','ve'].includes(language);
/** All report presentation words share the visual report authority; supplied evidence is not a template. */
export const programmeReportText = (source: string, language: string, values: Record<string,string|number> = {}, legacyZulu?: string): string =>
  reportVisualText(source, language, values, legacyZulu);

function metric(source:string,language:string,legacy:Readonly<Record<string,string>>):string {
  const percent = /^(\d+)% present$/.exec(source);
  if (percent) return programmeReportText('{count}% present',language,{count:percent[1]},'{count}% bakhona');
  return programmeReportText(source,language,{},Object.hasOwn(legacy,source)?legacy[source]:undefined);
}
export const programmeMetricText = (source:string,language:string):string => metric(source,language,PROGRAMME_METRIC_ZU);
export const programmePdfLabel = (source:string,language='en'):string => metric(source,language,PROGRAMME_PDF_ZU);

export const PROGRAMME_REVIEW_SOURCE = 'These translated headings and controls are unreviewed. Evidence and participant answers remain in the language recorded.';
export const EXAMPLE_REPORT_REVIEW_SOURCE = 'This report contains unreviewed translations of the prepared English example. The original English narrative is included for comparison.';

/** Native filenames keep the same names as the document; punctuation cannot become a path. */
export function programmeReportFileName(title:string,language:string):string {
  const name=isProgrammeDraftLanguage(language)?title.normalize('NFC').replace(/[^\p{L}\p{N}\p{M}]+/gu,'-'):title.replace(/[^a-zA-Z0-9]+/g,'-');
  return `ImbewuField-${name}.pdf`;
}

import styles from '../ReportView.module.css';

export default function ReportPurposeGuide({ language }: { language: string }) {
  return <details className={`${styles.versionDetails} no-print`} lang="en">
    <summary style={{ minHeight: 44 }}><strong>Which report do I need?</strong></summary>
    {language !== 'en' && <p>This guide is currently in English.</p>}
    <p>There are two main site reports. Choose the purpose first, then the level of detail. A short or comprehensive questionnaire can support either purpose. The reading views shorten the saved report; they do not create a new assessment.</p>
    <dl>
      <div><dt>1. Site potential · before detailed design</dt><dd>Understand people and goals, local economy and markets, climate, water, soil, terrain, biome, vegetation, bioresource unit and available resources. Assess crop, food-forest and animal options against the evidence. Identify missing information and field checks before committing to a design.</dd></div>
      <div><dt>2. Complete site plan · once the evidence is assembled</dt><dd>Bring the assessment, surveys, saved maps and whole-year production plan together. Explain existing features, proposed work, resources, costs where recorded, responsibilities and order of work. Keep recorded harvests separate from expected production. Missing evidence remains visible; the title does not mean the work has been built or verified.</dd></div>
    </dl>
    <p>Later progress reviews compare dated observations, harvests and completed work with the baseline and plan. A progress review is a follow-up to those two reports.</p>
  </details>;
}

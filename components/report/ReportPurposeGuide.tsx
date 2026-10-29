import styles from '../ReportView.module.css';

export default function ReportPurposeGuide({ language }: { language: string }) {
  return <details className={`${styles.versionDetails} ${styles.purposeGuide} no-print`} lang="en">
    <summary style={{ minHeight: 44 }}><strong>Which report do I need?</strong></summary>
    {language !== 'en' && <p>This guide is currently in English.</p>}
    <p><strong>Choose the purpose first, then the wording and depth.</strong> There are two main site reports, followed by a later progress review.</p>
    <table className={styles.purposeTable}>
      <caption>Report purposes and when to use them</caption>
      <thead><tr><th scope="col">Report</th><th scope="col">When to use it and what it contains</th></tr></thead>
      <tbody>
        <tr><th scope="row">1. Site potential</th><td>
          <p><strong>Before detailed design or major spending.</strong> What could this site support, and what must we investigate first?</p>
          <p>People’s needs and goals; local economy and markets; climate; terrain; water; soil; biome, vegetation and bioresource unit; existing resources; potential for crops, food forests and animals; constraints, missing evidence and field checks.</p>
        </td></tr>
        <tr><th scope="row">2. Complete site plan</th><td>
          <p><strong>Once the assessment, surveys and design information are assembled.</strong> What are we proposing, where does it go, and how will we implement it?</p>
          <p>The assessment and saved maps; existing features and proposed work; water, access, planting and animal systems; the whole-year production plan; costs and resources where recorded; responsibilities, order of work and monitoring. Keep recorded harvests separate from expected production.</p>
        </td></tr>
        <tr><th scope="row">3. Progress review</th><td>
          <p><strong>During implementation and later operation.</strong> What has actually happened compared with the baseline and plan?</p>
          <p>Dated photographs and observations; completed work; planting and survival records; actual harvests, expenditure and sales where recorded; problems, lessons and next actions.</p>
          <p>This is a later follow-up. The report-purpose selector currently offers Site potential and Complete site plan.</p>
        </td></tr>
      </tbody>
    </table>
    <p><strong>“Complete site plan” means the planning information is brought together.</strong> It does not mean everything has been built or verified. Missing evidence remains visible.</p>
    <table className={styles.purposeTable}>
      <caption>Wording, depth and questionnaire are separate choices</caption>
      <thead><tr><th scope="col">Choice</th><th scope="col">What it changes</th></tr></thead>
      <tbody>
        <tr><th scope="row">Wording</th><td><strong>Simple / Detailed.</strong> How the report explains things: accessible language or more technical detail.</td></tr>
        <tr><th scope="row">Depth</th><td><strong>Brief / Standard / Comprehensive.</strong> How much explanation and supporting information it includes.</td></tr>
        <tr><th scope="row">Questionnaire</th><td><strong>Short / Comprehensive.</strong> How much information is collected beforehand. Either questionnaire can support either report purpose. Missing information must remain visible.</td></tr>
      </tbody>
    </table>
    <p>You can have a <strong>comprehensive report written in simple language</strong>. For a practical full plan, choose Complete site plan, Simple wording and Comprehensive depth.</p>
    <p>A shorter and fuller edition serve the same report purpose; they are not extra report types.</p>
    <p>The reading views shorten the saved report; they do not create a new assessment. Changing generation choices applies when you generate a new report.</p>
  </details>;
}

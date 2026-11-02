import type { ReportProductionYear } from '@/lib/report-crop-plan';
import { pdfIconUrl } from '@/lib/pdf-icons';
import styles from './ProductionYearOverview.module.css';
import { inlineTemplate, inlineText, isInlineDraftLang } from '@/lib/xh-inline';

export default function ProductionYearOverview({ production, language = 'en' }: { production?: ReportProductionYear; language?: string }) {
  // English, isiZulu, Sesotho, Xitsonga and Tshivenda keep this overview in English exactly as before. A draft language
  // (lib/xh-inline.ts) reads the fixed wording through its drafts; the product names and notes come from the saved plan
  // in English, so they are marked as English and the notice says so.
  const draft = isInlineDraftLang(language);
  const ui = (english: string) => inlineText(language, english);
  const planData = draft ? 'en' : undefined;
  return <section className={styles.section} lang={draft ? language : 'en'} aria-label={ui('Annual food and product plan')}>
    <h3>{ui('Food and products through the year')}</h3>
    {language !== 'en' && <p lang={draft ? language : undefined}>{draft ? ui('The product names and notes in this table are shown in English.') : inlineText(language, 'This production overview is currently in English.')}</p>}
    <p>{ui("Crops, food-forest products and animal products from this site's saved production plan. These are planning windows, not recorded harvests, measured stock or proof that the household has enough food.")}</p>
    {!production ? <p>{ui('No annual production snapshot is attached. Open the current crop plan to record product choices and timing; older reports keep their original evidence.')}</p> : <>
      {draft
        ? <p className={styles.key}><strong>P</strong> {ui('Plan or locally recorded season')} · <strong>R</strong> {ui('Sourced reference')} · <strong>—</strong> {ui('Timing not established.')} {ui('Proposed trees may take years to produce; housing does not establish animal numbers.')}</p>
        : <p className={styles.key}><strong>P</strong> Plan or locally recorded season · <strong>R</strong> Sourced reference · <strong>—</strong> Timing not established. Proposed trees may take years to produce; housing does not establish animal numbers.</p>}
      <div className={styles.table} tabIndex={0} role="region" aria-label={ui('Twelve-month production calendar, scroll horizontally')}>
        <table><thead><tr><th scope="col">{ui('Product')}</th>{production.months.map(month => <th scope="col" key={month}>{month}</th>)}</tr></thead>
          <tbody>{production.rows.map(row => {
            const art = pdfIconUrl(row.id.startsWith('crop:') ? row.id.split(':').slice(0, 2).join(':') : row.id);
            const kind = { crop: 'Crop', 'food-forest': 'Food forest', animal: 'Animal product' }[row.kind];
            return <tr key={row.id}><th scope="row"><span className={styles.product}>{art && <img src={art} alt="" width={38} height={38} loading="lazy"/>}<span lang={planData}>{row.name}<small>{row.product} · {draft ? <span lang={language}>{ui(kind)}</span> : kind}</small></span></span><small lang={planData}>{row.note}</small></th>{production.months.map((month, i) => <td key={month}>{row.months.includes(i) ? <span className={row.reference ? styles.reference : styles.planned} aria-label={inlineTemplate(language, row.reference ? '{name}: reference season in {month}' : '{name}: planning window in {month}', null, { name: row.name, month })}>{row.reference ? 'R' : 'P'}</span> : <span aria-label={inlineTemplate(language, '{name}: timing not established in {month}', null, { name: row.name, month })}>—</span>}</td>)}</tr>;
          })}</tbody></table>
      </div>
      {!production.rows.length && <p>{ui('No crop or mapped product rows are recorded for this site. An empty plan is not evidence of a food gap.')}</p>}
    </>}
  </section>;
}

import type { ReportProductionYear } from '@/lib/report-crop-plan';
import { pdfIconUrl } from '@/lib/pdf-icons';
import styles from './ProductionYearOverview.module.css';
import { inlineText, isInlineDraftLang } from '@/lib/xh-inline';

export default function ProductionYearOverview({ production, language = 'en' }: { production?: ReportProductionYear; language?: string }) {
  return <section className={styles.section} lang="en" aria-label="Annual food and product plan">
    <h3>Food and products through the year</h3>
    {language !== 'en' && <p lang={isInlineDraftLang(language) ? language : undefined}>{inlineText(language, 'This production overview is currently in English.')}</p>}
    <p>Crops, food-forest products and animal products from this site's saved production plan. These are planning windows, not recorded harvests, measured stock or proof that the household has enough food.</p>
    {!production ? <p>No annual production snapshot is attached. Open the current crop plan to record product choices and timing; older reports keep their original evidence.</p> : <>
      <p className={styles.key}><strong>P</strong> Plan or locally recorded season · <strong>R</strong> Sourced reference · <strong>—</strong> Timing not established. Proposed trees may take years to produce; housing does not establish animal numbers.</p>
      <div className={styles.table} tabIndex={0} role="region" aria-label="Twelve-month production calendar, scroll horizontally">
        <table><thead><tr><th scope="col">Product</th>{production.months.map(month => <th scope="col" key={month}>{month}</th>)}</tr></thead>
          <tbody>{production.rows.map(row => {
            const art = pdfIconUrl(row.id.startsWith('crop:') ? row.id.split(':').slice(0, 2).join(':') : row.id);
            return <tr key={row.id}><th scope="row"><span className={styles.product}>{art && <img src={art} alt="" width={38} height={38} loading="lazy"/>}<span>{row.name}<small>{row.product} · {{crop:'Crop','food-forest':'Food forest',animal:'Animal product'}[row.kind]}</small></span></span><small>{row.note}</small></th>{production.months.map((month, i) => <td key={month}>{row.months.includes(i) ? <span className={row.reference ? styles.reference : styles.planned} aria-label={`${row.name}: ${row.reference ? 'reference season' : 'planning window'} in ${month}`}>{row.reference ? 'R' : 'P'}</span> : <span aria-label={`${row.name}: timing not established in ${month}`}>—</span>}</td>)}</tr>;
          })}</tbody></table>
      </div>
      {!production.rows.length && <p>No crop or mapped product rows are recorded for this site. An empty plan is not evidence of a food gap.</p>}
    </>}
  </section>;
}

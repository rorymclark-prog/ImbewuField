import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import FinanceProjectWorksheet from '@/components/studies/FinanceProjectWorksheet';
import project from '@/lib/course-finance-project.json';
import { projectMoney } from '@/lib/finance-project';
import OfflinePageLink from '@/components/studies/OfflinePageLink';
import styles from '@/components/studies/FinanceCourse.module.css';

export const metadata = { title: 'Farm Finance practical project — teaching preview', robots: { index: false, follow: false } };
export function generateStaticParams() { return project.cases.map(exercise => ({ case: exercise.id })); }
function Table({ title, headers, rows }: { title: string; headers: string[]; rows: ReactNode[][] }) {
  return <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={`${title}; scroll sideways if needed`}><table><caption>{title} · Scroll sideways if any columns are hidden.</caption><thead><tr>{headers.map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

export default async function FinanceProjectPage({ params }: { params: Promise<{ case: string }> }) {
  const { case: id } = await params;
  const exercise = project.cases.find(c => c.id === id);
  if (!exercise) notFound();
  const c = exercise;
  return <div className={styles.page}>
    <header className={styles.header}><MenuButton /><BackButton fallback="/student/finance" /><OfflinePageLink href="/student/finance">Farm Finance</OfflinePageLink><span>Practical project</span></header>
    <main className={styles.main}>
      <section className={styles.hero}><div className={styles.heroText}><p className={styles.eyebrow}>Bring the course together · {c.title}</p><h1>One growing area.<br />Follow every record.</h1><p>Start with a plan. Then check what was harvested, delivered and paid. Show your calculations and explain what the evidence cannot tell you.</p><div className={styles.actions}><a href="#source-cards">Read the source cards</a><a href="#worksheet">Go to my worksheet</a></div></div><img src="/studies-guides/expense-record.jpg" alt="Illustrated grower studying records at a homestead table" /></section>
      <aside className={`${styles.notice} ${styles.projectNotice}`}><p><strong>English teaching preview.</strong> Every date, amount, quantity and measurement in these cases is invented for practice. These are not local prices, expected yields or recommendations for a real farm. Practitioner and learner review remain open.</p></aside>
      <nav aria-label="Project cases" className={styles.actions}>{project.cases.map(entry => <OfflinePageLink key={entry.id} href={`/student/finance/project/${entry.id}`} aria-current={entry.id === id ? 'page' : undefined}>{entry.title}</OfflinePageLink>)}</nav>
      <section className={styles.section}><h2>How to use this project</h2><p>For the supported project day, use “Work together”. For an independent attempt, use “Try it yourself”. After feedback, use “A fresh case”. Each case starts again with its own sources and opening balances.</p><p>Save your worksheet before changing cases. A facilitator can collect your paper or oral explanation as well as your calculations. The self-check is practice feedback; it is not a submitted or accredited assessment.</p><p>Keep the original plan separate from the later records. Make a short final pack: a marked site sketch, budget with exclusions, dated cash forecast, harvest destinations, invoice/payment trail, and a review with a next action.</p></section>
      <section id="source-cards" className={styles.section}>
        <p className={styles.eyebrow}>1 · Set the boundary</p><h2>The practice site and opening record</h2>
        <p><strong>{c.site.reference}</strong> · {c.site.note}</p>
        <svg className={styles.practiceMap} viewBox="0 0 520 340" role="img" aria-labelledby="project-map-title project-map-description">
          <title id="project-map-title">Imaginary practice site and Plot A</title><desc id="project-map-description">A {c.site.widthM} by {c.site.heightM} metre site. Plot A is {c.site.plot.widthM} by {c.site.plot.heightM} metres, offset {c.site.plot.xM} metres from the left edge and {c.site.plot.yM} metres from the top edge. This is not a real location.</desc>
          <rect x="50" y="50" width={c.site.widthM * 20} height={c.site.heightM * 20} fill="#eee8d6" stroke="#8d7856" strokeWidth="2" />
          <rect x={50 + c.site.plot.xM * 20} y={50 + c.site.plot.yM * 20} width={c.site.plot.widthM * 20} height={c.site.plot.heightM * 20} fill="#cbdcb1" stroke="#315537" strokeWidth="2" />
          <text x="250" y="30" textAnchor="middle">{c.site.widthM} m</text><text x="466" y="180">{c.site.heightM} m</text>
          <text x="190" y="162" textAnchor="middle">Plot A</text><text x="190" y="187" textAnchor="middle">{c.site.plot.widthM} m × {c.site.plot.heightM} m</text>
          <text x="250" y="320" textAnchor="middle">Synthetic site · no real location</text>
        </svg>
        <p>On your copy, mark Plot A and write its reference beside the harvest card. List the access, water and growing information you would still need for a real plan. The card gives no legal access agreement and no forecast of production from this area.</p>
        <p><strong>{c.opening.reference} · {c.opening.date}</strong>: cash counted {projectMoney(c.opening.cashCents)}; harvested stock {c.opening.stockGrams / 1000} kg; customer balance {projectMoney(c.opening.buyerOwesCents)}. Keep the review between <strong>{c.period.start} and {c.period.end}</strong>.</p>
        <ul>{c.boundaries.map(text => <li key={text}>{text}</li>)}</ul>
      </section>
      <section className={styles.section}>
        <p className={styles.eyebrow}>2 · Preserve the original plan</p><h2>What was expected</h2>
        <p><strong>{c.plan.version} · written {c.plan.written}</strong>. The enquiry {c.plan.marketReference} mentions up to {c.plan.quantityGrams / 1000} kg at {projectMoney(c.plan.pricePerKgCents)} per kg. This is an enquiry, not a confirmed order. The plan assumes all that quantity is delivered and paid on {c.plan.receiptDate}. That assumption still needs confirmation.</p>
        <Table title="Included quoted payments" headers={['Reference','Expected date','Quote','Amount']} rows={c.plan.payments.map(row => [row.reference,row.date,row.label,projectMoney(row.amountCents)])} />
        <p>The exercise work sheet allows {c.plan.availableOwnerHours} owner hours and assumes this activity uses {c.plan.ownerHours}. These are supplied practice assumptions, not recommended work rates.</p><ul>{c.plan.exclusions.map(text => <li key={text}>{text}</li>)}</ul>
        <h3>Compare a different activity</h3><p><strong>{c.alternative.reference}</strong>: {c.alternative.label}. An enquiry mentions {c.alternative.quantity} items at {projectMoney(c.alternative.pricePerItemCents)} each. The alternative assumes receipt on {c.alternative.receiptDate}; no order is confirmed. It needs {c.alternative.ownerHours} owner hours while only {c.alternative.availableOwnerHours} are available.</p>
        <Table title="Alternative quoted payments" headers={['Reference','Expected date','Quote','Amount']} rows={c.alternative.payments.map(row => [row.reference,row.date,row.label,projectMoney(row.amountCents)])} />
        <p>{c.alternative.note} Compare cash dates, hours and evidence—not the price of one kilogram with the price of one item. More information is needed before choosing a real enterprise.</p>
      </section>
      <section className={styles.section}>
        <p className={styles.eyebrow}>3 · Follow the later evidence</p><h2>What happened in the supplied records</h2>
        <p><strong>{c.harvest.reference} · {c.harvest.date}</strong>: Plot A ({c.harvest.plotReference}) harvest weighed {c.harvest.quantityGrams / 1000} kg. This weight is supplied by the imaginary harvest card; do not derive it from the plot area.</p>
        <Table title="Harvest destinations" headers={['Reference','Date','Destination','Quantity']} rows={c.destinations.map(row => [row.reference,row.date,row.kind,`${row.quantityGrams / 1000} kg`])} />
        <p><strong>{c.stockCount.reference} · {c.stockCount.date}</strong>: the closing count is {c.stockCount.quantityGrams / 1000} kg. Show that the quantity records explain this count.</p>
        <h3>The delivery and invoice</h3><p><strong>{c.invoice.orderReference} · {c.invoice.orderDate}</strong>: {c.invoice.buyer} confirms an order for {c.invoice.quantityGrams / 1000} kg at {projectMoney(c.invoice.pricePerKgCents)} per kg. Accepted delivery {c.invoice.deliveryReference} and invoice <strong>{c.invoice.reference}</strong> are dated {c.invoice.date}. The invoice is {projectMoney(c.invoice.amountCents)}. It is the same delivered produce, not another sale. These are classroom cards, not tax invoices.</p>
        <Table title="Actual cash records" headers={['Reference','Date','Reason','In or out']} rows={c.cashEvents.map(row => [row.reference,row.date,`${row.kind}${row.invoiceReference ? ` for ${row.invoiceReference}` : ''}`,`${row.amountCents < 0 ? 'Out' : 'In'} ${projectMoney(Math.abs(row.amountCents))}`])} />
        <p><strong>{c.cashCount.reference} · {c.cashCount.date}</strong>: counted cash {projectMoney(c.cashCount.amountCents)}. Reconcile the records to this count.</p>
        <p><strong>{c.laterPayment.reference} · {c.laterPayment.date}</strong>: {projectMoney(c.laterPayment.amountCents)} received for {c.laterPayment.invoiceReference}. It belongs to the later month’s cash, not this month’s closing cash.</p>
        <div className={styles.practice}><h3>A missing amount stays missing</h3><p><strong>{c.unknownCost.reference} · {c.unknownCost.date}</strong>: {c.unknownCost.description} Keep its cost unknown; find the bill or confirm the charge with the supplier. Zero would state something the evidence does not support.</p></div>
      </section>
      <FinanceProjectWorksheet key={c.id} exercise={c} />
      <section className={styles.section}><h2>Review the complete practical pack</h2><p>Ask a facilitator or learning partner to review your explanations as well as the figures. They should give a specific correction and then ask you to demonstrate it on a fresh case.</p><ol><li>Does the harvest record name the mapped plot without treating the sketch as proof of rights or yield?</li><li>Do the budget and forecast preserve the original dates, assumptions, excluded costs and any early cash gap?</li><li>Does each quantity keep its unit? Do household food and loss remain separate from sales?</li><li>Can you trace one delivery to one invoice and its payments, without double-counting sales or treating an unpaid amount as cash?</li><li>Are owner funds, borrowing and household withdrawals classified from their source cards?</li><li>Does the review explain quantity, payment timing, costs and financing separately, while leaving missing costs and full profit unknown?</li><li>Does the next action name the evidence needed, a responsible classroom role and a review date?</li></ol><p>The reviewer can record “demonstrated”, “needs another attempt”, or “not yet observed” beside each item, with a source reference and feedback. An unanswered item is not a pass. The app’s numerical self-check cannot make this judgement.</p></section>
      <section className={styles.section}><h2>Practise supported app tasks</h2><p>Use the sample farm, not your real financial records. Partial payments stay in this workbook exercise where the app cannot represent them fully.</p><div className={styles.actions}><OfflinePageLink href="/student/guides/mapping">Mapping guide</OfflinePageLink><OfflinePageLink href="/student/guides/harvest">Harvest guide</OfflinePageLink><OfflinePageLink href="/student/guides/invoices">Invoice guide</OfflinePageLink><OfflinePageLink href="/student/guides/payments">Payment guide</OfflinePageLink><OfflinePageLink href="/student/guides/expenses">Expense guide</OfflinePageLink></div></section>
      <section className={styles.section}><h2>Why these distinctions matter</h2><p>The cases and figures are original classroom material. The record categories and the distinction between cash movement and income are informed by <a href="https://www.fao.org/4/w6864e/w6864e0f.htm">FAO record-keeping guidance</a> and <a href="https://www.extension.iastate.edu/agdm/wholefarm/html/c3-25.html">Iowa State University’s farm income statement guidance</a>. Local tax rules and foreign worked examples are not imported into this exercise.</p><div className={styles.actions}><OfflinePageLink href="/student/finance">Return to the course outline</OfflinePageLink></div></section>
    </main>
  </div>;
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Check, FileText, Printer } from 'lucide-react';
import MenuButton from '@/components/MenuButton';
import SettingsButton from '@/components/SettingsButton';
import TabBar from '@/components/TabBar';
import { INVOICE_GUIDE } from '@/lib/course-app-guides';
import styles from './InvoiceGuide.module.css';

const PRACTICE = [
  { label: 'Create a new sale and invoice', feedback: 'That would risk counting the sale again. The buyer needs another copy of the existing document.', correct: false },
  { label: 'Open the invoice from Saved', feedback: 'Yes. Reopen the same invoice, check it and use Share PDF or Print. Another copy is not another sale.', correct: true },
  { label: 'Mark an unpaid invoice as paid', feedback: 'A request for a copy is not evidence of payment. Check the payment separately and keep its status accurate.', correct: false },
] as const;

export default function InvoiceGuidePage() {
  const [answer, setAnswer] = useState<number | null>(null);
  return <div className={styles.page} lang="en">
    <header className={styles.header}>
      <MenuButton />
      <Link href="/student" className={styles.back}><ArrowLeft size={17} /> My Studies</Link>
      <SettingsButton />
    </header>
    <main className={styles.main}>
      <section className={styles.hero} aria-labelledby="guide-title">
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>Using ImbewuField · English guide</p>
          <h1 id="guide-title">{INVOICE_GUIDE.title}</h1>
          <p>{INVOICE_GUIDE.summary} Keep these steps beside you while you work.</p>
          <div className={styles.actions}>
            <a href="#steps" className={styles.primary}>Read the steps <ArrowUpRight size={17} /></a>
            <Link href="/tour">Practise with the sample farm</Link>
          </div>
        </div>
        <figure><img src={INVOICE_GUIDE.image} alt={INVOICE_GUIDE.imageAlt} /><figcaption>Keep the produce and its record together · illustrated example</figcaption></figure>
      </section>

      <section className={styles.prepare} aria-labelledby="prepare-title">
        <h2 id="prepare-title">Have your source record ready</h2>
        <p>Bring the buyer, product, quantity, unit, agreed price and dates. Check payment evidence before choosing paid. For practice, open the sample tour and choose <strong>Record the work and the sale</strong>.</p>
        <p>Use sample details in a group lesson. Keep real customer and banking details private.</p>
      </section>

      <nav className={styles.contents} aria-label="Invoice guide steps">
        {INVOICE_GUIDE.steps.map((step, index) => <a key={step.id} href={`#${step.id}`}><span>{index + 1}</span>{step.title}</a>)}
      </nav>

      <div id="steps" className={styles.steps}>
        {INVOICE_GUIDE.steps.map((step, index) => <section id={step.id} key={step.id} className={styles.step} aria-labelledby={`${step.id}-title`}>
          <div className={styles.stepNumber} aria-hidden="true">{index + 1}</div>
          <div>
            <h2 id={`${step.id}-title`}>{step.title}</h2>
            <p className={styles.actionPath}>{step.action}</p>
            {step.paragraphs.map(text => <p key={text}>{text}</p>)}
            <p className={styles.check}><Check size={19} aria-hidden="true" /><span><strong>Check your work:</strong> {step.check}</span></p>
          </div>
        </section>)}
      </div>

      <section className={styles.practice} aria-labelledby="practice-title">
        <p className={styles.eyebrow}>Try a decision</p>
        <h2 id="practice-title">The buyer wants another copy.</h2>
        <p>You already saved the invoice yesterday. What should you do?</p>
        <div className={styles.choices}>{PRACTICE.map((choice, index) => <button key={choice.label} type="button" aria-pressed={answer === index} onClick={() => setAnswer(index)}>{choice.label}</button>)}</div>
        <div className={styles.feedback} aria-live="polite" aria-atomic="true">{answer !== null && <p data-correct={PRACTICE[answer].correct}>{PRACTICE[answer].feedback}</p>}</div>
        <p className={styles.small}>This practice question does not create an invoice or change your records.</p>
      </section>

      <aside className={styles.limits} aria-labelledby="limits-title">
        <h2 id="limits-title">Know what the app keeps</h2>
        <p>Invoices are saved on this device. Do not assume the complete document is available on another device because a linked sale has synchronised. Keep the source record and a checked copy.</p>
        <p>The VAT/tax-number field prints a reference; it does not calculate VAT or establish that the document meets tax-invoice requirements. For those requirements, check <a href="https://www.sars.gov.za/types-of-tax/value-added-tax/">current SARS guidance</a> with your bookkeeper.</p>
      </aside>

      <section className={styles.finish}>
        <h2>Now try it with your own source record</h2>
        <p>Open Invoice when you are ready to work in your current workspace. Check whether the sale or invoice already exists before adding anything.</p>
        <div className={styles.actions}>
          <Link href="/invoice" className={styles.primary}><FileText size={18} /> Open Invoice</Link>
          <button type="button" onClick={() => window.print()}><Printer size={18} /> Print this guide</button>
          <Link href="/student">Back to Studies</Link>
        </div>
      </section>
    </main>
    <div className="no-print"><TabBar /></div>
  </div>;
}

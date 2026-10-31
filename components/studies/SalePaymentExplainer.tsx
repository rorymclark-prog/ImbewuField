'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { inlineText, inlineTemplate } from '@/lib/xh-inline';
import styles from './SalePaymentExplainer.module.css';

// One sale stays fixed while receipts settle it. These are teaching values, never records.
const stages = [
  { title: 'Agree the order', source: 'Order P01 · R120.00 agreed', invoice: 0, received: 0, owed: 0, text: 'The buyer has ordered. Nothing has been delivered or paid in this example. Keep the agreement; an order is not a cash receipt.' },
  { title: 'Deliver and invoice', source: 'Delivery P01 · Invoice P01', invoice: 120, received: 0, owed: 120, text: 'The agreed produce is delivered and invoiced for R120.00. The buyer has not paid. Keep the delivery and invoice references together.' },
  { title: 'Receive part of the payment', source: 'Receipt P01-A · R40.00 received', invoice: 120, received: 40, owed: 80, text: 'R40.00 settles part of invoice P01. R80.00 remains owed. This is the same produce sale; the receipt does not create another sale.' },
  { title: 'Receive the rest', source: 'Receipt P01-B · another R80.00 received', invoice: 120, received: 120, owed: 0, text: 'The two receipts total R120.00. Invoice P01 is now settled in this example. Keep both receipts and the original invoice; do not add their values as separate sales.' },
] as const;
const rand = (value: number) => `R${value.toFixed(2)}`;

export default function SalePaymentExplainer() {
  const { lang } = useLanguage();
  const tx = (english: string) => inlineText(lang, english);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const stage = stages[step];
  useEffect(() => {
    if (!playing) return;
    if (step === stages.length - 1) { setPlaying(false); return; }
    const timer = window.setTimeout(() => setStep(value => value + 1), 4500);
    return () => window.clearTimeout(timer);
  }, [playing, step]);
  function choose(value: number) { setPlaying(false); setStep(value); }
  return <section className={styles.example} aria-labelledby="payment-example-title">
    <p className={styles.eyebrow}>{tx('Follow a practice sale')}</p>
    <h2 id="payment-example-title">{tx('One invoice. Two payments.')}</h2>
    <p>{tx('Invented values for learning. This example does not change your records.')}</p>
    <div className={styles.stages} aria-label={tx('Payment example stages')}>
      {stages.map((item, index) => <button key={item.title} type="button" aria-pressed={step === index} onClick={() => choose(index)}><span>{index + 1}</span>{tx(item.title)}</button>)}
    </div>
    <div className={styles.paper} aria-live="polite" aria-atomic="true">
      <p className={styles.source}>{tx(stage.source)}</p>
      <h3>{tx(stage.title)}</h3>
      <div className={styles.amounts}>
        <div><span>{tx('Invoice value')}</span><strong>{step === 0 ? tx('Not issued') : rand(stage.invoice)}</strong></div>
        <div><span>{tx('Received so far')}</span><strong>{rand(stage.received)}</strong></div>
        <div><span>{tx('Still owed')}</span><strong>{step === 0 ? tx('Not invoiced') : rand(stage.owed)}</strong></div>
      </div>
      <div className={styles.paymentBar} aria-hidden="true"><span style={{ width: `${stage.received / 120 * 100}%` }} /><span style={{ width: `${stage.owed / 120 * 100}%` }} /></div>
      <p>{tx(stage.text)}</p>
    </div>
    <p className={styles.limit}>{tx('The app currently records paid in full or unpaid. Keep part payments and the remaining balance in a separate checked record; do not mark the invoice fully paid after only a deposit.')}</p>
    <div className={styles.controls}>
      <button type="button" aria-pressed={playing} onClick={() => { if (playing) setPlaying(false); else { if (step === stages.length - 1) setStep(0); setPlaying(true); } }}>{playing ? tx('Pause example') : tx('Play example')}</button>
      <button type="button" onClick={() => choose(step - 1)} disabled={step === 0}>{tx('Previous')}</button>
      <button type="button" onClick={() => choose(step + 1)} disabled={step === stages.length - 1}>{tx('Next')}</button>
      <span>{inlineTemplate(lang, 'Step {n} of {total}', null, { n: step + 1, total: stages.length })}</span>
    </div>
  </section>;
}

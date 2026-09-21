'use client';

import { useState } from 'react';
import styles from './ChartWindowExplainer.module.css';

// A zero-based graph can be negative while the bank still has money. Keep the opening unknown.
const months = [
  { name: 'Month A', incoming: 400, outgoing: 300 },
  { name: 'Month B', incoming: 200, outgoing: 350 },
] as const;
const stages = [
  { title: 'Start with Month A', include: [0], text: 'The selected window begins at zero. R400.00 in less R300.00 out gives a R100.00 running total. We have not supplied a bank opening balance.' },
  { title: 'Include Month B', include: [0, 1], text: 'Across both months, R600.00 came in and R650.00 went out. The running total is −R50.00. That is a net movement across the window, not proof of an overdraft.' },
  { title: 'Start the window later', include: [1], text: 'Now the window starts at Month B, from zero again. R200.00 in less R350.00 out gives −R150.00. No source record changed; only the selected window changed.' },
] as const;
const rand = (value: number) => `${value < 0 ? '−' : ''}R${Math.abs(value).toFixed(2)}`;

export default function ChartWindowExplainer() {
  const [step, setStep] = useState(0);
  const stage = stages[step];
  const included: readonly number[] = stage.include;
  const selected = months.filter((_, index) => included.includes(index));
  const incoming = selected.reduce((total, month) => total + month.incoming, 0);
  const outgoing = selected.reduce((total, month) => total + month.outgoing, 0);
  return <section className={styles.example} aria-labelledby="window-example-title">
    <p className={styles.eyebrow}>Follow a practice window</p>
    <h2 id="window-example-title">The window changes the total.</h2>
    <p>Invented receipts and payments for learning. These controls do not change My Records.</p>
    <div className={styles.stages} aria-label="Cash-window example stages">
      {stages.map((item, index) => <button key={item.title} type="button" aria-pressed={step === index} onClick={() => setStep(index)}>{index + 1}. {item.title}</button>)}
    </div>
    <div className={styles.months}>
      {months.map((month, index) => <div className={styles.month} data-included={included.includes(index)} key={month.name}>
        <h3>{month.name}</h3><p className={styles.status}>{included.includes(index) ? 'Inside this window' : 'Outside this window'}</p>
        <div className={styles.barRow}><span>In {rand(month.incoming)}</span><div className={styles.track}><i style={{ width: `${month.incoming / 400 * 100}%` }} /></div></div>
        <div className={styles.barRow}><span>Out {rand(month.outgoing)}</span><div className={styles.track}><i className={styles.out} style={{ width: `${month.outgoing / 400 * 100}%` }} /></div></div>
      </div>)}
    </div>
    <div className={styles.result} aria-live="polite" aria-atomic="true">
      <h3>{stage.title}</h3>
      <p className={styles.equation}>{rand(incoming)} in − {rand(outgoing)} out = <strong>{rand(incoming - outgoing)}</strong></p>
      <p>{stage.text}</p>
    </div>
    <p className={styles.limit}>The bank balance is unknown in every step. A complete result also needs the relevant costs and other records; changing the window does not supply them.</p>
    <div className={styles.controls}>
      <button type="button" onClick={() => setStep(step - 1)} disabled={step === 0}>Previous example step</button>
      <button type="button" onClick={() => setStep(step + 1)} disabled={step === stages.length - 1}>Next example step</button>
      <span>Step {step + 1} of {stages.length}</span>
    </div>
  </section>;
}

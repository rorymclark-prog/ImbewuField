'use client';

import { useRef, useState } from 'react';
import { f1Positions, type F1Card, type F1Practice } from '@/lib/finance-f1-timeline';
import styles from './FinanceF1Timeline.module.css';

const rand = (cents: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(cents / 100);

function cardText(card: F1Card) {
  const amount = card.sale ?? card.principalReceived ?? (card.cashIn || card.cashOut);
  switch (card.kind) {
    case 'sale': return card.cashIn ? `Produce sale ${card.reference}: ${rand(card.sale ?? 0)} received now.` : `Produce sale ${card.reference}: ${rand(card.sale ?? 0)} to be paid later.`;
    case 'buyer-payment': return `Buyer pays ${rand(card.cashIn)} for the earlier sale ${card.settles}. This is a receipt, not another sale.`;
    case 'loan-received': return `Loan ${card.reference}: ${rand(card.principalReceived ?? 0)} enters the cash tin and is owed back.`;
    case 'loan-payment': return `Loan payment ${card.reference}: ${rand(card.cashOut)} leaves cash, including ${rand(card.principalPaid ?? 0)} of principal and ${rand(card.interestPaid ?? 0)} interest.`;
    case 'owner-contribution': return `Owner puts ${rand(amount)} into the cash tin.`;
    case 'owner-withdrawal': return `Owner takes ${rand(amount)} from the cash tin.`;
    case 'packaging-payment': return `Packaging payment ${card.reference}: ${rand(amount)} leaves the cash tin.`;
    case 'equipment-purchase': return `Equipment purchase ${card.reference}: ${rand(amount)} leaves the cash tin.`;
    case 'transport-payment': return `Transport payment ${card.reference}: ${rand(amount)} leaves the cash tin.`;
    default: return `Source card ${card.id}.`;
  }
}

export default function FinanceF1Timeline({ practice }: { practice: F1Practice }) {
  const positions = f1Positions(practice);
  const [index, setIndex] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const position = positions[index];
  const moveTo = (next: number) => {
    setIndex(next);
    // After a card advances, keep its figures above the fixed assistant button on phones.
    if (window.matchMedia('(max-width: 650px)').matches) requestAnimationFrame(() => stageRef.current?.scrollIntoView({ block: 'start' }));
  };
  return <section className={styles.timeline} aria-label="F1 practice card animation">
    <div className={styles.heading}>
      <div><p className={styles.kicker}>Follow the source cards</p><h3>Watch the four records change</h3></div>
      <span className={styles.progress}>Card {index} of {positions.length - 1}</span>
    </div>
    <p className={styles.intro}>Invented classroom amounts. Start with the opening cash, then move through the cards one at a time. Sales, cash and money owed answer different questions.</p>
    <div className={styles.stage} key={index} ref={stageRef} aria-live="polite" aria-atomic="true">
      <p className={styles.event}>{position.card ? <><strong>Day {position.card.day} · {position.card.id}</strong> {cardText(position.card)}</> : <><strong>Opening position</strong> Cash is in the tin. No produce sale, buyer balance or loan has been recorded yet.</>}</p>
      <div className={styles.accounts}>
        <div className={styles.account}><span>Cash in tin</span><strong>{rand(position.cash)}</strong></div>
        <div className={styles.account}><span>Produce sales recorded</span><strong>{rand(position.sales)}</strong></div>
        <div className={styles.account}><span>Buyer still owes</span><strong>{rand(position.buyerOwes)}</strong></div>
        <div className={styles.account}><span>Loan principal still owed</span><strong>{rand(position.loanOwes)}</strong></div>
      </div>
    </div>
    <div className={styles.controls}>
      <button type="button" onClick={() => moveTo(index - 1)} disabled={index === 0}>← Previous card</button>
      <button type="button" onClick={() => moveTo(index + 1)} disabled={index === positions.length - 1}>Next card →</button>
    </div>
    <p className={styles.caution}>These records do not show full profit. Use your own source documents for a real farm.</p>
  </section>;
}

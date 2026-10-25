'use client';

import { useRef, useState } from 'react';
import { f1Positions, type F1Card, type F1Practice } from '@/lib/finance-f1-timeline';
import styles from './FinanceF1Timeline.module.css';
import ArrowLabel from './ArrowLabel';
import { useLanguage } from '@/lib/i18n';
import { inlineText, inlineTemplate } from '@/lib/xh-inline';

const rand = (cents: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(cents / 100);

function cardText(card: F1Card, lang: string) {
  const amount = card.sale ?? card.principalReceived ?? (card.cashIn || card.cashOut);
  switch (card.kind) {
    case 'sale': return card.cashIn ? inlineTemplate(lang, 'Produce sale {reference}: {amount} received now.', null, { reference: card.reference, amount: rand(card.sale ?? 0) }) : inlineTemplate(lang, 'Produce sale {reference}: {amount} to be paid later.', null, { reference: card.reference, amount: rand(card.sale ?? 0) });
    case 'buyer-payment': return inlineTemplate(lang, 'Buyer pays {amount} for the earlier sale {settles}. This is a receipt, not another sale.', null, { amount: rand(card.cashIn), settles: String(card.settles) });
    case 'loan-received': return inlineTemplate(lang, 'Loan {reference}: {amount} enters the cash tin and is owed back.', null, { reference: card.reference, amount: rand(card.principalReceived ?? 0) });
    case 'loan-payment': return inlineTemplate(lang, 'Loan payment {reference}: {amount} leaves cash, including {principal} of principal and {interest} interest.', null, { reference: card.reference, amount: rand(card.cashOut), principal: rand(card.principalPaid ?? 0), interest: rand(card.interestPaid ?? 0) });
    case 'owner-contribution': return inlineTemplate(lang, 'Owner puts {amount} into the cash tin.', null, { amount: rand(amount) });
    case 'owner-withdrawal': return inlineTemplate(lang, 'Owner takes {amount} from the cash tin.', null, { amount: rand(amount) });
    case 'packaging-payment': return inlineTemplate(lang, 'Packaging payment {reference}: {amount} leaves the cash tin.', null, { reference: card.reference, amount: rand(amount) });
    case 'equipment-purchase': return inlineTemplate(lang, 'Equipment purchase {reference}: {amount} leaves the cash tin.', null, { reference: card.reference, amount: rand(amount) });
    case 'transport-payment': return inlineTemplate(lang, 'Transport payment {reference}: {amount} leaves the cash tin.', null, { reference: card.reference, amount: rand(amount) });
    default: return inlineTemplate(lang, 'Source card {id}.', null, { id: card.id });
  }
}

export default function FinanceF1Timeline({ practice }: { practice: F1Practice }) {
  const { lang } = useLanguage();
  const tx = (english: string) => inlineText(lang, english);
  const positions = f1Positions(practice);
  const [index, setIndex] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const position = positions[index];
  const moveTo = (next: number) => {
    setIndex(next);
    // After a card advances, keep its figures above the fixed assistant button on phones.
    if (window.matchMedia('(max-width: 650px)').matches) requestAnimationFrame(() => stageRef.current?.scrollIntoView({ block: 'start' }));
  };
  return <section className={styles.timeline} aria-label={tx('F1 practice card animation')}>
    <div className={styles.heading}>
      <div><p className={styles.kicker}>{tx('Follow the source cards')}</p><h3>{tx('Watch the four records change')}</h3></div>
      <span className={styles.progress}>{inlineTemplate(lang, 'Card {n} of {total}', null, { n: index, total: positions.length - 1 })}</span>
    </div>
    <p className={styles.intro}>{tx('Invented classroom amounts. Start with the opening cash, then move through the cards one at a time. Sales, cash and money owed answer different questions.')}</p>
    <div className={styles.stage} key={index} ref={stageRef} aria-live="polite" aria-atomic="true">
      <p className={styles.event}>{position.card ? <><strong>{inlineTemplate(lang, 'Day {day} · {id}', null, { day: position.card.day, id: position.card.id })}</strong> {cardText(position.card, lang)}</> : <><strong>{tx('Opening position')}</strong> {tx('Cash is in the tin. No produce sale, buyer balance or loan has been recorded yet.')}</>}</p>
      <div className={styles.accounts}>
        <div className={styles.account}><span>{tx('Cash in tin')}</span><strong>{rand(position.cash)}</strong></div>
        <div className={styles.account}><span>{tx('Produce sales recorded')}</span><strong>{rand(position.sales)}</strong></div>
        <div className={styles.account}><span>{tx('Buyer still owes')}</span><strong>{rand(position.buyerOwes)}</strong></div>
        <div className={styles.account}><span>{tx('Loan principal still owed')}</span><strong>{rand(position.loanOwes)}</strong></div>
      </div>
    </div>
    <div className={styles.controls}>
      <button type="button" onClick={() => moveTo(index - 1)} disabled={index === 0}><ArrowLabel dir="back">{tx('Previous card')}</ArrowLabel></button>
      <button type="button" onClick={() => moveTo(index + 1)} disabled={index === positions.length - 1}><ArrowLabel>{tx('Next card')}</ArrowLabel></button>
    </div>
    <p className={styles.caution}>{tx('These records do not show full profit. Use your own source documents for a real farm.')}</p>
  </section>;
}

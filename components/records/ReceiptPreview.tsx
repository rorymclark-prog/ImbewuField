'use client';

import { useEffect, useRef } from 'react';
import { Eye, Receipt, X } from 'lucide-react';
import type { ExpenseLog } from '@/lib/db/types';
import { announceOverlay } from '@/lib/overlay-signal';

/** The tour's receipt is drawn from its own expense, so the slip and ledger always agree. */
export function ReceiptPaper({ expense }: { expense: Pick<ExpenseLog, 'id' | 'item' | 'supplier' | 'amount' | 'spent_at'> }) {
  const clean = (value: string) => value.replace(/^Sample\s*[—–-]\s*/i, '');
  return <article style={{ margin: '16px auto', maxWidth: 360, padding: '28px 24px', background: '#FFFCF2', color: '#302C24', boxShadow: '0 6px 24px #00000018', borderTop: '5px solid #AC926A', fontFamily: 'var(--font-mono), monospace', lineHeight: 1.65 }}>
    <Receipt size={27} style={{ margin: '0 auto 10px', color: '#6F7656' }} />
    <h3 style={{ fontSize: 18, textAlign: 'center', fontWeight: 700 }}>{clean(expense.supplier || 'Farm inputs')}</h3>
    <p style={{ textAlign: 'center', fontSize: 12, marginBottom: 20 }}>PURCHASE RECEIPT</p>
    <p style={{ fontSize: 12 }}>Ref {expense.id.replace(/^demo-expense-/, 'RC-').toUpperCase()}</p>
    <p style={{ fontSize: 12 }}>{new Date(expense.spent_at).toLocaleDateString('en-ZA')}</p>
    <div style={{ borderTop: '1px dashed #B5AB98', borderBottom: '1px dashed #B5AB98', padding: '16px 0', margin: '16px 0', fontSize: 14 }}>{clean(expense.item)}</div>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 19, fontWeight: 700 }}><span>TOTAL</span><span>R {expense.amount.toFixed(2)}</span></div>
    <p style={{ marginTop: 24, fontSize: 12, textAlign: 'center' }}>Thank you · Keep this receipt</p>
  </article>;
}

export default function ReceiptPreview({ expense }: { expense: ExpenseLog }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => () => { if (dialog.current?.open) announceOverlay(false); }, []);
  return <>
    <button type="button" onClick={() => { dialog.current?.showModal(); announceOverlay(true); }} aria-label={`View receipt for ${expense.item}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '6px 10px', color: 'var(--color-muted-strong)', border: '1px solid var(--color-border)', borderRadius: 9, fontSize: 12 }}><Eye size={16} /> View slip</button>
    <dialog ref={dialog} onClose={() => announceOverlay(false)} aria-label="Purchase receipt" style={{ width: 'min(440px, calc(100vw - 24px))', maxHeight: 'calc(100dvh - 24px)', padding: 16, border: '1px solid #D5CAB6', borderRadius: 18, background: '#EDE6D7', color: '#302C24' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><h2 style={{ fontSize: 20 }}>Purchase receipt</h2><button type="button" aria-label="Close receipt" onClick={() => dialog.current?.close()} style={{ minWidth: 44, minHeight: 44, display: 'grid', placeItems: 'center' }}><X size={22} /></button></div>
      <ReceiptPaper expense={expense} />
    </dialog>
  </>;
}

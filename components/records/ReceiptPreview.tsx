'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Eye, Receipt, X } from 'lucide-react';
import type { ExpenseLog } from '@/lib/db/types';
import { announceOverlay } from '@/lib/overlay-signal';
import { expenseReceiptScope, loadExpenseReceipt, receiptScopeIsCurrent, type ExpenseReceipt } from '@/lib/expense-receipts';
import { getSandboxExpenses, isSampleMode } from '@/lib/sample-mode';
import { useLanguage } from '@/lib/i18n';

/** The tour's receipt is drawn from its own expense, so the slip and ledger always agree. */
export function ReceiptPaper({ expense }: { expense: Pick<ExpenseLog, 'id' | 'item' | 'supplier' | 'amount' | 'spent_at'> }) {
  const { lang } = useLanguage();
  const text = (en: string, zu: string) => lang === 'zu' ? zu : en;
  const clean = (value: string) => value.replace(/^Sample\s*[—–-]\s*/i, '');
  return <article style={{ margin: '16px auto', maxWidth: 360, padding: '28px 24px', background: '#FFFCF2', color: '#302C24', boxShadow: '0 6px 24px #00000018', borderTop: '5px solid #AC926A', fontFamily: 'var(--font-mono), monospace', lineHeight: 1.65 }}>
    <Receipt size={27} style={{ margin: '0 auto 10px', color: '#6F7656' }} />
    <h3 style={{ fontSize: 18, textAlign: 'center', fontWeight: 700 }}>{clean(expense.supplier || text('Farm inputs', 'Izinto zasepulazini'))}</h3>
    <p style={{ textAlign: 'center', fontSize: 12, marginBottom: 20 }}>{text('PURCHASE RECEIPT', 'IRISIDI LOKUTHENGA')}</p>
    <p style={{ fontSize: 12 }}>{text('Ref', 'Inombolo')} {expense.id.replace(/^demo-expense-/, 'RC-').toUpperCase()}</p>
    <p style={{ fontSize: 12 }}>{new Date(expense.spent_at).toLocaleDateString('en-ZA')}</p>
    <div style={{ borderTop: '1px dashed #B5AB98', borderBottom: '1px dashed #B5AB98', padding: '16px 0', margin: '16px 0', fontSize: 14 }}>{clean(expense.item)}</div>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 19, fontWeight: 700 }}><span>{text('TOTAL', 'ISAMBA')}</span><span>R {expense.amount.toFixed(2)}</span></div>
    <p style={{ marginTop: 24, fontSize: 12, textAlign: 'center' }}>{text('Thank you · Keep this receipt', 'Siyabonga · Gcina le risidi')}</p>
  </article>;
}

export default function ReceiptPreview({ expense }: { expense: ExpenseLog }) {
  const { lang } = useLanguage();
  const text = (en: string, zu: string) => lang === 'zu' ? zu : en;
  const dialog = useRef<HTMLDialogElement>(null);
  const [receipt, setReceipt] = useState<ExpenseReceipt | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [prepared, setPrepared] = useState(false);
  const request = useRef(0);
  const sourceScope = useRef(expenseReceiptScope());
  const activeUrl = useRef('');

  function clearPhoto() {
    request.current += 1;
    if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
    activeUrl.current = '';
    setPhotoUrl(''); setReceipt(null); setPrepared(false); setLoading(false);
  }

  useEffect(() => {
    const close = () => { dialog.current?.close(); clearPhoto(); };
    window.addEventListener('imbewu-sample-mode-changed', close);
    return () => {
      request.current += 1;
      if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
      if (dialog.current?.open) announceOverlay(false);
      window.removeEventListener('imbewu-sample-mode-changed', close);
    };
  }, []);

  async function openReceipt() {
    if (!receiptScopeIsCurrent(sourceScope.current)) return;
    clearPhoto(); setError(''); setLoading(true);
    dialog.current?.showModal(); announceOverlay(true);
    const scope = sourceScope.current;
    const version = request.current;
    try {
      const stored = await loadExpenseReceipt(scope, expense.id);
      if (version !== request.current || !receiptScopeIsCurrent(scope)) return;
      if (stored) {
        const url = URL.createObjectURL(stored.original);
        activeUrl.current = url; setPhotoUrl(url); setReceipt(stored);
      } else {
        // Only the isolated tour may draw a prepared receipt. A real expense
        // without a photo must never be presented as an uploaded supplier slip.
        setPrepared(isSampleMode() && getSandboxExpenses().some(row => row.id === expense.id));
      }
    } catch (cause) {
      if (version === request.current && receiptScopeIsCurrent(scope)) setError(cause instanceof Error ? cause.message : text('Could not open this receipt. Try again.', 'Asikwazanga ukuvula le risidi. Zama futhi.'));
    } finally {
      if (version === request.current && receiptScopeIsCurrent(scope)) setLoading(false);
    }
  }

  return <>
    <button type="button" onClick={() => void openReceipt()} aria-label={`${text('View receipt for', 'Buka irisidi lika')} ${expense.item}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '6px 10px', color: 'var(--color-muted-strong)', border: '1px solid var(--color-border)', borderRadius: 9, fontSize: 12 }}><Eye size={16} /> {text('View slip', 'Buka irisidi')}</button>
    <dialog ref={dialog} onClose={() => { announceOverlay(false); clearPhoto(); }} aria-label={text('Purchase receipt', 'Irisidi lokuthenga')} style={{ width: `min(${photoUrl ? 760 : 440}px, calc(100vw - 24px))`, maxHeight: 'calc(100dvh - 24px)', overflow: 'auto', padding: 16, border: '1px solid #D5CAB6', borderRadius: 18, background: '#EDE6D7', color: '#302C24' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><h2 style={{ fontSize: 20 }}>{text('Purchase receipt', 'Irisidi lokuthenga')}</h2><button type="button" aria-label={text('Close receipt', 'Vala irisidi')} onClick={() => dialog.current?.close()} style={{ minWidth: 44, minHeight: 44, display: 'grid', placeItems: 'center' }}><X size={22} /></button></div>
      {loading ? <p role="status">{text('Opening receipt…', 'Kuvulwa irisidi…')}</p> : error ? <div><p role="alert">{error}</p><button type="button" onClick={() => void openReceipt()} style={{ minHeight: 44, textDecoration: 'underline' }}>{text('Try again', 'Zama futhi')}</button></div>
        : photoUrl && receipt ? <>
          <p style={{ margin: '8px 0', fontSize: 14 }}>{expense.item} · R {expense.amount.toFixed(2)}</p>
          <p style={{ margin: '8px 0', fontSize: 12 }}>{text('Original photo · saved on this device only', 'Isithombe sokuqala · sigcinwe kule divayisi kuphela')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
            <a href={photoUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, gap: 6, textDecoration: 'underline' }}><Eye size={16} /> {text('Open full size', 'Vula ngosayizi ophelele')}</a>
            <a href={photoUrl} download={receipt.name || 'receipt-photo'} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, gap: 6, textDecoration: 'underline' }}><Download size={16} /> {text('Download original', 'Landa esokuqala')}</a>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt={`Original receipt photo for ${expense.item}`} style={{ display: 'block', width: '100%', height: 'auto', background: '#fff' }} />
        </> : prepared ? <ReceiptPaper expense={expense} />
          : <p style={{ margin: '16px 0', lineHeight: 1.6 }}>{text('No receipt photo is saved for this cost on this device. Edit the cost to attach one, or open it on the device where you saved the photo.', 'Asikho isithombe serisidi salezi zindleko esigcinwe kule divayisi. Hlela izindleko ukuze ufake isithombe, noma uzivule kudivayisi owalondoloza kuyo isithombe.')}</p>}
    </dialog>
  </>;
}

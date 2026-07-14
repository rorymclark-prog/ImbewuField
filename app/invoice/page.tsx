'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Printer, FileText, Share2, FilePlus2, Clock, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import BackButton from '@/components/BackButton';
import BrandLogo from '@/components/BrandLogo';
import SettingsButton from '@/components/SettingsButton';
import TabBar from '@/components/TabBar';
import {
  loadCustomers, addCustomer, loadProducts, addProduct,
  loadInvoices, saveInvoice, deleteInvoice, setInvoiceStatus, invoiceId,
  paymentMethodLabel, type SavedInvoice, type PaymentMethod,
} from '@/lib/invoices';

interface LineItem { id: number; desc: string; qty: number; unit: string; price: number }

const UNITS = ['bags', 'kg', 'crates', 'bunches', 'trays', 'each'];
const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'eft', 'card', 'mobile', 'other'];
const SEQ_KEY = 'imbewu_invoice_seq';

function todayLong() {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function InvoicePage() {
  const { user, profile } = useAuth();

  const [seq, setSeq] = useState(44);          // next NEW invoice number
  const [currentNo, setCurrentNo] = useState(44); // number shown on the current doc
  const [currentId, setCurrentId] = useState<string | null>(null); // set when reprinting a saved one
  const [billTo, setBillTo] = useState('');
  const [items, setItems] = useState<LineItem[]>([
    { id: 1, desc: '', qty: 1, unit: 'bags', price: 0 },
  ]);
  const [nextId, setNextId] = useState(2);

  // Remembered customers / item presets / past invoices
  const [customers, setCustomers] = useState<string[]>([]);
  const [products, setProducts] = useState<{ desc: string; unit: string; price: number }[]>([]);
  const [saved, setSaved] = useState<SavedInvoice[]>([]);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEQ_KEY);
      if (raw) { const n = parseInt(raw, 10) || 44; setSeq(n); setCurrentNo(n); }
    } catch { /* ignore */ }
    const refresh = () => { setCustomers(loadCustomers()); setProducts(loadProducts()); setSaved(loadInvoices()); };
    refresh();
    window.addEventListener('imbewu-invoices-changed', refresh);
    return () => window.removeEventListener('imbewu-invoices-changed', refresh);
  }, []);

  const sellerName = profile?.full_name ?? user?.displayName ?? 'Your name';
  const sellerPhone = profile?.phone ?? '';
  const invoiceNo = `#${String(currentNo).padStart(4, '0')}`;
  const total = items.reduce((s, it) => s + it.qty * it.price, 0);
  const valid = billTo.trim() !== '' && items.some((it) => it.desc.trim() !== '' && it.qty > 0);

  function updateItem(id: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it) => {
      if (it.id !== id) return it;
      const next = { ...it, ...patch };
      // Typing/picking a known item name auto-fills its saved unit & price
      if (patch.desc !== undefined) {
        const match = products.find((p) => p.desc.toLowerCase() === patch.desc!.trim().toLowerCase());
        if (match && it.price === 0) { next.unit = match.unit; next.price = match.price; }
      }
      return next;
    }));
  }
  function addItem() {
    setItems((prev) => [...prev, { id: nextId, desc: '', qty: 1, unit: 'bags', price: 0 }]);
    setNextId((n) => n + 1);
  }
  function removeItem(id: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));
  }

  // Persist the customer, item presets and the invoice record. Returns its id.
  function persist(): string {
    const id = currentId ?? invoiceId();
    const existing = saved.find((s) => s.id === id);
    addCustomer(billTo);
    items.forEach((it) => { if (it.desc.trim()) addProduct({ desc: it.desc.trim(), unit: it.unit, price: it.price }); });
    saveInvoice({
      id, no: currentNo, billTo: billTo.trim(),
      items: items.filter((it) => it.desc.trim()).map(({ desc, qty, unit, price }) => ({ desc, qty, unit, price })),
      total, dateISO: new Date().toISOString(),
      status: existing?.status ?? 'unpaid',
      paidAt: existing?.paidAt,
    });
    if (currentId === null) {
      const nextSeq = currentNo + 1;
      setSeq(nextSeq);
      try { localStorage.setItem(SEQ_KEY, String(nextSeq)); } catch { /* ignore */ }
    }
    setCurrentId(id);
    return id;
  }

  function printInvoice() {
    if (valid) persist();
    window.print();
  }

  // Build a crisp vector PDF of the invoice (matches the on-screen layout).
  async function buildInvoiceFile(): Promise<File> {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const M = 48;
    let y = 70;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(32, 25, 15);
    doc.text(sellerName, M, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(92, 80, 64);
    y += 16; doc.text('Tugela Valley smallholding', M, y);
    if (sellerPhone) { y += 13; doc.text(sellerPhone, M, y); }

    doc.setFillColor(31, 77, 43); doc.roundedRect(W - M - 30, 54, 30, 30, 5, 5, 'F');

    y += 26; doc.setDrawColor(226, 216, 196); doc.line(M, y, W - M, y);
    y += 18; doc.setFontSize(10); doc.setTextColor(140, 122, 98);
    doc.text(`Invoice ${invoiceNo}`, M, y);
    doc.text(todayLong(), W - M, y, { align: 'right' });
    y += 12; doc.line(M, y, W - M, y);

    y += 28; doc.setFontSize(8); doc.setTextColor(140, 122, 98); doc.text('BILL TO', M, y);
    y += 15; doc.setFontSize(12); doc.setTextColor(32, 25, 15); doc.text(billTo.trim() || '—', M, y);

    y += 28;
    items.filter((it) => it.desc.trim()).forEach((it) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(32, 25, 15);
      doc.text(`${it.desc.trim()}  ·  ${it.qty} ${it.unit}`, M, y);
      doc.text(money(it.qty * it.price), W - M, y, { align: 'right' });
      if (it.price > 0) { y += 13; doc.setFontSize(9); doc.setTextColor(140, 122, 98); doc.text(`${money(it.price)} each`, M, y); }
      y += 22;
    });

    y += 4; doc.setLineWidth(1.5); doc.setDrawColor(31, 77, 43); doc.line(M, y, W - M, y); doc.setLineWidth(1);
    y += 22; doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(32, 25, 15); doc.text('Total', M, y);
    doc.setFontSize(17); doc.setTextColor(31, 77, 43); doc.text(money(total), W - M, y, { align: 'right' });

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(140, 122, 98);
    doc.text('Generated by ImbewuField · fieldproof.vercel.app', W / 2, 808, { align: 'center' });

    const blob = doc.output('blob');
    return new File([blob], `Invoice-${String(currentNo).padStart(4, '0')}.pdf`, { type: 'application/pdf' });
  }

  // Share the PDF via the device share sheet (tap WhatsApp → PDF attached).
  // Falls back to a download where file-sharing isn't supported (e.g. desktop).
  async function shareInvoice() {
    if (!valid) return;
    persist();
    let file: File;
    try { file = await buildInvoiceFile(); } catch { return; }
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare && nav.canShare({ files: [file] })) {
      try { await nav.share({ files: [file], title: `Invoice ${invoiceNo}` }); }
      catch { /* user cancelled — leave it */ }
      return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function newInvoice() {
    setCurrentId(null);
    setCurrentNo(seq);
    setBillTo('');
    setItems([{ id: 1, desc: '', qty: 1, unit: 'bags', price: 0 }]);
    setNextId(2);
    setShowSaved(false);
  }

  function openSaved(inv: SavedInvoice) {
    setCurrentId(inv.id);
    setCurrentNo(inv.no);
    setBillTo(inv.billTo);
    setItems(inv.items.map((it, i) => ({ id: i + 1, ...it })));
    setNextId(inv.items.length + 1);
    setShowSaved(false);
  }

  const money = (n: number) => `R${n.toLocaleString('en-ZA')}`;

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#F7F2E9' }}>
      {/* Header */}
      <header className="no-print flex-shrink-0 flex items-center px-4 gap-3" style={{ height: 52, background: '#FBF6EC', borderBottom: '1px solid #E2D8C4' }}>
        <BackButton fallback="/finances" />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
        <span className="text-xs font-display" style={{ color: '#5C5040' }}>Invoice</span>
        <div className="flex-1" />
        <button
          onClick={shareInvoice}
          disabled={!valid}
          aria-label="Share PDF (WhatsApp, email…)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold"
          style={{ background: valid ? '#25D366' : 'rgba(226,216,196,0.6)', color: valid ? '#fff' : '#8C7A62', border: 'none', cursor: valid ? 'pointer' : 'not-allowed' }}
        >
          <Share2 size={13} />Share PDF
        </button>
        <button
          onClick={printInvoice}
          disabled={!valid}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold"
          style={{ background: valid ? '#C07A1E' : 'rgba(226,216,196,0.6)', color: valid ? '#fff' : '#8C7A62', border: 'none', cursor: valid ? 'pointer' : 'not-allowed' }}
        >
          <Printer size={13} />Print
        </button>
        <SettingsButton />
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 py-5 space-y-4">

          {/* ── Invoice document (printable) ───────────────────────────── */}
          <div id="invoice-doc" className="rounded-2xl p-5" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
            {/* Seller + logo */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-display font-bold text-lg" style={{ color: '#20190F', lineHeight: 1.15 }}>{sellerName}</div>
                <div className="text-xs font-sans mt-0.5" style={{ color: '#5C5040' }}>Tugela Valley smallholding</div>
                {sellerPhone && <div className="text-xs font-sans" style={{ color: '#5C5040' }}>{sellerPhone}</div>}
              </div>
              <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 40, height: 40, background: '#1F4D2B' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EAF3E2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21V11" /><path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z" /><path d="M12 13c0-3 2.2-5.2 6-5.2 0 3.6-2.2 5.2-6 5.2Z" />
                </svg>
              </div>
            </div>

            {/* Invoice no + date */}
            <div className="flex items-center justify-between py-2.5" style={{ borderTop: '1px solid #E2D8C4', borderBottom: '1px solid #E2D8C4' }}>
              <span className="text-xs font-sans" style={{ color: '#8C7A62' }}>Invoice {invoiceNo}</span>
              <span className="text-xs font-sans" style={{ color: '#8C7A62' }}>{todayLong()}</span>
            </div>

            {/* Bill to */}
            <div className="mt-3.5">
              <div className="text-xs font-sans uppercase tracking-widest mb-1" style={{ color: '#8C7A62', letterSpacing: '0.1em' }}>Bill to</div>
              <div className="font-display text-sm" style={{ color: billTo.trim() ? '#20190F' : '#B8AC97' }}>
                {billTo.trim() || 'Buyer name'}
              </div>
            </div>

            {/* Line items */}
            <div className="mt-3.5 space-y-2">
              {items.map((it) => (
                <div key={it.id} className="flex items-baseline justify-between">
                  <div className="min-w-0 pr-2">
                    <div className="font-display text-sm" style={{ color: it.desc.trim() ? '#20190F' : '#B8AC97' }}>
                      {it.desc.trim() || 'Item'} {it.qty > 0 && <span style={{ color: '#5C5040' }}>· {it.qty} {it.unit}</span>}
                    </div>
                    {it.price > 0 && <div className="text-xs font-sans" style={{ color: '#8C7A62' }}>{money(it.price)} each</div>}
                  </div>
                  <div className="font-display text-sm font-semibold tabular-nums flex-shrink-0" style={{ color: '#20190F' }}>{money(it.qty * it.price)}</div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '2px solid #1F4D2B' }}>
              <span className="font-display font-semibold text-sm" style={{ color: '#20190F' }}>Total</span>
              <span className="font-display font-bold text-xl tabular-nums" style={{ color: '#1F4D2B' }}>{money(total)}</span>
            </div>

            <div className="print-only text-center text-xs font-sans mt-6" style={{ color: '#8C7A62' }}>
              Generated by ImbewuField · fieldproof.vercel.app
            </div>
          </div>

          {/* ── Editor (screen only) ───────────────────────────────────── */}
          <div className="no-print space-y-4">

            {/* Autocomplete sources — remembered customers & item presets */}
            <datalist id="customers-list">{customers.map((c) => <option key={c} value={c} />)}</datalist>
            <datalist id="products-list">{products.map((p) => <option key={p.desc} value={p.desc} />)}</datalist>

            {/* New invoice + recall past invoices */}
            <div className="flex items-center gap-2">
              <button onClick={newInvoice}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-display font-semibold"
                style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', color: '#1F4D2B', cursor: 'pointer' }}>
                <FilePlus2 size={14} />New invoice
              </button>
              <button onClick={() => setShowSaved((s) => !s)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-display font-semibold"
                style={{ background: showSaved ? 'rgba(31,77,43,0.1)' : '#FBF6EC', border: '1px solid #E2D8C4', color: '#1F4D2B', cursor: 'pointer' }}>
                <Clock size={14} />Saved{saved.length ? ` (${saved.length})` : ''}
              </button>
              {currentId && (
                <span className="text-xs font-sans" style={{ color: '#8C7A62' }}>Editing {invoiceNo}</span>
              )}
            </div>

            {/* Saved-invoices list — tap to reopen/reprint */}
            {showSaved && (
              <div className="rounded-xl overflow-hidden" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
                {saved.length === 0 ? (
                  <div className="px-3 py-3 text-xs font-sans" style={{ color: '#8C7A62' }}>
                    No saved invoices yet — Print or Share one and it&apos;s kept here.
                  </div>
                ) : saved.map((inv) => (
                  <div key={inv.id} className="px-3 py-2.5" style={{ borderBottom: '1px solid #E2D8C4' }}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openSaved(inv)} className="flex-1 min-w-0 text-left" style={{ cursor: 'pointer' }}>
                        <div className="font-display text-sm" style={{ color: '#20190F' }}>
                          #{String(inv.no).padStart(4, '0')} · {inv.billTo || 'No buyer'}
                        </div>
                        <div className="text-xs font-sans" style={{ color: '#8C7A62' }}>
                          {new Date(inv.dateISO).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {money(inv.total)}
                        </div>
                      </button>
                      <button
                        onClick={() => setSaved(setInvoiceStatus(inv.id, inv.status === 'paid' ? 'unpaid' : 'paid'))}
                        aria-label={inv.status === 'paid' ? 'Mark unpaid' : 'Mark paid'}
                        className="flex-shrink-0 px-2 py-1 rounded-full text-xs font-display font-semibold"
                        style={inv.status === 'paid'
                          ? { background: 'rgba(46,107,58,0.12)', border: '1px solid rgba(46,107,58,0.3)', color: '#2E6B3A', cursor: 'pointer' }
                          : { background: 'rgba(192,122,30,0.12)', border: '1px solid rgba(192,122,30,0.3)', color: '#C07A1E', cursor: 'pointer' }}>
                        {inv.status === 'paid' ? 'Paid' : 'Unpaid'}
                      </button>
                      <button onClick={() => deleteInvoice(inv.id)} aria-label="Delete invoice"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#5C5040', opacity: 0.5 }}>
                        <X size={15} />
                      </button>
                    </div>
                    {inv.status === 'paid' && (
                      <div className="flex flex-wrap gap-1.5 mt-2 pl-0.5">
                        {PAYMENT_METHODS.map((m) => (
                          <button key={m} onClick={() => setSaved(setInvoiceStatus(inv.id, 'paid', m))}
                            className="px-2.5 py-1 rounded-full text-xs font-sans font-semibold capitalize transition-all"
                            style={inv.paymentMethod === m
                              ? { background: '#1F4D2B', color: '#fff', border: '1px solid #1F4D2B', cursor: 'pointer' }
                              : { background: '#FBF6EC', color: '#5C5040', border: '1px solid #E2D8C4', cursor: 'pointer' }}>
                            {paymentMethodLabel(m)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Bill to */}
            <label className="block">
              <div className="text-xs font-sans uppercase tracking-wider mb-1" style={{ color: '#8C7A62' }}>Bill to</div>
              <input value={billTo} onChange={(e) => setBillTo(e.target.value)}
                list="customers-list" autoComplete="off"
                placeholder="e.g. Spar Nquthu (wholesale)"
                className="w-full text-sm font-display outline-none rounded-xl px-3 py-2.5"
                style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', color: '#20190F' }} />
            </label>

            {/* Line item editors */}
            <div className="space-y-2.5">
              <div className="text-xs font-sans uppercase tracking-wider" style={{ color: '#8C7A62' }}>Line items</div>
              {items.map((it) => (
                <div key={it.id} className="rounded-xl p-3 space-y-2" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
                  <div className="flex items-center gap-2">
                    <input value={it.desc} onChange={(e) => updateItem(it.id, { desc: e.target.value })}
                      list="products-list" autoComplete="off"
                      placeholder="Crop / item (e.g. Amadumbe)"
                      className="flex-1 text-sm font-display outline-none rounded-lg px-2.5 py-2"
                      style={{ background: '#fff', border: '1px solid #E2D8C4', color: '#20190F' }} />
                    <button onClick={() => removeItem(it.id)} aria-label="Remove item"
                      className="flex-shrink-0 opacity-40 hover:opacity-80 transition-opacity"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#5C5040' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} inputMode="numeric" value={it.qty || ''} onChange={(e) => updateItem(it.id, { qty: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                      placeholder="Qty"
                      className="w-16 text-sm font-display outline-none rounded-lg px-2.5 py-2 tabular-nums"
                      style={{ background: '#fff', border: '1px solid #E2D8C4', color: '#20190F' }} />
                    <select value={it.unit} onChange={(e) => updateItem(it.id, { unit: e.target.value })}
                      className="text-sm font-display outline-none rounded-lg px-2 py-2 appearance-none"
                      style={{ background: '#fff', border: '1px solid #E2D8C4', color: '#20190F' }}>
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <div className="flex items-center gap-1 flex-1 rounded-lg px-2.5 py-2" style={{ background: '#fff', border: '1px solid #E2D8C4' }}>
                      <span className="text-sm font-display" style={{ color: '#8C7A62' }}>R</span>
                      <input type="number" min={0} inputMode="decimal" value={it.price || ''} onChange={(e) => updateItem(it.id, { price: Math.max(0, parseFloat(e.target.value) || 0) })}
                        placeholder="0"
                        className="w-full text-sm font-display outline-none tabular-nums"
                        style={{ background: 'transparent', border: 'none', color: '#20190F' }} />
                      <span className="text-xs font-sans whitespace-nowrap" style={{ color: '#8C7A62' }}>each</span>
                    </div>
                  </div>
                </div>
              ))}

              <button onClick={addItem}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-display font-semibold"
                style={{ background: 'rgba(31,77,43,0.06)', border: '1px dashed rgba(31,77,43,0.3)', color: '#1F4D2B', cursor: 'pointer' }}>
                <Plus size={14} />Add line item
              </button>
            </div>

            <div className="flex gap-2">
              <button onClick={shareInvoice} disabled={!valid}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-display font-semibold"
                style={{ background: valid ? '#25D366' : 'rgba(226,216,196,0.6)', color: valid ? '#fff' : '#8C7A62', border: 'none', cursor: valid ? 'pointer' : 'not-allowed' }}>
                <Share2 size={15} />Share PDF
              </button>
              <button onClick={printInvoice} disabled={!valid}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-display font-semibold"
                style={{ background: valid ? '#C07A1E' : 'rgba(226,216,196,0.6)', color: valid ? '#fff' : '#8C7A62', border: 'none', cursor: valid ? 'pointer' : 'not-allowed' }}>
                <Printer size={15} />Print
              </button>
            </div>

            {!valid && (
              <p className="text-center text-xs font-sans flex items-center justify-center gap-1.5" style={{ color: '#8C7A62' }}>
                <FileText size={12} />Add a buyer and at least one item to print
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="no-print"><TabBar /></div>

      {/* Print styles — show only the invoice document on paper */}
      <style jsx global>{`
        .print-only { display: none; }
        @media print {
          @page { size: A4 portrait; margin: 18mm 16mm; }
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-shadow: none !important;
          }
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .fixed, [style*="position: fixed"], [style*="position:fixed"] {
            position: static !important; height: auto !important; overflow: visible !important;
          }
          #invoice-doc {
            border: none !important;
            background: #fff !important;
            max-width: 100% !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

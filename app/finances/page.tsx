'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { TrendingUp, Scale, Receipt, Plus, Sprout, FileText, Download, Camera, Loader2, Pencil, Trash2, Sparkles } from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebase } from '@/lib/firebase/init';
import {
  addSale, addExpense, myProduction, mySales, myExpenses,
  updateSale, updateExpense, deleteSale, deleteExpense,
} from '@/lib/db/queries';
import type { SalesLog, ProductionLog, ExpenseLog, ExpenseCategory } from '@/lib/db/types';
import { loadInvoices, saveInvoice, addCustomer, addProduct, invoiceId, paymentMethodLabel, type SavedInvoice } from '@/lib/invoices';
import HarvestReconciliation from '@/components/HarvestReconciliation';
import BrandLogo from '@/components/BrandLogo';
import SettingsButton from '@/components/SettingsButton';
import TabBar from '@/components/TabBar';
import LessonLink from '@/components/design/LessonLink';

/* ── Format helpers ──────────────────────────────────────────────────────── */

/** Format as "R 1 200" with space thousands separator */
function fmtZAR(amount: number): string {
  const rounded = Math.round(amount);
  const str = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `R ${str}`;
}

function fmtDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  const d = new Date(raw);
  return isNaN(d.getTime())
    ? raw
    : d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

function isThisMonth(isoString: string | null | undefined): boolean {
  if (!isoString) return false;
  const d = new Date(isoString);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

/* ── Expense categories ──────────────────────────────────────────────────── */

const EXPENSE_CATEGORIES: ExpenseCategory[] = ['feed', 'seed', 'fuel', 'equipment', 'labour', 'transport', 'other'];

function categoryLabel(c: ExpenseCategory | null | undefined): string {
  if (!c) return '';
  return c.charAt(0).toUpperCase() + c.slice(1);
}

/* ── Skeleton loader ─────────────────────────────────────────────────────── */

function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-lg ${className}`}
      style={{ background: 'rgba(226,216,196,0.55)', ...style }}
    />
  );
}

/* ── Summary cards ───────────────────────────────────────────────────────── */

interface SummaryProps {
  sales: SalesLog[];
  production: ProductionLog[];
  expenses: ExpenseLog[];
  invoices: SavedInvoice[];
  loading: boolean;
}

function SummaryCards({ sales, production, expenses, invoices, loading }: SummaryProps) {
  const thisMonthSales = sales.filter((s) => isThisMonth(s.sold_at));
  const thisMonthPaidInvoices = invoices.filter((i) => i.status === 'paid' && isThisMonth(i.paidAt));
  const totalRevenue = thisMonthSales.reduce((acc, s) => acc + (s.amount ?? 0), 0)
    + thisMonthPaidInvoices.reduce((acc, i) => acc + (i.total ?? 0), 0);
  const totalSpent = expenses
    .filter((x) => isThisMonth(x.spent_at))
    .reduce((acc, x) => acc + (x.amount ?? 0), 0);
  const totalKg = production
    .filter((p) => isThisMonth(p.logged_at))
    .reduce((acc, p) => acc + (p.kg ?? 0), 0);

  const cards = [
    {
      icon: <TrendingUp size={16} />,
      label: 'Sold this month',
      value: fmtZAR(totalRevenue),
      color: '#2E6B3A',
      bg: 'rgba(46,107,58,0.08)',
      border: 'rgba(46,107,58,0.18)',
    },
    {
      icon: <Receipt size={16} />,
      label: 'Spent this month',
      value: totalSpent ? fmtZAR(totalSpent) : 'R 0',
      color: '#C07A1E',
      bg: 'rgba(192,122,30,0.08)',
      border: 'rgba(192,122,30,0.18)',
    },
    {
      icon: <Scale size={16} />,
      label: 'Kg harvested',
      value: `${totalKg.toFixed(1)} kg`,
      color: '#235E86',
      bg: 'rgba(35,94,134,0.08)',
      border: 'rgba(35,94,134,0.18)',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((card, i) => (
        <div
          key={i}
          className="rounded-2xl p-3 flex flex-col gap-2"
          style={{
            background: card.bg,
            border: `1px solid ${card.border}`,
          }}
        >
          <div style={{ color: card.color }}>{card.icon}</div>
          {loading ? (
            <>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-full" />
            </>
          ) : (
            <>
              <p
                className="font-display font-bold text-sm leading-tight"
                style={{ color: '#20190F' }}
              >
                {card.value}
              </p>
              <p className="font-mono text-xs leading-tight" style={{ color: '#5C5040' }}>
                {card.label}
              </p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Recent sales/expenses/invoices ledger (phone) ───────────────────────── */

// Unified row shape the phone ledger renders — one of sale | expense | invoice.
interface PhoneRow {
  kind: 'sale' | 'expense' | 'invoice';
  id: string;
  iso: string;
  title: string;
  subtitle: string;
  amount: number;
  positive: boolean; // true = money in (green), false = money out (amber)
}

function toPhoneRows(sales: SalesLog[], expenses: ExpenseLog[], invoices: SavedInvoice[]): PhoneRow[] {
  const saleRows: PhoneRow[] = sales.map((s) => ({
    kind: 'sale', id: s.id, iso: s.sold_at ?? '',
    title: s.crop, subtitle: s.buyer ? `via ${s.buyer} · ${s.kg} kg` : `${s.kg} kg`,
    amount: s.amount ?? 0, positive: true,
  }));
  const expenseRows: PhoneRow[] = expenses.map((x) => ({
    kind: 'expense', id: x.id, iso: x.spent_at ?? '',
    title: x.item, subtitle: [categoryLabel(x.category), x.supplier].filter(Boolean).join(' · '),
    amount: x.amount ?? 0, positive: false,
  }));
  const paidInvoiceRows: PhoneRow[] = invoices
    .filter((i) => i.status === 'paid')
    .map((i) => ({
      kind: 'invoice', id: i.id, iso: i.paidAt ?? i.dateISO,
      title: `Invoice #${i.no} — ${i.billTo || 'No buyer'}`,
      subtitle: i.paymentMethod ? `Paid · ${paymentMethodLabel(i.paymentMethod)}` : 'Paid invoice',
      amount: i.total ?? 0, positive: true,
    }));
  return [...saleRows, ...expenseRows, ...paidInvoiceRows].sort((a, b) => (b.iso ?? '').localeCompare(a.iso ?? ''));
}

interface SalesLedgerProps {
  sales: SalesLog[];
  expenses: ExpenseLog[];
  invoices: SavedInvoice[];
  loading: boolean;
  onEditSale: (s: SalesLog) => void;
  onEditExpense: (x: ExpenseLog) => void;
  onDeleteSale: (id: string) => void;
  onDeleteExpense: (id: string) => void;
}

function SalesLedger({ sales, expenses, invoices, loading, onEditSale, onEditExpense, onDeleteSale, onDeleteExpense }: SalesLedgerProps) {
  const rows = toPhoneRows(sales, expenses, invoices);

  // Two-tap delete: first tap arms (shows confirm), second tap within 3.5s deletes.
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function requestDelete(row: PhoneRow) {
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    if (pendingDelete === row.id) {
      setPendingDelete(null);
      if (row.kind === 'sale') onDeleteSale(row.id);
      else if (row.kind === 'expense') onDeleteExpense(row.id);
      return;
    }
    setPendingDelete(row.id);
    pendingTimer.current = setTimeout(() => setPendingDelete(null), 3500);
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}
    >
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ borderBottom: '1px solid #E2D8C4' }}
      >
        <Receipt size={14} style={{ color: '#5C5040' }} />
        <span className="text-xs font-mono uppercase tracking-wider" style={{ color: '#5C5040' }}>
          Recent activity
        </span>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/3" style={{ animationDelay: `${i * 80}ms` }} />
                <Skeleton className="h-3 w-1/3" style={{ animationDelay: `${i * 80 + 40}ms` }} />
              </div>
              <Skeleton className="h-4 w-16" style={{ animationDelay: `${i * 80}ms` }} />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 px-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.12)' }}
          >
            <Sprout size={20} style={{ color: '#1F4D2B' }} />
          </div>
          <p className="text-sm font-display text-center" style={{ color: '#5C5040' }}>
            No sales logged yet
          </p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: '#E2D8C4' }}>
          {rows.map((item) => (
            <div key={`${item.kind}-${item.id}`} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-display font-medium leading-snug truncate"
                  style={{ color: '#20190F' }}
                >
                  {item.title}
                </p>
                {item.subtitle && (
                  <p className="text-xs font-mono mt-0.5" style={{ color: '#8C7A62' }}>
                    {item.subtitle}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0 text-right">
                <p
                  className="text-sm font-display font-semibold"
                  style={{ color: item.positive ? '#2E6B3A' : '#C07A1E' }}
                >
                  {item.positive ? '+' : '-'}{fmtZAR(item.amount)}
                </p>
                <p className="text-xs font-mono mt-0.5" style={{ color: '#8C7A62' }}>
                  {fmtDate(item.iso)}
                </p>
              </div>
              {item.kind !== 'invoice' && (
                <div className="flex-shrink-0 flex items-center gap-1 pl-1">
                  <button
                    type="button"
                    aria-label="Edit"
                    onClick={() => {
                      const src = item.kind === 'sale' ? sales.find((s) => s.id === item.id) : expenses.find((x) => x.id === item.id);
                      if (!src) return;
                      if (item.kind === 'sale') onEditSale(src as SalesLog); else onEditExpense(src as ExpenseLog);
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#5C5040', opacity: 0.55 }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={pendingDelete === item.id ? 'Confirm delete' : 'Delete'}
                    onClick={() => requestDelete(item)}
                    style={pendingDelete === item.id
                      ? { background: 'rgba(196,58,58,0.12)', border: '1px solid rgba(196,58,58,0.35)', borderRadius: 8, cursor: 'pointer', padding: '3px 6px', color: '#B23A3A', fontSize: 11, fontFamily: 'inherit', fontWeight: 600 }
                      : { background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#5C5040', opacity: 0.55 }}
                  >
                    {pendingDelete === item.id ? 'Sure?' : <Trash2 size={14} />}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Log a sale form ─────────────────────────────────────────────────────── */

interface SaleFormState {
  crop: string;
  kg: string;
  price: string;
  buyer: string;
  category: ExpenseCategory | null;
  loading: boolean;
  error: string;
}

// Editing target: either an existing sale or expense being edited, or null for a fresh entry.
export type EditTarget = { type: 'sale'; row: SalesLog } | { type: 'expense'; row: ExpenseLog } | null;

const emptyForm = (): SaleFormState => ({ crop: '', kg: '', price: '', buyer: '', category: null, loading: false, error: '' });

// `alwaysOpen` skips the collapsed "New entry" button state (the desktop modal
// provides its own open/close chrome); `onDone` fires on cancel or successful
// save so that chrome can dismiss itself.
function LogSaleForm({ onSaved, editing, onCancelEdit, alwaysOpen = false, onDone }: { onSaved: () => void; editing: EditTarget; onCancelEdit: () => void; alwaysOpen?: boolean; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'in' | 'out'>('in');
  const [form, setForm] = useState<SaleFormState>(emptyForm());
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState('');
  const slipInputRef = useRef<HTMLInputElement>(null);

  const isIn = kind === 'in';
  const reset = () => { setForm(emptyForm()); setScanNote(''); };

  // Prefill the form when a row is handed in for editing (from the ledger's ✎
  // button). When the edit ends elsewhere (e.g. saved via the desktop modal
  // while this instance sits hidden in the phone branch), close and reset so
  // stale prefill can't be re-submitted as a NEW entry later.
  useEffect(() => {
    if (!editing) {
      setOpen(false);
      setForm(emptyForm());
      setScanNote('');
      return;
    }
    setOpen(true);
    setScanNote('');
    if (editing.type === 'sale') {
      setKind('in');
      setForm({ crop: editing.row.crop, kg: String(editing.row.kg ?? ''), price: String(editing.row.amount ?? ''), buyer: editing.row.buyer ?? '', category: null, loading: false, error: '' });
    } else {
      setKind('out');
      setForm({ crop: editing.row.item, kg: '', price: String(editing.row.amount ?? ''), buyer: editing.row.supplier ?? '', category: editing.row.category ?? null, loading: false, error: '' });
    }
  }, [editing]);

  // Lima reads a photographed till slip and pre-fills the cost fields.
  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (slipInputRef.current) slipInputRef.current.value = '';
    if (!file) return;
    setScanning(true);
    setScanNote('');
    setForm((f) => ({ ...f, error: '' }));
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const data = dataUrl.split(',')[1] ?? '';
      const mediaType = dataUrl.slice(5, dataUrl.indexOf(';')) || 'image/jpeg';
      const resp = await fetch('/api/read-slip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: { data, mediaType } }),
      });
      const r = await resp.json();
      if (r.ok) {
        setForm((f) => ({
          ...f,
          crop: r.item || f.crop,
          price: r.amount ? String(r.amount) : f.price,
          buyer: r.supplier || f.buyer,
          error: '',
        }));
        setScanNote(r.note || 'Read it — check the numbers before saving.');
      } else {
        setScanNote(r.error || 'Could not read the slip.');
      }
    } catch {
      setScanNote('Could not read the slip — check your connection and try again.');
    } finally {
      setScanning(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const what = form.crop.trim();
    const amount = parseFloat(form.price);
    const kg = parseFloat(form.kg);
    if (!what || isNaN(amount) || amount < 0 || (isIn && (isNaN(kg) || kg <= 0))) {
      setForm((f) => ({ ...f, error: isIn ? 'Crop, kg and price are required.' : 'Item and amount are required.' }));
      return;
    }
    setForm((f) => ({ ...f, loading: true, error: '' }));
    try {
      if (isIn) {
        if (editing?.type === 'sale') {
          await updateSale(editing.row.id, { crop: what, kg, amount, buyer: form.buyer.trim() || null });
        } else {
          await addSale({ crop: what, kg, amount, buyer: form.buyer.trim() || null, sold_at: new Date().toISOString() });
        }
      } else {
        if (editing?.type === 'expense') {
          await updateExpense(editing.row.id, { item: what, amount, supplier: form.buyer.trim() || null, category: form.category });
        } else {
          await addExpense({ item: what, amount, supplier: form.buyer.trim() || null, category: form.category, spent_at: new Date().toISOString() });
        }
      }
      reset();
      setOpen(false);
      onCancelEdit();
      onSaved();
      onDone?.();
    } catch {
      setForm((f) => ({ ...f, loading: false, error: 'Failed to save. Try again.' }));
    }
  }

  function closeForm() {
    setOpen(false);
    reset();
    onCancelEdit();
    onDone?.();
  }

  if (!open && !alwaysOpen) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-display font-semibold transition-all"
        style={{ background: '#1F4D2B', border: '1px solid rgba(31,77,43,0.22)', color: '#F7F2E9' }}
      >
        <Plus size={16} />
        New entry
      </button>
    );
  }

  const accent = isIn ? '#2E6B3A' : '#C07A1E';

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
      <div className="px-4 pt-3 pb-2">
        {editing ? (
          <p className="text-xs font-sans font-semibold uppercase tracking-wider" style={{ color: '#5C5040' }}>
            Editing {editing.type === 'sale' ? 'sale' : 'cost'}
          </p>
        ) : (
          /* Money in / out toggle */
          <div className="flex rounded-xl p-0.5 gap-0.5" style={{ background: 'rgba(226,216,196,0.5)', border: '1px solid #E2D8C4' }}>
            {([['in', 'Money in'], ['out', 'Money out']] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => { setKind(k); setForm((f) => ({ ...f, error: '' })); }}
                className="flex-1 py-1.5 rounded-lg font-sans font-semibold transition-all"
                style={kind === k
                  ? { background: k === 'in' ? '#2E6B3A' : '#C07A1E', color: '#fff', fontSize: 13 }
                  : { color: '#5C5040', fontSize: 13, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="p-4 pt-2 space-y-3">
        {/* Scan a till slip — Lima reads it and fills the cost in (Money out only) */}
        {!isIn && (
          <div>
            <button type="button" onClick={() => slipInputRef.current?.click()} disabled={scanning}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-display font-semibold transition-all"
              style={{ background: 'rgba(192,122,30,0.1)', border: '1px solid rgba(192,122,30,0.3)', color: '#C07A1E', cursor: scanning ? 'wait' : 'pointer' }}>
              {scanning ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
              {scanning ? 'Lima is reading...' : 'Scan a till slip'}
            </button>
            <input ref={slipInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScan} />
            {scanNote && (
              <p className="text-xs font-sans mt-2 flex items-start gap-1.5" style={{ color: '#5C5040' }}>
                <Sprout size={13} style={{ color: '#1F4D2B', flexShrink: 0, marginTop: 1 }} />
                <span><span style={{ fontStyle: 'italic' }}>Lima:</span> {scanNote}</span>
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-sans uppercase tracking-wider mb-1" style={{ color: '#5C5040' }}>
            {isIn ? 'Crop' : 'What for'}
          </label>
          <input type="text" placeholder={isIn ? 'e.g. Spinach' : 'e.g. Seedlings'}
            value={form.crop} onChange={(e) => setForm((f) => ({ ...f, crop: e.target.value }))}
            className="w-full rounded-lg px-3 py-2 text-sm font-display outline-none"
            style={{ background: '#E4DCC6', border: '1px solid #E2D8C4', color: '#20190F' }} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {isIn && (
            <div>
              <label className="block text-xs font-sans uppercase tracking-wider mb-1" style={{ color: '#5C5040' }}>Kg sold</label>
              <input type="number" placeholder="0.0" step="0.1" min="0"
                value={form.kg} onChange={(e) => setForm((f) => ({ ...f, kg: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm font-display outline-none"
                style={{ background: '#E4DCC6', border: '1px solid #E2D8C4', color: '#20190F' }} />
            </div>
          )}
          <div className={isIn ? '' : 'col-span-2'}>
            <label className="block text-xs font-sans uppercase tracking-wider mb-1" style={{ color: '#5C5040' }}>Amount (R)</label>
            <input type="number" placeholder="0.00" step="0.01" min="0"
              value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm font-display outline-none"
              style={{ background: '#E4DCC6', border: '1px solid #E2D8C4', color: '#20190F' }} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-sans uppercase tracking-wider mb-1" style={{ color: '#5C5040' }}>
            {isIn ? 'Buyer' : 'Supplier'}
            <span className="ml-1 normal-case" style={{ color: '#8C7A62' }}>(optional)</span>
          </label>
          <input type="text" placeholder={isIn ? 'e.g. Local market' : 'e.g. Agri Co-op'}
            value={form.buyer} onChange={(e) => setForm((f) => ({ ...f, buyer: e.target.value }))}
            className="w-full rounded-lg px-3 py-2 text-sm font-display outline-none"
            style={{ background: '#E4DCC6', border: '1px solid #E2D8C4', color: '#20190F' }} />
        </div>

        {/* Expense category — preset chips (Money out only) */}
        {!isIn && (
          <div>
            <label className="block text-xs font-sans uppercase tracking-wider mb-1" style={{ color: '#5C5040' }}>
              Category <span className="normal-case" style={{ color: '#8C7A62' }}>(optional)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EXPENSE_CATEGORIES.map((c) => (
                <button key={c} type="button"
                  onClick={() => setForm((f) => ({ ...f, category: f.category === c ? null : c }))}
                  className="px-2.5 py-1 rounded-full text-xs font-sans font-semibold capitalize transition-all"
                  style={form.category === c
                    ? { background: '#C07A1E', color: '#fff', border: '1px solid #C07A1E', cursor: 'pointer' }
                    : { background: '#E4DCC6', color: '#5C5040', border: '1px solid #E2D8C4', cursor: 'pointer' }}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {form.error && <p className="text-xs font-sans" style={{ color: '#D4922A' }}>{form.error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={closeForm}
            className="flex-1 py-2.5 rounded-xl text-sm font-display transition-all"
            style={{ background: 'transparent', border: '1px solid #E2D8C4', color: '#5C5040' }}>
            Cancel
          </button>
          <button type="submit" disabled={form.loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-display font-semibold flex items-center justify-center gap-2 transition-all"
            style={{ background: form.loading ? 'rgba(31,77,43,0.06)' : accent, border: 'none', color: form.loading ? '#5C5040' : '#fff', cursor: form.loading ? 'not-allowed' : 'pointer' }}>
            {form.loading ? (
              <>
                <span className="inline-block w-3 h-3 rounded-full border-2 animate-spin" style={{ borderColor: '#fff transparent transparent transparent' }} />
                Saving...
              </>
            ) : editing ? 'Save changes' : (isIn ? 'Log sale' : 'Log cost')}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Sign-in prompt ──────────────────────────────────────────────────────── */

function SignInPrompt() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.12)' }}
      >
        <TrendingUp size={22} style={{ color: '#1F4D2B' }} />
      </div>
      <div>
        <p className="font-display font-semibold text-base mb-1" style={{ color: '#20190F' }}>
          Sign in to track your income
        </p>
        <p className="font-display text-xs leading-relaxed" style={{ color: '#5C5040' }}>
          Log crop sales and see your earnings over time.
        </p>
      </div>
      <a
        href="/login"
        className="px-5 py-2 rounded-xl text-sm font-display font-semibold transition-all"
        style={{
          background: '#1F4D2B',
          border: '1px solid rgba(31,77,43,0.22)',
          color: '#F7F2E9',
        }}
      >
        Go to sign in
      </a>
    </div>
  );
}

/* ── Desktop financial sheet (lg+) — the laptop ledger workspace (handoff frame 15) ── */

type Period = 'month' | 'season' | 'year';

function saSeasonMonths(m: number): number[] {
  if (m >= 8 && m <= 10) return [8, 9, 10];
  if (m === 11 || m <= 1) return [11, 0, 1];
  if (m >= 2 && m <= 4) return [2, 3, 4];
  return [5, 6, 7];
}
function inPeriod(iso: string | null | undefined, period: Period, now: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  if (period === 'year') return d.getFullYear() === now.getFullYear();
  if (d.getFullYear() !== now.getFullYear()) return false;
  if (period === 'month') return d.getMonth() === now.getMonth();
  return saSeasonMonths(now.getMonth()).includes(d.getMonth());
}

interface LedgerRow { kind: 'sale' | 'expense' | 'harvest' | 'invoice'; id: string; iso: string; date: string; desc: string; qty: string; inAmt: number | null; source: string; outAmt: number | null }

// Builds the unified ledger (sales + expenses + harvest + paid invoices) for a period.
// Shared by the desktop sheet and the phone CSV export so both stay in sync.
function buildLedgerRows(sales: SalesLog[], expenses: ExpenseLog[], production: ProductionLog[], invoices: SavedInvoice[], period: Period, now: Date): LedgerRow[] {
  const saleRows: LedgerRow[] = sales
    .filter((s) => inPeriod(s.sold_at, period, now))
    .map((s) => ({ kind: 'sale' as const, id: s.id, iso: s.sold_at ?? '', date: fmtDate(s.sold_at), desc: `${s.crop} sale`, qty: `${s.kg} kg`, inAmt: s.amount ?? 0, source: s.buyer || 'Direct sale', outAmt: null }));
  const expenseRows: LedgerRow[] = expenses
    .filter((x) => inPeriod(x.spent_at, period, now))
    .map((x) => ({ kind: 'expense' as const, id: x.id, iso: x.spent_at ?? '', date: fmtDate(x.spent_at), desc: x.item, qty: categoryLabel(x.category) || '—', inAmt: null, source: x.supplier || 'Cost', outAmt: x.amount ?? 0 }));
  const harvestRows: LedgerRow[] = production
    .filter((p) => inPeriod(p.logged_at, period, now))
    .map((p) => ({ kind: 'harvest' as const, id: p.id, iso: p.logged_at ?? '', date: fmtDate(p.logged_at), desc: `${p.crop} harvested`, qty: `${p.kg} kg`, inAmt: null, source: 'Yield log', outAmt: null }));
  const invoiceRows: LedgerRow[] = invoices
    .filter((i) => i.status === 'paid' && inPeriod(i.paidAt, period, now))
    .map((i) => ({ kind: 'invoice' as const, id: i.id, iso: i.paidAt ?? i.dateISO, date: fmtDate(i.paidAt ?? i.dateISO), desc: `Invoice #${i.no} — ${i.billTo || 'No buyer'}`, qty: '—', inAmt: i.total ?? 0, source: i.paymentMethod ? `Invoice · ${paymentMethodLabel(i.paymentMethod)}` : 'Invoice', outAmt: null }));
  return [...saleRows, ...expenseRows, ...harvestRows, ...invoiceRows].sort((a, b) => (b.iso ?? '').localeCompare(a.iso ?? ''));
}

function exportLedgerCsv(rows: LedgerRow[], period: Period) {
  const head = ['Date', 'Description', 'Qty', 'In', 'Source', 'Out'];
  const body = rows.map((r) => [r.date, r.desc, r.qty, r.inAmt != null ? fmtZAR(r.inAmt) : '', r.source, r.outAmt != null ? fmtZAR(r.outAmt) : '']);
  const csv = [head, ...body].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url; a.download = `imbewufield-financial-sheet-${period}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function FinancialSheet({ sales, production, expenses, invoices, name, loading, period, setPeriod, onAddEntry, onEditSale, onEditExpense }: { sales: SalesLog[]; production: ProductionLog[]; expenses: ExpenseLog[]; invoices: SavedInvoice[]; name: string; loading: boolean; period: Period; setPeriod: (p: Period) => void; onAddEntry: () => void; onEditSale: (s: SalesLog) => void; onEditExpense: (x: ExpenseLog) => void }) {
  const now = useMemo(() => new Date(), []);

  const rows: LedgerRow[] = useMemo(
    () => buildLedgerRows(sales, expenses, production, invoices, period, now),
    [sales, expenses, production, invoices, period, now],
  );

  const income = rows.reduce((a, r) => a + (r.inAmt ?? 0), 0);
  const expenseTotal = rows.reduce((a, r) => a + (r.outAmt ?? 0), 0);
  const net = income - expenseTotal;
  const yieldKg = production.filter((p) => inPeriod(p.logged_at, period, now)).reduce((a, p) => a + (p.kg ?? 0), 0);
  const yieldLabel = yieldKg >= 1000 ? `${(yieldKg / 1000).toFixed(1)} t` : `${yieldKg.toFixed(0)} kg`;

  function exportCsv() { exportLedgerCsv(rows, period); }

  const stats = [
    { label: 'Income', value: fmtZAR(income), color: '#2E6B3A' },
    { label: 'Expenses', value: expenseTotal ? fmtZAR(expenseTotal) : '—', color: '#C07A1E' },
    { label: 'Net profit', value: fmtZAR(net), color: '#1F4D2B' },
    { label: 'Yield logged', value: yieldLabel, color: '#235E86' },
  ];

  return (
    <div className="max-w-5xl mx-auto w-full">
      {/* Title bar */}
      <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="font-sans uppercase tracking-widest" style={{ fontSize: 11, color: '#94876F', letterSpacing: '0.14em' }}>{name}</div>
          <h1 className="font-display font-semibold" style={{ fontSize: 30, color: '#20190F', letterSpacing: '-0.02em', lineHeight: 1.1 }}>Financial sheet</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg p-0.5 gap-0.5" style={{ background: 'rgba(226,216,196,0.5)', border: '1px solid #E2D8C4' }}>
            {(['month', 'season', 'year'] as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className="px-3 py-1.5 rounded-md font-sans font-semibold capitalize transition-all"
                style={period === p ? { background: '#1F4D2B', color: '#F7F2E9', fontSize: 13 } : { color: '#5C5040', fontSize: 13, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                {p}
              </button>
            ))}
          </div>
          <button onClick={exportCsv} disabled={rows.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-sans font-semibold transition-all"
            style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', color: rows.length ? '#20190F' : '#94876F', fontSize: 14, cursor: rows.length ? 'pointer' : 'not-allowed' }}>
            <Download size={15} />Export
          </button>
          <Link href="/invoice" className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-sans font-semibold" style={{ background: 'rgba(192,122,30,0.12)', border: '1px solid rgba(192,122,30,0.3)', color: '#C07A1E', fontSize: 14, textDecoration: 'none' }}>
            <FileText size={15} />New invoice
          </Link>
          <button onClick={onAddEntry}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-sans font-semibold transition-all"
            style={{ background: '#1F4D2B', border: '1px solid rgba(31,77,43,0.22)', color: '#F7F2E9', fontSize: 14, cursor: 'pointer' }}>
            <Plus size={15} />Add entry
          </button>
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl px-5 py-4" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
            <div className="font-sans uppercase tracking-widest" style={{ fontSize: 11, color: '#94876F', letterSpacing: '0.1em' }}>{s.label}</div>
            <div className="font-display font-bold mt-1" style={{ fontSize: 28, color: s.color, letterSpacing: '-0.02em' }}>{loading ? '…' : s.value}</div>
          </div>
        ))}
      </div>

      {/* Ledger table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E2D8C4' }}>
              {['Date', 'Description', 'Qty', 'In', 'Source', 'Out'].map((h, i) => (
                <th key={h} className="font-sans uppercase tracking-wider px-5 py-3"
                  style={{ fontSize: 11, color: '#94876F', textAlign: i >= 3 && (h === 'In' || h === 'Out') ? 'right' : 'left', letterSpacing: '0.08em', fontWeight: 700 }}>{h}</th>
              ))}
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center font-sans" style={{ fontSize: 14, color: '#8C7A62' }}>
                No entries for this {period}. Use the Add-entry button, the Invoice tool, or your phone — everything shows here.
              </td></tr>
            ) : rows.map((r, i) => (
              <tr key={`${r.kind}-${r.id}`} style={{ borderBottom: i < rows.length - 1 ? '1px solid #E2D8C4' : 'none' }}>
                <td className="px-5 py-3 font-sans" style={{ fontSize: 14, color: '#5C5040', whiteSpace: 'nowrap' }}>{r.date}</td>
                <td className="px-5 py-3 font-display font-medium" style={{ fontSize: 14, color: '#20190F' }}>{r.desc}</td>
                <td className="px-5 py-3 font-sans" style={{ fontSize: 14, color: '#5C5040', whiteSpace: 'nowrap' }}>{r.qty}</td>
                <td className="px-5 py-3 font-display font-semibold tabular-nums" style={{ fontSize: 14, color: '#2E6B3A', textAlign: 'right', whiteSpace: 'nowrap' }}>{r.inAmt != null ? fmtZAR(r.inAmt) : '—'}</td>
                <td className="px-5 py-3 font-sans" style={{ fontSize: 14, color: '#8C7A62' }}>{r.source}</td>
                <td className="px-5 py-3 font-display font-semibold tabular-nums" style={{ fontSize: 14, color: '#C07A1E', textAlign: 'right', whiteSpace: 'nowrap' }}>{r.outAmt != null ? fmtZAR(r.outAmt) : '—'}</td>
                <td className="pr-4 py-3">
                  {(r.kind === 'sale' || r.kind === 'expense') && (
                    <button type="button" aria-label="Edit"
                      onClick={() => {
                        if (r.kind === 'sale') {
                          const src = sales.find((s) => s.id === r.id);
                          if (src) onEditSale(src);
                        } else {
                          const src = expenses.find((x) => x.id === r.id);
                          if (src) onEditExpense(src);
                        }
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#5C5040', opacity: 0.55 }}>
                      <Pencil size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="font-sans mt-3" style={{ fontSize: 12, color: '#94876F' }}>
        Synced with your phone · {rows.length} {rows.length === 1 ? 'entry' : 'entries'} this {period}. Add or edit sales and costs here, or with the New-entry button on your phone.
      </p>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */

// Generates ~6 sample sales, ~5 sample expenses and 2 sample invoices (one paid, one
// unpaid) through the normal add paths, spread over recent weeks. Item names are
// prefixed "Sample —" so they're obviously demo data and easy to spot for deletion.
async function loadSampleData(): Promise<void> {
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

  const sampleSales: Partial<SalesLog>[] = [
    { crop: 'Sample — spinach', kg: 4, amount: 120, buyer: 'Local market', sold_at: daysAgo(3) },
    { crop: 'Sample — eggs', kg: 2, amount: 90, buyer: 'Spar Nquthu', sold_at: daysAgo(7) },
    { crop: 'Sample — tomatoes', kg: 6, amount: 180, buyer: 'Local market', sold_at: daysAgo(10) },
    { crop: 'Sample — spinach', kg: 5, amount: 150, buyer: 'Agri Co-op', sold_at: daysAgo(15) },
    { crop: 'Sample — eggs', kg: 3, amount: 135, buyer: 'Local market', sold_at: daysAgo(20) },
    { crop: 'Sample — tomatoes', kg: 8, amount: 240, buyer: 'Spar Nquthu', sold_at: daysAgo(25) },
  ];
  const sampleExpenses: Partial<ExpenseLog>[] = [
    { item: 'Sample — chicken feed', amount: 220, supplier: 'Agri Co-op', category: 'feed', spent_at: daysAgo(4) },
    { item: 'Sample — spinach seed', amount: 85, supplier: 'Agri Co-op', category: 'seed', spent_at: daysAgo(9) },
    { item: 'Sample — diesel', amount: 350, supplier: 'Total garage', category: 'fuel', spent_at: daysAgo(12) },
    { item: 'Sample — hoe handle', amount: 60, supplier: null, category: 'equipment', spent_at: daysAgo(18) },
    { item: 'Sample — transport to market', amount: 100, supplier: null, category: 'transport', spent_at: daysAgo(22) },
  ];

  await Promise.all([
    ...sampleSales.map((s) => addSale(s)),
    ...sampleExpenses.map((x) => addExpense(x)),
  ]);

  // Invoices go through the normal invoice add paths (customer/product presets + saveInvoice).
  const paidItems = [{ desc: 'Sample — spinach', qty: 4, unit: 'kg', price: 30 }];
  addCustomer('Sample — Spar Nquthu');
  paidItems.forEach((it) => addProduct(it));
  saveInvoice({
    id: invoiceId(), no: 9001, billTo: 'Sample — Spar Nquthu',
    items: paidItems, total: paidItems.reduce((a, it) => a + it.qty * it.price, 0),
    dateISO: daysAgo(14), status: 'paid', paidAt: daysAgo(11),
  });

  const unpaidItems = [{ desc: 'Sample — eggs', qty: 3, unit: 'trays', price: 45 }];
  addCustomer('Sample — Local market');
  unpaidItems.forEach((it) => addProduct(it));
  saveInvoice({
    id: invoiceId(), no: 9002, billTo: 'Sample — Local market',
    items: unpaidItems, total: unpaidItems.reduce((a, it) => a + it.qty * it.price, 0),
    dateISO: daysAgo(2), status: 'unpaid',
  });
}

export default function FinancesPage() {
  const [user, setUser] = useState<User | null | 'loading'>('loading');
  const [sales, setSales] = useState<SalesLog[]>([]);
  const [production, setProduction] = useState<ProductionLog[]>([]);
  const [expenses, setExpenses] = useState<ExpenseLog[]>([]);
  const [invoices, setInvoices] = useState<SavedInvoice[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [editing, setEditing] = useState<EditTarget>(null);
  const [desktopEntryOpen, setDesktopEntryOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [period, setPeriod] = useState<Period>('month');
  const now = useMemo(() => new Date(), []);

  // Auth: same pattern as MyRecords
  useEffect(() => {
    const fb = getFirebase();
    if (!fb) {
      setUser(null);
      return;
    }
    const unsub = onAuthStateChanged(fb.auth, (u) => {
      setUser(u);
    });
    return unsub;
  }, []);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      // allSettled, NOT all: one failing read (e.g. a missing Firestore composite index
      // on production_logs) must not blank the ENTIRE ledger — sales/expenses that read
      // fine should still show. Failures degrade to an empty list for that stream only.
      const [prodResult, salesResult, expenseResult] = await Promise.allSettled([
        myProduction(),
        mySales(),
        myExpenses(),
      ]);
      if (prodResult.status === 'rejected') console.error('[finances] production read failed:', prodResult.reason);
      if (salesResult.status === 'rejected') console.error('[finances] sales read failed:', salesResult.reason);
      if (expenseResult.status === 'rejected') console.error('[finances] expenses read failed:', expenseResult.reason);
      setProduction(prodResult.status === 'fulfilled' ? prodResult.value : []);
      setSales(salesResult.status === 'fulfilled' ? salesResult.value : []);
      setExpenses(expenseResult.status === 'fulfilled' ? expenseResult.value : []);
      setInvoices(loadInvoices());
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && user !== 'loading') {
      void loadData();
    } else if (user === null) {
      setSales([]);
      setProduction([]);
      setExpenses([]);
      setInvoices(loadInvoices());
    }
  }, [user, loadData]);

  // Keep the invoice list in sync with edits made on the /invoice page (status toggles,
  // new invoices) without requiring a full page reload.
  useEffect(() => {
    const refresh = () => setInvoices(loadInvoices());
    refresh();
    window.addEventListener('imbewu-invoices-changed', refresh);
    return () => window.removeEventListener('imbewu-invoices-changed', refresh);
  }, []);

  async function handleDeleteSale(id: string) {
    setSales((prev) => prev.filter((s) => s.id !== id));
    try { await deleteSale(id); } finally { void loadData(); }
  }
  async function handleDeleteExpense(id: string) {
    setExpenses((prev) => prev.filter((x) => x.id !== id));
    try { await deleteExpense(id); } finally { void loadData(); }
  }

  const hasAnyData = sales.length > 0 || expenses.length > 0 || production.length > 0 || invoices.length > 0;

  async function handleLoadSampleData() {
    setSeeding(true);
    try {
      await loadSampleData();
      await loadData();
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: '100dvh', background: '#E4DCC6' }}
    >
      {/* Header */}
      <header
        className="flex-shrink-0 flex items-center px-4 gap-3"
        style={{ height: 52, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}
      >
        <BrandLogo />
        <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
        <span className="text-xs font-display" style={{ color: '#5C5040' }}>Finances</span>
        <div className="flex-1" />
        <LessonLink id="finances:overview" label="Learn" />
        <Link href="/invoice"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold"
          style={{ background: 'rgba(192,122,30,0.12)', border: '1px solid rgba(192,122,30,0.3)', color: '#C07A1E', textDecoration: 'none' }}>
          <FileText size={13} />Invoice
        </Link>
        <SettingsButton />
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 lg:px-8 py-5 lg:py-8 space-y-4">
        {user === 'loading' ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton
                  key={i}
                  className="h-20 rounded-2xl"
                  style={{ animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>
            <Skeleton className="h-48 rounded-2xl" />
          </>
        ) : !user ? (
          <SignInPrompt />
        ) : (
          <>
            {/* Wide / laptop: the financial-sheet ledger workspace (frame 15) */}
            <div className="hidden lg:block space-y-6">
              <FinancialSheet
                sales={sales}
                production={production}
                expenses={expenses}
                invoices={invoices}
                name={user.displayName ?? 'My farm'}
                loading={dataLoading}
                period={period}
                setPeriod={setPeriod}
                onAddEntry={() => { setEditing(null); setDesktopEntryOpen(true); }}
                onEditSale={(row) => { setEditing({ type: 'sale', row }); setDesktopEntryOpen(true); }}
                onEditExpense={(row) => { setEditing({ type: 'expense', row }); setDesktopEntryOpen(true); }}
              />
              <HarvestReconciliation production={production} sales={sales} period={period} now={now} loading={dataLoading} />
              {/* Same LogSaleForm as the phone branch, hosted in a modal. Mounted
                  only while open so every dismissal starts the next entry fresh. */}
              {desktopEntryOpen && (
                <div
                  className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-10"
                  style={{ background: 'rgba(32,25,15,0.45)' }}
                  onClick={() => { setEditing(null); setDesktopEntryOpen(false); }}
                >
                  <div className="w-full max-w-md" style={{ boxShadow: '0 16px 48px rgba(32,25,15,0.25)', borderRadius: 16 }} onClick={(e) => e.stopPropagation()}>
                    <LogSaleForm
                      alwaysOpen
                      onSaved={loadData}
                      editing={editing}
                      onCancelEdit={() => setEditing(null)}
                      onDone={() => setDesktopEntryOpen(false)}
                    />
                  </div>
                </div>
              )}
            </div>
            {/* Phone / tablet: the simple money view */}
            <div className="lg:hidden space-y-4">
              <SummaryCards
                sales={sales}
                production={production}
                expenses={expenses}
                invoices={invoices}
                loading={dataLoading}
              />
              <HarvestReconciliation production={production} sales={sales} period="month" now={now} loading={dataLoading} />
              {!dataLoading && !hasAnyData && (
                <button
                  type="button"
                  onClick={handleLoadSampleData}
                  disabled={seeding}
                  className="w-full flex flex-col items-center justify-center gap-2 py-6 rounded-2xl text-sm font-display font-semibold transition-all"
                  style={{ background: 'transparent', border: '1px dashed rgba(31,77,43,0.35)', color: '#1F4D2B', cursor: seeding ? 'wait' : 'pointer' }}
                >
                  {seeding ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  {seeding ? 'Loading sample data...' : 'Load sample data — see how Finance works'}
                </button>
              )}
              <button
                type="button"
                onClick={() => exportLedgerCsv(buildLedgerRows(sales, expenses, production, invoices, 'month', new Date()), 'month')}
                disabled={!hasAnyData}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-display font-semibold transition-all"
                style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', color: hasAnyData ? '#20190F' : '#94876F', cursor: hasAnyData ? 'pointer' : 'not-allowed' }}
              >
                <Download size={15} />Export CSV
              </button>
              <SalesLedger
                sales={sales}
                expenses={expenses}
                invoices={invoices}
                loading={dataLoading}
                onEditSale={(row) => setEditing({ type: 'sale', row })}
                onEditExpense={(row) => setEditing({ type: 'expense', row })}
                onDeleteSale={handleDeleteSale}
                onDeleteExpense={handleDeleteExpense}
              />
              <LogSaleForm onSaved={loadData} editing={editing} onCancelEdit={() => setEditing(null)} />
            </div>
          </>
        )}
      </main>

      <TabBar />
    </div>
  );
}

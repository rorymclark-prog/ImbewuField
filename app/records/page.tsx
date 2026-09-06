'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { suspectedDuplicateIncomeIds, DUPLICATE_ROW_NOTE, DUPLICATE_LEDGER_FOOTER } from '@/lib/duplicate-income';
import Link from 'next/link';
import { TrendingUp, Scale, Receipt, Plus, Sprout, FileText, Download, Camera, Loader2, Pencil, Trash2, Sparkles, BarChart3 } from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebase } from '@/lib/firebase/init';
import {
  addSale, addExpense, myProduction, mySales, myExpenses,
  updateSale, updateExpense, deleteSale, deleteExpense,
  WriteTimeoutError,
} from '@/lib/db/queries';
import type { SalesLog, ProductionLog, ExpenseLog, ExpenseCategory } from '@/lib/db/types';
import { loadInvoices, paymentMethodLabel, type SavedInvoice } from '@/lib/invoices';
import {
  isSampleMode, enterSampleMode,
  getSandboxSales, addSandboxSale, updateSandboxSale, deleteSandboxSale,
  getSandboxExpenses, addSandboxExpense, updateSandboxExpense, deleteSandboxExpense,
  getSandboxProduction,
} from '@/lib/sample-mode';
import HarvestReconciliation from '@/components/HarvestReconciliation';
import BrandLogo from '@/components/BrandLogo';
import BackButton from '@/components/BackButton';
import SettingsButton from '@/components/SettingsButton';
import TabBar from '@/components/TabBar';
import LessonLink from '@/components/design/LessonLink';
import EmptyState from '@/components/EmptyState';
import MyRecords from '@/components/MyRecords';
import { cashLedgerSales, cashIncomeTotal } from '@/lib/invoice-sales';
import { loadCashflowSettings, DEFAULT_CASHFLOW_SETTINGS, type CashflowSettings, type PlanBed, type Planting } from '@/lib/crop-plan';
import { useFinancePlanSource } from '@/lib/finance-plan-source';
import ComingUpHarvests from '@/components/ComingUpHarvests';
import CashflowChart from '@/components/CashflowChart';
import FinanceGraphs from '@/components/FinanceGraphs';
import AreaReturnCards from '@/components/AreaReturnCards';
import type { GrowingEnterprise } from '@/lib/area-returns';
import MenuButton from '@/components/MenuButton';
import type { CropPrice } from '@/lib/crop-prices';
import { loadCropPriceOverrides } from '@/lib/crop-prices';
import { buildFarmMetrics, isInFinancePeriod, type FinancePeriod } from '@/lib/farm-metrics';
import { countsWithScope, loadIncludePerennials, DEFAULT_INCLUDE_PERENNIALS } from '@/lib/produce-scope';
import { produceDisplayName } from '@/lib/perennial-produce';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { useLanguage } from '@/lib/i18n';

/* ── One book, three tabs, and the charts as a view inside it ────────────────
 *
 * The Gogo Test audit (27 August, 375 x 812, an isiZulu-speaking KZN smallholder) found her money
 * behind separate doors: kilograms at "My Records", rands at "Finance", and nowhere that could
 * answer "how much did I make this season?". Its recommendation, verbatim: "one book with three
 * tabs: Picked · Sold · Spent. That's her mental model already and it needs no translation."
 *
 * So this route is that book. /finances is now a redirect onto it (app/finances/page.tsx).
 *
 * WHY THE ROUTE THAT SURVIVED IS THIS ONE. Both doors were translated in all ten locales, but
 * only /records already carried the harvest form — the one thing the audit's "do not touch" list
 * singles out ("Crop, kilograms, optional photo, save… This is already the right shape; the
 * problem is finding it, not filling it"). Keeping /records means that form never moves; only its
 * front door did.
 */
const BOOK_TABS = ['picked', 'sold', 'spent', 'charts'] as const;
type BookTab = (typeof BOOK_TABS)[number];

function isBookTab(value: string | null): value is BookTab {
  return value !== null && (BOOK_TABS as readonly string[]).includes(value);
}

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

/**
 * The orchard switch, read once on mount.
 *
 * Both kilogram tiles on this screen used to ignore it while the finance graphs and
 * the Records screen honoured it, so with the switch off the same farm showed two
 * different "kg" figures on one page and nothing on screen said why. The switch is
 * a kilogram filter only — it has never touched money, and it must not start here.
 */
function useIncludePerennials(): boolean {
  const [include, setInclude] = useState(DEFAULT_INCLUDE_PERENNIALS);
  useEffect(() => { setInclude(loadIncludePerennials()); }, []);
  return include;
}

/** Kilograms in scope, plus what was left out — never one without the other. */
function scopeKg(rows: { crop: string; kg?: number | null }[], includePerennials: boolean) {
  let counted = 0;
  let excluded = 0;
  const excludedNames = new Set<string>();
  for (const row of rows) {
    const kg = row.kg ?? 0;
    if (countsWithScope(row.crop, includePerennials)) counted += kg;
    // The catalogue's own name: a picker-written harvest and a hand-typed sale are one fruit,
    // and naming it twice makes a farmer count trees they do not have.
    else { excluded += kg; excludedNames.add(produceDisplayName(row.crop)); }
  }
  return { counted, excluded, excludedNames: [...excludedNames].sort((a, b) => a.localeCompare(b, 'en-ZA')) };
}

function SummaryCards({ sales, production, expenses, invoices, loading }: SummaryProps) {
  const includePerennials = useIncludePerennials();
  const thisMonthSales = sales.filter((s) => isThisMonth(s.sold_at));
  const thisMonthPaidInvoices = invoices.filter((i) => i.status === 'paid' && isThisMonth(i.paidAt));
  const totalRevenue = cashIncomeTotal(thisMonthSales, thisMonthPaidInvoices);
  const totalSpent = expenses
    .filter((x) => isThisMonth(x.spent_at))
    .reduce((acc, x) => acc + (x.amount ?? 0), 0);
  const monthKg = scopeKg(production.filter((p) => isThisMonth(p.logged_at)), includePerennials);
  const totalKg = monthKg.counted;

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
      color: 'var(--color-water)',
      bg: 'rgba(35,94,134,0.08)',
      border: 'rgba(35,94,134,0.18)',
    },
  ];

  return (
    <>
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
                style={{ color: 'var(--color-ink)' }}
              >
                {card.value}
              </p>
              <p className="font-mono text-xs leading-tight" style={{ color: 'var(--color-muted-strong)' }}>
                {card.label}
              </p>
            </>
          )}
        </div>
      ))}
      </div>
      {!loading && monthKg.excluded > 0 && (
        /* Named and quantified, never just subtracted. The same condition that makes a
           capped chart axis honest rather than wrong applies to a filtered total: a
           number with its missing part nowhere on screen is not a filtered figure. */
        <p className="font-sans text-xs mt-2" style={{ color: 'var(--color-muted-strong)' }}>
          Orchard is switched off, so {monthKg.excluded.toFixed(1)} kg is not in the harvest
          figure: {monthKg.excludedNames.join(', ')}. The rand figures still count every sale.
        </p>
      )}
    </>
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
  const saleRows: PhoneRow[] = cashLedgerSales(sales, invoices.map((invoice) => invoice.id)).map((s) => ({
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
  /**
   * Which half of the book this list is standing in.
   *
   * A FILTER, NOT A SECOND LEDGER. Sold and Spent are two tabs over the same rows, built by the
   * same toPhoneRows() from the same three sources — so a paid invoice can still only appear
   * once, and the duplicate-income check upstream still sees the whole picture. Omitting it keeps
   * the old combined "Recent activity" list, which is what the desktop export still reads.
   */
  only?: 'in' | 'out';
  heading: string;
  emptyMessage: string;
}

function SalesLedger({ sales, expenses, invoices, loading, onEditSale, onEditExpense, onDeleteSale, onDeleteExpense, only, heading, emptyMessage }: SalesLedgerProps) {
  const allRows = toPhoneRows(sales, expenses, invoices);
  const rows = only ? allRows.filter((r) => r.positive === (only === 'in')) : allRows;

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
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <Receipt size={14} style={{ color: 'var(--color-muted-strong)' }} />
        <span className="text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--color-muted-strong)' }}>
          {heading}
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
        <EmptyState message={emptyMessage} />
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {rows.map((item) => (
            <div key={`${item.kind}-${item.id}`} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-display font-medium leading-snug truncate"
                  style={{ color: 'var(--color-ink)' }}
                >
                  {item.title}
                </p>
                {item.subtitle && (
                  <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--color-muted)' }}>
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
                <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--color-muted)' }}>
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
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-muted-strong)', opacity: 0.55 }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={pendingDelete === item.id ? 'Confirm delete' : 'Delete'}
                    onClick={() => requestDelete(item)}
                    style={pendingDelete === item.id
                      ? { background: 'rgba(196,58,58,0.12)', border: '1px solid rgba(196,58,58,0.35)', borderRadius: 8, cursor: 'pointer', padding: '3px 6px', color: '#B23A3A', fontSize: 12, fontFamily: 'inherit', fontWeight: 600 }
                      : { background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-muted-strong)', opacity: 0.55 }}
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
  enterprise: GrowingEnterprise | null;
  crop: string;
  expenseCrop: string;
  kg: string;
  price: string;
  buyer: string;
  category: ExpenseCategory | null;
  loading: boolean;
  error: string;
}

// Editing target: either an existing sale or expense being edited, or null for a fresh entry.
export type EditTarget = { type: 'sale'; row: SalesLog } | { type: 'expense'; row: ExpenseLog } | null;

const emptyForm = (): SaleFormState => ({ enterprise: null, crop: '', expenseCrop: '', kg: '', price: '', buyer: '', category: null, loading: false, error: '' });

// `alwaysOpen` skips the collapsed "New entry" button state (the desktop modal
// provides its own open/close chrome); `onDone` fires on cancel or successful
// save so that chrome can dismiss itself. `online` is the SAME navigator.onLine
// signal the ledger's offline banner uses (lifted from the page below) — reused
// here, not duplicated, to word the timeout message honestly (see handleSubmit).
//
// `lockKind` is what the Sold and Spent tabs use. The money-in/money-out toggle was the right
// control on a single combined Finance screen and is the wrong one inside a tab that already
// says which half of the book you are in: a farmer standing on "Spent" who taps New entry and
// gets a form defaulting to "Money in" has been asked the same question twice, and the second
// answer overrides the first silently. Locking it does not remove a write path — both branches of
// handleSubmit are still reachable, one from each tab. `addLabel` names the button for the same
// reason: "New entry" on a tab called Spent tells her nothing she did not already say.
function LogSaleForm({ onSaved, editing, onCancelEdit, alwaysOpen = false, onDone, online, lockKind, addLabel = 'New entry' }: { onSaved: () => void; editing: EditTarget; onCancelEdit: () => void; alwaysOpen?: boolean; onDone?: () => void; online: boolean; lockKind?: 'in' | 'out'; addLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'in' | 'out'>(lockKind ?? 'in');
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
      // Back to the tab's own half of the book. Without this, editing a sale and then cancelling
      // would leave a Spent-tab form quietly set to "Money in".
      if (lockKind) setKind(lockKind);
      return;
    }
    setOpen(true);
    setScanNote('');
    if (editing.type === 'sale') {
      setKind('in');
      setForm({ enterprise: editing.row.enterprise ?? null, crop: editing.row.crop, expenseCrop: '', kg: String(editing.row.kg ?? ''), price: String(editing.row.amount ?? ''), buyer: editing.row.buyer ?? '', category: null, loading: false, error: '' });
    } else {
      setKind('out');
      setForm({ enterprise: editing.row.enterprise ?? null, crop: editing.row.item, expenseCrop: editing.row.crop ?? '', kg: '', price: String(editing.row.amount ?? ''), buyer: editing.row.supplier ?? '', category: editing.row.category ?? null, loading: false, error: '' });
    }
  }, [editing, lockKind]);

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
        headers: { 'Content-Type': 'application/json', ...await paidApiHeaders() },
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
      const sampling = isSampleMode();
      if (isIn) {
        if (editing?.type === 'sale') {
          const patch = { enterprise: form.enterprise, crop: what, kg, amount, buyer: form.buyer.trim() || null };
          if (sampling) updateSandboxSale(editing.row.id, patch); else await updateSale(editing.row.id, patch);
        } else {
          const row = { enterprise: form.enterprise, crop: what, kg, amount, buyer: form.buyer.trim() || null, sold_at: new Date().toISOString() };
          if (sampling) addSandboxSale(row); else await addSale(row);
        }
      } else {
        if (editing?.type === 'expense') {
          const patch = { enterprise: form.enterprise, item: what, amount, supplier: form.buyer.trim() || null, category: form.category, crop: form.expenseCrop.trim() || null };
          if (sampling) updateSandboxExpense(editing.row.id, patch); else await updateExpense(editing.row.id, patch);
        } else {
          const row = { enterprise: form.enterprise, item: what, amount, supplier: form.buyer.trim() || null, category: form.category, crop: form.expenseCrop.trim() || null, spent_at: new Date().toISOString() };
          if (sampling) addSandboxExpense(row); else await addExpense(row);
        }
      }
      reset();
      setOpen(false);
      onCancelEdit();
      onSaved();
      onDone?.();
    } catch (err) {
      if (err instanceof WriteTimeoutError) {
        // lib/db/queries.ts gave up waiting for the server to confirm — but persistentLocalCache
        // (lib/firebase/init.ts) means the entry is already durably saved on this device and
        // Firestore is still trying to send it in the background; it is NOT lost and does NOT need
        // retyping. Clear the fields (not just the spinner) so a farmer re-reading this message and
        // tapping Save again can't accidentally log the same sale or cost twice — the ledger has
        // never forgiven that (see lib/duplicate-income.ts). Leave the form open so she can read it.
        setForm(() => ({
          ...emptyForm(),
          error: online
            ? 'Your connection dropped mid-save. Nothing is lost — this is saved on your phone and will finish sending on its own.'
            : "You're offline. This is saved on your phone and will reach the cloud the moment you have signal again.",
        }));
        setScanNote('');
        onSaved();
        return;
      }
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
        style={{ background: 'var(--color-forest-800)', border: '1px solid rgba(31,77,43,0.22)', color: 'var(--color-canvas)' }}
      >
        <Plus size={16} />
        {addLabel}
      </button>
    );
  }

  const accent = isIn ? '#2E6B3A' : '#C07A1E';

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="px-4 pt-3 pb-2">
        {editing ? (
          <p className="text-xs font-sans font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted-strong)' }}>
            Editing {editing.type === 'sale' ? 'sale' : 'cost'}
          </p>
        ) : lockKind ? (
          /* The tab already answered "in or out". Saying it once, as a heading, beats asking
             again with a toggle whose wrong half is one mis-tap away. */
          <p className="text-xs font-sans font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted-strong)' }}>
            {lockKind === 'in' ? 'Money you were paid' : 'Money you paid out'}
          </p>
        ) : (
          /* Money in / out toggle */
          <div className="flex rounded-xl p-0.5 gap-0.5" style={{ background: 'rgba(226,216,196,0.5)', border: '1px solid var(--color-border)' }}>
            {([['in', 'Money in'], ['out', 'Money out']] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => { setKind(k); setForm((f) => ({ ...f, error: '' })); }}
                className="flex-1 py-1.5 rounded-lg font-sans font-semibold transition-all"
                style={kind === k
                  ? { background: k === 'in' ? '#2E6B3A' : '#C07A1E', color: '#fff', fontSize: 13 }
                  : { color: 'var(--color-muted-strong)', fontSize: 13, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="p-4 pt-2 space-y-3">
        <label className="block text-sm">Growing area for this entry (optional)
          <select className="w-full rounded-lg border px-3 py-2 mt-1" value={form.enterprise ?? ''} onChange={e => setForm(f => ({ ...f, enterprise: e.target.value ? e.target.value as GrowingEnterprise : null }))}>
            <option value="">Unassigned</option><option value="vegetables">Vegetable beds</option><option value="staples">Staple plots</option>{!isIn && <option value="shared">Shared by beds and staple plots</option>}<option value="other">Orchard / other</option>
          </select>
          <span className="block text-xs mt-1">Choose only when this sale or cost belongs to that growing area.</span>
        </label>
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
              <p className="text-xs font-sans mt-2 flex items-start gap-1.5" style={{ color: 'var(--color-muted-strong)' }}>
                <Sprout size={13} style={{ color: 'var(--color-forest-800)', flexShrink: 0, marginTop: 1 }} />
                <span><span style={{ fontStyle: 'italic' }}>Lima:</span> {scanNote}</span>
              </p>
            )}
          </div>
        )}

        {!isIn && (
          <div>
            <label className="block text-xs font-sans uppercase tracking-wider mb-1" style={{ color: 'var(--color-muted-strong)' }}>
              Crop this cost was for <span className="normal-case" style={{ color: 'var(--color-muted)' }}>(optional)</span>
            </label>
            <input type="text" placeholder="Leave blank if it served the whole garden"
              value={form.expenseCrop} onChange={(e) => setForm((f) => ({ ...f, expenseCrop: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm font-display outline-none"
              style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }} />
            <p className="text-xs font-sans mt-1" style={{ color: 'var(--color-muted)' }}>Only tag a crop when this cost was just for that crop.</p>
          </div>
        )}

        <div>
          <label className="block text-xs font-sans uppercase tracking-wider mb-1" style={{ color: 'var(--color-muted-strong)' }}>
            {isIn ? 'Crop' : 'What for'}
          </label>
          <input type="text" placeholder={isIn ? 'e.g. Spinach' : 'e.g. Seedlings'}
            value={form.crop} onChange={(e) => setForm((f) => ({ ...f, crop: e.target.value }))}
            className="w-full rounded-lg px-3 py-2 text-sm font-display outline-none"
            style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {isIn && (
            <div>
              <label className="block text-xs font-sans uppercase tracking-wider mb-1" style={{ color: 'var(--color-muted-strong)' }}>Kg sold</label>
              <input type="number" placeholder="0.0" step="0.1" min="0"
                value={form.kg} onChange={(e) => setForm((f) => ({ ...f, kg: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm font-display outline-none"
                style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }} />
            </div>
          )}
          <div className={isIn ? '' : 'col-span-2'}>
            <label className="block text-xs font-sans uppercase tracking-wider mb-1" style={{ color: 'var(--color-muted-strong)' }}>Amount (R)</label>
            <input type="number" placeholder="0.00" step="0.01" min="0"
              value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm font-display outline-none"
              style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-sans uppercase tracking-wider mb-1" style={{ color: 'var(--color-muted-strong)' }}>
            {isIn ? 'Buyer' : 'Supplier'}
            <span className="ml-1 normal-case" style={{ color: 'var(--color-muted)' }}>(optional)</span>
          </label>
          <input type="text" placeholder={isIn ? 'e.g. Local market' : 'e.g. Agri Co-op'}
            value={form.buyer} onChange={(e) => setForm((f) => ({ ...f, buyer: e.target.value }))}
            className="w-full rounded-lg px-3 py-2 text-sm font-display outline-none"
            style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-border)', color: 'var(--color-ink)' }} />
        </div>

        {/* Expense category — preset chips (Money out only) */}
        {!isIn && (
          <div>
            <label className="block text-xs font-sans uppercase tracking-wider mb-1" style={{ color: 'var(--color-muted-strong)' }}>
              Category <span className="normal-case" style={{ color: 'var(--color-muted)' }}>(optional)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EXPENSE_CATEGORIES.map((c) => (
                <button key={c} type="button"
                  onClick={() => setForm((f) => ({ ...f, category: f.category === c ? null : c }))}
                  className="px-2.5 py-1 rounded-full text-xs font-sans font-semibold capitalize transition-all"
                  style={form.category === c
                    ? { background: '#C07A1E', color: '#fff', border: '1px solid #C07A1E', cursor: 'pointer' }
                    : { background: 'var(--color-canvas)', color: 'var(--color-muted-strong)', border: '1px solid var(--color-border)', cursor: 'pointer' }}>
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
            style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-muted-strong)' }}>
            Cancel
          </button>
          <button type="submit" disabled={form.loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-display font-semibold flex items-center justify-center gap-2 transition-all"
            style={{ background: form.loading ? 'rgba(31,77,43,0.06)' : accent, border: 'none', color: form.loading ? 'var(--color-muted-strong)' : '#fff', cursor: form.loading ? 'not-allowed' : 'pointer' }}>
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
  // Drops into the same sandbox every other sample-mode entry point uses (home, onboarding) —
  // enterSampleMode() resets the in-memory sandbox and the localStorage shim itself; setting the
  // sessionStorage flag alone is not enough (learned that the hard way earlier tonight). A hard
  // reload, not client-side state, matches SampleModeBanner's own exit handler and guarantees every
  // hook on this page re-reads through isSampleMode() from a clean mount.
  function handlePreview() {
    if (enterSampleMode()) window.location.reload();
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.12)' }}
      >
        <TrendingUp size={22} style={{ color: 'var(--color-forest-800)' }} />
      </div>
      <div>
        <p className="font-display font-semibold text-base mb-1" style={{ color: 'var(--color-ink)' }}>
          Sign in to track your income
        </p>
        <p className="font-display text-xs leading-relaxed" style={{ color: 'var(--color-muted-strong)' }}>
          Log crop sales and see your earnings over time.
        </p>
      </div>
      <a
        href="/login"
        className="px-5 py-2 rounded-xl text-sm font-display font-semibold transition-all"
        style={{
          background: 'var(--color-forest-800)',
          border: '1px solid rgba(31,77,43,0.22)',
          color: 'var(--color-canvas)',
        }}
      >
        Go to sign in
      </a>
      <button
        type="button"
        onClick={handlePreview}
        className="text-xs font-display font-medium underline underline-offset-2"
        style={{ color: 'var(--color-muted-strong)' }}
      >
        Preview with sample data
      </button>
    </div>
  );
}

/* ── Desktop financial sheet (lg+) — the laptop ledger workspace (handoff frame 15) ── */

// 'season' follows the SA growing calendar (Sep-Nov spring, Dec-Feb summer, Mar-May
// autumn, Jun-Aug winter), not the calendar year — so Dec/Jan/Feb is ONE season that
// crosses a year boundary. This page used to filter with its own copy of that rule,
// a naive "same calendar year, then same season-month-set" check that silently
// dropped every December row (sales, costs, harvests, paid invoices) the moment the
// clock ticked into January — exactly the weeks after peak December selling. The
// crossing case is genuinely easy to get wrong twice, so this page now takes the one
// already-correct implementation from lib/farm-metrics.ts (used by FarmMetrics below)
// instead of keeping its own second copy of the same rule.
type Period = FinancePeriod;

interface LedgerRow { kind: 'sale' | 'expense' | 'harvest' | 'invoice'; id: string; iso: string; date: string; desc: string; qty: string; inAmt: number | null; source: string; outAmt: number | null; duplicateSuspect?: boolean }

// Builds the unified ledger (sales + expenses + harvest + paid invoices) for a period.
// Shared by the desktop sheet and the phone CSV export so both stay in sync.
function buildLedgerRows(sales: SalesLog[], expenses: ExpenseLog[], production: ProductionLog[], invoices: SavedInvoice[], period: Period, now: Date): LedgerRow[] {
  const saleRows: LedgerRow[] = cashLedgerSales(sales, invoices.map((invoice) => invoice.id))
    .filter((s) => isInFinancePeriod(s.sold_at, period, now))
    .map((s) => ({ kind: 'sale' as const, id: s.id, iso: s.sold_at ?? '', date: fmtDate(s.sold_at), desc: `${s.crop} sale`, qty: `${s.kg} kg`, inAmt: s.amount ?? 0, source: s.buyer || 'Direct sale', outAmt: null }));
  const expenseRows: LedgerRow[] = expenses
    .filter((x) => isInFinancePeriod(x.spent_at, period, now))
    .map((x) => ({ kind: 'expense' as const, id: x.id, iso: x.spent_at ?? '', date: fmtDate(x.spent_at), desc: x.item, qty: categoryLabel(x.category) || '—', inAmt: null, source: x.supplier || 'Cost', outAmt: x.amount ?? 0 }));
  const harvestRows: LedgerRow[] = production
    .filter((p) => isInFinancePeriod(p.logged_at, period, now))
    .map((p) => ({ kind: 'harvest' as const, id: p.id, iso: p.logged_at ?? '', date: fmtDate(p.logged_at), desc: `${p.crop} harvested`, qty: `${p.kg} kg`, inAmt: null, source: 'Yield log', outAmt: null }));
  const invoiceRows: LedgerRow[] = invoices
    .filter((i) => i.status === 'paid' && isInFinancePeriod(i.paidAt, period, now))
    .map((i) => ({ kind: 'invoice' as const, id: i.id, iso: i.paidAt ?? i.dateISO, date: fmtDate(i.paidAt ?? i.dateISO), desc: `Invoice #${i.no} — ${i.billTo || 'No buyer'}`, qty: '—', inAmt: i.total ?? 0, source: i.paymentMethod ? `Invoice · ${paymentMethodLabel(i.paymentMethod)}` : 'Invoice', outAmt: null }));
  // Invoice-generated crop rows carry invoice_id and are deliberately absent from saleRows above:
  // the invoice is the money entry while its linked sale rows supply crop/kg evidence to harvest
  // reconciliation. This remaining heuristic catches a farmer manually entering the same sale as
  // well; those unlinked rows still need human review rather than silent deletion.
  const suspect = suspectedDuplicateIncomeIds(
    [...saleRows, ...invoiceRows].map((r) => ({
      id: `${r.kind}-${r.id}`,
      kind: r.kind === 'invoice' ? 'invoice' as const : 'sale' as const,
      amount: r.inAmt ?? 0,
      iso: r.iso,
    })),
  );
  return [...saleRows, ...expenseRows, ...harvestRows, ...invoiceRows]
    .map((r) => ({ ...r, duplicateSuspect: suspect.has(`${r.kind}-${r.id}`) }))
    .sort((a, b) => (b.iso ?? '').localeCompare(a.iso ?? ''));
}

function exportLedgerCsv(rows: LedgerRow[], period: Period) {
  const head = ['Date', 'Description', 'Qty', 'In', 'Source', 'Out', 'Check'];
  const body = rows.map((r) => [r.date, r.desc, r.qty, r.inAmt != null ? fmtZAR(r.inAmt) : '', r.source, r.outAmt != null ? fmtZAR(r.outAmt) : '', r.duplicateSuspect ? DUPLICATE_ROW_NOTE : '']);
  const csv = [head, ...body].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url; a.download = `imbewufield-financial-sheet-${period}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function FinancialSheet({ sales, production, expenses, invoices, name, loading, period, setPeriod, onAddEntry, onEditSale, onEditExpense, onSeeSample, onLogHarvest }: { sales: SalesLog[]; production: ProductionLog[]; expenses: ExpenseLog[]; invoices: SavedInvoice[]; name: string; loading: boolean; period: Period; setPeriod: (p: Period) => void; onAddEntry: () => void; onEditSale: (s: SalesLog) => void; onEditExpense: (x: ExpenseLog) => void; onSeeSample?: () => void; onLogHarvest: () => void }) {
  const now = useMemo(() => new Date(), []);

  const rows: LedgerRow[] = useMemo(
    () => buildLedgerRows(sales, expenses, production, invoices, period, now),
    [sales, expenses, production, invoices, period, now],
  );

  const income = rows.reduce((a, r) => a + (r.inAmt ?? 0), 0);
  const expenseTotal = rows.reduce((a, r) => a + (r.outAmt ?? 0), 0);
  const net = income - expenseTotal;
  const includePerennials = useIncludePerennials();
  const periodKg = scopeKg(production.filter((p) => isInFinancePeriod(p.logged_at, period, now)), includePerennials);
  const yieldKg = periodKg.counted;
  const yieldLabel = yieldKg >= 1000 ? `${(yieldKg / 1000).toFixed(1)} t` : `${yieldKg.toFixed(0)} kg`;

  function exportCsv() { exportLedgerCsv(rows, period); }

  const stats = [
    { label: 'Income', value: fmtZAR(income), color: '#2E6B3A' },
    { label: 'Expenses', value: expenseTotal ? fmtZAR(expenseTotal) : '—', color: '#C07A1E' },
    { label: 'Recorded cash margin', value: fmtZAR(net), color: 'var(--color-forest-800)' },
    { label: 'Yield logged', value: yieldLabel, color: 'var(--color-water)' },
  ];

  return (
    // 5xl (1024px) was leaving a third of a desktop empty on the one screen
    // in the book that is a wide table: four stat tiles and a dated ledger.
    <div className="mx-auto w-full" style={{ maxWidth: 1280 }}>
      {/* Title bar */}
      <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="font-sans uppercase tracking-widest" style={{ fontSize: 12, color: 'var(--color-muted)', letterSpacing: '0.14em' }}>{name}</div>
          <h1 className="font-display font-semibold" style={{ fontSize: 30, color: 'var(--color-ink)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>Financial sheet</h1>
        </div>
        <div className="flex items-center gap-2">
          {onSeeSample && (
            <button onClick={onSeeSample}
              title="Open a fully-worked demo farm. Your own books are not touched."
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-sans font-semibold transition-all"
              style={{ background: 'transparent', border: '1px dashed rgba(192,122,30,0.5)', color: '#C07A1E', fontSize: 14, cursor: 'pointer' }}>
              <Sparkles size={15} />See a sample
            </button>
          )}
          <div className="flex rounded-lg p-0.5 gap-0.5" style={{ background: 'rgba(226,216,196,0.5)', border: '1px solid var(--color-border)' }}>
            {(['month', 'season', 'year'] as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className="px-3 py-1.5 rounded-md font-sans font-semibold capitalize transition-all"
                style={period === p ? { background: 'var(--color-forest-800)', color: 'var(--color-canvas)', fontSize: 13 } : { color: 'var(--color-muted-strong)', fontSize: 13, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                {p}
              </button>
            ))}
          </div>
          <button onClick={exportCsv} disabled={rows.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-sans font-semibold transition-all"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: rows.length ? 'var(--color-ink)' : 'var(--color-muted)', fontSize: 14, cursor: rows.length ? 'pointer' : 'not-allowed' }}>
            <Download size={15} />Export
          </button>
          <Link href="/invoice" className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-sans font-semibold" style={{ background: 'rgba(192,122,30,0.12)', border: '1px solid rgba(192,122,30,0.3)', color: '#C07A1E', fontSize: 14, textDecoration: 'none' }}>
            <FileText size={15} />New invoice
          </Link>
          {/* Was a Link to /records back when the harvest form lived behind a different door.
              Same one tap, no page load: Picked is a tab in this book now. */}
          <button type="button" onClick={onLogHarvest}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-sans font-semibold"
            style={{ background: 'rgba(35,94,134,0.10)', border: '1px solid rgba(35,94,134,0.25)', color: 'var(--color-water)', fontSize: 14, cursor: 'pointer' }}>
            <Sprout size={15} />Log harvest
          </button>
          <button onClick={onAddEntry}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-sans font-semibold transition-all"
            style={{ background: 'var(--color-forest-800)', border: '1px solid rgba(31,77,43,0.22)', color: 'var(--color-canvas)', fontSize: 14, cursor: 'pointer' }}>
            <Plus size={15} />New entry
          </button>
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl px-5 py-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="font-sans uppercase tracking-widest" style={{ fontSize: 12, color: 'var(--color-muted)', letterSpacing: '0.1em' }}>{s.label}</div>
            <div className="font-display font-bold mt-1" style={{ fontSize: 28, color: s.color, letterSpacing: '-0.02em' }}>{loading ? '…' : s.value}</div>
          </div>
        ))}
      </div>
      {!loading && periodKg.excluded > 0 && (
        /* Same rule as the phone summary: what the switch removes is named and
           counted on the same screen, so "Yield logged" is never quietly short. */
        <p className="font-sans mb-5" style={{ fontSize: 12, color: 'var(--color-muted-strong)', marginTop: -12 }}>
          Orchard is switched off, so {periodKg.excluded.toFixed(1)} kg is not in Yield
          logged: {periodKg.excludedNames.join(', ')}. Income and recorded cash margin still count every sale.
        </p>
      )}

      {/* Ledger table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              {['Date', 'Description', 'Qty', 'In', 'Source', 'Out'].map((h, i) => (
                <th key={h} className="font-sans uppercase tracking-wider px-5 py-3"
                  style={{ fontSize: 12, color: 'var(--color-muted)', textAlign: i >= 3 && (h === 'In' || h === 'Out') ? 'right' : 'left', letterSpacing: '0.08em', fontWeight: 700 }}>{h}</th>
              ))}
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center font-sans" style={{ fontSize: 14, color: 'var(--color-muted)' }}>
                No entries for this {period}. Use the New-entry button, the Invoice tool, or your phone — everything shows here. {DUPLICATE_LEDGER_FOOTER}
              </td></tr>
            ) : rows.map((r, i) => (
              <tr key={`${r.kind}-${r.id}`} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                <td className="px-5 py-3 font-sans" style={{ fontSize: 14, color: 'var(--color-muted-strong)', whiteSpace: 'nowrap' }}>{r.date}</td>
                <td className="px-5 py-3 font-display font-medium" style={{ fontSize: 14, color: 'var(--color-ink)' }}>
                  {r.desc}
                  {r.duplicateSuspect && (
                    <span className="block font-sans" style={{ fontSize: 12, color: '#B07A1E', marginTop: 2 }}>
                      {DUPLICATE_ROW_NOTE}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 font-sans" style={{ fontSize: 14, color: 'var(--color-muted-strong)', whiteSpace: 'nowrap' }}>{r.qty}</td>
                <td className="px-5 py-3 font-display font-semibold tabular-nums" style={{ fontSize: 14, color: '#2E6B3A', textAlign: 'right', whiteSpace: 'nowrap' }}>{r.inAmt != null ? fmtZAR(r.inAmt) : '—'}</td>
                <td className="px-5 py-3 font-sans" style={{ fontSize: 14, color: 'var(--color-muted)' }}>{r.source}</td>
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
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-muted-strong)', opacity: 0.55 }}>
                      <Pencil size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="font-sans mt-3" style={{ fontSize: 12, color: 'var(--color-muted)' }}>
        Synced with your phone · {rows.length} {rows.length === 1 ? 'entry' : 'entries'} this {period}. Add or edit sales and costs here, or with the New-entry button on your phone.
      </p>
    </div>
  );
}

/* ── Measured farm metrics ──────────────────────────────────────────────── */

function metricNumber(value: number | null, unit: string): string {
  return value === null || !Number.isFinite(value) ? 'Unknown' : `${value.toFixed(1)} ${unit}`;
}

/**
 * BEDS AND PLANTINGS ARRIVE AS A PROP now (lib/finance-plan-source.ts), not from
 * this card's own read. It used to load the Design Studio canvas itself while
 * HarvestReconciliation, directly below it, loaded the LEGACY facilitator canvas
 * — 128 m² against 44 m² on the sample farm, so the two cards printed production
 * densities three times apart as facts about one farm. One source now answers
 * for the whole screen; the events this effect used to listen to are handled
 * there, so an edit in the Studio still updates every card at once.
 */
function FarmMetrics({ sales, production, expenses, invoices, period, now, loading, plantings, beds, planLoaded }: { sales: SalesLog[]; production: ProductionLog[]; expenses: ExpenseLog[]; invoices: SavedInvoice[]; period: FinancePeriod; now: Date; loading: boolean; plantings: Planting[]; beds: PlanBed[]; planLoaded: boolean }) {
  const metrics = useMemo(
    () => buildFarmMetrics(plantings, beds, production, sales, expenses, period, now, invoices),
    [plantings, beds, production, sales, expenses, period, now, invoices],
  );
  const waiting = loading || !planLoaded;

  return (
    <section className="rounded-2xl overflow-hidden" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
      <div className="px-4 py-3" style={{ borderBottom: '1px solid #E2D8C4' }}>
        <p className="text-xs font-mono uppercase tracking-wider" style={{ color: '#5C5040' }}>Crop performance</p>
        <p className="text-xs font-sans mt-1" style={{ color: '#8C7A62' }}>Yield leads: it compares growing work even when prices change.</p>
      </div>
      {waiting ? (
        <p className="px-4 py-6 text-xs font-sans" style={{ color: '#8C7A62' }}>Loading crop areas…</p>
      ) : metrics.crops.length === 0 ? (
        <p className="px-4 py-6 text-sm font-display" style={{ color: '#5C5040' }}>No crop activity or crop plan for this {period}.</p>
      ) : (
        <div className="divide-y" style={{ borderColor: '#E2D8C4' }}>
          {metrics.crops.map((crop) => (
            <div key={crop.cropKey ?? crop.cropName} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <p className="text-sm font-display font-semibold" style={{ color: '#20190F' }}>{crop.cropName}</p>
                <p className="text-xs font-sans text-right" style={{ color: crop.areaM2 === null ? '#C07A1E' : '#8C7A62' }}>
                  {crop.areaM2 === null ? 'Planted area not recorded' : `${crop.areaM2.toFixed(1)} m² planned`}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><p className="text-xs font-mono uppercase" style={{ color: '#8C7A62' }}>Yield</p><p className="text-sm font-display font-semibold" style={{ color: '#1F4D2B' }}>{crop.hasHarvest ? metricNumber(crop.yieldKgPerM2, 'kg/m²') : 'No harvest logged'}</p></div>
                <div><p className="text-xs font-mono uppercase" style={{ color: '#8C7A62' }}>Turnover</p><p className="text-sm font-display font-semibold" style={{ color: '#235E86' }}>{crop.hasSale ? metricNumber(crop.turnoverZarPerM2, 'R/m²') : 'No sales logged'}</p></div>
                <div><p className="text-xs font-mono uppercase" style={{ color: '#8C7A62' }}>Price</p><p className="text-sm font-display font-semibold" style={{ color: '#9E5C08' }}>{crop.hasSale ? metricNumber(crop.priceZarPerKg, 'R/kg') : 'No sales logged'}</p></div>
              </div>
              <p className="text-xs font-sans mt-2" style={{ color: '#5C5040' }}>
                {crop.hasTaggedCost
                  ? `Cost from tagged entries: ${metricNumber(crop.taggedCostZarPerM2, 'R/m²')}${metrics.hasUnattributedExpenses ? ' · Other costs not attributed' : ''}`
                  : metrics.hasUnattributedExpenses ? 'Cost per m²: not attributed' : 'No crop cost logged'}
              </p>
            </div>
          ))}
        </div>
      )}
      {metrics.perennialCrops.length > 0 && (
        /* The orchard, measured the way a tree CAN be measured.
           Before this the card only named these produce and stopped, because every figure above is
           divided by bed area and a tree's fruit does not come off a bed. But two of the three
           figures a farmer actually asks for were never per-area: what came off the tree, and what
           it fetched per kilogram. The app was already computing both and dropping them on the
           floor. There is still deliberately no yield-per-area and no projection here — these are
           achieved numbers off the farmer's own logs, which is why they need no sourcing. */
        <div className="px-4 py-3" style={{ borderTop: '1px solid #E2D8C4' }}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-mono uppercase tracking-wider" style={{ color: '#5C5040' }}>Orchard &amp; food forest</p>
            <p className="text-xs font-sans" style={{ color: '#8C7A62' }}>picked &amp; sold, not per m²</p>
          </div>
          {metrics.perennialCrops.map((row) => (
            <div key={row.cropName} className="mt-3">
              <p className="text-sm font-display font-semibold" style={{ color: '#20190F' }}>{row.cropName}</p>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <div>
                  <p className="text-xs font-mono uppercase" style={{ color: '#8C7A62' }}>Picked</p>
                  <p className="text-sm font-display font-semibold" style={{ color: '#1F4D2B' }}>
                    {row.hasHarvest ? metricNumber(row.harvestedKg, 'kg') : 'No harvest logged'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-mono uppercase" style={{ color: '#8C7A62' }}>Sold for</p>
                  <p className="text-sm font-display font-semibold" style={{ color: '#235E86' }}>
                    {row.hasSale ? fmtZAR(row.turnoverZar) : 'No sales logged'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-mono uppercase" style={{ color: '#8C7A62' }}>Price</p>
                  <p className="text-sm font-display font-semibold" style={{ color: '#9E5C08' }}>
                    {row.priceZarPerKg !== null ? metricNumber(row.priceZarPerKg, 'R/kg') : 'No sales logged'}
                  </p>
                </div>
              </div>
              {row.hasSale && row.hasHarvest && row.soldKg < row.harvestedKg && (
                /* Said out loud rather than left for the farmer to subtract. The gap between picked
                   and sold is the eaten-at-home-or-lost share, and on fruit it is usually the
                   larger half — printing only the rand would quietly imply the rest was worthless. */
                <p className="text-xs font-sans mt-1" style={{ color: '#5C5040' }}>
                  {metricNumber(row.soldKg, 'kg')} of that was sold · {metricNumber(row.harvestedKg - row.soldKg, 'kg')} eaten at home, given away or lost
                </p>
              )}
            </div>
          ))}
          <p className="text-xs font-sans mt-3" style={{ color: '#8C7A62' }}>
            These are not rows in the list above because every figure there is worked out per square
            metre of bed, and fruit off a tree does not come off a bed. The sales here are already
            counted in the money below.
          </p>
        </div>
      )}
      <div className="px-4 py-3" style={{ background: '#F7F2E9', borderTop: '1px solid #E2D8C4' }}>
        <p className="text-xs font-mono uppercase tracking-wider" style={{ color: '#5C5040' }}>Garden gross margin</p>
        {metrics.gardenMargins.length === 0 ? (
          <p className="text-xs font-sans mt-1" style={{ color: '#8C7A62' }}>No sales or costs logged for this {period}.</p>
        ) : metrics.gardenMargins.map((margin) => (
          <div key={margin.gardenId ?? 'this-farm'} className="flex items-baseline justify-between gap-3 mt-2">
            <p className="text-sm font-display" style={{ color: '#20190F' }}>{margin.gardenId ? `Garden ${margin.gardenId}` : 'This farm'}</p>
            <p className="text-sm font-display font-semibold" style={{ color: '#1F4D2B' }}>{fmtZAR(margin.grossMarginZar)}</p>
          </div>
        ))}
        <p className="text-xs font-sans mt-1" style={{ color: '#8C7A62' }}>Sales logged minus expenses logged. Shared costs are never guessed into crop profit.</p>
      </div>
    </section>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */

// The Finance demo is sample mode (lib/sample-mode.ts, seeded from the Ubhejane Creche
// fixture in lib/demo-farm.ts): a full worked year of sales, harvests, running and capital
// costs, and seven invoices, held in memory for this tab only.
//
// It replaces an earlier "Load sample data" button that wrote thirteen 'Sample —' rows
// through the REAL addSale/addExpense/saveInvoice paths into the farmer's own books —
// demo data she then had to find and delete by hand. Sample mode shows strictly more,
// is equally editable, and cannot touch a real ledger.

export default function RecordsPage() {
  const { t } = useLanguage();
  /**
   * WHICH PAGE OF THE BOOK IS OPEN.
   *
   * Picked first, deliberately. It holds the harvest form, which is the thing she opens this
   * screen to do most often and the one surface the audit told us not to touch; the money totals
   * sit above the tabs so the season's answer is on screen whichever page she is on.
   *
   * Read from ?tab= on mount rather than through useSearchParams(), which would drag this whole
   * client page into a Suspense boundary at build time for one optional string. Deep links
   * (/records?tab=spent) work, and so does anything /finances redirects across.
   */
  const [tab, setTab] = useState<BookTab>('picked');
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('tab');
    if (isBookTab(wanted)) setTab(wanted);
  }, []);

  const [user, setUser] = useState<User | null | 'loading'>('loading');
  const [sales, setSales] = useState<SalesLog[]>([]);
  const [production, setProduction] = useState<ProductionLog[]>([]);
  const [expenses, setExpenses] = useState<ExpenseLog[]>([]);
  const [invoices, setInvoices] = useState<SavedInvoice[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [editing, setEditing] = useState<EditTarget>(null);
  const [desktopEntryOpen, setDesktopEntryOpen] = useState(false);
  /**
   * WHETHER THE DEVICE IS ONLINE. An empty ledger and an unreachable one rendered identically —
   * "R 0" and "No sales logged yet" — because an offline getDocs FULFILS with an empty snapshot
   * rather than rejecting, so the allSettled handler below never saw a failure to report.
   *
   * This drives the honest offline banner. It used to also suppress the old sample-data offer,
   * which wrote real rows and so must never be shown over a wrongly-empty screen; the sample is
   * now session-only sample mode, which writes nothing and is safe to offer offline.
   */
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(typeof navigator === 'undefined' ? true : navigator.onLine !== false);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);
  // OPENS ON THE SEASON, not the calendar month. A smallholder's money arrives
  // in harvest flushes and leaves in capital lumps — a tank, a fence — so a
  // month window routinely opens on two rows and no expenses at all, which
  // reads as "this farm does nothing" rather than "you are looking at 4 days".
  // The toggle is right there for anyone who wants the tighter window.
  const [period, setPeriod] = useState<Period>('season');
  const now = useMemo(() => new Date(), []);

  // ONE bed authority for this whole screen — see lib/finance-plan-source.ts for
  // the two-authorities bug this closed. Every card that measures land takes its
  // beds from here, so no two of them can be about different land again.
  const planSource = useFinancePlanSource();
  // The forward card values kilograms; both of these are read once here rather
  // than inside it, so the card stays a pure function of its props.
  const [priceOverrides, setPriceOverrides] = useState<Record<string, CropPrice>>({});
  const [cashflowSettings, setCashflowSettings] = useState<CashflowSettings>(DEFAULT_CASHFLOW_SETTINGS);
  useEffect(() => {
    setPriceOverrides(loadCropPriceOverrides());
    setCashflowSettings(loadCashflowSettings());
  }, []);

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
    if (isSampleMode()) {
      setProduction(getSandboxProduction());
      setSales(getSandboxSales());
      setExpenses(getSandboxExpenses());
      setInvoices(loadInvoices());
      return;
    }
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
    if (isSampleMode()) {
      void loadData();
    } else if (user && user !== 'loading') {
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
    try { if (isSampleMode()) deleteSandboxSale(id); else await deleteSale(id); } finally { void loadData(); }
  }
  async function handleDeleteExpense(id: string) {
    setExpenses((prev) => prev.filter((x) => x.id !== id));
    try { if (isSampleMode()) deleteSandboxExpense(id); else await deleteExpense(id); } finally { void loadData(); }
  }

  const hasAnyData = sales.length > 0 || expenses.length > 0 || production.length > 0 || invoices.length > 0;
  // Read once per render rather than calling isSampleMode() inline in JSX: this drives the
  // sheet's own farm name, so it must never disagree with the data the same render shows.
  const sampling = isSampleMode();

  // Hard navigation, not client-side routing: enterSampleMode() reseeds the sandbox and the
  // localStorage shim, so every hook on this page must remount and re-read through
  // isSampleMode() from a clean mount (the same reason SampleModeBanner's exit handler
  // does a full location change).
  function handleSeeSample() {
    if (enterSampleMode()) window.location.href = '/records?tab=charts';
  }

  const bookTabs: { id: BookTab; label: string; Icon: typeof Sprout }[] = [
    { id: 'picked', label: t('bookTabPicked'), Icon: Sprout },
    { id: 'sold', label: t('bookTabSold'), Icon: TrendingUp },
    { id: 'spent', label: t('bookTabSpent'), Icon: Receipt },
    { id: 'charts', label: t('bookTabCharts'), Icon: BarChart3 },
  ];

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: '100dvh', background: 'var(--color-canvas)' }}
    >
      {/* Header */}
      <header
        className="flex-shrink-0 flex items-center px-3 sm:px-4 gap-2 sm:gap-3 overflow-x-auto"
        style={{ height: 52, background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
      >
        <MenuButton />
        <BackButton fallback="/home" />
        <BrandLogo />
        {/* On a 375px phone the burger, back arrow, logo, Learn, Invoice and Settings leave this
            label about four characters, so it truncated to something that told you less than
            nothing. The bottom nav already names this screen and highlights it, so below sm the
            label simply steps aside — the same pattern the funder and NGO headers use. */}
        <div className="w-px h-5 hidden sm:block" style={{ background: 'var(--color-border)' }} />
        <span className="text-xs font-display truncate min-w-0 hidden sm:block" style={{ color: 'var(--color-muted-strong)' }}>{t('myRecordsTitle')}</span>
        <div className="flex-1" />
        {/* 'finances:overview', which is the id lib/lesson-registry.ts actually holds. The old
            /records header asked for 'finance:overview' — no such lesson — so Learn opened onto
            nothing on the one screen a farmer most needs explained. */}
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
        ) : !user && !isSampleMode() ? (
          <SignInPrompt />
        ) : (
          <>
            {/* THE ANSWER, ABOVE THE TABS.
                "She cannot answer how much did I make this season" was the finding, and a number
                that only appears on one page of the book does not answer it — she would have to
                remember which page. Sold, spent and picked stay on screen whichever tab is open.
                Hidden on lg only because the desktop sheet prints its own, wider stat row. */}
            <div className="lg:hidden">
              <SummaryCards
                sales={sales}
                production={production}
                expenses={expenses}
                invoices={invoices}
                loading={dataLoading}
              />
            </div>

            {/* ── The three tabs, plus the charts as a view inside the book ──────────────
                Not a menu: four fixed pages, all visible at once, so she can see what this
                screen holds without opening anything. 48px tall and 13px type — above both
                the tap-target floor and the type floor the audit set. */}
            <div
              role="tablist"
              aria-label={t('myRecordsTitle')}
              className="flex gap-1 rounded-2xl p-1"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              {bookTabs.map(({ id, label, Icon }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(id)}
                    className="flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl font-sans transition-all"
                    style={{
                      minHeight: 48,
                      padding: '6px 2px',
                      background: active ? 'var(--color-forest-800)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: active ? 'var(--color-canvas)' : 'var(--color-muted-strong)',
                      fontSize: 13,
                      fontWeight: active ? 700 : 600,
                    }}
                  >
                    <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* PICKED and SOLD both take their forms from the same mounted MyRecords, in the same
                JSX slot, so switching between them changes one prop instead of remounting and
                re-reading Firestore. The harvest form inside it is untouched by this merge —
                crop, kilograms, optional photo, save — only its front door moved. */}
            {(tab === 'picked' || tab === 'sold') && (
              <div
                className="rounded-2xl"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
              >
                <MyRecords section={tab} onChanged={loadData} />
              </div>
            )}

            {tab === 'sold' && (
              <>
                {/* Money in only. Same rows, same builder as Spent below — one ledger, filtered,
                    so a paid invoice still cannot be counted twice. */}
                <SalesLedger
                  sales={sales}
                  expenses={expenses}
                  invoices={invoices}
                  loading={dataLoading}
                  only="in"
                  heading={t('bookTabSold')}
                  emptyMessage="No sales logged yet"
                  onEditSale={(row) => setEditing({ type: 'sale', row })}
                  onEditExpense={(row) => setEditing({ type: 'expense', row })}
                  onDeleteSale={handleDeleteSale}
                  onDeleteExpense={handleDeleteExpense}
                />
                {/* The edit target for the pencil above, and the second way to enter a sale (the
                    plain-text one, without the crop picker) — kept because dropping a write path
                    is how a farmer's entry quietly stops being possible. */}
                <LogSaleForm
                  onSaved={loadData}
                  editing={editing}
                  onCancelEdit={() => setEditing(null)}
                  online={online}
                  lockKind="in"
                  addLabel="Add a sale by hand"
                />
              </>
            )}

            {tab === 'spent' && (
              <>
                <SalesLedger
                  sales={sales}
                  expenses={expenses}
                  invoices={invoices}
                  loading={dataLoading}
                  only="out"
                  heading={t('bookTabSpent')}
                  emptyMessage="No costs logged yet"
                  onEditSale={(row) => setEditing({ type: 'sale', row })}
                  onEditExpense={(row) => setEditing({ type: 'expense', row })}
                  onDeleteSale={handleDeleteSale}
                  onDeleteExpense={handleDeleteExpense}
                />
                {/* The only door to addExpense/updateExpense, and to the till-slip camera. */}
                <LogSaleForm
                  onSaved={loadData}
                  editing={editing}
                  onCancelEdit={() => setEditing(null)}
                  online={online}
                  lockKind="out"
                  addLabel="Log a cost"
                />
              </>
            )}

            {tab === 'charts' && (
              <>
                {/* Wide / laptop: the financial-sheet ledger workspace (frame 15) */}
                <div className="hidden lg:block space-y-6">
                  {/* "a cashflow graph right at the top" — above the ledger, because the
                      ledger answers "what happened" and this answers "which way is it
                      going", and only one of those is worth the first screenful. */}
                  <CashflowChart sales={sales} expenses={expenses} production={production} invoices={invoices} loading={dataLoading} wide />
                  <FinancialSheet
                    sales={sales}
                    production={production}
                    expenses={expenses}
                    invoices={invoices}
                    name={sampling ? 'Ubhejane Creche (sample)' : (user ? (user.displayName ?? 'My farm') : 'My farm')}
                    loading={dataLoading}
                    period={period}
                    setPeriod={setPeriod}
                    onAddEntry={() => { setEditing(null); setDesktopEntryOpen(true); }}
                    onEditSale={(row) => { setEditing({ type: 'sale', row }); setDesktopEntryOpen(true); }}
                    onEditExpense={(row) => { setEditing({ type: 'expense', row }); setDesktopEntryOpen(true); }}
                    onSeeSample={sampling ? undefined : handleSeeSample}
                    onLogHarvest={() => setTab('picked')}
                  />
                  {/* Measured kilograms, then the plan's benchmark beside them. Sits
                      after the ledger and before the per-crop numbers: it is the
                      picture those numbers are the detail of. */}
                  <FinanceGraphs production={production} sales={sales} invoices={invoices} source={planSource} settings={cashflowSettings} wide />
                  <AreaReturnCards sample={sampling} beds={planSource.beds} sales={sales} expenses={expenses} invoices={invoices} period={period} now={now} loading={dataLoading || !planSource.loaded} />
                  <FarmMetrics sales={sales} production={production} expenses={expenses} invoices={invoices} period={period} now={now} loading={dataLoading} plantings={planSource.plantings} beds={planSource.beds} planLoaded={planSource.loaded} />
                  <ComingUpHarvests source={planSource} prices={priceOverrides} settings={cashflowSettings} />
                  <HarvestReconciliation production={production} sales={sales} period={period} now={now} loading={dataLoading} plantings={planSource.plantings} beds={planSource.beds} planLoaded={planSource.loaded} />
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
                          online={online}
                        />
                      </div>
                    </div>
                  )}
                </div>
                {/* Phone / tablet: the simple money view */}
                <div className="lg:hidden space-y-4">
                  <CashflowChart sales={sales} expenses={expenses} production={production} invoices={invoices} loading={dataLoading} />
                  <FinanceGraphs production={production} sales={sales} invoices={invoices} source={planSource} settings={cashflowSettings} />
                  <ComingUpHarvests source={planSource} prices={priceOverrides} settings={cashflowSettings} />
                  <HarvestReconciliation production={production} sales={sales} period="month" now={now} loading={dataLoading} plantings={planSource.plantings} beds={planSource.beds} planLoaded={planSource.loaded} />
                  <AreaReturnCards sample={sampling} beds={planSource.beds} sales={sales} expenses={expenses} invoices={invoices} period="month" now={now} loading={dataLoading || !planSource.loaded} />
                  <FarmMetrics sales={sales} production={production} expenses={expenses} invoices={invoices} period="month" now={now} loading={dataLoading} plantings={planSource.plantings} beds={planSource.beds} planLoaded={planSource.loaded} />
                  {/* Never hidden behind a tab switch: "no data" may only mean "not reachable",
                      and every figure on this page is wrong in that case. */}
                  {!online && (
                    <div
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-sm font-display"
                      style={{ background: '#FDF3E3', border: '1px solid #E8D6B0', color: '#7A5B18' }}
                    >
                      You are offline — showing what is saved on this device. Anything missing will
                      appear when you have signal again.
                    </div>
                  )}
                  {/* Offered whether or not the ledger has rows — a farmer with one entry still
                      needs to see what a worked year looks like. Sample mode is session-only and
                      in-memory, so unlike the seeder this replaced it can never write to her books. */}
                  {!sampling && (
                    <button
                      type="button"
                      onClick={handleSeeSample}
                      className="w-full flex flex-col items-center justify-center gap-1.5 py-6 px-4 rounded-2xl text-sm font-display font-semibold transition-all"
                      style={{ background: 'transparent', border: '1px dashed rgba(192,122,30,0.5)', color: '#C07A1E', cursor: 'pointer' }}
                    >
                      <span className="flex items-center gap-2"><Sparkles size={18} />See a sample — how this book works</span>
                      <span className="font-sans font-normal" style={{ fontSize: 12, color: 'var(--color-muted-strong)', lineHeight: 1.4 }}>
                        A worked year from the Ubhejane Crèche demo farm: sales, costs, harvests and
                        invoices. Your own books are not touched.
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => exportLedgerCsv(buildLedgerRows(sales, expenses, production, invoices, 'month', new Date()), 'month')}
                    disabled={!hasAnyData}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-display font-semibold transition-all"
                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: hasAnyData ? 'var(--color-ink)' : 'var(--color-muted)', cursor: hasAnyData ? 'pointer' : 'not-allowed' }}
                  >
                    <Download size={15} />Export CSV
                  </button>
                  {/* Everything, in date order — the one list that still crosses the tabs, because
                      "what happened lately" is a question about the whole book, not one page. */}
                  <SalesLedger
                    sales={sales}
                    expenses={expenses}
                    invoices={invoices}
                    loading={dataLoading}
                    heading="Recent activity"
                    emptyMessage="Nothing logged yet"
                    onEditSale={(row) => setEditing({ type: 'sale', row })}
                    onEditExpense={(row) => setEditing({ type: 'expense', row })}
                    onDeleteSale={handleDeleteSale}
                    onDeleteExpense={handleDeleteExpense}
                  />
                </div>
              </>
            )}
          </>
        )}
      </main>

      <TabBar />
    </div>
  );
}

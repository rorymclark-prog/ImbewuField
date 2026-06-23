'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { TrendingUp, Scale, Receipt, Plus, Sprout, FileText } from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebase } from '@/lib/firebase/init';
import { addSale, myProduction } from '@/lib/db/queries';
import type { SalesLog, ProductionLog } from '@/lib/db/types';
import BrandLogo from '@/components/BrandLogo';
import SettingsButton from '@/components/SettingsButton';
import TabBar from '@/components/TabBar';

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
  loading: boolean;
}

function SummaryCards({ sales, production, loading }: SummaryProps) {
  const thisMonthSales = sales.filter((s) => isThisMonth(s.sold_at));
  const totalRevenue = thisMonthSales.reduce((acc, s) => acc + (s.amount ?? 0), 0);
  const totalKg = production
    .filter((p) => isThisMonth(p.logged_at))
    .reduce((acc, p) => acc + (p.kg ?? 0), 0);
  const txCount = thisMonthSales.length;

  const cards = [
    {
      icon: <TrendingUp size={16} />,
      label: 'Sold this month',
      value: fmtZAR(totalRevenue),
      color: '#C07A1E',
      bg: 'rgba(192,122,30,0.08)',
      border: 'rgba(192,122,30,0.18)',
    },
    {
      icon: <Scale size={16} />,
      label: 'Kg harvested',
      value: `${totalKg.toFixed(1)} kg`,
      color: '#1F4D2B',
      bg: 'rgba(31,77,43,0.08)',
      border: 'rgba(31,77,43,0.18)',
    },
    {
      icon: <Receipt size={16} />,
      label: 'Transactions',
      value: txCount.toString(),
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

/* ── Recent sales ledger ─────────────────────────────────────────────────── */

function SalesLedger({ sales, loading }: { sales: SalesLog[]; loading: boolean }) {
  const sorted = [...sales].sort((a, b) =>
    (b.sold_at ?? '').localeCompare(a.sold_at ?? '')
  );

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}
    >
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ borderBottom: '1px solid #E2D8C4' }}
      >
        <Receipt size={14} style={{ color: '#5C5040' }} />
        <span className="text-xs font-mono uppercase tracking-wider" style={{ color: '#5C5040' }}>
          Recent sales
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
      ) : sorted.length === 0 ? (
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
          {sorted.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-display font-medium leading-snug truncate"
                  style={{ color: '#20190F' }}
                >
                  {item.crop}
                  {item.buyer ? (
                    <span className="font-normal" style={{ color: '#8C7A62' }}>
                      {' '}via {item.buyer}
                    </span>
                  ) : null}
                </p>
                <p className="text-xs font-mono mt-0.5" style={{ color: '#8C7A62' }}>
                  {item.kg} kg
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p
                  className="text-sm font-display font-semibold"
                  style={{ color: '#C07A1E' }}
                >
                  {fmtZAR(item.amount)}
                </p>
                <p className="text-xs font-mono mt-0.5" style={{ color: '#8C7A62' }}>
                  {fmtDate(item.sold_at)}
                </p>
              </div>
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
  loading: boolean;
  error: string;
}

function LogSaleForm({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SaleFormState>({
    crop: '',
    kg: '',
    price: '',
    buyer: '',
    loading: false,
    error: '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const crop = form.crop.trim();
    const kg = parseFloat(form.kg);
    const amount = parseFloat(form.price);
    if (!crop || isNaN(kg) || kg <= 0 || isNaN(amount) || amount < 0) {
      setForm((f) => ({ ...f, error: 'Crop name, kg, and price are required.' }));
      return;
    }
    setForm((f) => ({ ...f, loading: true, error: '' }));
    try {
      await addSale({
        crop,
        kg,
        amount,
        buyer: form.buyer.trim() || null,
        sold_at: new Date().toISOString(),
      });
      setForm({ crop: '', kg: '', price: '', buyer: '', loading: false, error: '' });
      setOpen(false);
      onSaved();
    } catch {
      setForm((f) => ({ ...f, loading: false, error: 'Failed to save. Try again.' }));
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-display font-semibold transition-all"
        style={{
          background: '#1F4D2B',
          border: '1px solid rgba(31,77,43,0.22)',
          color: '#F7F2E9',
        }}
      >
        <Plus size={16} />
        Log sale
      </button>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}
    >
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ borderBottom: '1px solid #E2D8C4' }}
      >
        <Plus size={14} style={{ color: '#5C5040' }} />
        <span className="text-xs font-mono uppercase tracking-wider" style={{ color: '#5C5040' }}>
          Log a sale
        </span>
      </div>
      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        <div>
          <label
            className="block text-xs font-mono uppercase tracking-wider mb-1"
            style={{ color: '#5C5040' }}
          >
            Crop
          </label>
          <input
            type="text"
            placeholder="e.g. Spinach"
            value={form.crop}
            onChange={(e) => setForm((f) => ({ ...f, crop: e.target.value }))}
            className="w-full rounded-lg px-3 py-2 text-sm font-display outline-none"
            style={{
              background: '#F7F2E9',
              border: '1px solid #E2D8C4',
              color: '#20190F',
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              className="block text-xs font-mono uppercase tracking-wider mb-1"
              style={{ color: '#5C5040' }}
            >
              Kg sold
            </label>
            <input
              type="number"
              placeholder="0.0"
              step="0.1"
              min="0"
              value={form.kg}
              onChange={(e) => setForm((f) => ({ ...f, kg: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm font-display outline-none"
              style={{
                background: '#F7F2E9',
                border: '1px solid #E2D8C4',
                color: '#20190F',
              }}
            />
          </div>
          <div>
            <label
              className="block text-xs font-mono uppercase tracking-wider mb-1"
              style={{ color: '#5C5040' }}
            >
              Price (R)
            </label>
            <input
              type="number"
              placeholder="0.00"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm font-display outline-none"
              style={{
                background: '#F7F2E9',
                border: '1px solid #E2D8C4',
                color: '#20190F',
              }}
            />
          </div>
        </div>

        <div>
          <label
            className="block text-xs font-mono uppercase tracking-wider mb-1"
            style={{ color: '#5C5040' }}
          >
            Buyer
            <span className="ml-1 normal-case" style={{ color: '#8C7A62' }}>
              (optional)
            </span>
          </label>
          <input
            type="text"
            placeholder="e.g. Local market"
            value={form.buyer}
            onChange={(e) => setForm((f) => ({ ...f, buyer: e.target.value }))}
            className="w-full rounded-lg px-3 py-2 text-sm font-display outline-none"
            style={{
              background: '#F7F2E9',
              border: '1px solid #E2D8C4',
              color: '#20190F',
            }}
          />
        </div>

        {form.error && (
          <p className="text-xs font-mono" style={{ color: '#D4922A' }}>
            {form.error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setForm({ crop: '', kg: '', price: '', buyer: '', loading: false, error: '' });
            }}
            className="flex-1 py-2.5 rounded-xl text-sm font-display transition-all"
            style={{
              background: 'transparent',
              border: '1px solid #E2D8C4',
              color: '#5C5040',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={form.loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-display font-semibold flex items-center justify-center gap-2 transition-all"
            style={{
              background: form.loading ? 'rgba(31,77,43,0.06)' : '#1F4D2B',
              border: '1px solid rgba(31,77,43,0.22)',
              color: form.loading ? '#5C5040' : '#F7F2E9',
              cursor: form.loading ? 'not-allowed' : 'pointer',
            }}
          >
            {form.loading ? (
              <>
                <span
                  className="inline-block w-3 h-3 rounded-full border-2 animate-spin"
                  style={{ borderColor: '#1F4D2B transparent transparent transparent' }}
                />
                Saving...
              </>
            ) : (
              'Log sale'
            )}
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

/* ── Main page ───────────────────────────────────────────────────────────── */

export default function FinancesPage() {
  const [user, setUser] = useState<User | null | 'loading'>('loading');
  const [sales, setSales] = useState<SalesLog[]>([]);
  const [production, setProduction] = useState<ProductionLog[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

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
      // myProduction is available in queries; sales use the same Firestore pattern
      // but there's no mySales query exported yet — fetch via the same approach
      const { getFirebase: gfb } = await import('@/lib/firebase/init');
      const { getDocs, query, collection, where } = await import('firebase/firestore');
      const fb = gfb();
      if (!fb) return;
      const uid = fb.auth.currentUser?.uid;
      if (!uid) return;

      const [prodResult, salesSnap] = await Promise.all([
        myProduction(),
        getDocs(
          query(
            collection(fb.db, 'sales_logs'),
            where('profile_id', '==', uid)
          )
        ),
      ]);

      setProduction(prodResult);
      const salesRows = salesSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as object),
      })) as unknown as SalesLog[];
      setSales(salesRows);
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
    }
  }, [user, loadData]);

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: '100dvh', background: '#F7F2E9' }}
    >
      {/* Header */}
      <header
        className="flex-shrink-0 flex items-center px-4 gap-3"
        style={{ height: 52, background: '#FBF6EC', borderBottom: '1px solid #E2D8C4' }}
      >
        <BrandLogo />
        <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
        <span className="text-xs font-display" style={{ color: '#5C5040' }}>Finances</span>
        <div className="flex-1" />
        <Link href="/invoice"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold"
          style={{ background: 'rgba(192,122,30,0.12)', border: '1px solid rgba(192,122,30,0.3)', color: '#C07A1E', textDecoration: 'none' }}>
          <FileText size={13} />Invoice
        </Link>
        <SettingsButton />
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
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
            <SummaryCards
              sales={sales}
              production={production}
              loading={dataLoading}
            />
            <SalesLedger sales={sales} loading={dataLoading} />
            <LogSaleForm onSaved={loadData} />
          </>
        )}
      </main>

      <TabBar />
    </div>
  );
}

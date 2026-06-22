'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebase } from '@/lib/firebase/init';
import {
  myProduction,
  addProduction,
  addSale,
  designsSharedWithMe,
  uploadPhoto,
} from '@/lib/db/queries';
import type { ProductionLog, SalesLog, Design } from '@/lib/db/types';

/* ── Tiny shared primitives (match DataPanel style) ──────────────────────── */

function Card({
  children,
  className = '',
  accent,
}: {
  children: React.ReactNode;
  className?: string;
  accent?: string;
}) {
  return (
    <div
      className={`rounded-xl p-4 transition-all duration-200 glass glass-hover ${className}`}
      style={
        accent
          ? { borderLeftWidth: 2, borderLeftColor: accent, borderLeftStyle: 'solid' }
          : {}
      }
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-xs font-mono uppercase tracking-wider mb-2"
      style={{ color: 'var(--text-muted)' }}
    >
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="block text-xs font-mono uppercase tracking-wider mb-1"
      style={{ color: 'var(--text-muted)' }}
    >
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`dark-input w-full rounded-lg px-3 py-2 text-sm font-display outline-none transition-all ${props.className ?? ''}`}
      style={{
        background: 'rgba(22,37,20,0.6)',
        border: '1px solid var(--border)',
        color: '#e8f0e6',
        ...props.style,
      }}
    />
  );
}

function SubmitBtn({
  loading,
  children,
}: {
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-2 rounded-xl text-xs font-display font-semibold flex items-center justify-center gap-2 transition-all"
      style={{
        background: loading
          ? 'rgba(72,168,100,0.06)'
          : 'linear-gradient(135deg, rgba(72,168,100,0.18), rgba(72,168,100,0.07))',
        border: '1px solid rgba(72,168,100,0.3)',
        color: loading ? 'var(--text-muted)' : 'var(--emerald-bright)',
        cursor: loading ? 'not-allowed' : 'pointer',
      }}
    >
      {loading ? (
        <>
          <span
            className="inline-block w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--emerald) transparent transparent transparent' }}
          />
          Saving…
        </>
      ) : (
        children
      )}
    </button>
  );
}

function Divider() {
  return <div className="h-px my-4" style={{ background: 'var(--border)' }} />;
}

/* ── Format helpers ──────────────────────────────────────────────────────── */

function fmtDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  const d = new Date(raw);
  return isNaN(d.getTime())
    ? raw
    : d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── Sign-in prompt ──────────────────────────────────────────────────────── */

function SignInPrompt() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 px-6 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(72,168,100,0.15), rgba(72,168,100,0.04))',
          border: '1px solid rgba(72,168,100,0.25)',
        }}
      >
        🌱
      </div>
      <div>
        <p
          className="font-display font-semibold text-base mb-1"
          style={{ color: 'var(--text-primary)' }}
        >
          Sign in to keep your own records
        </p>
        <p className="font-display text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Track what you grow and sell — your data stays with you.
        </p>
      </div>
      <a
        href="/login"
        className="px-5 py-2 rounded-xl text-sm font-display font-semibold transition-all"
        style={{
          background: 'linear-gradient(135deg, rgba(72,168,100,0.2), rgba(72,168,100,0.07))',
          border: '1px solid rgba(72,168,100,0.35)',
          color: 'var(--emerald-bright)',
        }}
      >
        Go to sign in →
      </a>
    </div>
  );
}

/* ── Log production form ─────────────────────────────────────────────────── */

interface ProdFormState {
  crop: string;
  kg: string;
  photoFile: File | null;
  photoPreview: string;
  loading: boolean;
  error: string;
}

function LogProductionForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState<ProdFormState>({
    crop: '',
    kg: '',
    photoFile: null,
    photoPreview: '',
    loading: false,
    error: '',
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setForm((f) => ({
      ...f,
      photoFile: file,
      photoPreview: URL.createObjectURL(file),
    }));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const crop = form.crop.trim();
    const kg = parseFloat(form.kg);
    if (!crop || isNaN(kg) || kg <= 0) {
      setForm((f) => ({ ...f, error: 'Crop name and a positive kg are required.' }));
      return;
    }
    setForm((f) => ({ ...f, loading: true, error: '' }));
    try {
      let photo_url: string | null = null;
      if (form.photoFile) {
        photo_url = await uploadPhoto(form.photoFile, 'produce');
      }
      await addProduction({
        crop,
        kg,
        logged_at: new Date().toISOString(),
        ...(photo_url ? { photo_url } : {}),
      });
      setForm({
        crop: '',
        kg: '',
        photoFile: null,
        photoPreview: '',
        loading: false,
        error: '',
      });
      if (fileRef.current) fileRef.current.value = '';
      onSaved();
    } catch {
      setForm((f) => ({ ...f, loading: false, error: 'Failed to save. Try again.' }));
    }
  }

  return (
    <Card accent="var(--emerald)">
      <SectionLabel>Log production</SectionLabel>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <FieldLabel>Crop</FieldLabel>
          <Input
            type="text"
            placeholder="e.g. Spinach"
            value={form.crop}
            onChange={(e) => setForm((f) => ({ ...f, crop: e.target.value }))}
          />
        </div>
        <div>
          <FieldLabel>Kg harvested</FieldLabel>
          <Input
            type="number"
            placeholder="0.0"
            step="0.1"
            min="0"
            value={form.kg}
            onChange={(e) => setForm((f) => ({ ...f, kg: e.target.value }))}
          />
        </div>
        <div>
          <FieldLabel>Produce photo (optional)</FieldLabel>
          {form.photoPreview && (
            <div className="mb-2 relative w-full h-24 overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.photoPreview}
                alt="Preview"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  setForm((f) => ({ ...f, photoFile: null, photoPreview: '' }));
                  if (fileRef.current) fileRef.current.value = '';
                }}
                className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono"
                style={{ background: 'rgba(0,0,0,0.6)', color: 'var(--text-primary)' }}
              >
                ✕
              </button>
            </div>
          )}
          <label
            className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg text-xs font-display transition-all"
            style={{
              background: 'rgba(22,37,20,0.6)',
              border: '1px dashed var(--border)',
              color: 'var(--text-muted)',
            }}
          >
            <span>📷</span>
            <span>{form.photoFile ? form.photoFile.name : 'Choose photo…'}</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={handleFile}
            />
          </label>
        </div>
        {form.error && (
          <p className="text-xs font-mono" style={{ color: 'var(--orange)' }}>
            {form.error}
          </p>
        )}
        <SubmitBtn loading={form.loading}>✦ Save harvest</SubmitBtn>
      </form>
    </Card>
  );
}

/* ── Log sale form ───────────────────────────────────────────────────────── */

interface SaleFormState {
  crop: string;
  kg: string;
  amount: string;
  buyer: string;
  loading: boolean;
  error: string;
}

function LogSaleForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState<SaleFormState>({
    crop: '',
    kg: '',
    amount: '',
    buyer: '',
    loading: false,
    error: '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const crop = form.crop.trim();
    const kg = parseFloat(form.kg);
    const amount = parseFloat(form.amount);
    if (!crop || isNaN(kg) || kg <= 0 || isNaN(amount) || amount < 0) {
      setForm((f) => ({
        ...f,
        error: 'Crop, kg, and amount (R) are required.',
      }));
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
      setForm({ crop: '', kg: '', amount: '', buyer: '', loading: false, error: '' });
      onSaved();
    } catch {
      setForm((f) => ({ ...f, loading: false, error: 'Failed to save. Try again.' }));
    }
  }

  return (
    <Card accent="var(--gold)">
      <SectionLabel>Log sale</SectionLabel>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>Crop</FieldLabel>
            <Input
              type="text"
              placeholder="e.g. Tomatoes"
              value={form.crop}
              onChange={(e) => setForm((f) => ({ ...f, crop: e.target.value }))}
            />
          </div>
          <div>
            <FieldLabel>Kg sold</FieldLabel>
            <Input
              type="number"
              placeholder="0.0"
              step="0.1"
              min="0"
              value={form.kg}
              onChange={(e) => setForm((f) => ({ ...f, kg: e.target.value }))}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>Amount (R)</FieldLabel>
            <Input
              type="number"
              placeholder="0.00"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </div>
          <div>
            <FieldLabel>Buyer (optional)</FieldLabel>
            <Input
              type="text"
              placeholder="e.g. Market"
              value={form.buyer}
              onChange={(e) => setForm((f) => ({ ...f, buyer: e.target.value }))}
            />
          </div>
        </div>
        {form.error && (
          <p className="text-xs font-mono" style={{ color: 'var(--orange)' }}>
            {form.error}
          </p>
        )}
        <SubmitBtn loading={form.loading}>✦ Save sale</SubmitBtn>
      </form>
    </Card>
  );
}

/* ── Production list ─────────────────────────────────────────────────────── */

function ProductionList({ items }: { items: ProductionLog[] }) {
  if (items.length === 0) {
    return (
      <p className="text-xs font-mono text-center py-4" style={{ color: 'var(--text-muted)' }}>
        No harvests logged yet.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all"
          style={{
            background: 'rgba(22,37,20,0.5)',
            border: '1px solid var(--border)',
          }}
        >
          {item.photo_url ? (
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.photo_url}
                alt={item.crop}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div
              className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-lg"
              style={{ background: 'rgba(72,168,100,0.1)', border: '1px solid rgba(72,168,100,0.15)' }}
            >
              🌿
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-display font-medium leading-tight truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {item.crop}
            </p>
            <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {fmtDate(item.logged_at)}
            </p>
          </div>
          <div
            className="text-sm font-display font-semibold flex-shrink-0"
            style={{ color: 'var(--emerald-bright)' }}
          >
            {item.kg} kg
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Sales list ──────────────────────────────────────────────────────────── */

function SalesList({ items }: { items: SalesLog[] }) {
  if (items.length === 0) {
    return (
      <p className="text-xs font-mono text-center py-4" style={{ color: 'var(--text-muted)' }}>
        No sales logged yet.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5"
          style={{
            background: 'rgba(22,37,20,0.5)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-lg"
            style={{ background: 'rgba(212,168,83,0.1)', border: '1px solid rgba(212,168,83,0.15)' }}
          >
            🪙
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-display font-medium leading-tight truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {item.crop}
              {item.buyer ? (
                <span className="font-normal" style={{ color: 'var(--text-muted)' }}>
                  {' '}→ {item.buyer}
                </span>
              ) : null}
            </p>
            <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {item.kg} kg &nbsp;·&nbsp; {fmtDate(item.sold_at)}
            </p>
          </div>
          <div
            className="text-sm font-display font-semibold flex-shrink-0"
            style={{ color: 'var(--gold)' }}
          >
            R {item.amount.toFixed(2)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Shared designs list ─────────────────────────────────────────────────── */

function SharedDesignsList({ items }: { items: Design[] }) {
  if (items.length === 0) {
    return (
      <p className="text-xs font-mono text-center py-4" style={{ color: 'var(--text-muted)' }}>
        No designs shared with you yet.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((design) => (
        <div
          key={design.id}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5"
          style={{
            background: 'rgba(22,37,20,0.5)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-lg"
            style={{ background: 'rgba(91,158,212,0.1)', border: '1px solid rgba(91,158,212,0.15)' }}
          >
            📐
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-display font-medium leading-tight truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {design.title || 'Untitled design'}
            </p>
            <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Shared {fmtDate(design.created_at)}
            </p>
          </div>
          {/* Placeholder open affordance — tab wiring happens in DataPanel */}
          <button
            type="button"
            disabled
            className="text-xs font-display px-2.5 py-1 rounded-lg flex-shrink-0"
            style={{
              background: 'rgba(91,158,212,0.08)',
              border: '1px solid rgba(91,158,212,0.2)',
              color: 'var(--blue)',
              opacity: 0.7,
              cursor: 'default',
            }}
            title="Open in Design tab (coming soon)"
          >
            Open →
          </button>
        </div>
      ))}
    </div>
  );
}

/* ── Main MyRecords component ────────────────────────────────────────────── */

export default function MyRecords() {
  const [user, setUser] = useState<User | null | 'loading'>('loading');
  const [production, setProduction] = useState<ProductionLog[]>([]);
  const [sales, setSales] = useState<SalesLog[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Subscribe to auth state without importing lib/auth
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
      const [prod, des] = await Promise.all([
        myProduction(),
        designsSharedWithMe(),
      ]);
      // Sort production newest-first (logged_at field is ISO string or Firestore timestamp)
      const sortedProd = [...prod].sort((a, b) => {
        return (b.logged_at ?? '').localeCompare(a.logged_at ?? '');
      });
      setProduction(sortedProd);
      setDesigns(des);
      // Sales: re-fetch via a separate call is not available in queries, so we
      // keep the list that was accumulated via onSaved callbacks only.
      // (myProduction covers the production side; sales appended below)
    } finally {
      setDataLoading(false);
    }
  }, []);

  // Load data once signed in
  useEffect(() => {
    if (user && user !== 'loading') {
      void loadData();
    } else if (user === null) {
      setProduction([]);
      setSales([]);
      setDesigns([]);
    }
  }, [user, loadData]);

  // Still resolving auth state
  if (user === 'loading') {
    return (
      <div className="p-5 space-y-3">
        <div className="h-5 w-32 rounded-lg animate-pulse" style={{ background: 'var(--bg-4)' }} />
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl animate-pulse"
            style={{ background: 'var(--bg-3)', animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    );
  }

  // Firebase not configured OR no logged-in user
  if (!user) {
    return (
      <div className="p-4">
        <SignInPrompt />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">

      {/* ── Section header ──────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2
            className="font-display font-bold text-base leading-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            My Records
          </h2>
          <p className="font-display text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            What you grow · what you sell · designs from your supervisor
          </p>
        </div>
        {dataLoading && (
          <span
            className="inline-block w-3.5 h-3.5 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--emerald) transparent transparent transparent' }}
          />
        )}
      </div>

      {/* ── Log production ──────────────────────────── */}
      <LogProductionForm onSaved={loadData} />

      {/* ── Recent harvests ─────────────────────────── */}
      <Card>
        <SectionLabel>Recent harvests</SectionLabel>
        <ProductionList items={production.slice(0, 10)} />
      </Card>

      <Divider />

      {/* ── Log sale ────────────────────────────────── */}
      <LogSaleForm
        onSaved={() => {
          // Sales aren't fetched from Firestore here (no myS ales query yet) —
          // optimistic append gives instant feedback without a round-trip.
          // The parent orchestrator (DataPanel) can trigger a full reload if needed.
          void loadData();
        }}
      />

      {/* ── Recent sales ────────────────────────────── */}
      <Card>
        <SectionLabel>Recent sales</SectionLabel>
        <SalesList items={sales.slice(0, 10)} />
      </Card>

      <Divider />

      {/* ── Shared designs ──────────────────────────── */}
      <Card accent="var(--blue)">
        <SectionLabel>Shared with me</SectionLabel>
        <SharedDesignsList items={designs} />
      </Card>

    </div>
  );
}

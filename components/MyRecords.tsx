'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebase } from '@/lib/firebase/init';
import { useLanguage } from '@/lib/i18n';
import {
  myProduction,
  mySales,
  addProduction,
  addSale,
  designsSharedWithMe,
  uploadPhoto,
} from '@/lib/db/queries';
import {
  Sprout,
  ArrowRight,
  Camera,
  X,
  Loader2,
  Star,
  Leaf,
  Banknote,
  Ruler,
} from 'lucide-react';
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
      className="text-xs font-sans font-semibold uppercase tracking-wide mb-2"
      style={{ color: '#5C5040' }}
    >
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="block text-xs font-sans font-semibold uppercase tracking-wide mb-1"
      style={{ color: '#5C5040' }}
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
        background: '#FFFEFA',
        border: '1px solid #E2D8C4',
        color: '#20190F',
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
  const { t } = useLanguage();
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-2 rounded-xl text-xs font-display font-semibold flex items-center justify-center gap-2 transition-all"
      style={{
        background: loading
          ? 'rgba(31,77,43,0.06)'
          : 'rgba(31,77,43,0.14)',
        border: '1px solid rgba(31,77,43,0.28)',
        color: loading ? '#9A8268' : '#1F4D2B',
        cursor: loading ? 'not-allowed' : 'pointer',
      }}
    >
      {loading ? (
        <>
          <Loader2 size={14} className="animate-spin" style={{ color: '#1F4D2B' }} />
          {t('myRecordsSaving')}
        </>
      ) : (
        children
      )}
    </button>
  );
}

function Divider() {
  return <div className="h-px my-4" style={{ background: '#E2D8C4' }} />;
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
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 px-6 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{
          background: 'rgba(31,77,43,0.10)',
          border: '1px solid rgba(31,77,43,0.25)',
        }}
      >
        <Sprout size={28} style={{ color: '#1F4D2B' }} />
      </div>
      <div>
        <p
          className="font-display font-semibold text-base mb-1"
          style={{ color: '#20190F' }}
        >
          {t('myRecordsSignInTitle')}
        </p>
        <p className="font-display text-xs leading-relaxed" style={{ color: '#9A8268' }}>
          {t('myRecordsSignInBody')}
        </p>
      </div>
      <a
        href="/login"
        className="px-5 py-2 rounded-xl text-sm font-display font-semibold transition-all flex items-center gap-1.5"
        style={{
          background: 'rgba(31,77,43,0.14)',
          border: '1px solid rgba(31,77,43,0.35)',
          color: '#1F4D2B',
        }}
      >
        {t('myRecordsSignInButton')} <ArrowRight size={16} />
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
  const { t } = useLanguage();
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
    setForm((f) => {
      if (f.photoPreview) URL.revokeObjectURL(f.photoPreview);
      return {
        ...f,
        photoFile: file,
        photoPreview: URL.createObjectURL(file),
      };
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const crop = form.crop.trim();
    const kg = parseFloat(form.kg);
    if (!crop || isNaN(kg) || kg <= 0) {
      setForm((f) => ({ ...f, error: t('myRecordsProdValidationError') }));
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
      setForm((f) => {
        if (f.photoPreview) URL.revokeObjectURL(f.photoPreview);
        return {
          crop: '',
          kg: '',
          photoFile: null,
          photoPreview: '',
          loading: false,
          error: '',
        };
      });
      if (fileRef.current) fileRef.current.value = '';
      onSaved();
    } catch {
      setForm((f) => ({ ...f, loading: false, error: t('myRecordsSaveError') }));
    }
  }

  return (
    <Card accent="#1F4D2B">
      <SectionLabel>{t('myRecordsLogProductionHeader')}</SectionLabel>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <FieldLabel>{t('myRecordsCropLabel')}</FieldLabel>
          <Input
            type="text"
            placeholder={t('myRecordsCropPlaceholder')}
            value={form.crop}
            onChange={(e) => setForm((f) => ({ ...f, crop: e.target.value }))}
          />
        </div>
        <div>
          <FieldLabel>{t('myRecordsKgHarvestedLabel')}</FieldLabel>
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
          <FieldLabel>{t('myRecordsPhotoLabel')}</FieldLabel>
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
                  setForm((f) => {
                    if (f.photoPreview) URL.revokeObjectURL(f.photoPreview);
                    return { ...f, photoFile: null, photoPreview: '' };
                  });
                  if (fileRef.current) fileRef.current.value = '';
                }}
                className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono"
                style={{ background: 'rgba(31,25,15,0.12)', color: '#20190F' }}
              >
                <X size={14} />
              </button>
            </div>
          )}
          <label
            className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg text-xs font-display transition-all"
            style={{
              background: '#FFFEFA',
              border: '1px dashed #E2D8C4',
              color: '#9A8268',
            }}
          >
            <Camera size={16} style={{ color: '#9A8268' }} />
            <span>{form.photoFile ? form.photoFile.name : t('myRecordsChoosePhoto')}</span>
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
          <p className="text-xs font-mono" style={{ color: '#C0531E' }}>
            {form.error}
          </p>
        )}
        <SubmitBtn loading={form.loading}><Star size={14} /> {t('myRecordsSaveHarvest')}</SubmitBtn>
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
  const { t } = useLanguage();
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
        error: t('myRecordsSaleValidationError'),
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
      setForm((f) => ({ ...f, loading: false, error: t('myRecordsSaveError') }));
    }
  }

  return (
    <Card accent="#9E5C08">
      <SectionLabel>{t('myRecordsLogSaleHeader')}</SectionLabel>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>{t('myRecordsCropLabel')}</FieldLabel>
            <Input
              type="text"
              placeholder={t('myRecordsCropSalePlaceholder')}
              value={form.crop}
              onChange={(e) => setForm((f) => ({ ...f, crop: e.target.value }))}
            />
          </div>
          <div>
            <FieldLabel>{t('myRecordsKgSoldLabel')}</FieldLabel>
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
            <FieldLabel>{t('myRecordsAmountLabel')}</FieldLabel>
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
            <FieldLabel>{t('myRecordsBuyerLabel')}</FieldLabel>
            <Input
              type="text"
              placeholder={t('myRecordsBuyerPlaceholder')}
              value={form.buyer}
              onChange={(e) => setForm((f) => ({ ...f, buyer: e.target.value }))}
            />
          </div>
        </div>
        {form.error && (
          <p className="text-xs font-mono" style={{ color: '#C0531E' }}>
            {form.error}
          </p>
        )}
        <SubmitBtn loading={form.loading}><Star size={14} /> {t('myRecordsSaveSale')}</SubmitBtn>
      </form>
    </Card>
  );
}

/* ── Production list ─────────────────────────────────────────────────────── */

function ProductionList({ items }: { items: ProductionLog[] }) {
  const { t } = useLanguage();
  if (items.length === 0) {
    return (
      <p className="text-xs font-mono text-center py-4" style={{ color: '#9A8268' }}>
        {t('myRecordsNoHarvests')}
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
            background: '#FFFEFA',
            border: '1px solid #E2D8C4',
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
              className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
              style={{ background: 'rgba(31,77,43,0.10)', border: '1px solid rgba(31,77,43,0.15)' }}
            >
              <Leaf size={18} style={{ color: '#1F4D2B' }} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-display font-medium leading-tight truncate"
              style={{ color: '#20190F' }}
            >
              {item.crop}
            </p>
            <p className="text-xs font-mono mt-0.5" style={{ color: '#9A8268' }}>
              {fmtDate(item.logged_at)}
            </p>
          </div>
          <div
            className="text-sm font-display font-semibold flex-shrink-0"
            style={{ color: '#1F4D2B' }}
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
  const { t } = useLanguage();
  if (items.length === 0) {
    return (
      <p className="text-xs font-mono text-center py-4" style={{ color: '#9A8268' }}>
        {t('myRecordsNoSales')}
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
            background: '#FFFEFA',
            border: '1px solid #E2D8C4',
          }}
        >
          <div
            className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
            style={{ background: 'rgba(158,92,8,0.10)', border: '1px solid rgba(158,92,8,0.15)' }}
          >
            <Banknote size={18} style={{ color: '#9E5C08' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-display font-medium leading-tight truncate"
              style={{ color: '#20190F' }}
            >
              {item.crop}
              {item.buyer ? (
                <span className="font-normal" style={{ color: '#9A8268' }}>
                  {' '}→ {item.buyer}
                </span>
              ) : null}
            </p>
            <p className="text-xs font-mono mt-0.5" style={{ color: '#9A8268' }}>
              {item.kg} kg &nbsp;·&nbsp; {fmtDate(item.sold_at)}
            </p>
          </div>
          <div
            className="text-sm font-display font-semibold flex-shrink-0"
            style={{ color: '#9E5C08' }}
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
  const { t } = useLanguage();
  if (items.length === 0) {
    return (
      <p className="text-xs font-mono text-center py-4" style={{ color: '#9A8268' }}>
        {t('myRecordsNoDesigns')}
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
            background: '#FFFEFA',
            border: '1px solid #E2D8C4',
          }}
        >
          <div
            className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
            style={{ background: 'rgba(47,111,158,0.10)', border: '1px solid rgba(47,111,158,0.15)' }}
          >
            <Ruler size={18} style={{ color: '#2F6F9E' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-display font-medium leading-tight truncate"
              style={{ color: '#20190F' }}
            >
              {design.title || t('myRecordsUntitledDesign')}
            </p>
            <p className="text-xs font-mono mt-0.5" style={{ color: '#9A8268' }}>
              {t('myRecordsSharedPrefix')} {fmtDate(design.created_at)}
            </p>
          </div>
          <Link
            href="/farmer?panel=Design"
            className="text-xs font-display px-2.5 py-1 rounded-lg flex-shrink-0 flex items-center gap-1"
            style={{
              background: 'rgba(47,111,158,0.08)',
              border: '1px solid rgba(47,111,158,0.2)',
              color: '#2F6F9E',
              textDecoration: 'none',
            }}
          >
            {t('myRecordsOpenButton')} <ArrowRight size={14} />
          </Link>
        </div>
      ))}
    </div>
  );
}

/* ── Main MyRecords component ────────────────────────────────────────────── */

export default function MyRecords() {
  const { t } = useLanguage();
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

  const loadData = useCallback(async (isCancelled?: () => boolean) => {
    setDataLoading(true);
    try {
      const [prod, saleRows, des] = await Promise.all([
        myProduction(),
        mySales(),
        designsSharedWithMe(),
      ]);
      if (isCancelled?.()) return;
      // Sort production newest-first (logged_at field is ISO string or Firestore timestamp)
      const sortedProd = [...prod].sort((a, b) => {
        return (b.logged_at ?? '').localeCompare(a.logged_at ?? '');
      });
      setProduction(sortedProd);
      setSales([...saleRows].sort((a, b) => (b.sold_at ?? '').localeCompare(a.sold_at ?? '')));
      setDesigns(des);
    } finally {
      if (!isCancelled?.()) setDataLoading(false);
    }
  }, []);

  // Load data once signed in
  useEffect(() => {
    let cancelled = false;
    if (user && user !== 'loading') {
      void loadData(() => cancelled);
    } else if (user === null) {
      setProduction([]);
      setSales([]);
      setDesigns([]);
    }
    return () => { cancelled = true; };
  }, [user, loadData]);

  // Still resolving auth state
  if (user === 'loading') {
    return (
      <div className="p-5 space-y-3">
        <div className="h-5 w-32 rounded-lg animate-pulse" style={{ background: '#E2D8CB' }} />
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl animate-pulse"
            style={{ background: '#EDE7DB', animationDelay: `${i * 80}ms` }}
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
            style={{ color: '#20190F' }}
          >
            {t('myRecordsTitle')}
          </h2>
          <p className="font-display text-xs mt-0.5" style={{ color: '#9A8268' }}>
            {t('myRecordsSubtitle')}
          </p>
        </div>
        {dataLoading && (
          <Loader2 size={16} className="animate-spin" style={{ color: '#1F4D2B' }} />
        )}
      </div>

      {/* ── Log production ──────────────────────────── */}
      <LogProductionForm onSaved={loadData} />

      {/* ── Harvest summary ─────────────────────────── */}
      {production.length > 0 && (() => {
        const totalKg = production.reduce((s, p) => s + (p.kg ?? 0), 0);
        const byCrop: Record<string, number> = {};
        production.forEach((p) => { byCrop[p.crop] = (byCrop[p.crop] ?? 0) + (p.kg ?? 0); });
        const topCrop = Object.entries(byCrop).sort((a, b) => b[1] - a[1])[0];
        const recent = production.slice(0, 12);
        const maxKg = Math.max(...recent.map((p) => p.kg ?? 0), 1);
        const W = 180; const H = 36; const pts = recent.map((p, i) => {
          const x = (i / Math.max(recent.length - 1, 1)) * W;
          const y = H - ((p.kg ?? 0) / maxKg) * H;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
        return (
          <Card>
            <div className="flex items-center justify-between gap-4 mb-3">
              <div>
                <div className="font-display font-bold" style={{ fontSize: 22, color: '#1F4D2B', lineHeight: 1 }}>
                  {totalKg % 1 === 0 ? totalKg : totalKg.toFixed(1)} kg
                </div>
                <div className="font-sans text-xs mt-0.5" style={{ color: '#8C7A62' }}>
                  {t('myRecordsTotalHarvested')}{topCrop ? ` · ${topCrop[0]} ${t('myRecordsTopsLabel')}` : ''}
                </div>
              </div>
              <svg width={W} height={H} style={{ overflow: 'visible', flexShrink: 0 }}>
                <polyline points={pts} fill="none" stroke="rgba(31,77,43,0.25)" strokeWidth="1.5" strokeLinejoin="round" />
                <polyline points={pts} fill="none" stroke="#1F4D2B" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="3 2" />
                {recent.map((p, i) => {
                  const x = (i / Math.max(recent.length - 1, 1)) * W;
                  const y = H - ((p.kg ?? 0) / maxKg) * H;
                  return <circle key={i} cx={x} cy={y} r="2.5" fill="#1F4D2B" />;
                })}
              </svg>
            </div>
          </Card>
        );
      })()}

      {/* ── Recent harvests ─────────────────────────── */}
      <Card>
        <SectionLabel>{t('myRecordsRecentHarvests')}</SectionLabel>
        <ProductionList items={production.slice(0, 10)} />
      </Card>

      <Divider />

      {/* ── Log sale ────────────────────────────────── */}
      <LogSaleForm
        onSaved={() => { void loadData(); }}
      />

      {/* ── Sales summary ────────────────────────────── */}
      {sales.length > 0 && (() => {
        const totalRev = sales.reduce((s, p) => s + (p.amount ?? 0), 0);
        const totalKgSold = sales.reduce((s, p) => s + (p.kg ?? 0), 0);
        const recent = sales.slice(0, 12);
        const maxAmt = Math.max(...recent.map((p) => p.amount ?? 0), 1);
        const W = 180; const H = 36;
        const pts = recent.map((p, i) => {
          const x = (i / Math.max(recent.length - 1, 1)) * W;
          const y = H - ((p.amount ?? 0) / maxAmt) * H;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
        return (
          <Card>
            <div className="flex items-center justify-between gap-4 mb-3">
              <div>
                <div className="font-display font-bold" style={{ fontSize: 22, color: '#C07A1E', lineHeight: 1 }}>
                  R{totalRev % 1 === 0 ? totalRev : totalRev.toFixed(2)}
                </div>
                <div className="font-sans text-xs mt-0.5" style={{ color: '#8C7A62' }}>
                  {t('myRecordsTotalRevenue')} · {totalKgSold % 1 === 0 ? totalKgSold : totalKgSold.toFixed(1)} {t('myRecordsKgSoldSuffix')}
                </div>
              </div>
              <svg width={W} height={H} style={{ overflow: 'visible', flexShrink: 0 }}>
                <polyline points={pts} fill="none" stroke="rgba(192,122,30,0.25)" strokeWidth="1.5" strokeLinejoin="round" />
                <polyline points={pts} fill="none" stroke="#C07A1E" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="3 2" />
                {recent.map((p, i) => {
                  const x = (i / Math.max(recent.length - 1, 1)) * W;
                  const y = H - ((p.amount ?? 0) / maxAmt) * H;
                  return <circle key={i} cx={x} cy={y} r="2.5" fill="#C07A1E" />;
                })}
              </svg>
            </div>
          </Card>
        );
      })()}

      {/* ── Recent sales ────────────────────────────── */}
      <Card>
        <SectionLabel>{t('myRecordsSalesHeader')}</SectionLabel>
        <SalesList items={sales.slice(0, 10)} />
      </Card>

      <Divider />

      {/* ── Shared designs ──────────────────────────── */}
      <Card accent="#2F6F9E">
        <SectionLabel>{t('myRecordsSharedWithMe')}</SectionLabel>
        <SharedDesignsList items={designs} />
      </Card>

    </div>
  );
}

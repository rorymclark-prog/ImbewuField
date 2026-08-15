'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebase } from '@/lib/firebase/init';
import { useLanguage } from '@/lib/i18n';
import {
  myProduction,
  mySales,
  myExpenses,
  addProduction,
  addSale,
  designsSharedWithMe,
  uploadPhoto,
  getMyProfile,
  WriteTimeoutError,
} from '@/lib/db/queries';
import { isSampleMode } from '@/lib/sample-mode';
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
  Landmark,
} from 'lucide-react';
import type { ProductionLog, SalesLog, ExpenseLog, Design, Profile } from '@/lib/db/types';
import CropSelect from '@/components/CropSelect';
import { loadCropPriceOverrides, priceFor, type CropPrice } from '@/lib/crop-prices';
import { creditPackHasAnyRecords } from '@/lib/credit-pack';
import {
  buildCreditPackPdf,
  deliverCreditPackPdf,
  creditPackPdfFilename,
  CreditPackSampleModeError,
} from '@/lib/credit-pack-pdf';

// Shown when addProduction/addSale (lib/db/queries.ts) time out waiting for the server — see the
// WriteTimeoutError comment there. Deliberately NOT run through t(): this repo never invents
// isiZulu (or any other) translation, and translate()'s fallback would silently show the same
// English everywhere anyway, so a hardcoded string is the honest version of the same outcome
// (this file already hardcodes other English-only copy, e.g. the guide-price note below).
// Worded from the SAME navigator.onLine signal app/finances/page.tsx's offline banner reads —
// not a second offline mechanism, just read at submit time instead of kept in state.
const SAVE_QUEUED_OFFLINE =
  "You're offline. This is saved on your phone and will reach the cloud the moment you have signal again.";
const SAVE_QUEUED_TIMEOUT =
  'Your connection dropped mid-save. Nothing is lost — this is saved on your phone and will finish sending on its own.';
function saveQueuedMessage(): string {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return offline ? SAVE_QUEUED_OFFLINE : SAVE_QUEUED_TIMEOUT;
}

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
  cropKey: string | null;
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
    cropKey: null,
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
          cropKey: null,
          kg: '',
          photoFile: null,
          photoPreview: '',
          loading: false,
          error: '',
        };
      });
      if (fileRef.current) fileRef.current.value = '';
      onSaved();
    } catch (err) {
      if (err instanceof WriteTimeoutError) {
        // addProduction gave up waiting for the server to confirm, but persistentLocalCache
        // (lib/firebase/init.ts) means the harvest is already durably saved on this phone and
        // Firestore is still trying to send it in the background — it is NOT lost. Clear the
        // fields (not just the spinner) so re-reading this message and tapping Save again can't
        // log the same harvest twice.
        setForm((f) => {
          if (f.photoPreview) URL.revokeObjectURL(f.photoPreview);
          return {
            crop: '',
            cropKey: null,
            kg: '',
            photoFile: null,
            photoPreview: '',
            loading: false,
            error: saveQueuedMessage(),
          };
        });
        if (fileRef.current) fileRef.current.value = '';
        onSaved();
        return;
      }
      setForm((f) => ({ ...f, loading: false, error: t('myRecordsSaveError') }));
    }
  }

  return (
    <Card accent="#1F4D2B">
      <SectionLabel>{t('myRecordsLogProductionHeader')}</SectionLabel>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <FieldLabel>{t('myRecordsCropLabel')}</FieldLabel>
          <CropSelect
            ariaLabel={t('myRecordsCropLabel')}
            value={form.crop}
            onChange={(crop, cropKey) => setForm((f) => ({ ...f, crop, cropKey }))}
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
  cropKey: string | null;
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
    cropKey: null,
    kg: '',
    amount: '',
    buyer: '',
    loading: false,
    error: '',
  });
  const [priceOverrides, setPriceOverrides] = useState<Record<string, CropPrice>>({});

  useEffect(() => setPriceOverrides(loadCropPriceOverrides()), []);

  const guide = form.cropKey ? priceFor(form.cropKey, priceOverrides) : null;
  const saleKg = parseFloat(form.kg);
  const guideLow = guide ? Math.min(guide.wholesalePerKg, guide.retailPerKg) : null;
  const guideHigh = guide ? Math.max(guide.wholesalePerKg, guide.retailPerKg) : null;

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
      setForm({ crop: '', cropKey: null, kg: '', amount: '', buyer: '', loading: false, error: '' });
      onSaved();
    } catch (err) {
      if (err instanceof WriteTimeoutError) {
        // addSale gave up waiting for the server to confirm, but persistentLocalCache
        // (lib/firebase/init.ts) means the sale is already durably saved on this phone and
        // Firestore is still trying to send it in the background — it is NOT lost. Clear the
        // fields (not just the spinner) so re-reading this message and tapping Save again can't
        // log the same sale twice.
        setForm({
          crop: '', cropKey: null, kg: '', amount: '', buyer: '',
          loading: false,
          error: saveQueuedMessage(),
        });
        onSaved();
        return;
      }
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
            <CropSelect
              ariaLabel={t('myRecordsCropLabel')}
              value={form.crop}
              onChange={(crop, cropKey) => setForm((f) => ({ ...f, crop, cropKey }))}
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
        {form.crop && (
          <div
            className="rounded-lg px-3 py-2 text-xs font-sans leading-relaxed"
            style={{ background: '#F7F2E9', border: '1px solid #E2D8C4', color: '#5C5040' }}
          >
            {guide && guideLow !== null && guideHigh !== null ? (
              <>
                <strong style={{ color: '#20190F' }}>Guide price, July 2026:</strong>{' '}
                shops about R{guide.wholesalePerKg}/kg · direct/farm gate about R{guide.retailPerKg}/kg.
                {Number.isFinite(saleKg) && saleKg > 0 && (
                  <> For {saleKg} kg, that is roughly R{(guideLow * saleKg).toFixed(2)}–R{(guideHigh * saleKg).toFixed(2)}.</>
                )}{' '}
                {guide.confidence === 'estimated'
                  ? 'Estimated guide — confirm the local price.'
                  : 'Sourced guide — enter the price you actually agreed.'}
              </>
            ) : (
              <>No trustworthy guide price is stored for this crop. Enter the price you actually agreed.</>
            )}
          </div>
        )}
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

/* ── Records for a lender ─────────────────────────────────────────────────── */
//
// Text here is deliberately NOT run through t() — same rule the exported PDF follows and the one
// tests/design-studio-i18n.test.ts enforces for anything painted onto an exported document: a file
// a farmer hands to someone else must not change wording with whatever language the app happened
// to be set to. See lib/credit-pack-pdf.ts for the document itself.

function CreditPackCard({
  production,
  sales,
  expenses,
  profile,
}: {
  production: ProductionLog[];
  sales: SalesLog[];
  expenses: ExpenseLog[];
  profile: Profile | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const sampling = isSampleMode();
  const ready = creditPackHasAnyRecords(production, sales, expenses);

  async function handleExport() {
    setError('');
    setLoading(true);
    try {
      const farmer = {
        name: profile?.full_name?.trim() || null,
        farmName: profile?.farm_name?.trim() || null,
        phone: profile?.phone?.trim() || null,
      };
      const blob = await buildCreditPackPdf({ farmer, production, sales, expenses });
      await deliverCreditPackPdf(blob, creditPackPdfFilename(farmer.farmName ?? farmer.name));
    } catch (err) {
      setError(
        err instanceof CreditPackSampleModeError
          ? err.message
          : 'Could not build the document. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card accent="#2E6B3A">
      <div className="flex items-start gap-3 mb-2">
        <div
          className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center"
          style={{ background: 'rgba(46,107,58,0.10)', border: '1px solid rgba(46,107,58,0.18)' }}
        >
          <Landmark size={18} style={{ color: '#2E6B3A' }} />
        </div>
        <div>
          <p className="text-sm font-display font-semibold" style={{ color: '#20190F' }}>
            Records for a lender
          </p>
          <p className="text-xs font-sans mt-0.5 leading-relaxed" style={{ color: '#8C7A62' }}>
            A summary of your logged harvests, sales and costs — income consistency, cash flow and
            a track record, built only from what you have entered. Material for a conversation with
            a lender, not a credit score or a loan approval.
          </p>
        </div>
      </div>

      {sampling ? (
        <p className="text-xs font-sans rounded-lg px-3 py-2" style={{ background: '#F7F2E9', color: '#9A8268', border: '1px solid #E2D8C4' }}>
          This export is turned off while you are viewing the sample farm. Sign in and turn off the
          sample to export your own records.
        </p>
      ) : !ready ? (
        <p className="text-xs font-sans rounded-lg px-3 py-2" style={{ background: '#F7F2E9', color: '#9A8268', border: '1px solid #E2D8C4' }}>
          Log at least one harvest, sale or cost first — there is nothing to summarise yet.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => { void handleExport(); }}
          disabled={loading}
          className="w-full py-2 rounded-xl text-xs font-display font-semibold flex items-center justify-center gap-2 transition-all"
          style={{
            background: loading ? 'rgba(46,107,58,0.06)' : 'rgba(46,107,58,0.14)',
            border: '1px solid rgba(46,107,58,0.32)',
            color: loading ? '#9A8268' : '#2E6B3A',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" style={{ color: '#2E6B3A' }} />
              Building document…
            </>
          ) : (
            <>
              <Landmark size={14} /> Export records for a lender
            </>
          )}
        </button>
      )}

      {error && (
        <p className="text-xs font-mono mt-2" style={{ color: '#C0531E' }}>
          {error}
        </p>
      )}
    </Card>
  );
}

/* ── Main MyRecords component ────────────────────────────────────────────── */

export default function MyRecords() {
  const { t } = useLanguage();
  const [user, setUser] = useState<User | null | 'loading'>('loading');
  const [production, setProduction] = useState<ProductionLog[]>([]);
  const [sales, setSales] = useState<SalesLog[]>([]);
  const [expenses, setExpenses] = useState<ExpenseLog[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  /**
   * Same bug app/finances/page.tsx already found and fixed: an empty ledger and an unreachable
   * one used to render identically — "No harvests logged yet" whether she had genuinely never
   * logged one, or the read had just failed offline. Promise.all made it worse here than there,
   * since one rejected read (e.g. production_logs offline) threw before any of setProduction/
   * setSales/setDesigns ran, silently keeping ALL THREE lists at their empty initial state.
   */
  const [loadError, setLoadError] = useState(false);

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
      // allSettled, NOT all: one failing read must not blank every list — a farmer whose sales
      // read fine should still see them even if production_logs failed. Each stream degrades to
      // its previous value alone; loadError drives the honest banner below. Profile is excluded
      // from that banner (and from this comment's "ledger" reasoning) — it only prefills the
      // Credit Pack PDF's seller fields, which already tolerate a null profile.
      const [prodResult, saleResult, expenseResult, designResult, profileResult] = await Promise.allSettled([
        myProduction(),
        mySales(),
        myExpenses(),
        designsSharedWithMe(),
        getMyProfile(),
      ]);
      if (isCancelled?.()) return;
      if (prodResult.status === 'rejected') console.error('[myrecords] production read failed:', prodResult.reason);
      if (saleResult.status === 'rejected') console.error('[myrecords] sales read failed:', saleResult.reason);
      if (expenseResult.status === 'rejected') console.error('[myrecords] expenses read failed:', expenseResult.reason);
      if (designResult.status === 'rejected') console.error('[myrecords] designs read failed:', designResult.reason);
      if (profileResult.status === 'rejected') console.error('[myrecords] profile read failed:', profileResult.reason);
      setLoadError(
        prodResult.status === 'rejected' ||
          saleResult.status === 'rejected' ||
          expenseResult.status === 'rejected' ||
          designResult.status === 'rejected',
      );
      if (prodResult.status === 'fulfilled') {
        // Sort production newest-first (logged_at field is ISO string or Firestore timestamp)
        const sortedProd = [...prodResult.value].sort((a, b) => {
          return (b.logged_at ?? '').localeCompare(a.logged_at ?? '');
        });
        setProduction(sortedProd);
      }
      if (saleResult.status === 'fulfilled') {
        setSales([...saleResult.value].sort((a, b) => (b.sold_at ?? '').localeCompare(a.sold_at ?? '')));
      }
      if (expenseResult.status === 'fulfilled') setExpenses(expenseResult.value);
      if (designResult.status === 'fulfilled') setDesigns(designResult.value);
      if (profileResult.status === 'fulfilled') setProfile(profileResult.value);
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
      setExpenses([]);
      setDesigns([]);
      setProfile(null);
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

      {/* ── Load error banner ───────────────────────── */}
      {loadError && !dataLoading && (
        <div
          className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5"
          style={{ background: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.25)' }}
        >
          <span className="font-sans" style={{ fontSize: 12.5, color: '#8B2020' }}>
            {t('myRecordsLoadError')}
          </span>
          <button
            type="button"
            onClick={() => { void loadData(); }}
            className="font-sans font-semibold flex-shrink-0"
            style={{ fontSize: 12, color: '#1F4D2B', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {t('myRecordsRetry')}
          </button>
        </div>
      )}

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

      {/* ── Records for a lender ─────────────────────── */}
      <CreditPackCard production={production} sales={sales} expenses={expenses} profile={profile} />

      <Divider />

      {/* ── Shared designs ──────────────────────────── */}
      <Card accent="#2F6F9E">
        <SectionLabel>{t('myRecordsSharedWithMe')}</SectionLabel>
        <SharedDesignsList items={designs} />
      </Card>

    </div>
  );
}

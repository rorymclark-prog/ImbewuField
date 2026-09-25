'use client';

import { numberLabel } from '@/lib/format-figures';
import { sampleProducePhoto } from '@/lib/sample-media';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  Sparkles,
  Trees,
  Eye,
  FileText,
} from 'lucide-react';
import type { ProductionLog, SalesLog, ExpenseLog, Design, Profile } from '@/lib/db/types';
import CropSelect from '@/components/CropSelect';
import CropIcon from '@/components/CropIcon';
import { buildCropAliasIndex, cropIdentityOf } from '@/lib/crop-identity';
import { getCropArt } from '@/lib/crop-art';
import { loadCropPriceOverrides, priceFor, type CropPrice } from '@/lib/crop-prices';
import { parseDecimalInput } from '@/lib/decimal-input';
import { loadInvoices, type SavedInvoice } from '@/lib/invoices';
import { cashIncomeTotal } from '@/lib/invoice-sales';
import { creditPackHasAnyRecords, buildMonthlyCashFlow } from '@/lib/credit-pack';
import {
  countsWithScope,
  loadIncludePerennials,
  saveIncludePerennials,
  DEFAULT_INCLUDE_PERENNIALS,
} from '@/lib/produce-scope';
import { produceDisplayName } from '@/lib/perennial-produce';
import {
  buildCreditPackPdf,
  buildCreditPackPreviewPdf,
  deliverCreditPackPdf,
  creditPackPdfFilename,
  CreditPackSampleModeError,
} from '@/lib/credit-pack-pdf';

function recordsUi(lang: string, english: string, isiZulu: string, paired = false): string {
  if (lang !== 'zu') return english;
  return paired ? `${english} — ${isiZulu}` : isiZulu;
}

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
          ? { background: 'var(--color-surface)', color: 'var(--color-ink)', borderLeftWidth: 2, borderLeftColor: accent, borderLeftStyle: 'solid' }
          : { background: 'var(--color-surface)', color: 'var(--color-ink)' }
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
      style={{ color: 'var(--color-muted-strong)' }}
    >
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="block text-xs font-sans font-semibold uppercase tracking-wide mb-1"
      style={{ color: 'var(--color-muted-strong)' }}
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
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
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
  const { t, lang } = useLanguage();
  return (
    <button
      type="submit"
      disabled={loading}
      // THE PRIMARY ACTION OF THIS FORM, and it looked like the least important thing on the
      // page: a 14%-alpha forest tint that read as a disabled control. CLAUDE.md makes ochre the
      // primary CTA; #9A6018 rather than #C07A1E because white type on #C07A1E is 3.47:1 and on
      // #9A6018 it is 5.17:1. Public Sans, not the display serif — §0 puts buttons in Public
      // Sans, and a serif at 13px with -0.02em tracking is the least legible thing in a form.
      className="w-full py-2.5 rounded-xl font-sans font-bold flex items-center justify-center gap-2 transition-all"
      style={{
        fontSize: 15,
        background: loading ? 'rgba(154,96,24,0.35)' : '#9A6018',
        border: 'none',
        color: '#FFFFFF',
        cursor: loading ? 'not-allowed' : 'pointer',
      }}
    >
      {loading ? (
        <>
          <Loader2 size={14} className="animate-spin" style={{ color: '#FFFFFF' }} />
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
        <Sprout size={28} style={{ color: 'var(--color-forest-800)' }} />
      </div>
      <div>
        <p
          className="font-display font-semibold text-base mb-1"
          style={{ color: 'var(--text-primary)' }}
        >
          {t('myRecordsSignInTitle')}
        </p>
        <p className="font-display text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {t('myRecordsSignInBody')}
        </p>
      </div>
      <a
        href="/login"
        className="px-5 py-2 rounded-xl text-sm font-display font-semibold transition-all flex items-center gap-1.5"
        style={{
          background: 'rgba(31,77,43,0.14)',
          border: '1px solid rgba(31,77,43,0.35)',
          color: 'var(--color-forest-800)',
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
  const { t, lang } = useLanguage();
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
    const kg = parseDecimalInput(form.kg);
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
      <form onSubmit={handleSubmit} className="space-y-3 u-form-column">
        {sampleProducePhoto(form.crop) && <figure className="flex items-center gap-3"><img src={sampleProducePhoto(form.crop)!} alt={form.crop} width={56} height={56} style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} /><figcaption className="text-xs">{recordsUi(lang, 'AI-generated crop reference · add your own harvest photo below.', 'Isithombe sesitshalo esenziwe nge-AI · faka esakho isithombe sesivuno ngezansi.')}</figcaption></figure>}
        <div>
          <FieldLabel>{t('myRecordsCropLabel')}</FieldLabel>
          <CropSelect
            ariaLabel={t('myRecordsCropLabel')}
            language={lang === 'zu' ? 'zu' : 'en'}
            value={form.crop}
            onChange={(crop, cropKey) => setForm((f) => ({ ...f, crop, cropKey }))}
          />
        </div>
        <div>
          <FieldLabel>{t('myRecordsKgHarvestedLabel')}</FieldLabel>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={form.kg}
            onChange={(e) => setForm((f) => ({ ...f, kg: e.target.value }))}
          />
        </div>
        <div>
          <FieldLabel>{t('myRecordsPhotoLabel')}</FieldLabel>
          {form.photoPreview && (
            <div className="mb-2 relative w-full h-24 overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img data-photo-preview
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
                style={{ background: 'rgba(31,25,15,0.12)', color: 'var(--text-primary)' }}
              >
                <X size={14} />
              </button>
            </div>
          )}
          <label
            className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg text-xs font-display transition-all"
            style={{
              background: 'var(--bg-1)',
              border: '1px dashed var(--border)',
              color: 'var(--text-muted)',
            }}
          >
            <Camera size={16} style={{ color: 'var(--text-muted)' }} />
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
          <p className="text-xs font-mono" style={{ color: 'var(--danger)' }}>
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
  enterprise?: SalesLog['enterprise'];
  crop: string;
  cropKey: string | null;
  kg: string;
  amount: string;
  buyer: string;
  loading: boolean;
  error: string;
}

function LogSaleForm({ onSaved }: { onSaved: () => void }) {
  const router = useRouter();
  const { t, lang } = useLanguage();
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
  const saleKg = parseDecimalInput(form.kg);
  const guideLow = guide ? Math.min(guide.wholesalePerKg, guide.retailPerKg) : null;
  const guideHigh = guide ? Math.max(guide.wholesalePerKg, guide.retailPerKg) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const crop = form.crop.trim();
    const kg = parseDecimalInput(form.kg);
    const amount = parseDecimalInput(form.amount);
    if (!crop || isNaN(kg) || kg <= 0 || isNaN(amount) || amount < 0) {
      setForm((f) => ({
        ...f,
        error: t('myRecordsSaleValidationError'),
      }));
      return;
    }
    setForm((f) => ({ ...f, loading: true, error: '' }));
    try {
      const invoice = await addSale({
        enterprise: form.enterprise ?? null,
        crop,
        kg,
        amount,
        buyer: form.buyer.trim() || null,
        sold_at: new Date().toISOString(),
      });
      setForm({ crop: '', cropKey: null, kg: '', amount: '', buyer: '', loading: false, error: '' });
      onSaved();
      router.push(`/invoice?view=${encodeURIComponent(invoice.id)}`);
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
      <form onSubmit={handleSubmit} className="space-y-3 u-form-column">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>{t('myRecordsCropLabel')}</FieldLabel>
            <CropSelect
              ariaLabel={t('myRecordsCropLabel')}
              language={lang === 'zu' ? 'zu' : 'en'}
              value={form.crop}
              onChange={(crop, cropKey) => setForm((f) => ({ ...f, crop, cropKey }))}
            />
          </div>
          <div>
            <FieldLabel>{t('myRecordsKgSoldLabel')}</FieldLabel>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.0"
              value={form.kg}
              onChange={(e) => setForm((f) => ({ ...f, kg: e.target.value }))}
            />
          </div>
        </div>
        {form.crop && (
          <div
            className="rounded-lg px-3 py-2 text-xs font-sans leading-relaxed"
            style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            {guide && guideLow !== null && guideHigh !== null ? (
              <>
                <strong style={{ color: 'var(--text-primary)' }}>{t('myRecordsGuidePriceLabel')}</strong>{' '}
                {t('myRecordsGuidePriceRange')
                  .replace('{wholesale}', String(guide.wholesalePerKg))
                  .replace('{retail}', String(guide.retailPerKg))}
                {Number.isFinite(saleKg) && saleKg > 0 && (
                  <>
                    {' '}
                    {t('myRecordsGuidePriceForKg')
                      .replace('{kg}', String(saleKg))
                      .replace('{low}', (guideLow * saleKg).toFixed(2))
                      .replace('{high}', (guideHigh * saleKg).toFixed(2))}
                  </>
                )}{' '}
                {guide.confidence === 'estimated'
                  ? t('myRecordsGuideEstimated')
                  : t('myRecordsGuideSourced')}
              </>
            ) : (
              <>{t('myRecordsGuideMissing')}</>
            )}
          </div>
        )}
        <label className="block text-sm">{recordsUi(lang, 'Growing area for this sale (optional)', 'Indawo yokulima yalokhu kuthengisa (akuphoqelekile)')}
          <select className="w-full rounded-lg border px-3 py-2 mt-1" value={form.enterprise ?? ''} onChange={e => setForm(f => ({ ...f, enterprise: e.target.value ? e.target.value as SalesLog['enterprise'] : null }))}>
            <option value="">{recordsUi(lang, 'Unassigned', 'Ayikabelwanga')}</option><option value="vegetables">{recordsUi(lang, 'Vegetable beds', 'Imibhede yemifino')}</option><option value="staples">{recordsUi(lang, 'Staple plots', 'Amasimu ezitshalo eziyisisekelo')}</option><option value="other">{recordsUi(lang, 'Orchard / other', 'Ingadi yezihlahla zezithelo / okunye')}</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>{t('myRecordsAmountLabel')}</FieldLabel>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
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
          <p className="text-xs font-mono" style={{ color: 'var(--danger)' }}>
            {form.error}
          </p>
        )}
        <SubmitBtn loading={form.loading}><Star size={14} /> {t('myRecordsSaveSale')}</SubmitBtn>
        <Link href="/invoice" className="block py-2 text-sm underline">{recordsUi(lang, 'Multiple products or payment later? Create an invoice', 'Imikhiqizo eminingi noma ukukhokha kamuva? Dala i-invoyisi', true)}</Link>
      </form>
    </Card>
  );
}

/* ── Example rows for empty lists ─────────────────────────────────────────
   Shown only when a real (non-sample-mode) account's own Production/Sales
   list is genuinely empty. Sample mode never hits this branch: myProduction()
   and mySales() (lib/db/queries.ts) both short-circuit to the populated
   Ubhejane Crèche sandbox (getSandboxProduction/getSandboxSales) whenever
   isSampleMode() is true, so `items` is never empty there — the isSampleMode()
   check below is defence in depth for the one case where it could be (a real
   signed-in account that has ALSO toggled sample mode on).
   Fixture-only display data — never passed to addProduction/addSale — so it
   can never be mistaken for, or accidentally saved as, a real record. */
const EXAMPLE_PRODUCTION = { crop: 'Spinach', dateLabel: '3 days ago', kg: 4 };
const EXAMPLE_SALE = { crop: 'Spinach', buyer: 'Local market', dateLabel: '3 days ago', kg: 4, amount: 120 };

/**
 * The orchard switch, on the Records screen.
 *
 * Same one setting as the Finance screen's graphs — a farmer flicks it in either place and both
 * follow. It is placed on the harvest card because that is where the kilogram total it changes
 * is; a control whose effect you cannot see from where you press it is a bug this codebase has
 * already shipped twice.
 */
function OrchardSwitch({ on, onChange, t }: {
  on: boolean; onChange: (next: boolean) => void; t: (key: string) => string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className="font-sans rounded-full px-2 py-0.5 mt-1.5 inline-flex items-center gap-1"
      style={{
        fontSize: 12,
        fontWeight: on ? 600 : 400,
        border: `1px solid ${on ? '#1F4D2B' : '#E2D8C4'}`,
        background: on ? 'rgba(31,77,43,0.08)' : 'transparent',
        color: on ? '#1F4D2B' : '#755942',
        cursor: 'pointer',
      }}
    >
      <Trees size={11} strokeWidth={on ? 2.2 : 1.6} />
      {t(on ? 'recordsOrchardIn' : 'recordsOrchardOut')}
    </button>
  );
}

/** What the switch left out, named — the condition that makes hiding it honest rather than wrong. */
function OrchardNote({ kg, names, t, money = false }: {
  kg: number; names: string[]; t: (key: string) => string; money?: boolean;
}) {
  const figure = kg % 1 === 0 ? String(kg) : kg.toFixed(1);
  return (
    <p className="font-sans mt-2" style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
      {t(money ? 'recordsOrchardOutNoteMoney' : 'recordsOrchardOutNote')
        .replace('{kg}', figure)
        .replace('{names}', names.join(', '))}
    </p>
  );
}

function ExampleRowsHeading({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-1.5 mb-2 px-0.5"
      style={{ font: '700 10px/1 system-ui, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold)' }}
    >
      <Sparkles size={11} />
      {label}
    </div>
  );
}

function ExampleBadge({ label }: { label: string }) {
  return (
    <span
      className="flex-shrink-0"
      style={{ padding: '3px 7px', borderRadius: 6, background: '#9A6018', color: '#fff', font: '700 9px/1 system-ui, sans-serif', letterSpacing: '0.04em', textTransform: 'uppercase' }}
    >
      {label}
    </span>
  );
}

const harvestArtAliases = buildCropAliasIndex();

function HarvestCropPicture({ name }: { name: string }) {
  // The demo prefix labels fiction; it is not part of the crop's identity.
  const lookup = isSampleMode() ? name.replace(/^Sample\s*[—–-]\s*/i, '') : name;
  const photo = isSampleMode() ? sampleProducePhoto(lookup) : null;
  if (photo) return <img src={photo} alt={`${lookup} · AI-generated reference`} title="AI-generated crop reference, not harvest evidence" width={40} height={40} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8 }} data-photo-preview="true" />;
  const { key } = cropIdentityOf(lookup, harvestArtAliases);
  return key && getCropArt(key)
    ? <CropIcon cropKey={key} icon="🌱" size={32} />
    : <Leaf size={18} style={{ color: 'var(--color-forest-800)' }} />;
}

/* ── Production list ─────────────────────────────────────────────────────── */

function ProductionList({ items }: { items: ProductionLog[] }) {
  const { t } = useLanguage();
  if (items.length === 0) {
    if (isSampleMode()) {
      return (
        <p className="text-xs font-mono text-center py-4" style={{ color: 'var(--text-muted)' }}>
          {t('myRecordsNoHarvests')}
        </p>
      );
    }
    return (
      <div>
        <ExampleRowsHeading label={t('myRecordsExampleHeading')} />
        <div
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 opacity-80"
          style={{ background: 'var(--bg-1)', border: '1.5px dashed #D9CDB4' }}
        >
          <div
            className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
            style={{ background: 'rgba(31,77,43,0.08)', border: '1px dashed rgba(31,77,43,0.25)' }}
          >
            <HarvestCropPicture name={EXAMPLE_PRODUCTION.crop} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-display font-medium leading-tight truncate" style={{ color: 'var(--text-primary)' }}>
              {EXAMPLE_PRODUCTION.crop}
            </p>
            <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>{EXAMPLE_PRODUCTION.dateLabel}</p>
          </div>
          <div className="text-sm font-display font-semibold flex-shrink-0" style={{ color: 'var(--color-forest-800)' }}>
            {EXAMPLE_PRODUCTION.kg} kg
          </div>
          <ExampleBadge label={t('myRecordsExampleBadge')} />
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all"
          style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
          }}
        >
          {item.photo_url ? (
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img data-photo-preview
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
              <HarvestCropPicture name={item.crop} />
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
            style={{ color: 'var(--color-forest-800)' }}
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
  const { t, lang } = useLanguage();
  if (items.length === 0) {
    if (isSampleMode()) {
      return (
        <p className="text-xs font-mono text-center py-4" style={{ color: 'var(--text-muted)' }}>
          {t('myRecordsNoSales')}
        </p>
      );
    }
    return (
      <div>
        <ExampleRowsHeading label={t('myRecordsExampleHeading')} />
        <div
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 opacity-80"
          style={{ background: 'var(--bg-1)', border: '1.5px dashed #D9CDB4' }}
        >
          <div
            className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
            style={{ background: 'rgba(158,92,8,0.08)', border: '1px dashed rgba(158,92,8,0.25)' }}
          >
            <Banknote size={18} style={{ color: 'var(--gold)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-display font-medium leading-tight truncate" style={{ color: 'var(--text-primary)' }}>
              {EXAMPLE_SALE.crop}
              <span className="font-normal" style={{ color: 'var(--text-muted)' }}> → {EXAMPLE_SALE.buyer}</span>
            </p>
            <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {EXAMPLE_SALE.kg} kg &nbsp;·&nbsp; {EXAMPLE_SALE.dateLabel}
            </p>
          </div>
          <div className="text-sm font-display font-semibold flex-shrink-0" style={{ color: 'var(--gold)' }}>
            R {EXAMPLE_SALE.amount.toFixed(2)}
          </div>
          <ExampleBadge label={t('myRecordsExampleBadge')} />
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5"
          style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
            style={{ background: 'rgba(158,92,8,0.10)', border: '1px solid rgba(158,92,8,0.15)' }}
          >
            <Banknote size={18} style={{ color: 'var(--gold)' }} />
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
            {item.invoice_id && loadInvoices().some((invoice) => invoice.id === item.invoice_id) && <Link href={`/invoice?view=${encodeURIComponent(item.invoice_id)}`} aria-label={`${recordsUi(lang, 'View invoice for', 'Buka i-invoyisi ka')} ${item.crop}`} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', minHeight: 44, fontSize: 12, color: '#315939' }}><Eye size={16} />{recordsUi(lang, 'Invoice', 'I-invoyisi')} #{loadInvoices().find((invoice) => invoice.id === item.invoice_id)?.no} · {recordsUi(lang, 'View', 'Buka')}</Link>}
            {(!item.invoice_id || (item.invoice_source_sale && !loadInvoices().some(invoice => invoice.id === item.invoice_id))) && item.kg > 0 && item.amount >= 0 && <Link href={`/invoice?sale=${encodeURIComponent(item.id)}`} aria-label={`${recordsUi(lang, item.invoice_source_sale ? 'Recover invoice for' : 'Create invoice for', item.invoice_source_sale ? 'Buyisa i-invoyisi ka' : 'Dala i-invoyisi ka')} ${item.crop}`} className="inline-flex items-center gap-1.5 text-xs font-semibold min-h-11" style={{ color: '#315939' }}><FileText size={16} />{recordsUi(lang, item.invoice_source_sale ? 'Recover invoice' : 'Create invoice', item.invoice_source_sale ? 'Buyisa i-invoyisi' : 'Dala i-invoyisi')}</Link>}
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
  const { t } = useLanguage();
  if (items.length === 0) {
    return (
      <p className="text-xs font-mono text-center py-4" style={{ color: 'var(--text-muted)' }}>
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
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
            style={{ background: 'rgba(47,111,158,0.10)', border: '1px solid rgba(47,111,158,0.15)' }}
          >
            <Ruler size={18} style={{ color: 'var(--blue)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-display font-medium leading-tight truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {design.title || t('myRecordsUntitledDesign')}
            </p>
            <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {t('myRecordsSharedPrefix')} {fmtDate(design.created_at)}
            </p>
          </div>
          <Link
            href="/farmer?panel=Design"
            className="text-xs font-display px-2.5 py-1 rounded-lg flex-shrink-0 flex items-center gap-1"
            style={{
              background: 'rgba(47,111,158,0.08)',
              border: '1px solid rgba(47,111,158,0.2)',
              color: 'var(--blue)',
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
  invoices,
  profile,
}: {
  production: ProductionLog[];
  sales: SalesLog[];
  expenses: ExpenseLog[];
  invoices: SavedInvoice[];
  profile: Profile | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const sampling = isSampleMode();
  const { lang } = useLanguage();
  const ready = creditPackHasAnyRecords(production, sales, expenses, invoices);
  const [previewOpen, setPreviewOpen] = useState(false);
  const months = buildMonthlyCashFlow(sales, expenses, new Date(), undefined, invoices);
  const totals = months.reduce((sum, month) => ({ income: sum.income + month.incomeZar, spent: sum.spent + month.expensesZar }), { income: 0, spent: 0 });
  const money = (value: number) => `R ${numberLabel(value, 0)}`;

  async function handleExport() {
    setError('');
    setLoading(true);
    try {
      const farmer = {
        name: profile?.full_name?.trim() || null,
        farmName: profile?.farm_name?.trim() || null,
        phone: profile?.phone?.trim() || null,
      };
      const blob = sampling
        ? await buildCreditPackPreviewPdf({ production, sales, expenses, invoices })
        : await buildCreditPackPdf({ farmer, production, sales, expenses, invoices });
      await deliverCreditPackPdf(blob, creditPackPdfFilename(sampling ? 'Tour-summary' : farmer.farmName ?? farmer.name));
    } catch (err) {
      setError(
        err instanceof CreditPackSampleModeError
          ? err.message
          : recordsUi(lang, 'Could not build the document. Please try again.', 'Ayikwazanga ukwakha idokhumenti. Sicela uzame futhi.'),
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
          <Landmark size={18} style={{ color: 'var(--color-forest-700)' }} />
        </div>
        <div>
          <p className="text-xl font-display font-semibold" style={{ color: 'var(--color-ink)' }}>
            {recordsUi(lang, 'Records for a lender', 'Amarekhodi okubolekwa imali')}
          </p>
          <p className="text-xs font-sans mt-0.5 leading-relaxed" style={{ color: 'var(--color-muted-strong)' }}>
            {recordsUi(lang, 'A summary of your logged harvests, sales and costs — income consistency, cash flow and a track record, built only from what you have entered. Material for a conversation with a lender, not a credit score or a loan approval.', 'Isifinyezo sezivuno, ukuthengisa nezindleko ozirekhodile — ukungaguquguquki kwemali engenayo, ukuhamba kwemali nomlando, okwakhiwe ngolwazi olufakile kuphela. Lokhu kungasiza engxoxweni nombolekisi; akusona isikolo sesikweletu noma ukuvunyelwa kwemalimboleko.', true)}
          </p>
        </div>
      </div>

      {!ready ? (
        <p className="text-xs font-sans rounded-lg px-3 py-2" style={{ background: 'var(--bg-1)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          {recordsUi(lang, 'Log at least one harvest, sale or cost first — there is nothing to summarise yet.', 'Rekhoda okungenani isivuno esisodwa, ukuthengisa noma izindleko kuqala — akukho okungafingqwa okwamanje.', true)}
        </p>
      ) : (
        <>
        <div className="grid grid-cols-3 gap-2 my-3">
          {[[recordsUi(lang, 'Income', 'Imali engenayo'), money(totals.income)], [recordsUi(lang, 'Costs', 'Izindleko'), money(totals.spent)], [recordsUi(lang, 'Harvested', 'Okuvunyiwe'), `${numberLabel(production.reduce((n, p) => n + (p.kg ?? 0), 0))} kg`]].map(([label, value]) => (
            <div key={label} className="rounded-xl p-3" style={{ background: '#F0F5EA', color: '#214D32' }}>
              <span className="block font-sans text-xs">{label}</span><strong className="block font-display text-lg mt-1">{value}</strong>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setPreviewOpen(v => !v)} aria-expanded={previewOpen} className="w-full rounded-xl px-4 py-3 mb-2 font-sans text-sm font-semibold" style={{ background: '#1F4D2B', color: '#FFFEFA' }}>{recordsUi(lang, previewOpen ? 'Close summary' : 'View summary', previewOpen ? 'Vala isifinyezo' : 'Buka isifinyezo')}</button>
        {previewOpen && <div className="overflow-x-auto mb-3">
          <table className="w-full text-sm font-sans" style={{ color: 'var(--color-ink)' }}>
            <caption className="text-left py-2 font-semibold">{recordsUi(lang, 'Monthly income and costs', 'Imali engenayo nezindleko zenyanga')}</caption>
            <thead><tr><th className="text-left p-2">{recordsUi(lang, 'Month', 'Inyanga')}</th><th className="text-right p-2">{recordsUi(lang, 'Income', 'Imali engenayo', true)}</th><th className="text-right p-2">{recordsUi(lang, 'Costs', 'Izindleko', true)}</th><th className="text-right p-2">{recordsUi(lang, 'Balance', 'Ibhalansi', true)}</th></tr></thead>
            <tbody>{months.map(month => <tr key={month.monthKey} style={{ borderTop: '1px solid var(--color-border)' }}><td className="p-2">{month.label}</td><td className="p-2 text-right">{money(month.incomeZar)}</td><td className="p-2 text-right">{money(month.expensesZar)}</td><td className="p-2 text-right">{money(month.netZar)}</td></tr>)}</tbody>
          </table>
        </div>}
        <button
          type="button"
          onClick={() => { void handleExport(); }}
          disabled={loading}
          className="w-full py-2 rounded-xl text-xs font-display font-semibold flex items-center justify-center gap-2 transition-all"
          style={{
            background: loading ? 'rgba(46,107,58,0.06)' : 'rgba(46,107,58,0.14)',
            border: '1px solid rgba(46,107,58,0.32)',
            color: loading ? '#755942' : '#2E6B3A',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-forest-700)' }} />
              {recordsUi(lang, 'Building document…', 'Kwakhiwa idokhumenti…')}
            </>
          ) : (
            <>
              <Landmark size={14} /> {recordsUi(lang, 'Export records for a lender', 'Khipha amarekhodi kumbolekisi')}
            </>
          )}
        </button>
        </>
      )}

      {error && (
        <p className="text-xs font-mono mt-2" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
    </Card>
  );
}

/* ── Main MyRecords component ────────────────────────────────────────────── */

/**
 * WHICH PAGE OF THE BOOK THIS IS STANDING ON.
 *
 * This component used to be the whole of /records: harvests, sales, the credit pack and shared
 * designs on one scroll. The Gogo Test audit merged /records and /finances into one book with
 * tabs — Picked · Sold · Spent — and a tab called "Picked" that also holds a sale form is the
 * same lying label the Journal tile already had to have fixed. So the blocks are split by page.
 *
 * A PROP, NOT A SPLIT INTO TWO COMPONENTS. Everything below the render shares one auth
 * subscription and one allSettled read of production, sales, expenses, designs and profile.
 * Splitting the file would have meant two of each, or lifting state into the page — and the page
 * is where the second, money-side data owner already lives. Picked and Sold are rendered from the
 * same mounted element in app/records/page.tsx, so switching between them changes this prop and
 * nothing refetches.
 *
 * 'all' keeps the original one-scroll behaviour for any caller that has not been told about tabs.
 */
export type MyRecordsSection = 'all' | 'picked' | 'sold';

export default function MyRecords({
  section = 'all',
  onChanged,
}: {
  section?: MyRecordsSection;
  /**
   * Fires after a save lands, so the book's own totals (SummaryCards, the ledger, the charts)
   * refresh from the same tap. Without it, logging a harvest here would update this list and
   * leave "Kg harvested" above the tabs showing the old number — the split-brain the merge
   * exists to end.
   */
  onChanged?: () => void;
}) {
  const showPicked = section === 'all' || section === 'picked';
  const showSold = section === 'all' || section === 'sold';
  const { t, lang } = useLanguage();
  const [user, setUser] = useState<User | null | 'loading'>('loading');
  const [production, setProduction] = useState<ProductionLog[]>([]);
  const [sales, setSales] = useState<SalesLog[]>([]);
  const [expenses, setExpenses] = useState<ExpenseLog[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [invoices, setInvoices] = useState<SavedInvoice[]>([]);
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

  /**
   * The orchard switch, shared with the Finance screen's graphs through one stored setting — so a
   * farmer who asked for the vegetable beds on their own over there is not shown a whole-farm
   * total over here without noticing. Read after mount because localStorage is client-only.
   */
  const [includePerennials, setIncludePerennials] = useState(DEFAULT_INCLUDE_PERENNIALS);
  useEffect(() => { setIncludePerennials(loadIncludePerennials()); }, []);
  const inScope = (crop: string) => countsWithScope(crop, includePerennials);

  // Paid invoices are localStorage-only (see lib/invoice-seller.ts) and never come back from
  // myProduction/mySales/designsSharedWithMe, so they get their own load + change listener —
  // same pattern as app/finances/page.tsx — instead of waiting on auth or the Firestore round trip.
  useEffect(() => {
    const refresh = () => setInvoices(loadInvoices());
    refresh();
    window.addEventListener('imbewu-invoices-changed', refresh);
    return () => window.removeEventListener('imbewu-invoices-changed', refresh);
  }, []);

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

  /**
   * What both forms call after a successful save: re-read this component's own lists, then tell
   * the book. Two owners read the same three collections (this component and app/records/page.tsx
   * — see the note on the `section` prop), and only one of them can be refreshed by a save that
   * happens in here. A harvest that updates "Recent harvests" but leaves "Kg harvested" above the
   * tabs stale would be two answers to one question on one screen.
   */
  const handleSaved = useCallback(() => {
    void loadData();
    onChanged?.();
  }, [loadData, onChanged]);

  // Load data once signed in
  useEffect(() => {
    let cancelled = false;
    if (isSampleMode() || (user && user !== 'loading')) {
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
            style={{ background: 'var(--bg-2)', animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    );
  }

  // Firebase not configured OR no logged-in user — but the in-memory sample farm is
  // deliberately viewable signed out, so it must never hit the sign-in wall.
  if (!user && !isSampleMode()) {
    return (
      <div className="p-4">
        <SignInPrompt />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">

      {/* ── Section header ────────────────────────────
             Only on the one-scroll view. Inside the book the tab strip directly above already
             says which page this is, and a heading repeating it would push the harvest form —
             the thing she came to fill in — further down a 375px screen for nothing. The
             loading spinner survives either way; it is the only thing here that is news. */}
      {section === 'all' ? (
        <div className="flex items-center justify-between">
          <div>
            <h2
              className="font-display font-bold text-base leading-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              {t('myRecordsTitle')}
            </h2>
            <p className="font-display text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {t('myRecordsSubtitle')}
            </p>
          </div>
          {dataLoading && (
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-forest-800)' }} />
          )}
        </div>
      ) : dataLoading ? (
        <div className="flex justify-end">
          <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-forest-800)' }} />
        </div>
      ) : null}

      {/* ── Load error banner ───────────────────────── */}
      {loadError && !dataLoading && (
        <div
          className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5"
          style={{ background: 'color-mix(in srgb, var(--orange) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--orange) 25%, transparent)' }}
        >
          <span className="font-sans" style={{ fontSize: 12.5, color: 'var(--orange)' }}>
            {t('myRecordsLoadError')}
          </span>
          <button
            type="button"
            onClick={() => { void loadData(); }}
            className="font-sans font-semibold flex-shrink-0"
            style={{ fontSize: 12, color: 'var(--color-forest-800)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {t('myRecordsRetry')}
          </button>
        </div>
      )}

      {/* ── Log production — THE harvest form. Crop, kilograms, optional photo, save.
             The audit's "do not touch" list names this shape exactly; the merge moved its
             front door and left every field and every branch of its save path alone. ── */}
      {showPicked && <LogProductionForm onSaved={handleSaved} />}

      {/* ── Harvest summary ─────────────────────────── */}
      {showPicked && production.length > 0 && (() => {
        // Scoped, not filtered-away: what the switch removes is counted separately and named
        // underneath, so a total that suddenly drops has its missing kilograms on the same card.
        const counted = production.filter((p) => inScope(p.crop));
        const left = production.filter((p) => !inScope(p.crop));
        const excludedKg = left.reduce((s, p) => s + (p.kg ?? 0), 0);
        // Named by the catalogue, so one fruit is one name however the picker and the sale form
        // each spelt it.
        const excludedNames = [...new Set(left.filter((p) => (p.kg ?? 0) > 0).map((p) => produceDisplayName(p.crop)))]
          .sort((a, b) => a.localeCompare(b, 'en-ZA'));
        const totalKg = counted.reduce((s, p) => s + (p.kg ?? 0), 0);
        const byCrop: Record<string, number> = {};
        // Same grouping rule, so two spellings of one fruit cannot split its kilograms and cost it
        // the top-crop line it earned.
        counted.forEach((p) => { const n = produceDisplayName(p.crop); byCrop[n] = (byCrop[n] ?? 0) + (p.kg ?? 0); });
        const topCrop = Object.entries(byCrop).sort((a, b) => b[1] - a[1])[0];
        const recent = counted.slice(0, 12);
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
                <div className="font-display font-bold" style={{ fontSize: 22, color: 'var(--color-forest-800)', lineHeight: 1 }}>
                  {totalKg % 1 === 0 ? totalKg : totalKg.toFixed(1)} kg
                </div>
                <div className="font-sans text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {t('myRecordsTotalHarvested')}{topCrop ? ` · ${topCrop[0]} ${t('myRecordsTopsLabel')}` : ''}
                </div>
                <OrchardSwitch
                  on={includePerennials}
                  onChange={(next) => { setIncludePerennials(next); saveIncludePerennials(next); }}
                  t={t}
                />
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
            {excludedKg > 0 && (
              <OrchardNote kg={excludedKg} names={excludedNames} t={t} />
            )}
          </Card>
        );
      })()}

      {/* ── Recent harvests ─────────────────────────── */}
      {showPicked && (
        <Card>
          <SectionLabel>{t('myRecordsRecentHarvests')}</SectionLabel>
          <ProductionList items={production.slice(0, 10)} />
        </Card>
      )}

      {showPicked && showSold && <Divider />}

      {/* ── Log sale — the crop-picker sale form, with the guide price beside it. Lives on the
             Sold page of the book; the plain-text entry and the edit/delete ledger are on the
             same page, below this component. ── */}
      {showSold && (
        <Card accent="#315939">
          <SectionLabel>{recordsUi(lang, 'Record a sale', 'Rekhoda ukuthengisa')}</SectionLabel>
          <p className="text-sm mb-3" style={{ color: 'var(--color-ink)' }}>{recordsUi(lang, 'Create an invoice to keep the buyer, produce, quantity and payment together.', 'Dala i-invoyisi ukuze ugcine umthengi, umkhiqizo, inani nenkokhelo ndawonye.', true)}</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/invoice?mode=sale" className="inline-flex items-center justify-center gap-2 rounded-xl px-4 min-h-11 text-sm font-semibold" style={{ background: '#315939', color: '#fff' }}><FileText size={18} />{recordsUi(lang, 'New sale & invoice', 'Ukuthengisa okusha ne-invoyisi')}</Link>
            <Link href="/invoice?mode=paper" className="inline-flex items-center justify-center gap-2 rounded-xl px-4 min-h-11 text-sm font-semibold" style={{ border: '1px solid var(--color-border)', color: 'var(--color-ink)' }}>{recordsUi(lang, 'Past sale / paper invoice', 'Ukuthengisa kwangaphambilini / i-invoyisi yephepha')}<ArrowRight size={16} /></Link>
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--color-muted-strong)' }}>{recordsUi(lang, 'Already logged this sale? Use Create invoice on its row below to keep one record.', 'Usuvele ukuqophile lokhu kuthengisa? Sebenzisa okuthi Dala i-invoyisi emgqeni wako ngezansi ukuze kuhlale kuyirekhodi elilodwa.', true)}</p>
          <details className="mt-3">
            <summary className="min-h-11 flex items-center cursor-pointer text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>{recordsUi(lang, 'Quick sale entry', 'Faka ukuthengisa ngokushesha')}</summary>
            <LogSaleForm onSaved={handleSaved} />
          </details>
        </Card>
      )}

      {/* ── Sales summary ────────────────────────────── */}
      {showSold && (sales.length > 0 || invoices.some((i) => i.status === 'paid')) && (() => {
        // Summing `sales` alone double-counted a paid invoice's kg lines (also synced into
        // `sales` by syncInvoiceSales) while missing its bags/crates/other non-kg lines entirely
        // (they never create a sales row — their weight is unknown). cashIncomeTotal is the one
        // place that combines sales and invoices correctly; see lib/invoice-sales.ts.
        const totalRev = cashIncomeTotal(sales, invoices);
        // The rand total is NEVER scoped. An invoice can carry delivery, a discount or crate
        // lines, so splitting it between the beds and the orchard would be a claim the invoice
        // does not make — and cashIncomeTotal is the one place that counts a paid invoice once.
        // Only the kilogram figure beside it follows the switch, and says so when it does.
        const soldLeftOut = sales.filter((p) => !inScope(p.crop));
        const soldExcludedKg = soldLeftOut.reduce((s, p) => s + (p.kg ?? 0), 0);
        // Through the catalogue, exactly as the harvest note above does. These two notes sit on the
        // same screen: with one spelling raw and one canonical, one avocado tree read as "Avocado"
        // in the note above and "Avocados" in this one.
        const soldExcludedNames = [...new Set(soldLeftOut.filter((p) => (p.kg ?? 0) > 0).map((p) => produceDisplayName(p.crop)))]
          .sort((a, b) => a.localeCompare(b, 'en-ZA'));
        const totalKgSold = sales.filter((p) => inScope(p.crop)).reduce((s, p) => s + (p.kg ?? 0), 0);
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
                <div className="font-display font-bold" style={{ fontSize: 22, color: 'var(--gold)', lineHeight: 1 }}>
                  R{totalRev % 1 === 0 ? totalRev : totalRev.toFixed(2)}
                </div>
                <div className="font-sans text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
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
            {soldExcludedKg > 0 && (
              <OrchardNote kg={soldExcludedKg} names={soldExcludedNames} t={t} money />
            )}
          </Card>
        );
      })()}

      {/* ── Recent sales ────────────────────────────── */}
      {showSold && (
        <Card>
          <SectionLabel>{t('myRecordsSalesHeader')}</SectionLabel>
          <SalesList items={sales.slice(0, 10)} />
        </Card>
      )}

      {/* ── Records for a lender, and the designs her supervisor shared ───────────────
             Both stay on Picked. They are about what she has recorded rather than about a
             single sale or cost, and the credit pack needs harvests, sales AND costs — it is
             one of the few things in the app that reads all three, so it belongs on the page
             she reaches first rather than on one of the two money pages. ── */}
      {showPicked && (
        <>
          <Divider />

          <CreditPackCard production={production} sales={sales} expenses={expenses} invoices={invoices} profile={profile} />

          <Divider />

          <Card accent="#2F6F9E">
            <SectionLabel>{t('myRecordsSharedWithMe')}</SectionLabel>
            <SharedDesignsList items={designs} />
          </Card>
        </>
      )}

    </div>
  );
}

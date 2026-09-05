'use client';

import workspace from '@/components/layout/Workspace.module.css';

import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Printer, Share2, FilePlus2, Clock, X, ChevronDown, Building2, Landmark } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import BackButton from '@/components/BackButton';
import BrandLogo from '@/components/BrandLogo';
import SettingsButton from '@/components/SettingsButton';
import TabBar from '@/components/TabBar';
import {
  loadCustomers, addCustomer, findCustomer, loadProducts, addProduct,
  loadInvoices, saveInvoice, deleteInvoice, setInvoiceStatus, invoiceId,
  loadNextInvoiceNumber, saveNextInvoiceNumber,
  paymentMethodLabel, type SavedInvoice, type PaymentMethod, type Customer, type CustomerDetails,
} from '@/lib/invoices';
import {
  loadLetterhead, saveLetterhead, dueDateISO, EMPTY_LETTERHEAD, type SellerLetterhead,
} from '@/lib/invoice-seller';
import { buildInvoiceDocument } from '@/lib/invoice-document';
import { buildInvoicePdf } from '@/lib/invoice-pdf';
import InvoiceDocumentView from '@/components/invoice/InvoiceDocument';
import LessonLink from '@/components/design/LessonLink';
import CropSelect from '@/components/CropSelect';
import { cropEntryOption } from '@/lib/crop-entry';
import { loadCropPriceOverrides, priceFor, type CropPrice } from '@/lib/crop-prices';
import { priceDateLabel } from '@/components/prices/CropPriceGuide.format';
import MenuButton from '@/components/MenuButton';
import { syncInvoiceSales } from '@/lib/db/queries';
import { isSampleMode, getSandboxProfile } from '@/lib/sample-mode';
import { updateMyProfile } from '@/lib/db/queries';
import type { Profile } from '@/lib/db/types';

interface LineItem {
  id: number; desc: string; qty: number; unit: string; price: number;
  /**
   * This price came from the researched guide, not from the farmer.
   *
   * The guide used to be shown beside an empty box and never written into it, on the
   * reasoning that a guide is not an agreed price. In practice that left every farmer
   * copying a number that was already on screen, by hand, on a phone. So it is filled in
   * — and flagged, so the line can say it is a suggestion, and so a later change of buyer
   * can re-price it. The instant the farmer types their own figure the flag clears and
   * the app never touches that line's price again.
   */
  priceFromGuide?: boolean;
}

const UNITS = ['bags', 'kg', 'crates', 'bunches', 'trays', 'each'];
const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'eft', 'card', 'mobile', 'other'];
const BUYER_TYPES = [
  'Neighbour', 'Farm gate', 'Spaza shop', 'Bakkie trader', 'Market stall', 'Hawker',
  'School', 'Crèche', 'Church', 'Restaurant or lodge', 'Co-op',
];
const WHOLESALE_BUYERS = ['spaza shop', 'bakkie trader', 'market stall', 'hawker', 'school', 'crèche', 'restaurant or lodge', 'co-op'];
/** Offered as terms. Absent from the list on purpose: a preselected default. */
const TERM_CHOICES: { label: string; days: number | null }[] = [
  { label: 'No due date', days: null },
  { label: 'On receipt', days: 0 },
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
];

const CARD = { background: '#FFFEFA', border: '1px solid #E2D8C4' };
const FIELD = { background: '#fff', border: '1px solid #E2D8C4', color: '#20190F' };

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-sans uppercase tracking-wider mb-1" style={{ color: '#8C7A62' }}>{children}</div>
  );
}

function Disclosure({
  open, onToggle, icon, title, hint, children,
}: {
  open: boolean; onToggle: () => void; icon: React.ReactNode;
  title: string; hint: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={CARD}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <span style={{ color: '#1F4D2B', display: 'flex' }}>{icon}</span>
        <span className="flex-1 min-w-0">
          <span className="block font-display text-sm font-semibold" style={{ color: '#20190F' }}>{title}</span>
          <span className="block text-xs font-sans" style={{ color: '#8C7A62' }}>{hint}</span>
        </span>
        <ChevronDown
          size={16}
          style={{ color: '#8C7A62', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
        />
      </button>
      {open && <div className="px-3 pb-3 space-y-2.5" style={{ borderTop: '1px solid #E2D8C4', paddingTop: 12 }}>{children}</div>}
    </div>
  );
}

export default function InvoicePage() {
  const { user, profile: signedInProfile, refreshProfile } = useAuth();
  // Sample mode has no signed-in user, so useAuth() returns no profile and the demo invoice
  // printed a bare "Your name" placeholder — which reads as an unbuilt feature rather than an
  // unset field. Not a second authority: in sample mode the sandbox profile IS the profile, the
  // same substitution lib/db/queries.ts already makes in getMyProfile().
  const [sampleProfile, setSampleProfile] = useState<Profile | null>(null);
  const profile = sampleProfile ?? signedInProfile;

  // Mirrors profile.farm_name while the field is being typed into, so a half-typed name is
  // never written to the account and never flickers onto the live document preview.
  const [businessNameDraft, setBusinessNameDraft] = useState('');
  const [seq, setSeq] = useState(44);
  const [currentNo, setCurrentNo] = useState(44);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [billTo, setBillTo] = useState('');
  const [buyerDetails, setBuyerDetails] = useState<CustomerDetails>({});
  const [customBuyer, setCustomBuyer] = useState(false);
  const [items, setItems] = useState<LineItem[]>([{ id: 1, desc: '', qty: 1, unit: 'bags', price: 0 }]);
  const [nextId, setNextId] = useState(2);

  // The issue date of the document on screen. Held in state, not recomputed on render: a saved
  // invoice reopened next week must still show the day it was issued.
  const [issuedISO, setIssuedISO] = useState(() => new Date().toISOString());
  const [termsDays, setTermsDays] = useState<number | null>(null);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [enterprise, setEnterprise] = useState<'vegetables' | 'staples' | 'other' | ''>('');

  const [letterhead, setLetterhead] = useState<SellerLetterhead>(EMPTY_LETTERHEAD);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<{ desc: string; unit: string; price: number }[]>([]);
  const [saved, setSaved] = useState<SavedInvoice[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [openPanel, setOpenPanel] = useState<'seller' | 'buyer' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  /** Set when persist() could not store the invoice. Shown next to the actions, because an error
   *  the farmer never sees is the same defect as no error at all. */
  const [saveError, setSaveError] = useState<string | null>(null);
  const [priceOverrides, setPriceOverrides] = useState<Record<string, CropPrice>>({});
  const [syncingInvoiceId, setSyncingInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    if (isSampleMode()) { setSampleProfile(getSandboxProfile()); setShowSaved(true); }
    const nextNumber = loadNextInvoiceNumber();
    setSeq(nextNumber);
    setCurrentNo(nextNumber);
    const refresh = () => { setCustomers(loadCustomers()); setProducts(loadProducts()); setSaved(loadInvoices()); };
    refresh();
    const stored = loadLetterhead();
    setLetterhead(stored);
    setTermsDays(stored.paymentTermsDays);
    setNotes(stored.notes);
    setPriceOverrides(loadCropPriceOverrides());
    window.addEventListener('imbewu-invoices-changed', refresh);
    return () => window.removeEventListener('imbewu-invoices-changed', refresh);
  }, [user?.uid]);

  const sellerName = profile?.full_name ?? user?.displayName ?? '';
  const sellerPhone = profile?.phone ?? '';
  // NO FALLBACK, DELIBERATELY. This line read 'Tugela Valley smallholding' for every farmer in the
  // country until 2026-08-06 — a real place, printed on invoices sent to real buyers by people who
  // have never been there. An unset farm name prints nothing: buildInvoiceDocument drops blank
  // lines, so there is no stand-in on either the screen or the PDF.
  const sellerFarm = profile?.farm_name?.trim() ?? '';

  // Seed the editable draft from whatever the account holds, once it arrives. Guarded on the
  // draft still being empty so it cannot overwrite something the farmer is mid-way through
  // typing when a background profile refresh lands.
  useEffect(() => {
    const stored = profile?.farm_name?.trim() ?? '';
    if (stored) setBusinessNameDraft((current) => (current ? current : stored));
  }, [profile?.farm_name]);
  // Same rule as the farm name: unset draws the app's own mark, never a stand-in logo.
  const sellerLogo = profile?.farm_logo ?? '';

  /**
   * Which side of the guide applies to THIS buyer.
   *
   * Selling a crate at the farm gate and selling the same crate into a spaza shop are
   * different prices, and the guide publishes both. The buyer type the farmer has already
   * chosen decides which one is offered.
   */
  const wholesaleBuyer = WHOLESALE_BUYERS.includes(billTo.trim().toLocaleLowerCase('en-ZA'));

  /** The guide price for a crop description, or null when the crop is not priced. */
  function guidePriceFor(desc: string, wholesale: boolean): number | null {
    const crop = cropEntryOption(desc);
    if (!crop) return null;
    const guide = priceFor(crop.key, priceOverrides);
    if (!guide) return null;
    const value = wholesale ? guide.wholesalePerKg : guide.retailPerKg;
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  /**
   * A suggested price follows the buyer.
   *
   * Switching "Bill to" from Farm gate to Spaza shop moves every still-suggested line to
   * the wholesale side of the same guide, because that is the price that just became the
   * right one. A line the farmer has typed into is never touched — `priceFromGuide` is
   * cleared the moment they edit it, and this only ever reads lines that still carry it.
   */
  useEffect(() => {
    setItems((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        if (!item.priceFromGuide || item.unit !== 'kg') return item;
        const guide = guidePriceFor(item.desc, wholesaleBuyer);
        if (guide === null || guide === item.price) return item;
        changed = true;
        return { ...item, price: guide };
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- guidePriceFor is re-created every
    // render; its only real inputs are the two below.
  }, [wholesaleBuyer, priceOverrides]);

  const total = items.reduce((s, it) => s + it.qty * it.price, 0);
  const valid = billTo.trim() !== '' && items.some((it) => it.desc.trim() !== '' && it.qty > 0);
  const invoiceNo = `#${String(currentNo).padStart(4, '0')}`;
  const due = dueDateISO(issuedISO, termsDays);

  // The single document both renderers draw. Built here so the card on screen and the PDF in the
  // buyer's WhatsApp are the same object, not two independent transcriptions of the same state.
  const doc = useMemo(() => buildInvoiceDocument({
    no: currentNo,
    issuedISO,
    dueISO: due,
    seller: {
      name: sellerName, farm: sellerFarm, phone: sellerPhone, logo: sellerLogo,
      address: letterhead.address, email: letterhead.email, taxNumber: letterhead.taxNumber,
    },
    buyer: { name: billTo, ...buyerDetails },
    items,
    reference,
    notes,
    banking: {
      bankName: letterhead.bankName,
      accountName: letterhead.bankAccountName,
      accountNumber: letterhead.bankAccountNumber,
      branchCode: letterhead.bankBranchCode,
    },
    status: saved.find((s) => s.id === currentId)?.status ?? 'unpaid',
    paidAt: saved.find((s) => s.id === currentId)?.paidAt,
    paymentMethod: saved.find((s) => s.id === currentId)?.paymentMethod,
  }), [currentNo, issuedISO, due, sellerName, sellerFarm, sellerPhone, letterhead, billTo, buyerDetails, items, reference, notes, saved, currentId]);

  /**
   * Save the business name back to the account, on blur rather than per keystroke.
   *
   * In sample mode `updateMyProfile` writes to the in-memory sandbox, so the demo can be
   * renamed without touching anybody's real account — but `refreshProfile` reads the signed-in
   * user, which sample mode does not have. The local sample profile is therefore patched
   * directly, the same substitution this page already makes when it loads.
   */
  async function saveBusinessName() {
    const next = businessNameDraft.trim();
    if (next === (profile?.farm_name ?? '').trim()) return;
    await updateMyProfile({ farm_name: next || null });
    if (isSampleMode()) setSampleProfile(getSandboxProfile());
    else await refreshProfile();
  }

  function patchLetterhead(patch: Partial<SellerLetterhead>) {
    setLetterhead((prev) => {
      const next = { ...prev, ...patch };
      saveLetterhead(next);
      return next;
    });
  }

  function updateItem(id: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function chooseCrop(id: number, crop: string, cropKey: string | null) {
    setItems((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      const remembered = products.find(
        (product) => product.desc.toLocaleLowerCase('en-ZA') === crop.toLocaleLowerCase('en-ZA'),
      );
      // What this farmer actually charged last time beats any published guide.
      if (remembered && remembered.unit === 'kg') {
        return { ...item, desc: crop, unit: 'kg', price: remembered.price, priceFromGuide: false };
      }
      // Every researched guide is per kg, so a catalogue selection sets the unit first.
      const unit = cropKey ? 'kg' : (remembered?.unit ?? 'kg');
      if (remembered) return { ...item, desc: crop, unit, price: remembered.price, priceFromGuide: false };
      const guide = unit === 'kg' ? guidePriceFor(crop, wholesaleBuyer) : null;
      return guide !== null
        ? { ...item, desc: crop, unit, price: guide, priceFromGuide: true }
        : { ...item, desc: crop, unit, price: 0, priceFromGuide: false };
    }));
  }

  function selectBuyer(name: string) {
    setBillTo(name);
    // Pull the remembered address/phone forward, so a repeat customer does not have to be
    // retyped — but only into the FORM, where the farmer can still see and change it before it
    // is frozen onto the invoice.
    const remembered = name ? findCustomer(customers, name) : undefined;
    setBuyerDetails(remembered
      ? { address: remembered.address, phone: remembered.phone, email: remembered.email }
      : {});
  }

  function addItem() {
    setItems((prev) => [...prev, { id: nextId, desc: '', qty: 1, unit: 'bags', price: 0 }]);
    setNextId((n) => n + 1);
  }
  function removeItem(id: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));
  }

  /**
   * Persist the customer, item presets and the invoice record.
   *
   * RETURNS null WHEN NOTHING WAS STORED, and that is the whole point. saveInvoice returns the
   * DURABLE ledger and deliberately returns the prior list unchanged when the record is rejected or
   * the write fails; saveNextInvoiceNumber returns false the same way. This function read neither.
   * It advanced the sequence, persisted it and set currentId regardless — so the farmer printed and
   * WhatsApped invoice #0044 for R3 500, the ledger had no #0044, /finances and the CSV omitted it,
   * and the counter moved to #0045 leaving a permanent hole in the numbering.
   */
  async function persist(): Promise<string | null> {
    const id = currentId ?? invoiceId();
    const existing = saved.find((s) => s.id === id);
    addCustomer(billTo, buyerDetails);
    items.forEach((it) => { if (it.desc.trim()) addProduct({ desc: it.desc.trim(), unit: it.unit, price: it.price }); });
    const list = saveInvoice({
      id, no: currentNo, billTo: billTo.trim(),
      billToDetails: buyerDetails,
      items: items.filter((it) => it.desc.trim()).map(({ desc, qty, unit, price }) => ({ desc, qty, unit, price })),
      total,
      // saveInvoice keeps the original date on an existing record, so this value is only ever
      // used by the save that creates one.
      dateISO: existing?.dateISO ?? issuedISO,
      dueDateISO: due ?? undefined,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
      enterprise: enterprise || undefined,
      status: existing?.status ?? 'unpaid',
      paidAt: existing?.paidAt,
    });
    const stored = list.find((x) => x.id === id);
    if (!stored) {
      setSaveError('This invoice could not be saved on this device, so it has not been issued. Check your storage and try again.');
      return null;
    }
    if (stored.status === 'paid') {
      try {
        await syncInvoiceSales(stored);
      } catch {
        if (existing) saveInvoice(existing);
        setSaveError('This paid invoice could not update the sales book. Nothing was printed or shared; check your connection and try again.');
        return null;
      }
    }
    if (currentId === null) {
      const nextSeq = currentNo + 1;
      // Only burn the number once the invoice it belongs to is genuinely on disk AND the new
      // counter is too. If the counter write fails, loadNextInvoiceNumber falls back to the old
      // value and a second, different invoice would be issued under the same number.
      if (saveNextInvoiceNumber(nextSeq)) setSeq(nextSeq);
    }
    setSaveError(null);
    setCurrentId(id);
    setIssuedISO(stored.dateISO);
    return id;
  }

  async function printInvoice() {
    // Nothing reaches paper or a buyer unless it is in the ledger.
    if (!valid) return;
    if (await persist() === null) return;
    window.print();
  }

  // Share the PDF via the device share sheet (tap WhatsApp → PDF attached).
  // Falls back to a download where file-sharing isn't supported (e.g. desktop).
  async function shareInvoice() {
    if (!valid) return;
    if (await persist() === null) return;
    let file: File;
    try {
      file = await buildInvoicePdf(doc, `Invoice-${String(currentNo).padStart(4, '0')}.pdf`);
    } catch {
      setSaveError('The PDF could not be built on this device. The invoice is saved — try Print instead.');
      return;
    }
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
    setIssuedISO(new Date().toISOString());
    setBillTo('');
    setBuyerDetails({});
    setCustomBuyer(false);
    setItems([{ id: 1, desc: '', qty: 1, unit: 'bags', price: 0 }]);
    setNextId(2);
    setReference('');
    // Terms and the standing note come back from the letterhead, not from the invoice just closed.
    setTermsDays(letterhead.paymentTermsDays);
    setNotes(letterhead.notes);
    setEnterprise('');
    setShowSaved(false);
  }

  function openSaved(inv: SavedInvoice) {
    setCurrentId(inv.id);
    setCurrentNo(inv.no);
    setIssuedISO(inv.dateISO);
    setBillTo(inv.billTo);
    setBuyerDetails(inv.billToDetails ?? {});
    setCustomBuyer(
      !customers.some((c) => c.name.toLocaleLowerCase('en-ZA') === inv.billTo.toLocaleLowerCase('en-ZA'))
      && !BUYER_TYPES.some((name) => name.toLocaleLowerCase('en-ZA') === inv.billTo.toLocaleLowerCase('en-ZA')),
    );
    setItems(inv.items.map((it, i) => ({ id: i + 1, ...it })));
    setNextId(inv.items.length + 1);
    setReference(inv.reference ?? '');
    setNotes(inv.notes ?? '');
    setEnterprise(inv.enterprise === 'shared' ? '' : inv.enterprise ?? '');
    // Reconstruct the term from the two stored dates rather than reusing the current default,
    // so reopening an invoice cannot quietly change what it says is due and when.
    setTermsDays(inv.dueDateISO
      ? Math.round((Date.parse(inv.dueDateISO) - Date.parse(inv.dateISO)) / 86_400_000)
      : null);
    setShowSaved(false);
  }

  async function changeInvoiceStatus(invoice: SavedInvoice, status: 'paid' | 'unpaid', method?: PaymentMethod) {
    if (syncingInvoiceId) return;
    setSyncingInvoiceId(invoice.id);
    setSaveError(null);
    const changed = setInvoiceStatus(invoice.id, status, method);
    const updated = changed.find((row) => row.id === invoice.id);
    if (!updated) {
      setSyncingInvoiceId(null);
      return;
    }
    setSaved(changed);
    try {
      await syncInvoiceSales(updated);
    } catch {
      setSaved(saveInvoice(invoice));
      setSaveError('The invoice status was not changed because its crop sales could not be updated. Check your connection and try again.');
    } finally {
      setSyncingInvoiceId(null);
    }
  }

  return (
    <div className="invoice-page flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#E4DCC6' }}>
      {/* overflow-x-auto, like the crop-plan header: seven controls (Back, home,
          title, Learn, Share PDF, Print, Settings) do not fit a 375px phone and
          never did — 90px of this bar, Settings included, was simply off-screen
          and unreachable before the menu button was added here. Scrolling is not
          the prettiest answer, but a control a farmer cannot reach is worse than
          one they have to swipe to. */}
      <header className="no-print flex-shrink-0 flex items-center px-3 sm:px-4 gap-2 sm:gap-3 overflow-x-auto" style={{ height: 52, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}>
        <MenuButton />
        <BackButton fallback="/records?tab=sold" />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
        <span className="text-xs font-display truncate min-w-0" style={{ color: '#5C5040' }}>Invoice {invoiceNo}</span>
        <div className="flex-1" />
        <LessonLink id="finances:invoices" label="Learn" />
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

      <div className="invoice-scroll flex-1 overflow-y-auto">
        <div className={`invoice-column ${workspace.workspace} ${workspace.invoice} px-4 py-5 sm:px-6 sm:py-6`}>

          <div className={`invoice-preview ${workspace.invoicePreview}`}>
            <InvoiceDocumentView doc={doc} />
          </div>

          {/* ── Editor (screen only) ───────────────────────────────────── */}
          <div className={`no-print ${workspace.invoiceEditor} space-y-4`}>

            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={newInvoice}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-display font-semibold"
                style={{ ...CARD, color: '#1F4D2B', cursor: 'pointer' }}>
                <FilePlus2 size={14} />New invoice
              </button>
              <button onClick={() => setShowSaved((s) => !s)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-display font-semibold"
                style={{ background: showSaved ? 'rgba(31,77,43,0.1)' : '#FFFEFA', border: '1px solid #E2D8C4', color: '#1F4D2B', cursor: 'pointer' }}>
                <Clock size={14} />Saved{saved.length ? ` (${saved.length})` : ''}
              </button>
              {currentId && (
                <span className="text-xs font-sans" style={{ color: '#8C7A62' }}>Editing {invoiceNo}</span>
              )}
            </div>

            {/* Saved-invoices list — tap to reopen/reprint */}
            {showSaved && (
              <div className="rounded-xl overflow-hidden" style={CARD}>
                <div className="px-3 py-2 text-xs font-sans leading-relaxed" style={{ color: '#5C5040', background: '#F7F2E9', borderBottom: '1px solid #E2D8C4' }}>
                  Marking an invoice paid adds its kg crop lines to My Records automatically.
                  Bags, crates and bunches are not converted because their weight is unknown.
                </div>
                {saved.length === 0 ? (
                  <div className="px-3 py-3 text-xs font-sans" style={{ color: '#8C7A62' }}>
                    No saved invoices yet — Print or Share one and it&apos;s kept here.
                  </div>
                ) : saved.map((inv) => (
                  <div key={inv.id} className="px-3 py-2.5" style={{ borderBottom: '1px solid #E2D8C4' }}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openSaved(inv)} className="flex-1 min-w-0 text-left" style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
                        <div className="font-display text-sm" style={{ color: '#20190F' }}>
                          #{String(inv.no).padStart(4, '0')} · {inv.billTo || 'No buyer'}
                        </div>
                        <div className="text-xs font-sans" style={{ color: '#8C7A62' }}>
                          {new Date(inv.dateISO).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </button>
                      <button
                        onClick={() => void changeInvoiceStatus(inv, inv.status === 'paid' ? 'unpaid' : 'paid')}
                        disabled={syncingInvoiceId === inv.id}
                        aria-label={inv.status === 'paid' ? 'Mark unpaid' : 'Mark paid'}
                        className="flex-shrink-0 px-2 py-1 rounded-full text-xs font-display font-semibold"
                        style={inv.status === 'paid'
                          ? { background: 'rgba(46,107,58,0.12)', border: '1px solid rgba(46,107,58,0.3)', color: '#2E6B3A', cursor: 'pointer' }
                          : { background: 'rgba(192,122,30,0.12)', border: '1px solid rgba(192,122,30,0.3)', color: '#C07A1E', cursor: 'pointer' }}>
                        {inv.status === 'paid' ? 'Paid' : 'Unpaid'}
                      </button>
                      {/* Two taps to destroy accounting history. The first tap used to be enough. */}
                      {confirmDelete === inv.id ? (
                        <button onClick={() => { deleteInvoice(inv.id); setConfirmDelete(null); }}
                          className="flex-shrink-0 px-2 py-1 rounded-full text-xs font-display font-semibold"
                          style={{ background: '#B53A3A', color: '#fff', border: 'none', cursor: 'pointer' }}>
                          Delete?
                        </button>
                      ) : (
                        <button onClick={() => setConfirmDelete(inv.id)} aria-label="Delete invoice"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#5C5040', opacity: 0.5 }}>
                          <X size={15} />
                        </button>
                      )}
                    </div>
                    {inv.status === 'paid' && (
                      <div className="flex flex-wrap gap-1.5 mt-2 pl-0.5">
                        {PAYMENT_METHODS.map((m) => (
                          <button key={m} onClick={() => void changeInvoiceStatus(inv, 'paid', m)}
                            disabled={syncingInvoiceId === inv.id}
                            className="px-2.5 py-1 rounded-full text-xs font-sans font-semibold capitalize transition-all"
                            style={inv.paymentMethod === m
                              ? { background: '#1F4D2B', color: '#fff', border: '1px solid #1F4D2B', cursor: 'pointer' }
                              : { background: '#FFFEFA', color: '#5C5040', border: '1px solid #E2D8C4', cursor: 'pointer' }}>
                            {paymentMethodLabel(m)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Your details (letterhead) ───────────────────────────── */}
            <Disclosure
              open={openPanel === 'seller'}
              onToggle={() => setOpenPanel((p) => (p === 'seller' ? null : 'seller'))}
              icon={<Landmark size={16} />}
              title="Your details & banking"
              hint={doc.bankingLines.length > 0 ? 'Printed on every invoice' : 'Add an address and bank account so buyers can pay you'}
            >
              {/* The business name is the one letterhead field that is NOT device-local — it
                  lives on the account, because it is the same on every device the farmer signs
                  in from. It is editable here anyway: this is the screen where somebody
                  discovers their invoice is headed with the wrong name, and sending them to
                  Account to fix it is how a two-tap change becomes an abandoned one. */}
              <label className="block">
                <FieldLabel>Business name</FieldLabel>
                <input value={businessNameDraft} onChange={(e) => setBusinessNameDraft(e.target.value)}
                  onBlur={saveBusinessName}
                  placeholder="e.g. Ubhejane Creche"
                  className="w-full text-sm font-display outline-none rounded-xl px-3 py-2.5" style={FIELD} />
                <div className="text-xs font-sans mt-1" style={{ color: '#8C7A62' }}>
                  {businessNameDraft.trim()
                    ? 'This heads your invoices. Your own name is printed underneath it.'
                    : 'Leave empty to invoice under your own name. Add a logo in Account.'}
                </div>
              </label>
              <p className="text-xs font-sans leading-relaxed" style={{ color: '#8C7A62' }}>
                Your name and phone come from your account. Everything else here is added to
                the letterhead on every invoice, and stays on this device.
              </p>
              <label className="block">
                <FieldLabel>Your address</FieldLabel>
                <textarea rows={2} value={letterhead.address} onChange={(e) => patchLetterhead({ address: e.target.value })}
                  placeholder={'Plot 14, Nquthu\nKwaZulu-Natal, 3135'}
                  className="w-full text-sm font-display outline-none rounded-xl px-3 py-2.5 resize-none" style={FIELD} />
              </label>
              <div className="flex gap-2">
                <label className="block flex-1 min-w-0">
                  <FieldLabel>Email</FieldLabel>
                  <input type="email" value={letterhead.email} onChange={(e) => patchLetterhead({ email: e.target.value })}
                    placeholder="you@example.co.za"
                    className="w-full text-sm font-display outline-none rounded-xl px-3 py-2.5" style={FIELD} />
                </label>
                <label className="block flex-1 min-w-0">
                  <FieldLabel>VAT / tax no.</FieldLabel>
                  <input value={letterhead.taxNumber} onChange={(e) => patchLetterhead({ taxNumber: e.target.value })}
                    placeholder="Optional"
                    className="w-full text-sm font-display outline-none rounded-xl px-3 py-2.5" style={FIELD} />
                </label>
              </div>
              <div className="pt-1">
                <FieldLabel>Where buyers pay you</FieldLabel>
                <div className="space-y-2">
                  <input value={letterhead.bankAccountName} onChange={(e) => patchLetterhead({ bankAccountName: e.target.value })}
                    placeholder="Account name" className="w-full text-sm font-display outline-none rounded-xl px-3 py-2.5" style={FIELD} />
                  <div className="flex gap-2">
                    <input value={letterhead.bankName} onChange={(e) => patchLetterhead({ bankName: e.target.value })}
                      placeholder="Bank" className="flex-1 min-w-0 text-sm font-display outline-none rounded-xl px-3 py-2.5" style={FIELD} />
                    <input value={letterhead.bankBranchCode} onChange={(e) => patchLetterhead({ bankBranchCode: e.target.value })}
                      placeholder="Branch code" className="w-28 text-sm font-display outline-none rounded-xl px-3 py-2.5" style={FIELD} />
                  </div>
                  <input value={letterhead.bankAccountNumber} onChange={(e) => patchLetterhead({ bankAccountNumber: e.target.value })}
                    placeholder="Account number" inputMode="numeric"
                    className="w-full text-sm font-display outline-none rounded-xl px-3 py-2.5 tabular-nums" style={FIELD} />
                </div>
              </div>
            </Disclosure>

            {/* ── Bill to ────────────────────────────────────────────── */}
            <div className="rounded-xl p-3 space-y-2.5" style={CARD}>
              <label className="block">
                <FieldLabel>Bill to</FieldLabel>
                <select
                  aria-label="Bill to"
                  value={customBuyer ? '__custom__' : billTo}
                  onChange={(event) => {
                    if (event.target.value === '__custom__') {
                      setCustomBuyer(true);
                      selectBuyer('');
                    } else {
                      setCustomBuyer(false);
                      selectBuyer(event.target.value);
                    }
                  }}
                  className="w-full text-sm font-display outline-none rounded-xl px-3 py-2.5"
                  style={FIELD}
                >
                  <option value="">Choose a customer</option>
                  {customers.length > 0 && (
                    <optgroup label="Your saved customers">
                      {customers.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </optgroup>
                  )}
                  <optgroup label="Customer types">
                    {BUYER_TYPES.map((name) => <option key={name} value={name}>{name}</option>)}
                  </optgroup>
                  <option value="__custom__">＋ Add another customer…</option>
                </select>
                {customBuyer && (
                  <input
                    autoFocus
                    value={billTo}
                    onChange={(event) => setBillTo(event.target.value)}
                    placeholder="Customer name"
                    className="w-full mt-2 text-sm font-display outline-none rounded-xl px-3 py-2.5"
                    style={FIELD}
                  />
                )}
              </label>

              <Disclosure
                open={openPanel === 'buyer'}
                onToggle={() => setOpenPanel((p) => (p === 'buyer' ? null : 'buyer'))}
                icon={<Building2 size={16} />}
                title="Buyer address & contact"
                hint={doc.buyerLines.length > 0 ? doc.buyerLines[0] : 'Optional — printed under the buyer name'}
              >
                <label className="block">
                  <FieldLabel>Address</FieldLabel>
                  <textarea rows={2} value={buyerDetails.address ?? ''} onChange={(e) => setBuyerDetails((d) => ({ ...d, address: e.target.value }))}
                    placeholder={'Shop 3, Main Road\nNquthu'}
                    className="w-full text-sm font-display outline-none rounded-xl px-3 py-2.5 resize-none" style={FIELD} />
                </label>
                <div className="flex gap-2">
                  <label className="block flex-1 min-w-0">
                    <FieldLabel>Phone</FieldLabel>
                    <input type="tel" value={buyerDetails.phone ?? ''} onChange={(e) => setBuyerDetails((d) => ({ ...d, phone: e.target.value }))}
                      placeholder="072 345 6789"
                      className="w-full text-sm font-display outline-none rounded-xl px-3 py-2.5" style={FIELD} />
                  </label>
                  <label className="block flex-1 min-w-0">
                    <FieldLabel>Email</FieldLabel>
                    <input type="email" value={buyerDetails.email ?? ''} onChange={(e) => setBuyerDetails((d) => ({ ...d, email: e.target.value }))}
                      placeholder="Optional"
                      className="w-full text-sm font-display outline-none rounded-xl px-3 py-2.5" style={FIELD} />
                  </label>
                </div>
              </Disclosure>
            </div>

            {/* ── Line items ──────────────────────────────────────────── */}
            <div className="space-y-2.5">
              <FieldLabel>Line items</FieldLabel>
              {items.map((it) => (
                <div key={it.id} className="rounded-xl p-3 space-y-2" style={CARD}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <CropSelect
                        ariaLabel="Crop or product"
                        value={it.desc}
                        rememberedCrops={products.map((product) => product.desc)}
                        onChange={(crop, cropKey) => chooseCrop(it.id, crop, cropKey)}
                      />
                    </div>
                    <button onClick={() => removeItem(it.id)} aria-label="Remove item"
                      className="flex-shrink-0 opacity-40 hover:opacity-80 transition-opacity"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#5C5040' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* parseFloat, not parseInt: UNITS includes kg and crates, and 12.5 kg of tomatoes became 12 —
                        the farmer underpaid on the document the buyer pays from, always in the same
                        direction. Worse, a sub-unit line (0.75 kg of chillies) became 0, which
                        cleanInvoice rejects, which rejects the WHOLE invoice, which meant a printed
                        and WhatsApped invoice with no stored record. */}
                    <input type="number" min={0} step="0.01" inputMode="decimal" value={it.qty || ''} onChange={(e) => updateItem(it.id, { qty: Math.max(0, parseFloat(e.target.value) || 0) })}
                      placeholder="Qty" aria-label="Quantity"
                      className="w-16 text-sm font-display outline-none rounded-lg px-2.5 py-2 tabular-nums" style={FIELD} />
                    <select value={it.unit} aria-label="Unit" onChange={(e) => updateItem(it.id, {
                      unit: e.target.value,
                      ...(it.unit === 'kg' && e.target.value !== 'kg' ? { price: 0, priceFromGuide: false } : {}),
                    })}
                      className="text-sm font-display outline-none rounded-lg px-2 py-2 appearance-none" style={FIELD}>
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <div className="flex items-center gap-1 flex-1 rounded-lg px-2.5 py-2" style={FIELD}>
                      <span className="text-sm font-display" style={{ color: '#8C7A62' }}>R</span>
                      <input type="number" min={0} inputMode="decimal" value={it.price || ''} onChange={(e) => updateItem(it.id, { price: Math.max(0, parseFloat(e.target.value) || 0), priceFromGuide: false })}
                        placeholder="0" aria-label="Price each"
                        className="w-full text-sm font-display outline-none tabular-nums"
                        style={{ background: 'transparent', border: 'none', color: '#20190F' }} />
                      <span className="text-xs font-sans whitespace-nowrap" style={{ color: '#8C7A62' }}>each</span>
                    </div>
                  </div>
                  {(() => {
                    const crop = cropEntryOption(it.desc);
                    const guide = crop ? priceFor(crop.key, priceOverrides) : null;
                    if (!guide || it.unit !== 'kg') return null;
                    const first = wholesaleBuyer
                      ? `Shops/bulk about R${guide.wholesalePerKg}/kg`
                      : `Direct/farm gate about R${guide.retailPerKg}/kg`;
                    const second = wholesaleBuyer
                      ? `direct/farm gate about R${guide.retailPerKg}/kg`
                      : `shops/bulk about R${guide.wholesalePerKg}/kg`;
                    return (
                      <div className="rounded-lg px-2.5 py-2 text-xs font-sans leading-relaxed" style={{ background: '#F7F2E9', color: '#5C5040' }}>
                        {it.priceFromGuide && (
                          <div className="font-semibold mb-0.5" style={{ color: '#1F4D2B' }}>
                            Suggested price filled in — change it if you agreed something else.
                          </div>
                        )}
                        <strong style={{ color: '#20190F' }}>{first}</strong> · {second} — guide price from {priceDateLabel(guide)}.
                        {' '}{guide.confidence === 'estimated' ? 'Estimated; confirm locally.' : 'Sourced guide.'}
                      </div>
                    );
                  })()}
                </div>
              ))}

              <button onClick={addItem}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-display font-semibold"
                style={{ background: 'rgba(31,77,43,0.06)', border: '1px dashed rgba(31,77,43,0.3)', color: '#1F4D2B', cursor: 'pointer' }}>
                <Plus size={14} />Add line item
              </button>
            </div>

            {/* ── Terms, reference, note ──────────────────────────────── */}
            <div className="rounded-xl p-3 space-y-2.5" style={CARD}>
              <div>
                <FieldLabel>Payment due</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {TERM_CHOICES.map((choice) => (
                    <button key={choice.label}
                      onClick={() => { setTermsDays(choice.days); patchLetterhead({ paymentTermsDays: choice.days }); }}
                      className="px-2.5 py-1.5 rounded-full text-xs font-sans font-semibold"
                      style={termsDays === choice.days
                        ? { background: '#1F4D2B', color: '#fff', border: '1px solid #1F4D2B', cursor: 'pointer' }
                        : { background: '#fff', color: '#5C5040', border: '1px solid #E2D8C4', cursor: 'pointer' }}>
                      {choice.label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <FieldLabel>Buyer&apos;s reference</FieldLabel>
                <input value={reference} onChange={(e) => setReference(e.target.value)}
                  placeholder="Their order number — optional"
                  className="w-full text-sm font-display outline-none rounded-xl px-3 py-2.5" style={FIELD} />
              </label>
              <label className="block">
                <FieldLabel>Growing area for these sales</FieldLabel>
                <select value={enterprise} onChange={e => setEnterprise(e.target.value as typeof enterprise)} className="w-full text-sm rounded-xl px-3 py-2.5" style={FIELD}>
                  <option value="">Unassigned / mixed invoice</option><option value="vegetables">Vegetable beds</option><option value="staples">Staple plots</option><option value="other">Orchard / other</option>
                </select>
                <span className="block text-xs mt-1">For your R/m² records. Choose only if every line belongs to this area.</span>
              </label>
              <label className="block">
                <FieldLabel>Note on the invoice</FieldLabel>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => patchLetterhead({ notes })}
                  placeholder="Delivery Thursday. Crates returned with next order."
                  className="w-full text-sm font-display outline-none rounded-xl px-3 py-2.5 resize-none" style={FIELD} />
              </label>
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

            {saveError && (
              <p className="text-center text-xs font-sans px-3 py-2 rounded-lg" style={{ color: '#B53A3A', background: '#FBEAEA', border: '1px solid #E8C4C4' }}>
                {saveError}
              </p>
            )}

            {!valid && (
              <p className="text-center text-xs font-sans" style={{ color: '#8C7A62' }}>
                Add a buyer and at least one item to print
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="no-print"><TabBar /></div>

      {/* Print styles — see the note in components/invoice/InvoiceDocument.tsx.
          The old rules whitened <body> but not this page's own beige wrapper, and left the 28rem
          reading column in place, so A4 came out as a narrow strip of invoice on a full page of
          tinted background. */}
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 16mm 15mm; }
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-shadow: none !important;
          }
          html, body { background: #fff !important; }
          .no-print { display: none !important; }

          /* Every ancestor between <body> and the document has to give up its screen layout,
             or the sheet inherits the app's background and its phone-width column. */
          .invoice-page, .invoice-scroll, .invoice-column, .invoice-preview {
            display: block !important;
            position: static !important;
            background: #fff !important;
            max-width: none !important;
            width: auto !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          #invoice-doc {
            border: none !important;
            border-radius: 0 !important;
            background: #fff !important;
            padding: 0 !important;
            font-size: 11pt;
          }
          #invoice-doc .invoice-seller-name { font-size: 20pt !important; }
          #invoice-doc .invoice-total { font-size: 18pt !important; }
          #invoice-doc .invoice-head { margin-bottom: 18pt !important; }
          #invoice-doc .invoice-mark { width: 34pt !important; height: 34pt !important; }
          /* A line item must not be split across two sheets, and the total must never begin a
             page on its own with no items above it. */
          #invoice-doc .invoice-row { break-inside: avoid; page-break-inside: avoid; }
          #invoice-doc .invoice-rows-head { break-after: avoid; page-break-after: avoid; }
          #invoice-doc .invoice-pay, #invoice-doc .invoice-notes { break-inside: avoid; page-break-inside: avoid; }
          #invoice-doc .invoice-footer { margin-top: 24pt !important; }
        }
      `}</style>
    </div>
  );
}

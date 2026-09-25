'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Info, X } from 'lucide-react';
import { CROPS } from '@/lib/crop-catalog';
import { loadCropPriceOverrides, priceFor } from '@/lib/crop-prices';
import {
  LISTING_CATEGORIES,
  LISTING_UNITS,
  priceLabel,
  quantityLabel,
  type Listing,
  type ListingCategory,
  type ListingKind,
  type ListingPrice,
  type ListingUnit,
  type PriceBasis,
} from '@/lib/exchange';
import { parseDecimalInput } from '@/lib/decimal-input';
import { saveLocalListing } from './listing-store';
import ShareListingButton from './ShareListingButton';
import { CATEGORY_LABEL, EX, KIND_COLOR, KIND_LABEL, MONTH_LABEL, ZU_CATEGORY_LABEL, ZU_KIND_LABEL, ZU_MONTH_LABEL, ZU_PRICE_MODE_LABEL } from './theme';
import { useLanguage } from '@/lib/i18n';
import { ExchangeSourceCopy } from './ExchangeCopy';

/** The bases a farmer actually quotes against. `PriceBasis` allows every unit; this is the useful subset. */
const PRICE_BASES: PriceBasis[] = ['kg', 'each', 'bunches', 'punnets', 'bags', 'days', 'lot'];

/** A sensible starting unit per category, so the common case needs no thought. */
const DEFAULT_UNIT: Record<ListingCategory, ListingUnit> = {
  seed: 'kg',
  seedlings: 'seedlings',
  produce: 'kg',
  tools: 'each',
  labour: 'days',
  other: 'each',
};

type PriceMode = ListingPrice['type'];

const PRICE_MODE_LABEL: Record<PriceMode, string> = {
  zar: 'Price in Rand',
  swap: 'Swap',
  free: 'Free',
  ask: 'Make an offer',
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.12em',
  color: EX.faint,
  marginBottom: 6,
};

const fieldStyle: React.CSSProperties = {
  fontSize: 14,
  background: '#fff',
  border: `1px solid ${EX.inputBorder}`,
  color: EX.ink,
  outline: 'none',
  width: '100%',
};

export default function NewListingForm({
  mySite,
  onPosted,
  onCancel,
}: {
  /** The farmer's own main site, if they have saved one. PRECISE — never stored on a listing as-is. */
  mySite: { name: string; lat: number; lon: number } | null;
  onPosted: (listings: Listing[]) => void;
  onCancel: () => void;
}) {
  const { lang } = useLanguage();
  const zu = lang === 'zu';
  const tx = (en: string, dz: string) => zu ? dz : en;
  const [kind, setKind] = useState<ListingKind>('offer');
  const [category, setCategory] = useState<ListingCategory>('produce');
  const [cropKey, setCropKey] = useState<string>('');
  const [title, setTitle] = useState('');
  const [titleDirty, setTitleDirty] = useState(false);
  const [description, setDescription] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState<ListingUnit>('kg');
  const [priceMode, setPriceMode] = useState<PriceMode>('zar');
  const [priceAmount, setPriceAmount] = useState('');
  const [priceDirty, setPriceDirty] = useState(false);
  const [priceBasis, setPriceBasis] = useState<PriceBasis>('kg');
  const [swapWants, setSwapWants] = useState('');
  const [month, setMonth] = useState('');
  const [farmerName, setFarmerName] = useState('');
  const [areaText, setAreaText] = useState('');
  const [shareArea, setShareArea] = useState(mySite !== null);

  // Set once handlePost() has actually saved the listing. Rendering the
  // confirmation off this — rather than calling onPosted() immediately — is
  // what gives the farmer a Share action on the listing they just made,
  // which for a device-local listing (see listing-store.ts) is the only way
  // it reaches anyone at all.
  const [justPosted, setJustPosted] = useState<{ listing: Listing; all: Listing[] } | null>(null);

  // Sorted by name so a farmer can find a crop by scanning, not by remembering
  // the catalog's planting order.
  const cropOptions = useMemo(
    () => [...CROPS].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  /**
   * The researched WHOLESALE figure, never retail. Retail sits 2-3x above
   * wholesale (see the note at the top of lib/crop-prices.ts) and a
   * farmer-to-farmer board defaulting to retail would systematically overprice
   * itself. Returns null for crops the price book deliberately leaves unpriced.
   */
  function suggestedPricePerKg(key: string): number | null {
    if (!key) return null;
    const price = priceFor(key, loadCropPriceOverrides());
    return price ? Math.round(price.wholesalePerKg * 10) / 10 : null;
  }

  function applyCrop(key: string) {
    setCropKey(key);
    const def = CROPS.find((c) => c.key === key);
    if (def && !titleDirty) {
      setTitle(kind === 'want' ? (zu ? `Ngifuna ${def.name}` : `Looking for ${def.name}`) : (zu ? `${def.name} iyatholakala` : `${def.name} available`));
    }
    if (!priceDirty && priceMode === 'zar' && priceBasis === 'kg') {
      const suggested = suggestedPricePerKg(key);
      setPriceAmount(suggested === null ? '' : String(suggested));
    }
  }

  function applyCategory(next: ListingCategory) {
    setCategory(next);
    setUnit(DEFAULT_UNIT[next]);
    if (next === 'tools' || next === 'labour') setCropKey('');
    if (next === 'labour' && !priceDirty) setPriceBasis('days');
  }

  const numericQty = qty.trim() === '' ? null : parseDecimalInput(qty);
  const numericPrice = priceAmount.trim() === '' ? null : parseDecimalInput(priceAmount);

  const qtyValid = numericQty === null || (Number.isFinite(numericQty) && numericQty > 0);
  const priceValid =
    priceMode !== 'zar' || (numericPrice !== null && Number.isFinite(numericPrice) && numericPrice > 0);
  const canPost = title.trim().length > 0 && qtyValid && priceValid;

  function buildPrice(): ListingPrice {
    switch (priceMode) {
      case 'zar':
        return { type: 'zar', amount: numericPrice ?? 0, per: priceBasis };
      case 'swap':
        return { type: 'swap', wants: swapWants.trim() || 'open to offers' };
      case 'free':
        return { type: 'free' };
      case 'ask':
        return { type: 'ask' };
    }
  }

  function handlePost() {
    if (!canPost) return;
    // The saved site's coordinate is PRECISE. saveLocalListing() coarsens it to
    // ~1.1 km before it is written to a listing — see the banner in
    // listing-store.ts. Nothing here may bypass that.
    const useCoords = shareArea && mySite !== null;
    const listings = saveLocalListing({
      kind,
      category,
      cropKey: cropKey === '' ? null : cropKey,
      title,
      description,
      qty: numericQty,
      unit: numericQty === null ? null : unit,
      price: buildPrice(),
      farmerName,
      areaText,
      lat: useCoords && mySite ? mySite.lat : null,
      lon: useCoords && mySite ? mySite.lon : null,
      availableMonth: month === '' ? null : Number(month),
    });
    // saveLocalListing() prepends the new record, so it is always listings[0].
    setJustPosted({ listing: listings[0], all: listings });
  }

  // ── Confirmation ─────────────────────────────────────────────────────────
  // This listing is saved on this phone only (see listing-store.ts) — it is
  // not sent to anyone. Sharing it themselves, right here, is the only way a
  // farmer's listing reaches another farmer at all, so it is the headline
  // action the moment a listing exists rather than something to go find.
  if (justPosted) {
    const { listing } = justPosted;
    const qty = quantityLabel(listing);
    return (
      <div
        className="rounded-2xl"
        style={{
          background: EX.card,
          border: `1px solid ${EX.border}`,
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div className="flex items-center gap-2.5">
          <CheckCircle2 size={20} strokeWidth={1.8} style={{ color: EX.green, flexShrink: 0 }} />
          <h2 className="font-display font-bold" style={{ fontSize: 16, color: EX.ink, margin: 0 }}>
            {tx('Listing saved', 'Isikhangiso silondoloziwe')}
          </h2>
        </div>
        <p className="font-sans" style={{ fontSize: 13, color: EX.muted, lineHeight: 1.55, margin: 0 }}>
          {zu ? <ExchangeSourceCopy en="It is saved on this phone only — nobody else can see it until you send it to them yourself. Share it now, or find it on the board any time and share it later." zu="Sigcinwe kule foni kuphela — akekho omunye ongakwazi ukusibona uze usithumele wena. Yabelana ngaso manje noma usithole ebhodini kamuva." /> : 'It is saved on this phone only — nobody else can see it until you send it to them yourself. Share it now, or find it on the board any time and share it later.'}
        </p>
        <div className="rounded-xl" style={{ background: 'rgba(226,216,196,0.4)', padding: 12 }}>
          <div className="font-display font-semibold" style={{ fontSize: 14, color: EX.ink, marginBottom: 4 }}>
            {listing.title}
          </div>
          <div className="font-sans" style={{ fontSize: 12.5, color: EX.muted }}>
            {[qty, zu && listing.price.type === 'free' ? 'Mahhala' : zu && listing.price.type === 'swap' ? `Ukushintshisana: ${listing.price.wants}` : zu && listing.price.type === 'ask' ? 'Cela isipho sentengo' : priceLabel(listing)].filter(Boolean).join(' · ')}
          </div>
        </div>
        <ShareListingButton listing={listing} label={tx('Share to WhatsApp', 'Yabelana nge-WhatsApp')} />
        <button
          onClick={() => onPosted(justPosted.all)}
          className="font-display font-semibold rounded-xl"
          style={{
            padding: 11,
            fontSize: 14,
            background: 'transparent',
            border: `1px solid ${EX.inputBorder}`,
            color: EX.muted,
            cursor: 'pointer',
          }}
        >
          {tx('Back to the board', 'Buyela ebhodini')}
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl"
      style={{
        background: EX.card,
        border: `1px solid ${EX.border}`,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div className="flex items-center">
        <h2 className="font-display font-bold" style={{ fontSize: 16, color: EX.ink, margin: 0 }}>
          {tx('Post a listing', 'Faka isikhangiso')}
        </h2>
        <div style={{ flex: 1 }} />
        <button
          onClick={onCancel}
          aria-label={tx('Close', 'Vala')}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: EX.faint, padding: 4 }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Offer or want */}
      <div>
        <div className="font-sans uppercase" style={labelStyle}>{tx('Are you offering or looking?', 'Ingabe kukhona okunikezayo noma okufunayo?')}</div>
        <div className="flex gap-2">
          {(['offer', 'want'] as ListingKind[]).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className="font-sans font-semibold"
              style={{
                flex: 1,
                padding: 9,
                borderRadius: 10,
                fontSize: 13,
                cursor: 'pointer',
                background: kind === k ? KIND_COLOR[k] : 'rgba(226,216,196,0.5)',
                color: kind === k ? '#fff' : EX.muted,
                border: `1px solid ${kind === k ? KIND_COLOR[k] : EX.border}`,
              }}
            >
              {zu ? ZU_KIND_LABEL[k] : KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      {/* Category */}
      <div>
        <div className="font-sans uppercase" style={labelStyle}>{tx('What kind of thing?', 'Uhlobo luni lwento?')}</div>
        <div className="flex gap-1.5 flex-wrap">
          {LISTING_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => applyCategory(c)}
              className="font-sans font-semibold"
              style={{
                padding: '7px 12px',
                borderRadius: 100,
                fontSize: 12.5,
                cursor: 'pointer',
                background: category === c ? EX.green : 'rgba(226,216,196,0.5)',
                color: category === c ? '#fff' : EX.muted,
                border: `1px solid ${category === c ? EX.green : EX.border}`,
              }}
            >
              {zu ? ZU_CATEGORY_LABEL[c] : CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      {/* Crop — from the catalog, never free text. A listing filed under a crop
          key is findable; one filed under a typed name is not. */}
      <div>
        <div className="font-sans uppercase" style={labelStyle}>{tx('Which crop?', 'Isiphi isitshalo?')}</div>
        <select
          value={cropKey}
          onChange={(e) => applyCrop(e.target.value)}
          className="rounded-xl px-3 py-2.5 font-sans"
          style={fieldStyle}
        >
          <option value="">{tx('Not a specific crop (tools, labour, other)', 'Akusona isitshalo esithile (amathuluzi, umsebenzi, okunye)')}</option>
          {cropOptions.map((c) => (
            <option key={c.key} value={c.key}>{c.icon} {c.name}</option>
          ))}
        </select>
        <p className="font-sans" style={{ fontSize: 11, color: EX.faint, margin: '6px 0 0', lineHeight: 1.45 }}>
          {tx('Pick from the list rather than typing a name — that is what lets another farmer filter the board by crop and actually find you.', 'Khetha ohlwini esikhundleni sokubhala igama ukuze omunye umlimi akuthole ngokuhlunga ngesitshalo.')}
        </p>
      </div>

      {/* Title */}
      <div>
        <div className="font-sans uppercase" style={labelStyle}>{tx('Headline', 'Isihloko')}</div>
        <input
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value.slice(0, 90)); setTitleDirty(true); }}
          placeholder={tx('Swiss chard — cutting weekly', 'I-Swiss chard — ngiyivuna masonto onke')}
          className="rounded-xl px-3 py-2.5 font-sans"
          style={fieldStyle}
        />
      </div>

      {/* Description */}
      <div>
        <div className="font-sans uppercase" style={labelStyle}>{tx('Detail (optional)', 'Imininingwane (uma uthanda)')}</div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 300))}
          placeholder={tx('Anything a buyer should know — variety, condition, collection.', 'Okufanele kwaziwe umthengi — uhlobo, isimo nendlela yokulanda.')}
          rows={3}
          className="rounded-xl px-3 py-2.5 font-sans"
          style={{ ...fieldStyle, resize: 'none', lineHeight: 1.5 }}
        />
      </div>

      {/* Quantity */}
      <div>
        <div className="font-sans uppercase" style={labelStyle}>{tx('How much? (optional)', 'Kungakanani? (uma uthanda)')}</div>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="12"
            className="rounded-xl px-3 py-2.5 font-sans"
            style={{ ...fieldStyle, flex: 1 }}
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as ListingUnit)}
            className="rounded-xl px-3 py-2.5 font-sans"
            style={{ ...fieldStyle, flex: 1 }}
          >
            {LISTING_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        {!qtyValid && (
          <p className="font-sans" style={{ fontSize: 11.5, color: EX.red, margin: '6px 0 0' }}>
            {tx('Quantity must be a number above zero — or leave it blank.', 'Inani kumele libe ngaphezu kukaziro — noma ushiye lingenalutho.')}
          </p>
        )}
      </div>

      {/* Price */}
      <div>
        <div className="font-sans uppercase" style={labelStyle}>{tx('Price, swap or free', 'Intengo, ukushintshisana noma mahhala')}</div>
        <div className="flex gap-1.5 flex-wrap" style={{ marginBottom: 10 }}>
          {(Object.keys(PRICE_MODE_LABEL) as PriceMode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setPriceMode(m); setPriceDirty(true); }}
              className="font-sans font-semibold"
              style={{
                padding: '7px 12px',
                borderRadius: 100,
                fontSize: 12.5,
                cursor: 'pointer',
                background: priceMode === m ? EX.amber : 'rgba(226,216,196,0.5)',
                color: priceMode === m ? '#fff' : EX.muted,
                border: `1px solid ${priceMode === m ? EX.amber : EX.border}`,
              }}
            >
              {tx(PRICE_MODE_LABEL[m], ZU_PRICE_MODE_LABEL[m])}
            </button>
          ))}
        </div>

        {priceMode === 'zar' && (
          <>
            <div className="flex gap-2 items-center">
              <span className="font-display font-semibold" style={{ fontSize: 15, color: EX.muted }}>R</span>
              <input
                type="text"
                inputMode="decimal"
                value={priceAmount}
                onChange={(e) => { setPriceAmount(e.target.value); setPriceDirty(true); }}
                placeholder="6"
                className="rounded-xl px-3 py-2.5 font-sans"
                style={{ ...fieldStyle, flex: 1 }}
              />
              <span className="font-sans" style={{ fontSize: 13, color: EX.faint }}>{tx('per', 'nge-')}</span>
              <select
                value={priceBasis}
                onChange={(e) => setPriceBasis(e.target.value as PriceBasis)}
                className="rounded-xl px-3 py-2.5 font-sans"
                style={{ ...fieldStyle, flex: 1 }}
              >
                {PRICE_BASES.map((b) => (
                  <option key={b} value={b}>{b === 'lot' ? tx('the lot', 'konke') : b}</option>
                ))}
              </select>
            </div>
            {cropKey !== '' && suggestedPricePerKg(cropKey) !== null && (
              <p className="font-sans" style={{ fontSize: 11, color: EX.faint, margin: '6px 0 0', lineHeight: 1.45 }}>
                {zu ? <ExchangeSourceCopy en={`Suggested from the app’s price book: about R${suggestedPricePerKg(cropKey)}/kg wholesale. Farm-gate, not shop shelf — change it to whatever you actually want.`} zu={`Intengo ephakanyisiwe isuselwa encwadini yohlelo yokubala amanani: cishe u-R${suggestedPricePerKg(cropKey)}/kg ngenani le-wholesale. Lena intengo yasepulazini, hhayi eyasesitolo — yishintshe ibe yinani olifunayo.`} /> : <>Suggested from the app&rsquo;s price book: about R{suggestedPricePerKg(cropKey)}/kg wholesale. Farm-gate, not shop shelf — change it to whatever you actually want.</>}
              </p>
            )}
            {!priceValid && (
              <p className="font-sans" style={{ fontSize: 11.5, color: EX.red, margin: '6px 0 0' }}>
                {tx('Enter an amount above zero, or choose Swap, Free or Make an offer.', 'Faka inani elingaphezu kukaziro, noma ukhethe ukushintshisana, mahhala noma ukubeka inani lakho.')}
              </p>
            )}
          </>
        )}

        {priceMode === 'swap' && (
          <input
            type="text"
            value={swapWants}
            onChange={(e) => setSwapWants(e.target.value.slice(0, 100))}
            placeholder={tx('What would you take? e.g. maize seed or pumpkin seed', 'Yini ongayamukela? Isib. imbewu yommbila noma yethanga')}
            className="rounded-xl px-3 py-2.5 font-sans"
            style={fieldStyle}
          />
        )}
      </div>

      {/* Month */}
      <div>
        <div className="font-sans uppercase" style={labelStyle}>
          {kind === 'want' ? tx('Needed by (optional)', 'Kudingeka nini? (uma uthanda)') : tx('Ready in (optional)', 'Kuyobe sekulungile nini? (uma uthanda)')}
        </div>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-xl px-3 py-2.5 font-sans"
          style={fieldStyle}
        >
          <option value="">{tx('Any time', 'Noma nini')}</option>
          {MONTH_LABEL.map((m, i) => <option key={m} value={i + 1}>{zu ? ZU_MONTH_LABEL[i] : m}</option>)}
        </select>
      </div>

      {/* Who and where */}
      <div>
        <div className="font-sans uppercase" style={labelStyle}>{tx('Your name', 'Igama lakho')}</div>
        <input
          type="text"
          value={farmerName}
          onChange={(e) => setFarmerName(e.target.value.slice(0, 60))}
          placeholder={tx("Your name or your group's name", 'Igama lakho noma leqembu lakho')}
          className="rounded-xl px-3 py-2.5 font-sans"
          style={fieldStyle}
        />
      </div>
      <div>
        <div className="font-sans uppercase" style={labelStyle}>{tx('Nearest town', 'Idolobha eliseduze')}</div>
        <input
          type="text"
          value={areaText}
          onChange={(e) => setAreaText(e.target.value.slice(0, 60))}
          placeholder={tx('e.g. Nquthu', 'isib. iNquthu')}
          className="rounded-xl px-3 py-2.5 font-sans"
          style={fieldStyle}
        />
      </div>

      {mySite && (
        <label className="flex items-start gap-2.5" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={shareArea}
            onChange={(e) => setShareArea(e.target.checked)}
            style={{ marginTop: 2, accentColor: EX.green, width: 16, height: 16, flexShrink: 0 }}
          />
          <span className="font-sans" style={{ fontSize: 12.5, color: EX.muted, lineHeight: 1.5 }}>
            {tx('Show roughly where I am, so nearby farmers see the distance.', 'Khombisa cishe indawo engikuyo ukuze abalimi abaseduze babone ibanga.')}
            <span style={{ color: EX.faint }}>
              {' '}{zu ? <ExchangeSourceCopy en={`Your location is rounded to about a kilometre before it is saved — never your exact homestead. Based on ${mySite.name}.`} zu={`Indawo yakho isondezwa cishe kwikhilomitha elilodwa ngaphambi kokugcinwa — akuboniswa umuzi wakho ngqo. Kususelwa ku-${mySite.name}.`} /> : <>Your location is rounded to about a kilometre before it is saved — never your exact homestead. Based on <strong style={{ fontWeight: 600 }}>{mySite.name}</strong>.</>}
            </span>
          </span>
        </label>
      )}

      <div
        className="flex items-start gap-2 rounded-xl"
        style={{ background: 'rgba(226,216,196,0.4)', padding: '10px 12px' }}
      >
        <Info size={13} strokeWidth={1.9} style={{ color: EX.faint, marginTop: 1.5, flexShrink: 0 }} />
        <span className="font-sans" style={{ fontSize: 11.5, color: EX.faint, lineHeight: 1.5 }}>
          {zu ? <ExchangeSourceCopy en="This listing is saved on this phone only. It is not sent to other farmers and nobody else can see it — sharing listings between farmers is not built yet." zu="Lesi sikhangiso sigcinwa kule foni kuphela. Asithunyelwa kwabanye abalimi futhi akekho omunye ongakwazi ukusibona — ukwabelana ngezikhangiso phakathi kwabalimi akukakhiwa." /> : 'This listing is saved on this phone only. It is not sent to other farmers and nobody else can see it — sharing listings between farmers is not built yet.'}
        </span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="font-sans font-semibold rounded-xl"
          style={{
            flex: 1,
            padding: 11,
            fontSize: 13.5,
            background: 'transparent',
            border: `1px solid ${EX.inputBorder}`,
            color: EX.muted,
            cursor: 'pointer',
          }}
        >
          {tx('Cancel', 'Khansela')}
        </button>
        <button
          onClick={handlePost}
          disabled={!canPost}
          className="font-display font-semibold rounded-xl"
          style={{
            flex: 2,
            padding: 11,
            fontSize: 14,
            background: canPost ? EX.green : 'rgba(32,25,15,0.1)',
            color: canPost ? '#F7F2E9' : '#755942',
            border: 'none',
            cursor: canPost ? 'pointer' : 'default',
          }}
        >
          {tx('Save listing', 'Londoloza isikhangiso')}
        </button>
      </div>
    </div>
  );
}

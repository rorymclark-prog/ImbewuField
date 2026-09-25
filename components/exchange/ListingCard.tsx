'use client';

import { Calendar, CircleSlash, Info, MapPin, Tag, Trash2 } from 'lucide-react';
import {
  distanceBucket,
  listingCrop,
  priceLabel,
  quantityLabel,
  type ListingWithDistance,
} from '@/lib/exchange';
import ShareListingButton from './ShareListingButton';
import { CATEGORY_LABEL, EX, KIND_COLOR, KIND_LABEL, MONTH_LABEL, ZU_CATEGORY_LABEL, ZU_KIND_LABEL, ZU_MONTH_LABEL } from './theme';
import { getCropArt } from '@/lib/crop-art';
import { useLanguage } from '@/lib/i18n';
import { ExchangeSourceCopy } from './ExchangeCopy';

/**
 * Distance is coloured by bucket so a scan down the board reads as a map:
 * green is "you could walk there", grey is "that is a trip".
 */
const BUCKET_COLOR: Record<ReturnType<typeof distanceBucket>, string> = {
  here: EX.green,
  near: EX.ink,
  district: EX.muted,
  far: EX.faint,
  unknown: EX.faint,
};

/**
 * Posted-time is rendered from `nowMs`, which the board only sets after mount.
 * The demo board's timestamps are built at module load, and that happens at a
 * different wall-clock instant on the server than in the browser — so any
 * time-ago string computed during the server render would disagree with the
 * client's and trip a hydration mismatch. Null until mounted, and the line is
 * simply absent from the server HTML.
 */
function postedLabel(postedAt: string, nowMs: number | null, zu: boolean): string | null {
  if (nowMs === null) return null;
  const then = Date.parse(postedAt);
  if (!Number.isFinite(then)) return null;
  const diff = nowMs - then;
  if (diff < 3_600_000) return zu ? 'Manje nje' : 'Just now';
  if (diff < 86_400_000) return zu ? `Emahoreni angu-${Math.floor(diff / 3_600_000)} adlule` : `${Math.floor(diff / 3_600_000)}h ago`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 30) return zu ? `Ezinsukwini ezingu-${days} ezedlule` : `${days}d ago`;
  return zu ? `Ezinyangeni ezingu-${Math.floor(days / 30)} ezedlule` : `${Math.floor(days / 30)}mo ago`;
}

export default function ListingCard({
  row,
  nowMs,
  mine,
  hasOrigin,
  onClose,
  onDelete,
}: {
  row: ListingWithDistance;
  nowMs: number | null;
  mine: boolean;
  /**
   * Whether the viewer has told us where they are. `km === null` means two very
   * different things — "this listing has no coordinates" and "you have not said
   * where you are standing" — and `withDistance()` cannot tell them apart, so
   * it labels both "Area unknown". The card can tell them apart, and must: a
   * board where every row says "Area unknown" purely because nobody picked a
   * vantage point reads as broken data rather than a missing setting.
   */
  hasOrigin: boolean;
  onClose: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { lang } = useLanguage();
  const zu = lang === 'zu';
  const tx = (en: string, dz: string) => zu ? dz : en;
  const { listing, km, distanceLabel } = row;
  const crop = listingCrop(listing);
  const qty = quantityLabel(listing);
  const posted = postedLabel(listing.postedAt, nowMs, zu);
  const price = zu && listing.price.type === 'free' ? 'Mahhala'
    : zu && listing.price.type === 'swap' ? `Ukushintshisana: ${listing.price.wants}`
      : zu && listing.price.type === 'ask' ? 'Beka intengo yakho'
        : priceLabel(listing);
  const closed = listing.status === 'closed';

  return (
    <article
      className="rounded-2xl"
      style={{
        background: EX.card,
        border: `1px solid ${EX.border}`,
        padding: 16,
        opacity: closed ? 0.62 : 1,
      }}
    >
      {/* Kind · category · crop · posted */}
      <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 8 }}>
        <span
          className="font-sans font-bold uppercase"
          style={{
            fontSize: 10,
            padding: '3px 9px',
            borderRadius: 100,
            background: KIND_COLOR[listing.kind],
            color: '#FFFEFA',
            letterSpacing: '0.05em',
          }}
        >
          {zu ? ZU_KIND_LABEL[listing.kind] : KIND_LABEL[listing.kind]}
        </span>
        <span className="font-sans" style={{ fontSize: 11.5, color: EX.faint }}>
          {zu ? ZU_CATEGORY_LABEL[listing.category] : CATEGORY_LABEL[listing.category]}
        </span>
        {crop && (
          <span className="font-sans" style={{ fontSize: 11.5, color: EX.muted, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            {getCropArt(listing.cropKey ?? '') ? (
              <img className="produce-art" src={getCropArt(listing.cropKey ?? '')} alt="" aria-hidden style={{ width: 12, height: 12, objectFit: 'contain' }} />
            ) : (
              <span>{crop.icon}</span>
            )}{' '}
            {crop.name}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 8 }} />
        {mine && (
          <span
            className="font-sans font-semibold"
            style={{
              fontSize: 10,
              padding: '2px 7px',
              borderRadius: 100,
              background: 'rgba(31,77,43,0.1)',
              color: EX.green,
              border: '1px solid rgba(31,77,43,0.2)',
            }}
          >
            {tx('Yours · this device only', 'Okungokwakho · kule divayisi kuphela')}
          </span>
        )}
        {listing.isDemo && (
          <span
            className="font-sans font-semibold"
            style={{
              fontSize: 10,
              padding: '2px 7px',
              borderRadius: 100,
              background: 'rgba(192,122,30,0.12)',
              color: EX.amber,
              border: '1px solid rgba(192,122,30,0.28)',
            }}
          >
            {tx('Sample', 'Isibonelo')}
          </span>
        )}
        {posted && (
        <span className="font-sans" style={{ fontSize: 11, color: EX.faint }}>{posted}</span>
        )}
      </div>

      <h3 className="font-display font-semibold" style={{ fontSize: 15, color: EX.ink, margin: '0 0 4px' }}>
        {listing.title}
      </h3>
      {listing.description && (
        <p className="font-sans" style={{ fontSize: 13, color: EX.muted, lineHeight: 1.5, margin: '0 0 10px' }}>
          {listing.description}
        </p>
      )}

      {/* Quantity · price · month */}
      <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 10 }}>
        {qty && (
          <span
            className="font-sans font-semibold rounded-lg"
            style={{ fontSize: 12.5, padding: '4px 10px', background: 'rgba(226,216,196,0.55)', color: EX.ink }}
          >
            {qty}
          </span>
        )}
        <span
          className="flex items-center gap-1.5 font-sans font-semibold rounded-lg"
          style={{
            fontSize: 12.5,
            padding: '4px 10px',
            background: listing.price.type === 'zar' ? 'rgba(31,77,43,0.09)' : 'rgba(192,122,30,0.12)',
            color: listing.price.type === 'zar' ? EX.green : EX.amber,
          }}
        >
          <Tag size={11} strokeWidth={2} />
          {price}
        </span>
        {listing.availableMonth !== null && (
          <span className="flex items-center gap-1.5 font-sans" style={{ fontSize: 12, color: EX.faint }}>
            <Calendar size={11} strokeWidth={1.8} />
            {zu ? (listing.kind === 'want' ? 'Kudingeka ngaphambi kuka' : 'Kulungile ngo') + ZU_MONTH_LABEL[listing.availableMonth - 1].slice(1) : (listing.kind === 'want' ? 'Needed by' : 'Ready') + ' ' + MONTH_LABEL[listing.availableMonth - 1]}
          </span>
        )}
        {closed && (
          <span className="flex items-center gap-1.5 font-sans font-semibold" style={{ fontSize: 12, color: EX.faint }}>
            <CircleSlash size={11} strokeWidth={1.8} /> {tx('Closed', 'Kuvaliwe')}
          </span>
        )}
      </div>

      {/* Who and where. A distance is shown only once the viewer has a vantage
          point; `distanceLabel` is never a misleading 0 km. */}
      <div className="flex items-center gap-1.5 flex-wrap" style={{ marginBottom: mine ? 12 : 10 }}>
        <MapPin size={11.5} strokeWidth={1.8} style={{ color: EX.faint, flexShrink: 0 }} />
        <span className="font-sans" style={{ fontSize: 12, color: EX.muted }}>
          {listing.farmerName}
        </span>
        <span className="font-sans" style={{ fontSize: 12, color: EX.faint }}>
          · {listing.areaText || tx('Area not given', 'Indawo ayichazwanga')}
        </span>
        {hasOrigin && (
          <span
            className="font-sans font-semibold"
            style={{ fontSize: 12, color: BUCKET_COLOR[distanceBucket(km)] }}
          >
            · {distanceLabel}
          </span>
        )}
      </div>

      {mine ? (
        <div className="flex items-center gap-2 flex-wrap">
          <ShareListingButton listing={listing} />
          {!closed && (
            <button
              onClick={() => onClose(listing.id)}
              className="font-sans font-semibold rounded-lg"
              style={{
                fontSize: 12,
                padding: '6px 12px',
                background: 'rgba(31,77,43,0.08)',
                color: EX.green,
                border: '1px solid rgba(31,77,43,0.2)',
                cursor: 'pointer',
              }}
            >
              {tx('Mark as done', 'Phawula njengokuqediwe')}
            </button>
          )}
          <button
            onClick={() => onDelete(listing.id)}
            className="flex items-center gap-1.5 font-sans font-semibold rounded-lg"
            style={{
              fontSize: 12,
              padding: '6px 12px',
              background: 'transparent',
              color: EX.red,
              border: '1px solid rgba(139,32,32,0.25)',
              cursor: 'pointer',
            }}
          >
            <Trash2 size={11.5} strokeWidth={1.9} /> {tx('Delete', 'Susa')}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 items-start">
          <ShareListingButton listing={listing} />
          {/* NO CONTACT BUTTON, DELIBERATELY. There is no messaging in this
              preview, so a "Message" or "Contact" control would be a dead
              button promising a feature that does not exist. State the
              position instead — Share above is a real, working alternative:
              it hands this listing on to whoever the farmer forwards it to. */}
          <div
            className="flex items-start gap-2 rounded-lg"
            style={{ background: 'rgba(226,216,196,0.4)', padding: '8px 10px' }}
          >
            <Info size={12} strokeWidth={1.9} style={{ color: EX.faint, marginTop: 1.5, flexShrink: 0 }} />
            <span className="font-sans" style={{ fontSize: 11.5, color: EX.faint, lineHeight: 1.45 }}>
              {zu ? <ExchangeSourceCopy en="No way to contact this farmer from the app yet. For now, note the name and area and arrange it through your facilitator or group." zu="Okwamanje alikho ithuluzi lokuxhumana nalo mlimi ngalolu hlelo lokusebenza. Bhala igama nendawo, bese uhlela ngokusebenzisa umsizi wakho noma iqembu." /> : 'No way to contact this farmer from the app yet. For now, note the name and area and arrange it through your facilitator or group.'}
            </span>
          </div>
        </div>
      )}
    </article>
  );
}

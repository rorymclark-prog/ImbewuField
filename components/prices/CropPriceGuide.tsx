'use client';

import { AlertTriangle, CheckCircle2, ChevronLeft } from 'lucide-react';
import { formatPrice, PRICE_SNAPSHOT_DATE, type PricedCrop } from './CropPriceGuide.format';
import { getCropArt } from '@/lib/crop-art';

/**
 * The negotiation screen itself: one crop, two numbers, in the biggest type on the page — and,
 * ranked ABOVE both numbers, how solid they are. A farmer reads this standing at the gate, under
 * pressure from a trader who already knows the going price; a confident-looking number that is
 * actually a rough estimate is the one failure mode worse than showing no number at all, so the
 * confidence badge is not a footnote here.
 */
export function CropPriceDetail({ crop, onChangeCrop }: { crop: PricedCrop; onChangeCrop: () => void }) {
  const { price } = crop;
  const sourced = price.confidence === 'sourced';
  return (
    <div className="flex flex-col items-center text-center">
      <button
        type="button"
        onClick={onChangeCrop}
        className="font-sans font-semibold"
        style={{
          alignSelf: 'flex-start',
          fontSize: 14,
          color: 'var(--color-forest-800)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 0 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          minHeight: 44,
        }}
      >
        <ChevronLeft size={18} strokeWidth={2} /> All crops
      </button>

      {getCropArt(crop.key) ? (
        <img src={getCropArt(crop.key)} alt="" aria-hidden style={{ width: 68, height: 68, objectFit: 'contain' }} />
      ) : (
        <div style={{ fontSize: 68, lineHeight: 1 }}>{crop.icon}</div>
      )}
      <div
        className="font-display font-bold"
        style={{ fontSize: 26, color: 'var(--color-ink)', marginTop: 10, letterSpacing: '-0.01em' }}
      >
        {crop.name}
      </div>

      <div
        className="flex items-center gap-2"
        style={{
          marginTop: 16,
          padding: '8px 16px',
          borderRadius: 999,
          background: sourced ? 'rgba(31,77,43,0.10)' : 'rgba(192,122,30,0.16)',
          color: sourced ? 'var(--color-forest-800)' : 'var(--color-harvest)',
        }}
      >
        {sourced ? <CheckCircle2 size={17} strokeWidth={2.2} /> : <AlertTriangle size={17} strokeWidth={2.2} />}
        <span className="font-sans font-bold" style={{ fontSize: 13.5 }}>
          {sourced ? 'Real market price' : 'Rough estimate — not confirmed'}
        </span>
      </div>
      <div className="font-sans" style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 6, maxWidth: 260 }}>
        Priced {PRICE_SNAPSHOT_DATE} — always check today&apos;s real price before you agree.
      </div>

      <div style={{ width: '100%', marginTop: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: 'var(--color-forest-800)', borderRadius: 24, padding: '22px 18px' }}>
          <div
            className="font-sans font-bold uppercase tracking-widest"
            style={{ fontSize: 12, color: 'rgba(247,242,233,0.78)', letterSpacing: '0.1em' }}
          >
            Wholesale
          </div>
          <div
            className="font-display font-bold"
            style={{ fontSize: 54, color: '#F7F2E9', lineHeight: 1.05, marginTop: 4 }}
          >
            R{formatPrice(price.wholesalePerKg)}
          </div>
          <div className="font-sans" style={{ fontSize: 13, color: 'rgba(247,242,233,0.78)' }}>
            per kg — closer to what a trader or market buyer pays
          </div>
        </div>

        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 24,
            padding: '18px 18px',
          }}
        >
          <div
            className="font-sans font-bold uppercase tracking-widest"
            style={{ fontSize: 12, color: 'var(--color-muted)', letterSpacing: '0.1em' }}
          >
            Retail
          </div>
          <div
            className="font-display font-bold"
            style={{ fontSize: 40, color: 'var(--color-ink)', lineHeight: 1.05, marginTop: 4 }}
          >
            R{formatPrice(price.retailPerKg)}
          </div>
          <div className="font-sans" style={{ fontSize: 13, color: 'var(--color-muted)' }}>
            per kg — shop shelf price, not a farm-gate price
          </div>
        </div>
      </div>
    </div>
  );
}

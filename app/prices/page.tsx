'use client';

import { useEffect, useMemo, useState } from 'react';
import BackButton from '@/components/BackButton';
import BrandLogo from '@/components/BrandLogo';
import SettingsButton from '@/components/SettingsButton';
import LessonLink from '@/components/design/LessonLink';
import TabBar from '@/components/TabBar';
import { CropPriceDetail } from '@/components/prices/CropPriceGuide';
import { pricedCropList } from '@/components/prices/CropPriceGuide.format';
import MenuButton from '@/components/MenuButton';
import { loadCropPriceOverrides, type CropPrice } from '@/lib/crop-prices';
import { getCropArt } from '@/lib/crop-art';

/**
 * A standalone screen a farmer can open DURING a negotiation: pick a crop with a tap (no typing —
 * this audience is low-literacy and isiZulu-first, so the picker is icons and names to scan, the
 * same reasoning as components/exchange/NewListingForm.tsx's sorted-by-name crop list), then see
 * that crop's wholesale and retail price per kg in the largest type on the page, with nothing else
 * competing for attention. See components/prices/CropPriceGuide.tsx for the price book lookup and
 * the confidence badge that keeps an estimate from reading as a confirmed fact.
 */
export default function PricesPage() {
  const [overrides, setOverrides] = useState<Record<string, CropPrice>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Farmer price corrections live in localStorage (lib/crop-prices.ts), so this can only be read
  // client-side, after mount — same pattern as every other priceFor() caller in this app.
  useEffect(() => setOverrides(loadCropPriceOverrides()), []);

  const crops = useMemo(() => pricedCropList(overrides), [overrides]);
  const selected = crops.find((crop) => crop.key === selectedKey) ?? null;

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: 'var(--color-canvas)' }}>
      {/* Header — the in-header BackButton keeps the global floating back pill away; see
          components/BackButton.tsx and tests/back-control.test.ts. */}
      <header
        className="flex-shrink-0 flex items-center px-3 sm:px-4 gap-2 sm:gap-3"
        style={{ height: 52, background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
      >
        <MenuButton />
        <BackButton fallback="/home" />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: 'var(--color-border)' }} />
        <span className="text-xs font-display truncate min-w-0" style={{ color: 'var(--color-muted-strong)' }}>Farm-gate prices</span>
        <div className="flex-1" />
        <LessonLink id="prices:overview" label="Learn" />
        <SettingsButton />
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-5 max-w-md mx-auto w-full">
        {selected ? (
          <CropPriceDetail crop={selected} onChangeCrop={() => setSelectedKey(null)} />
        ) : (
          <>
            <p className="font-sans" style={{ fontSize: 13, color: 'var(--color-muted-strong)', lineHeight: 1.5 }}>
              Tap a crop to see today&apos;s wholesale and retail price per kg — for when you&apos;re standing at the gate.
            </p>
            <div className="grid grid-cols-2 gap-3" style={{ marginTop: 16 }}>
              {crops.map((crop) => (
                <button
                  key={crop.key}
                  type="button"
                  onClick={() => setSelectedKey(crop.key)}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl text-center"
                  style={{
                    minHeight: 92,
                    padding: '14px 8px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    cursor: 'pointer',
                  }}
                >
                  {getCropArt(crop.key) ? (
                    <img src={getCropArt(crop.key)} alt="" aria-hidden style={{ width: 32, height: 32, objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: 32, lineHeight: 1 }}>{crop.icon}</span>
                  )}
                  <span
                    className="font-display font-semibold"
                    style={{ fontSize: 13.5, color: 'var(--color-ink)', lineHeight: 1.25 }}
                  >
                    {crop.name}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </main>

      <TabBar />
    </div>
  );
}

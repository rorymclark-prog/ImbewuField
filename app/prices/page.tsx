'use client';

import workspace from '@/components/layout/Workspace.module.css';

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
import { useLanguage } from '@/lib/i18n';

/**
 * A standalone screen a farmer can open DURING a negotiation: pick a crop with a tap (no typing —
 * this audience is low-literacy and isiZulu-first, so the picker is icons and names to scan, the
 * same reasoning as components/exchange/NewListingForm.tsx's sorted-by-name crop list), then see
 * that crop's wholesale and retail price per kg in the largest type on the page, with nothing else
 * competing for attention. See components/prices/CropPriceGuide.tsx for the price book lookup and
 * the confidence badge that keeps an estimate from reading as a confirmed fact.
 */
export default function PricesPage() {
  const { t } = useLanguage();
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
        <span className="text-xs font-display truncate min-w-0" style={{ color: 'var(--color-muted-strong)' }}>{t('pricesFarmGateTitle')}</span>
        <div className="flex-1" />
        <LessonLink id="prices:overview" label={t('pricesLearn')} />
        <SettingsButton />
      </header>

      <main className={`flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 ${workspace.workspace}`}>
        <style jsx global>{`
          .imf-price-crop { transition: transform 180ms cubic-bezier(.16,1,.3,1), box-shadow 180ms ease, border-color 180ms ease; }
          .imf-price-crop img, .imf-price-crop > span:first-child { transition: transform 220ms cubic-bezier(.16,1,.3,1); }
          .imf-price-crop:focus-visible { outline: 3px solid var(--color-harvest); outline-offset: 3px; }
          @media (hover: hover) {
            .imf-price-crop:hover { transform: translateY(-4px); box-shadow: 0 9px 20px rgba(31,77,43,.12); border-color: #1F4D2B !important; }
            .imf-price-crop:hover img, .imf-price-crop:hover > span:first-child { transform: scale(1.18) rotate(-5deg); }
          }
          .imf-price-crop:active { transform: scale(.96); }
          @keyframes imfPriceDetailEnter { from { opacity: 0; transform: translateY(10px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
          .imf-price-detail-enter { animation: imfPriceDetailEnter 280ms cubic-bezier(.16,1,.3,1) both; }
          @media (prefers-reduced-motion: reduce) {
            .imf-price-crop, .imf-price-crop img, .imf-price-crop > span:first-child { transition: none; }
            .imf-price-crop:hover, .imf-price-crop:active, .imf-price-crop:hover img, .imf-price-crop:hover > span:first-child { transform: none; }
            .imf-price-detail-enter { animation: none; }
          }
        `}</style>
        <div className={workspace.priceWorkspace}>
          <div className={selected ? workspace.pricePickerActive : undefined}>
            <p className="font-sans" style={{ fontSize: 13, color: 'var(--color-muted-strong)', lineHeight: 1.5 }}>
              {t('pricesChooseCrop')}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3" style={{ marginTop: 16 }}>
              {crops.map((crop) => (
                <button
                  key={crop.key}
                  type="button"
                  onClick={() => setSelectedKey(crop.key)}
                  aria-pressed={selectedKey === crop.key}
                  className="imf-price-crop flex flex-col items-center justify-center gap-2 rounded-2xl text-center"
                  style={{
                    minHeight: 92,
                    padding: '14px 8px',
                    background: 'var(--color-surface)',
                    border: selectedKey === crop.key ? '2px solid #1F4D2B' : '1px solid var(--color-border)',
                    cursor: 'pointer',
                  }}
                >
                  {getCropArt(crop.key) ? (
                    <img className="produce-art" src={getCropArt(crop.key)} alt="" aria-hidden style={{ width: 32, height: 32, objectFit: 'contain' }} />
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
          </div>
          {selected && (
            <div key={selected.key} className={`${workspace.priceDetail} imf-price-detail-enter`}>
              <CropPriceDetail crop={selected} onChangeCrop={() => setSelectedKey(null)} />
            </div>
          )}
        </div>
      </main>

      <TabBar />
    </div>
  );
}

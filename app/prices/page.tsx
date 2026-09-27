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
import { loadCropPlan } from '@/lib/crop-plan';
import { getCropArt } from '@/lib/crop-art';
import { translate, useLanguage } from '@/lib/i18n';
import { APP_HEADER_INSET } from '@/lib/app-header';
import { useAppLevel } from '@/lib/app-level';

// Simple / All tools (lib/app-level.ts): a short list to fall back to when a farmer has no saved
// crop plan yet to draw "their own crops" from — common South African smallholder staples that
// pricedCropList (checked in tests/farm-gate-prices.test.ts) is known to price by default.
const SIMPLE_COMMON_CROP_KEYS = ['maize', 'tomatoes', 'cabbage', 'onions', 'potato', 'carrots', 'swiss-chard', 'dry-beans'];

/**
 * A standalone screen a farmer can open DURING a negotiation: pick a crop with a tap (no typing —
 * this audience is low-literacy and isiZulu-first, so the picker is icons and names to scan, the
 * same reasoning as components/exchange/NewListingForm.tsx's sorted-by-name crop list), then see
 * that crop's wholesale and retail price per kg in the largest type on the page, with nothing else
 * competing for attention. See components/prices/CropPriceGuide.tsx for the price book lookup and
 * the confidence badge that keeps an estimate from reading as a confirmed fact.
 */
export default function PricesPage() {
  const { t, lang } = useLanguage();
  // Simple / All tools: Simple opens on the farmer's own planted crops (or a short common list
  // when there is no saved plan yet) instead of the full price book; "All crops" discloses the
  // rest without leaving Simple. The pick-a-crop control and the price screen behind it are the
  // same ones both modes use — nothing here is a separate flow.
  const simple = useAppLevel() === 'simple';
  const [showAllSimple, setShowAllSimple] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, CropPrice>>({});
  const [ownCropKeys, setOwnCropKeys] = useState<Set<string>>(new Set());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Farmer price corrections and the crop plan both live in localStorage, so this can only be
  // read client-side, after mount — same pattern as every other priceFor() caller in this app.
  useEffect(() => {
    setOverrides(loadCropPriceOverrides());
    setOwnCropKeys(new Set(loadCropPlan().plantings.map((p) => p.cropKey)));
  }, []);

  const crops = useMemo(() => pricedCropList(overrides), [overrides]);
  const simpleCrops = useMemo(() => {
    const own = crops.filter((crop) => ownCropKeys.has(crop.key));
    return own.length > 0 ? own : crops.filter((crop) => SIMPLE_COMMON_CROP_KEYS.includes(crop.key));
  }, [crops, ownCropKeys]);
  const visibleCrops = simple && !showAllSimple ? simpleCrops : crops;
  const selected = crops.find((crop) => crop.key === selectedKey) ?? null;

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: 'var(--color-canvas)' }}>
      {/* Header — the in-header BackButton keeps the global floating back pill away; see
          components/BackButton.tsx and tests/back-control.test.ts. */}
      <header
        className="flex-shrink-0 flex items-center px-3 sm:px-4 gap-2 sm:gap-3"
        style={{ ...APP_HEADER_INSET, background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
      >
        <MenuButton />
        <BackButton fallback="/home" />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: 'var(--color-border)' }} />
        <h1 className="text-xs font-display truncate min-w-0 m-0" style={{ color: 'var(--color-muted-strong)' }}>{t('pricesFarmGateTitle')}</h1>
        <div className="flex-1" />
        {!simple && <LessonLink id="prices:overview" label={t('pricesLearn')} />}
        <SettingsButton />
      </header>

      <main className={`flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 ${workspace.workspace}`}>
        {lang === 'zu' && (
          <p role="note" className="rounded-xl px-3 py-2 mb-3 font-sans" style={{ fontSize: 12, lineHeight: 1.45, background: 'rgba(192,122,30,0.08)', border: '1px solid rgba(192,122,30,0.25)', color: 'var(--color-ochre)' }}>
            {t('pricesZuluDraftNotice')}
          </p>
        )}
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
              {lang === 'zu' ? <>{t('pricesChooseCrop')}<span className="block mt-1">{translate('en', 'pricesChooseCrop')}</span></> : t('pricesChooseCrop')}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3" style={{ marginTop: 16 }}>
              {visibleCrops.map((crop) => (
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
            {/* Disclosure: the short list above is farmer's-own-crops-or-common-staples; the full
                price book stays one tap away rather than gone. Reuses the existing "All crops"
                label CropPriceDetail's own back button already carries. */}
            {simple && !showAllSimple && visibleCrops.length < crops.length && (
              <button
                type="button"
                onClick={() => setShowAllSimple(true)}
                className="font-sans font-semibold"
                style={{ marginTop: 14, minHeight: 44, padding: '4px 0', fontSize: 13.5, color: 'var(--color-forest-800)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {t('priceAllCrops')}
              </button>
            )}
          </div>
          {selected && (
            <div key={selected.key} className={`${workspace.priceDetail} imf-price-detail-enter`}>
              <CropPriceDetail crop={selected} onChangeCrop={() => setSelectedKey(null)} simple={simple} />
            </div>
          )}
        </div>
      </main>

      <TabBar />
    </div>
  );
}

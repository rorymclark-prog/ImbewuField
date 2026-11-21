'use client';

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { sampleWorkspaceText } from '@/lib/sample-tour-localization';
import { PRICE_SNAPSHOT_DATE, formatPrice, pricedCropList } from './CropPriceGuide.format';
import styles from './PriceGapBars.module.css';

// The six crops that carry BOTH a sourced wholesale and a sourced retail figure and are the most
// common smallholder sales. Values are read from lib/crop-prices.ts via pricedCropList — never
// copied here. A crop missing from the book simply drops out of the chart.
const CHART_CROP_KEYS = ['tomatoes', 'onions', 'potato', 'butternut', 'cabbage', 'carrots'];

type Phase = 'final' | 'armed' | 'go';

/** One-shot in-view trigger. 'final' on the server and first render (final state shown); after
 *  mount it arms (collapsed) and flips to 'go' the first time the node scrolls into view. Skipped
 *  entirely under prefers-reduced-motion. */
function useRevealOnce<T extends HTMLElement>(): [React.RefObject<T>, Phase] {
  const ref = useRef<T>(null);
  const [phase, setPhase] = useState<Phase>('final');
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    setPhase('armed');
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setPhase('go'); io.disconnect(); }
    }, { threshold: 0.25 });
    io.observe(node);
    return () => io.disconnect();
  }, []);
  return [ref, phase];
}

/**
 * Wholesale vs retail per kg for six common crops. The retail bar is split into the part that
 * matches the wholesale price and the gap (retail minus wholesale), which gets its own colour and
 * a "+R x/kg" label in the row header, so the label can never run off a narrow bar.
 */
export function PriceGapBars({ selectedKey }: { selectedKey?: string }) {
  const { t, lang } = useLanguage();
  const [ref, phase] = useRevealOnce<HTMLDivElement>();
  const crops = pricedCropList({}, lang)
    .filter((c) => CHART_CROP_KEYS.includes(c.key))
    .sort((a, b) => CHART_CROP_KEYS.indexOf(a.key) - CHART_CROP_KEYS.indexOf(b.key));
  if (crops.length === 0) return null;
  const max = Math.max(...crops.map((c) => c.price.retailPerKg));
  const pct = (n: number) => `${(n / max) * 100}%`;
  const summary = crops
    .map((c) => `${c.name}: ${t('priceWholesale')} R${formatPrice(c.price.wholesalePerKg)}, ${t('priceRetail')} R${formatPrice(c.price.retailPerKg)}, +R${formatPrice(c.price.retailPerKg - c.price.wholesalePerKg)}/kg`)
    .join('; ');
  return (
    <div ref={ref} className={`${styles.chart} ${phase === 'armed' ? styles.armed : ''} ${phase === 'go' ? styles.go : ''}`} role="group" aria-label={summary}>
      <ul className={styles.legend} aria-hidden>
        <li><span className={`${styles.swatch} ${styles.swatchWholesale}`} />{t('priceWholesale')}</li>
        <li><span className={`${styles.swatch} ${styles.swatchRetail}`} />{t('priceRetail')}</li>
        <li><span className={`${styles.swatch} ${styles.swatchGap}`} />+R/kg</li>
      </ul>
      <ul className={styles.rows} aria-hidden>
        {crops.map((c, i) => {
          const w = c.price.wholesalePerKg;
          const r = c.price.retailPerKg;
          return (
            <li key={c.key} className={`${styles.row} ${c.key === selectedKey ? styles.rowSelected : ''}`} style={{ ['--i' as string]: i }}>
              <div className={styles.head}>
                <span className={styles.name}>{c.name}</span>
                <span className={styles.gapLabel}>+R{formatPrice(r - w)}/kg</span>
              </div>
              <div className={styles.line}>
                <div className={styles.track}><span className={`${styles.seg} ${styles.segWholesale}`} style={{ width: pct(w) }} /></div>
                <span className={styles.value}>R{formatPrice(w)}</span>
              </div>
              <div className={styles.line}>
                <div className={styles.track}>
                  <span className={`${styles.seg} ${styles.segRetail}`} style={{ width: pct(w) }} />
                  <span className={`${styles.seg} ${styles.segGap}`} style={{ left: pct(w), width: pct(r - w) }} />
                </div>
                <span className={styles.value}>R{formatPrice(r)}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className={styles.caveat}>
        {t('priceUpdatedCheckToday').replace('{date}', PRICE_SNAPSHOT_DATE)}
        {/* isiZulu is an unreviewed draft. */}
        <span style={{ display: 'block' }}>{sampleWorkspaceText(lang, 'Wholesale: Joburg Market, 13 July 2026. Retail: NAMC and PriceCheck. A researched snapshot, not live prices.', 'Okwedlanzana: iJoburg Market, 13 Julayi 2026. Okokuthengisa: i-NAMC ne-PriceCheck. Amanani acwaningiwe ngalolo suku, awasiwo amanani amanje.')}</span>
      </p>
    </div>
  );
}

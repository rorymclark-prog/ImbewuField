'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Sprout } from 'lucide-react';
import MiniPlanPlate from '@/components/MiniPlanPlate';
import { loadCanvasState, DESIGN_CANVAS_CHANGED_EVENT } from '@/lib/design-canvas';
import { bedsFromDesignCanvas } from '@/lib/design-beds-bridge';
import { loadCropPlan, CROP_PLAN_CHANGED_EVENT } from '@/lib/crop-plan';
import { cropByKey } from '@/lib/crop-catalog';
import { getCropArt } from '@/lib/crop-art';
import { miniPlanFromCanvas, type MiniPlan } from '@/lib/mini-plan';
import styles from './SiteCropPlanPreview.module.css';

/** A read-only view of the same beds and planting rows the crop planner opens. */
export default function SiteCropPlanPreview({ siteId, siteName }: { siteId: string; siteName: string }) {
  const [preview, setPreview] = useState<{ plan: MiniPlan | null; beds: number; plots: number; crops: string[] } | null>(null);
  useEffect(() => {
    const refresh = () => {
      const canvas = loadCanvasState(siteId);
      const beds = bedsFromDesignCanvas(canvas);
      const bedIds = new Set(beds.map(bed => bed.id));
      // Crop rows share one account store. Only this site's bed IDs belong on its card.
      const crops = [...new Set(loadCropPlan().plantings.filter(row => bedIds.has(row.bedId)).map(row => row.cropKey))];
      setPreview({ plan: miniPlanFromCanvas(canvas), beds: beds.filter(bed => bed.kind !== 'plot').length, plots: beds.filter(bed => bed.kind === 'plot').length, crops });
    };
    refresh();
    window.addEventListener(DESIGN_CANVAS_CHANGED_EVENT, refresh);
    window.addEventListener(CROP_PLAN_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(DESIGN_CANVAS_CHANGED_EVENT, refresh);
      window.removeEventListener(CROP_PLAN_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [siteId]);

  const counts = preview ? [preview.beds ? `${preview.beds} bed${preview.beds === 1 ? '' : 's'}` : '', preview.plots ? `${preview.plots} plot${preview.plots === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ') : '';
  return <Link className={styles.preview} href={`/facilitator/crops?canvasSite=${encodeURIComponent(siteId)}`} aria-label={`${preview?.crops.length ? 'Open' : 'Start'} crop plan for ${siteName}`}>
    <div className={styles.overview}>
      <div className={styles.plan}>{preview?.plan ? <MiniPlanPlate plan={preview.plan} /> : <Sprout size={36} aria-hidden="true" />}</div>
      <div><strong>Crop plan</strong><span>{preview ? counts || 'Add your growing areas' : 'Loading your plan…'}</span><span className={styles.action}>{preview?.crops.length ? `${preview.crops.length} crops planned` : 'Start crop plan'} <ArrowUpRight size={15} aria-hidden="true" /></span></div>
    </div>
    {!!preview?.crops.length && <div className={styles.crops}>
      {preview.crops.slice(0, 4).map(key => { const crop = cropByKey(key); const art = getCropArt(key); const name = crop?.name ?? key; return <span key={key} title={name} className={styles.crop}>{art ? <img src={art} alt={name} width={44} height={44} loading="lazy" /> : <span role="img" aria-label={name}>{crop?.icon ?? '🌱'}</span>}</span>; })}
      {preview.crops.length > 4 && <span className={styles.more}>+{preview.crops.length - 4}</span>}
    </div>}
  </Link>;
}

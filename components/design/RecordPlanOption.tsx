'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Map, X } from 'lucide-react';
import type { DesignCanvasState } from '@/lib/design-canvas';
import type { MapRefLayers } from '@/lib/base-layers';
import { sitePlanFigure } from '@/lib/report-figures';
import { svgImage } from '@/lib/report-visual-pdf';
import { deliverFile } from '@/lib/file-delivery';
import { activeAccountLocalStorageKey } from '@/lib/account-local-storage';
import styles from './RecordPlanOption.module.css';

/** Use the report's drawing authority so this option cannot disagree with its bed numbers or scale. */
export default function RecordPlanOption({ state, refLayers, language, onAdd }: {
  state: DesignCanvasState; refLayers: MapRefLayers; language: string;
  onAdd: (image: string, siteId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const t = (en: string, zu: string) => language === 'zu' ? zu : en;
  const figure = useMemo(() => open ? sitePlanFigure(state, language, refLayers) : null, [open, state, language, refLayers]);
  useEffect(() => { if (open) dialog.current?.showModal(); }, [open]);
  async function output(kind: 'maps' | 'png' | 'svg') {
    if (!figure || busy) return;
    setBusy(true); setMessage('');
    const owner = activeAccountLocalStorageKey(state.siteId);
    try {
      if (kind === 'svg') {
        await deliverFile(new Blob([figure.svg], { type: 'image/svg+xml' }), 'saved-site-plan.svg', figure.title);
      } else {
        const image = await svgImage(figure.svg);
        if (owner !== activeAccountLocalStorageKey(state.siteId)) throw Error(t('Your account changed. Reopen this map before saving.', 'I-akhawunti yakho ishintshile. Vula le mephu futhi ngaphambi kokuyigcina.'));
        if (kind === 'maps') {
          onAdd(image, state.siteId);
          setMessage(t('Map added. Open Saved maps to export it or include it in a report.', 'Imephu ifakiwe. Vula amamephu agciniwe ukuze uyikhiphe noma uyifake embikweni.'));
        } else {
          const response = await fetch(image);
          await deliverFile(await response.blob(), 'saved-site-plan.png', figure.title);
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Could not prepare the map. Please try again.', 'Imephu ayilungiselelwanga. Zama futhi.'));
    } finally { setBusy(false); }
  }
  return <>
    <button type="button" className={styles.option} onClick={() => { setMessage(''); setOpen(true); }}>
      <Map size={20} aria-hidden="true" /><span><strong>{t('Record plan', 'Umdwebo wamarekhodi')}</strong><small>{t('To scale · symbols and legend · no AI charge', 'Ngesikali · izimpawu nokhiye · akukho nkokhelo ye-AI')}</small></span>
    </button>
    {open && createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby="record-plan-title" onClose={() => setOpen(false)}>
      <header><h2 id="record-plan-title">{t('Record plan', 'Umdwebo wamarekhodi')}</h2><button type="button" onClick={() => dialog.current?.close()} aria-label={t('Close record plan', 'Vala umdwebo wamarekhodi')}><X size={22} /></button></header>
      <p>{t('The same saved site plan used in your report. Solid marks show existing features; dashed marks show proposals.', 'Umdwebo wendawo ogciniwe osetshenziswa nasembikweni wakho. Imigqa egcwele ibonisa okukhona; ephukile ibonisa okuhleliwe.')}</p>
      {figure ? <><div className={styles.actions}>
        <button disabled={busy} onClick={() => void output('maps')}>{t('Add to maps', 'Faka kumamephu')}</button>
        <button disabled={busy} onClick={() => void output('png')}>{t('Download PNG', 'Landa i-PNG')}</button>
        <button disabled={busy} onClick={() => void output('svg')}>{t('Download SVG', 'Landa i-SVG')}</button>
      </div><p role="status">{busy ? t('Preparing map…', 'Kulungiswa imephu…') : message}</p>
        <img className={styles.plan} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(figure.svg)}`} width={figure.width} height={figure.height} alt={figure.alt} />
        <p>{figure.note}</p><small>{figure.source}</small>
      </> : <p>{t('Save a site boundary or add design features to draw this plan.', 'Gcina umngcele wendawo noma ufake izinto zomklamo ukuze udwebe lolu hlelo.')}</p>}
    </dialog>, document.body)}
  </>;
}

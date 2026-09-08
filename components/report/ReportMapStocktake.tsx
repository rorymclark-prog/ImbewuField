'use client';
import { useEffect, useRef, useState } from 'react';
import type { StoredSheetMeta } from '@/lib/sheet-store';
import { REPORT_MAP_TYPES, groupReportMaps, loadSiteMapReview, saveSiteMapReview, emptyMapReview, type SiteMapReview, type MapReview } from '@/lib/report-map-selection';
import styles from './ReportMapStocktake.module.css';

export default function ReportMapStocktake({ maps, selectedIds, siteId, scope, designUrl, onSelect, onOpen, language = 'en', busy = false }: {
  maps: StoredSheetMeta[]; selectedIds: string[]; siteId: string; scope: string; designUrl: string;
  onSelect: (ids: string[]) => void; onOpen: (map: StoredSheetMeta) => void; language?: string; busy?: boolean;
}) {
  const [review, setReview] = useState<SiteMapReview>(emptyMapReview);
  const [error, setError] = useState('');
  const [readyScope, setReadyScope] = useState('');
  const tr = (en: string, zu: string) => language === 'zu' ? zu : en;
  useEffect(() => {
    const refresh = () => { setReview(loadSiteMapReview(siteId)); setReadyScope(scope); };
    refresh(); window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [siteId, scope]);
  const groups = groupReportMaps(maps);
  const types = [...REPORT_MAP_TYPES.map(t => ({ ...t, label: language === 'zu' ? t.zu : t.label })),
    ...[...groups.keys()].filter(k => k.startsWith('other:')).map(key => ({ key, label: groups.get(key)![0].label.split('·')[0], zu: '', step: 'glossy' }))];
  const covered = REPORT_MAP_TYPES.filter(t => groups.has(t.key)).length;
  const required = REPORT_MAP_TYPES.filter(t => !review.notNeeded.includes(t.key));
  const reviewed = required.filter(t => {
    const versions = groups.get(t.key) ?? [];
    const picked = versions.find(m => selectedIds.includes(m.id)) ?? versions.find(m => m.id === review.preferred[t.key]) ?? versions[0];
    return picked && review.reviews[picked.id] === 'reviewed';
  }).length;
  const missingIds = selectedIds.filter(id => !maps.some(m => m.id === id));
  function persist(next: SiteMapReview) {
    if (!saveSiteMapReview(siteId, next)) { setError(tr('Could not save your map review. Please try again.', 'Ukubuyekezwa kwemephu akugcinwanga. Zama futhi.')); return false; }
    setError(''); setReview(next); return true;
  }
  const disabled = busy || readyScope !== scope;
  return <details className={styles.stocktake}>
    <summary><strong>{tr('Map checklist & report selection', 'Uhlu lwamamephu nokukhetha umbiko')}</strong><span>{covered}/9 {tr('map types saved', 'izinhlobo zamamephu ezigciniwe')} · {reviewed}/{required.length} {tr('reviewed', 'kubuyekeziwe')} · {selectedIds.length} {tr('included', 'kufakiwe')}</span></summary>
    <p>{tr('Choose one version per map type. Saving a map records it here; mark it reviewed when you are happy with it. All other versions stay in your saved maps. Changing attachments does not rewrite saved advice.', 'Khetha inguqulo eyodwa yohlobo ngalunye lwemephu. Maka ukuthi ibuyekeziwe uma wenelisekile ngayo. Ezinye izinguqulo zihlala zigciniwe. Ukushintsha amamephu akushintshi iseluleko esigciniwe.')}</p>
    {error && <p role="alert">{error}</p>}
    {!!missingIds.length && <p role="status">{tr('Some selected maps are unavailable in this browser. They have not been replaced.', 'Amanye amamephu akhethiwe awatholakali kulesi siphequluli. Awakafakwa amanye esikhundleni sawo.')} <button disabled={disabled} onClick={() => onSelect(selectedIds.filter(id => !missingIds.includes(id)))}>{tr('Remove unavailable selections', 'Susa ukukhetha okungatholakali')}</button></p>}
    <div className={styles.list}>{types.map(type => {
      const versions = groups.get(type.key) ?? [];
      const included = versions.find(m => selectedIds.includes(m.id));
      const picked = included ?? versions.find(m => m.id === review.preferred[type.key]) ?? versions[0];
      const notNeeded = review.notNeeded.includes(type.key);
      const status = notNeeded ? 'not-needed' : picked ? review.reviews[picked.id] ?? 'saved' : 'missing';
      const replaceSelection = (id: string) => selectedIds.filter(old => !versions.some(m => m.id === old)).concat(id);
      return <div className={styles.row} key={type.key}>
        <div><strong>{type.label}</strong><small>{versions.length ? `${versions.length} ${tr('saved versions', 'izinguqulo ezigciniwe')}` : tr('No saved map in this browser', 'Ayikho imephu egciniwe kulesi siphequluli')}</small></div>
        <div>{picked && <select aria-label={`${type.label}: ${tr('version', 'inguqulo')}`} value={picked.id} disabled={disabled} onChange={e => {
          if (persist({ ...review, preferred: { ...review.preferred, [type.key]: e.target.value } }) && included) onSelect(replaceSelection(e.target.value));
        }}>{versions.map(m => <option key={m.id} value={m.id}>{new Date(m.at).toLocaleString('en-ZA')} · {m.label}</option>)}</select>}
        <select aria-label={`${type.label}: ${tr('review status', 'isimo sokubuyekeza')}`} value={status} disabled={disabled} onChange={e => {
          const nextStatus = e.target.value;
          const next = { ...review, notNeeded: nextStatus === 'not-needed' ? [...new Set([...review.notNeeded, type.key])] : review.notNeeded.filter(k => k !== type.key), reviews: { ...review.reviews } };
          if (picked && nextStatus !== 'not-needed') next.reviews[picked.id] = nextStatus as MapReview;
          if (persist(next) && nextStatus === 'not-needed' && included) onSelect(selectedIds.filter(id => !versions.some(m => m.id === id)));
        }}>
          {!picked && <option value="missing">{tr('Missing', 'Ayikho')}</option>}
          {picked && <><option value="saved">{tr('✓ Saved · review needed', '✓ Igciniwe · idinga ukubuyekezwa')}</option><option value="needs-changes">{tr('Needs changes', 'Idinga ukushintshwa')}</option><option value="reviewed">{tr('✓ Reviewed', '✓ Ibuyekeziwe')}</option></>}
          <option value="not-needed">{tr('Not needed for this site', 'Ayidingeki kule ndawo')}</option>
        </select></div>
        <div className={styles.actions}>
          <label><input type="checkbox" checked={!!included} disabled={disabled || !picked || notNeeded} onChange={e => picked && onSelect(e.target.checked ? replaceSelection(picked.id) : selectedIds.filter(id => id !== picked.id))} />{tr('Include in report', 'Faka embikweni')}</label>
          {picked && <button disabled={disabled} onClick={() => onOpen(picked)}>{tr('Inspect map', 'Hlola imephu')}</button>}
          <a href={`${designUrl}&reportStep=${type.step}`} target="_blank" rel="noopener noreferrer">{tr('Open design', 'Vula umklamo')} →</a>
        </div>
      </div>;
    })}</div>
  </details>;
}

// Decode originals one at a time. Only visible cards retain a preview; scrolling never
// decodes a whole gallery of megapixel PNGs on a farmer's phone.
let previewQueue: Promise<unknown> = Promise.resolve();
async function makePreview(image: string): Promise<string> {
  const img = new Image(); img.src = image;
  try {
    await img.decode();
    const scale = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d'); if (!ctx) return image;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL('image/jpeg', .93); canvas.width = canvas.height = 1; return result;
  } finally { img.src = ''; }
}
export function ReportMapPreview({ map, scope, loadImage, onOpen }: { map: StoredSheetMeta; scope: string; loadImage: (id: string) => Promise<string | null>; onOpen: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '100px' });
    observer.observe(ref.current); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let cancelled = false; setPreview(null);
    if (visible) {
      previewQueue = previewQueue.catch(() => {}).then(async () => {
        if (cancelled) return;
        const original = await loadImage(map.id);
        if (!original || cancelled) return;
        const sized = await makePreview(original);
        if (!cancelled) setPreview(sized);
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [map.id, scope, visible, loadImage]);
  return <button ref={ref} className={styles.preview} onClick={onOpen}>
    {preview || map.thumb ? <img src={preview ?? map.thumb} alt={map.label} /> : <span className={styles.placeholder}>Open map</span>}
    <span>{map.label}</span>
  </button>;
}

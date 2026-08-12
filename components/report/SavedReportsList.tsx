'use client';

// THE SAVED REPORTS, ON THEIR OWN TWO FEET.
//
// Rory, 12 August: "the report picker in menu doesnt work". It did not, and the reason was one
// line in DataPanel:
//
//     if (!data && !loading) return <EmptyState />;
//
// That returns the map's "pick a spot" empty state for EVERY tab, whatever was asked for. So the
// Site report entry in the drawer — which deep-links to ?panel=Reports — landed on the map empty
// state whenever no site had been analysed yet, which is exactly the farmer it was added for.
//
// The Farm tab already had an escape hatch above that line, with a comment explaining the same
// bug in the same words: production records "belong to the farmer, not to a map pin", so a deep
// link "can arrive before any site is analysed" and the empty state "used to make its Log harvest
// action a dead end". Saved reports have precisely that property — they live in the farmer's own
// storage (lib/saved-reports.ts), keyed to their account, not to the pin on the map — and nobody
// gave them the same hatch.
//
// So the list lives here, in one component, used BOTH inside the Reports tab and as the
// standalone panel when there is no site yet. One implementation, because the reason the empty
// state went unrendered for months (see below) is that it existed in only one hard-to-reach place.

import { FileText, Trash2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { deleteReport, type SavedReport } from '@/lib/saved-reports';

interface Props {
  reports: SavedReport[];
  /** Generating needs a site; re-reading a saved one does not. Hidden rather than disabled when
   *  there is no site — a button that cannot work is worse than no button. */
  canGenerate: boolean;
  onOpenReport?: () => void;
  onViewReport?: (r: SavedReport) => void;
  onDeleted?: (remaining: SavedReport[]) => void;
}

export default function SavedReportsList({
  reports, canGenerate, onOpenReport, onViewReport, onDeleted,
}: Props) {
  const { t } = useLanguage();

  return (
    <>
      {canGenerate && (
        <button
          onClick={() => onOpenReport?.()}
          className="w-full flex items-center justify-center gap-2 rounded-xl font-display font-semibold"
          style={{ background: '#274D2C', color: '#EAF3E2', padding: '14px 16px', fontSize: 14.5, border: 'none', cursor: 'pointer' }}
        >
          <FileText size={16} color="#CDEBB6" />
          {t('generateFullReport')}
        </button>
      )}

      {/* Nothing saved yet — say how to get one. These five strings sat translated into all eleven
          languages and rendered in none of them until 11 August. */}
      {reports.length === 0 && (
        <div
          className="rounded-xl p-3.5 font-sans"
          style={{ background: '#FFFEFA', border: '1px dashed #E2D8C4', fontSize: 12.5, lineHeight: 1.55, color: '#5C5040' }}
        >
          {canGenerate ? (
            <>
              {t('noSavedReportsMessage')}{' '}
              <button
                onClick={() => onOpenReport?.()}
                className="font-semibold"
                style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 600, color: '#1F4D2B', textDecoration: 'underline', cursor: 'pointer' }}
              >
                {t('noSavedReportsGenerateLink')}
              </button>
              {t('noSavedReportsSaveTip')}{' '}
              <span className="font-semibold" style={{ color: '#20190F' }}>{t('noSavedReportsSaveLink')}</span>{' '}
              {t('noSavedReportsSuffix')}
            </>
          ) : (
            /* No site yet, so "Open Generate Full Report" would name a button that is not on the
               screen. Say the thing they can actually do instead. */
            t('heroSub')
          )}
        </div>
      )}

      {reports.length > 0 && (
        <>
          <div style={{ font: '700 10.5px/1 system-ui, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A7C62' }}>
            {t('savedReportsHeader')}
          </div>
          {reports.map((r) => (
            <div key={r.id} className="rounded-xl p-3 flex items-center gap-2" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
              <button onClick={() => onViewReport?.(r)} className="flex-1 min-w-0 text-left">
                <div className="text-sm font-display font-semibold truncate" style={{ color: '#20190F' }}>{r.name}</div>
                <div className="text-xs font-mono" style={{ color: '#5C5040' }}>
                  {new Date(r.savedAt).toLocaleDateString()} · {Math.abs(r.location.lat).toFixed(3)}°S {r.location.lon.toFixed(3)}°E
                </div>
              </button>
              <button
                onClick={() => onViewReport?.(r)}
                className="px-3 py-1.5 rounded-lg text-xs font-display font-semibold flex-shrink-0"
                style={{ background: 'rgba(31,77,43,0.1)', border: '1px solid rgba(31,77,43,0.3)', color: '#1F4D2B' }}
              >
                {t('reportOpenButton')}
              </button>
              <button
                onClick={() => onDeleted?.(deleteReport(r.id))}
                title="Delete"
                className="px-2 py-1.5 flex-shrink-0 flex items-center"
                style={{ color: '#5C5040' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </>
      )}
    </>
  );
}

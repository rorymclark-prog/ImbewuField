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
//
// Rory, 15 August, on the FLAT list this component used to render: "when i select site report
// perhaps we should see what sites first we want to carry on with? then reports under that site?"
// A flat list of reports named only "<biome> · <date>" gave a farmer with two fields in the same
// biome no way to tell which report was which. groupReportsBySite() (lib/saved-reports.ts) is the
// one function that answers "which site does this report belong to" — this component is its only
// caller, so there is exactly one place that decision can drift.

import { useState } from 'react';
import { FileText, Trash2, ChevronRight, ChevronLeft } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { deleteReport, groupReportsBySite, type SavedReport } from '@/lib/saved-reports';
import { resolveColor, type SavedPlace } from '@/lib/saved-places';

interface Props {
  reports: SavedReport[];
  /** The farmer's saved places, for grouping reports by site. Pass loadPlaces() (or a
   *  live-refreshed mirror of it) — never re-derive site identity locally, see
   *  lib/saved-reports.ts's groupReportsBySite(). */
  places: SavedPlace[];
  /** Generating needs a site; re-reading a saved one does not. Hidden rather than disabled when
   *  there is no site — a button that cannot work is worse than no button. */
  canGenerate: boolean;
  onOpenReport?: () => void;
  onViewReport?: (r: SavedReport) => void;
  onDeleted?: (remaining: SavedReport[]) => void;
}

const LABEL_STYLE: React.CSSProperties = {
  font: '700 10.5px/1 system-ui, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A7C62',
};

export default function SavedReportsList({
  reports, places, canGenerate, onOpenReport, onViewReport, onDeleted,
}: Props) {
  const { t } = useLanguage();
  const [openSiteId, setOpenSiteId] = useState<string | null>(null);

  const groups = groupReportsBySite(reports, places);
  // More than one site: land on a picker. Exactly one: skip it straight to that site's reports —
  // a one-site farmer should never have to tap twice to reach the reports they already have.
  const activeGroup = groups.length === 1 ? groups[0] : (groups.find((g) => g.siteId === openSiteId) ?? null);
  const showingSitePicker = groups.length > 1 && !activeGroup;

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
        showingSitePicker ? (
          <>
            {/* MORE THAN ONE SITE — pick one to carry on with. Each row is the farmer's own name
                for the place (never a biome), how many reports it has, and when the newest one
                was saved. Reports whose coordinates match no saved place still get a row — the
                "not saved as a site" catch-all — never dropped silently. */}
            <div style={LABEL_STYLE}>{t('savedSitesHeader')}</div>
            {groups.map((g) => {
              const count = g.reports.length;
              return (
                <button
                  key={g.siteId}
                  onClick={() => setOpenSiteId(g.siteId)}
                  className="w-full rounded-xl p-3 flex items-center gap-2.5 text-left"
                  style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', cursor: 'pointer' }}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: g.place ? resolveColor(g.place) : '#B7AB90' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-display font-semibold truncate" style={{ color: '#20190F' }}>
                      {g.place ? g.place.name : t('unsavedSiteGroupLabel')}
                    </div>
                    <div className="text-xs font-mono" style={{ color: '#5C5040' }}>
                      {count} {count === 1 ? t('savedReportCountSingular') : t('savedReportCountPlural')}
                      {' · '}{new Date(g.reports[0].savedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: '#8A7C62', flexShrink: 0 }} />
                </button>
              );
            })}
          </>
        ) : (
          <>
            {/* Drilled into one site's reports. Only offer a way back when there was a picker to
                go back to — a lone site (or a lone "not saved as a site" bucket) has nowhere else
                to go. */}
            {groups.length > 1 && (
              <button
                onClick={() => setOpenSiteId(null)}
                className="flex items-center gap-1 text-xs font-mono"
                style={{ background: 'none', border: 'none', padding: 0, color: '#5C5040', cursor: 'pointer' }}
              >
                <ChevronLeft size={13} /> {t('savedSitesBackLink')}
              </button>
            )}
            <div style={LABEL_STYLE}>
              {activeGroup?.place ? activeGroup.place.name : t('unsavedSiteGroupLabel')}
            </div>
            {(activeGroup?.reports ?? []).map((r) => {
              // The header above already names the site — a row inside a known site must not
              // repeat that name, only the date (and time, distinguishing two reports saved the
              // same day) that name can't tell you. Without a matched site there is no name to
              // lean on, so the row keeps its biome+coordinates the way it always has.
              const known = !!activeGroup?.place;
              return (
                <div key={r.id} className="rounded-xl p-3 flex items-center gap-2" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
                  <button onClick={() => onViewReport?.(r)} className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-display font-semibold truncate" style={{ color: '#20190F' }}>
                      {known
                        ? new Date(r.savedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
                        : r.name}
                    </div>
                    <div className="text-xs font-mono" style={{ color: '#5C5040' }}>
                      {known
                        ? new Date(r.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : `${new Date(r.savedAt).toLocaleDateString()} · ${Math.abs(r.location.lat).toFixed(3)}°S ${r.location.lon.toFixed(3)}°E`}
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
              );
            })}
          </>
        )
      )}
    </>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Pencil, NotebookPen, Sparkles } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { bedsFromDesignCanvas } from '@/lib/design-beds-bridge';
import { loadCanvasState } from '@/lib/design-canvas';
import { loadPlaces, resolveMainSite } from '@/lib/saved-places';
import { loadCropPlan } from '@/lib/crop-plan';
import { cropByKey } from '@/lib/crop-catalog';
import { getElementArt2 } from '@/lib/element-art-2';
import {
  JOURNAL_CATEGORIES,
  JOURNAL_CHANGED_EVENT,
  createJournalEntry,
  editJournalEntry,
  formatJournalDate,
  groupJournalByMonth,
  journalCategory,
  journalSummary,
  loadJournal,
  recentJournalPhotos,
  removeJournalEntry,
  saveJournal,
  upsertJournalEntry,
  type JournalCategory,
  type JournalEntry,
  type JournalEntryInput,
} from '@/lib/field-journal';
import JournalEntrySheet, { type BedOption } from './JournalEntrySheet';

type Filter = 'all' | JournalCategory;

/**
 * Shown only in the zero-entries empty state, and only for a real (non-sample-mode)
 * account — sample mode's own journal is already fully populated with 20 dated notes
 * from the Ubhejane Crèche season (lib/demo-farm.ts's buildDemoJournal), so a farmer
 * exploring the sample never sees this. A genuinely empty real account used to land on
 * a bare "Nothing recorded yet" line with no sense of what a logged entry looks like —
 * these three give a concrete, specific example (a crop, a quantity, a date) instead of
 * an abstract instruction. Deliberately NOT wired to createJournalEntry/JournalEntry: this
 * is display-only fixture data, never something that could accidentally get upserted into
 * a real journal. English-only, matching lib/field-journal.ts's own header comment on why
 * this feature stays outside lib/i18n.tsx's t() system for now.
 */
const EXAMPLE_JOURNAL_ENTRIES: ReadonlyArray<{
  id: string;
  category: JournalCategory;
  dateLabel: string;
  title: string;
  notes: string;
  bedLabel: string;
  cropName: string;
}> = [
  {
    id: 'example-harvest',
    category: 'harvest',
    dateLabel: 'Tue 14 Jul',
    title: 'Cabbage harvested — 6 heads',
    notes: 'Cut the heads that had firmed up from Bed 2 and weighed 9 kg before it went to the stall.',
    bedLabel: 'Bed 2',
    cropName: 'Cabbage',
  },
  {
    id: 'example-planting',
    category: 'planting',
    dateLabel: 'Thu 23 Jul',
    title: 'Carrots sown in Bed 4',
    notes: 'Cleared the old bed, worked in compost and sowed two rows of carrots.',
    bedLabel: 'Bed 4',
    cropName: 'Carrots',
  },
  {
    id: 'example-pest',
    category: 'pest',
    dateLabel: 'Mon 3 Aug',
    title: 'Aphids on the young spinach',
    notes: 'Small cluster under the top leaves near the path end. Rubbed off by hand — checking again in a few days.',
    bedLabel: 'Bed 1',
    cropName: 'Spinach',
  },
];

export default function FieldJournal() {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [sheet, setSheet] = useState<{ open: boolean; entry: JournalEntry | null }>({ open: false, entry: null });
  const [notice, setNotice] = useState<string | null>(null);
  const [beds, setBeds] = useState<BedOption[]>([]);
  const [crops, setCrops] = useState<string[]>([]);

  const refresh = useCallback(() => setEntries(loadJournal()), []);

  useEffect(() => {
    refresh();
    setReady(true);
    const onChanged = () => refresh();
    window.addEventListener(JOURNAL_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(JOURNAL_CHANGED_EVENT, onChanged);
  }, [refresh]);

  // Bed/plot options come from the SAME source the crop planner uses (main saved
  // place → Design-Studio canvas → bridge), so a journal entry tagged "Bed 4"
  // means the same Bed 4 the plan and the map draw. Sample mode gets the crèche's
  // 7 designed beds for free through the storage shim.
  useEffect(() => {
    try {
      const main = resolveMainSite(loadPlaces());
      if (main) {
        const siteId = `site:${main.lat.toFixed(5)},${main.lon.toFixed(5)}`;
        setBeds(
          bedsFromDesignCanvas(loadCanvasState(siteId))
            .map((b) => ({ id: b.id, label: b.label }))
            .filter((b) => b.id && b.label),
        );
      }
    } catch { /* no design yet — the sheet falls back to a free-text bed field */ }
    try {
      const names = new Set<string>();
      for (const p of loadCropPlan().plantings) {
        const crop = cropByKey(p.cropKey);
        if (crop?.name) names.add(crop.name);
      }
      setCrops([...names].sort());
    } catch { /* no plan yet — the crop field is free text anyway */ }
  }, []);

  const summary = useMemo(() => journalSummary(entries), [entries]);
  const photos = useMemo(() => recentJournalPhotos(entries, 8), [entries]);
  const visible = useMemo(
    () => (filter === 'all' ? entries : entries.filter((e) => e.category === filter)),
    [entries, filter],
  );
  const months = useMemo(() => groupJournalByMonth(visible), [visible]);
  const usedCategories = useMemo(
    () => JOURNAL_CATEGORIES.filter((c) => entries.some((e) => e.category === c.key)),
    [entries],
  );

  function persist(next: JournalEntry[]) {
    const result = saveJournal(next);
    setEntries(result.entries);
    if (!result.ok) setNotice('Storage is full — this entry could not be saved. Delete an old entry and try again.');
    else if (result.trimmed) setNotice('Storage was nearly full, so photos on the oldest entries were removed. The notes are kept.');
    else setNotice(null);
  }

  function handleSave(input: JournalEntryInput) {
    const entry = sheet.entry ? editJournalEntry(sheet.entry, input) : createJournalEntry(input);
    persist(upsertJournalEntry(entries, entry));
    setSheet({ open: false, entry: null });
  }

  function handleDelete(id: string) {
    persist(removeJournalEntry(entries, id));
    setSheet({ open: false, entry: null });
  }

  return (
    // Bottom padding clears the tab bar AND the sample-mode banner stacked above it,
    // so the oldest entry is never trapped behind them.
    <div style={{ padding: '14px 14px 176px', maxWidth: 720, margin: '0 auto' }}>
      {/* Stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
        <Stat value={String(summary.total)} label="entries" />
        <Stat value={String(summary.thisMonth)} label="this month" />
        <Stat
          value={summary.daysSinceLast === null ? '—' : summary.daysSinceLast === 0 ? 'Today' : `${summary.daysSinceLast}d`}
          label={summary.daysSinceLast === null ? 'no entries yet' : 'since last note'}
        />
      </div>

      {/* Primary action. Deliberately a STICKY TOP bar, not a floating bottom
          button: components/SampleModeBanner.tsx is fixed at bottom 60px with
          z-index 9999 and wraps to two lines on a phone, so anything floating
          above the tab bar is invisible for the whole of a sample-mode demo —
          exactly when this button matters most. */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 3,
        padding: '2px 0 10px',
        background: 'linear-gradient(#E4DCC6 78%, rgba(228,220,198,0))',
      }}>
        <button
          type="button"
          onClick={() => setSheet({ open: true, entry: null })}
          style={{
            width: '100%', minHeight: 50, borderRadius: 14, border: 'none', cursor: 'pointer',
            background: '#274D2C', color: '#fff', font: '700 15px/1 system-ui, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 3px 12px rgba(20,40,22,0.18)',
          }}
        >
          <Plus size={20} />
          New entry
        </button>

        {/* WHERE THIS GOES, said on the screen itself.
            The journal is a diary — no kilogram field — and saveJournal() writes to
            localStorage only, deliberately (sample mode patches Storage.prototype, so a
            local-only store is sandboxed for free; see lib/field-journal.ts). Nothing here
            reaches production_logs, the finance totals or the farmer's programme, and a
            cleared cache or a new phone erases it. The home tile used to say "Log harvests"
            and pulled precisely the farmer who wanted to record a harvest into the one screen
            that cannot. The label is fixed; this says the rest out loud, and points at the
            screen that DOES keep a weight, so the correction ends somewhere useful rather
            than just taking a promise away. */}
        <p style={{
          margin: '8px 2px 0', font: '500 12px/1.5 system-ui, sans-serif', color: '#6B6152',
        }}>
          {t('journalLocalOnlyNote')} {t('journalWeightsLiveElsewhere')}{' '}
          <Link href="/records" style={{ color: '#274D2C', fontWeight: 700 }}>
            {t('journalOpenRecords')}
          </Link>
        </p>
      </div>

      {notice && (
        <div style={{
          marginBottom: 12, padding: '10px 13px', borderRadius: 11,
          background: '#FEF6E7', border: '1px solid #EBD6A8',
          font: '500 12.5px/1.45 system-ui, sans-serif', color: '#7A5B14',
        }}>
          {notice}
        </div>
      )}

      {/* Photo strip — only when photos exist, so an empty journal never shows a
          row of dashed placeholder tiles. */}
      {photos.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <Heading>Recent photos</Heading>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
            {photos.map((p, i) => (
              <div
                key={`${p.entryId}-${i}`}
                style={{ flex: '0 0 auto', width: 92, height: 92, borderRadius: 12, overflow: 'hidden', background: '#E0D6C2', position: 'relative' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{
                  position: 'absolute', left: 0, right: 0, bottom: 0, padding: '10px 6px 4px',
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.55))',
                  font: '600 10px/1 system-ui, sans-serif', color: '#fff',
                }}>
                  {formatJournalDate(p.date)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category filter */}
      {usedCategories.length > 1 && (
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 10, marginBottom: 4 }}>
          <Chip on={filter === 'all'} onClick={() => setFilter('all')}>All · {entries.length}</Chip>
          {usedCategories.map((c) => (
            <Chip key={c.key} on={filter === c.key} onClick={() => setFilter(c.key)} tint={c.tint} ink={c.ink}>
              {getElementArt2(`journal_${c.key}`) ? (
                <img src={getElementArt2(`journal_${c.key}`)} alt="" aria-hidden style={{ width: 12, height: 12, objectFit: 'contain', display: 'inline-block', verticalAlign: '-2px' }} />
              ) : (
                c.icon
              )}{' '}
              {c.label}
            </Chip>
          ))}
        </div>
      )}

      {/* Timeline */}
      {ready && entries.length === 0 && (
        <div>
          <div style={{
            textAlign: 'center', padding: '30px 22px 26px', borderRadius: 16,
            background: '#FFFEFA', border: '1px dashed #D9CDB4', marginBottom: 20,
          }}>
            <NotebookPen size={26} style={{ color: '#9A8268', margin: '0 auto 10px' }} />
            <div style={{ font: '600 16px Newsreader, Georgia, serif', color: '#2D2519', marginBottom: 6 }}>
              Nothing recorded yet
            </div>
            <div style={{ font: '400 13px/1.5 system-ui, sans-serif', color: '#8A7C62', maxWidth: 320, margin: '0 auto' }}>
              Write down the date, what you did and what happened. One season of notes is
              what makes next season&apos;s decisions better — here&apos;s what that looks like.
            </div>
          </div>

          {/* Example entries — fixture data only, see EXAMPLE_JOURNAL_ENTRIES above.
              Dashed borders + reduced opacity + a per-card "Example" badge (all in the
              app's existing amber "this is a demo" colour, the same #C07A1E app/cropplan/
              page.tsx uses for its own no-crop-plan-yet notice) so these can never
              read as the farmer's own history — no edit button, no delete, not clickable. */}
          <div style={{ marginBottom: 4 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '0 2px',
              font: '700 10.5px/1 system-ui, sans-serif', letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#A66A16',
            }}>
              <Sparkles size={12} />
              Example — what an entry looks like
            </div>

            <div style={{ position: 'relative', paddingLeft: 16 }}>
              <div style={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: 2, background: '#DCD0B6', borderRadius: 1, opacity: 0.6 }} />
              {EXAMPLE_JOURNAL_ENTRIES.map((ex) => {
                const cat = journalCategory(ex.category);
                return (
                  <article
                    key={ex.id}
                    aria-label={`Example entry (not a real record): ${ex.title}`}
                    style={{
                      position: 'relative', marginBottom: 10, borderRadius: 14, opacity: 0.82,
                      background: '#FFFEFA', border: '1.5px dashed #D9CDB4',
                      borderLeft: `3px dashed ${cat.ink}`, padding: '12px 40px 12px 13px',
                    }}
                  >
                    <div style={{ position: 'absolute', left: -15, top: 18, width: 10, height: 10, borderRadius: 5, background: '#D9CDB4', border: '2px solid #E4DCC6' }} />
                    <span style={{
                      position: 'absolute', top: 10, right: 10,
                      padding: '3px 7px', borderRadius: 6, background: '#C07A1E', color: '#fff',
                      font: '700 9px/1 system-ui, sans-serif', letterSpacing: '0.04em', textTransform: 'uppercase',
                    }}>
                      Example
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ font: '600 11.5px/1 system-ui, sans-serif', color: '#8A7C62' }}>
                        {ex.dateLabel}
                      </span>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 7px', borderRadius: 7, background: cat.tint, color: cat.ink,
                        font: '700 10px/1 system-ui, sans-serif',
                      }}>
                        {cat.icon} {cat.label}
                      </span>
                    </div>

                    <div style={{ font: '600 15.5px/1.3 Newsreader, Georgia, serif', color: '#20190F', marginBottom: 4 }}>
                      {ex.title}
                    </div>
                    <div style={{ font: '400 13.5px/1.55 system-ui, sans-serif', color: '#4A4034' }}>
                      {ex.notes}
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      <Pill>📍 {ex.bedLabel}</Pill>
                      <Pill>🌿 {ex.cropName}</Pill>
                    </div>
                  </article>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setSheet({ open: true, entry: null })}
              style={{
                width: '100%', minHeight: 46, borderRadius: 13, cursor: 'pointer', marginTop: 4,
                background: '#FFFEFA', border: '1.5px dashed #274D2C', color: '#274D2C',
                font: '700 13.5px/1 system-ui, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
            >
              <Plus size={16} />
              Log your first real entry
            </button>
          </div>
        </div>
      )}

      {months.map((group) => (
        <section key={group.key} style={{ marginBottom: 18 }}>
          <div style={{
            // Tucks under the sticky New-entry bar above (50px button + its padding).
            position: 'sticky', top: 62, zIndex: 1,
            padding: '6px 2px 8px', margin: '0 0 6px',
            background: 'linear-gradient(#E4DCC6 72%, rgba(228,220,198,0))',
            font: '700 11px/1 system-ui, sans-serif', letterSpacing: '0.1em',
            textTransform: 'uppercase', color: '#7A6B52',
          }}>
            {group.label} · {group.entries.length}
          </div>

          <div style={{ position: 'relative', paddingLeft: 16 }}>
            {/* the spine */}
            <div style={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: 2, background: '#DCD0B6', borderRadius: 1 }} />
            {group.entries.map((entry) => {
              const cat = journalCategory(entry.category);
              return (
                <article
                  key={entry.id}
                  style={{
                    position: 'relative', marginBottom: 10, borderRadius: 14,
                    background: '#FFFEFA', border: '1px solid #E2D8C4',
                    borderLeft: `3px solid ${cat.ink}`, padding: '12px 12px 12px 13px',
                  }}
                >
                  <div style={{ position: 'absolute', left: -15, top: 18, width: 10, height: 10, borderRadius: 5, background: cat.ink, border: '2px solid #E4DCC6' }} />

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ font: '600 11.5px/1 system-ui, sans-serif', color: '#8A7C62' }}>
                          {formatJournalDate(entry.date)}
                        </span>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 7px', borderRadius: 7, background: cat.tint, color: cat.ink,
                          font: '700 10px/1 system-ui, sans-serif',
                        }}>
                          {getElementArt2(`journal_${entry.category}`) ? (
                            <img src={getElementArt2(`journal_${entry.category}`)} alt="" aria-hidden style={{ width: 11, height: 11, objectFit: 'contain', display: 'inline-block', verticalAlign: '-1px' }} />
                          ) : (
                            cat.icon
                          )}{' '}
                          {cat.label}
                        </span>
                      </div>

                      {entry.title && (
                        <div style={{ font: '600 15.5px/1.3 Newsreader, Georgia, serif', color: '#20190F', marginBottom: entry.notes ? 4 : 0 }}>
                          {entry.title}
                        </div>
                      )}
                      {entry.notes && (
                        <div style={{ font: '400 13.5px/1.55 system-ui, sans-serif', color: '#4A4034', whiteSpace: 'pre-wrap' }}>
                          {entry.notes}
                        </div>
                      )}

                      {(entry.bedLabel || entry.cropName) && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                          {entry.bedLabel && <Pill>📍 {entry.bedLabel}</Pill>}
                          {entry.cropName && <Pill>🌿 {entry.cropName}</Pill>}
                        </div>
                      )}

                      {(entry.photos?.length ?? 0) > 0 && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
                          {entry.photos!.map((src, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={i}
                              src={src}
                              alt=""
                              style={{ width: 62, height: 62, objectFit: 'cover', borderRadius: 9, background: '#E0D6C2' }}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setSheet({ open: true, entry })}
                      aria-label={`Edit entry: ${entry.title || formatJournalDate(entry.date)}`}
                      style={{
                        flexShrink: 0, width: 40, height: 40, borderRadius: 10, cursor: 'pointer',
                        background: 'rgba(31,77,43,0.07)', border: '1px solid rgba(31,77,43,0.16)', color: '#1F4D2B',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {sheet.open && (
        <JournalEntrySheet
          entry={sheet.entry}
          beds={beds}
          crops={crops}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setSheet({ open: false, entry: null })}
        />
      )}
    </div>
  );
}

/* ── Small presentational bits ───────────────────────────────────────────── */

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', borderRadius: 13, padding: '11px 10px', textAlign: 'center' }}>
      <div style={{ font: '600 21px/1 Newsreader, Georgia, serif', color: '#1F4D2B' }}>{value}</div>
      <div style={{ font: '500 10.5px/1.2 system-ui, sans-serif', color: '#8A7C62', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      font: '700 10.5px/1 system-ui, sans-serif', letterSpacing: '0.1em',
      textTransform: 'uppercase', color: '#7A6B52', marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 8,
      background: 'rgba(92,80,64,0.07)', border: '1px solid #E7DFCC',
      font: '500 11.5px/1 system-ui, sans-serif', color: '#5C5040',
    }}>
      {children}
    </span>
  );
}

function Chip({
  children, on, onClick, tint, ink,
}: {
  children: React.ReactNode; on: boolean; onClick: () => void; tint?: string; ink?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{
        flex: '0 0 auto', minHeight: 38, padding: '0 13px', borderRadius: 19, cursor: 'pointer',
        background: on ? (tint ?? 'rgba(31,77,43,0.12)') : '#FFFEFA',
        border: `1.5px solid ${on ? (ink ?? '#1F4D2B') : '#E2D8C4'}`,
        color: on ? (ink ?? '#1F4D2B') : '#5C5040',
        font: `${on ? 700 : 500} 12.5px/1 system-ui, sans-serif`,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

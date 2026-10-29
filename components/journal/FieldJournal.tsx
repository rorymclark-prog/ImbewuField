'use client';

import workspace from '@/components/layout/Workspace.module.css';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, NotebookPen, Sparkles, MapPin, Leaf, Search, SlidersHorizontal, X, Download, Printer, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { useAppLevel } from '@/lib/app-level';
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
  removeJournalEntry,
  saveJournal,
  todayISODate,
  upsertJournalEntry,
  type JournalCategory,
  type JournalEntry,
  type JournalEntryInput,
} from '@/lib/field-journal';
import JournalEntrySheet, { type BedOption } from './JournalEntrySheet';
import { formatZuluJournalDate, formatZuluMonth, journalCategoryLabel } from './journal-labels';
import motion from './JournalMotion.module.css';
import explore from './JournalExplore.module.css';
import { filterJournalEntries, journalFilterOptions, journalDateRangeError } from '@/lib/journal-view';
import { downloadJournalCsv, downloadJournalHtml } from '@/lib/journal-export';
import { isSampleMode } from '@/lib/sample-mode';
import { parseTaskJournalQuery } from '@/lib/task-record-link';
import JournalPhotoReview from './JournalPhotoReview';

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
    // THE EXAMPLE TEACHES THE SPLIT, because it used to teach the opposite. It read "Cabbage
    // harvested — 6 heads … weighed 9 kg before it went to the stall", which is a farmer
    // recording her yield in the one store that has no weight field — the same mistake the home
    // tile's old "Log harvests" label invited, made again in the example she is shown first.
    // A harvest note still belongs here; what belongs here is the part My Records cannot hold.
    id: 'example-harvest',
    category: 'harvest',
    dateLabel: 'Tue 14 Jul',
    title: 'Cabbage from Bed 2 came in early',
    notes: 'Cut the heads that had firmed up and put the weight in My Records. Writing it down here because they were ready three weeks sooner than last winter — worth sowing earlier next year.',
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
  const router = useRouter();
  const { t, lang } = useLanguage();
  const isZulu = lang === 'zu';
  const ui = (english: string, zulu: string) => isZulu ? zulu : english;
  const simple = useAppLevel() === 'simple';
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [bed, setBed] = useState('');
  const [crop, setCrop] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ open: boolean; entry: JournalEntry | null; draft?: Partial<JournalEntryInput> }>({ open: false, entry: null });
  const [notice, setNotice] = useState<string | null>(null);
  // bug-03: shown INSIDE the sheet (which overlays everything below it), because a storage-full
  // failure used to close the sheet on the farmer, taking the typed note with it. Kept separate
  // from `notice` so a save failure doesn't bleed into a later, unrelated trimmed-photos success.
  const [sheetError, setSheetError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!ready) return;
    const url = new URL(window.location.href);
    const draft = parseTaskJournalQuery(url.searchParams);
    if (!draft) return;
    // The plan gives context, not proof that work happened. Only saving the
    // editable sheet creates an observation, dated today rather than a plan month.
    setSheet({ open: true, entry: null, draft: {
      date: todayISODate(), title: draft.title, category: draft.category,
      cropName: draft.cropName, bedId: draft.bedId ?? null,
      bedLabel: draft.bedLabel ?? null, notes: '',
    } });
    for (const parameter of ['task', 'crop', 'action', 'title', 'bed', 'bedLabel']) url.searchParams.delete(parameter);
    // Keep the app router's URL in step with browser history so returning to
    // this page cannot replay a draft that was already saved or cancelled.
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
  }, [ready, router]);

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
  const viewFilters = useMemo(() => ({ query, category: filter, from, to, bed, crop }), [query, filter, from, to, bed, crop]);
  const visible = useMemo(() => filterJournalEntries(entries, viewFilters), [entries, viewFilters]);
  const filterOptions = useMemo(() => journalFilterOptions(entries), [entries]);
  const dateError = journalDateRangeError(viewFilters);
  const advancedFilterCount = Number(filter !== 'all') + Number(Boolean(from)) + Number(Boolean(to)) + Number(Boolean(bed)) + Number(Boolean(crop));
  const hasFilters = Boolean(query.trim()) || advancedFilterCount > 0;
  const months = useMemo(() => groupJournalByMonth(visible), [visible]);
  const usedCategories = useMemo(
    () => JOURNAL_CATEGORIES.filter((c) => entries.some((e) => e.category === c.key)),
    [entries],
  );

  function clearFilters() {
    setQuery(''); setFilter('all'); setFrom(''); setTo(''); setBed(''); setCrop('');
    setExportNotice(null);
  }

  async function exportSelection(format: 'csv' | 'html') {
    if (exporting || !visible.length || dateError) return;
    setExporting(true);
    setExportNotice(null);
    const selection = [
      query.trim() ? `Search: ${query.trim()}` : '',
      filter !== 'all' ? `Category: ${journalCategory(filter).label}` : '',
      from ? `From: ${from}` : '', to ? `Through: ${to}` : '',
      bed ? `Bed: ${filterOptions.beds.find(option => option.value === bed)?.label ?? bed}` : '',
      crop ? `Crop: ${crop}` : '',
    ].filter(Boolean).join(' · ') || 'All journal entries';
    try {
      const options = { sample: isSampleMode(), selection };
      const result = format === 'csv'
        ? await downloadJournalCsv(visible, options)
        : await downloadJournalHtml(visible, options);
      if (result === 'downloaded') setExportNotice(format === 'html'
        ? 'Printable copy downloaded. Open the HTML file, then choose Print or Save as PDF in your browser.'
        : 'CSV downloaded. It contains the entries shown here.');
      else if (result === 'shared') setExportNotice('The selected entries were shared.');
    } catch {
      setExportNotice('The file could not be prepared. Your notes are unchanged. Try again.');
    } finally {
      setExporting(false);
    }
  }

  function persist(next: JournalEntry[]): boolean {
    const result = saveJournal(next);
    if (result.ok) {
      setEntries(result.entries);
      setSheetError(null);
      setNotice(result.trimmed ? ui('Storage was nearly full, so photos on the oldest entries were removed. The notes are kept.', 'Isikhala sokugcina besesizogcwala, ngakho izithombe kokudala kakhulu zisusiwe. Amanothi agciniwe.') : null);
    } else {
      // Leave `entries` as it was — the attempted save never actually landed in storage, so
      // adding it to the in-memory list would show it as saved until the next reload drops it.
      setSheetError(ui('Storage is full — this entry could not be saved. Delete an old entry and try again.', 'Isikhala sokugcina sigcwele — lokhu okubhaliwe akugcinwanga. Susa okubhaliwe okudala bese uzama futhi.'));
    }
    return result.ok;
  }

  function openSheet(entry: JournalEntry | null) {
    setSheetError(null);
    setSheet({ open: true, entry });
  }

  function handleSave(input: JournalEntryInput) {
    const entry = sheet.entry ? editJournalEntry(sheet.entry, input) : createJournalEntry(input);
    const ok = persist(upsertJournalEntry(entries, entry));
    // bug-03: only close (and so only discard the sheet's own draft state) once the save actually
    // landed in storage. On failure the sheet — and the farmer's typed note inside it — stays put.
    if (ok) setSheet({ open: false, entry: null });
  }

  function handleDelete(id: string) {
    persist(removeJournalEntry(entries, id));
    setSheetError(null);
    setSheet({ open: false, entry: null });
  }

  return (
    // Bottom padding clears the tab bar AND the sample-mode banner stacked above it,
    // so the oldest entry is never trapped behind them.
    <div className={`${workspace.workspace} ${workspace.journal} ${explore.memoryLayout}`} style={{ padding: '14px 14px 176px', maxWidth: 1040 }}>
      <aside className={`${workspace.journalSidebar} ${explore.sidebar}`} aria-label={ui('Journal overview', 'Uhlolojikelele lwejenali')}>
      {/* Stat row — extra dashboard detail, not the entries or the add-note action Simple
          leads with. Still one tap away: switch to All tools in Settings. */}
      {!simple && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
          <Stat value={String(summary.total)} label={ui('entries', 'okufakiwe')} />
          <Stat value={String(summary.thisMonth)} label={ui('this month', 'kule nyanga')} />
          <Stat
            value={summary.daysSinceLast === null ? '—' : summary.daysSinceLast === 0 ? ui('Today', 'Namuhla') : `${summary.daysSinceLast}${ui('d', summary.daysSinceLast === 1 ? ' usuku' : ' izinsuku')}`}
            label={summary.daysSinceLast === null ? ui('no entries yet', 'akukho okufakiwe') : ui('since last note', 'kusukela kunothi lokugcina')}
          />
        </div>
      )}

      {/* Primary action. Deliberately a STICKY TOP bar, not a floating bottom
          button: components/SampleModeBanner.tsx is fixed at bottom 60px with
          z-index 9999 and wraps to two lines on a phone, so anything floating
          above the tab bar is invisible for the whole of a sample-mode demo —
          exactly when this button matters most. */}
      <div className={workspace.journalAction} style={{
        padding: '2px 0 10px',
        background: 'linear-gradient(var(--bg-0) 78%, rgba(228,220,198,0))',
      }}>
        <button
          type="button"
          className={motion.newEntry}
          onClick={() => openSheet(null)}
          style={{
            width: '100%', minHeight: 50, borderRadius: 14, border: 'none', cursor: 'pointer',
            background: 'var(--color-forest-800)', color: 'var(--on-forest-800)', font: '700 15px/1 var(--font-sans), sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 3px 12px rgba(20,40,22,0.18)',
          }}
        >
          <Plus size={20} />
          {simple ? ui('Add a note', 'Faka inothi') : ui('New entry', 'Faka okusha')}
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
            than just taking a promise away. Kept out of Simple: it is explanatory detail
            about storage, not the entries or the add-note action Simple leads with. */}
        {!simple && (
          <p style={{
            margin: '8px 2px 0', font: '500 12px/1.5 var(--font-sans), sans-serif', color: 'var(--text-secondary)',
          }}>
            {t('journalLocalOnlyNote')} {t('journalWeightsLiveElsewhere')}{' '}
            <Link href="/records" style={{ color: 'var(--color-forest-800)', fontWeight: 700 }}>
              {t('journalOpenRecords')}
            </Link>
          </p>
        )}
      </div>

      {notice && (
        <div style={{
          marginBottom: 12, padding: '10px 13px', borderRadius: 11,
          background: 'color-mix(in srgb, var(--gold) 14%, var(--bg-1))', border: '1px solid color-mix(in srgb, var(--gold) 30%, transparent)',
          font: '500 12.5px/1.45 var(--font-sans), sans-serif', color: 'var(--gold-dim)',
        }}>
          {notice}
        </div>
      )}

      {ready && entries.length > 0 && <section className={explore.tools} aria-label="Find journal entries" lang="en">
        <div className={explore.heading}><NotebookPen size={17} aria-hidden="true" /><h2>Farm memory</h2></div>
        <p className={explore.help}>Find the note, photo or field observation you need again.</p>
        {lang !== 'en' && <p className={explore.languageNote} role="note">Search, filters and export controls are currently in English. Your notes keep their original language.</p>}
        <label className={explore.search}>
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search journal titles, notes, crops and beds</span>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search your journal" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={17} aria-hidden="true" /></button>}
        </label>
        <button type="button" className={explore.filterToggle} aria-expanded={filtersOpen} aria-controls="journal-memory-filters" onClick={() => setFiltersOpen(value => !value)}>
          <SlidersHorizontal size={17} aria-hidden="true" /><span>Filters{advancedFilterCount ? ` · ${advancedFilterCount}` : ''}</span><ChevronDown size={17} aria-hidden="true" className={filtersOpen ? explore.rotated : undefined} />
        </button>
        {filtersOpen && <div id="journal-memory-filters" className={explore.filters}>
          <div className={explore.dateFields}>
            <label>From date<input type="date" value={from} onChange={event => setFrom(event.target.value)} aria-invalid={Boolean(dateError)} aria-describedby={dateError ? 'journal-date-error' : 'journal-date-help'} /></label>
            <label>Through date<input type="date" value={to} onChange={event => setTo(event.target.value)} aria-invalid={Boolean(dateError)} aria-describedby={dateError ? 'journal-date-error' : 'journal-date-help'} /></label>
          </div>
          <p id="journal-date-help" className={explore.help}>Both dates are included. Leave either date empty for an open range.</p>
          <label>Bed or plot<select value={bed} onChange={event => setBed(event.target.value)}><option value="">All beds and plots</option>{filterOptions.beds.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>Crop or product<select value={crop} onChange={event => setCrop(event.target.value)}><option value="">All crops and products</option>{filterOptions.crops.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
          {!simple && usedCategories.length > 1 && <div><span className={explore.fieldLabel}>Category</span><div className={explore.categoryChoices}>
            <Chip on={filter === 'all'} onClick={() => setFilter('all')}>{ui('All', 'Konke')} · {entries.length}</Chip>
            {usedCategories.map(c => <Chip key={c.key} on={filter === c.key} onClick={() => setFilter(c.key)} tint={c.tint} ink={c.ink}>
              {getElementArt2(`journal_${c.key}`)
                ? <img className="produce-art produce-art--inline" src={getElementArt2(`journal_${c.key}`)} alt="" aria-hidden="true" style={{ width: 13, height: 13, objectFit: 'contain', display: 'inline-block' }} />
                : <c.icon size={13} aria-hidden="true" />}{' '}
              {isZulu ? journalCategoryLabel(c.key) : c.label}
            </Chip>)}
          </div></div>}
        </div>}
        {dateError && <p id="journal-date-error" role="alert" className={explore.error}>{dateError}</p>}
        {advancedFilterCount > 0 && <button type="button" className={explore.clearButton} onClick={clearFilters}><X size={15} aria-hidden="true" />Clear all filters</button>}
        <details className={explore.exports} open={simple ? undefined : true}>
          <summary className={explore.copyToggle}>Keep a copy of these {visible.length} {visible.length === 1 ? 'entry' : 'entries'}</summary>
          <div className={explore.exportButtons}>
            <button type="button" onClick={() => void exportSelection('csv')} disabled={exporting || visible.length === 0 || Boolean(dateError)}><Download size={16} aria-hidden="true" />CSV</button>
            <button type="button" onClick={() => void exportSelection('html')} disabled={exporting || visible.length === 0 || Boolean(dateError)}><Printer size={16} aria-hidden="true" />Printable copy</button>
          </div>
          <p className={explore.help}>Works offline. Only the matching entries are included. The printable copy includes saved photo thumbnails.</p>
          <p className={explore.help}>These notes stay on this device. Keep a copy before clearing browser storage or changing phones.</p>
        </details>
        {(exportNotice || exporting) && <p className={explore.exportNotice} role="status">{exporting ? 'Preparing your copy…' : exportNotice}</p>}
      </section>}

      <JournalPhotoReview entries={visible} />

      </aside>
      <div className={`${workspace.journalTimeline} ${explore.timeline}`}>
      {isZulu && <div role="note" style={{ marginBottom: 10, padding: '9px 12px', borderRadius: 10, background: 'color-mix(in srgb, var(--gold) 14%, var(--bg-1))', color: 'var(--gold-dim)', font: '500 12px/1.45 var(--font-sans), sans-serif' }}>
        Izibonelo namanothi akho akhonjiswa njengoba ebhaliwe. Isibonelo neminye imibhalo isesiNgisini.
      </div>}

      {ready && entries.length > 0 && <div className={explore.resultBar} lang="en">
        <div><p className={explore.eyebrow}>{hasFilters ? 'YOUR SELECTION' : 'YOUR FIELD NOTES'}</p><h2 role="status" aria-live="polite">{visible.length} {visible.length === 1 ? 'entry' : 'entries'}{hasFilters ? ` of ${entries.length}` : ''}</h2></div>
        {hasFilters && <button type="button" className={explore.clearButton} onClick={clearFilters}>Show all entries</button>}
      </div>}
      {ready && entries.length > 0 && visible.length === 0 && <div className={explore.noMatches} lang="en">
        <Search size={26} aria-hidden="true" /><h3>No matching entries</h3><p>{dateError ?? 'Try another word, a wider date range, or clear the filters. Your saved notes are still here.'}</p><button type="button" className={explore.clearButton} onClick={clearFilters}>Clear all filters</button>
      </div>}

      {/* Timeline */}
      {ready && entries.length === 0 && (
        <div>
          <div style={{
            textAlign: 'center', padding: '30px 22px 26px', borderRadius: 16,
            background: 'var(--bg-1)', border: '1px dashed var(--border)', marginBottom: 20,
          }}>
            <NotebookPen size={26} style={{ color: 'var(--text-muted)', margin: '0 auto 10px' }} />
            <div style={{ font: '600 16px var(--font-display), Georgia, serif', color: 'var(--text-primary)', marginBottom: 6 }}>
              {ui('Nothing recorded yet', 'Akukho okubhaliwe okwamanje')}
            </div>
            <div style={{ font: '400 13px/1.5 var(--font-sans), sans-serif', color: 'var(--text-muted)', maxWidth: 320, margin: '0 auto' }}>
              {ui('Write down the date, what you did and what happened. One season of notes is what makes next season’s decisions better — here’s what that looks like.', 'Bhala usuku, okwenzile nokwenzekile. Amanothi esizini eyodwa angasiza ekuthatheni izinqumo ezingcono ngesizini elandelayo — nasi isibonelo.')}
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
              font: '700 12px/1 var(--font-sans), sans-serif', letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'var(--gold)',
            }}>
              <Sparkles size={12} />
              {ui('Example — what an entry looks like', 'Isibonelo — indlela okufakwa ngayo')}
            </div>

            <div style={{ position: 'relative', paddingLeft: 16 }}>
              <div style={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: 2, background: 'var(--border)', borderRadius: 1, opacity: 0.6 }} />
              {EXAMPLE_JOURNAL_ENTRIES.map((ex) => {
                const cat = journalCategory(ex.category);
                return (
                  <article
                    key={ex.id}
                    aria-label={`${ui('Example entry (not a real record)', 'Isibonelo, akulona irekhodi langempela')}: ${ex.title}`}
                    style={{
                      position: 'relative', marginBottom: 10, borderRadius: 14, opacity: 0.82,
                      background: 'var(--bg-1)', border: '1.5px dashed var(--border)',
                      borderLeft: `3px dashed ${cat.ink}`, padding: '12px 40px 12px 13px',
                    }}
                  >
                    <div style={{ position: 'absolute', left: -15, top: 18, width: 10, height: 10, borderRadius: 5, background: 'var(--border)', border: '2px solid var(--bg-0)' }} />
                    <span style={{
                      position: 'absolute', top: 10, right: 10,
                      padding: '3px 7px', borderRadius: 6, background: '#9A6018', color: '#fff',
                      font: '700 12px/1 var(--font-sans), sans-serif', letterSpacing: '0.04em', textTransform: 'uppercase',
                    }}>
                      {ui('Example', 'Isibonelo')}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ font: '600 12px/1 var(--font-sans), sans-serif', color: 'var(--text-muted)' }}>
                        {ex.dateLabel}
                      </span>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 7px', borderRadius: 7, background: cat.tint, color: cat.ink,
                        font: '700 12px/1 var(--font-sans), sans-serif',
                      }}>
                        {getElementArt2(`journal_${cat.key}`) ? (
                          <img className="produce-art produce-art--inline" src={getElementArt2(`journal_${cat.key}`)} alt="" aria-hidden style={{ width: 11, height: 11, objectFit: 'contain', display: 'inline-block', verticalAlign: '-1px' }} />
                        ) : (
                          <cat.icon size={11} aria-hidden />
                        )}{' '}
                        {isZulu ? journalCategoryLabel(cat.key) : cat.label}
                      </span>
                    </div>

                    <div style={{ font: '600 15.5px/1.3 var(--font-display), Georgia, serif', color: 'var(--text-primary)', marginBottom: 4 }}>
                      {ex.title}
                    </div>
                    <div style={{ font: '400 13.5px/1.55 var(--font-sans), sans-serif', color: 'var(--text-secondary)' }}>
                      {ex.notes}
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      <Pill><MapPin size={12} aria-hidden /> {ex.bedLabel}</Pill>
                      <Pill><Leaf size={12} aria-hidden /> {ex.cropName}</Pill>
                    </div>
                  </article>
                );
              })}
            </div>

            <button
              type="button"
              className={motion.newEntry}
              onClick={() => openSheet(null)}
              style={{
                width: '100%', minHeight: 46, borderRadius: 13, cursor: 'pointer', marginTop: 4,
                background: 'var(--bg-1)', border: '1.5px dashed var(--color-forest-800)', color: 'var(--color-forest-800)',
                font: '700 13.5px/1 var(--font-sans), sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
            >
              <Plus size={16} />
              {ui('Log your first real entry', 'Faka umbhalo wakho wokuqala')}
            </button>
          </div>
        </div>
      )}

      {months.map((group, index) => (
        <section key={`${filter}-${group.key}`} className={motion.monthGroup} style={{ marginBottom: 18, animationDelay: `${Math.min(index, 4) * 45}ms` }}>
          <div className={workspace.journalMonth} style={{
            // Tucks under the sticky New-entry bar above (50px button + its padding).
            zIndex: 1,
            padding: '6px 2px 8px', margin: '0 0 6px',
            background: 'linear-gradient(var(--bg-0) 72%, rgba(228,220,198,0))',
            font: '700 12px/1 var(--font-sans), sans-serif', letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--text-muted)',
          }}>
            {isZulu ? formatZuluMonth(group.key) : group.label} · {group.entries.length}
          </div>

          <div style={{ position: 'relative', paddingLeft: 16 }}>
            {/* the spine */}
            <div style={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: 2, background: 'var(--border)', borderRadius: 1 }} />
            {group.entries.map((entry) => {
              const cat = journalCategory(entry.category);
              return (
                <article
                  key={entry.id}
                  className={motion.entry}
                  style={{
                    position: 'relative', marginBottom: 10, borderRadius: 14,
                    background: 'var(--bg-1)', border: '1px solid var(--border)',
                    borderLeft: `3px solid ${cat.ink}`, padding: '12px 12px 12px 13px',
                  }}
                >
                  <div style={{ position: 'absolute', left: -15, top: 18, width: 10, height: 10, borderRadius: 5, background: cat.ink, border: '2px solid var(--bg-0)' }} />

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ font: '600 12px/1 var(--font-sans), sans-serif', color: 'var(--text-muted)' }}>
                          {isZulu ? formatZuluJournalDate(entry.date) : formatJournalDate(entry.date)}
                        </span>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 7px', borderRadius: 7, background: cat.tint, color: cat.ink,
                          font: '700 12px/1 var(--font-sans), sans-serif',
                        }}>
                          {getElementArt2(`journal_${entry.category}`) ? (
                            <img className="produce-art produce-art--inline" src={getElementArt2(`journal_${entry.category}`)} alt="" aria-hidden style={{ width: 11, height: 11, objectFit: 'contain', display: 'inline-block', verticalAlign: '-1px' }} />
                          ) : (
                            <cat.icon size={11} aria-hidden />
                          )}{' '}
                          {isZulu ? journalCategoryLabel(cat.key) : cat.label}
                        </span>
                      </div>

                      {entry.title && (
                        <div style={{ font: '600 15.5px/1.3 var(--font-display), Georgia, serif', color: 'var(--text-primary)', marginBottom: entry.notes ? 4 : 0 }}>
                          {entry.title}
                        </div>
                      )}
                      {entry.notes && (
                        <div style={{ font: '400 13.5px/1.55 var(--font-sans), sans-serif', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                          {entry.notes}
                        </div>
                      )}

                      {(entry.bedLabel || entry.cropName) && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                          {entry.bedLabel && <Pill><MapPin size={12} aria-hidden /> {entry.bedLabel}</Pill>}
                          {entry.cropName && <Pill><Leaf size={12} aria-hidden /> {entry.cropName}</Pill>}
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
                              style={{ width: 62, height: 62, objectFit: 'cover', borderRadius: 9, background: 'var(--bg-2)' }}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className={motion.editEntry}
                      onClick={() => openSheet(entry)}
                      aria-label={`${ui('Edit entry', 'Hlela okufakiwe')}: ${entry.title || (isZulu ? formatZuluJournalDate(entry.date) : formatJournalDate(entry.date))}`}
                      style={{
                        flexShrink: 0, width: 44, height: 44, borderRadius: 10, cursor: 'pointer',
                        background: 'rgba(31,77,43,0.07)', border: '1px solid rgba(31,77,43,0.16)', color: 'var(--color-forest-800)',
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

      </div>
      {sheet.open && (
        <JournalEntrySheet
          entry={sheet.entry}
          initialDraft={sheet.draft}
          beds={beds}
          crops={crops}
          error={sheetError}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => { setSheetError(null); setSheet({ open: false, entry: null }); }}
        />
      )}
    </div>
  );
}

/* ── Small presentational bits ───────────────────────────────────────────── */

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 13, padding: '11px 10px', textAlign: 'center' }}>
      <div className="t-hero" style={{ color: 'var(--color-forest-800)' }}>{value}</div>
      <div style={{ font: '500 12px/1.2 var(--font-sans), sans-serif', color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 8,
      background: 'var(--bg-2)', border: '1px solid var(--border)',
      font: '500 12px/1 var(--font-sans), sans-serif', color: 'var(--text-secondary)',
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
      className={motion.filterChip}
      onClick={onClick}
      aria-pressed={on}
      style={{
        flex: '0 0 auto', minHeight: 44, padding: '0 13px', borderRadius: 19, cursor: 'pointer',
        background: on ? (tint ?? 'var(--badge-bg)') : 'var(--bg-1)',
        border: `1.5px solid ${on ? (ink ?? 'var(--color-forest-800)') : 'var(--border)'}`,
        color: on ? (ink ?? 'var(--color-forest-800)') : 'var(--text-secondary)',
        font: `${on ? 700 : 500} 12.5px/1 var(--font-sans), sans-serif`,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

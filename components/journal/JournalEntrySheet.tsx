'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Camera, Trash2, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { useAppLevel } from '@/lib/app-level';
import { resizeForStorage } from '@/lib/site-evidence';
import {
  JOURNAL_CATEGORIES,
  MAX_NOTES_LEN,
  MAX_PHOTOS_PER_ENTRY,
  MAX_TITLE_LEN,
  todayISODate,
  type JournalCategory,
  type JournalEntry,
  type JournalEntryInput,
} from '@/lib/field-journal';
import { getElementArt2 } from '@/lib/element-art-2';
import motion from './JournalMotion.module.css';
import { inlineText } from '@/lib/xh-inline';
import { journalCategoryLabel } from './journal-labels';
import { useEscapeClose } from '@/lib/use-escape-close';
import { useDialogFocus } from '@/lib/use-dialog-focus';
import { farmMemoryText } from '@/lib/farm-memory-copy';

export interface BedOption {
  id: string;
  label: string;
}

interface Props {
  /** null = creating a new entry. */
  entry: JournalEntry | null;
  /** A plan is a prompt to write, never proof that the work happened. */
  initialDraft?: Partial<JournalEntryInput>;
  beds: BedOption[];
  crops: string[];
  onSave: (input: JournalEntryInput) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
  /** A save that failed to persist (e.g. storage full) — shown without closing the sheet. */
  error?: string | null;
}

/* Bottom sheet, phone-first: 92dvh cap, 22px top radius, safe-area padding —
   the same chrome components/EvidenceSheet.tsx uses, so the journal does not
   introduce a second modal idiom. */
export default function JournalEntrySheet({ entry, initialDraft, beds, crops, onSave, onDelete, onClose, error }: Props) {
  const { lang } = useLanguage();
  const isZulu = lang === 'zu';
  const ui = (english: string, zulu: string) => inlineText(lang, english, zulu);
  const simple = useAppLevel() === 'simple';
  const [date, setDate] = useState(entry?.date ?? initialDraft?.date ?? todayISODate());
  const [title, setTitle] = useState(entry?.title ?? initialDraft?.title ?? '');
  const [notes, setNotes] = useState(entry?.notes ?? initialDraft?.notes ?? '');
  const [category, setCategory] = useState<JournalCategory>(entry?.category ?? initialDraft?.category ?? 'planting');
  const [bedId, setBedId] = useState<string>(entry?.bedId ?? initialDraft?.bedId ?? '');
  const [bedLabel, setBedLabel] = useState<string>(entry?.bedLabel ?? initialDraft?.bedLabel ?? '');
  const [cropName, setCropName] = useState<string>(entry?.cropName ?? initialDraft?.cropName ?? '');
  const [photos, setPhotos] = useState<string[]>(entry?.photos ?? []);
  const [busy, setBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLFormElement>(null);
  useDialogFocus(true, dialogRef);
  // bug-12: two-tap delete, same pattern as app/records/page.tsx's SalesLedger — first tap
  // arms a confirm (reverting on its own after 3.5s), second tap within that window deletes.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEscapeClose(true, onClose);

  useEffect(() => () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); }, []);

  function requestDelete() {
    if (!entry || !onDelete) return;
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    if (confirmDelete) {
      setConfirmDelete(false);
      onDelete(entry.id);
      return;
    }
    setConfirmDelete(true);
    confirmTimer.current = setTimeout(() => setConfirmDelete(false), 3500);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setPhotoError(null);
    const next = [...photos];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_PHOTOS_PER_ENTRY) break;
      if (!file.type.startsWith('image/')) continue;
      try {
        // Always through resizeForStorage: a full-size phone photo would blow the
        // localStorage quota on the first entry and silently lose the farmer's notes.
        next.push(await resizeForStorage(file, 400));
      } catch {
        setPhotoError(ui('That photo could not be read. Try again.', 'Leso sithombe asikwazanga ukufundwa. Zama futhi.'));
      }
    }
    setPhotos(next);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() && !notes.trim()) return;
    const bed = beds.find((b) => b.id === bedId);
    onSave({
      date,
      title: title.trim(),
      notes: notes.trim(),
      category,
      bedId: bedId || null,
      // An old observation keeps the name it had then; the picker changes both
      // fields explicitly when the farmer chooses a different bed.
      bedLabel: bedLabel.trim() || bed?.label || null,
      cropName: cropName.trim() || null,
      photos,
    });
  }

  const canSave = Boolean(title.trim() || notes.trim());

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center ${motion.overlay}`}
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={entry ? ui('Edit journal entry', 'Hlela okubhaliwe kwejenali') : ui('New journal entry', 'Okusha kwejenali')}
        onSubmit={submit}
        className={`w-full max-w-md font-sans overflow-y-auto ${motion.sheet}`}
        style={{
          background: 'var(--bg-1)', borderRadius: '22px 22px 0 0',
          maxHeight: '92dvh',
          // Deep enough to clear BOTH the tab bar and components/SampleModeBanner.tsx,
          // which is fixed at bottom 60px with z-index 9999 and wraps to two lines on a
          // phone. Measured on a 375x812 viewport the banner covers y 658-752, and with
          // the old 20px padding the Save button landed at y 740 — completely hidden for
          // the whole of a sample-mode demo.
          paddingBottom: 'calc(160px + env(safe-area-inset-bottom))',
        }}
      >
        {/* Grab handle + header */}
        <div style={{ position: 'sticky', top: 0, background: 'var(--bg-1)', zIndex: 2, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
            <div style={{ width: 38, height: 4, borderRadius: 2, background: 'var(--border-strong)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px 14px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ font: '600 17px var(--font-display), Georgia, serif', color: 'var(--text-primary)' }}>
                {entry ? ui('Edit journal entry', 'Hlela okubhaliwe kwejenali') : ui('New journal entry', 'Okusha kwejenali')}
              </div>
              <div style={{ font: '400 12px/1.4 var(--font-sans), sans-serif', color: 'var(--text-muted)', marginTop: 1 }}>
                {ui('Date, weather, action and result — those four make a note useful later.', 'Usuku, isimo sezulu, okwenzile nomphumela — lokhu kusiza ukuthi inothi libe wusizo kamuva.')}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={ui('Close', 'Vala')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, minWidth: 44, minHeight: 44, color: 'var(--text-muted)' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div style={{ padding: '16px 20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {initialDraft && !entry && (
            <p role="note" lang={isZulu ? 'zu' : 'en'} style={{ margin: 0, padding: 12, borderRadius: 12, background: 'var(--bg-2)', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>
              {farmMemoryText(lang, 'taskDraftNotice')}
            </p>
          )}
          {/* Category — big tap targets, wraps on a phone. Collapsed in Simple: the note still
              saves with its default category ('planting', or the entry's own on edit) — hiding
              the picker never changes what gets stored. */}
          {!simple && (
            <div>
              <Label>{ui('What kind of note?', 'Lolu hlobo luni lwenothi?')}</Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {JOURNAL_CATEGORIES.map((c) => {
                  const on = c.key === category;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setCategory(c.key)}
                      aria-pressed={on}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        minHeight: 40, padding: '9px 12px', borderRadius: 11, cursor: 'pointer',
                        background: on ? c.tint : 'var(--bg-1)',
                        border: `1.5px solid ${on ? c.ink : 'var(--border)'}`,
                        color: on ? c.ink : 'var(--text-secondary)',
                        font: `${on ? 700 : 500} 13px/1 var(--font-sans), sans-serif`,
                      }}
                    >
                      {getElementArt2(`journal_${c.key}`) ? (
                        <img className="produce-art" src={getElementArt2(`journal_${c.key}`)} alt="" aria-hidden style={{ width: 15, height: 15, objectFit: 'contain' }} />
                      ) : (
                        <c.icon size={15} aria-hidden />
                      )}
                      {isZulu ? journalCategoryLabel(c.key) : inlineText(lang, c.label)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Date defaults to today (or the entry's own date on edit) whether or not this
              field is shown — Simple keeps that default instead of asking for it. */}
          {(!simple || initialDraft) && (
            <div>
              <Label>{ui('Date', 'Usuku')}</Label>
              <input className="focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-1"
                type="date"
                aria-label={ui('Date', 'Usuku')}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={inputStyle}
              />
            </div>
          )}

          <div>
            <Label>{ui('Title', 'Isihloko')}</Label>
            <input className="focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-1"
              type="text"
              aria-label={ui('Title', 'Isihloko')}
              value={title}
              maxLength={MAX_TITLE_LEN}
              placeholder={ui('e.g. First chard cut from Bed 1', 'isib. Ukuvunwa kokuqala kwe-chard embhedeni 1')}
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <Label>{ui('Notes', 'Amanothi')}</Label>
            <textarea className="focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-1"
              aria-label={ui('Notes', 'Amanothi')}
              value={notes}
              rows={5}
              maxLength={MAX_NOTES_LEN}
              placeholder={ui('What did you see, what did you do, what happened after?', 'Uboneni, wenzeni, kwenzekeni ngemva kwalokho?')}
              onChange={(e) => setNotes(e.target.value)}
              style={{ ...inputStyle, minHeight: 110, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {/* Bed/plot and crop — extra fields, left unlinked/blank by default in both modes,
              so collapsing them in Simple never changes what gets saved. */}
          {(!simple || initialDraft) && (
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Label>{ui('Bed / plot', 'Umbhede / isiqephu')}</Label>
                {beds.length > 0 ? (
                  <select className="focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-1" aria-label={ui('Bed / plot', 'Umbhede / isiqephu')} value={bedId} onChange={(e) => {
                    setBedId(e.target.value);
                    setBedLabel(beds.find((bed) => bed.id === e.target.value)?.label ?? '');
                  }} style={inputStyle}>
                    <option value="">{ui('Not linked', 'Akuxhunyiwe')}</option>
                    {bedId && !beds.some((bed) => bed.id === bedId) && <option value={bedId}>{bedLabel || bedId}</option>}
                    {beds.map((b) => <option key={b.id} value={b.id}>{b.id === bedId && bedLabel && bedLabel !== b.label ? farmMemoryText(lang, 'renamedBed', { recorded: bedLabel, current: b.label }) : b.label}</option>)}
                  </select>
                ) : (
                  <input className="focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-1"
                    type="text"
                    aria-label={ui('Bed / plot', 'Umbhede / isiqephu')}
                    value={bedLabel}
                    placeholder={ui('e.g. Bed 4', 'isib. Umbhede 4')}
                    onChange={(e) => { setBedLabel(e.target.value); setBedId(''); }}
                    style={inputStyle}
                  />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <Label>{ui('Crop', 'Isitshalo')}</Label>
                <input className="focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-1"
                  type="text"
                  aria-label={ui('Crop', 'Isitshalo')}
                  list="journal-crop-options"
                  value={cropName}
                  placeholder={ui('Optional', 'Akudingeki')}
                  onChange={(e) => setCropName(e.target.value)}
                  style={inputStyle}
                />
                <datalist id="journal-crop-options">
                  {crops.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>
          )}

          {/* Photos */}
          <div>
            <Label>{ui('Photos', 'Izithombe')} {photos.length > 0 ? `· ${photos.length}/${MAX_PHOTOS_PER_ENTRY}` : ''}</Label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {photos.map((src, i) => (
                <div key={`${i}-${src.slice(-12)}`} style={{ position: 'relative', width: 68, height: 68, borderRadius: 10, overflow: 'hidden', background: 'var(--bg-2)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    type="button"
                    aria-label={ui('Remove photo', 'Susa isithombe')}
                    onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                    style={{
                      position: 'absolute', top: 2, right: 2, width: 22, height: 22, borderRadius: 11,
                      background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS_PER_ENTRY && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  style={{
                    width: 68, height: 68, borderRadius: 10, cursor: 'pointer',
                    background: 'var(--bg-1)', border: '1.5px dashed var(--border)', color: 'var(--color-forest-700)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                    font: '600 12px/1 var(--font-sans), sans-serif',
                  }}
                >
                  {busy ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                  {busy ? '' : ui('Add', 'Engeza')}
                </button>
              )}
            </div>
            {photoError && (
              <div style={{ marginTop: 6, font: '500 12px/1.4 var(--font-sans), sans-serif', color: 'var(--orange)' }}>{photoError}</div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>
        </div>

        {error && (
          <div style={{
            margin: '16px 20px 0', padding: '10px 13px', borderRadius: 11,
            background: 'color-mix(in srgb, var(--gold) 14%, var(--bg-1))', border: '1px solid color-mix(in srgb, var(--gold) 30%, transparent)',
            font: '500 12.5px/1.45 var(--font-sans), sans-serif', color: 'var(--gold-dim)',
          }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, padding: '20px 20px 4px' }}>
          {entry && onDelete && (
            <button
              type="button"
              onClick={requestDelete}
              aria-label={confirmDelete ? ui('Confirm delete', 'Qinisekisa ukususa') : ui('Delete', 'Susa')}
              style={confirmDelete ? {
                minHeight: 48, padding: '0 16px', borderRadius: 12, cursor: 'pointer',
                background: 'color-mix(in srgb, var(--orange) 12%, transparent)', border: '1.5px solid color-mix(in srgb, var(--orange) 40%, transparent)', color: 'var(--orange)',
                font: '700 14px/1 var(--font-sans), sans-serif', display: 'flex', alignItems: 'center', gap: 7,
              } : {
                minHeight: 48, padding: '0 16px', borderRadius: 12, cursor: 'pointer',
                background: 'var(--bg-1)', border: '1.5px solid color-mix(in srgb, var(--orange) 30%, transparent)', color: 'var(--orange)',
                font: '600 14px/1 var(--font-sans), sans-serif', display: 'flex', alignItems: 'center', gap: 7,
              }}
            >
              <Trash2 size={16} />
              {confirmDelete ? ui('Sure?', 'Uqinisekile?') : ui('Delete', 'Susa')}
            </button>
          )}
          <button
            type="submit"
            disabled={!canSave || busy}
            style={{
              flex: 1, minHeight: 48, borderRadius: 12, border: 'none',
              cursor: canSave && !busy ? 'pointer' : 'not-allowed',
              background: canSave && !busy ? 'var(--color-forest-800)' : 'color-mix(in srgb, var(--color-forest-800) 25%, transparent)',
              color: 'var(--on-forest-800)', font: '700 15px/1 var(--font-sans), sans-serif',
            }}
          >
            {entry ? ui('Save changes', 'Gcina izinguquko') : ui('Save entry', 'Gcina okubhaliwe')}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 46,
  background: 'var(--bg-1)',
  border: '1px solid var(--border)',
  borderRadius: 11,
  padding: '11px 12px',
  font: '400 15px/1.2 var(--font-sans), sans-serif',
  color: 'var(--text-primary)',
  outline: 'none',
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      font: '700 12px/1 var(--font-sans), sans-serif', letterSpacing: '0.1em',
      textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

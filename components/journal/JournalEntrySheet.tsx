'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Camera, Trash2, Loader2 } from 'lucide-react';
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

export interface BedOption {
  id: string;
  label: string;
}

interface Props {
  /** null = creating a new entry. */
  entry: JournalEntry | null;
  beds: BedOption[];
  crops: string[];
  onSave: (input: JournalEntryInput) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

/* Bottom sheet, phone-first: 92dvh cap, 22px top radius, safe-area padding —
   the same chrome components/EvidenceSheet.tsx uses, so the journal does not
   introduce a second modal idiom. */
export default function JournalEntrySheet({ entry, beds, crops, onSave, onDelete, onClose }: Props) {
  const [date, setDate] = useState(entry?.date ?? todayISODate());
  const [title, setTitle] = useState(entry?.title ?? '');
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [category, setCategory] = useState<JournalCategory>(entry?.category ?? 'planting');
  const [bedId, setBedId] = useState<string>(entry?.bedId ?? '');
  const [bedLabel, setBedLabel] = useState<string>(entry?.bedLabel ?? '');
  const [cropName, setCropName] = useState<string>(entry?.cropName ?? '');
  const [photos, setPhotos] = useState<string[]>(entry?.photos ?? []);
  const [busy, setBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
        setPhotoError('That photo could not be read. Try again.');
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
      bedId: bed ? bed.id : null,
      bedLabel: bed ? bed.label : (bedLabel.trim() || null),
      cropName: cropName.trim() || null,
      photos,
    });
  }

  const canSave = Boolean(title.trim() || notes.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md font-sans overflow-y-auto"
        style={{
          background: '#FBF8F1', borderRadius: '22px 22px 0 0',
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
        <div style={{ position: 'sticky', top: 0, background: '#FBF8F1', zIndex: 2, borderBottom: '1px solid #EFE7D6' }}>
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
            <div style={{ width: 38, height: 4, borderRadius: 2, background: '#DED3BC' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px 14px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ font: '600 17px Newsreader, Georgia, serif', color: '#2D2519' }}>
                {entry ? 'Edit journal entry' : 'New journal entry'}
              </div>
              <div style={{ font: '400 11.5px/1.4 system-ui, sans-serif', color: '#8A7C62', marginTop: 1 }}>
                Date, weather, action and result — those four make a note useful later.
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#8A7C62' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div style={{ padding: '16px 20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Category — big tap targets, wraps on a phone */}
          <div>
            <Label>What kind of note?</Label>
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
                      background: on ? c.tint : '#FFFEFA',
                      border: `1.5px solid ${on ? c.ink : '#E2D8C4'}`,
                      color: on ? c.ink : '#5C5040',
                      font: `${on ? 700 : 500} 13px/1 system-ui, sans-serif`,
                    }}
                  >
                    <span style={{ fontSize: 15 }}>{c.icon}</span>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label>Date</Label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <Label>Title</Label>
            <input
              type="text"
              value={title}
              maxLength={MAX_TITLE_LEN}
              placeholder="e.g. First chard cut from Bed 1"
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <Label>Notes</Label>
            <textarea
              value={notes}
              rows={5}
              maxLength={MAX_NOTES_LEN}
              placeholder="What did you see, what did you do, what happened after?"
              onChange={(e) => setNotes(e.target.value)}
              style={{ ...inputStyle, minHeight: 110, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Label>Bed / plot</Label>
              {beds.length > 0 ? (
                <select value={bedId} onChange={(e) => setBedId(e.target.value)} style={inputStyle}>
                  <option value="">Not linked</option>
                  {beds.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={bedLabel}
                  placeholder="e.g. Bed 4"
                  onChange={(e) => setBedLabel(e.target.value)}
                  style={inputStyle}
                />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <Label>Crop</Label>
              <input
                type="text"
                list="journal-crop-options"
                value={cropName}
                placeholder="Optional"
                onChange={(e) => setCropName(e.target.value)}
                style={inputStyle}
              />
              <datalist id="journal-crop-options">
                {crops.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          {/* Photos */}
          <div>
            <Label>Photos {photos.length > 0 ? `· ${photos.length}/${MAX_PHOTOS_PER_ENTRY}` : ''}</Label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {photos.map((src, i) => (
                <div key={`${i}-${src.slice(-12)}`} style={{ position: 'relative', width: 68, height: 68, borderRadius: 10, overflow: 'hidden', background: '#E0D6C2' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    type="button"
                    aria-label="Remove photo"
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
                    background: '#FFFEFA', border: '1.5px dashed #CFC4AC', color: '#3C6B3F',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                    font: '600 10px/1 system-ui, sans-serif',
                  }}
                >
                  {busy ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                  {busy ? '' : 'Add'}
                </button>
              )}
            </div>
            {photoError && (
              <div style={{ marginTop: 6, font: '500 12px/1.4 system-ui, sans-serif', color: '#B91C1C' }}>{photoError}</div>
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

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, padding: '20px 20px 4px' }}>
          {entry && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(entry.id)}
              style={{
                minHeight: 48, padding: '0 16px', borderRadius: 12, cursor: 'pointer',
                background: '#FFFEFA', border: '1.5px solid #E7C9C6', color: '#9B3630',
                font: '600 14px/1 system-ui, sans-serif', display: 'flex', alignItems: 'center', gap: 7,
              }}
            >
              <Trash2 size={16} />
              Delete
            </button>
          )}
          <button
            type="submit"
            disabled={!canSave || busy}
            style={{
              flex: 1, minHeight: 48, borderRadius: 12, border: 'none',
              cursor: canSave && !busy ? 'pointer' : 'not-allowed',
              background: canSave && !busy ? '#274D2C' : 'rgba(39,77,44,0.25)',
              color: '#fff', font: '700 15px/1 system-ui, sans-serif',
            }}
          >
            {entry ? 'Save changes' : 'Save entry'}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 46,
  background: '#FFFEFA',
  border: '1px solid #E2D8C4',
  borderRadius: 11,
  padding: '11px 12px',
  font: '400 15px/1.2 system-ui, sans-serif',
  color: '#20190F',
  outline: 'none',
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      font: '700 10.5px/1 system-ui, sans-serif', letterSpacing: '0.1em',
      textTransform: 'uppercase', color: '#8A7C62', marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

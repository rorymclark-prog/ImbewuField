'use client';

import { useRef, useState } from 'react';
import ChatPanel from './ChatPanel';
import { useSampleRole } from '@/lib/use-role-navigation';
import { Camera, MessageCircleQuestion, X } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n';

interface LimaBarProps {
  /** Where the ask-for-help control leads. */
  chatHref?: string;
}

/**
 * THE HELP STRIP ABOVE THE TAB BAR — a labelled control, not an open composer.
 *
 * This used to be a free-text input reading "Ask Lima anything...", pinned to the most valuable
 * strip on the home screen, on every visit. Two problems, both found in the Gogo Test audit:
 *
 *   • AN OPEN TEXT BOX IS THE HARDEST INTERFACE THERE IS for someone who types slowly and does
 *     not know what the machine will accept. It sat under her thumb by default and demanded she
 *     compose a question before she knew one was possible. Free text should be a place she
 *     chooses to go, not the resting state of the screen.
 *   • "LIMA" WAS NEVER INTRODUCED — a proper noun with no referent. Is it a person, the app, her
 *     programme, her mentor? And the placeholder was hardcoded English, so the single most
 *     prominent line on the home screen was untranslated for every non-English speaker.
 *
 * Photo opens the native picker in the tap handler: routing to the map first loses
 * the user gesture needed by iPhone Safari. The chosen photo stays in a local Lima dialog
 * until the farmer explicitly sends it.
 */
export default function LimaBar({ chatHref = '/farmer?chat=1' }: LimaBarProps) {
  const { t, lang } = useLanguage();
  const sampleRole = useSampleRole();
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);

  function openPhotoChat(file: File | null) {
    setPhoto(file);
    setPhotoOpen(true);
    dialogRef.current?.showModal();
  }

  return (
    <div
      className="px-4 pt-2 pb-2.5"
      style={{ background: '#FFFEFA', borderTop: '1px solid #E2D8C4', flexShrink: 0 }}
    >
      <div className="w-full max-w-5xl mx-auto">
        {/* Who Lima is — said every time rather than once, because it costs one short line and a
            farmer who opens the app twice a season should not have to remember. */}
        <div
          className="flex items-center gap-1.5 font-sans"
          style={{ fontSize: 12, fontWeight: 600, color: '#7A6B52', marginBottom: 6, paddingLeft: 2 }}
        >
          <span
            className="inline-flex items-center justify-center flex-shrink-0"
            style={{ width: 20, height: 20, background: 'linear-gradient(135deg, var(--brand-light), var(--brand-strong))', borderRadius: 6 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EAF3E2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 21V11" />
              <path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z" />
              <path d="M12 13c0-3 2.2-5.2 6-5.2 0 3.6-2.2 5.2-6 5.2Z" />
            </svg>
          </span>
          {t('limaWhoIs')}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={chatHref}
            className="flex-1 flex items-center justify-center gap-2 font-sans"
            style={{
              minHeight: 46, borderRadius: 12, textDecoration: 'none',
              background: 'linear-gradient(135deg, var(--brand-light), var(--brand-strong))',
              color: '#F7F2E9', fontSize: 15, fontWeight: 700,
              boxShadow: '0 2px 8px rgba(31,77,43,0.22)',
            }}
          >
            <MessageCircleQuestion size={18} strokeWidth={2} />
            {t('limaAskButton')}
          </Link>

          {/* The camera keeps its own control rather than hiding inside the chat, but it now says
              what it does. An unlabelled icon is a guess, and she only gets one guess. */}
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) openPhotoChat(file);
            }} />
          <button
            type="button"
            onClick={() => sampleRole ? openPhotoChat(null) : fileRef.current?.click()}
            className="flex items-center justify-center gap-1.5 font-sans"
            style={{
              minHeight: 46, padding: '0 13px', borderRadius: 12, textDecoration: 'none',
              background: '#fff', border: '1.5px solid #D8CBB2',
              color: '#4A4034', fontSize: 13.5, fontWeight: 700,
            }}
          >
            <Camera size={17} strokeWidth={2} />
            {t('limaPhotoButton')}
          </button>
        </div>
      </div>
      <dialog ref={dialogRef} aria-labelledby="lima-photo-title"
        className="m-auto rounded-2xl p-0 backdrop:bg-black/40"
        style={{ width: 'min(94vw, 560px)', maxHeight: '85dvh', background: '#FFFEFA', color: '#20190F' }}
        onClose={() => { setPhotoOpen(false); setPhoto(null); }}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 p-4" style={{ background: '#FFFEFA' }}>
          <h2 id="lima-photo-title" className="font-semibold">{t('limaWhoIs')}</h2>
          <button type="button" aria-label="Close" className="flex min-h-11 min-w-11 items-center justify-center"
            onClick={() => dialogRef.current?.close()}><X size={22} /></button>
        </div>
        <div className="p-4 pt-0">
          {photoOpen && <ChatPanel locationData={null} appLang={lang} initialFile={photo} />}
        </div>
      </dialog>
    </div>
  );
}

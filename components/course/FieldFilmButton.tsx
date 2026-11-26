'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, Download, Play, X } from 'lucide-react';
import { fieldFilmTitle, filmEdition, FILM_LANGUAGES, FILM_LANGUAGE_NAMES, matchingFilmTime, type FieldFilm, type FilmLanguage } from '@/lib/field-films';
import styles from './FieldFilmButton.module.css';
import FieldFilmCaptions from './FieldFilmCaptions';

const copy = {
  en: { play: 'Play', next: 'Next', close: 'Close', language: 'Language', captions: 'Captions', voice: 'Narration and captions', save: 'Download film', captionError: 'The captions could not load.', error: 'The film could not load. Check your connection or download the film.' },
  zu: { play: 'Dlala', next: 'Okulandelayo', close: 'Vala', language: 'Ulimi', captions: 'Imibhalo engezansi', voice: 'Izwi nemibhalo engezansi', save: 'Landa ividiyo', captionError: 'Imibhalo engezansi ayilayishekanga.', error: 'Ividiyo ayilayishekanga. Hlola uxhumano lwakho noma ulande ividiyo.' },
  st: { play: 'Bapala', next: 'E latelang', close: 'Kwala', language: 'Puo', captions: 'Mengolo e ka tlase', voice: 'Lentswe le mengolo e ka tlase', save: 'Jarolla video', captionError: 'Mengolo e ka tlase ha e a buleha.', error: 'Video ha e a buleha. Hlahloba kgokelo ya hao kapa o jarolle video.' },
  ve: { play: 'Tshimbidzani', next: 'I tevhelaho', close: 'Valani', language: 'Luambo', captions: 'Maṅwalwa a fhasi', voice: 'Ipfi na maṅwalwa a fhasi', save: 'Dzhiani vidio', captionError: 'Maṅwalwa a fhasi a songo vulea.', error: 'Vidio a yo ngo vulea. Ṱolani vhukwamani haṋu kana ni dzhiye vidio.' },
  ts: { play: 'Tlanga', next: 'Lexi landzelaka', close: 'Pfala', language: 'Ririmi', captions: 'Matsalwa ya le hansi', voice: 'Rito ni matsalwa ya le hansi', save: 'Dawuniloda vhidiyo', captionError: 'Matsalwa ya le hansi a ma pfulanga.', error: 'Vhidiyo a yi pfulanga. Kambela vuhlanganisi bya wena kumbe u dawuniloda vhidiyo.' },
};


type Props = { film: FieldFilm; lang: string; onOpen?: () => void };

export default function FieldFilmButton({ film, lang, onOpen }: Props) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const entry = filmEdition(film, lang);
  const ui = copy[FILM_LANGUAGES.find(code => code === lang) ?? 'en'];
  return <>
    <button type="button" ref={trigger} className={styles.launch} aria-haspopup="dialog" data-field-film={film}
      onClick={() => { onOpen?.(); setOpen(true); }}>
      <Play size={18} aria-hidden="true" />
      <span><strong>{ui.play} · <span lang={entry.lang}>{fieldFilmTitle(film, entry.lang)}</span></strong>
        <span className={styles.detail}>{FILM_LANGUAGE_NAMES[entry.lang]} · {entry.captionOnly ? ui.captions + ' · ' : ''}{entry.seconds}s · {entry.size}</span>
      </span>
    </button>
    {open && <FieldFilmPlayer film={film} lang={entry.lang} onClose={() => { setOpen(false); trigger.current?.focus({ preventScroll: true }); }} />}
  </>;
}

function FieldFilmPlayer({ film: first, lang: initial, onClose }: { film: FieldFilm; lang: FilmLanguage; onClose: () => void }) {
  const [film, setFilm] = useState(first);
  const [lang, setLang] = useState(initial);
  const [failed, setFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  const captions = useRef<HTMLTrackElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const nativeFallback = useRef(false);
  const start = useRef({ seconds: 0, play: true });
  const headingId = useId();
  const edition = filmEdition(film, lang);
  const ui = copy[lang];
  const next = filmEdition('walk', lang);
  const isFrame = film === 'level' || film === 'walk';

  useEffect(() => { dialog.current?.showModal(); }, []);

  // Keep the ledger and the plumb line clear. Inline captions sit beneath the picture.
  // Native fullscreen only contains the video, so give it the selected subtitle track.
  function selectCaptions() {
    const video = player.current;
    if (!video || !video.textTracks) return;
    const fullscreen = document.fullscreenElement === video ||
      (video as HTMLVideoElement & { webkitDisplayingFullscreen?: boolean }).webkitDisplayingFullscreen;
    const chosen = captions.current?.track;
    for (const track of Array.from(video.textTracks)) {
      if (track !== chosen && track.mode !== 'disabled') track.mode = 'disabled';
    }
    if (chosen) chosen.mode = fullscreen || nativeFallback.current ? 'showing' : 'disabled';
  }

  useEffect(() => {
    const video = player.current;
    if (!video?.textTracks) return;
    const afterDiscovery = () => queueMicrotask(selectCaptions);
    selectCaptions();
    video.textTracks.addEventListener('addtrack', afterDiscovery);
    video.addEventListener('webkitbeginfullscreen', afterDiscovery);
    video.addEventListener('webkitendfullscreen', afterDiscovery);
    document.addEventListener('fullscreenchange', selectCaptions);
    return () => {
      video.textTracks.removeEventListener('addtrack', afterDiscovery);
      video.removeEventListener('webkitbeginfullscreen', afterDiscovery);
      video.removeEventListener('webkitendfullscreen', afterDiscovery);
      document.removeEventListener('fullscreenchange', selectCaptions);
    };
  }, [lang, film]);

  const useNativeCaptions = useCallback(() => {
    nativeFallback.current = true;
    if (captions.current?.track) captions.current.track.mode = 'showing';
  }, []);

  function changeLanguage(value: string) {
    const nextEdition = filmEdition(film, value);
    const video = player.current;
    if (video && edition.src !== nextEdition.src) {
      start.current = { seconds: matchingFilmTime(edition, nextEdition, video.currentTime), play: !video.paused };
      video.pause();
    }
    nativeFallback.current = false;
    setFailed(false);
    setLang(nextEdition.lang);
  }

  function continueToSlope() {
    player.current?.pause();
    start.current = { seconds: 0, play: true };
    nativeFallback.current = false;
    setFailed(false);
    setFilm('walk');
    heading.current?.focus();
  }

  return <dialog ref={dialog} data-film-player={film} className={styles.player} lang={lang}
    aria-labelledby={headingId} onKeyDown={e => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        e.preventDefault(); e.stopPropagation(); dialog.current?.close();
      }
    }} onCancel={e => { e.preventDefault(); e.stopPropagation(); dialog.current?.close(); }} onClose={e => { e.stopPropagation(); onClose(); }}>
    <div className={styles.body}>
      <header className={styles.header}>
        <h3 ref={heading} tabIndex={-1} id={headingId}>{fieldFilmTitle(film, lang)}</h3>
        <button type="button" className={styles.close} aria-label={ui.close} onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></button>
      </header>
      {isFrame ? <label className={styles.choice}>{ui.language}
        <select value={lang} onChange={e => changeLanguage(e.target.value)}>
          {FILM_LANGUAGES.map(code => <option key={code} value={code}>{FILM_LANGUAGE_NAMES[code]} · {filmEdition(film, code).captionOnly ? ui.captions : ui.voice}</option>)}
        </select>
      </label> : <p className={styles.choice}>English · {ui.voice}</p>}
      <video className={styles.film} key={edition.src} ref={player} src={edition.src}
        controls playsInline preload="auto" onLoadedData={selectCaptions} onCanPlay={selectCaptions} aria-label={fieldFilmTitle(film, lang)} onError={() => setFailed(true)}
        onLoadedMetadata={e => {
          const video = e.currentTarget;
          if (start.current.seconds > 0) video.currentTime = start.current.seconds;
          selectCaptions();
          if (start.current.play) void video.play().catch(() => { /* Native controls remain available. */ });
        }}>
        <track key={lang} ref={captions} kind="captions" srcLang={lang} label={FILM_LANGUAGE_NAMES[lang]}
          src={edition.track} onLoad={selectCaptions} />
      </video>
      <FieldFilmCaptions key={edition.track} video={player} src={edition.track} lang={lang}
        errorText={ui.captionError} onUnavailable={useNativeCaptions} />
      {failed && <p className={styles.error} role="status">{ui.error}</p>}
      <div className={styles.footer}>
        {film === 'level' && <button type="button" className={styles.next} data-field-film="walk" onClick={continueToSlope}>
          <ArrowRight size={18} aria-hidden="true" /><span><strong>{ui.next} · {fieldFilmTitle('walk', lang)}</strong>
            <span className={styles.detail}>{FILM_LANGUAGE_NAMES[lang]} · {next.seconds}s · {next.size}</span></span>
        </button>}
        <a className={styles.download} href={edition.src} download><Download size={16} aria-hidden="true" />{ui.save} · {edition.size}</a>
        {edition.captionOnly && <a className={styles.download} href={edition.track} download>{FILM_LANGUAGE_NAMES[lang]} · {ui.captions}</a>}
      </div>
      {lang === 'zu' && <p className={styles.note}>Lo msindo wesiZulu uwuhlaka olwenziwe yikhompyutha. Ukulalelwa nokubuyekezwa ngumuntu okhuluma kahle isiZulu kanye nomuntu onolwazi lokulima kwasendaweni kusalindile.</p>}
    </div>
  </dialog>;
}

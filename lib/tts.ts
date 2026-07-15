'use client';

/**
 * Lima voice guidance — Web Speech API (SpeechSynthesis) utility.
 * Zero cost, no API key, no network: purely client-side via `window.speechSynthesis`.
 *
 * HONEST LIMITATION (record this, don't paper over it): device voice coverage for South
 * African languages is poor. Android's Google TTS commonly ships an Afrikaans voice and
 * sometimes isiZulu/isiXhosa, but Sesotho, Northern Sotho, Setswana, Xitsonga, Tshivenda,
 * siSwati and isiNdebele voices are almost never present on a real device. When no native
 * voice exists for the app language, this module falls back to reading the ENGLISH copy in
 * an English voice — that is EXPECTED and INTENTIONAL. It must never read non-language text
 * in the wrong voice (e.g. isiZulu text spoken by an English voice produces garbage
 * pronunciation), so the caller always supplies the English source string alongside the
 * translated one. Coverage upgrades automatically as device voice lists and app translations
 * improve over time — no changes needed here when that happens.
 */

/** app-lang -> BCP-47 the device voice list might use. Mirrors LANG_TO_LOCALE
 *  (app/home/page.tsx:42-54) — keep the two in sync. */
export const LANG_TO_BCP47: Record<string, string> = {
  en: 'en-ZA',
  af: 'af-ZA',
  zu: 'zu-ZA',
  xh: 'xh-ZA',
  st: 'st-ZA',
  nso: 'nso-ZA',
  tn: 'tn-ZA',
  ts: 'ts-ZA',
  ve: 've-ZA',
  ss: 'ss-ZA',
  nr: 'nr-ZA',
};

const TTS_MUTED_KEY = 'imbewu_tts_muted_v1';
const TTS_CHANGED_EVENT = 'imbewu-tts-changed';
const VOICES_WAIT_TIMEOUT_MS = 1000;
const UTTERANCE_RATE = 0.95;

/** True only in a browser that exposes the SpeechSynthesis API. SSR-safe. */
export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Reads the persisted mute preference. Defaults to false (unmuted) on any failure
 *  (SSR, private-browsing storage errors, absent key). */
export function getTtsMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(TTS_MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Persists the mute preference and notifies listeners (e.g. ThemePanel's toggle row). */
export function setTtsMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TTS_MUTED_KEY, muted ? '1' : '0');
  } catch {
    // Storage unavailable (private mode, quota) — degrade silently, no crash.
  }
  try {
    window.dispatchEvent(new CustomEvent(TTS_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

/** Primary language subtag of a BCP-47 tag, lower-cased ('zu-ZA' -> 'zu'). */
function primarySubtag(tag: string | undefined | null): string {
  return (tag ?? '').split(/[-_]/)[0]?.toLowerCase() ?? '';
}

/** Exact BCP-47 match first ('zu-ZA'), then language-prefix match ('zu'), else null. */
function matchVoiceForLang(voices: SpeechSynthesisVoice[], appLang: string): SpeechSynthesisVoice | null {
  const bcp47 = LANG_TO_BCP47[appLang];
  if (bcp47) {
    const exact = voices.find((v) => (v.lang ?? '').toLowerCase() === bcp47.toLowerCase());
    if (exact) return exact;
  }
  const wantPrimary = appLang.toLowerCase();
  const prefixMatch = voices.find((v) => primarySubtag(v.lang) === wantPrimary);
  return prefixMatch ?? null;
}

/** 'en' prefix first, else the voice list's marked default, else the first voice. */
function findEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const enVoice = voices.find((v) => primarySubtag(v.lang) === 'en');
  if (enVoice) return enVoice;
  const defaultVoice = voices.find((v) => v.default);
  if (defaultVoice) return defaultVoice;
  return voices[0] ?? null;
}

/** Find a device voice for the app language. Match order:
 *  exact BCP-47 ('zu-ZA') -> language prefix ('zu') -> null.
 *  Synchronous — reads whatever `getVoices()` currently returns. SSR-safe, never throws. */
export function findVoice(appLang: string): SpeechSynthesisVoice | null {
  if (!isTtsSupported()) return null;
  try {
    return matchVoiceForLang(window.speechSynthesis.getVoices(), appLang);
  } catch {
    return null;
  }
}

/** Resolves `speechSynthesis.getVoices()`, waiting once for the async 'voiceschanged'
 *  event if the list is initially empty (voices load async on some Androids). Always
 *  resolves within VOICES_WAIT_TIMEOUT_MS — never rejects, never hangs. */
function getVoicesAsync(synth: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  const initial = synth.getVoices();
  if (initial.length > 0) return Promise.resolve(initial);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (voices: SpeechSynthesisVoice[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      synth.removeEventListener('voiceschanged', onChange);
      resolve(voices);
    };
    const onChange = () => finish(synth.getVoices());
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => finish(synth.getVoices()), VOICES_WAIT_TIMEOUT_MS);
    try {
      synth.addEventListener('voiceschanged', onChange);
    } catch {
      finish([]);
    }
  });
}

/** Speaks `text` with `voice`, resolving once the utterance ends (or errors). Never throws. */
function speakWith(synth: SpeechSynthesis, text: string, voice: SpeechSynthesisVoice): Promise<void> {
  return new Promise((resolve) => {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = UTTERANCE_RATE;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      synth.speak(utterance);
    } catch {
      resolve();
    }
  });
}

/**
 * Speak `text` (the app-language string) in the app language if a matching device voice
 * exists; otherwise speak `englishText` (the English source string) with an English voice.
 * NEVER reads non-English text with an English voice.
 *
 * - No support, or the user has muted Lima's voice -> 'unavailable' (silent no-op).
 * - Native voice found for `appLang` -> speaks `text` -> resolves 'spoken'.
 * - No native voice -> speaks `englishText` with an 'en' voice (or the device default) ->
 *   resolves 'fallback'.
 * - No voices at all (even after the async retry) -> resolves 'unavailable'.
 * - Cancels any in-flight utterance first (one voice at a time). Utterance rate 0.95.
 * - Always resolves; never throws, never rejects, never hangs (SSR-safe).
 */
export function speak(
  text: string,
  englishText: string,
  appLang: string
): Promise<'spoken' | 'fallback' | 'unavailable'> {
  if (!isTtsSupported() || getTtsMuted()) {
    return Promise.resolve('unavailable');
  }

  const synth = window.speechSynthesis;

  try {
    synth.cancel();
  } catch {
    // ignore
  }

  return getVoicesAsync(synth)
    .then((voices) => {
      if (!voices || voices.length === 0) {
        return 'unavailable' as const;
      }

      const nativeVoice = matchVoiceForLang(voices, appLang);
      if (nativeVoice) {
        return speakWith(synth, text, nativeVoice).then(() => 'spoken' as const);
      }

      const englishVoice = findEnglishVoice(voices);
      if (!englishVoice) {
        return 'unavailable' as const;
      }
      return speakWith(synth, englishText, englishVoice).then(() => 'fallback' as const);
    })
    .catch(() => 'unavailable' as const);
}

/** Stops any in-progress or queued speech. SSR-safe, never throws. */
export function stopSpeaking(): void {
  if (!isTtsSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
}

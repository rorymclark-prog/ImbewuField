'use client';

// Small "read aloud" button (Lima voice, progressive enhancement). Renders nothing
// unless the device supports speech AND the farmer hasn't muted it. Speaks `text` in
// the app language if a matching device voice exists, else falls back to the English
// source (`englishText`) in an English voice — never non-English text in an English
// voice. See lib/tts.ts for the honest SA-language-voice-coverage caveat.

import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { isTtsSupported, getTtsMuted, speak, stopSpeaking } from '@/lib/tts';
import { useLanguage } from '@/lib/i18n';

interface SpeakButtonProps {
  /** The string to read, already in the app language. */
  text: string;
  /** The English source of the same string (for the no-native-voice fallback).
   *  Defaults to `text` — correct for English-generated content. */
  englishText?: string;
  size?: number;
  /** Optional colour override; defaults to inherit. */
  color?: string;
}

export default function SpeakButton({ text, englishText, size = 16, color }: SpeakButtonProps) {
  const { lang, t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setMuted(getTtsMuted());
    const onChange = () => setMuted(getTtsMuted());
    window.addEventListener('imbewu-tts-changed', onChange);
    return () => window.removeEventListener('imbewu-tts-changed', onChange);
  }, []);

  // Hydration-safe + respects support/mute — nothing renders on the server or when off.
  if (!mounted || !isTtsSupported() || muted) return null;

  const Icon = speaking ? VolumeX : Volume2;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (speaking) { stopSpeaking(); setSpeaking(false); return; }
        setSpeaking(true);
        speak(text, englishText ?? text, lang).finally(() => setSpeaking(false));
      }}
      aria-label={t(speaking ? 'ttsStopLabel' : 'ttsSpeakLabel')}
      style={{
        minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 'none', cursor: 'pointer', color: color ?? 'inherit', opacity: 0.75,
        flexShrink: 0,
      }}
    >
      <Icon size={size} />
    </button>
  );
}

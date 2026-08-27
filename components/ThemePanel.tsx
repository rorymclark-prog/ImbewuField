'use client';

import { useEffect, useRef, useState } from 'react';
import { Satellite, Sprout, Mountain, Sparkles, Sun, Moon, Monitor, Check, X, Footprints, Volume2, type LucideIcon } from 'lucide-react';
import { useTheme, type ThemeName, type ThemeMode } from '@/lib/theme';
import { getGuidedState, setGuidedState, GUIDED_CHANGED_EVENT } from '@/lib/site-progress';
import { isTtsSupported, getTtsMuted, setTtsMuted } from '@/lib/tts';
import { APP_LANGS, useLanguage } from '@/lib/i18n';

// Small pill switch, matching the app's toggle style (used for the Guidance rows).
function PillToggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      style={{
        width: 46, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer', flexShrink: 0,
        background: on ? 'var(--emerald)' : 'var(--border)', position: 'relative',
        transition: 'background 0.15s ease', padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: '50%',
        background: '#fff', transition: 'left 0.15s ease', boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
      }} />
    </button>
  );
}

const THEMES: { key: ThemeName; label: string; desc: string; swatches: string[] }[] = [
  {
    key: 'earth',
    label: 'Earth',
    desc: 'Warm agricultural tones',
    swatches: ['#FDFAF6', '#EDE7DB', '#5CA030', '#9E5C08'],
  },
  {
    key: 'slate',
    label: 'Slate',
    desc: 'Clean modern professional',
    swatches: ['#F8FAFC', '#E8EDF5', '#199870', '#AA5C08'],
  },
];

const MODES: { key: ThemeMode; label: string; Icon: LucideIcon }[] = [
  { key: 'light', label: 'Light', Icon: Sun },
  { key: 'dark', label: 'Dark', Icon: Moon },
  { key: 'system', label: 'Auto', Icon: Monitor },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ThemePanel({ open, onClose }: Props) {
  const { theme, mode, textScale, setTheme, setMode, setTextScale } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const panelRef = useRef<HTMLDivElement>(null);

  // Guidance (Lima) settings — read client-side so SSR/first paint is stable.
  const [guidedOn, setGuidedOn] = useState(true);
  const [voiceOn, setVoiceOn] = useState(true);
  const [ttsSupported, setTtsSupported] = useState(false);
  useEffect(() => {
    const refresh = () => {
      setGuidedOn(getGuidedState().enabled);
      setTtsSupported(isTtsSupported());
      setVoiceOn(!getTtsMuted());
    };
    refresh();
    window.addEventListener(GUIDED_CHANGED_EVENT, refresh);
    window.addEventListener('imbewu-tts-changed', refresh);
    return () => {
      window.removeEventListener(GUIDED_CHANGED_EVENT, refresh);
      window.removeEventListener('imbewu-tts-changed', refresh);
    };
  }, [open]);

  const TEXT_SIZES: { label: string; value: number }[] = [
    { label: 'Normal', value: 1 },
    { label: 'Large', value: 1.15 },
    { label: 'Larger', value: 1.3 },
  ];

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    const tid = setTimeout(() => window.addEventListener('mousedown', handler), 0);
    return () => {
      clearTimeout(tid);
      window.removeEventListener('mousedown', handler);
    };
  }, [open, onClose]);

  return (
    <>
      {/* Scrim */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 49,
          background: 'rgba(0,0,0,0.25)',
          backdropFilter: 'blur(2px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.22s ease',
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Appearance settings"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(340px, 90vw)',
          zIndex: 50,
          background: 'var(--bg-1)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.2)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.26s cubic-bezier(0.32,0.72,0,1)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              Appearance
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Language, text size &amp; theme</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            style={{
              /* 44x44: the touch-target floor a fingertip needs. Was 28x28 — small enough to
                 mistap on the panel that exists to help someone with exactly that problem. */
              width: 44, height: 44, borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--bg-2)',
              color: 'var(--text-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* LANGUAGE — first, because a panel she cannot read is not a panel.
              This is the only working language control on a phone. The onboarding screen ends
              with "you can change this later" (pickLangSub), and until now that was not true:
              components/LangSwitcher.tsx is `hidden md:block`, so it does not exist below 768px,
              and the Language select on /account writes profile.language to Firestore — a field
              NOTHING reads back. She chose once, at the very moment she understood the app least,
              and was then locked in. The Account button that opens this panel is even labelled
              "Appearance & language", which had no language in it.
              Labels are each language's own name, so finding yours never depends on reading the
              one you are stuck in. */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              {t('pickLang')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {APP_LANGS.map((l) => {
                const active = l.code === lang;
                return (
                  <button
                    key={l.code}
                    onClick={() => setLang(l.code)}
                    aria-pressed={active}
                    style={{
                      minHeight: 46, padding: '10px 12px', borderRadius: 8,
                      border: active ? '1.5px solid var(--emerald)' : '1px solid var(--border)',
                      background: active ? 'var(--badge-bg)' : 'var(--bg-2)',
                      color: active ? 'var(--emerald)' : 'var(--text-secondary)',
                      fontSize: 14, fontWeight: active ? 700 : 500,
                      fontFamily: 'var(--font-display)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.native}</span>
                    {active && <Check size={15} style={{ flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text size section — first, since it's the accessibility lever */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              Text size
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {TEXT_SIZES.map((s) => {
                const active = Math.abs(textScale - s.value) < 0.01;
                return (
                  <button
                    key={s.label}
                    onClick={() => setTextScale(s.value)}
                    style={{
                      padding: '12px 8px', borderRadius: 8,
                      border: active ? '1.5px solid var(--emerald)' : '1px solid var(--border)',
                      background: active ? 'var(--badge-bg)' : 'var(--bg-2)',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: 12 + (s.value - 1) * 30, fontWeight: 700, color: active ? 'var(--emerald)' : 'var(--text-secondary)', lineHeight: 1 }}>A</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: active ? 'var(--emerald)' : 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5 }}>
              Makes the whole app bigger — text, buttons and menus.
            </div>
          </div>

          {/* Guidance (Lima) section */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              Guidance
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Guide me */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                <Footprints size={18} style={{ color: 'var(--emerald)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Guide me</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.4 }}>Show the next-step guide on your site report.</div>
                </div>
                <PillToggle
                  on={guidedOn}
                  label="Guide me"
                  onClick={() => {
                    if (guidedOn) setGuidedState({ enabled: false });
                    else setGuidedState({ enabled: true, retired: false, dismissals: 0 });
                  }}
                />
              </div>
              {/* Lima reads aloud — only when the device supports speech */}
              {ttsSupported && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                  <Volume2 size={18} style={{ color: 'var(--emerald)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Lima reads aloud</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.4 }}>Speak tips out loud when a voice is available.</div>
                  </div>
                  <PillToggle on={voiceOn} label="Lima reads aloud" onClick={() => setTtsMuted(voiceOn)} />
                </div>
              )}
            </div>
          </div>

          {/* Theme section */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              Colour theme
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {THEMES.map((t) => {
                const active = theme === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTheme(t.key)}
                    style={{
                      width: '100%', textAlign: 'left', cursor: 'pointer',
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: active ? '1.5px solid var(--emerald)' : '1px solid var(--border)',
                      background: active ? 'var(--badge-bg)' : 'var(--bg-2)',
                      transition: 'all 0.15s ease',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}
                  >
                    {/* Swatches */}
                    <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                      {t.swatches.map((c, i) => (
                        <div key={i} style={{
                          width: 14, height: 28, borderRadius: 4,
                          background: c,
                          border: '1px solid rgba(0,0,0,0.08)',
                        }} />
                      ))}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                        {t.label}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 1 }}>{t.desc}</div>
                    </div>
                    {active && (
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                        background: 'var(--emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff',
                      }}><Check size={11} strokeWidth={3} /></div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mode section */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              Display mode
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
            }}>
              {MODES.map((m) => {
                const active = mode === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => setMode(m.key)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: 8,
                      border: active ? '1.5px solid var(--emerald)' : '1px solid var(--border)',
                      background: active ? 'var(--badge-bg)' : 'var(--bg-2)',
                      cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <m.Icon size={20} style={{ color: active ? 'var(--emerald)' : 'var(--text-muted)' }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: active ? 'var(--emerald)' : 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>
                      {m.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5 }}>
              Auto follows your device setting.
            </div>
          </div>

          {/* Data sources */}
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              Data sources
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { Icon: Satellite, label: 'NASA 30yr climate' },
                { Icon: Sprout,    label: 'ISRIC soil data' },
                { Icon: Mountain,  label: 'Contours + 3D terrain' },
                { Icon: Sparkles,  label: 'Claude AI insights' },
              ].map((s) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                  <s.Icon size={15} style={{ color: 'var(--emerald)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', color: 'var(--text-secondary)', lineHeight: 1.2 }}>{s.label}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5 }}>
              South Africa · 9 biomes · all free APIs.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--emerald)', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            ImbewuField · saved automatically
          </span>
        </div>
      </div>
    </>
  );
}

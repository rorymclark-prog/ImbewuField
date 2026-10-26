'use client';

import { useEffect, useRef, useState } from 'react';
import AiFeatureSettings from './AiFeatureSettings';
import LanguageDraftNote from './LanguageDraftNote';
import { Sun, Moon, Monitor, Check, X, Footprints, Volume2, type LucideIcon } from 'lucide-react';
import { useTheme, type ThemeName, type ThemeMode } from '@/lib/theme';
import { getGuidedState, setGuidedState, GUIDED_CHANGED_EVENT } from '@/lib/site-progress';
import { isTtsSupported, getTtsMuted, setTtsMuted } from '@/lib/tts';
import { APP_LANGS, useLanguage, translate, loadLocale, T_en, getLoadedDict } from '@/lib/i18n';
import { setAppLevel, useAppLevel, type AppLevel } from '@/lib/app-level';
import { coverageOf, type LangCoverage } from '@/lib/lang-coverage';
import Link from 'next/link';

// Small pill switch, matching the app's toggle style (used for the Guidance rows).
function PillToggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      // 46x28 paint, 46x44 hit area (a11y-08): the switch keeps its size, the touch band grows.
      className="u-tap-target"
      style={{
        ['--tap-inset' as string]: '-8px 0',
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

const THEMES: { key: ThemeName; labelKey: string; descKey: string; swatches: string[] }[] = [
  {
    key: 'earth',
    labelKey: 'settingsThemeEarth',
    descKey: 'settingsThemeEarthDesc',
    swatches: ['#FDFAF6', '#EDE7DB', '#5CA030', '#9E5C08'],
  },
  {
    key: 'slate',
    labelKey: 'settingsThemeSlate',
    descKey: 'settingsThemeSlateDesc',
    swatches: ['#F8FAFC', '#E8EDF5', '#199870', '#AA5C08'],
  },
];

const MODES: { key: ThemeMode; labelKey: string; Icon: LucideIcon }[] = [
  { key: 'light', labelKey: 'settingsModeLight', Icon: Sun },
  { key: 'dark', labelKey: 'settingsModeDark', Icon: Moon },
  { key: 'system', labelKey: 'settingsModeAuto', Icon: Monitor },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ThemePanel({ open, onClose }: Props) {
  const { theme, mode, textScale, setTheme, setMode, setTextScale } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const panelRef = useRef<HTMLDivElement>(null);
  const level = useAppLevel();

  // How much of each language is actually translated, so a language that is still mostly
  // English says so instead of looking finished. Computed from the real dictionaries (see
  // lib/lang-coverage.ts) once every locale chunk has loaded — the same up-front prefetch
  // components/Onboarding.tsx already does for its own language-pick screen.
  const [langCoverage, setLangCoverage] = useState<Record<string, LangCoverage>>({});
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all(APP_LANGS.map((l) => loadLocale(l.code))).then(() => {
      if (cancelled) return;
      // English is the source dictionary itself, so it is complete by definition — coverageOf()
      // compares a locale's translated wording against English and would (correctly) read a
      // dictionary compared against itself as 0% translated, not 100%.
      const next: Record<string, LangCoverage> = {};
      for (const l of APP_LANGS) {
        if (l.code === 'en') continue;
        next[l.code] = coverageOf(T_en, getLoadedDict(l.code));
      }
      setLangCoverage(next);
    });
    return () => { cancelled = true; };
  }, [open]);
  const isPartialLang = (code: string) => code !== 'en' && langCoverage[code] !== undefined && !langCoverage[code].complete;
  const LEVELS: { key: AppLevel; label: string; desc: string }[] = [
    { key: 'simple', label: t('settingsSimple'), desc: t('settingsSimpleDesc') },
    { key: 'full', label: t('settingsAllTools'), desc: t('settingsAllToolsDesc') },
  ];

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

  const TEXT_SIZES: { labelKey: string; value: number }[] = [
    { labelKey: 'settingsTextNormal', value: 1 },
    { labelKey: 'settingsTextLarge', value: 1.15 },
    { labelKey: 'settingsTextLarger', value: 1.3 },
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
        aria-label={t('appearanceSettingsAriaLabel')}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(340px, 90vw)',
          zIndex: 50,
          background: 'var(--bg-1)',
          borderLeft: '1px solid var(--border)',
          boxShadow: open ? '-8px 0 32px rgba(0,0,0,0.2)' : 'none',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          /* Closed: hidden from layout and assistive tech once the slide-out has finished. */
          visibility: open ? 'visible' : 'hidden',
          transition: open
            ? 'transform 0.26s cubic-bezier(0.32,0.72,0,1), box-shadow 0.26s ease, visibility 0s'
            : 'transform 0.26s cubic-bezier(0.32,0.72,0,1), box-shadow 0.26s ease, visibility 0s linear 0.26s',
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
              {t('settingsButtonLabel')}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{t('settingsSubtitle')}</div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('settingsClose')}
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
                const partial = isPartialLang(l.code);
                return (
                  <div key={l.code} style={{ display: 'flex', flexDirection: 'column' }}>
                    <button
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
                    {partial && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.3 }}>
                        {translate(l.code, 'langPartialTag')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {lang === 'ts' && (
              <p role="note" style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted)' }}>
                <span lang="ts">{t('xitsongaUiDraftNotice')}</span>{' '}
                <span lang="en">/ Unreviewed Xitsonga draft.</span>
              </p>
            )}
            {lang !== 'ts' && <LanguageDraftNote lang={lang} scope="settings" />}
            {lang !== 'ts' && isPartialLang(lang) && (
              <p role="note" style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted)' }}>
                {translate(lang, 'langPartialActiveNote').replace('{lang}', APP_LANGS.find((l) => l.code === lang)?.native ?? lang)}
              </p>
            )}
          </div>

          {/* HOW MUCH TO SHOW — Simple / All tools (lib/app-level.ts). Straight after language: it is
              the other thing that decides whether the app is usable for someone new to phones.
              Farmers start on Simple; this is where they, or a mentor at training, change it. */}
          <div style={{ marginBottom: 28 }}>
            <div id="app-level-heading" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              {t('settingsShowAmount')}
            </div>
            <div role="radiogroup" aria-labelledby="app-level-heading" style={{ display: 'grid', gap: 8 }}>
              {LEVELS.map((l) => {
                const active = level === l.key;
                return (
                  <button
                    key={l.key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setAppLevel(l.key)}
                    style={{
                      minHeight: 64, padding: '12px 14px', borderRadius: 10, textAlign: 'left',
                      border: active ? '1.5px solid var(--emerald)' : '1px solid var(--border)',
                      background: active ? 'var(--badge-bg)' : 'var(--bg-2)',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%' }}>
                      <span style={{ fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-display)', color: active ? 'var(--emerald)' : 'var(--text-primary)' }}>{l.label}</span>
                      {active && <Check size={15} style={{ flexShrink: 0, color: 'var(--emerald)' }} />}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>{l.desc}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5 }}>
              {t('settingsChangeAnyTime')}
            </div>
          </div>

          {/* Text size section — first, since it's the accessibility lever */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              {t('settingsTextSize')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {TEXT_SIZES.map((s) => {
                const active = Math.abs(textScale - s.value) < 0.01;
                return (
                  <button
                    key={s.value}
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
                      {t(s.labelKey)}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5 }}>
              {t('settingsTextScaleHelp')}
            </div>
          </div>

          <AiFeatureSettings />
          {/* Guidance (Lima) section */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              {t('settingsGuidance')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Guide me */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                <Footprints size={18} style={{ color: 'var(--emerald)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{t('settingsGuideMe')}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.4 }}>{t('settingsGuideMeDesc')}</div>
                </div>
                <PillToggle
                  on={guidedOn}
                  label={t('settingsGuideMe')}
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
                    <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{t('settingsVoiceLabel')}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.4 }}>{t('settingsVoiceDesc')}</div>
                  </div>
                  <PillToggle on={voiceOn} label={t('settingsVoiceLabel')} onClick={() => setTtsMuted(voiceOn)} />
                </div>
              )}
            </div>
          </div>

          {/* Theme section */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              {t('settingsColourTheme')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {THEMES.map((choice) => {
                const active = theme === choice.key;
                return (
                  <button
                    key={choice.key}
                    onClick={() => setTheme(choice.key)}
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
                      {choice.swatches.map((c, i) => (
                        <div key={i} style={{
                          width: 14, height: 28, borderRadius: 4,
                          background: c,
                          border: '1px solid rgba(0,0,0,0.08)',
                        }} />
                      ))}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                        {t(choice.labelKey)}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 1 }}>{t(choice.descKey)}</div>
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
              {t('settingsDisplayMode')}
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
                      {t(m.labelKey)}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5 }}>
              {t('settingsModeAutoHelp')}
            </div>
          </div>

          {/* TOUR AND SUPPORT LINKS LIVE DOWN HERE. They used to open the panel, which pushed "How much
              to show" (Simple / All tools) below the fold on a phone — Rory went looking for the switch
              and could not find it. Settings now opens on the two choices that decide whether the app
              is usable at all: language, then how much to show. */}
          <section style={{ marginTop:8, marginBottom:28, display:'grid', gap:12, fontSize:16 }} aria-label={t('settingsTourSupport')}>
            <Link href="/tour" onClick={onClose}>{t('settingsTourSamples')}</Link>
            <Link href="/samples" onClick={onClose}>{t('settingsChooseWorkspace')}</Link>
            <Link href="/samples/gardens" onClick={onClose}>{t('settingsBrowseGardens')}</Link>
            <Link href="/feedback" onClick={onClose}>{t('settingsFeedback')}</Link>
          </section>

          {/* CLAUDE.md: no data-vendor badges in the UI — this used to name each data provider by
              brand. One unbranded line instead of a vendor list. */}
          <div style={{ marginTop: 28, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {t('settingsDataNote')}
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
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {t('settingsSavedAutomatically')}
          </span>
        </div>
      </div>
    </>
  );
}

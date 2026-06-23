'use client';

import { useEffect, useRef } from 'react';
import { Satellite, Sprout, Mountain, Sparkles, Sun, Moon, Monitor, type LucideIcon } from 'lucide-react';
import { useTheme, type ThemeName, type ThemeMode } from '@/lib/theme';

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
  const panelRef = useRef<HTMLDivElement>(null);

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
    setTimeout(() => window.addEventListener('mousedown', handler), 0);
    return () => window.removeEventListener('mousedown', handler);
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
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Text size, theme &amp; display</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            style={{
              width: 28, height: 28, borderRadius: 6,
              border: '1px solid var(--border)', background: 'var(--bg-2)',
              color: 'var(--text-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

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
                        color: '#fff', fontSize: 11,
                      }}>✓</div>
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

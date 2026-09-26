'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, Check, Utensils, TrendingUp, Recycle, ArrowRight } from 'lucide-react';
import { translate, useLanguage } from '@/lib/i18n';
import {
  activeAccountLocalStorageKey,
  removeSignedInLegacyLocalStorageKey,
} from '@/lib/account-local-storage';

const POPIA_KEY = 'imbewu_popia';
const ONBOARD_KEY = 'permamap_onboarded';
const ENGLISH_SOURCE_LANGS = new Set(['zu', 'st', 've']);

type Goal = 'feed' | 'income' | 'soil';

interface PopiaRecord {
  consent: true;
  shareNgo: boolean;
  goal: Goal;
  at: string;
}

type GoalDef = { v: Goal; labelKey: string; descKey: string; Icon: React.ElementType };
const GOAL_DEFS: GoalDef[] = [
  { v: 'feed',   labelKey: 'popiaGoalFeedLabel',   descKey: 'popiaGoalFeedDesc',   Icon: Utensils   },
  { v: 'income', labelKey: 'popiaGoalIncomeLabel', descKey: 'popiaGoalIncomeDesc', Icon: TrendingUp },
  { v: 'soil',   labelKey: 'popiaGoalSoilLabel',   descKey: 'popiaGoalSoilDesc',   Icon: Recycle    },
];

/** Pill toggle — 34 × 20 px, green when on, muted when off */
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        width: 34,
        height: 20,
        borderRadius: 100,
        padding: 2,
        border: 'none',
        background: on ? 'var(--emerald)' : 'var(--border-strong)',
        transition: 'background 0.18s',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          display: 'block',
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(32,25,15,0.20)',
          transform: on ? 'translateX(14px)' : 'translateX(0)',
          transition: 'transform 0.18s',
        }}
      />
    </button>
  );
}

export default function PopiaConsent() {
  const { t, lang } = useLanguage();
  const showEnglishSource = ENGLISH_SOURCE_LANGS.has(lang);
  const copy = (key: string) => <span>{t(key)}{showEnglishSource && <small className="block mt-1" style={{ fontSize: 11, fontWeight: 400, lineHeight: 1.4 }}><span className="font-semibold">English source:</span> {translate('en', key)}</small>}</span>;
  const copyString = (key: string) => showEnglishSource ? `${t(key)} · ${translate('en', key)}` : t(key);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [storeData, setStoreData] = useState(true);    // required — cannot proceed without
  const [shareNgo, setShareNgo] = useState(false);     // optional — privacy-preserving default: off until the farmer opts in
  const [goal, setGoal] = useState<Goal | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Only show after language onboarding is complete
    const languageDone = !!localStorage.getItem(activeAccountLocalStorageKey(ONBOARD_KEY));
    const popiaAlready = !!localStorage.getItem(activeAccountLocalStorageKey(POPIA_KEY));
    if (languageDone && !popiaAlready) {
      setReady(true);
    }
  }, []);

  // Poll until language onboarding completes (fires once language modal is dismissed)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (ready || done) return;
    const id = setInterval(() => {
      const languageDone = !!localStorage.getItem(activeAccountLocalStorageKey(ONBOARD_KEY));
      const popiaAlready = !!localStorage.getItem(activeAccountLocalStorageKey(POPIA_KEY));
      if (languageDone && !popiaAlready) {
        setReady(true);
        clearInterval(id);
      }
    }, 300);
    return () => clearInterval(id);
  }, [ready, done]);

  function handleComplete() {
    if (!goal) return;
    const record: PopiaRecord = {
      consent: true,
      shareNgo,
      goal,
      at: new Date().toISOString(),
    };
    try {
      localStorage.setItem(activeAccountLocalStorageKey(POPIA_KEY), JSON.stringify(record));
      removeSignedInLegacyLocalStorageKey(POPIA_KEY);
    } catch { /* ignore quota errors */ }
    setDone(true);
  }

  if (!ready || done) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      style={{ background: 'rgba(32,25,15,0.40)', backdropFilter: 'blur(6px)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="popia-dialog-heading"
        className="w-full max-w-sm rounded-2xl p-6 overflow-y-auto"
        style={{
          background: 'var(--bg-1)',
          border: '1px solid var(--border)',
          boxShadow: '0 4px 24px rgba(32,25,15,0.12)',
          maxHeight: 'calc(100dvh - 2rem)',
        }}
      >
        {lang === 'zu' && <p role="note" className="rounded-lg px-3 py-2 mb-4 font-sans" style={{ fontSize: 11.5, lineHeight: 1.4, background: 'color-mix(in srgb, var(--gold) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 25%, transparent)', color: 'var(--text-muted)' }}>{t('popiaZuluDraftNotice')}</p>}
        {(lang === 'st' || lang === 've') && <p role="note" className="rounded-lg px-3 py-2 mb-4 font-sans" style={{ fontSize: 11.5, lineHeight: 1.4, background: 'color-mix(in srgb, var(--gold) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 25%, transparent)', color: 'var(--text-muted)' }}>Translation status: unreviewed. Read the English source before choosing.</p>}
        {/* ── Step indicator ── */}
        <div className="flex gap-1.5 mb-6">
          {([1, 2] as const).map((s) => (
            <div
              key={s}
              className="flex-1 rounded-full"
              style={{ height: 3, background: s <= step ? 'var(--emerald)' : 'var(--border)' }}
            />
          ))}
        </div>

        {/* ══════════════════════════════════════ STEP 1 ══════════════════════════════════════ */}
        {step === 1 && (
          <>
            {/* Icon + heading */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="flex items-center justify-center rounded-xl flex-shrink-0"
                style={{ width: 44, height: 44, background: 'var(--color-forest-800)', boxShadow: '0 4px 12px color-mix(in srgb, var(--color-forest-800) 22%, transparent)' }}
              >
                <ShieldCheck size={22} stroke="var(--color-canvas)" strokeWidth={1.7} />
              </div>
              <h2
                id="popia-dialog-heading"
                className="font-display font-bold"
                style={{ fontSize: 20, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.15 }}
              >
                {copy('popiaTitle')}
              </h2>
            </div>

            {/* Body copy */}
            <p className="font-sans mb-5" style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {copy('popiaBody')}
            </p>

            {/* Toggle rows */}
            <div
              className="rounded-2xl overflow-hidden mb-5"
              style={{ border: '1px solid var(--border)' }}
            >
              {/* Required toggle */}
              <div
                className="flex items-center gap-3 px-4 py-3.5"
                style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold" style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                    {copy('popiaStoreLabel')}
                  </div>
                  <div className="font-sans mt-0.5" style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {copy('popiaStoreDesc')}
                  </div>
                </div>
                <Toggle on={storeData} onChange={setStoreData} label={copyString('popiaStoreLabel')} />
              </div>

              {/* Optional toggle */}
              <div className="flex items-center gap-3 px-4 py-3.5" style={{ background: 'var(--bg-1)' }}>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold" style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                    {copy('popiaShareLabel')}
                  </div>
                  <div className="font-sans mt-0.5" style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {copy('popiaShareDesc')}
                  </div>
                </div>
                <Toggle on={shareNgo} onChange={setShareNgo} label={copyString('popiaShareLabel')} />
              </div>
            </div>

            {/* Primary button */}
            <button
              type="button"
              onClick={() => storeData && setStep(2)}
              disabled={!storeData}
              className="w-full py-3 rounded-xl font-sans font-semibold transition-all"
              style={{
                fontSize: 15,
                background: storeData ? 'var(--color-forest-800)' : 'color-mix(in srgb, var(--border) 60%, transparent)',
                color: storeData ? 'var(--color-canvas)' : 'var(--text-muted)',
                border: 'none',
                cursor: storeData ? 'pointer' : 'not-allowed',
                boxShadow: storeData ? '0 4px 12px color-mix(in srgb, var(--color-forest-800) 18%, transparent)' : 'none',
              }}
            >
              <span className="flex items-center justify-center gap-1.5">
                {copy('popiaAgreeButton')}
                <ArrowRight size={15} />
              </span>
            </button>

            {!storeData && (
              <p className="font-sans text-center mt-2" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {copy('popiaStorageRequired')}
              </p>
            )}
          </>
        )}

        {/* ══════════════════════════════════════ STEP 2 ══════════════════════════════════════ */}
        {step === 2 && (
          <>
            {/* Heading */}
            <h2
              id="popia-dialog-heading"
              className="font-display font-bold mb-1"
              style={{ fontSize: 20, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}
            >
              {copy('popiaGoalTitle')}
            </h2>
            <p className="font-sans mb-5" style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {copy('popiaGoalBody')}
            </p>

            {/* Goal cards — same selection style as app/survey/page.tsx */}
            <div className="space-y-2.5 mb-5">
              {GOAL_DEFS.map(({ v, labelKey, descKey, Icon }) => {
                const on = goal === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setGoal(v)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all"
                    style={{
                      background: on ? 'var(--color-forest-800)' : 'var(--bg-1)',
                      border: `1px solid ${on ? 'var(--color-forest-800)' : 'var(--border)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    {/* Icon */}
                    <div
                      className="flex items-center justify-center rounded-xl flex-shrink-0"
                      style={{
                        width: 36,
                        height: 36,
                        background: on ? 'color-mix(in srgb, var(--color-canvas) 18%, transparent)' : 'color-mix(in srgb, var(--emerald) 8%, transparent)',
                      }}
                    >
                      <Icon size={18} stroke={on ? 'var(--color-canvas)' : 'var(--emerald)'} strokeWidth={1.7} />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div
                        className="font-display font-semibold"
                        style={{ fontSize: 14, color: on ? 'var(--color-canvas)' : 'var(--text-primary)', lineHeight: 1.2 }}
                      >
                        {copy(labelKey)}
                      </div>
                      <div
                        className="font-sans mt-0.5"
                        style={{ fontSize: 12, color: on ? 'color-mix(in srgb, var(--color-canvas) 70%, transparent)' : 'var(--text-muted)', lineHeight: 1.4 }}
                      >
                        {copy(descKey)}
                      </div>
                    </div>

                    {/* Check circle — matches survey/page.tsx */}
                    <div
                      className="flex items-center justify-center rounded-full flex-shrink-0"
                      style={{
                        width: 22,
                        height: 22,
                        background: on ? 'var(--color-canvas)' : 'transparent',
                        border: `1.5px solid ${on ? 'var(--color-canvas)' : 'var(--border-strong)'}`,
                      }}
                    >
                      {on && <Check size={13} style={{ color: 'var(--color-forest-800)' }} />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Primary button */}
            <button
              type="button"
              onClick={handleComplete}
              disabled={!goal}
              className="w-full py-3 rounded-xl font-sans font-semibold transition-all"
              style={{
                fontSize: 15,
                // White 15px type: the brand ochre measured 3.5:1 under it; #9A6018 is the ochre
                // fill CLAUDE.md sets aside for white text (5.2:1).
                background: goal ? '#9A6018' : 'color-mix(in srgb, var(--border) 60%, transparent)',
                color: goal ? '#fff' : 'var(--text-muted)',
                border: 'none',
                cursor: goal ? 'pointer' : 'not-allowed',
                boxShadow: goal ? '0 4px 12px rgba(192,122,30,0.22)' : 'none',
              }}
            >
              <span className="flex items-center justify-center gap-1.5">
                {copy('popiaGetStarted')}
                <ArrowRight size={15} />
              </span>
            </button>

            {!goal && (
              <p className="font-sans text-center mt-2" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {copy('popiaGoalPickOne')}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

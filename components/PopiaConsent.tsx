'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, Check, Utensils, TrendingUp, Recycle, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

const POPIA_KEY = 'imbewu_popia';
const ONBOARD_KEY = 'permamap_onboarded';

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
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        width: 34,
        height: 20,
        borderRadius: 100,
        padding: 2,
        border: 'none',
        background: on ? '#2E6B3A' : '#C9BBA1',
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
  const { t } = useLanguage();
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [storeData, setStoreData] = useState(true);    // required — cannot proceed without
  const [shareNgo, setShareNgo] = useState(true);      // optional
  const [goal, setGoal] = useState<Goal | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Only show after language onboarding is complete
    const languageDone = !!localStorage.getItem(ONBOARD_KEY);
    const popiaAlready = !!localStorage.getItem(POPIA_KEY);
    if (languageDone && !popiaAlready) {
      setReady(true);
    }
  }, []);

  // Poll until language onboarding completes (fires once language modal is dismissed)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (ready || done) return;
    const id = setInterval(() => {
      const languageDone = !!localStorage.getItem(ONBOARD_KEY);
      const popiaAlready = !!localStorage.getItem(POPIA_KEY);
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
      localStorage.setItem(POPIA_KEY, JSON.stringify(record));
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
        className="w-full max-w-sm rounded-2xl p-6"
        style={{
          background: '#FBF6EC',
          border: '1px solid #E2D8C4',
          boxShadow: '0 4px 24px rgba(32,25,15,0.12)',
        }}
      >
        {/* ── Step indicator ── */}
        <div className="flex gap-1.5 mb-6">
          {([1, 2] as const).map((s) => (
            <div
              key={s}
              className="flex-1 rounded-full"
              style={{ height: 3, background: s <= step ? '#1F4D2B' : 'rgba(32,25,15,0.12)' }}
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
                style={{ width: 44, height: 44, background: '#1F4D2B', boxShadow: '0 4px 12px rgba(31,77,43,0.22)' }}
              >
                <ShieldCheck size={22} stroke="#EAF3E2" strokeWidth={1.7} />
              </div>
              <h2
                className="font-display font-bold"
                style={{ fontSize: 20, color: '#20190F', letterSpacing: '-0.02em', lineHeight: 1.15 }}
              >
                {t('popiaTitle')}
              </h2>
            </div>

            {/* Body copy */}
            <p className="font-sans mb-5" style={{ fontSize: 14, color: '#5C5040', lineHeight: 1.6 }}>
              {t('popiaBody')}
            </p>

            {/* Toggle rows */}
            <div
              className="rounded-2xl overflow-hidden mb-5"
              style={{ border: '1px solid #E2D8C4' }}
            >
              {/* Required toggle */}
              <div
                className="flex items-center gap-3 px-4 py-3.5"
                style={{ background: '#FBF6EC', borderBottom: '1px solid #E2D8C4' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold" style={{ fontSize: 14, color: '#20190F', lineHeight: 1.2 }}>
                    {t('popiaStoreLabel')}
                  </div>
                  <div className="font-sans mt-0.5" style={{ fontSize: 12, color: '#8C7A62', lineHeight: 1.4 }}>
                    {t('popiaStoreDesc')}
                  </div>
                </div>
                <Toggle on={storeData} onChange={setStoreData} />
              </div>

              {/* Optional toggle */}
              <div className="flex items-center gap-3 px-4 py-3.5" style={{ background: '#FBF6EC' }}>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold" style={{ fontSize: 14, color: '#20190F', lineHeight: 1.2 }}>
                    {t('popiaShareLabel')}
                  </div>
                  <div className="font-sans mt-0.5" style={{ fontSize: 12, color: '#8C7A62', lineHeight: 1.4 }}>
                    {t('popiaShareDesc')}
                  </div>
                </div>
                <Toggle on={shareNgo} onChange={setShareNgo} />
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
                background: storeData ? '#1F4D2B' : 'rgba(226,216,196,0.6)',
                color: storeData ? '#F7F2E9' : '#8C7A62',
                border: 'none',
                cursor: storeData ? 'pointer' : 'not-allowed',
                boxShadow: storeData ? '0 4px 12px rgba(31,77,43,0.18)' : 'none',
              }}
            >
              <span className="flex items-center justify-center gap-1.5">
                {t('popiaAgreeButton')}
                <ArrowRight size={15} />
              </span>
            </button>

            {!storeData && (
              <p className="font-sans text-center mt-2" style={{ fontSize: 12, color: '#8C7A62' }}>
                {t('popiaStorageRequired')}
              </p>
            )}
          </>
        )}

        {/* ══════════════════════════════════════ STEP 2 ══════════════════════════════════════ */}
        {step === 2 && (
          <>
            {/* Heading */}
            <h2
              className="font-display font-bold mb-1"
              style={{ fontSize: 20, color: '#20190F', letterSpacing: '-0.02em', lineHeight: 1.2 }}
            >
              {t('popiaGoalTitle')}
            </h2>
            <p className="font-sans mb-5" style={{ fontSize: 13, color: '#8C7A62', lineHeight: 1.5 }}>
              {t('popiaGoalBody')}
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
                      background: on ? '#1F4D2B' : '#FBF6EC',
                      border: `1px solid ${on ? '#1F4D2B' : '#E2D8C4'}`,
                      cursor: 'pointer',
                    }}
                  >
                    {/* Icon */}
                    <div
                      className="flex items-center justify-center rounded-xl flex-shrink-0"
                      style={{
                        width: 36,
                        height: 36,
                        background: on ? 'rgba(234,243,226,0.18)' : 'rgba(31,77,43,0.08)',
                      }}
                    >
                      <Icon size={18} stroke={on ? '#EAF3E2' : '#1F4D2B'} strokeWidth={1.7} />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div
                        className="font-display font-semibold"
                        style={{ fontSize: 14, color: on ? '#EAF3E2' : '#20190F', lineHeight: 1.2 }}
                      >
                        {t(labelKey)}
                      </div>
                      <div
                        className="font-sans mt-0.5"
                        style={{ fontSize: 12, color: on ? 'rgba(234,243,226,0.70)' : '#8C7A62', lineHeight: 1.4 }}
                      >
                        {t(descKey)}
                      </div>
                    </div>

                    {/* Check circle — matches survey/page.tsx */}
                    <div
                      className="flex items-center justify-center rounded-full flex-shrink-0"
                      style={{
                        width: 22,
                        height: 22,
                        background: on ? '#EAF3E2' : 'transparent',
                        border: `1.5px solid ${on ? '#EAF3E2' : '#C9BBA1'}`,
                      }}
                    >
                      {on && <Check size={13} style={{ color: '#1F4D2B' }} />}
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
                background: goal ? '#C07A1E' : 'rgba(226,216,196,0.6)',
                color: goal ? '#fff' : '#8C7A62',
                border: 'none',
                cursor: goal ? 'pointer' : 'not-allowed',
                boxShadow: goal ? '0 4px 12px rgba(192,122,30,0.22)' : 'none',
              }}
            >
              <span className="flex items-center justify-center gap-1.5">
                {t('popiaGetStarted')}
                <ArrowRight size={15} />
              </span>
            </button>

            {!goal && (
              <p className="font-sans text-center mt-2" style={{ fontSize: 12, color: '#8C7A62' }}>
                Pick one to continue
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

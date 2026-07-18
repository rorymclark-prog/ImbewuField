'use client';

// Design Studio — the step-by-step guide bubble (Rory: "1st add jojo tanks, great, now add tap
// points… in a little Lima bubble" + "a step-by-step guide through everything so nothing is
// missed"). Walks the ordered micro-tasks for the current step, arms the right tool on "Do
// this", ticks each off as the canvas fills in, and links to the full "Why this matters" lesson.

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, ChevronUp, MapPin, Compass, HelpCircle, PartyPopper, ArrowRight, Sprout } from 'lucide-react';
import type { DesignCanvasState, WizardStep } from '@/lib/design-canvas';
import { subStepsForStep, type SubStep, type SubStepArm, type SubStepCtx } from '@/lib/design-substeps';
import { BED_DEF_IDS } from '@/lib/design-beds-bridge';
import { DESIGN_STEP_LESSONS } from '@/lib/design-lessons';
import { STEP_LABELS, STEP_ORDER, LessonPanel } from './DesignWizard';
import SpeakButton from '@/components/SpeakButton';
import TankCalculator from './TankCalculator';
import SectorSummary from './SectorSummary';
import type { DesignMode } from './DesignPalette';

const GOLD = '#F7C97E';
const GREEN = '#1F4D2B';
const OCHRE = '#C07A1E';
const PAPER = '#FFFEFA';
const DARK = '#20190F';

// Per-layer accent so the guide bar visibly says WHICH layer you're on — the owner's note that
// the current layer "doesn't stand out". Each step wears its layer's colour as a bold badge.
const STEP_ACCENT: Record<WizardStep, string> = {
  base: '#6B6355',
  sector: '#C07A1E', // sun gold/ochre — the "read the land's energies" step
  water: '#3E8FBF',
  zones: '#C07A1E',
  planting: '#2F7A4A',
  structures: '#7A5C3E',
  review: '#1F4D2B',
  glossy: '#C07A1E',
};

const COLLAPSE_KEY = 'imbewu_stepguide_collapsed_v1';
const skipsKey = (siteId: string) => `imbewu_stepguide_skips_${siteId}`;

function loadSkips(siteId: string): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(skipsKey(siteId)) ?? '{}') as Record<string, string[]>;
  } catch {
    return {};
  }
}

export interface StepGuideProps {
  step: WizardStep;
  state: DesignCanvasState;
  ctx: SubStepCtx;
  mode: DesignMode;
  onArm: (arm: SubStepArm) => void;
  onNextStep: () => void;
  // Simple Path handoff — link to the crop planner (shown on the Planting step once beds
  // exist), so a "just beds & trees" farmer can jump straight to planning what to grow.
  planCropsHref?: string;
}

export default function StepGuide({ step, state, ctx, onArm, onNextStep, planCropsHref }: StepGuideProps) {
  const subSteps = useMemo(() => subStepsForStep(step), [step]);

  // Collapsed by default — the one-line form still shows the current task, so guidance stays
  // visible while the map keeps its space. Farmers expand for the full checklist; pref persists.
  const [collapsed, setCollapsed] = useState(true);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY);
      if (raw === 'true' || raw === 'false') setCollapsed(raw === 'true');
    } catch {
      /* no-op */
    }
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        /* no-op */
      }
      return next;
    });
  };

  // Skipped micro-tasks (per site + step) — a skipped task stays visible as "not done" so
  // nothing is silently missed; it just stops being the highlighted "current" one.
  const [skips, setSkips] = useState<string[]>([]);
  useEffect(() => {
    setSkips(loadSkips(state.siteId)[step] ?? []);
  }, [state.siteId, step]);
  const skip = (id: string) => {
    setSkips((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id];
      try {
        const all = loadSkips(state.siteId);
        all[step] = next;
        localStorage.setItem(skipsKey(state.siteId), JSON.stringify(all));
      } catch {
        /* no-op */
      }
      return next;
    });
  };

  const doneFlags = useMemo(() => subSteps.map((ss) => ss.done(state, ctx)), [subSteps, state, ctx]);
  const doneCount = doneFlags.filter(Boolean).length;
  const currentIndex = subSteps.findIndex((ss, i) => !doneFlags[i] && !skips.includes(ss.id));
  const allResolved = currentIndex === -1;
  const [lessonOpen, setLessonOpen] = useState(false);
  useEffect(() => setLessonOpen(false), [step]);

  // Little "nice, ticked off!" flash when the done-count climbs.
  const prevDone = useRef(doneCount);
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    if (doneCount > prevDone.current) {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 2200);
      prevDone.current = doneCount;
      return () => clearTimeout(t);
    }
    prevDone.current = doneCount;
  }, [doneCount]);

  const lesson = step === 'glossy' || step === 'review' ? undefined : DESIGN_STEP_LESSONS[step];
  if (subSteps.length === 0) return null;

  const stepLabel = STEP_LABELS[step];
  const accent = STEP_ACCENT[step];
  const idx = STEP_ORDER.indexOf(step);
  const nextLabel = idx >= 0 && idx < STEP_ORDER.length - 1 ? STEP_LABELS[STEP_ORDER[idx + 1]] : null;
  const current: SubStep | null = allResolved ? null : subSteps[currentIndex];
  const hasBeds = state.items.some((it) => (BED_DEF_IDS as readonly string[]).includes(it.defId));
  const showPlanCrops = step === 'planting' && hasBeds && !!planCropsHref;

  // ── Collapsed: one slim line ────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div style={{ padding: '6px 12px 0' }}>
        <button
          type="button"
          onClick={toggleCollapsed}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minHeight: 44,
            padding: '5px 10px 5px 5px',
            borderRadius: 12,
            border: `1.5px solid ${accent}`,
            background: PAPER,
            color: DARK,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          {/* Bold, colour-coded LAYER badge so it's obvious which layer you're on */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              flexShrink: 0,
              background: accent,
              color: PAPER,
              fontWeight: 900,
              fontSize: 12,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              padding: '6px 10px',
              borderRadius: 9,
            }}
          >
            <Compass size={14} />
            {stepLabel}
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: accent, flexShrink: 0 }}>
            {doneCount}/{subSteps.length}
          </span>
          <span style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {allResolved ? 'All done — open to review' : current?.title}
          </span>
          <ChevronDown size={16} color={accent} style={{ flexShrink: 0 }} />
        </button>
      </div>
    );
  }

  // ── Expanded: the walked checklist ──────────────────────────────────────────
  const narration = current ? `${current.title}. ${current.instruction} ${current.where}` : '';

  return (
    <div style={{ padding: '6px 12px 0' }}>
      <div
        style={{
          borderRadius: 14,
          border: `1.5px solid ${accent}`,
          background: PAPER,
          boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}
      >
        {/* Header — accent-coloured band naming the current layer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: accent }}>
          <Compass size={17} color={PAPER} style={{ flexShrink: 0 }} />
          <span style={{ fontWeight: 900, fontSize: 13.5, color: PAPER, letterSpacing: 0.3, textTransform: 'uppercase' }}>{stepLabel}</span>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: PAPER, opacity: 0.85 }}>step-by-step</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800, color: PAPER }}>
            {doneCount}/{subSteps.length}
          </span>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Minimise guide"
            style={{ display: 'inline-flex', border: 'none', background: 'transparent', color: PAPER, cursor: 'pointer', padding: 4 }}
          >
            <ChevronUp size={17} />
          </button>
        </div>

        {celebrate && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(31,77,43,0.10)', color: GREEN, fontWeight: 700, fontSize: 12.5 }}>
            <PartyPopper size={14} /> Nice — ticked off. Here’s the next one.
          </div>
        )}

        {/* Checklist */}
        <div style={{ padding: '6px 6px 10px' }}>
          {subSteps.map((ss, i) => {
            const done = doneFlags[i];
            const isCurrent = i === currentIndex;
            const skipped = skips.includes(ss.id) && !done;
            return (
              <div key={ss.id} style={{ padding: '4px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ flexShrink: 0, marginTop: 1 }}>
                    {done ? (
                      <span style={{ display: 'inline-flex', width: 18, height: 18, borderRadius: 9, background: GREEN, alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={12} color={PAPER} strokeWidth={3} />
                      </span>
                    ) : isCurrent ? (
                      <span style={{ display: 'inline-flex', width: 18, height: 18, borderRadius: 9, border: `2px solid ${OCHRE}`, background: GOLD }} />
                    ) : (
                      <span style={{ display: 'inline-flex', width: 18, height: 18, borderRadius: 9, border: '2px solid rgba(11,18,11,0.22)' }} />
                    )}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: isCurrent ? 800 : 600, color: done ? 'rgba(11,18,11,0.45)' : DARK, textDecoration: done ? 'line-through' : 'none' }}>
                      {ss.title}
                      {ss.optional && !done && (
                        <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: OCHRE, textTransform: 'uppercase', letterSpacing: 0.3 }}>optional</span>
                      )}
                      {skipped && (
                        <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'rgba(11,18,11,0.4)', textTransform: 'uppercase', letterSpacing: 0.3 }}>skipped</span>
                      )}
                    </div>

                    {isCurrent && (
                      <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ fontSize: 12.5, lineHeight: 1.45, color: DARK }}>{ss.instruction}</div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <MapPin size={13} color={OCHRE} style={{ flexShrink: 0, marginTop: 2 }} />
                          <div style={{ fontSize: 12, lineHeight: 1.4, color: 'rgba(11,18,11,0.75)' }}>{ss.where}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {ss.arm && (
                            <button
                              type="button"
                              onClick={() => onArm(ss.arm)}
                              style={{ minHeight: 40, padding: '8px 16px', borderRadius: 10, border: 'none', background: GREEN, color: PAPER, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                            >
                              Do this
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => skip(ss.id)}
                            style={{ minHeight: 40, padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(11,18,11,0.18)', background: 'transparent', color: GREEN, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
                          >
                            {ss.optional ? 'Skip' : 'Later'}
                          </button>
                          <SpeakButton text={narration} englishText={narration} size={16} color={GREEN} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rain-tank sizing — WATER step only. Sits below the checklist; reads the site's real
            rainfall to size JoJo storage from the roof area and daily use the farmer types in. */}
        {step === 'water' && <TankCalculator />}

        {/* Sector energies — SECTOR step only. The plain-words reveal of the sun/wind/fire/water
            the app already drew on the canvas; "Looks right →" advances to Water. Nothing to draw. */}
        {step === 'sector' && <SectorSummary onLooksRight={onNextStep} />}

        {/* Simple-Path handoff — beds are down, so offer "plan my crops" straight away. */}
        {showPlanCrops && (
          <div style={{ padding: '2px 12px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Link
              href={planCropsHref!}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 42, padding: '8px 16px', borderRadius: 10, background: OCHRE, color: PAPER, fontWeight: 800, fontSize: 13, textDecoration: 'none' }}
            >
              <Sprout size={16} /> Plan my crops <ArrowRight size={15} />
            </Link>
            <div style={{ fontSize: 11, color: 'rgba(11,18,11,0.6)' }}>
              Just beds & trees? Jump straight to planning what to grow — you can always come back.
            </div>
          </div>
        )}

        {/* All-resolved banner → advance to next step */}
        {allResolved && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderTop: '1px solid rgba(11,18,11,0.08)', background: 'rgba(31,77,43,0.06)' }}>
            <Check size={16} color={GREEN} />
            <span style={{ fontSize: 12.5, color: DARK, flex: 1 }}>
              You’ve worked through the {stepLabel.toLowerCase()} checklist.
            </span>
            {nextLabel && (
              <button
                type="button"
                onClick={onNextStep}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 38, padding: '6px 14px', borderRadius: 10, border: 'none', background: GREEN, color: PAPER, fontWeight: 800, fontSize: 12.5, cursor: 'pointer' }}
              >
                Next: {nextLabel} <ArrowRight size={15} />
              </button>
            )}
          </div>
        )}

        {/* Why this matters → the full step lesson (connects the walk-through to the course) */}
        {lesson && (
          <div style={{ borderTop: '1px solid rgba(11,18,11,0.08)', padding: '4px 12px 10px' }}>
            <button
              type="button"
              onClick={() => setLessonOpen((v) => !v)}
              aria-expanded={lessonOpen}
              style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 40, border: 'none', background: 'transparent', color: GREEN, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: '0 2px' }}
            >
              <HelpCircle size={15} /> Why this matters {lessonOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            {lessonOpen && <LessonPanel lesson={lesson} />}
          </div>
        )}
      </div>
    </div>
  );
}

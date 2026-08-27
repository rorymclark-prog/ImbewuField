'use client';

// The single persistent "next step" card — Lima's guided-mode coach.
// Shows the ONE thing worth doing next on a saved site (walk the boundary,
// fill the survey, open the Design Studio, plan crops), or a one-time
// celebration once all five completion-score steps are done. See
// docs/ONBOARDING-PHASE-BC-SPEC.md §B9 for the full spec this implements.
//
// Source of truth for "how far along is this site" is the `inputs` prop —
// DataPanel (or whoever mounts this) already gathered it via
// lib/site-progress.ts#gatherSiteInputs. This component never re-gathers;
// it only runs computeCompletionScore() on what it's handed, so there is
// exactly one place per render that reads localStorage for progress.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Footprints,
  X,
  Utensils,
  TrendingUp,
  Recycle,
  Compass,
  ClipboardList,
  Palette,
  Wheat,
  PartyPopper,
  type LucideIcon,
} from 'lucide-react';
import { useLanguage, translate } from '@/lib/i18n';
import SpeakButton from './SpeakButton';
import {
  getGuidedState,
  recordCoachDismissal,
  setGuidedState,
  GUIDED_CHANGED_EVENT,
  STEP_COPY,
  type GuidedModeState,
} from '@/lib/site-progress';
import {
  computeCompletionScore,
  type CompletionScoreInputs,
  type CompletionStepKey,
} from '@/lib/completion-score';
import { activeAccountLocalStorageKey } from '@/lib/account-local-storage';

const POPIA_KEY = 'imbewu_popia';

type Goal = 'feed' | 'income' | 'soil';
type CoachStepKey = Exclude<CompletionStepKey, 'located'>;

const GOAL_ICON: Record<Goal, LucideIcon> = {
  feed: Utensils,
  income: TrendingUp,
  soil: Recycle,
};
const GOAL_COPY_KEY: Record<Goal, string> = {
  feed: 'coachGoalFeed',
  income: 'coachGoalIncome',
  soil: 'coachGoalSoil',
};
/** Goal line only applies once the farmer is past tracing — matches the spec table. */
const GOAL_STEPS: ReadonlySet<CoachStepKey> = new Set(['survey', 'design', 'cropPlan']);

const STEP_CTA_ICON: Record<CoachStepKey, LucideIcon> = {
  boundary: Compass,
  survey: ClipboardList,
  design: Palette,
  cropPlan: Wheat,
};

const GUIDED_DEFAULT: GuidedModeState = { enabled: true, dismissals: 0, retired: false };

/** Read the POPIA goal defensively — absent, corrupt, or pre-goal-picker → no goal line. */
function readPopiaGoal(): Goal | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(activeAccountLocalStorageKey(POPIA_KEY));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const g = parsed?.goal;
    return g === 'feed' || g === 'income' || g === 'soil' ? g : null;
  } catch {
    return null;
  }
}

export interface NextStepCoachProps {
  /** The already-gathered inputs the caller owns — this component does NOT re-gather. */
  inputs: CompletionScoreInputs;
  coords: { lat: number; lon: number };
  /** Opens the site-survey sheet (DataPanel passes () => setSurveySheetOpen(true)). */
  onOpenSurvey: () => void;
  /** 'card' = full card (default, DataPanel mount). 'line' = compact mirror for home. */
  variant?: 'card' | 'line';
}

export default function NextStepCoach({ inputs, coords, onOpenSurvey, variant = 'card' }: NextStepCoachProps) {
  const { t } = useLanguage();
  const router = useRouter();

  // Hydration-safe: nothing localStorage-derived is read until after mount, and
  // this returns null until then so server/first-paint markup never diverges.
  const [mounted, setMounted] = useState(false);
  const [guided, setGuided] = useState<GuidedModeState>(GUIDED_DEFAULT);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [hiddenThisSession, setHiddenThisSession] = useState(false);

  useEffect(() => {
    setMounted(true);
    setGuided(getGuidedState());
    setGoal(readPopiaGoal());
  }, []);

  // Live-refresh when the Settings "Guide me" toggle changes guided state elsewhere.
  useEffect(() => {
    const refresh = () => setGuided(getGuidedState());
    window.addEventListener(GUIDED_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(GUIDED_CHANGED_EVENT, refresh);
  }, []);

  if (!mounted) return null;
  if (!guided.enabled || guided.retired) return null;
  // Scout stage (no saved site yet) is handled by the Save-this-site hero — never duplicate it.
  if (!inputs.hasSite) return null;
  if (hiddenThisSession) return null;

  const score = computeCompletionScore(inputs);
  const firstIncomplete = score.steps.find((s) => !s.done);
  const nextStep: CoachStepKey | null =
    firstIncomplete && firstIncomplete.key !== 'located' ? firstIncomplete.key : null;

  function runStepAction(step: CoachStepKey) {
    switch (step) {
      case 'boundary':
        window.dispatchEvent(new CustomEvent('imbewu-arm-draw', { detail: 'site' }));
        return;
      case 'survey':
        onOpenSurvey();
        return;
      case 'design':
        router.push(`/design?lat=${coords.lat.toFixed(5)}&lon=${coords.lon.toFixed(5)}`);
        return;
      case 'cropPlan':
        router.push('/facilitator/crops');
        return;
    }
  }

  function handleDismiss() {
    recordCoachDismissal();
    setHiddenThisSession(true);
  }

  const title = nextStep ? t(STEP_COPY[nextStep].titleKey) : t('coachDoneTitle');
  const body = nextStep ? t(STEP_COPY[nextStep].bodyKey) : t('coachDoneBody');
  const ctaLabel = nextStep ? t(STEP_COPY[nextStep].ctaKey) : t('coachDoneCta');
  const CtaIcon: LucideIcon = nextStep ? STEP_CTA_ICON[nextStep] : PartyPopper;
  const handleCta = nextStep
    ? () => runStepAction(nextStep)
    : () => setGuidedState({ retired: true }); // celebrate CTA = auto-graduation

  const showGoal = variant === 'card' && !!goal && !!nextStep && GOAL_STEPS.has(nextStep);
  const GoalIcon = goal ? GOAL_ICON[goal] : null;

  // English source of the read-aloud line, so the TTS fallback speaks English (not the
  // translated text) when no native voice exists — see components/SpeakButton.tsx.
  const enTitle = nextStep ? translate('en', STEP_COPY[nextStep].titleKey) : translate('en', 'coachDoneTitle');
  const enBody = nextStep ? translate('en', STEP_COPY[nextStep].bodyKey) : translate('en', 'coachDoneBody');

  if (variant === 'line') {
    return (
      <div className="flex items-center gap-2">
        <span
          className="font-sans font-bold uppercase flex-shrink-0"
          style={{ fontSize: 12, color: '#C07A1E', letterSpacing: '0.05em' }}
        >
          {t('coachOverline')}
        </span>
        <span
          className="font-display font-semibold truncate flex-1 min-w-0"
          style={{ fontSize: 14, color: '#20190F' }}
        >
          {title}
        </span>
        <button
          type="button"
          onClick={handleCta}
          className="flex items-center gap-1 font-sans font-semibold flex-shrink-0 rounded-full"
          style={{ fontSize: 13, color: '#1F4D2B', minHeight: 44, padding: '0 8px', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <CtaIcon size={15} strokeWidth={1.8} aria-hidden />
          {ctaLabel}
        </button>
      </div>
    );
  }

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', borderRadius: 16 }}
    >
      <div className="absolute left-0 top-0 bottom-0" style={{ width: 3, background: '#C07A1E' }} aria-hidden />
      <div className="pl-4 pr-3 py-3.5">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div
            className="flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ width: 32, height: 32, background: '#1F4D2B' }}
          >
            <Footprints size={16} style={{ color: '#F7C97E' }} strokeWidth={1.8} aria-hidden />
          </div>
          <span
            className="font-sans font-bold uppercase flex-1 min-w-0"
            style={{ fontSize: 12, color: '#C07A1E', letterSpacing: '0.06em' }}
          >
            {t('coachOverline')}
          </span>
          <SpeakButton text={`${title}. ${body}`} englishText={`${enTitle}. ${enBody}`} color="#8C7A62" />
          <button
            type="button"
            onClick={handleDismiss}
            aria-label={t('coachDismiss')}
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{ width: 44, height: 44, margin: '-8px -8px -8px 0', color: '#8C7A62', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <X size={17} strokeWidth={1.8} aria-hidden />
          </button>
        </div>

        <h4
          className="font-display font-semibold"
          style={{ fontSize: 16, color: '#20190F', lineHeight: 1.25, margin: '0 0 4px' }}
        >
          {title}
        </h4>
        <p
          className="font-sans"
          style={{
            fontSize: 13,
            color: '#5C5040',
            lineHeight: 1.45,
            margin: 0,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {body}
        </p>

        {showGoal && GoalIcon && (
          <div className="flex items-start gap-1.5 mt-2">
            <GoalIcon size={14} strokeWidth={1.8} style={{ color: '#8C7A62', marginTop: 1, flexShrink: 0 }} aria-hidden />
            <span className="font-sans" style={{ fontSize: 12, color: '#8C7A62', lineHeight: 1.4 }}>
              {t(GOAL_COPY_KEY[goal as Goal])}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={handleCta}
          className="w-full flex items-center justify-center gap-2 font-sans font-semibold"
          style={{
            marginTop: 12,
            minHeight: 44,
            borderRadius: 12,
            background: '#1F4D2B',
            color: '#F7F2E9',
            fontSize: 15,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <CtaIcon size={16} strokeWidth={1.8} aria-hidden />
          {ctaLabel}
        </button>
      </div>
    </section>
  );
}

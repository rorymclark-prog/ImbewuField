// The single next action for a farmer's MAIN site, deep-linked — shared by both Home layouts.
//
// All tools shows it as its own card under the green site card (FarmPlanCard in
// app/home/page.tsx); Simple puts it inside the site card (components/home/HomeHeroCard.tsx).
// One table, so the two layouts can never send a farmer to different places for the same step,
// and both read lib/site-progress.ts like DataPanel and the NextStepCoach do, so this can never
// drift into a second scoring path.

import { STEP_COPY, type Coords } from '@/lib/site-progress';
import type { CompletionStepKey } from '@/lib/completion-score';

const localUi = (lang: string, english: string, zulu: string) => lang === 'zu' ? zulu : english;

interface StepAction { label: string; href: (coords: Coords | null, siteId?: string) => string }
export const STEP_ACTIONS: Record<CompletionStepKey, StepAction> = {
  located: { label: 'Tap your land on the map', href: () => '/farmer' },
  // Land on THIS site, reticle already armed to trace — the same imbewu-arm-draw handoff
  // the "+Add → Boundary" row fires on the map itself (components/Map.tsx), reached here
  // via the farmer page's ?arm= one-shot deep link (app/farmer/page.tsx). Used to be a bare
  // '/farmer': tapping "Trace your boundary" dropped the farmer on the default map with no
  // site loaded and nothing armed, so the coaching told them to do a thing this link never
  // actually started — same fix the NextStepCoach in-panel card already gets for free by
  // dispatching the event directly (it's already sitting on the right site).
  boundary: {
    label: 'Trace your boundary',
    href: (_c, siteId) => (siteId ? `/farmer?site=${siteId}&arm=site` : '/farmer?arm=site'),
  },
  // The real survey sheet that feeds this score lives inside DataPanel; /farmer?openSurvey=1
  // loads the main site and auto-opens it (the older /survey wizard used a different store
  // and never moved this score).
  survey: { label: 'Do the site survey', href: () => '/farmer?openSurvey=1' },
  design: {
    label: 'Design your farm',
    href: (c) => (c ? `/design?lat=${c.lat.toFixed(5)}&lon=${c.lon.toFixed(5)}` : '/design'),
  },
  cropPlan: { label: 'Plan your crops', href: () => '/facilitator/crops' },
};

const STEP_LABEL_ZU: Record<CompletionStepKey, string> = {
  located: 'Thepha indawo yakho emephini',
  boundary: 'Dweba umngcele wakho',
  survey: 'Gcwalisa inhlolovo yendawo',
  design: 'Dizayina ipulazi lakho',
  cropPlan: 'Hlela izitshalo zakho',
};

export interface NextAction { href: string; overline: string; label: string }

export function nextAction(
  nextStep: CompletionStepKey | null,
  coords: Coords | null,
  siteId: string | undefined,
  t: (key: string) => string,
  lang: string,
): NextAction {
  const designHref = coords ? `/design?lat=${coords.lat.toFixed(5)}&lon=${coords.lon.toFixed(5)}` : '/design';
  const href = nextStep ? STEP_ACTIONS[nextStep].href(coords, siteId) : designHref;
  const nextStepCopy = nextStep && nextStep !== 'located' ? STEP_COPY[nextStep] : null;
  const label = nextStepCopy
    ? t(nextStepCopy.titleKey)
    : nextStep
      ? localUi(lang, STEP_ACTIONS[nextStep].label, STEP_LABEL_ZU[nextStep])
      : localUi(lang, 'Plan complete — print your plan set', 'Uhlelo luphelele — phrinta uhlelo lwakho');
  const overline = nextStep ? t('coachOverline') : localUi(lang, 'Your farm plan', 'Uhlelo lwepulazi lakho');
  return { href, overline, label };
}

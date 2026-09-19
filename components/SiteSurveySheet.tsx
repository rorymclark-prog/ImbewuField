'use client';
import { useState, useCallback, useEffect, useRef, useId } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Users, Droplets, Home, Leaf, AlertTriangle, FileText, Sparkles, Sprout, NotebookPen, ArrowRight, MapPin, CircleCheck, Circle, Pencil, Info, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { useAppConfirm } from '@/components/AppConfirm';
import {
  saveSurvey,
  loadSurvey,
  reportedFoodGroups,
  toggleSurveyChoice,
  productionNeedsReview,
  type HddsFoodGroup,
  type ProductionCategory,
  type ReportedProduction,
  type SiteSurvey,
} from '@/lib/site-survey';
import { loadPlaces } from '@/lib/saved-places';
import { designSiteIdFromLocation, computeTracedAreaTotals } from '@/lib/design-studio';
import { loadCanvasState } from '@/lib/design-canvas';
import { studioRoofAreasM2, surveyRoofAreaM2 } from '@/lib/studio-traced-areas';
import Illustration from '@/components/Illustration';
import styles from './SiteSurveySheet.module.css';
import SiteSurveyReview from './SiteSurveyReview';
import type { LocationData } from '@/lib/types';

interface Props {
  placeId: string;
  /** The current pin's coords — when provided, the survey is keyed by these (matching the
   *  completion score / design / crop stores) instead of the place lookup, so a survey
   *  filled on a freshly-saved pin lands under the same key it's read back from. */
  coords?: { lat: number; lon: number } | null;
  annualRainfallMm?: number;
  onSaved: (survey: SiteSurvey) => void;
  onClose: () => void;
}

// Step tab labels. 'Challenges' reuses the already-fully-translated `stepChallenges` key from
// the report-generation section of lib/i18n.tsx; the other six describe a step grouping unique
// to this questionnaire and have no existing equivalent, so they are genuinely new (English-only
// per this app's convention — t() falls back to English until a first-language reviewer supplies
// the other ten locales).
function surveySteps(t: (key: string) => string): string[] {
  return [
    t('surveyStepHouseholdInfo'),
    t('surveyStepLandLocation'),
    t('surveyStepCurrentProduction'),
    t('surveyStepLivestockPoultry'),
    t('surveyStepIncomeSales'),
    t('surveyStepResourcesInputs'),
    t('stepChallenges'),
  ];
}
const STEP_ICONS = [Users, Leaf, Sprout, Home, FileText, Droplets, AlertTriangle, CircleCheck];
const FULL_STEPS = [0, 1, 2, 3, 4, 5, 6, 7];
const SHORT_STEPS = [0, 1, 2, 5, 6, 7];

// English-only for now (genuinely new — the "Current Production" reporting grid has no prior
// translated equivalent anywhere in lib/i18n.tsx); t() falls back to English per key.
function productionRows(t: (key: string) => string): Array<{ category: ProductionCategory; label: string; hint: string }> {
  return [
    { category: 'leafy_greens', label: t('surveyProdLeafyGreensLabel'), hint: t('surveyProdLeafyGreensHint') },
    { category: 'other_vegetables', label: t('surveyProdOtherVegLabel'), hint: t('surveyProdOtherVegHint') },
    { category: 'staple_crops', label: t('surveyProdStapleCropsLabel'), hint: t('surveyProdStapleCropsHint') },
    { category: 'fruit', label: t('surveyProdFruitLabel'), hint: t('surveyProdFruitHint') },
    { category: 'nuts_berries', label: t('surveyProdNutsBerriesLabel'), hint: t('surveyProdNutsBerriesHint') },
    { category: 'eggs', label: t('surveyProdEggsLabel'), hint: '' },
    { category: 'poultry', label: t('surveyProdPoultryLabel'), hint: '' },
    { category: 'rabbits', label: t('surveyProdRabbitsLabel'), hint: '' },
    { category: 'honey', label: t('surveyProdHoneyLabel'), hint: '' },
    { category: 'other', label: t('surveyProdOtherLabel'), hint: t('surveyProdOtherHint') },
  ];
}

// English-only for now — the FAO HDDS food-group names are a distinct vocabulary from the
// similarly-worded crop/production categories above, so they get their own keys rather than
// reusing e.g. cropVegetables for "vegetables" the food group.
function hddsLabels(t: (key: string) => string): Record<HddsFoodGroup, string> {
  return {
    cereals: t('surveyHddsCereals'), roots_tubers: t('surveyHddsRootsTubers'), vegetables: t('surveyHddsVegetables'), fruit: t('surveyHddsFruit'),
    meat_poultry: t('surveyHddsMeatPoultry'), eggs: t('surveyHddsEggs'), fish: t('surveyHddsFish'), pulses_nuts_seeds: t('surveyHddsPulsesNutsSeeds'),
    milk: t('surveyHddsMilk'), oils_fats: t('surveyHddsOilsFats'), sugars_honey: t('surveyHddsSugarsHoney'), spices_beverages: t('surveyHddsSpicesBeverages'),
  };
}

// English-only for now — three-letter month abbreviations, genuinely new keys.
function monthLabels(t: (key: string) => string): string[] {
  return [
    t('surveyMonthJan'), t('surveyMonthFeb'), t('surveyMonthMar'), t('surveyMonthApr'),
    t('surveyMonthMay'), t('surveyMonthJun'), t('surveyMonthJul'), t('surveyMonthAug'),
    t('surveyMonthSep'), t('surveyMonthOct'), t('surveyMonthNov'), t('surveyMonthDec'),
  ];
}

const AMBIGUOUS_FOOD_GROUP_CATEGORIES = new Set<ProductionCategory>(['staple_crops', 'nuts_berries', 'other']);

function toggle(arr: string[], v: string): string[] {
  return toggleSurveyChoice(arr, v, v === 'nothing' || arr.includes('nothing') ? 'nothing' : 'none');
}

function Chip({ label, on, onClick, color = 'var(--brand)' }: { label: string; on: boolean; onClick: () => void; color?: string }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`${styles.chip} font-sans font-semibold transition-all`}
      style={{ padding: '8px 16px', borderRadius: 999, fontSize: 13.5, cursor: 'pointer',
        background: on ? color : 'var(--surface-2)',
        color: on ? 'var(--survey-on-brand)' : 'var(--text-2)',
        border: `1px solid ${on ? color : 'var(--border)'}` }}>
      {label}
    </button>
  );
}

function Radio({ label, desc, on, onClick }: { label: string; desc?: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`${styles.choice} w-full flex items-start gap-3 text-left transition-all`}
      style={{ padding: '10px 14px', borderRadius: 12,
        background: on ? 'var(--brand-soft)' : 'var(--surface-2)',
        border: `1.5px solid ${on ? 'var(--brand)' : 'var(--border)'}`, cursor: 'pointer' }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${on ? 'var(--brand)' : 'var(--border-strong)'}`,
        background: on ? 'var(--brand)' : 'transparent', flexShrink: 0, marginTop: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {on && <Check size={11} style={{ color: 'var(--survey-on-brand)' }} />}
      </div>
      <div>
        <div className="font-sans font-semibold" style={{ fontSize: 13.5, color: 'var(--text)' }}>{label}</div>
        {desc && <div className="font-sans" style={{ fontSize: 12, color: 'var(--text-2)' }}>{desc}</div>}
      </div>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className={`${styles.questionLabel} font-sans font-semibold mb-2`} style={{ fontSize: 13, color: 'var(--text-2)' }}>{children}</div>;
}

function Toggle({ label, sub, on, onChange }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between" style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '12px 14px', border: '1px solid var(--border)' }}>
      <div>
        <div className="font-sans font-semibold" style={{ fontSize: 13.5, color: 'var(--text)' }}>{label}</div>
        {sub && <div className="font-sans" style={{ fontSize: 12, color: 'var(--text-2)' }}>{sub}</div>}
      </div>
      <button onClick={() => onChange(!on)} role="switch" aria-checked={on} aria-label={label} className="flex items-center rounded-full transition-all flex-shrink-0"
        style={{ width: 52, height: 44, padding: 7, background: on ? 'var(--brand)' : 'rgba(32,25,15,0.15)',
          justifyContent: on ? 'flex-end' : 'flex-start', border: 'none', cursor: 'pointer' }}>
        <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  );
}

function NumInput({ value, onChange, placeholder, hint, label }: { value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; label: string }) {
  const { t } = useLanguage();
  return (
    <>
      <input type="number" min="0" step="any" aria-label={label} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? t('surveyNumInputDefaultPlaceholder')}
        className="w-full font-sans"
        style={{ padding: '10px 14px', borderRadius: 11, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text)', outline: 'none' }} />
      {hint && <div className="font-sans mt-1" style={{ fontSize: 12, color: 'var(--text-2)' }}>{hint}</div>}
    </>
  );
}

function SoilSwatch({ kind }: { kind: string }) {
  return <svg viewBox="0 0 100 40" aria-hidden="true" className={styles.soilSwatch}>
    <path d="M3 12 Q20 8 35 12T67 12T97 12V36H3Z" fill="currentColor" opacity=".13"/>
    {kind === 'healthy' && <g fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M50 3V29M50 18l-11 7m11-6 12 5m-12-3-4 11M42 5q8-2 8 6m8-6q-8-2-8 6"/>{[15,29,70,85].map(x=><path key={x} d={`M${x} 23h4m-1 7h3`}/>)}</g>}
    {kind === 'compacted' && <g stroke="currentColor" strokeWidth="3" opacity=".65">{[19,26,33].map(y=><path key={y} d={`M7 ${y}h86`}/>)}</g>}
    {kind === 'sandy' && Array.from({length:24},(_,i)=><circle key={i} cx={9+(i%8)*11.5} cy={18+Math.floor(i/8)*7} r="1.5" fill="currentColor" opacity=".7"/>)}
    {kind === 'clay' && <g fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m8 20 16-3 15 4 19-5 17 3 16-1M9 29l17-5 13 5 20-3 14 5 17-4M24 17l2 7m13-3v8m19-13 1 10m16-7-2 12"/></g>}
    {kind === 'unknown' && <text x="50" y="29" textAnchor="middle" fill="currentColor" fontSize="27">?</text>}
  </svg>;
}

function AutoFillNote({ areaM2 }: { areaM2: number }) {
  const { t } = useLanguage();
  return (
    <div className="font-sans flex items-center gap-1.5 mt-1.5" style={{ fontSize: 12, color: 'var(--brand)' }}>
      <Sparkles size={12} />
      {t('surveyAutoFillNote').replace('{area}', String(Math.round(areaM2)))}
    </div>
  );
}

export default function SiteSurveySheet({ placeId, coords, annualRainfallMm, onSaved, onClose }: Props) {
  const { t } = useLanguage();
  const appConfirm = useAppConfirm();
  const STEPS = [...surveySteps(t), t('surveyReviewTitle')];
  const PRODUCTION_ROWS = productionRows(t);
  const HDDS_LABELS = hddsLabels(t);
  const MONTH_LABELS = monthLabels(t);

  const place = loadPlaces().find(p => p.id === placeId);
  // Prefer the live pin's coords (per-site canonical key); fall back to the place lookup.
  const siteLoc = coords ?? (place ? { lat: place.lat, lon: place.lon } : null);
  const siteId = designSiteIdFromLocation(siteLoc ? ({ lat: siteLoc.lat, lon: siteLoc.lon } as LocationData) : null);
  const [existing] = useState(() => loadSurvey(siteId));
  const tracedAreas = computeTracedAreaTotals(siteId, siteLoc?.lat ?? null, siteLoc?.lon ?? null);
  // computeTracedAreaTotals can only see main-map shapes and the legacy design blob, so a roof
  // traced in the Design Studio left this field empty while the Water sheet was already sizing a
  // tank off that very ring. Studio ring wins when present — the same precedence resolveBaseLayers
  // applies everywhere else — else the legacy total, unchanged, for map-only farmers.
  const studioCanvas = loadCanvasState(siteId);
  const roofAreaM2 = surveyRoofAreaM2(studioCanvas, tracedAreas.roofAreaM2);
  // Every building beyond the largest — the store room, the shed — sums into "Secondary roofs".
  const secondaryRoofM2 = studioRoofAreasM2(studioCanvas).secondaryM2;

  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<'short' | 'full'>('short');
  const [started, setStarted] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [openProduction, setOpenProduction] = useState<ProductionCategory | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const guideId = useId();
  const route = mode === 'short' ? SHORT_STEPS : FULL_STEPS;
  const routeIndex = route.indexOf(step);
  const goTo = (next: number) => { setStep(next); setStarted(true); };


  // Step 0 — Site & Goals
  const [siteType, setSiteType] = useState<'homestead' | 'community'>(existing?.siteType ?? 'homestead');
  const [adults, setAdults] = useState(existing?.adults ?? '');
  const [memberCount, setMemberCount] = useState(existing?.memberCount ?? '');
  const [goals, setGoals] = useState<string[]>(existing?.goals ?? []);

  // Step 1 — Water
  const [waterSource, setWaterSource] = useState<string[]>(existing?.waterSource ?? []);
  const [waterDelivery, setWaterDelivery] = useState<string[]>(Array.isArray(existing?.waterDelivery) ? existing.waterDelivery : (existing?.waterDelivery ? [existing.waterDelivery] : []));
  const [waterStorage, setWaterStorage] = useState<string[]>(existing?.waterStorage ?? []);

  // Step 2 — Roof catchment
  // Surveys saved before roofAreaSource existed have no such field at all (undefined, not
  // 'manual') — but the only way roofMainM2/roofSecondaryM2 could already be nonzero on a
  // pre-existing record is a farmer having typed it in. Treat that case as manual too, or
  // auto-fill silently clobbers it the moment this sheet mounts.
  const roofAreaSourceIsManual = !!existing && (
    existing.roofAreaSource === 'manual' ||
    (existing.roofAreaSource == null && (((existing.roofMainM2 ?? 0) !== 0) || ((existing.roofSecondaryM2 ?? 0) !== 0)))
  );
  const [roofMain, setRoofMain] = useState(() => {
    if (existing?.roofMainM2 != null && roofAreaSourceIsManual) return existing.roofMainM2.toString();
    if (roofAreaM2 > 0) return String(Math.round(roofAreaM2));
    return existing?.roofMainM2?.toString() ?? '';
  });
  const [roofSource, setRoofSource] = useState<'auto' | 'manual' | undefined>(() =>
    roofAreaSourceIsManual ? 'manual' : (roofAreaM2 > 0 ? 'auto' : undefined)
  );
  // Same manual-first contract as the main roof: a figure the farmer typed (or any pre-source
  // saved value) is never clobbered by auto-fill.
  const roofSecondarySourceIsManual = !!existing && (
    existing.roofSecondarySource === 'manual' ||
    (existing.roofSecondarySource == null && ((existing.roofSecondaryM2 ?? 0) !== 0))
  );
  const [roofSecondary, setRoofSecondary] = useState(() => {
    if (existing?.roofSecondaryM2 != null && roofSecondarySourceIsManual) return existing.roofSecondaryM2.toString();
    if (secondaryRoofM2 > 0) return String(Math.round(secondaryRoofM2));
    return existing?.roofSecondaryM2?.toString() ?? '';
  });
  const [roofSecondarySource, setRoofSecondarySource] = useState<'auto' | 'manual' | undefined>(() =>
    roofSecondarySourceIsManual ? 'manual' : (secondaryRoofM2 > 0 ? 'auto' : undefined)
  );
  const [hasGutters, setHasGutters] = useState(existing?.hasGutters ?? false);

  // Step 3 — Land & soil
  const [landPrep, setLandPrep] = useState(existing?.landPrepMethod ?? '');
  const [soilCondition, setSoilCondition] = useState(existing?.soilCondition ?? '');
  const [soilAmendments, setSoilAmendments] = useState<string[]>(existing?.soilAmendments ?? []);
  const [fencing, setFencing] = useState(existing?.hasFencing ?? '');

  // Step 4 — What exists
  const [crops, setCrops] = useState<string[]>(existing?.existingCrops ?? []);
  const [existingGrowingArea, setExistingGrowingArea] = useState(() => {
    if (existing?.existingGrowingAreaM2 != null && existing.existingGrowingAreaSource === 'manual') return existing.existingGrowingAreaM2.toString();
    if (tracedAreas.cultivationAreaM2 > 0) return String(Math.round(tracedAreas.cultivationAreaM2));
    return existing?.existingGrowingAreaM2?.toString() ?? '';
  });
  const [growingAreaSource, setGrowingAreaSource] = useState<'auto' | 'manual' | undefined>(() =>
    (existing?.existingGrowingAreaSource === 'manual' || (existing?.existingGrowingAreaSource == null && existing?.existingGrowingAreaM2 != null)) ? 'manual' : (tracedAreas.cultivationAreaM2 > 0 ? 'auto' : undefined)
  );
  const [livestock, setLivestock] = useState<string[]>(existing?.livestock ?? []);
  const [otherInfra, setOtherInfra] = useState<string[]>(existing?.otherInfra ?? []);
  const [reportedProduction, setReportedProduction] = useState<ReportedProduction[]>(existing?.reportedProduction ?? []);
  const productionRow = (category: ProductionCategory): ReportedProduction =>
    reportedProduction.find((row) => row.category === category) ?? {
      category,
      quantityPerYear: null,
      unit: '',
      usedByHousehold: null,
      sold: null,
      incomeZar: null,
      harvestMonths: [],
    };
  const patchProduction = (category: ProductionCategory, patch: Partial<ReportedProduction>) => {
    setReportedProduction((rows) => {
      const prior = rows.find((row) => row.category === category) ?? {
        category,
        quantityPerYear: null,
        unit: '',
        usedByHousehold: null,
        sold: null,
        incomeZar: null,
        harvestMonths: [],
      };
      return [...rows.filter((row) => row.category !== category), { ...prior, ...patch }];
    });
  };

  // Step 5 — Challenges
  const [practice, setPractice] = useState(existing?.farmingPractice ?? '');
  const [challenges, setChallenges] = useState<string[]>(existing?.challenges ?? []);
  const [isCommercial, setIsCommercial] = useState(existing?.isCommercial ?? false);
  const [marketType, setMarketType] = useState(existing?.marketType ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const totalRoof = (Number(roofMain) || 0) + (Number(roofSecondary) || 0);
  const roofHarvest600 = totalRoof > 0 ? Math.round(totalRoof * 600 * (hasGutters ? 0.8 : 0.6) / 1000) : 0;
  const rainfallMm = typeof annualRainfallMm === 'number' && Number.isFinite(annualRainfallMm) && annualRainfallMm >= 0 ? annualRainfallMm : null;
  const localRoofHarvest = rainfallMm !== null && totalRoof > 0 ? Math.round(totalRoof * rainfallMm * (hasGutters ? 0.8 : 0.6) / 1000) : null;
  const reportedGroups = reportedFoodGroups(reportedProduction);

  const survey: SiteSurvey = {
      siteId,
      placeId,
      savedAt: existing?.savedAt ?? '',
      siteType,
      adults,
      memberCount: siteType === 'community' ? memberCount : undefined,
      goals,
      waterSource,
      waterDelivery,
      waterStorage,
      roofMainM2: roofMain ? Number(roofMain) : null,
      roofSecondaryM2: roofSecondary ? Number(roofSecondary) : null,
      roofAreaSource: roofSource,
      roofSecondarySource,
      hasGutters,
      landPrepMethod: landPrep,
      soilCondition,
      soilAmendments,
      hasFencing: fencing,
      existingCrops: crops,
      existingGrowingAreaM2: existingGrowingArea ? Number(existingGrowingArea) : null,
      existingGrowingAreaSource: growingAreaSource,
      livestock,
      otherInfra,
      farmingPractice: practice,
      challenges,
      isCommercial,
      marketType: isCommercial ? marketType : undefined,
      reportedProduction: reportedProduction.filter((row) =>
        !!row.name || !!row.unit || row.quantityPerYear !== null || row.usedByHousehold !== null
        || row.sold !== null || row.incomeZar !== null || (row.harvestMonths?.length ?? 0) > 0
        || !!row.foodGroup,
      ),
      notes,
    };
  const fingerprint = JSON.stringify(survey);
  const initialFingerprint = useRef(fingerprint);
  const dirty = fingerprint !== initialFingerprint.current;
  const invalidProduction = survey.reportedProduction?.filter(productionNeedsReview) ?? [];
  const invalidArea = [roofMain, roofSecondary, existingGrowingArea].some(value =>
    value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0));
  const missingSections = [
    { step: 0, missing: goals.length === 0 },
    { step: 1, missing: !landPrep || !soilCondition },
    { step: 5, missing: waterSource.length === 0 || waterDelivery.length === 0 },
    { step: 6, missing: !practice || challenges.length === 0 },
  ].filter(item => item.missing);
  const canSave = !invalidArea && invalidProduction.length === 0 && missingSections.length === 0;
  const handleSave = () => {
    if (!canSave) return;
    const saved = saveSurvey({ ...survey, savedAt: new Date().toISOString() });
    if (saved) { initialFingerprint.current = fingerprint; onSaved(saved); }
    else setSaveError(true);
  };
  const closeWithConfirm = useCallback(async () => {
    if (dirty && !(await appConfirm({
      message: t('surveyDiscardConfirm'), confirmLabel: t('surveyDiscardBtn'),
      cancelLabel: t('cancelBtn'), destructive: true,
    }))) return;
    onClose();
  }, [dirty, onClose, t, appConfirm]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The confirmation owns keyboard focus while it is open.
      if (document.querySelector('[role="alertdialog"]')) return;
      if (e.key === 'Escape') { e.preventDefault(); void closeWithConfirm(); }
      if (e.key === 'Tab') {
        const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, textarea, select, a[href], summary, [tabindex="0"]') ?? [])
          .filter(el => el.getClientRects().length > 0);
        const first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === headingRef.current)) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    const beforeUnload = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', beforeUnload);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('beforeunload', beforeUnload); };
  }, [closeWithConfirm, dirty]);
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
    headingRef.current?.focus({ preventScroll: true });
    const active = dialogRef.current?.querySelector<HTMLElement>('[aria-current="step"]');
    if (active && window.matchMedia('(max-width:760px)').matches) active.parentElement?.scrollTo({ left: active.offsetLeft - 12 });
  }, [step, started]);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; prior?.focus(); };
  }, []);

  const Icon = STEP_ICONS[step];
  const fieldGuides = [t('surveyGuidePeople'), t('surveyGuideLand'), t('surveyGuideProduction'), t('surveyGuideLivestock'), t('surveyGuideIncome'), t('surveyGuideWater'), t('surveyGuideChallenges'), t('surveyReviewHint')];
  const tips = [t('surveyTipPeople'), t('surveyTipLand'), t('surveyTipProduction'), t('surveyTipLivestock'), t('surveyTipIncome'), t('surveyTipWater'), t('surveyTipChallenges'), t('surveyReviewHint')];

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={t('siteQuestionnaireTitle')} className={`${styles.survey} fixed inset-0 z-50 flex flex-col u-anim-sheet`}>
      <header className={styles.header}>
        <div className={styles.brandMark}><NotebookPen size={23}/></div>
        <div className={styles.siteHeading}><strong>{t('siteQuestionnaireTitle')}</strong><span><MapPin size={12}/>{place?.name ?? t('surveyYourSite')}</span></div>
        {started && <button className={styles.modeButton} onClick={() => setStarted(false)}>{mode === 'short' ? t('surveyShortTitle') : t('surveyFullTitle')}<ChevronDown size={14}/></button>}
        <button onClick={closeWithConfirm} aria-label={t('surveyCloseAriaLabel')} className={styles.close}><X size={20}/></button>
      </header>
      <div className={styles.workspace}>
        {started && <nav className={styles.navigation} aria-label={t('surveySections')}>
          <span className={styles.eyebrow}>{t('surveyFieldNotebook')}</span>
          {route.map((id, index) => { const StepIcon = STEP_ICONS[id]; return <button key={id} aria-current={step === id ? 'step' : undefined} onClick={() => goTo(id)}>
            <span className={styles.stepNumber}>{index + 1}</span><StepIcon size={18}/><span>{id === 2 && mode === 'short' ? t('surveyGrowingResources') : STEPS[id]}</span>
          </button>; })}
          <p className={styles.navNote}><Info size={16}/>{t('surveySaveReminder')}</p>
        </nav>}
        <div ref={scrollRef} className={styles.scroll}>
        {!started ? <div className={styles.welcome}>
          <div className={styles.welcomeIntro}>
            <span className={styles.eyebrow}>{t('surveyFieldNotebook')}</span>
            <h1 ref={headingRef} tabIndex={-1}>{t('surveyWelcomeTitle')}</h1>
            <p>{t('surveyWelcomeIntro')}</p>
            <div className={styles.illustration}><Illustration name="example-hero"/><span>{t('surveyIllustrationCaption')}</span></div>
          </div>
          <div className={styles.modeCards}>
            {(['short','full'] as const).map(value => <button key={value} className={styles.modeCard} aria-pressed={mode === value} onClick={() => setMode(value)}>
              <div className={styles.modeCardTop}>{value === 'short' ? <Sprout size={26}/> : <NotebookPen size={26}/>}<span>{value === 'short' ? t('surveyFiveSections') : t('surveySevenSections')}</span>{mode === value ? <CircleCheck size={23}/> : <Circle size={23}/>}</div>
              <h2>{value === 'short' ? t('surveyShortTitle') : t('surveyFullTitle')}</h2>
              <p>{value === 'short' ? t('surveyShortDescription') : t('surveyFullDescription')}</p>
              <span className={styles.modeIncludes}>{value === 'short' ? t('surveyShortIncludes') : t('surveyFullIncludes')}</span>
            </button>)}
          </div>
          <div className={styles.startRow}><p><Check size={18}/>{t('surveySwitchHint')}</p></div>
          <div className={styles.welcomeBenefits}><span><Pencil size={18}/>{t('surveyBenefitObserve')}</span><span><FileText size={18}/>{t('surveyBenefitAdvice')}</span><span><Check size={18}/>{t('surveyBenefitReview')}</span></div>
        </div> : <div className={styles.contentGrid}>
          <main className={styles.main}>
            <div className={styles.stepHeading}><div className={styles.stepIcon}><Icon size={26}/></div><div>
              <span className={styles.eyebrow}>{t('stepOfSteps').replace('{n}', String(routeIndex + 1)).replace('{total}', String(route.length))}</span>
              <h2 ref={headingRef} tabIndex={-1}>{step === 2 && mode === 'short' ? t('surveyGrowingResources') : STEPS[step]}</h2>
            </div></div>
            <p className={styles.intro}>{tips[step]}</p>
            {step < 7 && <details className={styles.mobileGuide}><summary><Info size={16}/>{t('surveyFieldGuide')}</summary><p>{fieldGuides[step]}</p></details>}
            {step === 7 && missingSections.length > 0 && <div className={styles.missing}><strong>{t('surveyMissingEssentials')}</strong><p>{t('surveyMissingHint')}</p>{missingSections.map(item => <button key={item.step} onClick={() => goTo(item.step)}>{STEPS[item.step]}<ArrowRight size={16}/></button>)}</div>}
            {step === 7 && <SiteSurveyReview survey={survey} onEdit={id => goTo(mode === 'short' && (id === 3 || id === 4) ? 2 : id)} onEditProduction={() => { setMode('full'); goTo(2); }} productionLabels={PRODUCTION_ROWS} months={MONTH_LABELS}/>}
            <div className={styles.questions}>
        {/* ── Step 0: Site & Goals ── */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <SectionLabel>{t('sectionWhoIsThisSiteFor')}</SectionLabel>
              <div className="space-y-2">
                <Radio label={t('radioMeMyFamily')} desc={t('radioMeMyFamilyDesc')} on={siteType === 'homestead'} onClick={() => setSiteType('homestead')} />
                <Radio label={t('radioCommunityGroup')} desc={t('radioCommunityGroupDesc')} on={siteType === 'community'} onClick={() => setSiteType('community')} />
              </div>
            </div>

            {siteType === 'homestead' ? (
              <div>
                <SectionLabel>{t('sectionAdultsWhoWorkThisLand')}</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {[
                    { v: '1', label: t('surveyAdultsChip1') },
                    { v: '2-5', label: t('surveyAdultsChipRange2to5') },
                    { v: '6-10', label: t('surveyAdultsChipRange6to10') },
                    { v: '10+', label: t('surveyAdultsChipRange10Plus') },
                  ].map(o => (
                    <Chip key={o.v} label={o.label} on={adults === o.v} onClick={() => setAdults(o.v)} />
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <SectionLabel>{t('sectionApproximateNumberOfMembers')}</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {[
                    { v: 'Under 20', label: t('chipUnder20') },
                    { v: '20–50', label: t('chipMemberRange20To50') },
                    { v: '50+', label: t('chipMemberRange50Plus') },
                  ].map(o => (
                    <Chip key={o.v} label={o.label} on={memberCount === o.v} onClick={() => setMemberCount(o.v)} />
                  ))}
                </div>
              </div>
            )}

            <div>
              <SectionLabel>{t('sectionGoalsSelectAll')}</SectionLabel>
              <div className="space-y-2">
                {[
                  { v: 'food',      label: t('goalFoodSecurityLabel'),   desc: t('goalFoodSecurityDesc') },
                  { v: 'income',    label: t('goalGenerateIncomeLabel'), desc: t('goalGenerateIncomeDesc') },
                  { v: 'soil',      label: t('goalRestoreTheLandLabel'), desc: t('goalRestoreTheLandDesc') },
                  { v: 'education', label: t('goalDemonstrateTeachLabel'), desc: t('goalDemonstrateTeachDesc') },
                ].map(o => (
                  <button key={o.v} aria-pressed={goals.includes(o.v)} onClick={() => setGoals(toggle(goals, o.v))}
                    className="w-full flex items-start gap-3 text-left transition-all"
                    style={{ padding: '10px 14px', borderRadius: 12,
                      background: goals.includes(o.v) ? 'var(--brand-soft)' : 'var(--surface-2)',
                      border: `1.5px solid ${goals.includes(o.v) ? 'var(--brand)' : 'var(--border)'}`, cursor: 'pointer' }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${goals.includes(o.v) ? 'var(--brand)' : 'var(--border-strong)'}`,
                      background: goals.includes(o.v) ? 'var(--brand)' : 'transparent', flexShrink: 0, marginTop: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {goals.includes(o.v) && <Check size={11} style={{ color: 'var(--survey-on-brand)' }} />}
                    </div>
                    <div>
                      <div className="font-sans font-semibold" style={{ fontSize: 13.5, color: 'var(--text)' }}>{o.label}</div>
                      <div className="font-sans" style={{ fontSize: 12, color: 'var(--text-2)' }}>{o.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 5: Resources & Inputs — Water ── */}
        {step === 5 && (
          <div className="space-y-5">
            <div>
              <SectionLabel>{t('sectionWaterSources')}</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'municipal',  label: t('waterSourceMunicipalTap') },
                  { v: 'borehole',   label: t('waterSourceBorehole') },
                  { v: 'river',      label: t('waterSourceRiverStream') },
                  { v: 'rainwater',  label: t('waterSourceRainwater') },
                  { v: 'grey',       label: t('waterSourceGreyWater') },
                  { v: 'none',       label: t('waterSourceNoneYet') },
                ].map(o => (
                  <Chip key={o.v} label={o.label} on={waterSource.includes(o.v)} onClick={() => setWaterSource(toggle(waterSource, o.v))} color="var(--brand)" />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>{t('sectionHowDoesWaterReachPlants')}</SectionLabel>
              <div className="space-y-2">
                {[
                  { v: 'drip',       label: t('waterDeliveryDripLabel'),      desc: t('waterDeliveryDripDesc') },
                  { v: 'sprinkler',  label: t('waterDeliverySprinklerLabel'), desc: t('waterDeliverySprinklerDesc') },
                  { v: 'piped',      label: t('waterDeliveryPipedLabel'),     desc: t('waterDeliveryPipedDesc') },
                  { v: 'gravity',    label: t('waterDeliveryGravityLabel'),   desc: t('waterDeliveryGravityDesc') },
                  { v: 'bucket',     label: t('waterDeliveryBucketLabel'),    desc: t('waterDeliveryBucketDesc') },
                  { v: 'flood',      label: t('waterDeliveryFloodLabel'),     desc: t('waterDeliveryFloodDesc') },
                  { v: 'none',       label: t('waterDeliveryNoneLabel'),      desc: t('waterDeliveryNoneDesc') },
                ].map(o => (
                  <Radio key={o.v} label={o.label} desc={o.desc}
                    on={waterDelivery.includes(o.v)}
                    onClick={() => setWaterDelivery(prev =>
                      toggleSurveyChoice(prev, o.v)
                    )} />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>{t('sectionWaterStorage')}</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'jojo',    label: t('waterStorageJojoTanks') },
                  { v: 'dam',     label: t('waterStorageEarthDam') },
                  { v: 'pond',    label: t('waterStoragePond') },
                  { v: 'cistern', label: t('waterStorageCistern') },
                  { v: 'none',    label: t('waterStorageNone') },
                ].map(o => (
                  <Chip key={o.v} label={o.label} on={waterStorage.includes(o.v)} onClick={() => setWaterStorage(toggle(waterStorage, o.v))} color="var(--brand)" />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 5: Resources & Inputs — Roof catchment ── */}
        {step === 5 && (
          <div className="space-y-5">
            <div style={{ background: 'rgba(35,94,134,0.06)', borderRadius: 14, padding: '12px 14px', border: '1px solid rgba(35,94,134,0.18)' }}>
              <p className="font-sans" style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
                <span className="font-semibold" style={{ color: 'var(--blue)' }}>{t('roofCatchmentWhyMattersLabel')}</span>
                {t('roofCatchmentWhyMattersText')}
              </p>
            </div>

            <div>
              <SectionLabel>{t('sectionMainBuildingRoofArea')}</SectionLabel>
              <div className="font-sans mb-2" style={{ fontSize: 12, color: 'var(--text-2)' }}>{t('roofMainBuildingGuide')}</div>
              <NumInput label={t('sectionMainBuildingRoofArea')} value={roofMain} onChange={v => { setRoofMain(v); setRoofSource('manual'); }} placeholder={t('roofMainPlaceholder')} hint={t('roofMainHint')} />
              {roofSource === 'auto' && <AutoFillNote areaM2={roofAreaM2} />}
            </div>

            <div>
              <SectionLabel>{t('sectionSecondaryRoofs')}</SectionLabel>
              <NumInput label={t('sectionSecondaryRoofs')} value={roofSecondary} onChange={v => { setRoofSecondary(v); setRoofSecondarySource('manual'); }} placeholder={t('roofSecondaryPlaceholder')} hint={t('roofSecondaryHint')} />
              {roofSecondarySource === 'auto' && <AutoFillNote areaM2={secondaryRoofM2} />}
            </div>

            <Toggle label={t('toggleGuttersLabel')} sub={t('toggleGuttersSub')} on={hasGutters} onChange={setHasGutters} />

            {totalRoof > 0 && <div className={styles.roofVisual}>
              <h3>{t('surveyRoofEstimateTitle')}</h3>
              <div className={styles.roofFlow}>
                <div><Home size={30}/><strong>{totalRoof.toLocaleString()} m²</strong><span>{t('liveEstimateTotalRoofArea')}</span></div><span aria-hidden="true">×</span>
                <div><Droplets size={30}/><strong>{rainfallMm === null ? '—' : `${rainfallMm.toLocaleString()} mm`}</strong><span>{t('surveyAnnualRainfall')}</span></div><ArrowRight size={20} aria-hidden="true"/>
                <div><Droplets size={30}/><strong>{localRoofHarvest === null ? '—' : `~${localRoofHarvest.toLocaleString()} kL`}</strong><span>{t('surveyEstimatedCollection')}</span></div>
              </div>
              <p>{localRoofHarvest === null ? t('surveyRainfallMissing') : t('surveyRoofInputs')}</p>
            </div>}
            {totalRoof > 0 && (
              <details className={styles.workedExample}><summary>{t('surveyRoofExample')}</summary><div style={{ background: 'rgba(31,77,43,0.06)', borderRadius: 14, padding: '14px 16px', border: '1px solid rgba(31,77,43,0.2)' }}>
                <div className="font-sans font-semibold mb-1" style={{ fontSize: 13, color: 'var(--brand)' }}>{t('liveEstimateTitle')} · {t('surveyIllustrativeOnly')}</div>
                <div className="font-sans" style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  {t('liveEstimateTotalRoofArea')} <strong>{totalRoof} m²</strong><br />
                  {t('liveEstimateAt600mmRain')} <strong>~{roofHarvest600} {t('liveEstimatePerYear')}</strong> ({hasGutters ? '80%' : '60%'} {t('surveyEfficiencySuffix')})<br />
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{t('liveEstimateActualRainfallNote')}</span>
                </div>
              </div></details>
            )}
          </div>
        )}

        {/* ── Step 1: Land & Location ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <SectionLabel>{t('sectionHowIsLandPrepared')}</SectionLabel>
              <div className="space-y-2">
                {[
                  { v: 'hand',    label: t('landPrepHandToolsLabel'), desc: t('landPrepHandToolsDesc') },
                  { v: 'tractor', label: t('landPrepTractorLabel'),   desc: t('landPrepTractorDesc') },
                  { v: 'animal',  label: t('landPrepAnimalLabel'),    desc: t('landPrepAnimalDesc') },
                  { v: 'none',    label: t('landPrepNoneLabel'),      desc: t('landPrepNoneDesc') },
                ].map(o => (
                  <Radio key={o.v} label={o.label} desc={o.desc} on={landPrep === o.v} onClick={() => setLandPrep(o.v)} />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>{t('sectionSoilCondition')}</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: 'healthy',   label: t('soilConditionHealthy') },
                  { v: 'compacted', label: t('soilConditionCompacted') },
                  { v: 'sandy',     label: t('soilConditionSandy') },
                  { v: 'clay',      label: t('soilConditionClay') },
                  { v: 'unknown',   label: t('soilConditionUnknown') },
                ].map(o => (
                  <button key={o.v} aria-pressed={soilCondition === o.v} onClick={() => setSoilCondition(o.v)}
                    className={`${styles.soilChoice} font-sans font-semibold transition-all`}
                    style={{ padding: '9px 12px', borderRadius: 11, fontSize: 13, cursor: 'pointer',
                      background: soilCondition === o.v ? 'var(--brand)' : 'var(--surface-2)',
                      color: soilCondition === o.v ? 'var(--survey-on-brand)' : 'var(--text-2)',
                      border: `1px solid ${soilCondition === o.v ? 'var(--brand)' : 'var(--border)'}` }}>
                    <SoilSwatch kind={o.v}/>{o.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>{t('sectionSoilInputs')}</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'compost',         label: t('soilAmendmentCompost') },
                  { v: 'kraal-manure',    label: t('soilAmendmentKraalManure') },
                  { v: 'mulch',           label: t('soilAmendmentMulch') },
                  { v: 'commercial-fert', label: t('soilAmendmentCommercialFert') },
                  { v: 'none',            label: t('soilAmendmentNone') },
                ].map(o => (
                  <Chip key={o.v} label={o.label} on={soilAmendments.includes(o.v)} onClick={() => setSoilAmendments(toggle(soilAmendments, o.v))} />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>{t('sectionFencing')}</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'full',    label: t('fencingFull') },
                  { v: 'partial', label: t('fencingPartial') },
                  { v: 'none',    label: t('fencingNone') },
                ].map(o => (
                  <Chip key={o.v} label={o.label} on={fencing === o.v} onClick={() => setFencing(o.v)} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Current production ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <SectionLabel>{t('sectionCropsGrowing')}</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'vegetables',   label: t('cropVegetables') },
                  { v: 'fruit-trees',  label: t('cropFruitTrees') },
                  { v: 'herbs',        label: t('cropHerbsMedicinal') },
                  { v: 'indigenous',   label: t('cropIndigenousPlants') },
                  { v: 'fodder',       label: t('cropFodder') },
                  { v: 'grain',        label: t('cropGrainMaize') },
                  { v: 'nothing',      label: t('cropNothing') },
                ].map(o => (
                  <Chip key={o.v} label={o.label} on={crops.includes(o.v)} onClick={() => setCrops(toggle(crops, o.v))} />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>{t('surveyExistingGrowingAreaLabel')}</SectionLabel>
              <NumInput label={t('surveyExistingGrowingAreaLabel')} value={existingGrowingArea} onChange={v => { setExistingGrowingArea(v); setGrowingAreaSource('manual'); }} placeholder={t('surveyExistingGrowingAreaPlaceholder')} hint={t('surveyExistingGrowingAreaHint')} />
              {growingAreaSource === 'auto' && <AutoFillNote areaM2={tracedAreas.cultivationAreaM2} />}
            </div>

            {mode === 'full' ? <div>
              <SectionLabel>{t('surveyCurrentProductionSurveyLabel')}</SectionLabel>
              <div className="font-sans mb-3" style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45 }}>
                {t('surveyReportWhatYouKnow')} {t('surveySameYearUnit')}
              </div>
              <div className="space-y-3">
                {PRODUCTION_ROWS.map(({ category, label, hint }) => {
                  const row = productionRow(category);
                  const number = (value: number | null) => value === null ? '' : String(value);
                  return (
                    <div key={category} className={styles.productionCard}>
                      <button className={styles.productionSummary} aria-expanded={openProduction === category} aria-controls={`${guideId}-${category}`} onClick={() => setOpenProduction(openProduction === category ? null : category)}>
                        <Sprout size={22}/><span><strong>{label}</strong><small>{row.quantityPerYear !== null ? `${row.quantityPerYear} ${row.unit} · ${t('surveyPerYear')}` : t('surveyOptionalRecord')}</small></span><ChevronDown size={18}/>
                      </button>
                      {openProduction === category && <div id={`${guideId}-${category}`} className={styles.productionBody}>
                      {hint && <p>{hint}</p>}
                      {productionNeedsReview(row) && <p className={styles.warning} role="status">{t('surveyProductionCheck')}</p>}
                      {category === 'other' && (
                        <input value={row.name ?? ''} onChange={(e) => patchProduction(category, { name: e.target.value })} aria-label={t('surveyWhatDoYouProducePlaceholder')} placeholder={t('surveyWhatDoYouProducePlaceholder')}
                          className="w-full font-sans mt-2" style={{ minHeight: 44, padding: '8px 10px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text)' }} />
                      )}
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <label className="font-sans" style={{ fontSize: 12, color: 'var(--text-2)' }}>{t('surveyQtyPerYearLabel')}
                          <input type="number" min="0" step="any" value={number(row.quantityPerYear)} onChange={(e) => patchProduction(category, { quantityPerYear: e.target.value === '' ? null : Number(e.target.value) })} className="w-full mt-1" style={{ minHeight: 48, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }} />
                        </label>
                        <label className="font-sans" style={{ fontSize: 12, color: 'var(--text-2)' }}>{t('surveyUnitLabel')}
                          <input value={row.unit} onChange={(e) => patchProduction(category, { unit: e.target.value })} placeholder={t('surveyUnitPlaceholder')} className="w-full mt-1" style={{ minHeight: 48, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }} />
                        </label>
                        <label className="font-sans" style={{ fontSize: 12, color: 'var(--text-2)' }}>{t('surveyUsedByHouseholdLabel')}
                          <input type="number" min="0" step="any" value={number(row.usedByHousehold)} onChange={(e) => patchProduction(category, { usedByHousehold: e.target.value === '' ? null : Number(e.target.value) })} className="w-full mt-1" style={{ minHeight: 48, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }} />
                        </label>
                        <label className="font-sans" style={{ fontSize: 12, color: 'var(--text-2)' }}>{t('surveySoldLabel')}
                          <input type="number" min="0" step="any" value={number(row.sold)} onChange={(e) => patchProduction(category, { sold: e.target.value === '' ? null : Number(e.target.value) })} className="w-full mt-1" style={{ minHeight: 48, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }} />
                        </label>
                      </div>
                      <label className="font-sans block mt-2" style={{ fontSize: 12, color: 'var(--text-2)' }}>{t('surveyIncomeEarnedLabel')}
                        <input type="number" min="0" step="any" value={number(row.incomeZar)} onChange={(e) => patchProduction(category, { incomeZar: e.target.value === '' ? null : Number(e.target.value) })} className="w-full mt-1" style={{ minHeight: 48, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }} />
                      </label>
                      <div className="mt-3">
                        <div className="font-sans" style={{ fontSize: 12, color: 'var(--text-2)' }}>{t('surveyHarvestMonthsLabel')}</div>
                        <div className="grid grid-cols-4 gap-1 mt-1">
                          {MONTH_LABELS.map((month, index) => {
                            const monthNumber = index + 1;
                            const selected = row.harvestMonths?.includes(monthNumber) ?? false;
                            return <button key={month} type="button" aria-pressed={selected} onClick={() => patchProduction(category, {
                              harvestMonths: selected
                                ? (row.harvestMonths ?? []).filter((value) => value !== monthNumber)
                                : [...(row.harvestMonths ?? []), monthNumber].sort((a, b) => a - b),
                            })} className="font-sans" style={{ minHeight: 48, borderRadius: 8, border: `1px solid ${selected ? 'var(--brand)' : 'var(--border)'}`, background: selected ? 'var(--brand)' : 'var(--surface)', color: selected ? 'var(--survey-on-brand)' : 'var(--text-2)', fontSize: 12 }}>{month}</button>;
                          })}
                        </div>
                      </div>
                      {AMBIGUOUS_FOOD_GROUP_CATEGORIES.has(category) && (
                        <label className="font-sans block mt-2" style={{ fontSize: 12, color: 'var(--text-2)' }}>{t('surveyFaoFoodGroupLabel')}
                          <select value={row.foodGroup ?? ''} onChange={(e) => patchProduction(category, { foodGroup: (e.target.value || undefined) as HddsFoodGroup | undefined })} className="w-full mt-1" style={{ minHeight: 48, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}>
                            <option value="">{t('surveyFoodGroupNotSure')}</option>
                            {Object.entries(HDDS_LABELS).map(([value, group]) => <option key={value} value={value}>{group}</option>)}
                          </select>
                        </label>
                      )}
                      </div>}
                    </div>
                  );
                })}
              </div>
              <div className="font-sans mt-3" style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(31,77,43,0.06)', color: 'var(--brand)', fontSize: 12.5, lineHeight: 1.45 }}>
                {reportedGroups.length > 0
                  ? <><strong>{t('surveyFoodGroupsReportedCount').replace('{n}', String(reportedGroups.length))}</strong> </>
                  : <><strong>{t('surveyFoodGroupsNotReported')}</strong> </>}
                {t('surveyFaoHddsFooter')}
              </div>
            </div> : <button className={styles.detailLink} onClick={() => setMode('full')}><NotebookPen size={20}/><span><strong>{t('surveyAddProduction')}</strong><small>{t('surveyAddProductionHint')}</small></span><ArrowRight size={18}/></button>}


          </div>
        )}

        {/* ── Step 3: Livestock & Poultry ── */}
        {(step === 3 || (step === 2 && mode === 'short')) && (
          <div className="space-y-5">
            <div>
              <SectionLabel>{t('sectionLivestock')}</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'chickens', label: t('livestockChickens') },
                  { v: 'goats',    label: t('livestockGoats') },
                  { v: 'cattle',   label: t('livestockCattle') },
                  { v: 'pigs',     label: t('livestockPigs') },
                  { v: 'bees',     label: t('livestockBees') },
                  { v: 'none',     label: t('livestockNone') },
                ].map(o => (
                  <Chip key={o.v} label={o.label} on={livestock.includes(o.v)} onClick={() => setLivestock(toggle(livestock, o.v))} color="var(--brand)" />
                ))}
              </div>
            </div>
            <div>
              <SectionLabel>{t('sectionOtherInfrastructure')}</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'shade-tunnel', label: t('infraShadeTunnel') },
                  { v: 'greenhouse',   label: t('infraGreenhouse') },
                  { v: 'compost-bay',  label: t('infraCompostBay') },
                  { v: 'shed',         label: t('infraStorageShed') },
                  { v: 'kraal',        label: t('infraLivestockKraal') },
                ].map(o => (
                  <Chip key={o.v} label={o.label} on={otherInfra.includes(o.v)} onClick={() => setOtherInfra(toggle(otherInfra, o.v))} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Income & Sales ── */}
        {(step === 4 || (step === 2 && mode === 'short')) && (
          <div className="space-y-5">
            <Toggle label={t('toggleSellProduceLabel')} sub={t('surveyToggleSellProduceSub')} on={isCommercial} onChange={setIsCommercial} />
            {isCommercial && (
              <div>
                <SectionLabel>{t('sectionCurrentOrTargetMarket')}</SectionLabel>
                <div className="space-y-2">
                  {[
                    { v: 'farm-stall',    label: t('marketFarmStall') },
                    { v: 'local-market',  label: t('marketLocalCommunity') },
                    { v: 'wholesale',     label: t('marketWholesale') },
                    { v: 'not-sure',      label: t('marketNotSure') },
                  ].map(o => (
                    <Radio key={o.v} label={o.label} on={marketType === o.v} onClick={() => setMarketType(o.v)} />
                  ))}
                </div>
              </div>
            )}
            <div className="font-sans" style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(31,77,43,0.06)', color: 'var(--text-2)', fontSize: 12.5, lineHeight: 1.5 }}>
              {t('surveyIncomeSalesNote')}
            </div>
          </div>
        )}

        {/* ── Step 6: Challenges & Notes ── */}
        {step === 6 && (
          <div className="space-y-5">
            <div>
              <SectionLabel>{t('sectionFarmingApproach')}</SectionLabel>
              <div className="space-y-2">
                {[
                  { v: 'organic',        label: t('practiceFullyOrganicLabel'),        desc: t('practiceFullyOrganicDesc') },
                  { v: 'mostly-organic', label: t('practiceMostlyOrganicLabel'),        desc: t('practiceMostlyOrganicDesc') },
                  { v: 'conventional',   label: t('practiceConventionalLabel'),         desc: t('practiceConventionalDesc') },
                  { v: 'experimenting',  label: t('practiceExperimentingLabel'),        desc: t('practiceExperimentingDesc') },
                ].map(o => (
                  <Radio key={o.v} label={o.label} desc={o.desc} on={practice === o.v} onClick={() => setPractice(o.v)} />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>{t('sectionMainChallenges')}</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'drought',    label: t('challengeDrought') },
                  { v: 'pests',      label: t('challengePests') },
                  { v: 'soil',       label: t('challengePoorSoil') },
                  { v: 'water',      label: t('challengeLimitedWater') },
                  { v: 'funding',    label: t('challengeFunding') },
                  { v: 'labour',     label: t('challengeLabour') },
                  { v: 'flooding',   label: t('challengeFlooding') },
                  { v: 'market',     label: t('challengeMarket') },
                  { v: 'none',       label: t('challengeNone') },
                ].map(o => (
                  <Chip key={o.v} label={o.label} on={challenges.includes(o.v)} onClick={() => setChallenges(toggle(challenges, o.v))} color="var(--brand)" />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>{t('sectionAnythingElseLimaShouldKnow')}</SectionLabel>
              <div className="font-sans mb-2" style={{ fontSize: 12, color: 'var(--text-2)' }}>
                {t('notesPlaceholderHint')}
              </div>
              <div style={{ background: 'rgba(31,77,43,0.05)', borderRadius: 11, padding: '4px', border: '1px solid rgba(31,77,43,0.15)', marginBottom: 8 }}>
                <div className="font-sans" style={{ fontSize: 12, color: 'var(--brand)', padding: '6px 10px' }}>
                  📷 {t('photoTip')}
                </div>
              </div>
              <textarea aria-label={t('sectionAnythingElseLimaShouldKnow')} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={t('notesPlaceholder')}
                rows={4} className="w-full font-sans"
                style={{ padding: '10px 14px', borderRadius: 11, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text)', outline: 'none', resize: 'none', lineHeight: 1.5 }} />
            </div>
          </div>
        )}
            </div>
          </main>
          <aside className={styles.companion} aria-label={t('surveyFieldGuide')}>
            <span className={styles.eyebrow}>{t('surveyFieldGuide')}</span>
            <div className={styles.guideDrawing} aria-hidden="true"><Home size={42}/><ArrowRight size={18}/>{step === 5 ? <Droplets size={42}/> : <Sprout size={42}/>}<ArrowRight size={18}/><NotebookPen size={42}/></div>
            <h3>{t('surveyObserveFirst')}</h3><p>{fieldGuides[step]}</p>
            <div className={styles.recordOverview}><strong>{t('surveyRecordOverview')}</strong>
              {[{label:t('surveyGoalsSelected'), value:goals.length}, {label:t('surveyProductionEntries'),value:survey.reportedProduction?.length ?? 0}].map(item => <div key={item.label}><span>{item.label}</span><b>{item.value}</b></div>)}
            </div>
            <p className={styles.smallNote}>{t('surveyUnknownHint')}</p>
            {existing && <p className={styles.smallNote}>{t('surveyEditingExisting')}</p>}
          </aside>
        </div>}
        </div>
      </div>

      <footer className={styles.footer}>
        {!started && <div className={styles.footerInner}><span className={styles.saveReminder}>{t('surveySwitchHint')}</span><button className={styles.primary} onClick={() => { if (!route.includes(step)) setStep(2); setStarted(true); }}>{dirty || existing ? t('surveyContinue') : t('surveyBegin')}<ArrowRight size={18}/></button></div>}
        {saveError && <p role="alert" className={styles.warning}>{t('surveySaveError')}</p>}
        {started && (invalidArea || invalidProduction.length > 0) && <p role="alert" className={styles.warning}>{t('surveyFixBeforeSave')}</p>}
        {started && <div className={styles.footerInner}>
          <button className={styles.back} onClick={() => routeIndex > 0 ? goTo(route[routeIndex - 1]) : setStarted(false)}><ChevronLeft size={17}/>{t('buttonBack')}</button>
          <span className={styles.saveReminder}>{dirty ? t('surveyUnsaved') : t('surveySaveReminder')}</span>
          <button className={styles.primary} disabled={step === 7 && !canSave} onClick={() => step === 7 ? handleSave() : goTo(route[routeIndex + 1])}>
            {step === 7 ? <><Check size={18}/>{t('surveySaveContinue')}</> : <>{step === 6 ? t('surveyReviewTitle') : t('buttonNext')}<ChevronRight size={18}/></>}
          </button>
        </div>}
      </footer>
    </div>
  );
}

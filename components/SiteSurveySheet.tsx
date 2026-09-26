'use client';
import { numberLabel } from '@/lib/format-figures';
import { useState, useCallback, useEffect, useRef, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronRight, ChevronLeft, Check, Users, Droplets, Home, Leaf, AlertTriangle, FileText, Sparkles, Sprout, NotebookPen, ArrowRight, MapPin, CircleCheck, Circle, Pencil, Info, ChevronDown, Camera } from 'lucide-react';
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
import SurveyZuluDraftPair, { surveyZuluConfirmDraft, SURVEY_DISCARD_CONFIRM_ENGLISH, SURVEY_DISCARD_BUTTON_ENGLISH } from './SurveyZuluDraftPair';
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
function productionRows(t: (key: string) => string): Array<{ category: ProductionCategory; label: string; hint: string; englishLabel: string; englishHint: string }> {
  return [
    { category: 'leafy_greens', label: t('surveyProdLeafyGreensLabel'), hint: t('surveyProdLeafyGreensHint'), englishLabel: 'Leafy greens', englishHint: 'Spinach, kale, cabbage, etc.' },
    { category: 'other_vegetables', label: t('surveyProdOtherVegLabel'), hint: t('surveyProdOtherVegHint'), englishLabel: 'Other vegetables', englishHint: 'Tomatoes, onions, peppers, etc.' },
    { category: 'staple_crops', label: t('surveyProdStapleCropsLabel'), hint: t('surveyProdStapleCropsHint'), englishLabel: 'Staple crops', englishHint: 'Maize, beans, sweet potato, etc.' },
    { category: 'fruit', label: t('surveyProdFruitLabel'), hint: t('surveyProdFruitHint'), englishLabel: 'Fruit', englishHint: 'From trees or vines' },
    { category: 'nuts_berries', label: t('surveyProdNutsBerriesLabel'), hint: t('surveyProdNutsBerriesHint'), englishLabel: 'Nuts & berries', englishHint: 'From trees or shrubs' },
    { category: 'eggs', label: t('surveyProdEggsLabel'), hint: '', englishLabel: 'Eggs', englishHint: '' },
    { category: 'poultry', label: t('surveyProdPoultryLabel'), hint: '', englishLabel: 'Poultry meat', englishHint: '' },
    { category: 'rabbits', label: t('surveyProdRabbitsLabel'), hint: '', englishLabel: 'Rabbits', englishHint: '' },
    { category: 'honey', label: t('surveyProdHoneyLabel'), hint: '', englishLabel: 'Honey', englishHint: '' },
    { category: 'other', label: t('surveyProdOtherLabel'), hint: t('surveyProdOtherHint'), englishLabel: 'Other', englishHint: 'Anything not listed above' },
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

const HDDS_ENGLISH: Record<HddsFoodGroup, string> = {
  cereals: 'Cereals', roots_tubers: 'Roots & tubers', vegetables: 'Vegetables', fruit: 'Fruit',
  meat_poultry: 'Meat & poultry', eggs: 'Eggs', fish: 'Fish', pulses_nuts_seeds: 'Pulses, nuts & seeds',
  milk: 'Milk & dairy', oils_fats: 'Oils & fats', sugars_honey: 'Sugars & honey', spices_beverages: 'Spices & beverages',
};

const MONTH_ENGLISH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SURVEY_INCOME_GUIDE_ENGLISH = 'Enter the amount earned from sales, before costs. The survey records income; it does not calculate profit.';
const SURVEY_WATER_GUIDE_ENGLISH = 'Start at the source, then follow the pipe or carrying route. Look for storage and roof gutters. Map-filled areas can be corrected if you measured them on site.';
const SURVEY_WATER_TIP_ENGLISH = 'Follow the water: where it comes from, how it reaches plants, and where it is stored.';
const SURVEY_MISSING_HINT_ENGLISH = 'Choose your goals, land preparation and soil condition, water source and delivery, farming approach and challenges. The other details are optional.';
const SURVEY_MAIN_ROOF_GUIDE_ENGLISH = 'Use a roof outline traced on the map or measured on site. Leave this blank if you do not know.';
const SURVEY_MAIN_ROOF_HINT_ENGLISH = 'The area covered by the roof when seen from directly above; do not use the sloping roof surface.';

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

function Chip({ label, on, onClick, color = 'var(--brand)' }: { label: ReactNode; on: boolean; onClick: () => void; color?: string }) {
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

function Radio({ label, desc, on, onClick }: { label: ReactNode; desc?: ReactNode; on: boolean; onClick: () => void }) {
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

function Toggle({ label, sub, ariaLabel, on, onChange }: { label: ReactNode; sub?: ReactNode; ariaLabel: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between" style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '12px 14px', border: '1px solid var(--border)' }}>
      <div>
        <div className="font-sans font-semibold" style={{ fontSize: 13.5, color: 'var(--text)' }}>{label}</div>
        {sub && <div className="font-sans" style={{ fontSize: 12, color: 'var(--text-2)' }}>{sub}</div>}
      </div>
      <button onClick={() => onChange(!on)} role="switch" aria-checked={on} aria-label={ariaLabel} className="flex items-center rounded-full transition-all flex-shrink-0"
        style={{ width: 52, height: 44, padding: 7, background: on ? 'var(--brand)' : 'rgba(32,25,15,0.15)',
          justifyContent: on ? 'flex-end' : 'flex-start', border: 'none', cursor: 'pointer' }}>
        <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  );
}

function NumInput({ value, onChange, placeholder, placeholderEnglish, hint, label }: { value: string; onChange: (v: string) => void; placeholder?: string; placeholderEnglish?: string; hint?: ReactNode; label: string }) {
  const { lang, t } = useLanguage();
  return (
    <>
      <input type="number" min="0" step="any" aria-label={label} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? t('surveyNumInputDefaultPlaceholder')}
        className="w-full font-sans"
        style={{ padding: '10px 14px', borderRadius: 11, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 14, color: 'var(--text)', outline: 'none' }} />
      {lang === 'zu' && placeholderEnglish && <small>English: {placeholderEnglish}</small>}
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

function AutoFillNote({ areaM2, english }: { areaM2: number; english?: string }) {
  const { lang, t } = useLanguage();
  const label = t('surveyAutoFillNote').replace('{area}', String(Math.round(areaM2)));
  return (
    <div className="font-sans flex items-center gap-1.5 mt-1.5" style={{ fontSize: 12, color: 'var(--brand)' }}>
      <Sparkles size={12} />
      {english && lang === 'zu' ? <SurveyZuluDraftPair english={english.replace('{area}', String(Math.round(areaM2)))}>{label}</SurveyZuluDraftPair> : label}
    </div>
  );
}

export default function SiteSurveySheet({ placeId, coords, annualRainfallMm, onSaved, onClose }: Props) {
  const { lang, t } = useLanguage();
  const paired = (key: string, english: string): ReactNode => {
    const zulu = t(key);
    return lang === 'zu' && zulu !== english ? <SurveyZuluDraftPair english={english}>{zulu}</SurveyZuluDraftPair> : zulu;
  };
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
      message: lang === 'zu' ? surveyZuluConfirmDraft(t('surveyDiscardConfirm'), SURVEY_DISCARD_CONFIRM_ENGLISH) : t('surveyDiscardConfirm'),
      confirmLabel: lang === 'zu' ? surveyZuluConfirmDraft(t('surveyDiscardBtn'), SURVEY_DISCARD_BUTTON_ENGLISH) : t('surveyDiscardBtn'),
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
  }, [step, started]);
  useEffect(() => {
    const alignActiveSection = () => {
      const active = dialogRef.current?.querySelector<HTMLElement>('[aria-current="step"]');
      if (active && window.matchMedia('(max-width:760px)').matches) active.parentElement?.scrollTo({ left: active.offsetLeft - 12 });
    };
    alignActiveSection();
    window.addEventListener('resize', alignActiveSection);
    return () => window.removeEventListener('resize', alignActiveSection);
  }, [step, started, mode]);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; prior?.focus(); };
  }, []);

  const Icon = STEP_ICONS[step];
  const fieldGuides = [t('surveyGuidePeople'), paired('surveyGuideLand', 'Look at several parts of the growing area. If the soil varies, describe the differences in your notes. Choose Not sure when you cannot tell.'), t('surveyGuideProduction'), paired('surveyGuideLivestock', 'Walk around the site and record what is there now. Put planned additions in your notes so they are not mistaken for existing resources.'), lang === 'zu' ? SURVEY_INCOME_GUIDE_ENGLISH : t('surveyGuideIncome'), lang === 'zu' ? SURVEY_WATER_GUIDE_ENGLISH : t('surveyGuideWater'), paired('surveyGuideChallenges', 'Describe where a problem happens and when you notice it. Put the most urgent problem first in your notes.'), lang === 'zu' ? 'Check your observations before saving. Tap a pencil to return to any section.' : t('surveyReviewHint')];
  const tips = [t('surveyTipPeople'), paired('surveyTipLand', 'Look at the ground and how you work it. These are your observations, not a laboratory soil result.'), t('surveyTipProduction'), paired('surveyTipLivestock', 'Choose the animals and structures that are already on the site. Leave unconfirmed details blank.'), paired('surveyTipIncome', 'Record whether you sell produce and where. Quantities and income belong with each production item.'), lang === 'zu' ? SURVEY_WATER_TIP_ENGLISH : t('surveyTipWater'), paired('surveyTipChallenges', 'Tell us what gets in your way. Your notes help keep the report focused on your real situation.'), lang === 'zu' ? 'Check your observations before saving. Tap a pencil to return to any section.' : t('surveyReviewHint')];

  return typeof document === 'undefined' ? null : createPortal((
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={t('siteQuestionnaireTitle')} className={`${styles.survey} fixed inset-0 z-50 flex flex-col u-anim-sheet`}>
      <header className={styles.header}>
        <div className={styles.brandMark}><NotebookPen size={23}/></div>
        <div className={styles.siteHeading}><strong>{t('siteQuestionnaireTitle')}</strong><span><MapPin size={12}/>{place?.name ?? t('surveyYourSite')}</span></div>
        {started && <button className={styles.modeButton} onClick={() => setStarted(false)}>{mode === 'short' ? t('surveyShortTitle') : t('surveyFullTitle')}<ChevronDown size={14}/></button>}
        <button onClick={closeWithConfirm} aria-label={t('surveyCloseAriaLabel')} className={styles.close}><X size={20}/></button>
      </header>
      {lang === 'zu' && <p className={styles.zuluDraftNotice} role="note">{t('surveyZuluDraftNotice')}</p>}
      <div className={styles.workspace}>
        {started && <nav className={styles.navigation} aria-label={t('surveySections')}>
          <span className={styles.eyebrow}>{t('surveyFieldNotebook')}</span>
            {route.map((id, index) => { const StepIcon = STEP_ICONS[id]; return <button key={id} aria-current={step === id ? 'step' : undefined} onClick={() => goTo(id)}>
            <span className={styles.stepNumber}>{index + 1}</span><StepIcon size={18}/><span>{id === 2 && mode === 'short' ? paired('surveyGrowingResources', 'Growing & resources') : id === 2 ? paired('surveyStepCurrentProduction', 'Current Production') : id === 4 ? paired('surveyStepIncomeSales', 'Income & Sales') : id === 5 ? paired('surveyStepResourcesInputs', 'Resources & Inputs') : id === 6 ? paired('stepChallenges', 'Challenges & Priorities') : STEPS[id]}</span>
          </button>; })}
          <p className={styles.navNote}><Info size={16}/>{lang === 'zu' ? <SurveyZuluDraftPair english="Answers are saved when you finish and tap Save.">{t('surveySaveReminder')}</SurveyZuluDraftPair> : t('surveySaveReminder')}</p>
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
              <h2 ref={headingRef} tabIndex={-1}>{step === 2 && mode === 'short' ? paired('surveyGrowingResources', 'Growing & resources') : step === 2 ? paired('surveyStepCurrentProduction', 'Current Production') : step === 4 ? paired('surveyStepIncomeSales', 'Income & Sales') : step === 5 ? paired('surveyStepResourcesInputs', 'Resources & Inputs') : step === 6 ? paired('stepChallenges', 'Challenges & Priorities') : step === 7 ? paired('surveyReviewTitle', 'Review your survey') : STEPS[step]}</h2>
            </div></div>
            <p className={styles.intro}>{step === 2 && lang === 'zu' ? <SurveyZuluDraftPair english="Record what you already grow. In the comprehensive survey, open only the production categories you want to record.">{tips[step]}</SurveyZuluDraftPair> : tips[step]}</p>
            {step < 7 && <details className={styles.mobileGuide}><summary><Info size={16}/>{step === 5 ? paired('surveyFieldGuide', 'Along the way') : step === 6 ? paired('surveyFieldGuide', 'Field guide') : t('surveyFieldGuide')}</summary><p>{step === 2 && lang === 'zu' ? <SurveyZuluDraftPair english="A notebook, harvest record or sales record can help. Do not add kilograms to bunches. Leave figures blank when your records do not cover a full year.">{fieldGuides[step]}</SurveyZuluDraftPair> : fieldGuides[step]}</p></details>}
            {step === 7 && missingSections.length > 0 && <div className={styles.missing}><strong>{t('surveyMissingEssentials')}</strong><p>{lang === 'zu' ? SURVEY_MISSING_HINT_ENGLISH : t('surveyMissingHint')}</p>{missingSections.map(item => <button key={item.step} onClick={() => goTo(item.step)}>{STEPS[item.step]}<ArrowRight size={16}/></button>)}</div>}
            {step === 7 && <SiteSurveyReview survey={survey} onEdit={id => goTo(mode === 'short' && (id === 3 || id === 4) ? 2 : id)} onEditProduction={() => { setMode('full'); goTo(2); }} productionLabels={PRODUCTION_ROWS} months={MONTH_LABELS}/>}
            <div className={styles.questions}>
        {/* ── Step 0: Site & Goals ── */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <SectionLabel>{paired('sectionWhoIsThisSiteFor', 'Who is this site for?')}</SectionLabel>
              <div className="space-y-2">
                <Radio label={paired('radioMeMyFamily', 'Me / my family')} desc={paired('radioMeMyFamilyDesc', 'Household homestead or smallholding')} on={siteType === 'homestead'} onClick={() => setSiteType('homestead')} />
                <Radio label={paired('radioCommunityGroup', 'Community group / cooperative')} desc={paired('radioCommunityGroupDesc', 'Shared garden, coop, or NGO site')} on={siteType === 'community'} onClick={() => setSiteType('community')} />
              </div>
            </div>

            {siteType === 'homestead' ? (
              <div>
                <SectionLabel>{paired('sectionAdultsWhoWorkThisLand', 'Adults who work this land')}</SectionLabel>
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
                <SectionLabel>{paired('sectionApproximateNumberOfMembers', 'Approximate number of members')}</SectionLabel>
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
              <SectionLabel>{paired('sectionGoalsSelectAll', 'Goals for this site (select all that apply)')}</SectionLabel>
              <div className="space-y-2">
                {[
                  { v: 'food',      label: paired('goalFoodSecurityLabel', 'Food security'),   desc: paired('goalFoodSecurityDesc', 'Feed the household or members year-round') },
                  { v: 'income',    label: paired('goalGenerateIncomeLabel', 'Generate income'), desc: paired('goalGenerateIncomeDesc', 'Sell surplus produce or value-added products') },
                  { v: 'soil',      label: paired('goalRestoreTheLandLabel', 'Restore the land'), desc: paired('goalRestoreTheLandDesc', 'Cover crops, composting, rehabilitation') },
                  { v: 'education', label: paired('goalDemonstrateTeachLabel', 'Demonstrate / teach'), desc: paired('goalDemonstrateTeachDesc', 'Training ground for others') },
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

        {/* ── Step 6: Resources & Inputs — Water ── */}
        {step === 5 && (
          <div className="space-y-5">
            <div>
              <SectionLabel>{paired('sectionWaterSources', 'Water sources available on this site (select all)')}</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'municipal',  label: paired('waterSourceMunicipalTap', 'Municipal tap') },
                  { v: 'borehole',   label: paired('waterSourceBorehole', 'Borehole') },
                  { v: 'river',      label: paired('waterSourceRiverStream', 'River / stream') },
                  { v: 'rainwater',  label: paired('waterSourceRainwater', 'Rainwater') },
                  { v: 'grey',       label: paired('waterSourceGreyWater', 'Grey water') },
                  { v: 'none',       label: paired('waterSourceNoneYet', 'No water yet') },
                ].map(o => (
                  <Chip key={o.v} label={o.label} on={waterSource.includes(o.v)} onClick={() => setWaterSource(toggle(waterSource, o.v))} color="var(--brand)" />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>{paired('sectionHowDoesWaterReachPlants', 'How does water reach the plants? (select all that apply)')}</SectionLabel>
              <div className="space-y-2">
                {[
                  { v: 'drip',       label: paired('waterDeliveryDripLabel', 'Drip irrigation'), desc: paired('waterDeliveryDripDesc', 'Lines / emitters direct to roots') },
                  { v: 'sprinkler',  label: paired('waterDeliverySprinklerLabel', 'Sprinkler'), desc: paired('waterDeliverySprinklerDesc', 'Overhead spray system') },
                  { v: 'piped',      label: paired('waterDeliveryPipedLabel', 'Piped to tap / hose'), desc: paired('waterDeliveryPipedDesc', 'Garden hose or standpipe') },
                  { v: 'gravity',    label: paired('waterDeliveryGravityLabel', 'Gravity-fed'), desc: paired('waterDeliveryGravityDesc', 'Header tank or elevated source') },
                  { v: 'bucket',     label: paired('waterDeliveryBucketLabel', 'Hand-watered'), desc: paired('waterDeliveryBucketDesc', 'Bucket / watering can') },
                  { v: 'flood',      label: paired('waterDeliveryFloodLabel', 'Flood / furrow'), desc: paired('waterDeliveryFloodDesc', 'Water runs along channels') },
                  { v: 'none',       label: paired('waterDeliveryNoneLabel', 'Rain-fed only'), desc: paired('waterDeliveryNoneDesc', 'No supplemental watering') },
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
              <SectionLabel>{paired('sectionWaterStorage', 'Water storage on site (select all)')}</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'jojo',    label: paired('waterStorageJojoTanks', 'Jojo / plastic tanks') },
                  { v: 'dam',     label: paired('waterStorageEarthDam', 'Earth dam') },
                  { v: 'pond',    label: paired('waterStoragePond', 'Pond / retention pit') },
                  { v: 'cistern', label: paired('waterStorageCistern', 'Underground cistern') },
                  { v: 'none',    label: paired('waterStorageNone', 'No storage') },
                ].map(o => (
                  <Chip key={o.v} label={o.label} on={waterStorage.includes(o.v)} onClick={() => setWaterStorage(toggle(waterStorage, o.v))} color="var(--brand)" />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 6: Resources & Inputs — Roof catchment ── */}
        {step === 5 && (
          <div className="space-y-5">
            <div style={{ background: 'rgba(35,94,134,0.06)', borderRadius: 14, padding: '12px 14px', border: '1px solid rgba(35,94,134,0.18)' }}>
              <p className="font-sans" style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
                <span className="font-semibold" style={{ color: 'var(--blue)' }}>{paired('roofCatchmentWhyMattersLabel', 'Why this matters: ')}</span>
                {paired('roofCatchmentWhyMattersText', 'Lima uses roof area to calculate how much rainwater you can harvest each year — it directly sizes your tank recommendations, swale design, and irrigation planning.')}
              </p>
            </div>

            <div>
              <SectionLabel>{paired('sectionMainBuildingRoofArea', 'Main building roof area (m²)')}</SectionLabel>
              <div className="font-sans mb-2" style={{ fontSize: 12, color: 'var(--text-2)' }}>{lang === 'zu' ? SURVEY_MAIN_ROOF_GUIDE_ENGLISH : t('roofMainBuildingGuide')}</div>
              <NumInput label={t('sectionMainBuildingRoofArea')} value={roofMain} onChange={v => { setRoofMain(v); setRoofSource('manual'); }} placeholder={t('roofMainPlaceholder')} placeholderEnglish="e.g. 100" hint={lang === 'zu' ? SURVEY_MAIN_ROOF_HINT_ENGLISH : t('roofMainHint')} />
              {roofSource === 'auto' && <AutoFillNote areaM2={roofAreaM2} english="Auto-filled from your traced shapes ({area} m²) — tap to adjust" />}
            </div>

            <div>
              <SectionLabel>{paired('sectionSecondaryRoofs', 'Secondary roofs — barn, shed, workshop (m²) — optional')}</SectionLabel>
              <NumInput label={t('sectionSecondaryRoofs')} value={roofSecondary} onChange={v => { setRoofSecondary(v); setRoofSecondarySource('manual'); }} placeholder={t('roofSecondaryPlaceholder')} placeholderEnglish="e.g. 60" hint={paired('roofSecondaryHint', 'Add areas of all other harvestable roofs')} />
              {roofSecondarySource === 'auto' && <AutoFillNote areaM2={secondaryRoofM2} english="Auto-filled from your traced shapes ({area} m²) — tap to adjust" />}
            </div>

            <Toggle label={paired('toggleGuttersLabel', 'Gutters & downpipes in place')} sub={paired('toggleGuttersSub', 'Directs rain to tanks or storage area')} ariaLabel={t('toggleGuttersLabel')} on={hasGutters} onChange={setHasGutters} />

            {totalRoof > 0 && <div className={styles.roofVisual}>
              <h3>{paired('surveyRoofEstimateTitle', 'From roof to stored water')}</h3>
              <div className={styles.roofFlow}>
                <div><Home size={30}/><strong>{numberLabel(totalRoof)} m²</strong><span>{paired('liveEstimateTotalRoofArea', 'Total roof area:')}</span></div><span aria-hidden="true">×</span>
                <div><Droplets size={30}/><strong>{rainfallMm === null ? '—' : `${numberLabel(rainfallMm)} mm`}</strong><span>{paired('surveyAnnualRainfall', 'Annual site rainfall')}</span></div><ArrowRight size={20} aria-hidden="true"/>
                <div><Droplets size={30}/><strong>{localRoofHarvest === null ? '—' : `~${numberLabel(localRoofHarvest)} kL`}</strong><span>{paired('surveyEstimatedCollection', 'Estimated collection / year')}</span></div>
              </div>
              <p>{localRoofHarvest === null ? paired('surveyRainfallMissing', 'Annual rainfall is not available in this view. The site report can use your location analysis.') : paired('surveyRoofInputs', 'Uses your entered or traced roof area and rainfall from the site analysis. Collection efficiency is an assumption: 80% with gutters, 60% without. Actual collection varies.')}</p>
            </div>}
            {totalRoof > 0 && (
              <details className={styles.workedExample}><summary>{paired('surveyRoofExample', 'See a worked example at 600 mm rainfall')}</summary><div style={{ background: 'rgba(31,77,43,0.06)', borderRadius: 14, padding: '14px 16px', border: '1px solid rgba(31,77,43,0.2)' }}>
                <div className="font-sans font-semibold mb-1" style={{ fontSize: 13, color: 'var(--brand)' }}>{paired('liveEstimateTitle', 'Live estimate')} · {paired('surveyIllustrativeOnly', 'Worked example, not your site rainfall')}</div>
                <div className="font-sans" style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  {paired('liveEstimateTotalRoofArea', 'Total roof area:')} <strong>{totalRoof} m²</strong><br />
                  {paired('liveEstimateAt600mmRain', 'At 600 mm rain →')} <strong>~{roofHarvest600} {paired('liveEstimatePerYear', 'kL/year')}</strong> ({hasGutters ? '80%' : '60%'} {paired('surveyEfficiencySuffix', 'efficiency')})<br />
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{paired('liveEstimateActualRainfallNote', "Lima will recalculate using your site's actual rainfall")}</span>
                </div>
              </div></details>
            )}
          </div>
        )}

        {/* ── Step 1: Land & Location ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <SectionLabel>{paired('sectionHowIsLandPrepared', 'How is the land prepared?')}</SectionLabel>
              <div className="space-y-2">
                {[
                  { v: 'hand',    label: paired('landPrepHandToolsLabel', 'Hand tools (spade, fork, hoe)'), desc: paired('landPrepHandToolsDesc', 'Manual soil work — limits depth and area') },
                  { v: 'tractor', label: paired('landPrepTractorLabel', 'Tractor / mechanised'), desc: paired('landPrepTractorDesc', 'Deep tillage possible, larger areas') },
                  { v: 'animal',  label: paired('landPrepAnimalLabel', 'Animal draft (ox, donkey)'), desc: paired('landPrepAnimalDesc', 'Traditional plough or cultivator') },
                  { v: 'none',    label: paired('landPrepNoneLabel', 'Not yet prepared / no-till'), desc: paired('landPrepNoneDesc', 'Starting from scratch or using no-dig method') },
                ].map(o => (
                  <Radio key={o.v} label={o.label} desc={o.desc} on={landPrep === o.v} onClick={() => setLandPrep(o.v)} />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>{paired('sectionSoilCondition', 'Soil condition (as you observe it)')}</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: 'healthy',   label: paired('soilConditionHealthy', 'Healthy & loose') },
                  { v: 'compacted', label: paired('soilConditionCompacted', 'Compacted / hard') },
                  { v: 'sandy',     label: paired('soilConditionSandy', 'Sandy / drains fast') },
                  { v: 'clay',      label: paired('soilConditionClay', 'Clay / waterlogged') },
                  { v: 'unknown',   label: paired('soilConditionUnknown', 'Not sure') },
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
              <SectionLabel>{paired('sectionSoilInputs', 'Soil inputs already applied (select all)')}</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'compost',         label: paired('soilAmendmentCompost', 'Compost') },
                  { v: 'kraal-manure',    label: paired('soilAmendmentKraalManure', 'Kraal manure') },
                  { v: 'mulch',           label: paired('soilAmendmentMulch', 'Mulch / woodchip') },
                  { v: 'commercial-fert', label: paired('soilAmendmentCommercialFert', 'Commercial fertiliser') },
                  { v: 'none',            label: paired('soilAmendmentNone', 'None yet') },
                ].map(o => (
                  <Chip key={o.v} label={o.label} on={soilAmendments.includes(o.v)} onClick={() => setSoilAmendments(toggle(soilAmendments, o.v))} />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>{paired('sectionFencing', 'Fencing')}</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'full',    label: paired('fencingFull', 'Fully fenced') },
                  { v: 'partial', label: paired('fencingPartial', 'Partly fenced') },
                  { v: 'none',    label: paired('fencingNone', 'No fencing') },
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
              <SectionLabel>{paired('sectionCropsGrowing', 'Crops already growing (select all)')}</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'vegetables',   label: paired('cropVegetables', 'Vegetables') },
                  { v: 'fruit-trees',  label: paired('cropFruitTrees', 'Fruit trees') },
                  { v: 'herbs',        label: paired('cropHerbsMedicinal', 'Herbs / medicinal') },
                  { v: 'indigenous',   label: paired('cropIndigenousPlants', 'Indigenous plants') },
                  { v: 'fodder',       label: paired('cropFodder', 'Fodder / pasture') },
                  { v: 'grain',        label: paired('cropGrainMaize', 'Grain / maize') },
                  { v: 'nothing',      label: paired('cropNothing', 'Nothing yet') },
                ].map(o => (
                  <Chip key={o.v} label={o.label} on={crops.includes(o.v)} onClick={() => setCrops(toggle(crops, o.v))} />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>{paired('surveyExistingGrowingAreaLabel', 'Area currently under cultivation')}</SectionLabel>
              <NumInput label={t('surveyExistingGrowingAreaLabel')} value={existingGrowingArea} onChange={v => { setExistingGrowingArea(v); setGrowingAreaSource('manual'); }} placeholder={t('surveyExistingGrowingAreaPlaceholder')} placeholderEnglish="e.g. 200" hint={lang === 'zu' ? <SurveyZuluDraftPair english="Rough size in square metres of what you already grow">{t('surveyExistingGrowingAreaHint')}</SurveyZuluDraftPair> : t('surveyExistingGrowingAreaHint')} />
              {growingAreaSource === 'auto' && <AutoFillNote areaM2={tracedAreas.cultivationAreaM2} />}
            </div>

            {mode === 'full' ? <div>
              <SectionLabel>{paired('surveyCurrentProductionSurveyLabel', 'Current production survey')}</SectionLabel>
              <div className="font-sans mb-3" style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45 }}>
                {lang === 'zu' ? <SurveyZuluDraftPair english="Report what you know — leave anything blank if you are not sure. This helps us measure progress over time.">{t('surveyReportWhatYouKnow')}</SurveyZuluDraftPair> : t('surveyReportWhatYouKnow')} {lang === 'zu' ? <SurveyZuluDraftPair english="Use the same year and unit for quantity, household use and sales. Income is for that same year.">{t('surveySameYearUnit')}</SurveyZuluDraftPair> : t('surveySameYearUnit')}
              </div>
              <div className="space-y-3">
                {PRODUCTION_ROWS.map(({ category, label, hint, englishLabel, englishHint }) => {
                  const row = productionRow(category);
                  const number = (value: number | null) => value === null ? '' : String(value);
                  return (
                    <div key={category} className={styles.productionCard}>
                      <button className={styles.productionSummary} aria-expanded={openProduction === category} aria-controls={`${guideId}-${category}`} onClick={() => setOpenProduction(openProduction === category ? null : category)}>
                        <Sprout size={22}/><span><strong>{lang === 'zu' ? <SurveyZuluDraftPair english={englishLabel}>{label}</SurveyZuluDraftPair> : label}</strong><small>{row.quantityPerYear !== null ? <>{row.quantityPerYear} {row.unit} · {lang === 'zu' ? <SurveyZuluDraftPair english="year">{t('surveyPerYear')}</SurveyZuluDraftPair> : t('surveyPerYear')}</> : lang === 'zu' ? <SurveyZuluDraftPair english="Optional · tap to add or review">{t('surveyOptionalRecord')}</SurveyZuluDraftPair> : t('surveyOptionalRecord')}</small></span><ChevronDown size={18}/>
                      </button>
                      {openProduction === category && <div id={`${guideId}-${category}`} className={styles.productionBody}>
                      {hint && <p>{lang === 'zu' ? <SurveyZuluDraftPair english={englishHint}>{hint}</SurveyZuluDraftPair> : hint}</p>}
                      {productionNeedsReview(row) && <p className={styles.warning} role="status">{lang === 'zu' ? <SurveyZuluDraftPair english="Check these figures: quantities need a unit, and household use plus sales cannot exceed the yearly quantity. Name an Other item before saving.">{t('surveyProductionCheck')}</SurveyZuluDraftPair> : t('surveyProductionCheck')}</p>}
                      {category === 'other' && (
                        <><input value={row.name ?? ''} onChange={(e) => patchProduction(category, { name: e.target.value })} aria-label={t('surveyWhatDoYouProducePlaceholder')} placeholder={t('surveyWhatDoYouProducePlaceholder')}
                          className="w-full font-sans mt-2" style={{ minHeight: 44, padding: '8px 10px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text)' }} />
                          {lang === 'zu' && <small>English: What do you produce?</small>}</>
                      )}
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <label className="font-sans" style={{ fontSize: 12, color: 'var(--text-2)' }}>{paired('surveyQtyPerYearLabel', 'Quantity / year')}
                          <input type="number" min="0" step="any" value={number(row.quantityPerYear)} onChange={(e) => patchProduction(category, { quantityPerYear: e.target.value === '' ? null : Number(e.target.value) })} className="w-full mt-1" style={{ minHeight: 48, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }} />
                        </label>
                        <label className="font-sans" style={{ fontSize: 12, color: 'var(--text-2)' }}>{paired('surveyUnitLabel', 'Unit')}
                          <input value={row.unit} onChange={(e) => patchProduction(category, { unit: e.target.value })} placeholder={t('surveyUnitPlaceholder')} className="w-full mt-1" style={{ minHeight: 48, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }} />
                          {lang === 'zu' && <small>English: e.g. kg, bunches</small>}
                        </label>
                        <label className="font-sans" style={{ fontSize: 12, color: 'var(--text-2)' }}>{paired('surveyUsedByHouseholdLabel', 'Used by household')}
                          <input type="number" min="0" step="any" value={number(row.usedByHousehold)} onChange={(e) => patchProduction(category, { usedByHousehold: e.target.value === '' ? null : Number(e.target.value) })} className="w-full mt-1" style={{ minHeight: 48, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }} />
                        </label>
                        <label className="font-sans" style={{ fontSize: 12, color: 'var(--text-2)' }}>{paired('surveySoldLabel', 'Sold')}
                          <input type="number" min="0" step="any" value={number(row.sold)} onChange={(e) => patchProduction(category, { sold: e.target.value === '' ? null : Number(e.target.value) })} className="w-full mt-1" style={{ minHeight: 48, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }} />
                        </label>
                      </div>
                      <label className="font-sans block mt-2" style={{ fontSize: 12, color: 'var(--text-2)' }}>{paired('surveyIncomeEarnedLabel', 'Income earned (ZAR)')}
                        <input type="number" min="0" step="any" value={number(row.incomeZar)} onChange={(e) => patchProduction(category, { incomeZar: e.target.value === '' ? null : Number(e.target.value) })} className="w-full mt-1" style={{ minHeight: 48, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }} />
                      </label>
                      <div className="mt-3">
                        <div className="font-sans" style={{ fontSize: 12, color: 'var(--text-2)' }}>{paired('surveyHarvestMonthsLabel', 'Harvest months')}</div>
                        <div className="grid grid-cols-4 gap-1 mt-1">
                          {MONTH_LABELS.map((month, index) => {
                            const monthNumber = index + 1;
                            const selected = row.harvestMonths?.includes(monthNumber) ?? false;
                            return <button key={month} type="button" aria-pressed={selected} onClick={() => patchProduction(category, {
                              harvestMonths: selected
                                ? (row.harvestMonths ?? []).filter((value) => value !== monthNumber)
                                : [...(row.harvestMonths ?? []), monthNumber].sort((a, b) => a - b),
                            })} className="font-sans" style={{ minHeight: 48, borderRadius: 8, border: `1px solid ${selected ? 'var(--brand)' : 'var(--border)'}`, background: selected ? 'var(--brand)' : 'var(--surface)', color: selected ? 'var(--survey-on-brand)' : 'var(--text-2)', fontSize: 12 }}>{lang === 'zu' ? <SurveyZuluDraftPair english={MONTH_ENGLISH[index]}>{month}</SurveyZuluDraftPair> : month}</button>;
                          })}
                        </div>
                      </div>
                      {AMBIGUOUS_FOOD_GROUP_CATEGORIES.has(category) && (
                        <label className="font-sans block mt-2" style={{ fontSize: 12, color: 'var(--text-2)' }}>{paired('surveyFaoFoodGroupLabel', 'FAO food group')}
                          <select value={row.foodGroup ?? ''} onChange={(e) => patchProduction(category, { foodGroup: (e.target.value || undefined) as HddsFoodGroup | undefined })} className="w-full mt-1" style={{ minHeight: 48, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}>
                            <option value="">{lang === 'zu' ? `${t('surveyFoodGroupNotSure')} (English: Not sure)` : t('surveyFoodGroupNotSure')}</option>
                            {Object.entries(HDDS_LABELS).map(([value, group]) => <option key={value} value={value}>{lang === 'zu' ? `${group} (English: ${HDDS_ENGLISH[value as HddsFoodGroup]})` : group}</option>)}
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
                  ? <><strong>{lang === 'zu' ? <SurveyZuluDraftPair english={`${reportedGroups.length} food groups reported.`}>{t('surveyFoodGroupsReportedCount').replace('{n}', String(reportedGroups.length))}</SurveyZuluDraftPair> : t('surveyFoodGroupsReportedCount').replace('{n}', String(reportedGroups.length))}</strong> </>
                  : <><strong>{lang === 'zu' ? <SurveyZuluDraftPair english="No food groups reported yet.">{t('surveyFoodGroupsNotReported')}</SurveyZuluDraftPair> : t('surveyFoodGroupsNotReported')}</strong> </>}
                {lang === 'zu' ? <SurveyZuluDraftPair english="These groups describe your production. They do not measure what your household ate or give a nutrition score.">{t('surveyFaoHddsFooter')}</SurveyZuluDraftPair> : t('surveyFaoHddsFooter')}
              </div>
            </div> : <button className={styles.detailLink} onClick={() => setMode('full')}><NotebookPen size={20}/><span><strong>{t('surveyAddProduction')}</strong><small>{t('surveyAddProductionHint')}</small></span><ArrowRight size={18}/></button>}


          </div>
        )}

        {/* ── Step 3: Livestock & Poultry ── */}
        {(step === 3 || (step === 2 && mode === 'short')) && (
          <div className="space-y-5">
            <div>
              <SectionLabel>{paired('sectionLivestock', 'Livestock on site (select all)')}</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'chickens', label: paired('livestockChickens', 'Chickens / poultry') },
                  { v: 'goats',    label: paired('livestockGoats', 'Goats') },
                  { v: 'cattle',   label: paired('livestockCattle', 'Cattle') },
                  { v: 'pigs',     label: paired('livestockPigs', 'Pigs') },
                  { v: 'bees',     label: paired('livestockBees', 'Bees') },
                  { v: 'none',     label: paired('livestockNone', 'No livestock') },
                ].map(o => (
                  <Chip key={o.v} label={o.label} on={livestock.includes(o.v)} onClick={() => setLivestock(toggle(livestock, o.v))} color="var(--brand)" />
                ))}
              </div>
            </div>
            <div>
              <SectionLabel>{paired('sectionOtherInfrastructure', 'Other infrastructure (select all)')}</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'shade-tunnel', label: paired('infraShadeTunnel', 'Shade tunnel') },
                  { v: 'greenhouse',   label: paired('infraGreenhouse', 'Greenhouse / polytunnel') },
                  { v: 'compost-bay',  label: paired('infraCompostBay', 'Compost bay') },
                  { v: 'shed',         label: paired('infraStorageShed', 'Storage shed') },
                  { v: 'kraal',        label: paired('infraLivestockKraal', 'Livestock kraal') },
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
            <Toggle label={paired('toggleSellProduceLabel', 'We sell or plan to sell produce')} sub={paired('surveyToggleSellProduceSub', 'Your production rows can record what was sold and income earned')} ariaLabel={t('toggleSellProduceLabel')} on={isCommercial} onChange={setIsCommercial} />
            {isCommercial && (
              <div>
                <SectionLabel>{paired('sectionCurrentOrTargetMarket', 'Current or target market')}</SectionLabel>
                <div className="space-y-2">
                  {[
                    { v: 'farm-stall',    label: paired('marketFarmStall', 'On-site farm stall') },
                    { v: 'local-market',  label: paired('marketLocalCommunity', 'Local community / informal market') },
                    { v: 'wholesale',     label: paired('marketWholesale', 'Wholesale / bulk buyers') },
                    { v: 'not-sure',      label: paired('marketNotSure', 'Not sure yet') },
                  ].map(o => (
                    <Radio key={o.v} label={o.label} on={marketType === o.v} onClick={() => setMarketType(o.v)} />
                  ))}
                </div>
              </div>
            )}
            <div className="font-sans" style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(31,77,43,0.06)', color: 'var(--text-2)', fontSize: 12.5, lineHeight: 1.5 }}>
              {paired('surveyIncomeSalesNote', 'You can record what was sold and income earned against each item in the Current Production step.')}
            </div>
          </div>
        )}

        {/* ── Step 6: Challenges & Notes ── */}
        {step === 6 && (
          <div className="space-y-5">
            <div>
              <SectionLabel>{paired('sectionFarmingApproach', 'Farming approach')}</SectionLabel>
              <div className="space-y-2">
                {[
                  { v: 'organic',        label: paired('practiceFullyOrganicLabel', 'Fully organic'),        desc: paired('practiceFullyOrganicDesc', 'No synthetic inputs, composting-based') },
                  { v: 'mostly-organic', label: paired('practiceMostlyOrganicLabel', 'Mostly organic'),        desc: paired('practiceMostlyOrganicDesc', 'Organic where possible, occasional exceptions') },
                  { v: 'conventional',   label: paired('practiceConventionalLabel', 'Conventional'),         desc: paired('practiceConventionalDesc', 'Synthetic fertilisers and pesticides used') },
                  { v: 'experimenting',  label: paired('practiceExperimentingLabel', 'Experimenting / mixed'),        desc: paired('practiceExperimentingDesc', 'Trying different methods, not set yet') },
                ].map(o => (
                  <Radio key={o.v} label={o.label} desc={o.desc} on={practice === o.v} onClick={() => setPractice(o.v)} />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>{paired('sectionMainChallenges', 'Main challenges on this site (select at least one)')}</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'drought',    label: paired('challengeDrought', 'Drought / dry spells') },
                  { v: 'pests',      label: paired('challengePests', 'Pests & disease') },
                  { v: 'soil',       label: paired('challengePoorSoil', 'Poor / degraded soil') },
                  { v: 'water',      label: paired('challengeLimitedWater', 'Limited water access') },
                  { v: 'funding',    label: paired('challengeFunding', 'Funding / costs') },
                  { v: 'labour',     label: paired('challengeLabour', 'Not enough labour') },
                  { v: 'flooding',   label: paired('challengeFlooding', 'Flooding / erosion') },
                  { v: 'market',     label: paired('challengeMarket', 'Market access') },
                  { v: 'none',       label: paired('challengeNone', 'No major challenges') },
                ].map(o => (
                  <Chip key={o.v} label={o.label} on={challenges.includes(o.v)} onClick={() => setChallenges(toggle(challenges, o.v))} color="var(--brand)" />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>{paired('sectionAnythingElseLimaShouldKnow', 'Anything else Lima should know?')}</SectionLabel>
              <div className="font-sans mb-2" style={{ fontSize: 12, color: 'var(--text-2)' }}>
                {paired('notesPlaceholderHint', 'Unique site features, history, things you\'ve tried, specific concerns…')}
              </div>
              <div style={{ background: 'rgba(31,77,43,0.05)', borderRadius: 11, padding: '4px', border: '1px solid rgba(31,77,43,0.15)', marginBottom: 8 }}>
                <div className="font-sans flex items-center gap-1.5" style={{ fontSize: 12, color: 'var(--brand)', padding: '6px 10px' }}>
                  <Camera size={14} aria-hidden />
                  {lang === 'zu' ? 'Tip: photos of soil, slope, problem areas, and existing crops help Lima give far more specific advice — add them via the camera button on the map.' : t('photoTip')}
                </div>
              </div>
              <textarea aria-label={t('sectionAnythingElseLimaShouldKnow')} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={lang === 'zu' ? 'e.g. North slope gets afternoon shade from the ridge. We had a tree removed and the soil there is very hard…' : t('notesPlaceholder')}
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
            <h3>{step === 5 ? paired('surveyObserveFirst', 'Look, then record.') : t('surveyObserveFirst')}</h3><p>{fieldGuides[step]}</p>
            <div className={styles.recordOverview}><strong>{t('surveyRecordOverview')}</strong>
              {[{label:t('surveyGoalsSelected'), value:goals.length}, {label:t('surveyProductionEntries'),value:survey.reportedProduction?.length ?? 0}].map(item => <div key={item.label}><span>{item.label}</span><b>{item.value}</b></div>)}
            </div>
            <p className={styles.smallNote}>{lang === 'zu'
              ? <SurveyZuluDraftPair english="Leave a question blank if you are not sure. An unknown is more useful than a guess.">{t('surveyUnknownHint')}</SurveyZuluDraftPair>
              : t('surveyUnknownHint')}</p>
            {existing && <p className={styles.smallNote}>{lang === 'zu'
              ? <SurveyZuluDraftPair english="You are updating your existing survey. Earlier details stay here when you switch routes.">{t('surveyEditingExisting')}</SurveyZuluDraftPair>
              : t('surveyEditingExisting')}</p>}
          </aside>
        </div>}
        </div>
      </div>

      <footer className={styles.footer}>
        {!started && <div className={styles.footerInner}><span className={styles.saveReminder}>{t('surveySwitchHint')}</span><button className={styles.primary} onClick={() => { if (!route.includes(step)) setStep(2); setStarted(true); }}>{dirty || existing ? t('surveyContinue') : t('surveyBegin')}<ArrowRight size={18}/></button></div>}
        {saveError && <p role="alert" className={styles.warning}>{lang === 'zu' ? <SurveyZuluDraftPair english="Your survey could not be saved. Keep this screen open and try again.">{t('surveySaveError')}</SurveyZuluDraftPair> : t('surveySaveError')}</p>}
        {started && (invalidArea || invalidProduction.length > 0) && <p role="alert" className={styles.warning}>{lang === 'zu' ? <SurveyZuluDraftPair english="Check the production entries and areas before saving. Use positive numbers or zero; leave unknowns blank.">{t('surveyFixBeforeSave')}</SurveyZuluDraftPair> : t('surveyFixBeforeSave')}</p>}
        {started && <div className={styles.footerInner}>
          <button className={styles.back} onClick={() => routeIndex > 0 ? goTo(route[routeIndex - 1]) : setStarted(false)}><ChevronLeft size={17}/>{t('buttonBack')}</button>
          <span className={styles.saveReminder}>{lang === 'zu' ? dirty ? <SurveyZuluDraftPair english="Changes not yet saved">{t('surveyUnsaved')}</SurveyZuluDraftPair> : <SurveyZuluDraftPair english="Answers are saved when you finish and tap Save.">{t('surveySaveReminder')}</SurveyZuluDraftPair> : dirty ? t('surveyUnsaved') : t('surveySaveReminder')}</span>
          <button className={styles.primary} disabled={step === 7 && !canSave} onClick={() => step === 7 ? handleSave() : goTo(route[routeIndex + 1])}>
            {step === 7 ? <><Check size={18}/>{lang === 'zu' ? <SurveyZuluDraftPair english="Save & continue">{t('surveySaveContinue')}</SurveyZuluDraftPair> : t('surveySaveContinue')}</> : <>{step === 6 ? paired('surveyReviewTitle', 'Review your survey') : t('buttonNext')}<ChevronRight size={18}/></>}
          </button>
        </div>}
      </footer>
    </div>
  ), document.body);
}

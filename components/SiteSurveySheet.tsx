'use client';
import { useState, useCallback, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Users, Droplets, Home, Leaf, AlertTriangle, FileText, Sparkles } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import {
  saveSurvey,
  loadSurvey,
  reportedFoodGroups,
  type HddsFoodGroup,
  type ProductionCategory,
  type ReportedProduction,
  type SiteSurvey,
} from '@/lib/site-survey';
import { loadPlaces } from '@/lib/saved-places';
import { designSiteIdFromLocation, computeTracedAreaTotals } from '@/lib/design-studio';
import { loadCanvasState } from '@/lib/design-canvas';
import { studioRoofAreasM2, surveyRoofAreaM2 } from '@/lib/studio-traced-areas';
import type { LocationData } from '@/lib/types';

interface Props {
  placeId: string;
  /** The current pin's coords — when provided, the survey is keyed by these (matching the
   *  completion score / design / crop stores) instead of the place lookup, so a survey
   *  filled on a freshly-saved pin lands under the same key it's read back from. */
  coords?: { lat: number; lon: number } | null;
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
const STEP_ICONS = [Users, Leaf, Leaf, Users, FileText, Droplets, AlertTriangle];

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
  return arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
}

function Chip({ label, on, onClick, color = '#1F4D2B' }: { label: string; on: boolean; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick}
      className="font-sans font-semibold transition-all"
      style={{ padding: '8px 16px', borderRadius: 999, fontSize: 13.5, cursor: 'pointer',
        background: on ? color : 'rgba(226,216,196,0.5)',
        color: on ? '#fff' : '#5C5040',
        border: `1px solid ${on ? color : '#E2D8C4'}` }}>
      {label}
    </button>
  );
}

function Radio({ label, desc, on, onClick }: { label: string; desc?: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-start gap-3 text-left transition-all"
      style={{ padding: '10px 14px', borderRadius: 12,
        background: on ? 'rgba(31,77,43,0.08)' : 'rgba(226,216,196,0.3)',
        border: `1.5px solid ${on ? '#1F4D2B' : '#E2D8C4'}`, cursor: 'pointer' }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${on ? '#1F4D2B' : '#C4B89C'}`,
        background: on ? '#1F4D2B' : 'transparent', flexShrink: 0, marginTop: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {on && <Check size={11} style={{ color: '#fff' }} />}
      </div>
      <div>
        <div className="font-sans font-semibold" style={{ fontSize: 13.5, color: '#20190F' }}>{label}</div>
        {desc && <div className="font-sans" style={{ fontSize: 12, color: '#8C7A62' }}>{desc}</div>}
      </div>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="font-sans font-semibold mb-2" style={{ fontSize: 13, color: '#5C5040' }}>{children}</div>;
}

function Toggle({ label, sub, on, onChange }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between" style={{ background: 'rgba(226,216,196,0.3)', borderRadius: 12, padding: '12px 14px', border: '1px solid #E2D8C4' }}>
      <div>
        <div className="font-sans font-semibold" style={{ fontSize: 13.5, color: '#20190F' }}>{label}</div>
        {sub && <div className="font-sans" style={{ fontSize: 12, color: '#8C7A62' }}>{sub}</div>}
      </div>
      <button onClick={() => onChange(!on)} role="switch" aria-checked={on} aria-label={label} className="flex items-center rounded-full transition-all flex-shrink-0"
        style={{ width: 44, height: 26, padding: 3, background: on ? '#1F4D2B' : 'rgba(32,25,15,0.15)',
          justifyContent: on ? 'flex-end' : 'flex-start', border: 'none', cursor: 'pointer' }}>
        <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  );
}

function NumInput({ value, onChange, placeholder, hint }: { value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) {
  const { t } = useLanguage();
  return (
    <>
      <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? t('surveyNumInputDefaultPlaceholder')}
        className="w-full font-sans"
        style={{ padding: '10px 14px', borderRadius: 11, background: '#FFFEFA', border: '1px solid #E2D8C4', fontSize: 14, color: '#20190F', outline: 'none' }} />
      {hint && <div className="font-sans mt-1" style={{ fontSize: 12, color: '#94876F' }}>{hint}</div>}
    </>
  );
}

function AutoFillNote({ areaM2 }: { areaM2: number }) {
  const { t } = useLanguage();
  return (
    <div className="font-sans flex items-center gap-1.5 mt-1.5" style={{ fontSize: 12, color: '#1F4D2B' }}>
      <Sparkles size={12} />
      {t('surveyAutoFillNote').replace('{area}', String(Math.round(areaM2)))}
    </div>
  );
}

export default function SiteSurveySheet({ placeId, coords, onSaved, onClose }: Props) {
  const { t } = useLanguage();
  const STEPS = surveySteps(t);
  const PRODUCTION_ROWS = productionRows(t);
  const HDDS_LABELS = hddsLabels(t);
  const MONTH_LABELS = monthLabels(t);

  const place = loadPlaces().find(p => p.id === placeId);
  // Prefer the live pin's coords (per-site canonical key); fall back to the place lookup.
  const siteLoc = coords ?? (place ? { lat: place.lat, lon: place.lon } : null);
  const siteId = designSiteIdFromLocation(siteLoc ? ({ lat: siteLoc.lat, lon: siteLoc.lon } as LocationData) : null);
  const existing = loadSurvey(siteId);
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
    existing?.existingGrowingAreaSource === 'manual' ? 'manual' : (tracedAreas.cultivationAreaM2 > 0 ? 'auto' : undefined)
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
  const reportedGroups = reportedFoodGroups(reportedProduction);

  const canNext = [
    siteType && goals.length > 0,  // step 0
    !!landPrep && !!soilCondition,  // step 1
    true,  // step 2 — reported production is optional
    true,  // step 3 — livestock is optional
    true,  // step 4 — income and sales are optional
    waterSource.length > 0 && waterDelivery.length > 0,  // step 5
    !!practice && challenges.length > 0,  // step 6
  ][step];

  const handleSave = useCallback(() => {
    const survey: SiteSurvey = {
      siteId,
      placeId,
      savedAt: new Date().toISOString(),
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
    const saved = saveSurvey(survey);
    if (saved) onSaved(saved);
  }, [siteId, placeId, siteType, adults, memberCount, goals, waterSource, waterDelivery, waterStorage, roofMain, roofSecondary, roofSource, hasGutters, landPrep, soilCondition, soilAmendments, fencing, crops, existingGrowingArea, growingAreaSource, livestock, otherInfra, practice, challenges, isCommercial, marketType, reportedProduction, notes, onSaved]);

  // Close on Escape — matches every other full-screen sheet in the app (AddSheet, ThemePanel, etc).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const Icon = STEP_ICONS[step];

  // Nothing is saved to storage until the final "Save & generate report" tap — this whole
  // 7-step questionnaire lives in component state only. Reaching step > 0 means the farmer
  // has already cleared step 0's required fields and answered "Next" at least once, so an
  // X tap past that point is real, unsaved work — confirm before throwing it away, the same
  // way app/design/page.tsx and app/facilitator/crops/page.tsx guard their own data loss.
  const closeWithConfirm = useCallback(() => {
    if (step > 0 && !window.confirm(t('surveyDiscardConfirm'))) return;
    onClose();
  }, [step, onClose, t]);

  return (
    // Full-screen step wizard (fixed inset-0, no viewport margin) rather than a partial-height
    // bottom sheet — u-anim-sheet still gives it a settle-in entrance; deliberately no grabber
    // or rounded top corners here, since this view has no drag-to-dismiss gesture and rounding
    // edge-to-edge corners wouldn't render as anything visible. Close stays the explicit X below.
    <div role="dialog" aria-modal="true" aria-label={t('siteQuestionnaireTitle')} className="fixed inset-0 z-50 flex flex-col u-anim-sheet" style={{ background: '#E4DCC6' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 flex-shrink-0" style={{ height: 60, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}>
        <button onClick={closeWithConfirm} aria-label={t('surveyCloseAriaLabel')}
          style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(32,25,15,0.06)', border: '1px solid #E2D8C4', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5C5040', flexShrink: 0 }}>
          <X size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-display font-semibold" style={{ fontSize: 16, color: '#20190F' }}>{t('siteQuestionnaireTitle')}</div>
          {place && <div className="font-sans" style={{ fontSize: 12, color: '#94876F' }}>{place.name}</div>}
        </div>
        <div className="font-sans" style={{ fontSize: 12, color: '#94876F', flexShrink: 0 }}>{t('stepOfSteps').replace('{n}', String(step + 1)).replace('{total}', String(STEPS.length))}</div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: '#E2D8C4', flexShrink: 0 }}>
        <div style={{ height: 3, background: '#1F4D2B', width: `${((step + 1) / STEPS.length) * 100}%`, transition: 'width 0.3s' }} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '24px 20px 120px' }}>
        <div className="flex items-center gap-2 mb-6">
          <div style={{ width: 36, height: 36, borderRadius: 11, background: '#1F4D2B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={18} style={{ color: '#A8D88A' }} />
          </div>
          <h2 className="font-display font-semibold" style={{ fontSize: 20, color: '#20190F' }}>{STEPS[step]}</h2>
        </div>

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
                    { v: '2–5', label: t('surveyAdultsChipRange2to5') },
                    { v: '6–10', label: t('surveyAdultsChipRange6to10') },
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
                  <button key={o.v} onClick={() => setGoals(toggle(goals, o.v))}
                    className="w-full flex items-start gap-3 text-left transition-all"
                    style={{ padding: '10px 14px', borderRadius: 12,
                      background: goals.includes(o.v) ? 'rgba(31,77,43,0.08)' : 'rgba(226,216,196,0.3)',
                      border: `1.5px solid ${goals.includes(o.v) ? '#1F4D2B' : '#E2D8C4'}`, cursor: 'pointer' }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${goals.includes(o.v) ? '#1F4D2B' : '#C4B89C'}`,
                      background: goals.includes(o.v) ? '#1F4D2B' : 'transparent', flexShrink: 0, marginTop: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {goals.includes(o.v) && <Check size={11} style={{ color: '#fff' }} />}
                    </div>
                    <div>
                      <div className="font-sans font-semibold" style={{ fontSize: 13.5, color: '#20190F' }}>{o.label}</div>
                      <div className="font-sans" style={{ fontSize: 12, color: '#8C7A62' }}>{o.desc}</div>
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
                  <Chip key={o.v} label={o.label} on={waterSource.includes(o.v)} onClick={() => setWaterSource(toggle(waterSource, o.v))} color="#235E86" />
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
                      prev.includes(o.v) ? prev.filter(x => x !== o.v) : [...prev, o.v]
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
                  <Chip key={o.v} label={o.label} on={waterStorage.includes(o.v)} onClick={() => setWaterStorage(toggle(waterStorage, o.v))} color="#235E86" />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 5: Resources & Inputs — Roof catchment ── */}
        {step === 5 && (
          <div className="space-y-5">
            <div style={{ background: 'rgba(35,94,134,0.06)', borderRadius: 14, padding: '12px 14px', border: '1px solid rgba(35,94,134,0.18)' }}>
              <p className="font-sans" style={{ fontSize: 12.5, color: '#4A3F2E', lineHeight: 1.5 }}>
                <span className="font-semibold" style={{ color: '#235E86' }}>{t('roofCatchmentWhyMattersLabel')}</span>
                {t('roofCatchmentWhyMattersText')}
              </p>
            </div>

            <div>
              <SectionLabel>{t('sectionMainBuildingRoofArea')}</SectionLabel>
              <div className="font-sans mb-2" style={{ fontSize: 12, color: '#8C7A62' }}>{t('roofMainBuildingGuide')}</div>
              <NumInput value={roofMain} onChange={v => { setRoofMain(v); setRoofSource('manual'); }} placeholder={t('roofMainPlaceholder')} hint={t('roofMainHint')} />
              {roofSource === 'auto' && <AutoFillNote areaM2={roofAreaM2} />}
            </div>

            <div>
              <SectionLabel>{t('sectionSecondaryRoofs')}</SectionLabel>
              <NumInput value={roofSecondary} onChange={v => { setRoofSecondary(v); setRoofSecondarySource('manual'); }} placeholder={t('roofSecondaryPlaceholder')} hint={t('roofSecondaryHint')} />
              {roofSecondarySource === 'auto' && <AutoFillNote areaM2={secondaryRoofM2} />}
            </div>

            <Toggle label={t('toggleGuttersLabel')} sub={t('toggleGuttersSub')} on={hasGutters} onChange={setHasGutters} />

            {totalRoof > 0 && (
              <div style={{ background: 'rgba(31,77,43,0.06)', borderRadius: 14, padding: '14px 16px', border: '1px solid rgba(31,77,43,0.2)' }}>
                <div className="font-sans font-semibold mb-1" style={{ fontSize: 13, color: '#1F4D2B' }}>{t('liveEstimateTitle')}</div>
                <div className="font-sans" style={{ fontSize: 13, color: '#4A3F2E', lineHeight: 1.6 }}>
                  {t('liveEstimateTotalRoofArea')} <strong>{totalRoof} m²</strong><br />
                  {t('liveEstimateAt600mmRain')} <strong>~{roofHarvest600} {t('liveEstimatePerYear')}</strong> ({hasGutters ? '80%' : '60%'} {t('surveyEfficiencySuffix')})<br />
                  <span style={{ fontSize: 11.5, color: '#8C7A62' }}>{t('liveEstimateActualRainfallNote')}</span>
                </div>
              </div>
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
                  <button key={o.v} onClick={() => setSoilCondition(o.v)}
                    className="font-sans font-semibold transition-all"
                    style={{ padding: '9px 12px', borderRadius: 11, fontSize: 13, cursor: 'pointer',
                      background: soilCondition === o.v ? '#1F4D2B' : 'rgba(226,216,196,0.5)',
                      color: soilCondition === o.v ? '#fff' : '#5C5040',
                      border: `1px solid ${soilCondition === o.v ? '#1F4D2B' : '#E2D8C4'}` }}>
                    {o.label}
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
              <NumInput value={existingGrowingArea} onChange={v => { setExistingGrowingArea(v); setGrowingAreaSource('manual'); }} placeholder={t('surveyExistingGrowingAreaPlaceholder')} hint={t('surveyExistingGrowingAreaHint')} />
              {growingAreaSource === 'auto' && <AutoFillNote areaM2={tracedAreas.cultivationAreaM2} />}
            </div>

            <div>
              <SectionLabel>{t('surveyCurrentProductionSurveyLabel')}</SectionLabel>
              <div className="font-sans mb-3" style={{ fontSize: 12, color: '#8C7A62', lineHeight: 1.45 }}>
                {t('surveyReportWhatYouKnow')}
              </div>
              <div className="space-y-3">
                {PRODUCTION_ROWS.map(({ category, label, hint }) => {
                  const row = productionRow(category);
                  const number = (value: number | null) => value === null ? '' : String(value);
                  return (
                    <div key={category} style={{ padding: '12px', borderRadius: 12, background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
                      <div className="font-sans font-semibold" style={{ fontSize: 13.5, color: '#20190F' }}>{label}</div>
                      {hint && <div className="font-sans mt-0.5" style={{ fontSize: 11.5, color: '#8C7A62' }}>{hint}</div>}
                      {category === 'other' && (
                        <input value={row.name ?? ''} onChange={(e) => patchProduction(category, { name: e.target.value })} placeholder={t('surveyWhatDoYouProducePlaceholder')}
                          className="w-full font-sans mt-2" style={{ minHeight: 44, padding: '8px 10px', borderRadius: 9, background: '#FFFEFA', border: '1px solid #E2D8C4', fontSize: 13, color: '#20190F' }} />
                      )}
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <label className="font-sans" style={{ fontSize: 11.5, color: '#5C5040' }}>{t('surveyQtyPerYearLabel')}
                          <input type="number" min="0" value={number(row.quantityPerYear)} onChange={(e) => patchProduction(category, { quantityPerYear: e.target.value === '' ? null : Number(e.target.value) })} className="w-full mt-1" style={{ minHeight: 40, padding: '6px 8px', borderRadius: 8, border: '1px solid #E2D8C4', background: '#FFFEFA' }} />
                        </label>
                        <label className="font-sans" style={{ fontSize: 11.5, color: '#5C5040' }}>{t('surveyUnitLabel')}
                          <input value={row.unit} onChange={(e) => patchProduction(category, { unit: e.target.value })} placeholder={t('surveyUnitPlaceholder')} className="w-full mt-1" style={{ minHeight: 40, padding: '6px 8px', borderRadius: 8, border: '1px solid #E2D8C4', background: '#FFFEFA' }} />
                        </label>
                        <label className="font-sans" style={{ fontSize: 11.5, color: '#5C5040' }}>{t('surveyUsedByHouseholdLabel')}
                          <input type="number" min="0" value={number(row.usedByHousehold)} onChange={(e) => patchProduction(category, { usedByHousehold: e.target.value === '' ? null : Number(e.target.value) })} className="w-full mt-1" style={{ minHeight: 40, padding: '6px 8px', borderRadius: 8, border: '1px solid #E2D8C4', background: '#FFFEFA' }} />
                        </label>
                        <label className="font-sans" style={{ fontSize: 11.5, color: '#5C5040' }}>{t('surveySoldLabel')}
                          <input type="number" min="0" value={number(row.sold)} onChange={(e) => patchProduction(category, { sold: e.target.value === '' ? null : Number(e.target.value) })} className="w-full mt-1" style={{ minHeight: 40, padding: '6px 8px', borderRadius: 8, border: '1px solid #E2D8C4', background: '#FFFEFA' }} />
                        </label>
                      </div>
                      <label className="font-sans block mt-2" style={{ fontSize: 11.5, color: '#5C5040' }}>{t('surveyIncomeEarnedLabel')}
                        <input type="number" min="0" value={number(row.incomeZar)} onChange={(e) => patchProduction(category, { incomeZar: e.target.value === '' ? null : Number(e.target.value) })} className="w-full mt-1" style={{ minHeight: 40, padding: '6px 8px', borderRadius: 8, border: '1px solid #E2D8C4', background: '#FFFEFA' }} />
                      </label>
                      <div className="mt-3">
                        <div className="font-sans" style={{ fontSize: 11.5, color: '#5C5040' }}>{t('surveyHarvestMonthsLabel')}</div>
                        <div className="grid grid-cols-4 gap-1 mt-1">
                          {MONTH_LABELS.map((month, index) => {
                            const monthNumber = index + 1;
                            const selected = row.harvestMonths?.includes(monthNumber) ?? false;
                            return <button key={month} type="button" onClick={() => patchProduction(category, {
                              harvestMonths: selected
                                ? (row.harvestMonths ?? []).filter((value) => value !== monthNumber)
                                : [...(row.harvestMonths ?? []), monthNumber].sort((a, b) => a - b),
                            })} className="font-sans" style={{ minHeight: 40, borderRadius: 8, border: `1px solid ${selected ? '#1F4D2B' : '#E2D8C4'}`, background: selected ? '#1F4D2B' : '#FFFEFA', color: selected ? '#FFFEFA' : '#5C5040', fontSize: 11.5 }}>{month}</button>;
                          })}
                        </div>
                      </div>
                      {AMBIGUOUS_FOOD_GROUP_CATEGORIES.has(category) && (
                        <label className="font-sans block mt-2" style={{ fontSize: 11.5, color: '#5C5040' }}>{t('surveyFaoFoodGroupLabel')}
                          <select value={row.foodGroup ?? ''} onChange={(e) => patchProduction(category, { foodGroup: (e.target.value || undefined) as HddsFoodGroup | undefined })} className="w-full mt-1" style={{ minHeight: 40, padding: '6px 8px', borderRadius: 8, border: '1px solid #E2D8C4', background: '#FFFEFA' }}>
                            <option value="">{t('surveyFoodGroupNotSure')}</option>
                            {Object.entries(HDDS_LABELS).map(([value, group]) => <option key={value} value={value}>{group}</option>)}
                          </select>
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="font-sans mt-3" style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(31,77,43,0.06)', color: '#1F4D2B', fontSize: 12.5, lineHeight: 1.45 }}>
                {reportedGroups.length > 0
                  ? <><strong>{t('surveyFoodGroupsReportedCount').replace('{n}', String(reportedGroups.length))}</strong> </>
                  : <><strong>{t('surveyFoodGroupsNotReported')}</strong> </>}
                {t('surveyFaoHddsFooter')}
              </div>
            </div>

          </div>
        )}

        {/* ── Step 3: Livestock & Poultry ── */}
        {step === 3 && (
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
                  <Chip key={o.v} label={o.label} on={livestock.includes(o.v)} onClick={() => setLivestock(toggle(livestock, o.v))} color="#C07A1E" />
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
        {step === 4 && (
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
            <div className="font-sans" style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(31,77,43,0.06)', color: '#4A3F2E', fontSize: 12.5, lineHeight: 1.5 }}>
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
                  <Chip key={o.v} label={o.label} on={challenges.includes(o.v)} onClick={() => setChallenges(toggle(challenges, o.v))} color="#C07A1E" />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>{t('sectionAnythingElseLimaShouldKnow')}</SectionLabel>
              <div className="font-sans mb-2" style={{ fontSize: 12, color: '#8C7A62' }}>
                {t('notesPlaceholderHint')}
              </div>
              <div style={{ background: 'rgba(31,77,43,0.05)', borderRadius: 11, padding: '4px', border: '1px solid rgba(31,77,43,0.15)', marginBottom: 8 }}>
                <div className="font-sans" style={{ fontSize: 11.5, color: '#1F4D2B', padding: '6px 10px' }}>
                  📷 {t('photoTip')}
                </div>
              </div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={t('notesPlaceholder')}
                rows={4} className="w-full font-sans"
                style={{ padding: '10px 14px', borderRadius: 11, background: '#FFFEFA', border: '1px solid #E2D8C4', fontSize: 14, color: '#20190F', outline: 'none', resize: 'none', lineHeight: 1.5 }} />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-3 flex-shrink-0"
        style={{ padding: '14px 20px', paddingBottom: 'calc(14px + env(safe-area-inset-bottom))', background: '#FFFEFA', borderTop: '1px solid #E2D8C4' }}>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)}
            className="flex items-center gap-1.5 font-sans font-semibold transition-all"
            style={{ padding: '0 18px', height: 46, borderRadius: 13, background: 'rgba(226,216,196,0.4)', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer', flexShrink: 0 }}>
            <ChevronLeft size={16} /> {t('buttonBack')}
          </button>
        )}
        <button
          onClick={() => { if (step < STEPS.length - 1) setStep(s => s + 1); else handleSave(); }}
          disabled={!canNext}
          className="flex-1 flex items-center justify-center gap-2 font-sans font-bold transition-all"
          style={{ height: 46, borderRadius: 13, background: canNext ? '#1F4D2B' : 'rgba(32,25,15,0.1)',
            color: canNext ? '#F7F2E9' : 'rgba(32,25,15,0.3)', border: 'none', fontSize: 15,
            cursor: canNext ? 'pointer' : 'default' }}>
          {step < STEPS.length - 1
            ? <><span>{t('buttonNext')}</span><ChevronRight size={16} /></>
            : <><Check size={16} /><span>{t('buttonSaveAndGenerateReport')}</span></>}
        </button>
      </div>
    </div>
  );
}

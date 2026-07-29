'use client';
import { useState, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Users, Droplets, Home, Leaf, AlertTriangle, FileText, Sparkles } from 'lucide-react';
import { saveSurvey, loadSurvey, type SiteSurvey } from '@/lib/site-survey';
import { loadPlaces } from '@/lib/saved-places';
import { designSiteIdFromLocation, computeTracedAreaTotals } from '@/lib/design-studio';
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

const STEPS = ['Site & Goals', 'Water', 'Roof Catchment', 'Land & Soil', "What Exists", 'Challenges'];
const STEP_ICONS = [Users, Droplets, Home, Leaf, Leaf, AlertTriangle];

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
      <button onClick={() => onChange(!on)} className="flex items-center rounded-full transition-all flex-shrink-0"
        style={{ width: 44, height: 26, padding: 3, background: on ? '#1F4D2B' : 'rgba(32,25,15,0.15)',
          justifyContent: on ? 'flex-end' : 'flex-start', border: 'none', cursor: 'pointer' }}>
        <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  );
}

function NumInput({ value, onChange, placeholder, hint }: { value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) {
  return (
    <>
      <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? 'e.g. 120'}
        className="w-full font-sans"
        style={{ padding: '10px 14px', borderRadius: 11, background: '#FFFEFA', border: '1px solid #E2D8C4', fontSize: 14, color: '#20190F', outline: 'none' }} />
      {hint && <div className="font-sans mt-1" style={{ fontSize: 12, color: '#94876F' }}>{hint}</div>}
    </>
  );
}

function AutoFillNote({ areaM2 }: { areaM2: number }) {
  return (
    <div className="font-sans flex items-center gap-1.5 mt-1.5" style={{ fontSize: 12, color: '#1F4D2B' }}>
      <Sparkles size={12} />
      Auto-filled from your traced map shapes ({Math.round(areaM2)} m²) — tap to adjust
    </div>
  );
}

export default function SiteSurveySheet({ placeId, coords, onSaved, onClose }: Props) {
  const place = loadPlaces().find(p => p.id === placeId);
  // Prefer the live pin's coords (per-site canonical key); fall back to the place lookup.
  const siteLoc = coords ?? (place ? { lat: place.lat, lon: place.lon } : null);
  const siteId = designSiteIdFromLocation(siteLoc ? ({ lat: siteLoc.lat, lon: siteLoc.lon } as LocationData) : null);
  const existing = loadSurvey(siteId);
  const tracedAreas = computeTracedAreaTotals(siteId, siteLoc?.lat ?? null, siteLoc?.lon ?? null);

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
    if (tracedAreas.roofAreaM2 > 0) return String(Math.round(tracedAreas.roofAreaM2));
    return existing?.roofMainM2?.toString() ?? '';
  });
  const [roofSource, setRoofSource] = useState<'auto' | 'manual' | undefined>(() =>
    roofAreaSourceIsManual ? 'manual' : (tracedAreas.roofAreaM2 > 0 ? 'auto' : undefined)
  );
  const [roofSecondary, setRoofSecondary] = useState(existing?.roofSecondaryM2?.toString() ?? '');
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

  // Step 5 — Challenges
  const [practice, setPractice] = useState(existing?.farmingPractice ?? '');
  const [challenges, setChallenges] = useState<string[]>(existing?.challenges ?? []);
  const [isCommercial, setIsCommercial] = useState(existing?.isCommercial ?? false);
  const [marketType, setMarketType] = useState(existing?.marketType ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const totalRoof = (Number(roofMain) || 0) + (Number(roofSecondary) || 0);
  const roofHarvest600 = totalRoof > 0 ? Math.round(totalRoof * 600 * (hasGutters ? 0.8 : 0.6) / 1000) : 0;

  const canNext = [
    siteType && goals.length > 0,  // step 0
    waterSource.length > 0 && waterDelivery.length > 0,  // step 1
    true,  // step 2 — catchment is optional
    !!landPrep && !!soilCondition,  // step 3
    true,  // step 4 — what exists is optional
    !!practice && challenges.length > 0,  // step 5
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
      notes,
    };
    const saved = saveSurvey(survey);
    if (saved) onSaved(saved);
  }, [siteId, placeId, siteType, adults, memberCount, goals, waterSource, waterDelivery, waterStorage, roofMain, roofSecondary, roofSource, hasGutters, landPrep, soilCondition, soilAmendments, fencing, crops, existingGrowingArea, growingAreaSource, livestock, otherInfra, practice, challenges, isCommercial, marketType, notes, onSaved]);

  const Icon = STEP_ICONS[step];

  return (
    // Full-screen step wizard (fixed inset-0, no viewport margin) rather than a partial-height
    // bottom sheet — u-anim-sheet still gives it a settle-in entrance; deliberately no grabber
    // or rounded top corners here, since this view has no drag-to-dismiss gesture and rounding
    // edge-to-edge corners wouldn't render as anything visible. Close stays the explicit X below.
    <div className="fixed inset-0 z-50 flex flex-col u-anim-sheet" style={{ background: '#E4DCC6' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 flex-shrink-0" style={{ height: 60, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}>
        <button onClick={onClose}
          style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(32,25,15,0.06)', border: '1px solid #E2D8C4', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5C5040', flexShrink: 0 }}>
          <X size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-display font-semibold" style={{ fontSize: 16, color: '#20190F' }}>Site questionnaire</div>
          {place && <div className="font-sans" style={{ fontSize: 12, color: '#94876F' }}>{place.name}</div>}
        </div>
        <div className="font-sans" style={{ fontSize: 12, color: '#94876F', flexShrink: 0 }}>Step {step + 1} of {STEPS.length}</div>
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
              <SectionLabel>Who is this site for?</SectionLabel>
              <div className="space-y-2">
                <Radio label="Me / my family" desc="Household homestead or smallholding" on={siteType === 'homestead'} onClick={() => setSiteType('homestead')} />
                <Radio label="Community group / cooperative" desc="Shared garden, coop, or NGO site" on={siteType === 'community'} onClick={() => setSiteType('community')} />
              </div>
            </div>

            {siteType === 'homestead' ? (
              <div>
                <SectionLabel>Adults who work this land</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {['1', '2–5', '6–10', '10+'].map(v => (
                    <Chip key={v} label={v} on={adults === v} onClick={() => setAdults(v)} />
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <SectionLabel>Approximate number of members</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {['Under 20', '20–50', '50+'].map(v => (
                    <Chip key={v} label={v} on={memberCount === v} onClick={() => setMemberCount(v)} />
                  ))}
                </div>
              </div>
            )}

            <div>
              <SectionLabel>Goals for this site (select all that apply)</SectionLabel>
              <div className="space-y-2">
                {[
                  { v: 'food',      label: 'Food security',       desc: 'Feed the household or members year-round' },
                  { v: 'income',    label: 'Generate income',      desc: 'Sell surplus produce or value-added products' },
                  { v: 'soil',      label: 'Restore the land',     desc: 'Cover crops, composting, rehabilitation' },
                  { v: 'education', label: 'Demonstrate / teach',  desc: 'Training ground for others' },
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

        {/* ── Step 1: Water Resources ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <SectionLabel>Water sources available on this site (select all)</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'municipal',  label: 'Municipal tap' },
                  { v: 'borehole',   label: 'Borehole' },
                  { v: 'river',      label: 'River / stream' },
                  { v: 'rainwater',  label: 'Rainwater' },
                  { v: 'grey',       label: 'Grey water' },
                  { v: 'none',       label: 'No water yet' },
                ].map(o => (
                  <Chip key={o.v} label={o.label} on={waterSource.includes(o.v)} onClick={() => setWaterSource(toggle(waterSource, o.v))} color="#235E86" />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>How does water reach the plants? (select all that apply)</SectionLabel>
              <div className="space-y-2">
                {[
                  { v: 'drip',       label: 'Drip irrigation',    desc: 'Lines / emitters direct to roots' },
                  { v: 'sprinkler',  label: 'Sprinkler',          desc: 'Overhead spray system' },
                  { v: 'piped',      label: 'Piped to tap / hose',desc: 'Garden hose or standpipe' },
                  { v: 'gravity',    label: 'Gravity-fed',         desc: 'Header tank or elevated source' },
                  { v: 'bucket',     label: 'Hand-watered',        desc: 'Bucket / watering can' },
                  { v: 'flood',      label: 'Flood / furrow',      desc: 'Water runs along channels' },
                  { v: 'none',       label: 'Rain-fed only',       desc: 'No supplemental watering' },
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
              <SectionLabel>Water storage on site (select all)</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'jojo',    label: 'Jojo / plastic tanks' },
                  { v: 'dam',     label: 'Earth dam' },
                  { v: 'pond',    label: 'Pond / retention pit' },
                  { v: 'cistern', label: 'Underground cistern' },
                  { v: 'none',    label: 'No storage' },
                ].map(o => (
                  <Chip key={o.v} label={o.label} on={waterStorage.includes(o.v)} onClick={() => setWaterStorage(toggle(waterStorage, o.v))} color="#235E86" />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Roof Catchment ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div style={{ background: 'rgba(35,94,134,0.06)', borderRadius: 14, padding: '12px 14px', border: '1px solid rgba(35,94,134,0.18)' }}>
              <p className="font-sans" style={{ fontSize: 12.5, color: '#4A3F2E', lineHeight: 1.5 }}>
                <span className="font-semibold" style={{ color: '#235E86' }}>Why this matters: </span>
                Lima uses roof area to calculate how much rainwater you can harvest each year — it directly sizes your tank recommendations, swale design, and irrigation planning.
              </p>
            </div>

            <div>
              <SectionLabel>Main building roof area (m²)</SectionLabel>
              <div className="font-sans mb-2" style={{ fontSize: 12, color: '#8C7A62' }}>Rough guide: 2-bedroom house ≈ 60 m², 3-bedroom ≈ 100 m², large farmhouse ≈ 150+ m²</div>
              <NumInput value={roofMain} onChange={v => { setRoofMain(v); setRoofSource('manual'); }} placeholder="e.g. 100" hint="Floor area of the building, not the footprint of the roof pitch" />
              {roofSource === 'auto' && <AutoFillNote areaM2={tracedAreas.roofAreaM2} />}
            </div>

            <div>
              <SectionLabel>Secondary roofs — barn, shed, workshop (m²) — optional</SectionLabel>
              <NumInput value={roofSecondary} onChange={setRoofSecondary} placeholder="e.g. 60" hint="Add areas of all other harvestable roofs" />
            </div>

            <Toggle label="Gutters & downpipes in place" sub="Directs rain to tanks or storage area" on={hasGutters} onChange={setHasGutters} />

            {totalRoof > 0 && (
              <div style={{ background: 'rgba(31,77,43,0.06)', borderRadius: 14, padding: '14px 16px', border: '1px solid rgba(31,77,43,0.2)' }}>
                <div className="font-sans font-semibold mb-1" style={{ fontSize: 13, color: '#1F4D2B' }}>Live estimate</div>
                <div className="font-sans" style={{ fontSize: 13, color: '#4A3F2E', lineHeight: 1.6 }}>
                  Total roof area: <strong>{totalRoof} m²</strong><br />
                  At 600 mm rain → <strong>~{roofHarvest600} kL/year</strong> ({hasGutters ? '80%' : '60%'} efficiency)<br />
                  <span style={{ fontSize: 11.5, color: '#8C7A62' }}>Lima will recalculate using your site&apos;s actual rainfall</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Land & Soil ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <SectionLabel>How is the land prepared?</SectionLabel>
              <div className="space-y-2">
                {[
                  { v: 'hand',    label: 'Hand tools (spade, fork, hoe)',   desc: 'Manual soil work — limits depth and area' },
                  { v: 'tractor', label: 'Tractor / mechanised',             desc: 'Deep tillage possible, larger areas' },
                  { v: 'animal',  label: 'Animal draft (ox, donkey)',         desc: 'Traditional plough or cultivator' },
                  { v: 'none',    label: 'Not yet prepared / no-till',        desc: 'Starting from scratch or using no-dig method' },
                ].map(o => (
                  <Radio key={o.v} label={o.label} desc={o.desc} on={landPrep === o.v} onClick={() => setLandPrep(o.v)} />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Soil condition (as you observe it)</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: 'healthy',   label: 'Healthy & loose' },
                  { v: 'compacted', label: 'Compacted / hard' },
                  { v: 'sandy',     label: 'Sandy / drains fast' },
                  { v: 'clay',      label: 'Clay / waterlogged' },
                  { v: 'unknown',   label: 'Not sure' },
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
              <SectionLabel>Soil inputs already applied (select all)</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'compost',         label: 'Compost' },
                  { v: 'kraal-manure',    label: 'Kraal manure' },
                  { v: 'mulch',           label: 'Mulch / woodchip' },
                  { v: 'commercial-fert', label: 'Commercial fertiliser' },
                  { v: 'none',            label: 'None yet' },
                ].map(o => (
                  <Chip key={o.v} label={o.label} on={soilAmendments.includes(o.v)} onClick={() => setSoilAmendments(toggle(soilAmendments, o.v))} />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Fencing</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'full',    label: 'Fully fenced' },
                  { v: 'partial', label: 'Partly fenced' },
                  { v: 'none',    label: 'No fencing' },
                ].map(o => (
                  <Chip key={o.v} label={o.label} on={fencing === o.v} onClick={() => setFencing(o.v)} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: What Exists ── */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <SectionLabel>Crops already growing (select all)</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'vegetables',   label: 'Vegetables' },
                  { v: 'fruit-trees',  label: 'Fruit trees' },
                  { v: 'herbs',        label: 'Herbs / medicinal' },
                  { v: 'indigenous',   label: 'Indigenous plants' },
                  { v: 'fodder',       label: 'Fodder / pasture' },
                  { v: 'grain',        label: 'Grain / maize' },
                  { v: 'nothing',      label: 'Nothing yet' },
                ].map(o => (
                  <Chip key={o.v} label={o.label} on={crops.includes(o.v)} onClick={() => setCrops(toggle(crops, o.v))} />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Existing growing area (m²)</SectionLabel>
              <NumInput value={existingGrowingArea} onChange={v => { setExistingGrowingArea(v); setGrowingAreaSource('manual'); }} placeholder="e.g. 80" hint="Total area of beds, fields or gardens already under cultivation" />
              {growingAreaSource === 'auto' && <AutoFillNote areaM2={tracedAreas.cultivationAreaM2} />}
            </div>

            <div>
              <SectionLabel>Livestock on site (select all)</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'chickens', label: 'Chickens / poultry' },
                  { v: 'goats',    label: 'Goats' },
                  { v: 'cattle',   label: 'Cattle' },
                  { v: 'pigs',     label: 'Pigs' },
                  { v: 'bees',     label: 'Bees' },
                  { v: 'none',     label: 'No livestock' },
                ].map(o => (
                  <Chip key={o.v} label={o.label} on={livestock.includes(o.v)} onClick={() => setLivestock(toggle(livestock, o.v))} color="#C07A1E" />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Other infrastructure (select all)</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'shade-tunnel', label: 'Shade tunnel' },
                  { v: 'greenhouse',   label: 'Greenhouse / polytunnel' },
                  { v: 'compost-bay',  label: 'Compost bay' },
                  { v: 'shed',         label: 'Storage shed' },
                  { v: 'kraal',        label: 'Livestock kraal' },
                ].map(o => (
                  <Chip key={o.v} label={o.label} on={otherInfra.includes(o.v)} onClick={() => setOtherInfra(toggle(otherInfra, o.v))} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 5: Challenges & Notes ── */}
        {step === 5 && (
          <div className="space-y-5">
            <div>
              <SectionLabel>Farming approach</SectionLabel>
              <div className="space-y-2">
                {[
                  { v: 'organic',        label: 'Fully organic',         desc: 'No synthetic inputs, composting-based' },
                  { v: 'mostly-organic', label: 'Mostly organic',         desc: 'Organic where possible, occasional exceptions' },
                  { v: 'conventional',   label: 'Conventional',           desc: 'Synthetic fertilisers and pesticides used' },
                  { v: 'experimenting',  label: 'Experimenting / mixed',  desc: 'Trying different methods, not set yet' },
                ].map(o => (
                  <Radio key={o.v} label={o.label} desc={o.desc} on={practice === o.v} onClick={() => setPractice(o.v)} />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Main challenges on this site (select at least one)</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[
                  { v: 'drought',    label: 'Drought / dry spells' },
                  { v: 'pests',      label: 'Pests & disease' },
                  { v: 'soil',       label: 'Poor / degraded soil' },
                  { v: 'water',      label: 'Limited water access' },
                  { v: 'funding',    label: 'Funding / costs' },
                  { v: 'labour',     label: 'Not enough labour' },
                  { v: 'flooding',   label: 'Flooding / erosion' },
                  { v: 'market',     label: 'Market access' },
                  { v: 'none',       label: 'No major challenges' },
                ].map(o => (
                  <Chip key={o.v} label={o.label} on={challenges.includes(o.v)} onClick={() => setChallenges(toggle(challenges, o.v))} color="#C07A1E" />
                ))}
              </div>
            </div>

            <Toggle label="We sell or plan to sell produce" sub="Enables market-access questions" on={isCommercial} onChange={setIsCommercial} />

            {isCommercial && (
              <div>
                <SectionLabel>Current or target market</SectionLabel>
                <div className="space-y-2">
                  {[
                    { v: 'farm-stall',    label: 'On-site farm stall' },
                    { v: 'local-market',  label: 'Local community / informal market' },
                    { v: 'wholesale',     label: 'Wholesale / bulk buyers' },
                    { v: 'not-sure',      label: 'Not sure yet' },
                  ].map(o => (
                    <Radio key={o.v} label={o.label} on={marketType === o.v} onClick={() => setMarketType(o.v)} />
                  ))}
                </div>
              </div>
            )}

            <div>
              <SectionLabel>Anything else Lima should know?</SectionLabel>
              <div className="font-sans mb-2" style={{ fontSize: 12, color: '#8C7A62' }}>
                Unique site features, history, things you&apos;ve tried, specific concerns…
              </div>
              <div style={{ background: 'rgba(31,77,43,0.05)', borderRadius: 11, padding: '4px', border: '1px solid rgba(31,77,43,0.15)', marginBottom: 8 }}>
                <div className="font-sans" style={{ fontSize: 11.5, color: '#1F4D2B', padding: '6px 10px' }}>
                  📷 Tip: photos of soil, slope, problem areas, and existing crops help Lima give far more specific advice — add them via the camera button on the map.
                </div>
              </div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="e.g. North slope gets afternoon shade from the ridge. We had a tree removed and the soil there is very hard…"
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
            <ChevronLeft size={16} /> Back
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
            ? <><span>Next</span><ChevronRight size={16} /></>
            : <><Check size={16} /><span>Save &amp; generate report</span></>}
        </button>
      </div>
    </div>
  );
}

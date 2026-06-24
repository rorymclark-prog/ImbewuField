'use client';
import { useState, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Users, Target, Droplets, Zap, AlertTriangle, FileText } from 'lucide-react';
import { saveSurvey, loadSurvey, type SiteSurvey } from '@/lib/site-survey';
import { loadPlaces } from '@/lib/saved-places';

interface Props {
  placeId: string;
  onSaved: (survey: SiteSurvey) => void;
  onClose: () => void;
}

const STEPS = ['People & Goal', 'Water', 'Infrastructure', 'Challenges', 'Notes'];

const PEOPLE_OPTS = ['1', '2–5', '6–10', '10+'];
const GOAL_OPTS: { v: string; label: string; desc: string }[] = [
  { v: 'food', label: 'Food security', desc: 'Feed the household year-round' },
  { v: 'income', label: 'Earn income', desc: 'Sell produce at market' },
  { v: 'soil', label: 'Restore soil', desc: 'Cover crops, composting, land rehab' },
  { v: 'education', label: 'Demonstrate', desc: 'Training / demo site for others' },
  { v: 'mixed', label: 'Mixed goals', desc: 'Food + income combined' },
];
const WATER_OPTS = [
  { v: 'municipal', label: 'Municipal' },
  { v: 'borehole', label: 'Borehole' },
  { v: 'river', label: 'River / stream' },
  { v: 'rainwater', label: 'Rain tanks' },
  { v: 'none', label: 'None' },
];
const INFRA_OPTS = [
  { v: 'fencing', label: 'Fencing' },
  { v: 'electricity', label: 'Electricity' },
  { v: 'compost', label: 'Compost area' },
  { v: 'greenhouse', label: 'Greenhouse / polytunnel' },
  { v: 'storage', label: 'Storage / shed' },
];
const CHALLENGE_OPTS = [
  { v: 'drought', label: 'Drought / dry periods' },
  { v: 'pests', label: 'Pests & disease' },
  { v: 'funding', label: 'Funding / money' },
  { v: 'labour', label: 'Not enough labour' },
  { v: 'market', label: 'Market access' },
  { v: 'flooding', label: 'Flooding / erosion' },
  { v: 'soil', label: 'Poor soil' },
];
const MARKET_OPTS: { v: string; label: string }[] = [
  { v: 'direct', label: 'Direct on-site (farm stall)' },
  { v: 'local', label: 'Local community market' },
  { v: 'remote', label: 'Transport to town / city' },
  { v: 'none', label: 'No market yet' },
];
const SLOPE_OPTS: { v: string; label: string }[] = [
  { v: 'flat', label: 'Flat' },
  { v: 'gentle', label: 'Gentle slope' },
  { v: 'steep', label: 'Steep' },
];
const SOIL_OPTS: { v: string; label: string }[] = [
  { v: 'good', label: 'Healthy & loose' },
  { v: 'compacted', label: 'Compacted / hard' },
  { v: 'poor', label: 'Sandy / low fertility' },
  { v: 'unknown', label: 'Not sure' },
];

function toggle(arr: string[], v: string): string[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export default function SiteSurveySheet({ placeId, onSaved, onClose }: Props) {
  const existing = loadSurvey(placeId);
  const place = loadPlaces().find((p) => p.id === placeId);

  const [step, setStep] = useState(0);
  const [people, setPeople] = useState(existing?.people ?? '');
  const [goal, setGoal] = useState(existing?.goal ?? '');
  const [waterSource, setWaterSource] = useState<string[]>(existing?.waterSource ?? []);
  const [hasIrrigation, setHasIrrigation] = useState(existing?.hasIrrigation ?? false);
  const [roofAreaM2, setRoofAreaM2] = useState<string>(existing?.roofAreaM2?.toString() ?? '');
  const [infrastructure, setInfrastructure] = useState<string[]>(existing?.infrastructure ?? []);
  const [soilCondition, setSoilCondition] = useState(existing?.soilCondition ?? '');
  const [slopeObs, setSlopeObs] = useState(existing?.slopeObs ?? '');
  const [challenges, setChallenges] = useState<string[]>(existing?.challenges ?? []);
  const [marketAccess, setMarketAccess] = useState(existing?.marketAccess ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const canNext = [
    people && goal,
    waterSource.length > 0,
    true,
    challenges.length > 0 && marketAccess,
    true,
  ][step];

  const handleSave = useCallback(() => {
    const survey: SiteSurvey = {
      placeId,
      savedAt: new Date().toISOString(),
      people,
      goal,
      waterSource,
      hasIrrigation,
      roofAreaM2: roofAreaM2 ? Number(roofAreaM2) : null,
      infrastructure,
      soilCondition,
      slopeObs,
      challenges,
      marketAccess,
      notes,
    };
    saveSurvey(survey);
    onSaved(survey);
  }, [placeId, people, goal, waterSource, hasIrrigation, roofAreaM2, infrastructure, soilCondition, slopeObs, challenges, marketAccess, notes, onSaved]);

  const STEP_ICONS = [Users, Target, Zap, AlertTriangle, FileText];
  const Icon = STEP_ICONS[step];

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#F7F2E9' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 flex-shrink-0" style={{ height: 60, background: '#FBF6EC', borderBottom: '1px solid #E2D8C4' }}>
        <button onClick={onClose} style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(32,25,15,0.06)', border: '1px solid #E2D8C4', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5C5040', flexShrink: 0 }}>
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

        {/* Step 0 — People & Goal */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <div className="font-sans font-semibold mb-2" style={{ fontSize: 13, color: '#5C5040' }}>How many people live or work on this site?</div>
              <div className="flex flex-wrap gap-2">
                {PEOPLE_OPTS.map((v) => (
                  <button key={v} onClick={() => setPeople(v)}
                    className="font-sans font-semibold transition-all"
                    style={{ padding: '8px 18px', borderRadius: 999, fontSize: 14, cursor: 'pointer', background: people === v ? '#1F4D2B' : 'rgba(226,216,196,0.5)', color: people === v ? '#fff' : '#5C5040', border: `1px solid ${people === v ? '#1F4D2B' : '#E2D8C4'}` }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="font-sans font-semibold mb-2" style={{ fontSize: 13, color: '#5C5040' }}>Primary goal for this site</div>
              <div className="space-y-2">
                {GOAL_OPTS.map((o) => (
                  <button key={o.v} onClick={() => setGoal(o.v)}
                    className="w-full flex items-start gap-3 text-left transition-all"
                    style={{ padding: '10px 14px', borderRadius: 12, background: goal === o.v ? 'rgba(31,77,43,0.08)' : 'rgba(226,216,196,0.3)', border: `1.5px solid ${goal === o.v ? '#1F4D2B' : '#E2D8C4'}`, cursor: 'pointer' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${goal === o.v ? '#1F4D2B' : '#C4B89C'}`, background: goal === o.v ? '#1F4D2B' : 'transparent', flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {goal === o.v && <Check size={11} style={{ color: '#fff' }} />}
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

        {/* Step 1 — Water */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <div className="font-sans font-semibold mb-2" style={{ fontSize: 13, color: '#5C5040' }}>Water sources available (select all)</div>
              <div className="flex flex-wrap gap-2">
                {WATER_OPTS.map((o) => {
                  const on = waterSource.includes(o.v);
                  return (
                    <button key={o.v} onClick={() => setWaterSource(toggle(waterSource, o.v))}
                      className="font-sans font-semibold transition-all"
                      style={{ padding: '8px 16px', borderRadius: 999, fontSize: 13.5, cursor: 'pointer', background: on ? '#235E86' : 'rgba(226,216,196,0.5)', color: on ? '#fff' : '#5C5040', border: `1px solid ${on ? '#235E86' : '#E2D8C4'}` }}>
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between" style={{ background: 'rgba(226,216,196,0.3)', borderRadius: 12, padding: '12px 14px', border: '1px solid #E2D8C4' }}>
              <div>
                <div className="font-sans font-semibold" style={{ fontSize: 13.5, color: '#20190F' }}>Is there irrigation?</div>
                <div className="font-sans" style={{ fontSize: 12, color: '#8C7A62' }}>Drip, sprinkler, gravity-fed, etc.</div>
              </div>
              <button onClick={() => setHasIrrigation(!hasIrrigation)}
                className="flex items-center rounded-full transition-all"
                style={{ width: 44, height: 26, padding: 3, background: hasIrrigation ? '#1F4D2B' : 'rgba(32,25,15,0.15)', justifyContent: hasIrrigation ? 'flex-end' : 'flex-start', border: 'none', cursor: 'pointer' }}>
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'all 0.2s' }} />
              </button>
            </div>
            <div>
              <div className="font-sans font-semibold mb-1" style={{ fontSize: 13, color: '#5C5040' }}>Estimated roof catchment area (m²) — optional</div>
              <div className="font-sans mb-2" style={{ fontSize: 12, color: '#8C7A62' }}>Floor area of all buildings whose runoff you can harvest. Helps Lima calculate your roof water budget.</div>
              <input type="number" value={roofAreaM2} onChange={(e) => setRoofAreaM2(e.target.value)} placeholder="e.g. 120"
                className="w-full font-sans"
                style={{ padding: '10px 14px', borderRadius: 11, background: '#FBF6EC', border: '1px solid #E2D8C4', fontSize: 14, color: '#20190F', outline: 'none' }} />
              {roofAreaM2 && Number(roofAreaM2) > 0 && (
                <div className="font-sans mt-1" style={{ fontSize: 12, color: '#1F4D2B' }}>
                  At 600mm rain → ~{Math.round(Number(roofAreaM2) * 600 * 0.8 / 1000)} kL/year estimated
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2 — Infrastructure */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <div className="font-sans font-semibold mb-2" style={{ fontSize: 13, color: '#5C5040' }}>What infrastructure exists on this site? (select all)</div>
              <div className="space-y-2">
                {INFRA_OPTS.map((o) => {
                  const on = infrastructure.includes(o.v);
                  return (
                    <button key={o.v} onClick={() => setInfrastructure(toggle(infrastructure, o.v))}
                      className="w-full flex items-center gap-3 text-left transition-all"
                      style={{ padding: '10px 14px', borderRadius: 12, background: on ? 'rgba(31,77,43,0.08)' : 'rgba(226,216,196,0.3)', border: `1.5px solid ${on ? '#1F4D2B' : '#E2D8C4'}`, cursor: 'pointer' }}>
                      <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${on ? '#1F4D2B' : '#C4B89C'}`, background: on ? '#1F4D2B' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {on && <Check size={11} style={{ color: '#fff' }} />}
                      </div>
                      <span className="font-sans font-medium" style={{ fontSize: 13.5, color: '#20190F' }}>{o.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="font-sans font-semibold mb-2" style={{ fontSize: 13, color: '#5C5040' }}>Slope (as you observe it)</div>
              <div className="flex gap-2">
                {SLOPE_OPTS.map((o) => (
                  <button key={o.v} onClick={() => setSlopeObs(o.v)}
                    className="flex-1 font-sans font-semibold transition-all"
                    style={{ padding: '9px 6px', borderRadius: 11, fontSize: 13, cursor: 'pointer', background: slopeObs === o.v ? '#1F4D2B' : 'rgba(226,216,196,0.5)', color: slopeObs === o.v ? '#fff' : '#5C5040', border: `1px solid ${slopeObs === o.v ? '#1F4D2B' : '#E2D8C4'}` }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="font-sans font-semibold mb-2" style={{ fontSize: 13, color: '#5C5040' }}>Soil condition (as you observe it)</div>
              <div className="grid grid-cols-2 gap-2">
                {SOIL_OPTS.map((o) => (
                  <button key={o.v} onClick={() => setSoilCondition(o.v)}
                    className="font-sans font-semibold transition-all"
                    style={{ padding: '9px 12px', borderRadius: 11, fontSize: 13, cursor: 'pointer', background: soilCondition === o.v ? '#1F4D2B' : 'rgba(226,216,196,0.5)', color: soilCondition === o.v ? '#fff' : '#5C5040', border: `1px solid ${soilCondition === o.v ? '#1F4D2B' : '#E2D8C4'}` }}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — Challenges */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <div className="font-sans font-semibold mb-2" style={{ fontSize: 13, color: '#5C5040' }}>Main challenges on this site (select all)</div>
              <div className="flex flex-wrap gap-2">
                {CHALLENGE_OPTS.map((o) => {
                  const on = challenges.includes(o.v);
                  return (
                    <button key={o.v} onClick={() => setChallenges(toggle(challenges, o.v))}
                      className="font-sans font-semibold transition-all"
                      style={{ padding: '8px 16px', borderRadius: 999, fontSize: 13.5, cursor: 'pointer', background: on ? 'rgba(192,122,30,0.15)' : 'rgba(226,216,196,0.5)', color: on ? '#C07A1E' : '#5C5040', border: `1px solid ${on ? '#C07A1E' : '#E2D8C4'}` }}>
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="font-sans font-semibold mb-2" style={{ fontSize: 13, color: '#5C5040' }}>Market access</div>
              <div className="space-y-2">
                {MARKET_OPTS.map((o) => (
                  <button key={o.v} onClick={() => setMarketAccess(o.v)}
                    className="w-full flex items-center gap-3 text-left transition-all"
                    style={{ padding: '10px 14px', borderRadius: 12, background: marketAccess === o.v ? 'rgba(31,77,43,0.08)' : 'rgba(226,216,196,0.3)', border: `1.5px solid ${marketAccess === o.v ? '#1F4D2B' : '#E2D8C4'}`, cursor: 'pointer' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${marketAccess === o.v ? '#1F4D2B' : '#C4B89C'}`, background: marketAccess === o.v ? '#1F4D2B' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {marketAccess === o.v && <Check size={11} style={{ color: '#fff' }} />}
                    </div>
                    <span className="font-sans font-medium" style={{ fontSize: 13.5, color: '#20190F' }}>{o.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4 — Notes */}
        {step === 4 && (
          <div className="space-y-5">
            <div style={{ background: 'rgba(31,77,43,0.06)', borderRadius: 14, padding: '12px 14px', border: '1px solid rgba(31,77,43,0.18)' }}>
              <div className="flex items-start gap-2">
                <div style={{ width: 28, height: 28, borderRadius: 9, background: '#1F4D2B', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EAF3E2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 21V11" /><path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z" /><path d="M12 13c0-3 2.2-5.2 6-5.2 0 3.6-2.2 5.2-6 5.2Z" />
                  </svg>
                </div>
                <p className="font-sans" style={{ fontSize: 12.5, color: '#4A3F2E', lineHeight: 1.5 }}>
                  <span className="font-semibold" style={{ color: '#1F4D2B' }}>Tip from Lima: </span>
                  Photos of the site help me give much more specific advice — take a few shots of the soil, slope, existing vegetation, and any problem areas.
                </p>
              </div>
            </div>
            <div>
              <div className="font-sans font-semibold mb-1" style={{ fontSize: 13, color: '#5C5040' }}>Any other notes about this site?</div>
              <div className="font-sans mb-2" style={{ fontSize: 12, color: '#8C7A62' }}>Unique features, history, concerns, what you&apos;ve tried before…</div>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. We had a large tree removed last year, the soil there is very compacted…" rows={5}
                className="w-full font-sans"
                style={{ padding: '10px 14px', borderRadius: 11, background: '#FBF6EC', border: '1px solid #E2D8C4', fontSize: 14, color: '#20190F', outline: 'none', resize: 'none', lineHeight: 1.5 }} />
            </div>
          </div>
        )}
      </div>

      {/* Footer buttons */}
      <div className="flex gap-3 flex-shrink-0" style={{ padding: '14px 20px', paddingBottom: 'calc(14px + env(safe-area-inset-bottom))', background: '#FBF6EC', borderTop: '1px solid #E2D8C4' }}>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)}
            className="flex items-center gap-1.5 font-sans font-semibold transition-all"
            style={{ padding: '0 18px', height: 46, borderRadius: 13, background: 'rgba(226,216,196,0.4)', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer', flexShrink: 0 }}>
            <ChevronLeft size={16} /> Back
          </button>
        )}
        <button
          onClick={() => {
            if (step < STEPS.length - 1) setStep(s => s + 1);
            else handleSave();
          }}
          disabled={!canNext}
          className="flex-1 flex items-center justify-center gap-2 font-sans font-bold transition-all"
          style={{ height: 46, borderRadius: 13, background: canNext ? '#1F4D2B' : 'rgba(32,25,15,0.1)', color: canNext ? '#F7F2E9' : 'rgba(32,25,15,0.3)', border: 'none', fontSize: 15, cursor: canNext ? 'pointer' : 'default' }}>
          {step < STEPS.length - 1 ? <><span>Next</span><ChevronRight size={16} /></> : <><Check size={16} /><span>Save &amp; generate report</span></>}
        </button>
      </div>
    </div>
  );
}

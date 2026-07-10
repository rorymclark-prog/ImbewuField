'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import TabBar from '@/components/TabBar';
import SettingsButton from '@/components/SettingsButton';
import BrandLogo from '@/components/BrandLogo';
import BackButton from '@/components/BackButton';
import { Leaf, Plus, Trash2, Minus, Sun, CloudRain, Snowflake, Sprout, CalendarCheck } from 'lucide-react';

type Season = 'Summer' | 'Autumn' | 'Winter' | 'Spring';
type Suitability = 'best' | 'soon' | 'off';

function getSASeason(month: number): { name: Season; months: string; Icon: typeof Sun } {
  if (month >= 8 && month <= 10) return { name: 'Spring', months: 'Sep – Nov', Icon: Sprout };
  if (month === 11 || month <= 1)  return { name: 'Summer', months: 'Dec – Feb', Icon: Sun };
  if (month >= 2 && month <= 4)   return { name: 'Autumn', months: 'Mar – May', Icon: CloudRain };
  return { name: 'Winter', months: 'Jun – Aug', Icon: Snowflake };
}

const CROP_SEASONS: Record<string, Season[]> = {
  Spinach:       ['Winter', 'Autumn', 'Spring'],
  Kale:          ['Winter', 'Autumn', 'Spring'],
  Lettuce:       ['Winter', 'Autumn', 'Spring'],
  Carrots:       ['Winter', 'Autumn'],
  Beetroot:      ['Winter', 'Autumn', 'Spring'],
  Peas:          ['Winter', 'Spring'],
  Garlic:        ['Winter'],
  Broccoli:      ['Winter', 'Autumn'],
  'Sweet potato': ['Summer', 'Spring'],
  Tomatoes:      ['Summer', 'Spring'],
  Maize:         ['Summer', 'Spring'],
  Beans:         ['Summer', 'Spring'],
  Butternut:     ['Summer'],
  Peppers:       ['Summer'],
  Cucumber:      ['Summer', 'Spring'],
  Pumpkin:       ['Summer', 'Spring'],
  'Swiss chard': ['Summer', 'Winter', 'Spring', 'Autumn'],
};

// Rough smallholder yield per standard bed (~1.2 m × 8 m ≈ 9.6 m²), used to
// project plant counts and harvest weight from a bed count. Quantity flows on to
// expected yield → finances, and seed/seedling counts → bill of quantities.
const CROP_YIELD: Record<string, { plantsPerBed: number; kgPerBed: number }> = {
  Spinach:        { plantsPerBed: 60,  kgPerBed: 30 },
  Kale:           { plantsPerBed: 24,  kgPerBed: 36 },
  Lettuce:        { plantsPerBed: 40,  kgPerBed: 20 },
  Carrots:        { plantsPerBed: 200, kgPerBed: 30 },
  Beetroot:       { plantsPerBed: 80,  kgPerBed: 24 },
  Peas:           { plantsPerBed: 60,  kgPerBed: 12 },
  Garlic:         { plantsPerBed: 100, kgPerBed: 10 },
  Broccoli:       { plantsPerBed: 20,  kgPerBed: 16 },
  'Sweet potato': { plantsPerBed: 30,  kgPerBed: 45 },
  Tomatoes:       { plantsPerBed: 18,  kgPerBed: 54 },
  Maize:          { plantsPerBed: 60,  kgPerBed: 24 },
  Beans:          { plantsPerBed: 80,  kgPerBed: 16 },
  Butternut:      { plantsPerBed: 8,   kgPerBed: 40 },
  Peppers:        { plantsPerBed: 24,  kgPerBed: 24 },
  Cucumber:       { plantsPerBed: 16,  kgPerBed: 32 },
  Pumpkin:        { plantsPerBed: 6,   kgPerBed: 48 },
  'Swiss chard':  { plantsPerBed: 40,  kgPerBed: 28 },
};
const DEFAULT_YIELD = { plantsPerBed: 40, kgPerBed: 25 };
const yieldFor = (crop: string) => CROP_YIELD[crop] ?? DEFAULT_YIELD;

const NEXT_SEASON: Record<Season, Season> = {
  Winter: 'Spring', Spring: 'Summer', Summer: 'Autumn', Autumn: 'Winter',
};

function getSuitability(crop: string, season: Season): Suitability {
  const valid = CROP_SEASONS[crop] ?? (['Summer', 'Winter', 'Spring', 'Autumn'] as Season[]);
  if (valid.includes(season)) return 'best';
  if (valid.includes(NEXT_SEASON[season])) return 'soon';
  return 'off';
}

const BADGE: Record<Suitability, { label: string; bg: string; color: string }> = {
  best: { label: 'Plant now',   bg: 'rgba(31,77,43,0.10)',    color: '#1F4D2B' },
  soon: { label: 'Next season', bg: 'rgba(192,122,30,0.10)',  color: '#9A6018' },
  off:  { label: 'Off season',  bg: 'rgba(32,25,15,0.06)',    color: '#8C7A62' },
};

const DEFAULT_CROPS = ['Spinach', 'Tomatoes', 'Maize', 'Beans', 'Sweet potato', 'Swiss chard'];
const LS_KEY = 'imbewu_planner_crops';
const LS_QTY = 'imbewu_planner_qty';

function loadCrops(): string[] {
  if (typeof window === 'undefined') return DEFAULT_CROPS;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch { /* ignore */ }
  return DEFAULT_CROPS;
}

function loadQty(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LS_QTY);
    if (raw) return JSON.parse(raw) as Record<string, number>;
  } catch { /* ignore */ }
  return {};
}

export default function PlanPage() {
  const month = new Date().getMonth();
  const { name: seasonName, months, Icon: SeasonIcon } = getSASeason(month);
  const [crops, setCrops] = useState<string[]>(DEFAULT_CROPS);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [input, setInput] = useState('');

  useEffect(() => { setCrops(loadCrops()); setQty(loadQty()); }, []);

  const bedsFor = (crop: string) => qty[crop] ?? 1;

  function persist(nextCrops: string[], nextQty: Record<string, number>) {
    localStorage.setItem(LS_KEY, JSON.stringify(nextCrops));
    localStorage.setItem(LS_QTY, JSON.stringify(nextQty));
  }

  function addCrop() {
    const name = input.trim();
    if (!name || crops.includes(name)) { setInput(''); return; }
    const nextCrops = [...crops, name];
    const nextQty = { ...qty, [name]: 1 };
    setCrops(nextCrops); setQty(nextQty); persist(nextCrops, nextQty);
    setInput('');
  }

  function removeCrop(crop: string) {
    const nextCrops = crops.filter((x) => x !== crop);
    const nextQty = { ...qty }; delete nextQty[crop];
    setCrops(nextCrops); setQty(nextQty); persist(nextCrops, nextQty);
  }

  function changeBeds(crop: string, delta: number) {
    const next = Math.max(1, Math.min(99, bedsFor(crop) + delta));
    const nextQty = { ...qty, [crop]: next };
    setQty(nextQty); persist(crops, nextQty);
  }

  const sorted = [...crops].sort((a, b) => {
    const order: Record<Suitability, number> = { best: 0, soon: 1, off: 2 };
    return order[getSuitability(a, seasonName)] - order[getSuitability(b, seasonName)];
  });

  // Season projection — sum the crops that are in their planting window now.
  const inSeason = crops.filter((c) => getSuitability(c, seasonName) === 'best');
  const totalBeds = inSeason.reduce((s, c) => s + bedsFor(c), 0);
  const totalKg = inSeason.reduce((s, c) => s + bedsFor(c) * yieldFor(c).kgPerBed, 0);

  // Lima advice — reference the biggest in-season planting if there is one.
  const headline = inSeason
    .map((c) => ({ c, kg: bedsFor(c) * yieldFor(c).kgPerBed }))
    .sort((a, b) => b.kg - a.kg)[0];
  const limaTip = headline
    ? `${seasonName} suits this planting. You've set ${bedsFor(headline.c)} bed${bedsFor(headline.c) > 1 ? 's' : ''} of ${headline.c.toLowerCase()} — about ${bedsFor(headline.c) * yieldFor(headline.c).plantsPerBed} plants, ~${bedsFor(headline.c) * yieldFor(headline.c).kgPerBed} kg. Rotate with legumes next season.`
    : `${seasonName} planting window — add the crops you'll grow and set how many beds, so I can project your yield and seed needs.`;

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#F7F2E9' }}>
      <header
        className="flex-shrink-0 flex items-center px-3 md:px-4 gap-2"
        style={{ height: 52, background: '#FBF6EC', borderBottom: '1px solid #E2D8C4' }}
      >
        <BackButton fallback="/home" />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
        <span className="text-xs font-display" style={{ color: '#5C5040' }}>Crop Planner</span>
        <div className="flex-1" />
        <Link href="/cropplan"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold"
          style={{ background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.2)', color: '#1F4D2B', textDecoration: 'none' }}>
          <CalendarCheck size={13} />Jobs
        </Link>
        <SettingsButton />
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 pt-4">
          <Link href="/facilitator/crops"
            className="block px-4 py-2.5 rounded-xl text-sm font-display font-semibold text-center transition-all"
            style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', color: '#1F4D2B', textDecoration: 'none' }}>
            🌱 New: plan crops bed-by-bed on your design map →
          </Link>
        </div>
        <div className="max-w-md mx-auto px-4 py-5 space-y-5">

          {/* Season card */}
          <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: '#1F4D2B', boxShadow: '0 4px 16px rgba(31,77,43,0.28)' }}>
            <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 44, height: 44, background: 'rgba(234,243,226,0.15)', color: '#EAF3E2' }}>
              <SeasonIcon size={20} strokeWidth={1.6} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-sans uppercase tracking-widest" style={{ color: 'rgba(234,243,226,0.55)', letterSpacing: '0.1em' }}>Current season</div>
              <div className="font-display font-bold text-xl mt-0.5" style={{ color: '#F7F2E9', letterSpacing: '-0.02em' }}>{seasonName}</div>
              <div className="text-xs font-sans mt-0.5" style={{ color: 'rgba(234,243,226,0.65)' }}>{months} · South Africa</div>
            </div>
            {totalBeds > 0 && (
              <div className="flex-shrink-0 text-right">
                <div className="font-display font-bold text-lg" style={{ color: '#F7F2E9', lineHeight: 1 }}>~{totalKg} kg</div>
                <div className="text-xs font-sans mt-1" style={{ color: 'rgba(234,243,226,0.6)' }}>{totalBeds} bed{totalBeds > 1 ? 's' : ''} this season</div>
              </div>
            )}
          </div>

          {/* Lima tip */}
          <div className="rounded-xl px-4 py-3 flex gap-3 items-start" style={{ background: 'rgba(31,77,43,0.06)', border: '1px solid rgba(31,77,43,0.12)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#1F4D2B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }}>
              <path d="M12 21V11" /><path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z" /><path d="M12 13c0-3 2.2-5.2 6-5.2 0 3.6-2.2 5.2-6 5.2Z" />
            </svg>
            <p className="text-xs font-display leading-relaxed" style={{ color: '#20190F' }}>
              Lima: {limaTip}
            </p>
          </div>

          {/* Crops */}
          <section>
            <div className="text-xs font-sans uppercase tracking-widest mb-3" style={{ color: '#8C7A62', letterSpacing: '0.10em' }}>My crops · how much</div>
            <div className="space-y-2.5">
              {sorted.map((crop) => {
                const suit = getSuitability(crop, seasonName);
                const badge = BADGE[suit];
                const beds = bedsFor(crop);
                const y = yieldFor(crop);
                const off = suit === 'off';
                return (
                  <div key={crop} className="rounded-2xl px-4 py-3" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
                    <div className="flex items-center gap-2.5">
                      <Leaf size={15} style={{ color: '#1F4D2B', flexShrink: 0, opacity: off ? 0.3 : 1 }} />
                      <span className="flex-1 font-display text-sm font-semibold" style={{ color: off ? '#8C7A62' : '#20190F' }}>{crop}</span>
                      <span className="text-xs font-sans px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color, flexShrink: 0 }}>{badge.label}</span>
                      <button onClick={() => removeCrop(crop)} className="opacity-30 hover:opacity-70 transition-opacity flex-shrink-0" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#5C5040' }} aria-label={`Remove ${crop}`}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2.5">
                      {/* Projection */}
                      <div className="text-xs font-sans truncate" style={{ color: '#5C5040', whiteSpace: 'nowrap' }}>
                        ~{beds * y.plantsPerBed} plants · est. <span style={{ color: '#1F4D2B', fontWeight: 600 }}>{beds * y.kgPerBed} kg</span>
                      </div>
                      {/* Bed stepper */}
                      <div className="flex items-center gap-1.5 rounded-full px-1 py-1 flex-shrink-0" style={{ background: 'rgba(31,77,43,0.06)', border: '1px solid rgba(31,77,43,0.12)' }}>
                        <button onClick={() => changeBeds(crop, -1)} aria-label="Fewer beds"
                          className="flex items-center justify-center rounded-full"
                          style={{ width: 26, height: 26, background: '#FBF6EC', border: '1px solid #E2D8C4', color: '#1F4D2B', cursor: 'pointer' }}>
                          <Minus size={13} />
                        </button>
                        <span className="font-display font-semibold text-sm tabular-nums" style={{ color: '#20190F', minWidth: 46, textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {beds} bed{beds > 1 ? 's' : ''}
                        </span>
                        <button onClick={() => changeBeds(crop, 1)} aria-label="More beds"
                          className="flex items-center justify-center rounded-full"
                          style={{ width: 26, height: 26, background: '#1F4D2B', border: 'none', color: '#EAF3E2', cursor: 'pointer' }}>
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Add crop */}
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCrop()}
              placeholder="Add a crop (e.g. Kale, Garlic...)"
              className="flex-1 text-sm font-display outline-none rounded-xl px-3 py-2.5"
              style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', color: '#20190F' }}
            />
            <button onClick={addCrop} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-display font-semibold transition-all" style={{ background: '#1F4D2B', color: '#EAF3E2', border: 'none', cursor: 'pointer' }}>
              <Plus size={15} />
              Add
            </button>
          </div>

          {/* Link to journal */}
          <Link href="/journal" className="flex items-center justify-between w-full px-4 py-3.5 rounded-2xl text-sm font-display" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', color: '#20190F', textDecoration: 'none' }}>
            <span>Log a harvest in your Field Journal</span>
            <Leaf size={15} style={{ color: '#8C7A62' }} />
          </Link>

          <p className="text-center text-xs font-sans pb-2" style={{ color: '#8C7A62' }}>Seasons for South Africa · southern hemisphere</p>
        </div>
      </div>

      <TabBar />
    </div>
  );
}

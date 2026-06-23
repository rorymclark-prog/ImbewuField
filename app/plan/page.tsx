'use client';

import { useState } from 'react';
import Link from 'next/link';
import TabBar from '@/components/TabBar';
import SettingsButton from '@/components/SettingsButton';
import BrandLogo from '@/components/BrandLogo';
import BackButton from '@/components/BackButton';
import { Leaf, Plus, Trash2, Sun, CloudRain, Snowflake, Sprout } from 'lucide-react';

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

const LIMA_TIPS: Record<Season, string> = {
  Winter: 'Winter is perfect for leafy greens and root vegetables. Rotate with legumes next season to fix nitrogen.',
  Spring: 'Spring is your planting window — get your tomatoes, beans, and sweet potato in the ground before the heat.',
  Summer: 'Mulch heavily in summer to retain moisture. Your tomatoes and maize are in their best growth window now.',
  Autumn: 'Autumn is a good time to harvest summer crops and prepare beds with compost for winter planting.',
};

const DEFAULT_CROPS = ['Spinach', 'Tomatoes', 'Maize', 'Beans', 'Sweet potato', 'Swiss chard'];

export default function PlanPage() {
  const month = new Date().getMonth();
  const { name: seasonName, months, Icon: SeasonIcon } = getSASeason(month);
  const [crops, setCrops] = useState<string[]>(DEFAULT_CROPS);
  const [input, setInput] = useState('');

  function addCrop() {
    const name = input.trim();
    if (!name || crops.includes(name)) { setInput(''); return; }
    setCrops((c) => [...c, name]);
    setInput('');
  }

  const sorted = [...crops].sort((a, b) => {
    const order: Record<Suitability, number> = { best: 0, soon: 1, off: 2 };
    return order[getSuitability(a, seasonName)] - order[getSuitability(b, seasonName)];
  });

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
        <SettingsButton />
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 py-5 space-y-5">

          {/* Season card */}
          <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: '#1F4D2B', boxShadow: '0 4px 16px rgba(31,77,43,0.28)' }}>
            <div className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 44, height: 44, background: 'rgba(234,243,226,0.15)', color: '#EAF3E2' }}>
              <SeasonIcon size={20} strokeWidth={1.6} />
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-widest" style={{ color: 'rgba(234,243,226,0.55)', letterSpacing: '0.1em' }}>Current season</div>
              <div className="font-display font-bold text-xl mt-0.5" style={{ color: '#F7F2E9', letterSpacing: '-0.02em' }}>{seasonName}</div>
              <div className="text-xs font-sans mt-0.5" style={{ color: 'rgba(234,243,226,0.65)' }}>{months} · South Africa</div>
            </div>
          </div>

          {/* Lima tip */}
          <div className="rounded-xl px-4 py-3 flex gap-3 items-start" style={{ background: 'rgba(31,77,43,0.06)', border: '1px solid rgba(31,77,43,0.12)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#1F4D2B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }}>
              <path d="M12 21V11" /><path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z" /><path d="M12 13c0-3 2.2-5.2 6-5.2 0 3.6-2.2 5.2-6 5.2Z" />
            </svg>
            <p className="text-xs font-display leading-relaxed" style={{ color: '#20190F' }}>
              Lima: {LIMA_TIPS[seasonName]}
            </p>
          </div>

          {/* Crops */}
          <section>
            <div className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: '#8C7A62', letterSpacing: '0.10em' }}>My crops</div>
            <div className="rounded-2xl overflow-hidden" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
              {sorted.map((crop, i) => {
                const suit = getSuitability(crop, seasonName);
                const badge = BADGE[suit];
                return (
                  <div key={crop} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: i < sorted.length - 1 ? '1px solid #E2D8C4' : 'none' }}>
                    <Leaf size={15} style={{ color: '#1F4D2B', flexShrink: 0, opacity: suit === 'off' ? 0.3 : 1 }} />
                    <span className="flex-1 font-display text-sm" style={{ color: suit === 'off' ? '#8C7A62' : '#20190F' }}>{crop}</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color, flexShrink: 0 }}>{badge.label}</span>
                    <button onClick={() => setCrops((c) => c.filter((x) => x !== crop))} className="opacity-30 hover:opacity-70 transition-opacity flex-shrink-0" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#5C5040' }} aria-label={`Remove ${crop}`}>
                      <Trash2 size={13} />
                    </button>
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

          <p className="text-center text-xs font-mono pb-2" style={{ color: '#8C7A62' }}>Seasons for South Africa · southern hemisphere</p>
        </div>
      </div>

      <TabBar />
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { TreeDeciduous, Sprout, Apple, Cherry, Nut, Bird, Loader2 } from 'lucide-react';
import type { LocationData } from '@/lib/types';

interface PlantEntry { name: string; localName?: string; role?: string; notes?: string; season?: string }
interface AnimalEntry { type: string; breeds?: string; notes: string; scale: 'Micro' | 'Small' | 'Medium' | 'Large' }
interface LifeGuideData {
  ecosystem: string;
  indigenousPlants: PlantEntry[];
  vegetables: PlantEntry[];
  fruitTrees: PlantEntry[];
  indigenousFruit: PlantEntry[];
  nuts: PlantEntry[];
  animals: AnimalEntry[];
}

const SCALE_COLOR: Record<string, string> = {
  Micro:  'rgba(31,77,43,0.12)',
  Small:  'rgba(31,77,43,0.20)',
  Medium: 'rgba(192,122,30,0.16)',
  Large:  'rgba(192,122,30,0.28)',
};

function SectionHead({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mt-5 mb-2">
      <span style={{ color: '#C07A1E' }}>{icon}</span>
      <span className="text-xs font-mono uppercase tracking-wider font-semibold" style={{ color: '#C07A1E' }}>{label}</span>
    </div>
  );
}

function Chip({ label, dim }: { label: string; dim?: boolean }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-mono"
      style={{ background: dim ? 'rgba(140,122,98,0.12)' : 'rgba(31,77,43,0.10)', color: dim ? '#8C7A62' : '#1F4D2B' }}
    >
      {label}
    </span>
  );
}

function PlantRow({ p }: { p: PlantEntry }) {
  return (
    <div className="py-2" style={{ borderBottom: '1px solid rgba(226,216,196,0.6)' }}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-xs font-display font-semibold" style={{ color: '#20190F' }}>{p.name}</span>
        {p.localName && <span className="text-xs font-mono" style={{ color: '#8C7A62' }}>{p.localName}</span>}
        {p.season && <Chip label={p.season} />}
      </div>
      {(p.role || p.notes) && (
        <p className="text-xs font-display leading-relaxed mt-0.5" style={{ color: '#5C5040' }}>{p.role ?? p.notes}</p>
      )}
    </div>
  );
}

function AnimalCard({ a }: { a: AnimalEntry }) {
  return (
    <div
      className="rounded-xl p-3 mb-2"
      style={{ background: '#FBF6EC', border: '1px solid rgba(226,216,196,0.8)' }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-display font-semibold" style={{ color: '#20190F' }}>{a.type}</span>
        <span
          className="text-xs font-mono px-2 py-0.5 rounded-full"
          style={{ background: SCALE_COLOR[a.scale] ?? SCALE_COLOR.Small, color: '#5C5040' }}
        >
          {a.scale}
        </span>
      </div>
      {a.breeds && (
        <p className="text-xs font-mono mb-1" style={{ color: '#C07A1E' }}>{a.breeds}</p>
      )}
      <p className="text-xs font-display leading-relaxed" style={{ color: '#5C5040' }}>{a.notes}</p>
    </div>
  );
}

function SkeletonLine({ w }: { w: string }) {
  return <div className="h-3 rounded-full animate-pulse" style={{ width: w, background: 'rgba(226,216,196,0.7)' }} />;
}

export default function LifeGuide({ locationData }: { locationData: LocationData | null }) {
  const [data, setData] = useState<LifeGuideData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fetched = useRef<string>('');

  useEffect(() => {
    if (!locationData?.biome) return;
    const key = `${locationData.biome.code}:${locationData.rainfall.annual}`;
    if (fetched.current === key || data) return;
    fetched.current = key;
    setLoading(true);
    setError('');
    fetch('/api/life-guide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationData }),
    })
      .then((r) => r.json())
      .then((d: LifeGuideData) => { setData(d); setLoading(false); })
      .catch(() => { setError('Could not load — check connection'); setLoading(false); });
  }, [locationData, data]);

  if (!locationData) {
    return <p className="text-xs font-display text-center py-8" style={{ color: '#8C7A62' }}>Select a location on the map first</p>;
  }

  if (loading) {
    return (
      <div className="space-y-3 py-2">
        <div className="flex items-center gap-2 mb-3">
          <Loader2 size={14} className="animate-spin" style={{ color: '#C07A1E' }} />
          <span className="text-xs font-mono" style={{ color: '#8C7A62' }}>Building your living systems guide...</span>
        </div>
        {[80, 60, 90, 50, 70].map((w, i) => <SkeletonLine key={i} w={`${w}%`} />)}
      </div>
    );
  }

  if (error) return <p className="text-xs font-display py-4 text-center" style={{ color: '#D4922A' }}>{error}</p>;

  if (!data) return null;

  return (
    <div className="pb-4">
      {/* Biome header */}
      <div className="rounded-xl p-3 mb-1" style={{ background: 'rgba(31,77,43,0.06)', border: '1px solid rgba(31,77,43,0.15)' }}>
        <div className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: '#1F4D2B' }}>
          {locationData.biome.name}
        </div>
        <p className="text-xs font-display leading-relaxed" style={{ color: '#3A2E22' }}>{data.ecosystem}</p>
      </div>

      {/* Indigenous plants */}
      <SectionHead icon={<TreeDeciduous size={14} />} label="Indigenous plants to include" />
      <div>
        {data.indigenousPlants.map((p, i) => <PlantRow key={i} p={p} />)}
      </div>

      {/* Vegetables */}
      <SectionHead icon={<Sprout size={14} />} label="Vegetables for this climate" />
      <div className="grid grid-cols-2 gap-1.5">
        {data.vegetables.map((v, i) => (
          <div key={i} className="rounded-lg p-2" style={{ background: '#FBF6EC', border: '1px solid rgba(226,216,196,0.8)' }}>
            <p className="text-xs font-display font-semibold" style={{ color: '#20190F' }}>{v.name}</p>
            {v.season && <p className="text-xs font-mono mt-0.5" style={{ color: '#C07A1E', fontSize: 10 }}>{v.season}</p>}
            {v.notes && <p className="text-xs font-display mt-0.5 leading-snug" style={{ color: '#8C7A62', fontSize: 10 }}>{v.notes}</p>}
          </div>
        ))}
      </div>

      {/* Fruit trees */}
      <SectionHead icon={<Apple size={14} />} label="Fruit trees" />
      <div className="flex flex-wrap gap-1.5">
        {data.fruitTrees.map((f, i) => (
          <div key={i} className="rounded-lg px-2.5 py-1.5" style={{ background: '#FBF6EC', border: '1px solid rgba(226,216,196,0.8)' }}>
            <p className="text-xs font-display font-medium" style={{ color: '#20190F' }}>{f.name}</p>
            {f.notes && <p className="text-xs font-mono leading-snug" style={{ color: '#8C7A62', fontSize: 10 }}>{f.notes}</p>}
          </div>
        ))}
      </div>

      {/* Indigenous fruit */}
      <SectionHead icon={<Cherry size={14} />} label="Indigenous fruit" />
      <div>
        {data.indigenousFruit.map((p, i) => <PlantRow key={i} p={{ ...p, role: p.notes }} />)}
      </div>

      {/* Nuts */}
      <SectionHead icon={<Nut size={14} />} label="Nut trees &amp; crops" />
      <div className="flex flex-wrap gap-1.5">
        {data.nuts.map((n, i) => (
          <div key={i} className="rounded-lg px-2.5 py-1.5" style={{ background: '#FBF6EC', border: '1px solid rgba(226,216,196,0.8)' }}>
            <p className="text-xs font-display font-medium" style={{ color: '#20190F' }}>{n.name}</p>
            {n.notes && <p className="text-xs font-mono leading-snug" style={{ color: '#8C7A62', fontSize: 10 }}>{n.notes}</p>}
          </div>
        ))}
      </div>

      {/* Animals */}
      <SectionHead icon={<Bird size={14} />} label="Animal systems" />
      <div>
        {data.animals.map((a, i) => <AnimalCard key={i} a={a} />)}
      </div>
    </div>
  );
}

'use client';
import { useState } from 'react';

/** Illustrative canvas only: never georeferenced or written into a farmer's design. */
export default function SampleGardenVisual({ name = 'Demonstration garden', initial = 'design', kind = 'Community garden', variant = name }: { name?: string; initial?: 'design' | 'aerial'; kind?: string; variant?: string }) {
  const [view, setView] = useState(initial);
  const seed = [...variant].reduce((n, c) => n + c.charCodeAt(0), 0);
  const rows = /Commercial/.test(kind) ? 5 : /Homestead|Crèche/.test(kind) ? 2 : 3 + seed % 2;
  const columns = /Commercial/.test(kind) ? 3 : 2;
  const building = /School/.test(kind) ? 'School' : /Crèche/.test(kind) ? 'Crèche' : /Homestead/.test(kind) ? 'Home' : 'Store';
  return <section style={{ background: '#eef2e7', padding: 12, height: '100%', overflow: 'auto' }} aria-label="Fictional garden visual">
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}><strong style={{ flex: 1, color: '#234d35' }}>{name}</strong>{(['design', 'aerial'] as const).map(v => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} style={{ padding: '10px 14px', borderRadius: 20, border: '1px solid #9bad9b', background: view === v ? '#214d35' : '#fff', color: view === v ? '#fff' : '#214d35', fontSize: 13 }}>{v === 'design' ? 'Design' : 'Simulated aerial'}</button>)}</div>
    <div style={{ position: 'relative', aspectRatio: '1', maxWidth: 780, margin: 'auto', borderRadius: 16, overflow: 'hidden', background: '#fff' }}>
      {view === 'aerial' ? <img src="/demo/aerial.webp" alt="AI-generated aerial view of an invented garden; not real satellite evidence" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <svg viewBox="0 0 600 600" role="img" aria-label="Fictional demonstration design with building, tank, vegetable beds, staple plots and trees" style={{ width: '100%', height: '100%' }}>
        <rect width="600" height="600" fill="#fafbf4" /><path d="M105 65 L490 65 L535 510 L105 505 Z" fill="#e5ecd9" stroke="#53764b" strokeWidth="3" strokeDasharray="8 4" />
        <path d="M70 0V600" stroke="#ddccb0" strokeWidth="32" /><path d="M145 90V450 M145 172H330V485 M145 335H495" stroke="#f7edda" strokeWidth="18" fill="none" />
        <rect x="160" y="85" width="90" height="62" rx="4" fill="#bba887" stroke="#786b54" strokeWidth="3" /><path d="M156 92L205 68L255 92" fill="#7a8a8a" /><text x="205" y="125" textAnchor="middle" fontSize="14" fill="#25382a">{building}</text>
        <circle cx="283" cy="118" r="20" fill="#5b94b3" stroke="#fff" strokeWidth="3" /><text x="283" y="154" textAnchor="middle" fontSize="14">Tank</text>
        {Array.from({ length: rows }, (_, row) => row).flatMap(row => Array.from({ length: columns }, (_, col) => col).map(col => <g key={`${row}-${col}`}><rect x={185+col*48} y={205+row*28} width="38" height="22" rx="5" fill={['#a6bd7c', '#b4c58b', '#8eb889'][seed % 3]} stroke="#7d6545" strokeWidth="3" />{[0,1,2].map(n => <path key={n} d={`M${192+col*48+n*10} ${209+row*28}v13`} stroke="#527b44" strokeWidth="5" />)}</g>))}
        <text x="250" y="365" textAnchor="middle" fontSize="16" fill="#214d35">Vegetable beds</text>
        {[0,1].map(c => <g key={c}><rect x={344+c*68} y="371" width="58" height="105" rx="5" fill={c ? '#b9cfa0' : '#c6c389'} stroke="#809458" strokeWidth="2" />{[0,1,2,3].map(n => <path key={n} d={`M${352+c*68+n*12} 380v87`} stroke="#69914e" strokeWidth="4" />)}</g>)}
        <text x="405" y="495" textAnchor="middle" fontSize="16" fill="#214d35">Staple plots</text>
        {[[378,125],[445,191],[440,277],[224,431]].map(([x,y],i)=><g key={i}><circle cx={x} cy={y} r="29" fill="#789e58" /><circle cx={x-10} cy={y-8} r="20" fill="#98b46c" /><circle cx={x+8} cy={y+9} r="18" fill="#527c44" /></g>)}
        <text x="435" y="325" textAnchor="middle" fontSize="15" fill="#214d35">Trees</text><text x="300" y="553" textAnchor="middle" fontSize="15" fill="#54614c">Illustrative layout · not measured · no real coordinates</text>
      </svg>}
      {view === 'aerial' && <span style={{ position: 'absolute', left: '49%', top: '48%', width: 26, height: 26, borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', background: '#c2761a', border: '3px solid white', boxShadow: '0 2px 7px #0008' }} />}
    </div>
    <p style={{ fontSize: 12, color: '#3f533e', marginTop: 10 }}>{kind} · fictional illustrative layout. The aerial is a shared AI-generated example, not satellite evidence or a surveyed design.</p>
  </section>;
}

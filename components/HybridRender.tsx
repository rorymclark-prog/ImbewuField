'use client';

import { useRef } from 'react';

// Hybrid render: Gemini supplies the glossy styled map image; WE overlay a crisp,
// always-legible legend rail + title (vector text) on top — best of both. The
// opaque panels cover whatever (garbled) text Gemini may have drawn underneath.
const ZONES: { n: string; label: string; c: string }[] = [
  { n: '0', label: 'House', c: '#3A352C' },
  { n: '1', label: 'Daily use', c: '#B53A3A' },
  { n: '2', label: 'Intensive', c: '#C66A1C' },
  { n: '3', label: 'Orchard / food forest', c: '#9B8B1E' },
  { n: '4', label: 'Low-care', c: '#2F7A4A' },
  { n: '5', label: 'Conservation / buffer', c: '#1F6E5A' },
];

export default function HybridRender({
  imageDataUrl,
  placeName,
  biome,
  rainfallMm,
  soilTexture,
  filename,
}: {
  imageDataUrl: string;
  placeName: string;
  biome?: string;
  rainfallMm?: number;
  soilTexture?: string;
  filename: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const notes = [biome, rainfallMm ? `${rainfallMm} mm/yr` : '', soilTexture ? `${soilTexture} soil` : '']
    .filter(Boolean)
    .join(' · ');

  async function download() {
    const svg = svgRef.current;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = 2000;
        c.height = 2000;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 2000, 2000);
          const a = document.createElement('a');
          a.href = c.toDataURL('image/png');
          a.download = filename;
          a.click();
        }
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      img.src = url;
    });
  }

  const railX = 718;
  const railW = 266;

  return (
    <div className="space-y-1">
      <svg ref={svgRef} viewBox="0 0 1000 1000" width="100%" style={{ borderRadius: 14, border: '2px solid #F7C97E', display: 'block' }}>
        <image href={imageDataUrl} x={0} y={0} width={1000} height={1000} preserveAspectRatio="xMidYMid slice" />

        {/* Title card */}
        <rect x={20} y={20} width={372} height={84} rx={12} fill="rgba(11,18,11,0.82)" />
        <text x={36} y={52} fontFamily="Georgia, serif" fontWeight="800" fontSize="24" fill="#FFFFFF">{placeName}</text>
        <text x={36} y={76} fontFamily="Helvetica, Arial, sans-serif" fontSize="13" fill="#D9E8C9">Permaculture Design Map</text>
        {notes && <text x={36} y={94} fontFamily="Helvetica, Arial, sans-serif" fontSize="11" fill="#A9C7A0">{notes}</text>}

        {/* Legend rail */}
        <rect x={railX} y={20} width={railW} height={960} rx={16} fill="rgba(18,26,16,0.9)" stroke="#F7C97E" strokeWidth="1.2" />
        <text x={railX + 18} y={52} fontFamily="Georgia, serif" fontWeight="800" fontSize="16" fill="#F7C97E" letterSpacing="0.04em">DESIGN LEGEND</text>
        <text x={railX + 18} y={84} fontFamily="Helvetica, Arial, sans-serif" fontWeight="800" fontSize="11" fill="#C9B48E" letterSpacing="0.08em">ZONES</text>
        {ZONES.map((z, i) => {
          const y = 104 + i * 30;
          return (
            <g key={z.n}>
              <circle cx={railX + 26} cy={y} r={9} fill={z.c} />
              <text x={railX + 26} y={y + 3.5} textAnchor="middle" fontFamily="Helvetica, Arial, sans-serif" fontWeight="800" fontSize="10" fill="#FFFFFF">{z.n}</text>
              <text x={railX + 44} y={y + 4} fontFamily="Helvetica, Arial, sans-serif" fontSize="12" fill="#E6DAC2">{z.label}</text>
            </g>
          );
        })}
        <text x={railX + 18} y={314} fontFamily="Helvetica, Arial, sans-serif" fontWeight="800" fontSize="11" fill="#C9B48E" letterSpacing="0.08em">ACCESS & WATER</text>
        {['Driveway / vehicle access', 'Footpaths', 'Runoff → swales → tank', 'Rainwater harvesting'].map((t, i) => (
          <text key={i} x={railX + 18} y={336 + i * 20} fontFamily="Helvetica, Arial, sans-serif" fontSize="11.5" fill="#C8D4C0">• {t}</text>
        ))}
        <text x={railX + 18} y={440} fontFamily="Helvetica, Arial, sans-serif" fontWeight="800" fontSize="11" fill="#C9B48E" letterSpacing="0.08em">NOTES</text>
        {[biome ?? 'Permaculture design', notes, 'Focus: food, water, soil, biodiversity', 'AI visualisation — confirm on the ground'].filter(Boolean).map((t, i) => (
          <text key={i} x={railX + 18} y={462 + i * 17} fontFamily="Helvetica, Arial, sans-serif" fontSize="10" fill="#A9BCA0">{t}</text>
        ))}
        <text x={railX + 18} y={958} fontFamily="Helvetica, Arial, sans-serif" fontSize="9" fill="#7E8E76">ImbewuField · WGS 84</text>
      </svg>
      <div className="flex items-center justify-end">
        <button onClick={download} className="text-xs font-semibold" style={{ color: '#F7C97E', background: 'none', border: 'none', cursor: 'pointer' }}>
          Download hybrid ↓
        </button>
      </div>
    </div>
  );
}

import React from 'react';
import { SPECIES } from '@/lib/species-catalog';
import { sectionedPaletteFor, broadReachPalette, type Species } from '@/lib/species-palette';
import { useLanguage } from '@/lib/i18n';

interface SpeciesPickerProps {
  siteBiome?: string;
  selectedSpeciesId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export default function SpeciesPicker({
  siteBiome,
  selectedSpeciesId,
  onSelect,
  onClose,
}: SpeciesPickerProps) {
  const { t } = useLanguage();

  const sections = siteBiome
    ? sectionedPaletteFor(SPECIES, siteBiome)
    : [{ section: 'Broad-reach species (site climate unknown)', species: broadReachPalette(SPECIES) }];

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        right: 0,
        maxHeight: '45dvh',
        background: '#FFFEFA',
        borderTop: '1px solid rgba(0,0,0,0.1)',
        boxShadow: '0 -4px 12px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
      }}
    >
      <div style={{ padding: '8px 12px', background: '#F8F5EE', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, color: '#0B120B' }}>Plant Catalog</h3>
          <p style={{ margin: 0, fontSize: 11, color: '#A9743F', fontWeight: 600 }}>
            {siteBiome ? `Filtered for ${siteBiome} biome` : 'Showing broad-reach species'}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, color: '#0B120B' }}
        >
          ✕
        </button>
      </div>

      {/* Honesty banner */}
      <div style={{ padding: '6px 12px', background: '#FFF3CD', color: '#856404', fontSize: 11.5, borderBottom: '1px solid #FFEEBA' }}>
        <strong>Note:</strong> Not yet agronomist-reviewed. Use as a starting point.
      </div>

      <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: 12 }}>
        {sections.map((sec) => (
          <div key={sec.section} style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 13, color: '#2F7A4A', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {sec.section}
            </h4>
            <div style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 6, overflow: 'hidden' }}>
              {sec.species.map((s, idx) => {
                const isSelected = selectedSpeciesId === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => onSelect(s.id)}
                    style={{
                      padding: 8,
                      background: isSelected ? '#E6F4EA' : (idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA'),
                      borderBottom: idx < sec.species.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#0B120B' }}>{s.commonName}</div>
                        <div style={{ fontStyle: 'italic', fontSize: 11.5, color: '#555' }}>{s.botanicalName}</div>
                      </div>
                      <div style={{ fontSize: 11.5, color: '#555', textAlign: 'right' }}>
                        {s.matureHeightM}m h × {s.matureWidthM}m w
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {s.uses.map(u => (
                        <span key={u} style={{ background: '#E0E0E0', borderRadius: 4, padding: '2px 6px', fontSize: 10, color: '#333' }}>
                          {u}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import React from 'react';
import { SPECIES } from '@/lib/species-catalog';
import { sectionedPaletteFor, broadReachPalette, type Species } from '@/lib/species-palette';
import { BIOMES } from '@/lib/biome';
import { useLanguage } from '@/lib/i18n';

interface SpeciesPickerProps {
  /** A lib/biome.ts BIOMES registry key ("IOCB"), never the display name — see biomeKeyForName. */
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
  // The registry key is what filtering needs; the farmer reads its name, not "IOCB".
  const siteBiomeName = siteBiome ? (BIOMES[siteBiome]?.name ?? siteBiome) : undefined;

  return (
    <div
      style={{
        // No positioning of its own: the caller (DesignPalette's portal wrapper) already owns
        // position/size/background/shadow/z-index. This double-owned the job once — this div was
        // `position:absolute` too, sized from a parent whose own height came from THIS div (since
        // an absolutely-positioned child contributes nothing to its parent's intrinsic size) —
        // a circular sizing dependency that collapsed the whole panel to 2x2px with no error
        // anywhere. Just fill the space the caller already gives it.
        //
        // `flex:1 1 auto` + `minHeight:0` rather than `height:100%`: the wrapper only sets
        // maxHeight (not height), so a percentage height here resolves to auto per CSS's
        // indefinite-containing-block rule and this div grows to its full content size —
        // which the wrapper then hard-clips via overflow:hidden with no scrollbar at all.
        // Flex sizing (not percentage resolution) is what actually respects the wrapper's
        // clamped size, and minHeight:0 removes the flex-item auto-min-size floor that would
        // otherwise still refuse to shrink below full content height.
        width: '100%',
        flex: '1 1 auto',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ flexShrink: 0, padding: '8px 12px', background: '#F8F5EE', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, color: '#0B120B' }}>Plant Catalog</h3>
          <p style={{ margin: 0, fontSize: 11, color: '#A9743F', fontWeight: 600 }}>
            {siteBiomeName ? `Filtered for ${siteBiomeName} biome` : 'Showing broad-reach species'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('designClose')}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, color: '#0B120B', minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ✕
        </button>
      </div>

      {/* Honesty banner */}
      <div style={{ flexShrink: 0, padding: '6px 12px', background: '#FFF3CD', color: '#856404', fontSize: 11.5, borderBottom: '1px solid #FFEEBA' }}>
        <strong>Note:</strong> Not yet agronomist-reviewed. Use as a starting point.
      </div>

      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: 12 }}>
        {sections.map((sec) => (
          <div key={sec.section} style={{ marginBottom: 16 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 13, color: '#2F7A4A', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {sec.section}
            </h4>
            <div style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 6, overflow: 'hidden' }}>
              {sec.species.map((s, idx) => {
                const isSelected = selectedSpeciesId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSelect(s.id)}
                    aria-pressed={isSelected}
                    style={{
                      width: '100%',
                      padding: 8,
                      background: isSelected ? '#E6F4EA' : (idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA'),
                      border: 'none',
                      borderBottom: idx < sec.species.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      textAlign: 'left',
                      font: 'inherit',
                      color: 'inherit',
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
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

// "Variety guidance" in the crop picker: which sourced cultivars were named for an area like
// this site's, then everything else, then the catalog's older generic advice.
//
// The area comes from the site's own climate (lib/growing-zones.ts). Where the climate cannot
// tell two zones apart it names both, and a cultivar counts as "for your area" if its source
// named either. With no site climate the list is shown whole, each card saying which areas
// its source named, and no area is claimed. Advisory only: picking a cultivar here does not
// change sow timing.

import { ExternalLink, MapPin } from 'lucide-react';
import type { CropDef } from '@/lib/crop-catalog';
import { varietiesForSite, cropVarietyRecord, type SourcedVariety, type VarietySource } from '@/lib/crop-varieties';
import { GROWING_ZONES, growingZoneLabel, type GrowingZoneId } from '@/lib/growing-zones';

const labelStyle = { fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' } as const;

function SourceLink({ source }: { source: VarietySource }) {
  const text = `${source.doc}${source.page ? `, p. ${source.page}` : ''}`;
  if (!source.url) {
    return <span title={source.quote} style={{ color: 'var(--text-muted)', fontSize: 11 }}>{text}</span>;
  }
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      title={source.quote}
      className="inline-flex items-center gap-0.5"
      style={{ color: 'var(--blue)', fontSize: 11, textDecoration: 'underline', textUnderlineOffset: 2, overflowWrap: 'anywhere' }}
    >
      {text}
      <ExternalLink size={10} aria-hidden />
    </a>
  );
}

function VarietyCard({ v, showZones }: { v: SourcedVariety; showZones: boolean }) {
  const zoneText = v.zones.length ? v.zones.map((z) => GROWING_ZONES[z].name).join(', ') : 'no area named by the source';
  return (
    <div className="px-2.5 py-2 rounded-lg" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-sans font-semibold" style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{v.name}</span>
        {v.type && (
          <span className="font-sans" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
            {v.type === 'OP' ? 'open-pollinated (seed can be saved)' : 'hybrid'}
          </span>
        )}
      </div>
      {showZones && (
        <div className="font-sans" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Named for: {zoneText}</div>
      )}
      {v.season && <div className="font-sans" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v.season}</div>}
      {v.traits && <div className="font-sans" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v.traits}</div>}
      <div className="mt-0.5">
        <SourceLink source={v.sources[0]} />
        {v.sources.length > 1 && (
          <span className="font-sans" style={{ fontSize: 11, color: 'var(--text-muted)' }}> + {v.sources.length - 1} more</span>
        )}
      </div>
    </div>
  );
}

export function VarietyGuidance({ crop, zones }: { crop: CropDef; zones: readonly GrowingZoneId[] }) {
  const record = cropVarietyRecord(crop.key);
  const site = varietiesForSite(crop.key, zones);
  const sourcedNames = new Set((record?.varieties ?? []).map((v) => v.name.toLowerCase()));
  // The catalog's generic advice, minus any cultivar the dossier now carries with a source.
  const general = (crop.varieties ?? []).filter((v) => !sourcedNames.has(v.name.toLowerCase()));
  const hasSourced = (record?.varieties.length ?? 0) > 0 || site.advice.length > 0;
  if (!hasSourced && general.length === 0) return null;
  const knowsArea = zones.length > 0;

  return (
    <div className="mb-3">
      <div className="font-sans uppercase tracking-widest mb-1.5" style={labelStyle}>Variety guidance</div>

      {knowsArea && (
        <div className="font-sans mb-1.5 inline-flex items-start gap-1.5" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          <MapPin size={13} aria-hidden style={{ flexShrink: 0, marginTop: 2, color: 'var(--emerald)' }} />
          <span>Your area, from this site&rsquo;s climate: <strong style={{ color: 'var(--text-primary)' }}>{growingZoneLabel(zones)}</strong></span>
        </div>
      )}

      {site.advice.map(({ zone, advice }) => (
        <div key={zone} className="px-2.5 py-2 rounded-lg mb-1.5" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
          <div className="font-sans font-semibold" style={{ fontSize: 11.5, color: 'var(--text-primary)' }}>{GROWING_ZONES[zone].name}</div>
          <div className="font-sans" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{advice.text}</div>
          <SourceLink source={advice.sources[0]} />
        </div>
      ))}

      {knowsArea ? (
        <>
          {site.forYourArea.length > 0 ? (
            <div className="space-y-1.5">
              {site.forYourArea.map((v) => <VarietyCard key={v.name} v={v} showZones={false} />)}
            </div>
          ) : (record?.varieties.length ?? 0) > 0 && (
            <p className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              None of the sources named a variety for your area. The ones below were named for other areas or none.
            </p>
          )}
          {site.others.length > 0 && (
            <details className="mt-1.5">
              <summary className="font-sans" style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                Other varieties ({site.others.length})
              </summary>
              <div className="space-y-1.5 mt-1.5">
                {site.others.map((v) => <VarietyCard key={v.name} v={v} showZones />)}
              </div>
            </details>
          )}
        </>
      ) : (
        (record?.varieties.length ?? 0) > 0 && (
          <div className="space-y-1.5">
            {record!.varieties.map((v) => <VarietyCard key={v.name} v={v} showZones />)}
          </div>
        )
      )}

      {general.length > 0 && (
        <div className="space-y-1.5 mt-1.5">
          {general.map((v) => (
            <div key={v.name} className="px-2.5 py-2 rounded-lg" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
              <div className="font-sans font-semibold" style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{v.name}</div>
              <div className="font-sans" style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 2 }}>General guidance · best for: {v.bestFor}</div>
              <div className="font-sans" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v.note}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

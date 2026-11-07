'use client';

// Research options in the crop picker: a broad climate shortlist, then other references.
// The dossiers include inferred area groupings; dropping their caveats during generation
// must not turn them into a claim that these varieties were tested on this farm.
//
// The area comes from the site's own climate (lib/growing-zones.ts). Where the climate cannot
// tell two zones apart it names both, and a cultivar enters the shortlist when the research
// groups it with either. With no site climate the list is shown whole and no local fit is
// claimed. Recording a cultivar does not change general crop timing.

import { ExternalLink, MapPin } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { inlineText, inlineTemplate } from '@/lib/xh-inline';
import type { CropDef } from '@/lib/crop-catalog';
import { varietiesForSite, cropVarietyRecord, type SourcedVariety, type VarietySource } from '@/lib/crop-varieties';
import { GROWING_ZONES, growingAreaText, growingZoneLabelText, type GrowingZoneId } from '@/lib/growing-zones';

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
  const { lang } = useLanguage();
  const zoneText = v.zones.length ? v.zones.map((z) => growingAreaText(lang, GROWING_ZONES[z].name)).join(', ') : inlineText(lang, 'no climate grouping recorded');
  return (
    <div className="px-2.5 py-2 rounded-lg" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-sans font-semibold" style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{v.name}</span>
      </div>
      {showZones && (
        <div className="font-sans" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inlineTemplate(lang, 'Research grouping: {zones}', null, { zones: zoneText })}</div>
      )}
      <div className="mt-0.5">
        <SourceLink source={v.sources[0]} />
        {v.sources.length > 1 && (
          <span className="font-sans" style={{ fontSize: 11, color: 'var(--text-muted)' }}> {inlineTemplate(lang, '+ {n} more', null, { n: v.sources.length - 1 })}</span>
        )}
      </div>
    </div>
  );
}

export function VarietyGuidance({ crop, zones }: { crop: CropDef; zones: readonly GrowingZoneId[] }) {
  const { lang } = useLanguage();
  const ui = (english: string) => inlineText(lang, english);
  const record = cropVarietyRecord(crop.key);
  const site = varietiesForSite(crop.key, zones);
  const sourcedNames = new Set((record?.varieties ?? []).map((v) => v.name.toLowerCase()));
  // Legacy catalogue labels remain visible, but their unverified seasonal summaries must
  // not overrule a current supplier bulletin (Scarlet Nantes exposed that conflict).
  const general = (crop.varieties ?? []).filter((v) => !sourcedNames.has(v.name.toLowerCase()));
  const hasSourced = (record?.varieties.length ?? 0) > 0 || site.advice.length > 0;
  if (!hasSourced && general.length === 0) return null;
  const knowsArea = zones.length > 0;

  return (
    <div className="mb-3">
      <div className="font-sans uppercase tracking-widest mb-1.5" style={labelStyle}>{ui('Variety guidance')}</div>
      <p className="font-sans mb-2" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {ui('Research groups these options by broad climate. Some matches are inferred, rather than tested locally. Confirm the variety, sowing season, soil, water and current availability with a local grower or supplier. Recording a name does not change the crop’s general calendar.')}
      </p>

      {knowsArea && (
        <div className="font-sans mb-1.5 inline-flex items-start gap-1.5" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          <MapPin size={13} aria-hidden style={{ flexShrink: 0, marginTop: 2, color: 'var(--emerald)' }} />
          <span>{ui('Possible climate areas:')} <strong style={{ color: 'var(--text-primary)' }}>{growingZoneLabelText(zones, lang)}</strong></span>
        </div>
      )}

      {site.advice.map(({ zone, advice }) => (
        <div key={zone} className="px-2.5 py-2 rounded-lg mb-1.5" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
          <div className="font-sans font-semibold" style={{ fontSize: 11.5, color: 'var(--text-primary)' }}>{inlineTemplate(lang, 'Research note: {zone}', null, { zone: growingAreaText(lang, GROWING_ZONES[zone].name) })}</div>
          <SourceLink source={advice.sources[0]} />
        </div>
      ))}

      {knowsArea ? (
        <>
          {site.forYourArea.length > 0 ? (
            <div className="space-y-1.5">
              <div className="font-sans font-semibold" style={{ fontSize: 12, color: 'var(--text-primary)' }}>{ui('Shortlist for areas like yours')}</div>
              {site.forYourArea.map((v) => <VarietyCard key={v.name} v={v} showZones={false} />)}
            </div>
          ) : (record?.varieties.length ?? 0) > 0 && (
            <p className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {ui('No climate shortlist is recorded for these possible areas. Other research options are below; confirm local fit.')}
            </p>
          )}
          {site.others.length > 0 && (
            <details className="mt-1.5">
              <summary className="font-sans" style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                {inlineTemplate(lang, 'Other varieties ({n})', null, { n: site.others.length })}
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
            <p className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ui('No site climate is confirmed. These are research references; no local fit is claimed.')}</p>
            {record!.varieties.map((v) => <VarietyCard key={v.name} v={v} showZones />)}
          </div>
        )
      )}

      {general.length > 0 && (
        <div className="space-y-1.5 mt-1.5">
          <div className="font-sans font-semibold" style={{ fontSize: 12, color: 'var(--text-primary)' }}>{ui('Catalogue references')}</div>
          {general.map((v) => (
            <div key={v.name} className="px-2.5 py-2 rounded-lg" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
              <div className="font-sans font-semibold" style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{v.name}</div>
              <div className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ui('Confirm this option against the current packet or supplier guide.')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

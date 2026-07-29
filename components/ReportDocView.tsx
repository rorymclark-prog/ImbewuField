'use client';

import type {
  ReportDoc,
  ReportSectionId,
  MapRef,
  Valued,
  ExecutiveSummary,
  ExistingSite,
  WaterSection,
  LandscapeSoil,
  SectorAnalysis,
  ZoneEntry,
  DesignFeature,
  PlantingTable,
  ImplementationPhase,
  CostLine,
  MonitoringMetric,
} from '@/lib/report-doc';

const MAP_LABEL: Record<MapRef, string> = {
  base: 'Base',
  water: 'Water',
  sector: 'Sector',
  zone: 'Zone',
  design: 'Design',
  implementation: 'Implementation',
};

const GREEN = '#1F4D2B';
const ORANGE = '#C07A1E';

function Chip({ v }: { v?: Valued }) {
  if (!v) return null;
  const isEst = v.provenance === 'estimated';
  return (
    <span
      title={v.basis ?? v.provenance}
      style={{
        display: 'inline-block',
        marginLeft: 6,
        padding: '1px 6px',
        borderRadius: 8,
        fontSize: 10,
        fontWeight: 700,
        background: isEst ? 'rgba(192,122,30,0.16)' : 'rgba(31,77,43,0.12)',
        color: isEst ? '#9E5C08' : GREEN,
      }}
    >
      {v.value}
      {v.unit ? ` ${v.unit}` : ''}
      {isEst ? ' · ~est.' : ''}
    </span>
  );
}

function SectionShell({
  title,
  map,
  status,
  onViewMap,
  children,
}: {
  title: string;
  map: MapRef;
  status: string;
  onViewMap: (m: MapRef) => void;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 18, borderTop: '1px solid rgba(98,83,61,0.18)', paddingTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <h3 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 17, color: GREEN, margin: 0 }}>
          {title}
          {status === 'enriching' && (
            <span style={{ fontSize: 10, color: ORANGE, marginLeft: 8 }}>enriching…</span>
          )}
        </h3>
        <button
          onClick={() => onViewMap(map)}
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: GREEN,
            background: '#FBF7ED',
            border: '1px solid rgba(98,83,61,0.18)',
            borderRadius: 999,
            padding: '4px 10px',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
        >
          View {MAP_LABEL[map]} map →
        </button>
      </div>
      <div style={{ fontSize: 13, color: '#2E2A22', lineHeight: 1.5 }}>{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (!items?.length) return null;
  return (
    <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
      {items.map((t, i) => (
        <li key={i} style={{ marginBottom: 3 }}>{t}</li>
      ))}
    </ul>
  );
}

export default function ReportDocView({
  doc,
  onViewMap,
}: {
  doc: ReportDoc;
  onViewMap: (m: MapRef) => void;
}) {
  const s = doc.sections;
  const metaFor = (id: ReportSectionId) => doc.sectionsMeta.find((m) => m.id === id);

  const exec = s.executive as ExecutiveSummary | undefined;
  const site = s['existing-site'] as ExistingSite | undefined;
  const water = s.water as WaterSection | undefined;
  const soil = s['landscape-soil'] as LandscapeSoil | undefined;
  const sector = s.sector as SectorAnalysis | undefined;
  const zones = s.zone as ZoneEntry[] | undefined;
  const master = s['master-design'] as DesignFeature[] | undefined;
  const planting = s.planting as PlantingTable[] | undefined;
  const impl = s.implementation as ImplementationPhase[] | undefined;
  const costs = s['cost-labour'] as CostLine[] | undefined;
  const monitoring = s.monitoring as MonitoringMetric[] | undefined;

  return (
    <div style={{ background: '#FAF5EA', borderRadius: 16, border: '1px solid rgba(98,83,61,0.18)', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 20, color: '#20190F', margin: 0 }}>
          Site Report
        </h2>
        <span style={{ fontSize: 11, color: '#7B6A52' }}>{doc.name}</span>
      </div>
      <p style={{ fontSize: 11, color: '#7B6A52', marginTop: 0, marginBottom: 6 }}>
        Each section links to its map. Amber chips are estimates — confirm on the ground.
      </p>

      {/* quick section nav */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {doc.sectionsMeta.map((m) => (
          <a
            key={m.id}
            href={`#sec-${m.id}`}
            style={{
              fontSize: 10.5,
              color: GREEN,
              background: '#FBF7ED',
              border: '1px solid rgba(98,83,61,0.18)',
              borderRadius: 999,
              padding: '3px 8px',
              textDecoration: 'none',
              opacity: s[m.id] ? 1 : 0.4,
            }}
          >
            {m.title}
          </a>
        ))}
      </div>

      {exec && (
        <div id="sec-executive">
          <SectionShell title="Executive Summary" map="design" status={metaFor('executive')?.status ?? 'skeleton'} onViewMap={onViewMap}>
            <p style={{ marginTop: 0 }}>{exec.farmOverview}</p>
            {exec.regenScore && (
              <p style={{ margin: '4px 0' }}>
                Regenerative potential<Chip v={exec.regenScore} />
              </p>
            )}
            <p style={{ fontWeight: 700, color: ORANGE, margin: '8px 0 2px' }}>Main opportunities</p>
            <Bullets items={exec.topOpportunities} />
            <p style={{ fontWeight: 700, color: ORANGE, margin: '8px 0 2px' }}>Top challenges</p>
            <Bullets items={exec.topChallenges} />
            <p style={{ fontWeight: 700, color: ORANGE, margin: '8px 0 2px' }}>Priority actions — next 12 months</p>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {exec.priorityActions12mo.map((a, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  <strong>{a.month}:</strong> {a.action}
                  <span style={{ color: '#7B6A52' }}> — {a.why}</span>
                </li>
              ))}
            </ul>
          </SectionShell>
        </div>
      )}

      {impl && (
        <div id="sec-implementation">
          <SectionShell title="Implementation Plan" map="implementation" status={metaFor('implementation')?.status ?? 'skeleton'} onViewMap={onViewMap}>
            {impl.map((ph) => (
              <div key={ph.phase} style={{ marginBottom: 10 }}>
                <p style={{ fontWeight: 800, color: GREEN, margin: '0 0 2px' }}>
                  {ph.label}
                  {ph.monthRange ? <span style={{ color: '#7B6A52', fontWeight: 400 }}> · {ph.monthRange}</span> : null}
                  {ph.budgetBand ? <span style={{ color: ORANGE, fontSize: 11 }}> · {ph.budgetBand} budget</span> : null}
                </p>
                <ol style={{ margin: '2px 0 0', paddingLeft: 20 }}>
                  {ph.steps.map((st) => (
                    <li key={st.seq} style={{ marginBottom: 4 }}>
                      {st.task}
                      {st.why ? <span style={{ color: '#7B6A52' }}> — {st.why}</span> : null}
                      <button
                        onClick={() => onViewMap(st.map)}
                        style={{ marginLeft: 6, fontSize: 10, color: GREEN, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        ({MAP_LABEL[st.map]})
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </SectionShell>
        </div>
      )}

      {site && (
        <div id="sec-existing-site">
          <SectionShell title="Existing Site" map="base" status={metaFor('existing-site')?.status ?? 'skeleton'} onViewMap={onViewMap}>
            <p style={{ marginTop: 0 }}>
              Size{site.sizeHa ? <Chip v={site.sizeHa} /> : ' (trace the boundary)'} · {site.climateSummary}
            </p>
            {!!site.existingCrops.length && <p style={{ margin: '4px 0' }}><strong>Crops:</strong> {site.existingCrops.join(', ')}</p>}
            {!!site.existingLivestock.length && <p style={{ margin: '4px 0' }}><strong>Livestock:</strong> {site.existingLivestock.join(', ')}</p>}
            {!!site.infrastructure.length && <p style={{ margin: '4px 0' }}><strong>Infrastructure:</strong> {site.infrastructure.join(', ')}</p>}
          </SectionShell>
        </div>
      )}

      {water && (
        <div id="sec-water">
          <SectionShell title="Water" map="water" status={metaFor('water')?.status ?? 'skeleton'} onViewMap={onViewMap}>
            <p style={{ marginTop: 0 }}>
              Rainfall{water.rainfall ? <Chip v={water.rainfall} /> : ''} · {water.pattern} pattern.
              {water.estStorageCapacity ? <> Recommended storage<Chip v={water.estStorageCapacity} /></> : null}
            </p>
            {!!water.sources.length && <p style={{ margin: '4px 0' }}><strong>Sources:</strong> {water.sources.join(', ')}</p>}
            <p style={{ margin: '4px 0' }}><strong>Runoff:</strong> {water.runoffRisk} <strong>Erosion:</strong> {water.erosionRisk}</p>
            <p style={{ fontWeight: 700, color: ORANGE, margin: '6px 0 2px' }}>Harvesting opportunities</p>
            <Bullets items={water.harvestingOpportunities} />
          </SectionShell>
        </div>
      )}

      {soil && (
        <div id="sec-landscape-soil">
          <SectionShell title="Landscape & Soil" map="base" status={metaFor('landscape-soil')?.status ?? 'skeleton'} onViewMap={onViewMap}>
            <p style={{ marginTop: 0 }}>
              Slope{soil.slope ? <Chip v={soil.slope} /> : ''} · aspect {soil.aspect} · {soil.soilTexture} soil
              {soil.ph ? <> · pH<Chip v={soil.ph} /></> : null}
              {soil.organicMatter ? <> · OM<Chip v={soil.organicMatter} /></> : null}
            </p>
            <p style={{ margin: '4px 0' }}>{soil.compaction} {soil.erosion}</p>
            <p style={{ fontWeight: 700, color: ORANGE, margin: '6px 0 2px' }}>Improvements</p>
            <Bullets items={soil.improvementPlan.map((p) => `${p.action} (${p.timing})`)} />
            {!!soil.coverCrops.length && <p style={{ margin: '4px 0' }}><strong>Cover crops:</strong> {soil.coverCrops.join(', ')}</p>}
          </SectionShell>
        </div>
      )}

      {sector && (
        <div id="sec-sector">
          <SectionShell title="Sector Analysis" map="sector" status={metaFor('sector')?.status ?? 'skeleton'} onViewMap={onViewMap}>
            <Bullets items={[sector.sun, sector.windSummer, sector.windWinter, sector.frost, sector.fire, sector.wildlife, sector.dust, sector.neighbours].filter(Boolean)} />
          </SectionShell>
        </div>
      )}

      {!!zones?.length && (
        <div id="sec-zone">
          <SectionShell title="Zones" map="zone" status={metaFor('zone')?.status ?? 'skeleton'} onViewMap={onViewMap}>
            {zones.map((z) => (
              <div key={z.zone} style={{ marginBottom: 6 }}>
                <strong style={{ color: GREEN }}>{z.name}</strong>
                <span> — {z.purpose}</span>
              </div>
            ))}
          </SectionShell>
        </div>
      )}

      {!!master?.length && (
        <div id="sec-master-design">
          <SectionShell title="Master Design" map="design" status={metaFor('master-design')?.status ?? 'skeleton'} onViewMap={onViewMap}>
            {master.map((feature) => (
              <div key={feature.key} style={{ marginBottom: 8 }}>
                <strong style={{ color: GREEN }}>{feature.name}</strong>
                {feature.dimensions ? <span style={{ color: '#7B6A52' }}> · {feature.dimensions}</span> : null}
                <p style={{ margin: '2px 0' }}>{feature.purpose}</p>
                <Bullets items={feature.construction} />
              </div>
            ))}
          </SectionShell>
        </div>
      )}

      {!!planting?.length && (
        <div id="sec-planting">
          <SectionShell title="Planting" map="zone" status={metaFor('planting')?.status ?? 'skeleton'} onViewMap={onViewMap}>
            {planting.map((table) => (
              <div key={table.category} style={{ marginBottom: 8 }}>
                {table.rows.map((row, index) => (
                  <p key={`${table.category}-${index}`} style={{ margin: '3px 0' }}>
                    <strong>{row.species}</strong>
                    <span style={{ color: '#7B6A52' }}> — {row.spacing}; {row.season}. {row.purpose}</span>
                  </p>
                ))}
              </div>
            ))}
          </SectionShell>
        </div>
      )}

      {!!costs?.length && (
        <div id="sec-cost-labour">
          <SectionShell title="Cost & Labour" map="implementation" status={metaFor('cost-labour')?.status ?? 'skeleton'} onViewMap={onViewMap}>
            {costs.map((line, index) => (
              <p key={`${line.phase}-${index}`} style={{ margin: '4px 0' }}>
                <strong>Phase {line.phase}:</strong> {line.item}
                {line.materialsCostZar ? <> Materials<Chip v={line.materialsCostZar} /></> : null}
                {line.labourDays ? <> Labour<Chip v={line.labourDays} /></> : null}
              </p>
            ))}
          </SectionShell>
        </div>
      )}

      {!!monitoring?.length && (
        <div id="sec-monitoring">
          <SectionShell title="Monitoring" map="design" status={metaFor('monitoring')?.status ?? 'skeleton'} onViewMap={onViewMap}>
            <Bullets items={monitoring.map((metric) => `${metric.label}: ${metric.howToMeasure}`)} />
          </SectionShell>
        </div>
      )}

      <p style={{ fontSize: 10.5, color: '#9A8268', marginTop: 12, marginBottom: 0 }}>
        This local skeleton is available immediately. Generate the full report to enrich each section with site-specific detail.
      </p>
    </div>
  );
}

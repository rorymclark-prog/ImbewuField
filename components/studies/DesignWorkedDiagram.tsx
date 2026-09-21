'use client';

import { useState, type RefObject } from 'react';
import { DESIGN_WORKED } from '@/lib/design-worked';
import styles from './DesignWorkedDiagram.module.css';

export type DesignWorkedDiagramView = 'source' | 'A' | 'B' | 'revision';

type RectFeature = { id: string; label: string; type: 'rect'; x: number; y: number; width: number; height: number };
type PointFeature = { id: string; label: string; type: 'point'; x: number; y: number };

const existing = DESIGN_WORKED.existing;
const frame = DESIGN_WORKED.frame;
const plotA = existing.find((feature): feature is RectFeature => feature.id === 'E-PLOT-A' && feature.type === 'rect')!;
const home = existing.find((feature): feature is RectFeature => feature.id === 'E-HOME' && feature.type === 'rect')!;
const route = existing.find((feature): feature is RectFeature => feature.id === 'E-ROUTE' && feature.type === 'rect')!;
const gate = existing.find((feature): feature is PointFeature => feature.id === 'E-GATE' && feature.type === 'point')!;
const water = existing.find((feature): feature is PointFeature => feature.id === 'E-WATER' && feature.type === 'point')!;
const plotB = DESIGN_WORKED.concepts.find(concept => concept.id === 'B')?.geometry.find((feature): feature is RectFeature => feature.type === 'rect')!;
const compost = DESIGN_WORKED.proposal as RectFeature;

if (!plotA || !home || !route || !gate || !water || !plotB) {
  throw new Error('The worked-design diagram requires the supplied fictional source geometry.');
}

const planWidth = 600;
const metresToPixels = planWidth / frame.width;
const plan = { x: 56, y: 116, width: planWidth, height: frame.height * metresToPixels };
const x = (metres: number) => plan.x + metres * metresToPixels;
const y = (metres: number) => plan.y + metres * metresToPixels;
const rect = (feature: RectFeature) => ({ x: x(feature.x), y: y(feature.y), width: feature.width * metresToPixels, height: feature.height * metresToPixels });

function NumberKey({ id, cx, cy }: { id: string; cx: number; cy: number }) {
  return <g aria-hidden="true"><circle cx={cx} cy={cy} r="11" fill="#fffdf7" stroke="#274d36" strokeWidth="2" /><text x={cx} y={cy + 4} textAnchor="middle" fill="#274d36" fontSize="11" fontWeight="700">{id}</text></g>;
}

function Dimension({ feature, horizontal, label, colour = '#715634' }: { feature: RectFeature; horizontal: boolean; label: string; colour?: string }) {
  const r = rect(feature);
  if (horizontal) {
    const dimY = r.y + r.height + 20;
    return <g fill={colour} stroke={colour} strokeWidth="1.5" fontSize="12" fontFamily="Arial, sans-serif"><path d={`M ${r.x} ${dimY} H ${r.x + r.width} M ${r.x} ${dimY - 5} V ${dimY + 5} M ${r.x + r.width} ${dimY - 5} V ${dimY + 5}`} /><text x={r.x + r.width / 2} y={dimY + 15} textAnchor="middle" stroke="none">{label}</text></g>;
  }
  const dimX = r.x - 18;
  return <g fill={colour} stroke={colour} strokeWidth="1.5" fontSize="12" fontFamily="Arial, sans-serif"><path d={`M ${dimX} ${r.y} V ${r.y + r.height} M ${dimX - 5} ${r.y} H ${dimX + 5} M ${dimX - 5} ${r.y + r.height} H ${dimX + 5}`} /><text x={dimX - 7} y={r.y + r.height / 2} textAnchor="middle" stroke="none" transform={`rotate(-90 ${dimX - 7} ${r.y + r.height / 2})`}>{label}</text></g>;
}

/** A standalone SVG teaching diagram. Every visual attribute is in the SVG so an exported clone keeps its meaning. */
export default function DesignWorkedDiagram({ view = 'source', svgRef }: { view?: DesignWorkedDiagramView; svgRef?: RefObject<SVGSVGElement> }) {
  const [enlarged, setEnlarged] = useState(false);
  const isA = view === 'A';
  const isB = view === 'B';
  const isRevision = view === 'revision';
  const title = view === 'source' ? 'Existing evidence' : view === 'A' ? 'Concept A' : view === 'B' ? 'Concept B' : 'Revision R2';
  const aPlot = rect(plotA);
  const bPlot = rect(plotB);
  const routeRect = rect(route);
  const compostRect = rect(compost);

  return <figure className={styles.figure}>
    <div className={styles.controls}><button type="button" aria-pressed={enlarged} onClick={() => setEnlarged(current => !current)}>{enlarged ? 'Fit diagram to screen' : 'Enlarge diagram'}</button></div>
    <div className={styles.viewport} tabIndex={0} role="region" aria-label="Scrollable fictional classroom yard-plan diagram">
      <svg ref={svgRef} className={`${styles.diagram}${enlarged ? ` ${styles.enlarged}` : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 790" width="720" height="790" role="img" aria-labelledby="worked-diagram-title worked-diagram-description" fontFamily="Arial, sans-serif">
        <title id="worked-diagram-title">{`${DESIGN_WORKED.title}: ${title}`}</title>
        <desc id="worked-diagram-description">A fictional classroom plan in metres. Existing evidence stays visible in every view. Concept A retains the existing growing area and shows a proposed compost area before revision. Concept B shows a separate alternative growing area while retaining the original growing area. Revision R2 visibly defers compost because no care role is agreed. The outer frame is a teaching frame, not a land-rights boundary, and the reported eastern water issue has unmeasured extent and levels.</desc>
        <defs>
          <pattern id="compost-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#7a4d20" strokeWidth="2" opacity="0.7" /></pattern>
        </defs>
        <rect width="720" height="790" fill="#f7f1e3" />
        <text x="32" y="34" fill="#23382a" fontSize="20" fontWeight="700">{DESIGN_WORKED.caseId} · {title}</text>
        <text x="32" y="54" fill="#536651" fontSize="12">Metres · x increases right; y increases down</text>
        <text x="32" y="70" fill="#536651" fontSize="12">Top edge is model north by classroom convention only</text>
        <text x="32" y="90" fill="#8b4226" fontSize="11" fontWeight="700">FICTIONAL CLASSROOM MODEL · {DESIGN_WORKED.currentRevision} · NOT A SURVEY OR CONSTRUCTION DRAWING</text>

        <g aria-label="Teaching frame and existing evidence">
          <rect x={plan.x} y={plan.y} width={plan.width} height={plan.height} fill="#fffdf7" stroke="#715634" strokeWidth="3" />
          <text x={plan.x} y={plan.y - 10} fill="#715634" fontSize="12" fontWeight="700">Teaching frame — model geometry only; not a boundary or land-rights record</text>

          <rect {...rect(home)} fill="#d8d0bb" stroke="#665e4d" strokeWidth="2" />
          <rect {...aPlot} fill="#cfe1c0" stroke="#31593a" strokeWidth="3" />
          <rect {...routeRect} fill="#e3ddd0" stroke="#756b57" strokeWidth="2" />
          <text x={routeRect.x + routeRect.width / 2} y={routeRect.y + routeRect.height / 2} fill="#4c4a42" fontSize="11" textAnchor="middle" transform={`rotate(-90 ${routeRect.x + routeRect.width / 2} ${routeRect.y + routeRect.height / 2})`}>Existing route</text>
          <circle cx={x(water.x)} cy={y(water.y)} r="7" fill="#2d6a4f" stroke="#fffdf7" strokeWidth="3" />
          <path d={`M ${x(water.x) - 8} ${y(water.y) + 9} L ${x(water.x) - 42} ${y(water.y) + 30}`} stroke="#31593a" strokeWidth="1.5" fill="none" />
          <text x={x(water.x) - 45} y={y(water.y) + 35} fill="#274d36" fontSize="11" textAnchor="end">Water point</text>
          <circle cx={x(gate.x)} cy={y(gate.y)} r="6" fill="#80522b" stroke="#fffdf7" strokeWidth="2" />
          <text x={x(gate.x) + 12} y={y(gate.y) - 10} fill="#5d4227" fontSize="11">Gate reference</text>
          <NumberKey id="1" cx={aPlot.x + 17} cy={aPlot.y + 18} /><NumberKey id="2" cx={rect(home).x + 17} cy={rect(home).y + 18} /><NumberKey id="3" cx={routeRect.x + routeRect.width / 2} cy={routeRect.y + 18} /><NumberKey id="4" cx={x(water.x) + 15} cy={y(water.y) - 13} /><NumberKey id="5" cx={x(gate.x) - 14} cy={y(gate.y) - 14} />
        </g>

        {isA && <g aria-label="Concept A proposal"><rect {...compostRect} fill="#ead19c" stroke="#7a4d20" strokeWidth="3" strokeDasharray="7 5" /><rect {...compostRect} fill="url(#compost-hatch)" /><NumberKey id="6" cx={compostRect.x + compostRect.width / 2} cy={compostRect.y + compostRect.height / 2} /><Dimension feature={compost} horizontal label={`${compost.width} m`} colour="#7a4d20" /><text x={compostRect.x + compostRect.width / 2} y={compostRect.y + compostRect.height + 48} fill="#7a4d20" fontSize="10" textAnchor="middle">proposal · W-A</text></g>}
        {isB && <g aria-label="Concept B alternative proposal"><rect {...bPlot} fill="#f8dcad" fillOpacity="0.8" stroke="#b85f1c" strokeWidth="3" strokeDasharray="9 6" /><NumberKey id="7" cx={bPlot.x + bPlot.width - 17} cy={bPlot.y + 18} /><Dimension feature={plotB} horizontal label={`${plotB.width} m`} colour="#a6501a" /><Dimension feature={plotB} horizontal={false} label={`${plotB.height} m`} colour="#a6501a" /></g>}
        {(isA || isRevision) && <g aria-label="Existing growing-area dimensions"><Dimension feature={plotA} horizontal label={`${plotA.width} m`} /><Dimension feature={plotA} horizontal={false} label={`${plotA.height} m`} /></g>}
        {isRevision && <g aria-label="Deferred compost revision"><rect {...compostRect} fill="none" stroke="#8b2e1e" strokeWidth="3" strokeDasharray="5 4" /><path d={`M ${compostRect.x} ${compostRect.y} L ${compostRect.x + compostRect.width} ${compostRect.y + compostRect.height} M ${compostRect.x + compostRect.width} ${compostRect.y} L ${compostRect.x} ${compostRect.y + compostRect.height}`} stroke="#8b2e1e" strokeWidth="2" /><path d={`M ${compostRect.x + compostRect.width / 2} ${compostRect.y + compostRect.height} V ${plan.y + plan.height + 45} H 238`} stroke="#8b2e1e" strokeWidth="1.5" fill="none" /><text x="244" y={plan.y + plan.height + 40} fill="#8b2e1e" fontSize="12" fontWeight="700">Compost deferred — R2</text><text x="244" y={plan.y + plan.height + 56} fill="#8b2e1e" fontSize="11">W-CARE: no agreed care role</text></g>}

        <g aria-label="Scale and source notes" fill="#536651" fontSize="11">
          <path d={`M ${plan.x} ${plan.y + plan.height + 38} H ${plan.x + metresToPixels * 5} M ${plan.x} ${plan.y + plan.height + 33} V ${plan.y + plan.height + 43} M ${plan.x + metresToPixels * 5} ${plan.y + plan.height + 33} V ${plan.y + plan.height + 43}`} stroke="#536651" strokeWidth="1.5" />
          <text x={plan.x + metresToPixels * 2.5} y={plan.y + plan.height + 58} textAnchor="middle">5 m model distance</text>
          <text x="456" y={plan.y + plan.height + 42} fill="#8b4226" fontWeight="700">Viewport diagram only</text>
          <text x="456" y={plan.y + plan.height + 57} fill="#8b4226">No physical print scale is claimed</text>
        </g>

        <g aria-label="Reported water observation note" fill="#31566c"><path d={`M ${plan.x + plan.width} ${y(7)} H 675 V ${plan.y + plan.height + 80} H 350`} fill="none" stroke="#486b80" strokeWidth="1.5" strokeDasharray="4 3" /><text x="350" y={plan.y + plan.height + 76} fontSize="11" fontWeight="700">W-OBS: water reportedly crosses the eastern yard in heavy rain.</text><text x="350" y={plan.y + plan.height + 91} fontSize="11">Extent and levels are unmeasured; this is not a flood boundary.</text></g>

        <g aria-label="Legend and provenance" transform="translate(32 590)">
          <rect x="0" y="0" width="656" height="178" rx="8" fill="#fffdf7" stroke="#d5c8af" />
          <text x="16" y="22" fill="#23382a" fontSize="14" fontWeight="700">Legend · marks are references to source cards, not proof of suitability</text>
          <rect x="16" y="36" width="14" height="14" fill="#cfe1c0" stroke="#31593a" strokeWidth="2" /><text x="38" y="48" fill="#274d36" fontSize="12">1 Existing growing area · E-PLOT-A · W-MAP</text>
          <rect x="16" y="58" width="14" height="14" fill="#d8d0bb" stroke="#665e4d" strokeWidth="2" /><text x="38" y="70" fill="#274d36" fontSize="12">2 Home · E-HOME · supplied fictional model</text>
          <rect x="16" y="80" width="14" height="14" fill="#e3ddd0" stroke="#756b57" strokeWidth="2" strokeDasharray="0" /><text x="38" y="92" fill="#274d36" fontSize="12">3 Existing route · E-ROUTE · footprint only, not clearance guidance</text>
          <circle cx="23" cy="109" r="6" fill="#2d6a4f" /><text x="38" y="113" fill="#274d36" fontSize="12">4 Water point · E-WATER · W-OBS does not establish quantity, quality or reliability</text>
          <circle cx="23" cy="131" r="6" fill="#80522b" /><text x="38" y="135" fill="#274d36" fontSize="12">5 Gate reference · E-GATE · point only</text>
          <rect x="16" y="146" width="14" height="14" fill="#ead19c" stroke="#7a4d20" strokeWidth="2" strokeDasharray="4 3" /><text x="38" y="158" fill="#274d36" fontSize="12">6 Compost proposal · P-COMPOST · W-A; only before R2</text>
          <rect x="16" y="164" width="14" height="14" fill="#f8dcad" stroke="#b85f1c" strokeWidth="2" strokeDasharray="4 3" /><text x="38" y="176" fill="#274d36" fontSize="12">7 Alternative B growing area · P-B-PLOT · W-B</text>
        </g>
      </svg>
    </div>
    <figcaption className={styles.caption}>Existing evidence remains in every view. Concept A retains the existing growing area and, before revision, shows only the separate compost proposal. Concept B retains the original area as evidence while showing its separate alternative; they are not both active production. Geometry demonstrates supplied model fit only. It does not establish water, soil, tenure, drainage, usable access, costs, permissions or care agreement.</figcaption>
  </figure>;
}

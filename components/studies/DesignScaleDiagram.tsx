import type { RefObject } from 'react';
import { scaleNumber as n, type ScaleArrangement } from '@/lib/design-scale';

export default function DesignScaleDiagram({ model, svgRef, scenario }: { model: ScaleArrangement; svgRef?: RefObject<SVGSVGElement>; scenario: string }) {
  const [a, b] = model.beds;
  const unit = Math.min(300 / model.frameWidthM, 300 / a.lengthM);
  const left = (500 - model.frameWidthM * unit) / 2;
  const top = 90;
  const bottom = top + a.lengthM * unit;
  const x = (bed: typeof a) => left + (bed.xM - a.xM) * unit;
  const aEnd = x(a) + a.widthM * unit;
  const bStart = x(b);
  const right = x(b) + b.widthM * unit;
  const spaceStart = Math.min(aEnd, bStart), spaceEnd = Math.max(aEnd, bStart);
  const dimension = (x1: number, x2: number, y: number, label: string) => <g stroke="#40513a" strokeWidth="1.4">
    <path d={`M${x1} ${y - 6}v12M${x1} ${y}H${x2}M${x2} ${y - 6}v12`} fill="none" />
    <text x={(x1+x2)/2} y={y-12} textAnchor="middle" stroke="none" fill="#293b2e" fontSize="23">{label}</text>
  </g>;
  return <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 550" width="500" height="550" role="img" aria-labelledby="scale-plan-title scale-plan-description" style={{ display: 'block', width: '100%', height: 'auto' }} fontFamily="Arial, sans-serif">
    <title id="scale-plan-title">{scenario}: two sample bed outlines with model dimensions</title>
    <desc id="scale-plan-description">{a.label} and {b.label} are each {n(a.widthM)} metres wide and {n(a.lengthM)} metres long. {model.overlapM > 0 ? `Their outlines overlap by ${n(model.overlapM)} metres.` : `The gap is ${n(model.gapM)} ${model.gapM === 1 ? 'metre' : 'metres'}.`} The outer rectangle is {n(model.outerWidthM)} metres wide. Model data only; no site survey or recommended spacing.</desc>
    <rect width="500" height="550" fill="#faf7ee" />
    <text x="250" y="29" textAnchor="middle" fill="#4f6148" fontSize="18" letterSpacing="1">{scenario.toUpperCase()}</text>
    <rect x={left} y={top} width={model.outerWidthM*unit} height={a.lengthM*unit} fill="#eee3c8" stroke="#8b7653" strokeDasharray="7 5" strokeWidth="2" />
    {model.beds.map(bed => <g key={bed.reference}>
      <rect x={x(bed)} y={top} width={bed.widthM*unit} height={bed.lengthM*unit} fill={bed === a ? '#c4d6ac' : '#abc698'} fillOpacity="0.82" stroke="#355a3c" strokeWidth="2.5" />
    </g>)}
    {model.overlapM > 0 && <rect x={bStart} y={top} width={model.overlapM*unit} height={a.lengthM*unit} fill="#dc9b57" fillOpacity="0.6" stroke="#8d5428" strokeWidth="2" strokeDasharray="5 4" />}
    {model.beds.map(bed => <text key={bed.reference} x={x(bed)+bed.widthM*unit/2} y={top+bed.lengthM*unit/2+(model.overlapM > 0 ? bed === a ? -22 : 28 : 8)} textAnchor="middle" fill="#254831" fontWeight="bold" fontSize="25">{bed.label}</text>)}
    {dimension(x(a),aEnd,66,`${n(a.widthM)} m`)}
    {dimension(bStart,right,model.overlapM > 0 ? bottom+72 : 66,`${n(b.widthM)} m`)}
    <path d={`M${left-23} ${top}h-12M${left-29} ${top}V${bottom}M${left-23} ${bottom}h-12`} fill="none" stroke="#40513a" strokeWidth="1.4" />
    <text x={left-40} y={(top+bottom)/2} transform={`rotate(-90 ${left-40} ${(top+bottom)/2})`} textAnchor="middle" fill="#293b2e" fontSize="23">{n(a.lengthM)} m</text>
    {model.gapM > 0 || model.overlapM > 0 ? dimension(spaceStart,spaceEnd,bottom+33,`${n(model.overlapM || model.gapM)} m`) : <text x={bStart} y={bottom+31} textAnchor="middle" fill="#293b2e" fontSize="22">No gap</text>}
    <text x="250" y="493" textAnchor="middle" fill="#4f6148" fontSize="20">Outer width: {n(model.outerWidthM)} m</text>
    <text x="250" y="529" textAnchor="middle" fill="#4f6148" fontSize="17">MODEL ONLY · not site measurements</text>
  </svg>;
}

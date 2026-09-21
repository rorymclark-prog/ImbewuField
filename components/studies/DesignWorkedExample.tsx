'use client';

import { useRef, useState, type RefObject } from 'react';
import Link from 'next/link';
import { DESIGN_WORKED, workedArea } from '@/lib/design-worked';
import styles from './FinanceCourse.module.css';
import worked from './DesignWorkedExample.module.css';

type View = 'source' | 'A' | 'B' | 'revision';
const scale = 30;
type RectFeature = { id: string; label: string; type: string; x: number; y: number; width: number; height: number };
function isRect(feature: { type: string; width?: number; height?: number }): feature is RectFeature { return feature.type === 'rect' && typeof feature.width === 'number' && typeof feature.height === 'number'; }

function Rect({ feature, className }: { feature: { id: string; label: string; x: number; y: number; width: number; height: number }; className: string }) {
  const centreX = (feature.x + feature.width / 2) * scale;
  const centreY = (feature.y + feature.height / 2) * scale;
  return <g><rect className={className} x={feature.x * scale} y={feature.y * scale} width={feature.width * scale} height={feature.height * scale} />{feature.id === 'E-ROUTE' ? <text x={centreX} y={centreY} textAnchor="middle" transform={`rotate(-90 ${centreX} ${centreY})`}>{feature.label}</text> : <text x={centreX} y={centreY} textAnchor="middle">{feature.label}</text>}</g>;
}

function Dimension({ x1, y1, x2, y2, label }: { x1: number; y1: number; x2: number; y2: number; label: string }) {
  return <g className={worked.dimension}><path d={`M${x1} ${y1}H${x2}M${x1} ${y1 - 7}v14M${x2} ${y2 - 7}v14`} /><text x={(x1 + x2) / 2} y={y1 - 10} textAnchor="middle">{label}</text></g>;
}

function WorkedMap({ view, svgRef }: { view: View; svgRef: RefObject<SVGSVGElement> }) {
  const showB = view === 'B';
  const showCompost = view !== 'source' && view !== 'revision';
  const b = DESIGN_WORKED.concepts.find(concept => concept.id === 'B')!.geometry[0]!;
  const a = DESIGN_WORKED.existing.find(feature => feature.id === 'E-PLOT-A') as RectFeature;
  return <figure className={worked.map}><svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox="-35 -50 700 430" role="img" aria-labelledby="worked-map-title worked-map-desc">
    <title id="worked-map-title">{`Fictional classroom yard plan: ${view === 'source' ? 'existing evidence' : `proposal ${view}`}`}</title>
    <desc id="worked-map-desc">Metre-coordinate teaching frame. Existing features stay visible. Proposal outlines are separate and do not establish suitability, legal access or construction readiness.</desc>
    <rect className={worked.frame} x="0" y="0" width="600" height="360" />
    {DESIGN_WORKED.existing.filter(isRect).map(feature => <Rect key={feature.id} feature={feature} className={feature.id === 'E-ROUTE' ? worked.route : worked.existing} />)}
    {DESIGN_WORKED.existing.filter(feature => feature.type === 'point').map(feature => <g key={feature.id}><circle className={worked.point} cx={feature.x * scale} cy={feature.y * scale} r="8" />{feature.id === 'E-WATER' ? <text x={feature.x * scale - 14} y={feature.y * scale + 22} textAnchor="end">{feature.label}</text> : <text x={feature.x * scale + 12} y={feature.y * scale - 12}>{feature.label}</text>}</g>)}
    {showB && <Rect feature={b} className={worked.proposed} />}
    {showCompost && <Rect feature={DESIGN_WORKED.proposal} className={worked.compost} />}
    {view !== 'source' && <><Dimension x1={a.x * scale} y1={(a.y + a.height) * scale + 26} x2={(a.x + a.width) * scale} y2={(a.y + a.height) * scale + 26} label={`${a.width} m`} /><text className={worked.dimension} x={(a.x - .25) * scale} y={(a.y + a.height / 2) * scale} textAnchor="end">{a.height} m</text></>}
    {showB && <><Dimension x1={b.x * scale} y1={(b.y + b.height) * scale + 26} x2={(b.x + b.width) * scale} y2={(b.y + b.height) * scale + 26} label={`${b.width} m`} /><text className={worked.dimension} x={(b.x + b.width + .25) * scale} y={(b.y + b.height / 2) * scale}>{b.height} m</text></>}
    <text className={worked.axis} x="0" y="-18">Model north ↑ · supplied classroom coordinate frame · metres</text>
    <text className={worked.axis} x="-8" y="382">0</text><text className={worked.axis} x="580" y="382">20 m</text><text className={worked.axis} x="608" y="360">12 m</text>
    {view === 'revision' && <text className={worked.deferred} x="30" y="338">Compost proposal deferred after W-CARE: no agreed care role.</text>}
  </svg><figcaption>Solid green and grey marks are existing supplied model features. Dashed orange is a proposal. The map establishes only the supplied geometry; it does not establish water, soil, rights, safe drainage, access suitability or a print scale.</figcaption></figure>;
}

export default function DesignWorkedExample() {
  const [view, setView] = useState<View>('source');
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [choice, setChoice] = useState('');
  const [choiceChecked, setChoiceChecked] = useState(false);
  const mapRef = useRef<SVGSVGElement>(null);
  const downloadMap = () => {
    if (!mapRef.current) return;
    const copy = mapRef.current.cloneNode(true) as SVGSVGElement;
    copy.removeAttribute('style');
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'imbewu-worked-design-model-r2.svg'; document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <>
    <aside className={`${styles.notice} ${styles.projectNotice}`}><p><strong>English teaching preview.</strong> {DESIGN_WORKED.notice}</p></aside>
    <section className={styles.section} id="read"><p className={styles.eyebrow}>1 · Read the brief and source map</p><h2>Keep evidence, reports and proposals separate</h2><p>{DESIGN_WORKED.sourceCards[0].text}</p><p>Use the source cards before accepting a mark on the drawing. The teaching frame is not a cadastral boundary, and the model’s north label is a classroom convention.</p><div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Worked example source cards"><table><caption>Supplied source pack — revision {DESIGN_WORKED.revision.to}</caption><thead><tr><th>Reference</th><th>Provenance</th><th>What it says</th></tr></thead><tbody>{DESIGN_WORKED.sourceCards.map(card => <tr key={card.id}><th>{card.id}<br /><small>{card.title}</small></th><td>{card.kind}</td><td>{card.text}</td></tr>)}</tbody></table></div></section>
    <section className={styles.section} id="map"><p className={styles.eyebrow}>2 · Read influences without pretending certainty</p><h2>A reported water path is not a drainage design</h2><p>{DESIGN_WORKED.sourceCards[2].text}</p><div className={styles.actions} role="group" aria-label="Worked-example drawing view"><button type="button" aria-pressed={view === 'source'} onClick={() => setView('source')}>Existing evidence</button><button type="button" aria-pressed={view === 'A'} onClick={() => setView('A')}>Concept A</button><button type="button" aria-pressed={view === 'B'} onClick={() => setView('B')}>Concept B</button><button type="button" aria-pressed={view === 'revision'} onClick={() => setView('revision')}>Revised plan</button></div><WorkedMap view={view} svgRef={mapRef} /><div className={styles.actions}><button type="button" onClick={downloadMap}>Download this model diagram (SVG)</button></div><p>The download retains model coordinates and labels. It has no fixed physical print scale; opening or printing it does not turn it into a site survey.</p></section>
    <section className={styles.section} id="compare"><p className={styles.eyebrow}>3 · Compare fair alternatives</p><h2>Same brief. Same growing-area basis. Different checks.</h2><div className={styles.grid}>{DESIGN_WORKED.concepts.map(concept => <article className={styles.card} key={concept.id}><h3>{concept.title}</h3><p><strong>May proceed:</strong> {concept.mayProceed}.</p><ul>{concept.criteria.map(item => <li key={item}>{item}</li>)}</ul><h4>Before any physical change</h4><ul>{concept.conditions.map(item => <li key={item}>{item}</li>)}</ul></article>)}</div><p>Each model growing-area outline is {workedArea(DESIGN_WORKED.existing.find(feature => feature.id === 'E-PLOT-A')!)} m². This comparable area does not prove either option is more productive, cheaper or suitable. Deferral remains available while the checks are unresolved.</p><div className={styles.practice}><h3>Choose a provisional response before revealing feedback</h3><p>Using the same brief and named evidence, what can the household responsibly do now?</p><div className={styles.actions} role="group" aria-label="Provisional response"><button type="button" aria-pressed={choice === 'A'} onClick={() => { setChoice('A'); setChoiceChecked(false); }}>Investigate A first</button><button type="button" aria-pressed={choice === 'B'} onClick={() => { setChoice('B'); setChoiceChecked(false); }}>Choose B now</button><button type="button" aria-pressed={choice === 'defer'} onClick={() => { setChoice('defer'); setChoiceChecked(false); }}>Defer all physical changes</button></div><button type="button" disabled={!choice} onClick={() => setChoiceChecked(true)}>Reveal feedback</button>{choiceChecked && <p role="status"><strong>{choice === 'A' || choice === 'defer' ? 'Reasonable provisional response.' : 'Not supported yet.'}</strong> {choice === 'A' ? DESIGN_WORKED.decision.provisional : choice === 'defer' ? DESIGN_WORKED.decision.deferral : 'Concept B remains conditional until its extra location, access, water, soil and shade checks are complete. The supplied model does not establish that it should be built.'}</p>}</div></section>
    <section className={styles.section} id="develop"><p className={styles.eyebrow}>4 · Develop a provisional choice</p><h2>Check actual edges, then keep suitability separate</h2><p>Concept A keeps the existing 8 m by 6 m model growing area. Concept B uses a supplied 6 m by 8 m outline. The map labels those edge-to-edge dimensions so they can be checked against the frame and route footprint. It does not convert the route’s fictional 1 m model width into an accessibility standard or prove that either location is suitable.</p><p>For independent practice, use the <Link href="/student/design/scale">scale exercise</Link> to distinguish an edge gap, a touching edge and an overlap before carrying a real measured source into your folder.</p></section>
    <section className={styles.section} id="work"><p className={styles.eyebrow}>5 · Make work and care feasible</p><h2>Unknown is a valid cost status</h2><div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Worked example dependencies"><table><caption>Preconditions before physical intervention</caption><thead><tr><th>Component</th><th>Evidence and agreement first</th><th>Cost status</th><th>Care status</th></tr></thead><tbody>{DESIGN_WORKED.dependencies.map(row => <tr key={row.item}><th>{row.item}</th><td>{row.before}</td><td>{row.cost}</td><td>{row.care}</td></tr>)}</tbody></table></div><p>Use <Link href="/student/finance">Farm Finance</Link> to practise dated cash reasoning after a real proposal and quotations exist. A sales, packaging or transport practice case is not a garden-construction budget.</p></section>
    <section className={styles.section} id="revision"><p className={styles.eyebrow}>6 · Respond to later information</p><h2>Revision R2: defer a component, preserve the reason</h2><p><strong>{DESIGN_WORKED.revision.source}:</strong> {DESIGN_WORKED.sourceCards.find(card => card.id === DESIGN_WORKED.revision.source)!.text}</p><p>{DESIGN_WORKED.revision.change} {DESIGN_WORKED.revision.reason}</p><p><strong>Next owner:</strong> {DESIGN_WORKED.revision.nextOwner}</p><p>The existing map, original comparison and unknown cost are not deleted. A drawing alone is not a completed revision: the proposal, phase status and care record have all changed together.</p></section>
    <section className={styles.section} id="practice"><p className={styles.eyebrow}>Facilitator review · explain the evidence</p><h2>Try the facilitator questions</h2><p>Give your reason aloud or on paper before revealing the corrective explanation. These prompts do not award assessment credit.</p>{DESIGN_WORKED.facilitator.map((item, index) => <div className={styles.practice} key={item.question}><h3>{item.question}</h3><button type="button" onClick={() => setRevealed(current => ({ ...current, [index]: !current[index] }))}>{revealed[index] ? 'Hide corrective explanation' : 'Reveal corrective explanation'}</button>{revealed[index] && <p><strong>Corrective explanation:</strong> {item.answer}</p>}</div>)}</section>
    <section className={styles.section}><p className={styles.eyebrow}>7 · Hand over the current record</p><h2>What the learner should carry forward</h2><p>Keep the current drawing, named sources, alternative considered, conditions, owner of the next check and the R1-to-R2 revision record together. A legitimate plan can defer an unready component.</p><div className={styles.actions}><Link className={styles.primary} href="/student/design/folder#folder-d6">Record the decision in your learning folder →</Link><Link href="/student/design/d6-1">Return to the final design stage →</Link></div></section>
  </>;
}

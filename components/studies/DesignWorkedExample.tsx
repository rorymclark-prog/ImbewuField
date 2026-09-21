'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { DESIGN_WORKED as pack, workedArea, workedEdgeGap, workedHandoverText } from '@/lib/design-worked';
import { scaleAnswer } from '@/lib/design-scale';
import DesignWorkedDiagram from './DesignWorkedDiagram';
import styles from './FinanceCourse.module.css';

type View = 'source' | 'A' | 'B' | 'revision';
const views: { id: View; label: string }[] = [
  { id: 'source', label: 'Existing evidence' }, { id: 'A', label: 'Concept A · R1' },
  { id: 'B', label: 'Concept B' }, { id: 'revision', label: 'Revised A · R2' },
];

export default function DesignWorkedExample() {
  const [view, setView] = useState<View>('source');
  const [choice, setChoice] = useState('');
  const [choiceChecked, setChoiceChecked] = useState(false);
  const [gapAnswer, setGapAnswer] = useState('');
  const [gapChecked, setGapChecked] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState('');
  const mapRef = useRef<SVGSVGElement>(null);
  const edge = workedEdgeGap();
  const existing = pack.existing.find(feature => feature.id === 'E-PLOT-A')!;
  const alternative = pack.concepts.find(concept => concept.id === 'B')!.geometry[0]!;
  const geometry = [...pack.existing, alternative, pack.proposal];

  function download(content: string, mime: string, name: string) {
    try {
      const url = URL.createObjectURL(new Blob([content], { type: mime }));
      const link = document.createElement('a');
      link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadMessage(`Download requested: ${name}. Open the saved file and check it before leaving this page.`);
    } catch { setDownloadMessage('The download could not be prepared. Keep this page open and try again.'); }
  }

  return <>
    <aside className={`${styles.notice} ${styles.projectNotice}`}><p><strong>English teaching preview.</strong> {pack.notice}</p></aside>
    <nav className={styles.actions} aria-label="Worked example stages">
      <a href="#read">1 · Sources</a><a href="#map">2 · Influences</a><a href="#compare">3 · Alternatives</a>
      <a href="#develop">4 · Fit</a><a href="#work">5 · Work and care</a><a href="#revision">6 · Revision</a><a href="#handover">7 · Handover</a>
    </nav>

    <section className={styles.section} id="read">
      <p className={styles.eyebrow}>1 · Read the brief and source map</p><h2>What must this plan answer?</h2>
      <p>{pack.sourceCards.find(card => card.id === 'W-BRIEF')!.text}</p>
      <p>Read the source cards before accepting a mark on a drawing. The frame is a classroom model; the top edge is model north by convention.</p>
      {pack.sourceCards.map(card => <details key={card.id}><summary>{card.id} · {card.title}</summary><p><strong>{card.kind}.</strong> {card.text}</p></details>)}
      <details><summary>Read every supplied coordinate</summary>
        <p>All values below are fictional classroom inputs in metres. Existing features belong to W-MAP; the alternative belongs to W-B; the compost proposal belongs to W-A. No value is inferred from the picture.</p>
        <p>Frame: {pack.frame.width} × {pack.frame.height} m. {pack.coordinateSystem.axis}.</p>
        <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Supplied fictional geometry"><table>
          <caption>Model coordinates — rectangles use their top-left corner</caption><thead><tr><th>Reference</th><th>x / y (m)</th><th>Width × height (m)</th></tr></thead>
          <tbody>{geometry.map(feature => <tr key={feature.id}><th>{feature.id}<br />{feature.label}</th><td>{feature.x} / {feature.y}</td><td>{'width' in feature ? `${feature.width} × ${feature.height}` : 'Reference point only'}</td></tr>)}</tbody>
        </table></div>
      </details>
      <Link href="/student/design/folder#folder-d1">Record your own brief and evidence sources →</Link>
    </section>

    <section className={styles.section} id="map">
      <p className={styles.eyebrow}>2 · Read influences</p><h2>Follow people and care before adding features</h2>
      <p>The water point, growing area and home-to-gate route suggest journeys to discuss with the people doing the work. They do not establish a measured travel time or an agreed workload.</p>
      <p><strong>Reported, not surveyed:</strong> {pack.sourceCards.find(card => card.id === 'W-OBS')!.text}</p>
      <div className={styles.actions} role="group" aria-label="Worked-example drawing view">{views.map(item => <button key={item.id} type="button" aria-pressed={view === item.id} onClick={() => { setView(item.id); setDownloadMessage(''); }}>{item.label}</button>)}</div>
      <DesignWorkedDiagram view={view} svgRef={mapRef} />
      <div className={styles.actions}><button type="button" onClick={() => {
        if (mapRef.current) download(new XMLSerializer().serializeToString(mapRef.current), 'image/svg+xml;charset=utf-8', `imbewu-worked-design-${view}-${pack.currentRevision.toLowerCase()}.svg`);
      }}>Download this model diagram (SVG)</button></div>
      <p>Use the dimensions written on the diagram. Printing may change its size; no physical print scale is claimed.</p><p role="status">{downloadMessage}</p>
      <Link href="/student/design/folder#folder-d2">Record influences and the checks they need →</Link>
    </section>

    <section className={styles.section} id="compare">
      <p className={styles.eyebrow}>3 · Compare fair alternatives</p><h2>Which option would you investigate?</h2>
      <p>A keeps the existing growing location. B investigates a different location with the same {workedArea(existing)} m² model area. Both must answer the same food, access and care brief. Neither is approved for construction.</p>
      <p>Choose A, B or deferral. Explain aloud or on paper: which source supports your choice, what trade-off remains, and what new evidence could change your mind?</p>
      <div className={styles.actions} role="group" aria-label="Provisional response">{[['A', 'Investigate A first'], ['B', 'Investigate B first'], ['defer', 'Defer physical changes']].map(([id, label]) => <button key={id} type="button" aria-pressed={choice === id} onClick={() => { setChoice(id); setChoiceChecked(false); }}>{label}</button>)}</div>
      <div className={styles.actions}><button type="button" disabled={!choice} aria-expanded={choiceChecked} onClick={() => setChoiceChecked(value => !value)}>{choiceChecked ? 'Hide comparison feedback' : 'Compare my reasoning'}</button></div>
      {choiceChecked && <div className={styles.practice}>
        <p><strong>Discuss the reason, not just the selection.</strong> {choice === 'B' ? 'Investigating B can be reasonable if you explain its additional location checks. A relocated outline is not evidence of better growing conditions.' : choice === 'defer' ? pack.decision.deferral : pack.decision.provisional}</p>
        <p>{pack.decision.rejected} {pack.reconsider}</p>
        <div className={styles.tableScroll} role="region" tabIndex={0} aria-label="Same criteria for both concepts"><table><caption>Compare each option against the same evidence</caption><thead><tr><th>Criterion / source</th><th>Concept A</th><th>Concept B</th><th>Still unknown</th></tr></thead>
          <tbody>{pack.comparison.map(row => <tr key={row.criterion}><th>{row.criterion}<br /><small>{row.source}</small></th><td>{row.A}</td><td>{row.B}</td><td>{row.limit}</td></tr>)}</tbody>
        </table></div>
      </div>}
      <p>This is a discussion exercise, not an assessment result. A facilitator reviews the evidence and explanation.</p><Link href="/student/design/folder#folder-d3">Record alternatives and your reasoned choice →</Link>
    </section>

    <section className={styles.section} id="develop">
      <p className={styles.eyebrow}>4 · Develop and check</p><h2>Measure between the actual edges</h2>
      <p>The guided choice is to investigate A while keeping physical changes on hold. B remains an alternative. Inspect each outline against the supplied frame and the existing route.</p>
      <p>For B, calculate the horizontal gap from the route’s right edge to the proposed growing area’s left edge. Use E-ROUTE in W-MAP and P-B-PLOT in W-B. These rectangles overlap along the north–south direction, so this is their clear horizontal separation.</p>
      <label className={styles.answerField} htmlFor="worked-edge-gap"><strong>Edge-to-edge gap in metres</strong><input id="worked-edge-gap" inputMode="decimal" maxLength={24} value={gapAnswer} onChange={event => { setGapAnswer(event.target.value); setGapChecked(false); }} /></label>
      <div className={styles.actions}><button type="button" disabled={scaleAnswer(gapAnswer) === null} onClick={() => setGapChecked(true)}>Check the edge calculation</button><button type="button" onClick={() => setView('B')}>Show B on the diagram above</button><a href="#map">Go to the diagram ↑</a></div>
      {gapChecked && <p role="status"><strong>{scaleAnswer(gapAnswer) === edge.gap ? 'The calculation matches.' : 'Check the edges again.'}</strong> B’s left edge ({edge.alternativeLeft} m) minus the route’s right edge ({edge.routeRight} m) = {edge.gap} m. Centre-to-centre distance includes parts of both rectangles and would answer a different question.</p>}
      <p>The supplied route footprint and gap are fictional geometry, not access standards. They do not establish drainage, crop spacing, soil suitability or safe working clearance. The original growing area remains existing evidence when B is displayed; do not count both outlines as active production.</p>
      <div className={styles.actions}><Link href="/student/design/scale">Practise gaps, touching edges and overlap →</Link><Link href="/student/design/folder#folder-d4">Record your measured-plan checks →</Link></div>
    </section>

    <section className={styles.section} id="work">
      <p className={styles.eyebrow}>5 · Make work and care feasible</p><h2>Keep each feature connected to its next task</h2>
      <p>Only discussion and investigation may proceed. Agree the evidence and care first, then define materials and request comparable quotations. No construction budget is supplied.</p>
      {pack.dependencies.map(row => <article className={styles.practice} key={row.item}><h3>{row.item}</h3><p><strong>Drawing references:</strong> {row.featureIds.join(', ')}</p><p><strong>Before physical work:</strong> {row.before}.</p><p><strong>Cost:</strong> {row.cost}.</p><p><strong>R1 record:</strong> {row.R1.phase}. {row.R1.quantity}. {row.R1.careStatus}.</p><p><strong>Who discusses the next check:</strong> {row.owner}.</p></article>)}
      <p>Use <Link href="/student/finance">Farm Finance</Link> to practise cash timing. A sales or packaging practice budget cannot serve as a garden-construction budget.</p><Link href="/student/design/folder#folder-d5">Record work, costs and agreed care →</Link>
    </section>

    <section className={styles.section} id="revision">
      <p className={styles.eyebrow}>6 · Respond to later information</p><h2>What changes when care is not agreed?</h2>
      <p><strong>{pack.revision.source}:</strong> {pack.sourceCards.find(card => card.id === pack.revision.source)!.text}</p><p>Before opening the record, name what should change in the drawing, work sequence, purchasing and care plan.</p>
      <details><summary>Read the R1 → R2 revision record</summary><p>{pack.revision.change} {pack.revision.reason}</p>
        {pack.dependencies.map(row => <article key={row.item} className={styles.practice}><h3>{row.item} · {row.featureIds.join(', ')}</h3><p><strong>Work:</strong> {row.R1.phase} → {row.R2.phase}.</p><p><strong>Quantity / purchasing:</strong> {row.R1.quantity} → {row.R2.quantity}.</p><p><strong>Cost:</strong> {row.R1.costStatus} → {row.R2.costStatus}.</p><p><strong>Care:</strong> {row.R1.careStatus} → {row.R2.careStatus}.</p></article>)}
        <p><strong>Next owner:</strong> {pack.revision.nextOwner}</p>
      </details>
      <div className={styles.actions}><button type="button" onClick={() => setView('revision')}>Show R2 on the diagram above</button><a href="#map">Go to the diagram ↑</a></div>
      <h3>Plan the next observations</h3><p>Agree the observer and timing with the household. These are proposed checks; no later field results are supplied.</p>
      {pack.observationPlan.map(row => <details key={row.goal}><summary>{row.goal}</summary><p>{row.task}</p><p><strong>When:</strong> {row.trigger}.</p><p><strong>What would prompt review:</strong> {row.review}</p></details>)}
      <Link href="/student/design/folder#folder-d6">Record feedback, observation plans and revisions →</Link>
    </section>

    <section className={styles.section} id="practice">
      <p className={styles.eyebrow}>Independent practice and facilitator discussion</p><h2>Apply the method to new evidence</h2>
      <p><strong>{pack.variation.id} · {pack.variation.kind}.</strong> {pack.variation.text}</p><p>{pack.variation.question}</p><details><summary>After your attempt: compare the reasoning</summary><p>{pack.variation.feedback}</p></details>
      <h3>Explain the guided evidence</h3>{pack.facilitator.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}<p>Keep your spoken or written explanation for a facilitator to review. Reading or revealing an answer does not award design competence.</p>
    </section>

    <section className={styles.section} id="handover">
      <p className={styles.eyebrow}>7 · Hand over the current record</p><h2>Keep the plan and its reasons together</h2>
      <p>Download each diagram you need, plus the source and decision record. It includes the current choice, alternative, conditions, work/cost/care records, next discussion owner and revision history. Keep your own learner notes in your separate design folder.</p>
      <div className={styles.actions}><button type="button" onClick={() => download(workedHandoverText(), 'text/plain;charset=utf-8', 'imbewu-worked-design-r2-record.txt')}>Download the guided source and decision record</button><Link className={styles.primary} href="/student/design/folder#folder-d6">Open my learning folder →</Link><Link href="/student/design/d6-1">Return to the final design stage →</Link></div><p role="status">{downloadMessage}</p>
    </section>
  </>;
}

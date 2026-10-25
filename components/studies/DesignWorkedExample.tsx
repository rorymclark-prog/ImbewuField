'use client';

import { useRef, useState } from 'react';
import { DESIGN_WORKED as pack, workedArea, workedEdgeGap, workedHandoverText } from '@/lib/design-worked';
import { scaleAnswer } from '@/lib/design-scale';
import DesignWorkedDiagram from './DesignWorkedDiagram';
import OfflinePageLink from './OfflinePageLink';
import DesignDraftCopy from './DesignDraftCopy';
import Tx, { TxRich, XhDraftLine } from './Tx';
import { useLanguage } from '@/lib/i18n';
import { inlineText, inlineTemplate } from '@/lib/xh-inline';
import styles from './FinanceCourse.module.css';
import ArrowLabel from './ArrowLabel';
import Summary from './Summary';
import { ArrowRight } from 'lucide-react';

type View = 'source' | 'A' | 'B' | 'revision';
const views: { id: View; label: string }[] = [
  { id: 'source', label: 'Existing evidence' }, { id: 'A', label: 'Concept A · R1' },
  { id: 'B', label: 'Concept B' }, { id: 'revision', label: 'Revised A · R2' },
];
const viewZu: Record<View, string> = { source: 'Ubufakazi obukhona', A: 'Umqondo A · R1', B: 'Umqondo B', revision: 'U-A obuyekeziwe · R2' };

/** R1 → R2 revision rows: a Lucide arrow, with "to" for screen readers. */
function ChangeArrow() { return <><span className="sr-only"> to </span><ArrowRight aria-hidden className="mx-1 inline h-4 w-4" /></>; }

export default function DesignWorkedExample() {
  const { lang } = useLanguage();
  const tx = (english: string) => inlineText(lang, english);
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

  // The download line carries a file name, so the exact-English lookup of DesignDraftCopy cannot match it for isiXhosa: it reads the template.
  const downloadNote = downloadMessage && (lang === 'xh' && downloadMessage.startsWith('Download requested:')
    ? <XhDraftLine xh={inlineTemplate(lang, 'Download requested: {name}. Open the saved file and check it before leaving this page.', null, { name: downloadMessage.match(/^Download requested: (.+?)\. Open the saved file and check it before leaving this page\.$/)?.[1] ?? 'imbewu-worked-design.svg' })} en={downloadMessage} />
    : <DesignDraftCopy en={downloadMessage} zu={downloadMessage.startsWith('Download requested:') ? `Kucelwe ukulanda: ${downloadMessage.match(/^Download requested: (.+?)\. Open the saved file and check it before leaving this page\.$/)?.[1] ?? 'ifayela'}. Vula ifayela elilondoloziwe ulihlole ngaphambi kokuphuma kuleli khasi.` : 'Ukulanda akukwazanga ukulungiswa. Gcina leli khasi livuliwe bese uzama futhi.'} />);

  return <>
    <aside className={`${styles.notice} ${styles.projectNotice}`}><p><strong><Tx en="English teaching preview." /></strong> {pack.notice}</p></aside>
    <nav className={styles.actions} aria-label={tx('Worked example stages')}>
      <a href="#read"><DesignDraftCopy en="1 · Sources" zu="1 · Imithombo" /></a><a href="#map"><DesignDraftCopy en="2 · Influences" zu="2 · Imithelela" /></a><a href="#compare"><DesignDraftCopy en="3 · Alternatives" zu="3 · Ezinye izindlela" /></a>
      <a href="#develop"><DesignDraftCopy en="4 · Fit" zu="4 · Ukuhambisana" /></a><a href="#work"><DesignDraftCopy en="5 · Work and care" zu="5 · Umsebenzi nokunakekela" /></a><a href="#revision"><DesignDraftCopy en="6 · Revision" zu="6 · Ukubuyekeza" /></a><a href="#handover"><DesignDraftCopy en="7 · Handover" zu="7 · Ukudlulisela irekhodi" /></a>
    </nav>

    <section className={styles.section} id="read">
      <p className={styles.eyebrow}><Tx en="1 · Read the brief and source map" /></p><h2><Tx en="What must this plan answer?" /></h2>
      <p>{pack.sourceCards.find(card => card.id === 'W-BRIEF')!.text}</p>
      <p><Tx en="Read the source cards before accepting a mark on a drawing. The frame is a classroom model; the top edge is model north by convention." /></p>
      {pack.sourceCards.map(card => <details key={card.id}><Summary>{card.id} · {card.title}</Summary><p><strong>{card.kind}.</strong> {card.text}</p></details>)}
      <details><Summary><DesignDraftCopy en="Read every supplied coordinate" zu="Funda zonke izixhumanisi ezinikeziwe" /></Summary>
        <p><Tx en="All values below are fictional classroom inputs in metres. Existing features belong to W-MAP; the alternative belongs to W-B; the compost proposal belongs to W-A. No value is inferred from the picture." /></p>
        <p><Tx en="Frame: {width} × {height} m." values={{ width: pack.frame.width, height: pack.frame.height }} /> {pack.coordinateSystem.axis}.</p>
        <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={tx('Supplied fictional geometry')}><table>
          <caption><DesignDraftCopy en="Model coordinates — rectangles use their top-left corner" zu="Izixhumanisi zemodeli — onxande basebenzisa ikhoneni eliphezulu kwesokunxele" /></caption><thead><tr><th><Tx en="Reference" /></th><th>x / y (m)</th><th><Tx en="Width × height (m)" /></th></tr></thead>
          <tbody>{geometry.map(feature => <tr key={feature.id}><th>{feature.id}<br />{feature.label}</th><td>{feature.x} / {feature.y}</td><td>{'width' in feature ? `${feature.width} × ${feature.height}` : tx('Reference point only')}</td></tr>)}</tbody>
        </table></div>
      </details>
      <OfflinePageLink href="/student/design/folder#folder-d1"><DesignDraftCopy en="Record your own brief and evidence sources →" zu="Rekhoda incazelo yakho nemithombo yobufakazi →" /></OfflinePageLink>
    </section>

    <section className={styles.section} id="map">
      <p className={styles.eyebrow}><Tx en="2 · Read influences" /></p><h2><Tx en="Follow people and care before adding features" /></h2>
      <p><Tx en="The water point, growing area and home-to-gate route suggest journeys to discuss with the people doing the work. They do not establish a measured travel time or an agreed workload." /></p>
      <p><strong><Tx en="Reported, not surveyed:" /></strong> {pack.sourceCards.find(card => card.id === 'W-OBS')!.text}</p>
      <div className={styles.actions} role="group" aria-label={tx('Worked-example drawing view')}>{views.map(item => <button key={item.id} type="button" aria-pressed={view === item.id} onClick={() => { setView(item.id); setDownloadMessage(''); }}><DesignDraftCopy en={item.label} zu={viewZu[item.id]} /></button>)}</div>
      <DesignWorkedDiagram view={view} svgRef={mapRef} />
      <div className={styles.actions}><button type="button" onClick={() => {
        if (mapRef.current) download(new XMLSerializer().serializeToString(mapRef.current), 'image/svg+xml;charset=utf-8', `imbewu-worked-design-${view}-view-${view === 'revision' ? 'r2' : 'r1'}-pack-${pack.currentRevision.toLowerCase()}.svg`);
      }}><DesignDraftCopy en="Download this model diagram (SVG)" zu="Landa umdwebo wale modeli (SVG)" /></button></div>
      <p><Tx en="Use the dimensions written on the diagram. Printing may change its size; no physical print scale is claimed." /></p><p role="status">{downloadNote}</p>
      <OfflinePageLink href="/student/design/folder#folder-d2"><DesignDraftCopy en="Record influences and the checks they need →" zu="Rekhoda imithelela nokuhlolwa okudingekayo →" /></OfflinePageLink>
    </section>

    <section className={styles.section} id="compare">
      <p className={styles.eyebrow}><Tx en="3 · Compare fair alternatives" /></p><h2><Tx en="Which option would you investigate?" /></h2>
      <p><Tx en="A keeps the existing growing location. B investigates a different location with the same {area} m² model area. Both must answer the same food, access and care brief. Neither is approved for construction." values={{ area: workedArea(existing) ?? '' }} /></p>
      <p><Tx en="Choose A, B or deferral. Explain aloud or on paper: which source supports your choice, what trade-off remains, and what new evidence could change your mind?" /></p>
      <div className={styles.actions} role="group" aria-label={tx('Provisional response')}>{[['A', 'Investigate A first'], ['B', 'Investigate B first'], ['defer', 'Defer physical changes']].map(([id, label]) => <button key={id} type="button" aria-pressed={choice === id} onClick={() => { setChoice(id); setChoiceChecked(false); }}><DesignDraftCopy en={label} zu={id==='A'?'Phenya u-A kuqala':id==='B'?'Phenya u-B kuqala':'Hlehlisa izinguquko ezibonakalayo'} /></button>)}</div>
      <div className={styles.actions}><button type="button" disabled={!choice} aria-expanded={choiceChecked} onClick={() => setChoiceChecked(value => !value)}><DesignDraftCopy en={choiceChecked ? 'Hide comparison feedback' : 'Compare my reasoning'} zu={choiceChecked ? 'Fihla impendulo yokuqhathanisa' : 'Qhathanisa izizathu zami'} /></button></div>
      {choiceChecked && <div className={styles.practice}>
        <p><strong><Tx en="Discuss the reason, not just the selection." /></strong> {choice === 'B' ? tx('Investigating B can be reasonable if you explain its additional location checks. A relocated outline is not evidence of better growing conditions.') : choice === 'defer' ? pack.decision.deferral : pack.decision.provisional}</p>
        <p>{pack.decision.rejected} {pack.reconsider}</p>
        <div className={styles.tableScroll} role="region" tabIndex={0} aria-label={tx('Same criteria for both concepts')}><table><caption><Tx en="Compare each option against the same evidence" /></caption><thead><tr><th><Tx en="Criterion / source" /></th><th><Tx en="Concept A" /></th><th><Tx en="Concept B" /></th><th><Tx en="Still unknown" /></th></tr></thead>
          <tbody>{pack.comparison.map(row => <tr key={row.criterion}><th>{row.criterion}<br /><small>{row.source}</small></th><td>{row.A}</td><td>{row.B}</td><td>{row.limit}</td></tr>)}</tbody>
        </table></div>
      </div>}
      <p><Tx en="This is a discussion exercise, not an assessment result. A facilitator reviews the evidence and explanation." /></p><OfflinePageLink href="/student/design/folder#folder-d3"><DesignDraftCopy en="Record alternatives and your reasoned choice →" zu="Rekhoda ezinye izindlela nokukhetha kwakho okunezizathu →" /></OfflinePageLink>
    </section>

    <section className={styles.section} id="develop">
      <p className={styles.eyebrow}><Tx en="4 · Develop and check" /></p><h2><Tx en="Measure between the actual edges" /></h2>
      <p><Tx en="The guided choice is to investigate A while keeping physical changes on hold. B remains an alternative. Inspect each outline against the supplied frame and the existing route." /></p>
      <p><Tx en="For B, calculate the horizontal gap from the route’s right edge to the proposed growing area’s left edge. Use E-ROUTE in W-MAP and P-B-PLOT in W-B. These rectangles overlap along the north–south direction, so this is their clear horizontal separation." /></p>
      <label className={styles.answerField} htmlFor="worked-edge-gap"><strong><DesignDraftCopy en="Edge-to-edge gap in metres" zu="Igebe elisuka komunye umphetho liye komunye ngamamitha" /></strong><input id="worked-edge-gap" inputMode="decimal" maxLength={24} value={gapAnswer} onChange={event => { setGapAnswer(event.target.value); setGapChecked(false); }} /></label>
      <div className={styles.actions}><button type="button" disabled={scaleAnswer(gapAnswer) === null} onClick={() => setGapChecked(true)}><DesignDraftCopy en="Check the edge calculation" zu="Hlola isibalo sebanga phakathi kwemiphetho" /></button><button type="button" onClick={() => setView('B')}><DesignDraftCopy en="Show B on the diagram above" zu="Bonisa u-B emdwebeni ongenhla" /></button><a href="#map"><DesignDraftCopy en="Go to the diagram ↑" zu="Yiya emdwebeni ↑" /></a></div>
      {gapChecked && <p role="status"><strong><DesignDraftCopy en={scaleAnswer(gapAnswer) === edge.gap ? 'The calculation matches.' : 'Check the edges again.'} zu={scaleAnswer(gapAnswer) === edge.gap ? 'Isibalo siyahambisana.' : 'Hlola imiphetho futhi.'} /></strong> <Tx en="B’s left edge ({left} m) minus the route’s right edge ({right} m) = {gap} m. Centre-to-centre distance includes parts of both rectangles and would answer a different question." values={{ left: edge.alternativeLeft, right: edge.routeRight, gap: edge.gap }} /></p>}
      <p><Tx en="The supplied route footprint and gap are fictional geometry, not access standards. They do not establish drainage, crop spacing, soil suitability or safe working clearance. The original growing area remains existing evidence when B is displayed; do not count both outlines as active production." /></p>
      <div className={styles.actions}><OfflinePageLink href="/student/design/scale"><DesignDraftCopy en="Practise gaps, touching edges and overlap →" zu="Zilolonge ngamagebe, imiphetho ethintanayo nezindawo ezidlulanayo →" /></OfflinePageLink><OfflinePageLink href="/student/design/folder#folder-d4"><DesignDraftCopy en="Record your measured-plan checks →" zu="Rekhoda ukuhlolwa kohlelo lwakho olulinganisiwe →" /></OfflinePageLink></div>
    </section>

    <section className={styles.section} id="work">
      <p className={styles.eyebrow}><Tx en="5 · Make work and care feasible" /></p><h2><Tx en="Keep each feature connected to its next task" /></h2>
      <p><Tx en="Only discussion and investigation may proceed. Agree the evidence and care first, then define materials and request comparable quotations. No construction budget is supplied." /></p>
      {pack.dependencies.map(row => <article className={styles.practice} key={row.item}><h3>{row.item}</h3><p><strong><Tx en="Drawing references:" /></strong> {row.featureIds.join(', ')}</p><p><strong><Tx en="Before physical work:" /></strong> {row.before}.</p><p><strong><Tx en="Cost:" /></strong> {row.cost}.</p><p><strong><Tx en="R1 record:" /></strong> {row.R1.phase}. {row.R1.quantity}. {row.R1.careStatus}.</p><p><strong><Tx en="Who discusses the next check:" /></strong> {row.owner}.</p></article>)}
      <p><TxRich en="Use {link} to practise cash timing. A sales or packaging practice budget cannot serve as a garden-construction budget." nodes={{ link: <OfflinePageLink href="/student/finance"><Tx en="Farm Finance" /></OfflinePageLink> }} /></p><OfflinePageLink href="/student/design/folder#folder-d5"><ArrowLabel>{tx('Record work, costs and agreed care')}</ArrowLabel></OfflinePageLink>
    </section>

    <section className={styles.section} id="revision">
      <p className={styles.eyebrow}><Tx en="6 · Respond to later information" /></p><h2><Tx en="What changes when care is not agreed?" /></h2>
      <p><strong>{pack.revision.source}:</strong> {pack.sourceCards.find(card => card.id === pack.revision.source)!.text}</p><p><Tx en="Before opening the record, name what should change in the drawing, work sequence, purchasing and care plan." /></p>
      <details><Summary><DesignDraftCopy en="Read the R1 → R2 revision record" zu="Funda irekhodi lokubuyekeza kusukela ku-R1 kuya ku-R2" /></Summary><p>{pack.revision.change} {pack.revision.reason}</p>
        {pack.dependencies.map(row => <article key={row.item} className={styles.practice}><h3>{row.item} · {row.featureIds.join(', ')}</h3><p><strong><Tx en="Work:" /></strong> {row.R1.phase} → {row.R2.phase}.</p><p><strong><Tx en="Quantity / purchasing:" /></strong> {row.R1.quantity} → {row.R2.quantity}.</p><p><strong><Tx en="Cost:" /></strong> {row.R1.costStatus} → {row.R2.costStatus}.</p><p><strong><Tx en="Care:" /></strong> {row.R1.careStatus} → {row.R2.careStatus}.</p></article>)}
        <p><strong><Tx en="Next owner:" /></strong> {pack.revision.nextOwner}</p>
      </details>
      <div className={styles.actions}><button type="button" onClick={() => setView('revision')}><DesignDraftCopy en="Show R2 on the diagram above" zu="Bonisa u-R2 emdwebeni ongenhla" /></button><a href="#map"><DesignDraftCopy en="Go to the diagram ↑" zu="Yiya emdwebeni ↑" /></a></div>
      <h3><Tx en="Plan the next observations" /></h3><p><Tx en="Agree the observer and timing with the household. These are proposed checks; no later field results are supplied." /></p>
      {pack.observationPlan.map(row => <details key={row.goal}><Summary>{row.goal}</Summary><p>{row.task}</p><p><strong><Tx en="When:" /></strong> {row.trigger}.</p><p><strong><Tx en="What would prompt review:" /></strong> {row.review}</p></details>)}
      <OfflinePageLink href="/student/design/folder#folder-d6"><DesignDraftCopy en="Record feedback, observation plans and revisions →" zu="Rekhoda impendulo, izinhlelo zokuqaphela nokubuyekeza →" /></OfflinePageLink>
    </section>

    <section className={styles.section} id="practice">
      <p className={styles.eyebrow}><Tx en="Independent practice and facilitator discussion" /></p><h2><Tx en="Apply the method to new evidence" /></h2>
      <p><strong>{pack.variation.id} · {pack.variation.kind}.</strong> {pack.variation.text}</p><p>{pack.variation.question}</p><details><Summary><DesignDraftCopy en="After your attempt: compare the reasoning" zu="Ngemva kokuzama: qhathanisa izizathu" /></Summary><p>{pack.variation.feedback}</p></details>
      <h3><Tx en="Explain the guided evidence" /></h3>{pack.facilitator.map(item => <details key={item.question}><Summary>{item.question}</Summary><p>{item.answer}</p></details>)}<p><Tx en="Keep your spoken or written explanation for a facilitator to review. Reading or revealing an answer does not award design competence." /></p>
    </section>

    <section className={styles.section} id="handover">
      <p className={styles.eyebrow}><Tx en="7 · Hand over the current record" /></p><h2><Tx en="Keep the plan and its reasons together" /></h2>
      <p><Tx en="Download each diagram you need, plus the source and decision record. It includes the current choice, alternative, conditions, work/cost/care records, next discussion owner and revision history. Keep your own learner notes in your separate design folder." /></p>
      <div className={styles.actions}><button type="button" onClick={() => download(workedHandoverText(), 'text/plain;charset=utf-8', 'imbewu-worked-design-r2-record.txt')}><DesignDraftCopy en="Download the guided source and decision record" zu="Landa umthombo nerekhodi lezinqumo eliqondiswayo" /></button><OfflinePageLink className={styles.primary} href="/student/design/folder#folder-d6"><DesignDraftCopy en="Open my learning folder →" zu="Vula ifolda yami yokufunda →" /></OfflinePageLink><OfflinePageLink href="/student/design/d6-1"><DesignDraftCopy en="Return to the final design stage →" zu="Buyela esigabeni sokugcina sokuklama →" /></OfflinePageLink></div><p role="status">{downloadNote}</p>
    </section>
  </>;
}

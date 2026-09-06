import type { ChapterGraphic } from '@/lib/report-chapter-visuals';
import { reportChartSvg } from '@/lib/report-visuals';
import styles from './ReportChapterGraphics.module.css';
export default function ReportChapterGraphics({graphics}:{graphics:ChapterGraphic[]}) {
  return <div className={styles.graphics}>{graphics.map(graphic=><figure key={graphic.id}>
    <div className={styles.heading}><span>VISUAL FIELD GUIDE</span><h3>{graphic.title}</h3></div>
    {graphic.svg&&<img className={styles.diagram} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(graphic.svg)}`} alt={graphic.title}/>}
    {graphic.chart&&<img className={styles.diagram} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(reportChartSvg(graphic.chart).svg)}`} alt={`${graphic.title}. ${graphic.chart.rows.map(r=>`${r.label}: ${graphic.chart!.kind==='calendar'?(r.months??[]).map(m=>m+1).join(', '):`${r.value} ${graphic.chart!.unit}`}`).join('; ')}`}/>}
    {graphic.trees&&<div className={styles.trees}>{graphic.trees.map(tree=><div key={tree.name}><img src={tree.image} alt={`Catalogue illustration: ${tree.name}`} loading="lazy"/><strong>{tree.name}</strong></div>)}</div>}
    <figcaption>{graphic.note}</figcaption>
  </figure>)}</div>;
}

import { Maximize2 } from 'lucide-react';
import type { OpenReportImage } from './ReportVisualOverview';
import type { ChapterGraphic } from '@/lib/report-chapter-visuals';
import { reportChartSvg } from '@/lib/report-visuals';
import SidewaysScroller from './SidewaysScroller';
import styles from './ReportChapterGraphics.module.css';
export default function ReportChapterGraphics({graphics,onOpenImage,viewLabel='View full size'}:{graphics:ChapterGraphic[];onOpenImage?:OpenReportImage;viewLabel?:string}) {
  return <div className={styles.graphics}>{graphics.map(graphic=>{
    const svg = graphic.svg ?? (graphic.chart ? reportChartSvg(graphic.chart).svg : null);
    const image = svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : graphic.art?.src;
    return <figure key={graphic.id}>
    <div className={styles.heading}><span>{graphic.chart?.figure?(graphic.chart.unit||'THIS SITE'):graphic.art?'HOW IT WORKS':'VISUAL FIELD GUIDE'}</span><h3>{graphic.title}</h3>{onOpenImage&&image&&<button type="button" className={`${styles.enlarge} no-print`} onClick={()=>onOpenImage(graphic.title,image)}><Maximize2 size={16} aria-hidden="true"/>{viewLabel}</button>}</div>
    {graphic.svg&&<img className={styles.diagram} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(graphic.svg)}`} alt={graphic.title}/>}
    {graphic.chart?.figure&&<SidewaysScroller className={styles.scroll} label={graphic.title} hint={graphic.slideHint}><img className={styles.figure} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(graphic.chart.figure.svg)}`} alt={graphic.chart.figure.alt} width={graphic.chart.figure.width} height={graphic.chart.figure.height}/></SidewaysScroller>}
    {graphic.chart&&!graphic.chart.figure&&<img className={styles.diagram} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(reportChartSvg(graphic.chart).svg)}`} alt={`${graphic.title}. ${graphic.chart.rows.map(r=>`${r.label}: ${graphic.chart!.kind==='calendar'?(r.months??[]).map(m=>m+1).join(', '):`${r.value} ${graphic.chart!.unit}`}`).join('; ')}`}/>}
    {graphic.art&&<img className={styles.art} src={graphic.art.src} alt={graphic.art.alt} width={graphic.art.width} height={graphic.art.height} loading="lazy" onError={event=>{const figure=event.currentTarget.closest('figure');if(figure)figure.style.display='none';}}/>}
    {graphic.trees&&<div className={styles.trees}>{graphic.trees.map(tree=><div key={tree.name}><img src={tree.image} alt={`Catalogue illustration: ${tree.name}`} loading="lazy"/><strong>{tree.name}</strong></div>)}</div>}
    <figcaption>{graphic.note}</figcaption>
  </figure>;})}</div>;
}

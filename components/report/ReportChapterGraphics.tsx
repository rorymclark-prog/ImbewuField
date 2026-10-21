'use client';
import { Maximize2 } from 'lucide-react';
import type { OpenReportImage } from './ReportVisualOverview';
import type { ChapterGraphic } from '@/lib/report-chapter-visuals';
import { reportChartSvg, reportChartAlt, reportVisualText } from '@/lib/report-visuals';
import SidewaysScroller from './SidewaysScroller';
import { useLanguage } from '@/lib/i18n-context';
import styles from './ReportChapterGraphics.module.css';
export default function ReportChapterGraphics({graphics,onOpenImage,viewLabel}:{graphics:ChapterGraphic[];onOpenImage?:OpenReportImage;viewLabel?:string}) {
  const { lang } = useLanguage();
  const copy = (source: string, values?: Record<string, string | number>) => reportVisualText(source, lang, values);
  const fullSizeLabel = viewLabel ?? copy('View full size');
  return <div lang={lang} className={styles.graphics}>{graphics.map(graphic=>{
    const svg = graphic.svg ?? (graphic.chart ? reportChartSvg(graphic.chart).svg : null);
    const image = svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : graphic.art?.src;
    return <figure key={graphic.id}>
    <div className={styles.heading}><span>{graphic.chart?.figure?(graphic.chart.unit||copy('THIS SITE')):graphic.art?copy('HOW IT WORKS'):copy('VISUAL FIELD GUIDE')}</span><h3>{graphic.title}</h3>{onOpenImage&&image&&<button type="button" className={`${styles.enlarge} no-print`} onClick={()=>onOpenImage(graphic.title,image)}><Maximize2 size={16} aria-hidden="true"/>{fullSizeLabel}</button>}</div>
    {graphic.svg&&<img className={styles.diagram} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(graphic.svg)}`} alt={graphic.title}/>}
    {graphic.chart?.figure&&<SidewaysScroller className={styles.scroll} label={graphic.title} hint={graphic.slideHint ?? copy('Slide to see more')}><img className={styles.figure} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(graphic.chart.figure.svg)}`} alt={graphic.chart.figure.alt} width={graphic.chart.figure.width} height={graphic.chart.figure.height}/></SidewaysScroller>}
    {graphic.chart&&!graphic.chart.figure&&<img className={styles.diagram} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(reportChartSvg(graphic.chart).svg)}`} alt={reportChartAlt(graphic.chart)}/>}
    {graphic.art&&<img className={styles.art} src={graphic.art.src} alt={graphic.art.alt} width={graphic.art.width} height={graphic.art.height} loading="lazy" onError={event=>{const figure=event.currentTarget.closest('figure');if(figure)figure.style.display='none';}}/>}
    {graphic.trees&&<div className={styles.trees}>{graphic.trees.map(tree=><div key={tree.name}><img src={tree.image} alt={copy('Catalogue illustration: {name}', { name: tree.name })} loading="lazy"/><strong>{tree.name}</strong></div>)}</div>}
    <figcaption>{graphic.note}</figcaption>
  </figure>;})}</div>;
}

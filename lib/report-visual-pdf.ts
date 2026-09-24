import type { jsPDF } from 'jspdf';
import { pdfSafe } from './crop-export-pdf';
import { reportChartSvg, type ReportVisuals } from './report-visuals';
import type { ChapterGraphic } from './report-chapter-visuals';

export type VisualImage = { image: string; caption: string };
/** maxHeight (pt): a figure drawn from the site's data may run taller on the page than a concept picture. */
export type ChapterImage = { image:string; title:string; caption:string; maxHeight?:number };
export type VisualPdfAssets = { charts: Record<string, string>; photos: VisualImage[]; plants?: VisualImage[]; chapters?:Record<string,ChapterImage[]> };

async function svgImage(svg: string): Promise<string> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(Error('Chart image could not be prepared.')); img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = img.width * 2; canvas.height = img.height * 2;
    const context = canvas.getContext('2d');
    if (!context) throw Error('Chart canvas unavailable.');
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}

export async function prepareVisualPdfAssets(visuals: ReportVisuals, photos: VisualImage[] = [], plants: VisualImage[] = [], chapters:Record<string,ChapterGraphic[]> = {}): Promise<VisualPdfAssets> {
  const charts: Record<string, string> = {};
  // Sequential conversion keeps peak memory bounded on the farmer's phone.
  for (const chart of visuals.charts) charts[chart.id] = await svgImage(reportChartSvg(chart).svg);
  const attached: VisualImage[] = [];
  for (const photo of photos) {
    if (photo.image.startsWith('data:')) { attached.push(photo); continue; }
    const response = await fetch(photo.image);
    if (!response.ok) throw Error('A report image is unavailable. Retry or export without photographs.');
    const blob = await response.blob();
    const image = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
    attached.push({ ...photo, image });
  }
  const plantImages: VisualImage[] = [];
  for (const plant of plants) {
    const response = await fetch(plant.image);
    if (!response.ok) continue;
    const blob = await response.blob();
    const image = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
    plantImages.push({ ...plant, image });
  }
  const chapterImages:Record<string,ChapterImage[]>={};
  const cached=new Map<string,string>();
  const escape=(s:string)=>s.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
  for(const [heading,graphics] of Object.entries(chapters)){
    const images:ChapterImage[]=[];
    for(const graphic of graphics){
      if(graphic.svg||graphic.chart){
        const key=graphic.svg?graphic.id:`chart-${graphic.chart!.id}`;
        let image=cached.get(key);
        if(!image){image=graphic.chart?charts[graphic.chart.id]??await svgImage(reportChartSvg(graphic.chart).svg):await svgImage(graphic.svg!);cached.set(key,image);}
        images.push({image,title:graphic.title,caption:graphic.note,...(graphic.chart?.kind==='figure'?{maxHeight:440}:{})});
      }
      if(graphic.art){
        // A concept picture explains an idea; it carries no site data. Offline or missing, it is left out and the export carries on.
        try{
          let image=cached.get(graphic.art.src);
          if(!image){const response=await fetch(graphic.art.src);if(response.ok){const blob=await response.blob();image=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);});cached.set(graphic.art.src,image);}}
          if(image)images.push({image,title:graphic.title,caption:graphic.note});
        }catch{/* left out */}
      }
      if(graphic.trees)for(let start=0;start<graphic.trees.length;start+=6){
        const trees=graphic.trees.slice(start,start+6);const columns=trees.length===4?2:Math.min(3,trees.length);const cellWidth=772/columns;const height=Math.ceil(trees.length/columns)*260+30;
        const parts=[`<svg xmlns="http://www.w3.org/2000/svg" width="820" height="${height}"><rect width="100%" height="100%" fill="#eff5e9"/>`];
        for(let i=0;i<trees.length;i++){
          const tree=trees[i];let source=cached.get(tree.image);
          if(!source){const response=await fetch(tree.image);if(!response.ok)throw Error('A tree illustration could not load. Reconnect and retry the full-colour export.');const blob=await response.blob();source=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);});cached.set(tree.image,source);}
          const x=24+i%columns*cellWidth+(cellWidth-240)/2,y=15+Math.floor(i/columns)*260;
          parts.push(`<image href="${source}" x="${x}" y="${y}" width="240" height="215"/><text x="${x+120}" y="${y+242}" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="#245738">${escape(tree.name)}</text>`);
        }
        images.push({image:await svgImage(parts.join('')+'</svg>'),title:graphic.title,caption:graphic.note});
      }
    }
    if(images.length)chapterImages[heading]=images;
  }
  return { charts, photos: attached, plants: plantImages, chapters:chapterImages };
}

/** One overview card as the packer sees it: `fixed` is the title, note and padding; the drawing may
 * be set anywhere between `min` and `natural` tall. `titled` cards open a page under a heading of
 * their own when they start one. All in the 600-wide page units the front matter uses. */
export type ReportCardBox = { id: string; fixed: number; natural: number; min: number; titled?: boolean };
export type ReportCardSlot = { id: string; page: 'same' | 'titled' | 'continued'; y: number; chartHeight: number };
const CARD_GAP = 20;
/** Where content starts under a front-matter page heading (one line of 23 pt under the running head)… */
const PAGE_TOP = 120;
/** …and on a page that simply carries the section on, which repeats no heading. */
const CONTINUED_TOP = 58;

/**
 * Where each overview card goes. Cards keep their order unless the next one cannot share the page
 * and a later one can: a half-empty page followed by a page holding one small card reads as a
 * broken export. A drawing may be set slightly smaller (never below `min`) to share a page, and a
 * drawing taller than a whole page is fitted to one.
 */
export function packReportCards(cards: ReportCardBox[], start: { y: number; fresh: boolean }, tops: { titled: number; continued: number }, limit: number): ReportCardSlot[] {
  const slots: ReportCardSlot[] = [];
  const queue = [...cards];
  let y = start.y, fresh = start.fresh;
  while (queue.length) {
    const room = limit - y;
    const pick = fresh ? -1 : queue.findIndex(card => card.fixed + Math.min(card.min, card.natural) <= room);
    if (pick < 0) {
      const card = queue.shift()!;
      const titled = fresh || !!card.titled, top = titled ? tops.titled : tops.continued;
      const chartHeight = Math.min(card.natural, limit - top - card.fixed);
      slots.push({ id: card.id, page: titled ? 'titled' : 'continued', y: top, chartHeight });
      y = top + card.fixed + chartHeight + CARD_GAP; fresh = false;
      continue;
    }
    const [card] = queue.splice(pick, 1);
    const chartHeight = Math.min(card.natural, room - card.fixed);
    slots.push({ id: card.id, page: 'same', y, chartHeight });
    y += card.fixed + chartHeight + CARD_GAP;
  }
  return slots;
}

/** The PDF reuses the screen's exact chart artwork and data, at print resolution.
 * The caller owns page numbering, branding and the full narrative that follows. */
export function drawVisualReportFront(doc: jsPDF, visuals: ReportVisuals, assets: VisualPdfAssets, date: string, language: 'en' | 'zu' = 'en'): void {
  const label = (en: string, zu: string) => language === 'zu' ? zu : en;
  const standardLabel = (value: string) => ({
    'IMBEWUFIELD / SITE REPORT': label('IMBEWUFIELD / SITE REPORT','IMBEWUFIELD / UMBIKO WESIZA'),
    'The site at a glance': label('The site at a glance','Indawo le njengoba injalo'),
    'Report basis': label('Report basis','Isisekelo sombiko'),
    'Planting through the year': label('Planting through the year','Ukutshala phakathi nonyaka'),
  } as Record<string,string>)[value] ?? value;
  const scale = doc.internal.pageSize.getWidth() / 600;
  const u = (v: number) => v * scale;
  // A figure such as "R 15 890" must not break across two lines: its spaces become non-breaking ones.
  const safe = (value: string) => pdfSafe(value).replace(/(\d) (?=\d{3}(?!\d))/g, '$1\u00a0').replace(/\bR (?=\d)/g, 'R\u00a0');
  let y = 46;
  const rect = (x: number, top: number, w: number, h: number, fill: string) => { doc.setFillColor(fill); doc.rect(u(x), u(top), u(w), u(h), 'F'); };
  const write = (value: string, x: number, top: number, width: number, size: number, colour = '#1b3024', bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(colour);
    const rows = doc.splitTextToSize(safe(value), u(width)) as string[];
    doc.text(rows, u(x), u(top));
    return rows.length * size * 1.3;
  };
  const page = (title: string | null) => { doc.addPage(); rect(0, 0, 600, 6, '#245738'); write(standardLabel('IMBEWUFIELD / SITE REPORT'), 44, 35, 400, 9, '#526258'); y = title === null ? CONTINUED_TOP : Math.max(PAGE_TOP, 70 + write(standardLabel(title), 44, 70, 512, 23, '#245738', true) + 20); };
  const image = (photo: VisualImage, x: number, top: number, width: number, height: number) => {
    const data = doc.getImageProperties(photo.image);
    const fit = Math.min(width / data.width, height / data.height);
    const w = data.width * fit, h = data.height * fit;
    rect(x, top, width, height, '#f0f4f1');
    doc.addImage(photo.image, data.fileType, u(x + (width - w) / 2), u(top + (height - h) / 2), u(w), u(h), undefined, 'FAST');
  };
  doc.setFont('helvetica', 'bold'); doc.setFontSize(30);
  const titleRows = doc.splitTextToSize(safe(visuals.title), u(494)) as string[];
  // The cover picture: the farmer's own photograph or map when there is one. Without it, the site
  // plan drawn from the saved design takes the cover instead of leaving most of the page blank.
  const coverPlan = assets.photos[0] ? undefined : visuals.charts.find(chart => chart.kind === 'figure' && chart.id === 'site-plan' && assets.charts[chart.id]);
  // Under a drawing that wants the height, the title band is only as deep as the title needs.
  const headingHeight = coverPlan ? 95 + titleRows.length * 39 + (visuals.subtitle ? 44 : 14) : Math.max(215, 138 + titleRows.length * 37);
  rect(0, 0, 600, headingHeight, '#173f2d');
  write(standardLabel('IMBEWUFIELD / SITE REPORT'), 44, 40, 350, 10, '#d6e7d9');
  write(date, 430, 40, 125, 9, '#d6e7d9');
  y = 95 + write(visuals.title, 44, 95, 494, 30, '#ffffff', true);
  write(visuals.subtitle, 44, y + 18, 494, 11, '#d6e7d9');
  y = headingHeight + 20;
  const glance = visuals.overviewTitle ?? standardLabel('The site at a glance');
  let onGlancePage = false;
  if (assets.photos[0]) { image(assets.photos[0], 44, y, 512, 310); y += 327; y += write(assets.photos[0].caption, 44, y, 512, 8, '#526258') + 18; }
  else if (coverPlan) {
    const drawing = reportChartSvg(coverPlan);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    const captionHeight = (doc.splitTextToSize(safe(coverPlan.note), u(512)) as string[]).length * 8 * 1.3;
    const room = doc.internal.pageSize.getHeight() / scale - 62 - y - captionHeight - 12;
    const fit = Math.min(512 / drawing.width, room / drawing.height);
    const w = drawing.width * fit, h = drawing.height * fit;
    doc.addImage(assets.charts[coverPlan.id], 'PNG', u(44 + (512 - w) / 2), u(y), u(w), u(h), undefined, 'FAST');
    write(coverPlan.note, 44, y + h + 16, 512, 8, '#526258');
    page(glance); onGlancePage = true;
  }
  const columns = visuals.metrics.length > 2 ? 4 : 2;
  const cell = 526 / columns;
  const metricRows = Math.ceil(visuals.metrics.length / columns);
  if (y + metricRows * 100 > 750) { page(glance); onGlancePage = true; }
  visuals.metrics.forEach((metric, i) => {
    const x = 44 + (i % columns) * cell, top = y + Math.floor(i / columns) * 100;
    rect(x, top - 10, 3, 78, '#af6b24');
    write(metric.label, x + 10, top, cell - 24, 9, '#526258');
    write(metric.value, x + 10, top + 33, cell - 24, columns === 4 ? 19 : 23, '#1b3024', true);
    write(metric.note, x + 10, top + 53, cell - 24, 8, '#526258');
  });
  y += metricRows * 100 + 4;
  if (y + 55 > 765) { page('Report basis'); onGlancePage = false; }
  y += write(visuals.basis, 44, y, 512, 9, '#526258') + 22;

  // The cards carry straight on under the figures when that page is already "the site at a glance";
  // after a photograph cover they open on a page of their own, as before.
  const LIMIT = 786; // the page footer is written at about 807
  const SIDE = 320; // a short bar chart is set at this width with its note beside it, not stretched across the card
  const cards = visuals.charts.filter(chart => chart !== coverPlan).map(chart => {
    const drawing = reportChartSvg(chart);
    const beside = chart.kind === 'bars' || chart.kind === 'progress';
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
    const titleHeight = doc.splitTextToSize(safe(chart.title), u(476)).length * 22;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    const noteHeight = doc.splitTextToSize(safe(chart.note), u(beside ? 476 - SIDE - 22 : 476)).length * 12;
    const natural = drawing.height / drawing.width * (beside ? SIDE : 476);
    const box: ReportCardBox = beside
      ? { id: chart.id, fixed: 40 + titleHeight, natural: Math.max(natural, noteHeight + 6), min: Math.max(natural, noteHeight + 6) }
      : { id: chart.id, fixed: 40 + titleHeight + noteHeight, natural, min: natural * 0.88, titled: chart.kind === 'calendar' };
    return { chart, drawing, titleHeight, beside, natural, box };
  });
  const byId = new Map(cards.map(card => [card.box.id, card]));
  for (const slot of packReportCards(cards.map(card => card.box), { y, fresh: !onGlancePage }, { titled: PAGE_TOP, continued: CONTINUED_TOP }, LIMIT)) {
    const { chart, drawing, titleHeight, beside, natural, box } = byId.get(slot.id)!;
    if (slot.page !== 'same') page(slot.page === 'continued' ? null : chart.kind === 'calendar' ? 'Planting through the year' : 'The site at a glance');
    y = slot.y;
    const height = box.fixed + slot.chartHeight;
    doc.setDrawColor('#d6e1d8'); doc.roundedRect(u(44), u(y), u(512), u(height), u(6), u(6));
    write(chart.title, 62, y + 29, 476, 17, '#245738', true);
    const png = assets.charts[chart.id];
    if (!png) throw Error(`Missing chart artwork: ${chart.title}`);
    if (beside) {
      doc.addImage(png, 'PNG', u(62), u(y + 17 + titleHeight), u(SIDE), u(natural), undefined, 'FAST');
      write(chart.note, 62 + SIDE + 22, y + 29 + titleHeight, 476 - SIDE - 22, 9, '#526258');
    } else {
      const chartWidth = slot.chartHeight * drawing.width / drawing.height;
      doc.addImage(png, 'PNG', u(62 + (476 - chartWidth) / 2), u(y + 17 + titleHeight), u(chartWidth), u(slot.chartHeight), undefined, 'FAST');
      write(chart.note, 62, y + 29 + titleHeight + slot.chartHeight, 476, 9, '#526258');
    }
    y += height + CARD_GAP;
  }
  for (const photo of assets.photos.slice(1)) {
    page('The garden in view');
    image(photo, 44, y, 512, 500);
    write(photo.caption, 44, y + 521, 512, 10, '#526258');
  }

}

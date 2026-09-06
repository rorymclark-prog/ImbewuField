import type { jsPDF } from 'jspdf';
import { pdfSafe } from './crop-export-pdf';
import { reportChartSvg, type ReportVisuals } from './report-visuals';
import type { ChapterGraphic } from './report-chapter-visuals';

export type VisualImage = { image: string; caption: string };
export type ChapterImage = { image:string; title:string; caption:string };
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
        images.push({image,title:graphic.title,caption:graphic.note});
      }
      if(graphic.trees)for(let start=0;start<graphic.trees.length;start+=6){
        const trees=graphic.trees.slice(start,start+6);const height=Math.ceil(trees.length/3)*260+30;
        const parts=[`<svg xmlns="http://www.w3.org/2000/svg" width="820" height="${height}"><rect width="100%" height="100%" fill="#eff5e9"/>`];
        for(let i=0;i<trees.length;i++){
          const tree=trees[i];let source=cached.get(tree.image);
          if(!source){const response=await fetch(tree.image);if(!response.ok)throw Error('A tree illustration could not load. Reconnect and retry the full-colour export.');const blob=await response.blob();source=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);});cached.set(tree.image,source);}
          const x=24+i%3*264,y=15+Math.floor(i/3)*260;
          parts.push(`<image href="${source}" x="${x}" y="${y}" width="240" height="215"/><text x="${x+120}" y="${y+242}" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="#245738">${escape(tree.name)}</text>`);
        }
        images.push({image:await svgImage(parts.join('')+'</svg>'),title:graphic.title,caption:graphic.note});
      }
    }
    if(images.length)chapterImages[heading]=images;
  }
  return { charts, photos: attached, plants: plantImages, chapters:chapterImages };
}

/** The PDF reuses the screen's exact chart artwork and data, at print resolution.
 * The caller owns page numbering, branding and the full narrative that follows. */
export function drawVisualReportFront(doc: jsPDF, visuals: ReportVisuals, assets: VisualPdfAssets, date: string): void {
  const scale = doc.internal.pageSize.getWidth() / 600;
  const u = (v: number) => v * scale;
  let y = 46;
  const rect = (x: number, top: number, w: number, h: number, fill: string) => { doc.setFillColor(fill); doc.rect(u(x), u(top), u(w), u(h), 'F'); };
  const write = (value: string, x: number, top: number, width: number, size: number, colour = '#1b3024', bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(colour);
    const rows = doc.splitTextToSize(pdfSafe(value), u(width)) as string[];
    doc.text(rows, u(x), u(top));
    return rows.length * size * 1.3;
  };
  const page = (label: string) => { doc.addPage(); rect(0, 0, 600, 6, '#245738'); write('IMBEWUFIELD / SITE REPORT', 44, 35, 400, 9, '#526258'); y = 70; y += write(label, 44, y, 512, 23, '#245738', true) + 20; };
  const image = (photo: VisualImage, x: number, top: number, width: number, height: number) => {
    const data = doc.getImageProperties(photo.image);
    const fit = Math.min(width / data.width, height / data.height);
    const w = data.width * fit, h = data.height * fit;
    rect(x, top, width, height, '#f0f4f1');
    doc.addImage(photo.image, data.fileType, u(x + (width - w) / 2), u(top + (height - h) / 2), u(w), u(h), undefined, 'FAST');
  };
  doc.setFont('helvetica', 'bold'); doc.setFontSize(30);
  const titleRows = doc.splitTextToSize(pdfSafe(visuals.title), u(494)) as string[];
  const headingHeight = Math.max(215, 138 + titleRows.length * 37);
  rect(0, 0, 600, headingHeight, '#173f2d');
  write('IMBEWUFIELD / SITE REPORT', 44, 40, 350, 10, '#d6e7d9');
  write(date, 430, 40, 125, 9, '#d6e7d9');
  y = 95 + write(visuals.title, 44, 95, 494, 30, '#ffffff', true);
  write(visuals.subtitle, 44, y + 18, 494, 11, '#d6e7d9');
  y = headingHeight + 20;
  if (assets.photos[0]) { image(assets.photos[0], 44, y, 512, 310); y += 327; y += write(assets.photos[0].caption, 44, y, 512, 8, '#526258') + 18; }
  const columns = visuals.metrics.length > 2 ? 4 : 2;
  const cell = 526 / columns;
  const metricRows = Math.ceil(visuals.metrics.length / columns);
  if (y + metricRows * 100 > 750) page(visuals.overviewTitle ?? 'The site at a glance');
  visuals.metrics.forEach((metric, i) => {
    const x = 44 + (i % columns) * cell, top = y + Math.floor(i / columns) * 100;
    rect(x, top - 10, 3, 78, '#af6b24');
    write(metric.label, x + 10, top, cell - 24, 9, '#526258');
    write(metric.value, x + 10, top + 33, cell - 24, columns === 4 ? 19 : 23, '#1b3024', true);
    write(metric.note, x + 10, top + 53, cell - 24, 8, '#526258');
  });
  y += metricRows * 100 + 4;
  if (y + 55 > 765) page('Report basis');
  write(visuals.basis, 44, y, 512, 9, '#526258');

  if (visuals.charts.length) page('The site at a glance');
  for (const chart of visuals.charts) {
    const drawing = reportChartSvg(chart);
    const chartHeight = drawing.height / drawing.width * 476;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
    const titleHeight = doc.splitTextToSize(pdfSafe(chart.title), u(476)).length * 22;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    const noteHeight = doc.splitTextToSize(pdfSafe(chart.note), u(476)).length * 12;
    const height = 40 + titleHeight + chartHeight + noteHeight;
    if (y + height > 765) page(chart.kind === 'calendar' ? 'Planting through the year' : 'The site at a glance');
    doc.setDrawColor('#d6e1d8'); doc.roundedRect(u(44), u(y), u(512), u(height), u(6), u(6));
    write(chart.title, 62, y + 29, 476, 17, '#245738', true);
    const png = assets.charts[chart.id];
    if (!png) throw Error(`Missing chart artwork: ${chart.title}`);
    doc.addImage(png, 'PNG', u(62), u(y + 17 + titleHeight), u(476), u(chartHeight), undefined, 'FAST');
    write(chart.note, 62, y + 29 + titleHeight + chartHeight, 476, 9, '#526258');
    y += height + 20;
  }
  for (const photo of assets.photos.slice(1)) {
    page('The garden in view');
    image(photo, 44, y, 512, 500);
    write(photo.caption, 44, y + 521, 512, 10, '#526258');
  }
  for (let start = 0; start < (assets.plants?.length ?? 0); start += 6) {
    page('Your planned crops');
    write('Catalogue illustrations; the planting details come from your saved plan.', 44, y, 512, 10, '#526258');
    y += 25;
    assets.plants!.slice(start, start + 6).forEach((plant, i) => {
      const x = 44 + i % 2 * 264, top = y + Math.floor(i / 2) * 195;
      image(plant, x, top, 248, 130);
      write(plant.caption, x, top + 146, 248, 9, '#245738');
    });
  }
}

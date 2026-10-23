import { numberLabel } from '@/lib/format-figures';
import { trainingEvidenceSummary, trainingFeedbackSummary, type ProgrammeBranding, type VenuePhoto, type TrainingRecord } from './programme-evidence';
import { pdfSafe } from '@/lib/crop-export-pdf';

export type ReportSection = { title: string; lines: string[]; summaryLines?: string[]; references?: { label: string; url: string }[] };
export type ReportTable = { title: string; note: string; columns: string[]; rows: string[][]; includeInSummary?: boolean };
export type ReportMetric = { label: string; value: string; detail?: string };
export type ReportChart = { title: string; rows: { label: string; value: number; display?: string }[]; suffix?: string; minimumScale?:number; note?: string };
export type ProgrammePresentation = { metrics?: ReportMetric[]; chart?: ReportChart; session?: TrainingRecord; funder?: boolean; ink?: boolean; language?: 'en' | 'zu'; tables?: ReportTable[]; subtitle?: string; date?: string };
const pdfLabel = (en: string, language: 'en' | 'zu' | undefined) => language === 'zu' ? ({
  'Full report':'Umbiko ogcwele', 'Brief summary':'Isifinyezo esifushane', 'Tour workspace':'Indawo yokuhlola',
  'Attendance':'Ukuba khona', 'No register yet':'Alukho uhlu okwamanje', 'Signed register':'Uhlu olusayiniwe',
  'Attendance signatures':'Amasiginesha okuba khona', 'Feedback':'Impendulo', 'Responses / attendees':'Izimpendulo / abebehambele',
  'Photographs':'Izithombe', 'Session evidence':'Ubufakazi beseshini', 'Implemented by':'Kwenziwe ngu',
  'Community / project':'Umphakathi / iphrojekthi', 'Supported by':'Kwesekwe ngu', 'Facilitator':'Umqeqeshi',
  'Training feedback':'Impendulo ngokuqeqeshwa',
  'Venue map / directions':'Imephu yendawo / izikhombisi-ndlela', 'Up to five items per section. The full report includes every record.':'Kufika ezintweni ezinhlanu esigabeni ngasinye. Umbiko ogcwele uhlanganisa wonke amarekhodi.',
  'Attendance register':'Uhlu lokuba khona', 'Name':'Igama', 'ID / reference':'I-ID / inkomba',
  'Nothing recorded yet.':'Akukho okuqoshiwe okwamanje.',
  'Signature':'Isiginesha', 'Certificate':'Isitifiketi', 'Present':'Ukhona', 'Absent':'Akekho', 'Not signed':'Akusayinwanga',
  'No feedback recorded yet.':'Akukho mpendulo eqoshiwe okwamanje.',
  'Detailed findings are withheld for this small group.':'Imininingwane ayiboniswa ngoba leli qembu lincane.',
  'Results withheld for this small group.':'Imiphumela ayiboniswa ngoba leli qembu lincane.',
  'answered':'baphendulile', 'skipped':'beqile', 'First action':'Isenzo sokuqala', 'Suggested improvement':'Isiphakamiso sokuthuthukisa',
  'Programme report':'Umbiko wohlelo', 'Internal session record':'Irekhodi leseshini yangaphakathi',
} as Record<string,string>)[en] ?? en.replace(/^(\d+)% present$/, '$1% bakhona') : en;
export function programmeReportMetrics(p: ProgrammePresentation): ReportMetric[] {
  if(!p.session)return p.metrics??[];
  const s=p.session,e=trainingEvidenceSummary(s),f=trainingFeedbackSummary(s,p.funder);
  return [{label:'Attendance',value:`${s.presentCount} / ${s.registeredCount}`,detail:e.attendanceRate===null?'No register yet':`${e.attendanceRate}% present`},
    ...(p.funder?[]:[{label:'Signed register',value:String(e.signed),detail:'Attendance signatures'}]),
    {label:'Feedback',value:`${f.completed} / ${f.assigned}`,detail:'Responses / attendees'},
    {label:'Photographs',value:String(s.photoCount),detail:'Session evidence'}];
}

export async function buildProgrammePdf(title: string, sample: boolean, sections: ReportSection[], format: 'summary' | 'full', branding?: ProgrammeBranding, photos: VenuePhoto[] = [], photoHeading = 'Training evidence', visual?: { visuals: import('./report-visuals').ReportVisuals; assets: import('./report-visual-pdf').VisualPdfAssets; date: string }, presentation: ProgrammePresentation = {}) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ compress: true });
  doc.setProperties({title,author:'ImbewuField',subject:presentation.subtitle ?? 'Programme evidence'});
  const ink=presentation.ink===true;
  let y=20;
  const page=()=>{doc.addPage();y=23;};
  const ensure=(height:number)=>{if(y+height>273)page();};
  const write=(text:string,size=10.5,bold=false,width=174,x=18)=>{
    doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(31,51,39);
    const rows=doc.splitTextToSize(pdfSafe(text),width) as string[];
    for(const row of rows){ensure(size*.4+1);const link = text.match(/https?:\/\/[^\s]+/)?.[0]; if(link)doc.textWithLink(row,x,y,{url:link});else doc.text(row,x,y);y+=size*.4+1;}
    y+=3;
  };
  if (visual) {
    const { drawVisualReportFront } = await import('./report-visual-pdf');
    drawVisualReportFront(doc, visual.visuals, visual.assets, visual.date, presentation.language);page();
  }
  if(!ink){doc.setFillColor(23,62,44);doc.rect(0,0,210,presentation.language==='zu'?58:49,'F');doc.setTextColor(255);}
  else {doc.setDrawColor(35,75,49);doc.setLineWidth(.6);doc.line(18,46,192,46);doc.setTextColor(23,62,44);}
  doc.setFont('times','normal');doc.setFontSize(24);
  const titleRows=doc.splitTextToSize(pdfSafe(presentation.session?.title??title),174) as string[];
  doc.text(titleRows.slice(0,2),18,22);
  doc.setFont('helvetica','normal');doc.setFontSize(9);
  doc.text(pdfSafe(`${sample?`${pdfLabel('Tour workspace',presentation.language)} · `:''}${pdfLabel(format==='full'?'Full report':'Brief summary',presentation.language)} · ${presentation.date ?? new Date().toISOString().slice(0,10)}`),18,38);
  if(presentation.language==='zu'){
    doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(ink?75:245,ink?95:245,ink?80:245);
    doc.text(pdfSafe('Izihloko zesiZulu azikabuyekezwa; umbhalo wobufakazi ugcinwa ngolimi oqoshwe ngalo.'),18,51);
  }
  y=presentation.language==='zu'?67:59;
  if(sample) write('DEMONSTRATION RECORDS - illustrative figures, not real programme results.',9,true);
  if(presentation.subtitle) write(presentation.subtitle,10);
  const partners=branding?(['organisation','garden','funder'] as const).filter(k=>branding[k].label||branding[k].image):[];
  if(branding&&partners.length){
    let height=18;
    partners.forEach((key,index)=>{
      const p=branding[key],x=18+index*60;
      if(p.image){const a=doc.getImageProperties(p.image);const scale=Math.min(13/a.width,15/a.height);doc.addImage(p.image,a.fileType,x,y,a.width*scale,a.height*scale);}
      const labelX=x+(p.image?16:0),width=p.image?40:55;
      doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(60,82,67);
      doc.text(pdfSafe(pdfLabel(key==='organisation'?'Implemented by':key==='garden'?'Community / project':'Supported by',presentation.language).toLocaleUpperCase(presentation.language==='zu'?'zu-ZA':'en-ZA')),labelX,y+3);
      doc.setFont('helvetica','bold');doc.setFontSize(9);const names=doc.splitTextToSize(pdfSafe(p.label),width) as string[];doc.text(names,labelX,y+9);height=Math.max(height,names.length*4+12);
    });y+=height+8;
  }
  const metrics=programmeReportMetrics(presentation);
  if(metrics.length){
    const width=174/Math.min(metrics.length,4);
    for(let start=0;start<metrics.length;start+=4){
      const batch=metrics.slice(start,start+4);
      doc.setFont('helvetica','normal');doc.setFontSize(8);
      const labels=batch.map(m=>doc.splitTextToSize(pdfSafe(pdfLabel(m.label,presentation.language)),width-8) as string[]);
      doc.setFontSize(7);
      const details=batch.map(m=>m.detail?doc.splitTextToSize(pdfSafe(pdfLabel(m.detail,presentation.language)),width-8) as string[]:[]);
      const labelHeight=Math.max(...labels.map(l=>l.length))*3;
      const detailHeight=Math.max(...details.map(l=>l.length),0)*3;
      const height=Math.max(29, labelHeight+detailHeight+20);
      ensure(height+5);
      for(let i=0;i<batch.length;i++){
        const x=18+i*width,m=batch[i];
        if(!ink){doc.setFillColor(237,245,238);doc.roundedRect(x,y,width-3,height,2,2,'F');}
        doc.setTextColor(35,66,45);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(labels[i],x+3,y+6);
        doc.setFont('helvetica','bold');doc.setFontSize(18);
        const metricText=pdfSafe(m.value),size=Math.min(18,18*(width-9)/Math.max(1,doc.getTextWidth(metricText)));
        doc.setFontSize(size);doc.text(metricText,x+3,y+labelHeight+13);
        if(details[i].length){doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text(details[i],x+3,y+labelHeight+20);}
      }
      y+=height+8;
    }
  }
  if(presentation.session){
    const s=presentation.session;
    write(`${s.date} | ${s.project}`,10.5,true);
    write(`${s.venue}${s.facilitator?` | ${pdfLabel('Facilitator',presentation.language)}: ${s.facilitator}`:''}`,10);
    if(!presentation.funder&&s.latitude!==null&&s.longitude!==null){
      ensure(12);doc.setFontSize(9);doc.setTextColor(34,88,57);
      doc.textWithLink(`${presentation.language==='zu'?'Imephu yendawo / izikhombisi-ndlela':'Venue map / directions'}: ${s.latitude.toFixed(5)}, ${s.longitude.toFixed(5)}`,18,y,{url:`https://www.google.com/maps/search/?api=1&query=${s.latitude},${s.longitude}`});y+=12;
    }
  }
  if(presentation.chart && (format==='full' || !presentation.tables?.length)){
    ensure(25);write(presentation.chart.title,14,true);if(presentation.chart.note)write(presentation.chart.note,9);
    const chart=presentation.chart,max=Math.max(chart.minimumScale??1,...chart.rows.map(r=>r.value));
    for(const r of format==='summary'?chart.rows.slice(0,5):chart.rows){
      doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(31,51,39);
      const names=doc.splitTextToSize(pdfSafe(r.label),52) as string[];const h=Math.max(12,names.length*4+3);ensure(h);doc.text(names,18,y);
      doc.setFillColor(229,238,232);doc.rect(73,y-3,83,4,'F');doc.setFillColor(46,107,72);doc.rect(73,y-3,83*Math.max(0,r.value)/max,4,'F');
      doc.text(pdfSafe(r.display??`${numberLabel(r.value)}${chart.suffix??''}`),192,y,{align:'right'});y+=h;
    }y+=6;
  }
  if(format==='summary')write(presentation.tables?.length ? 'Brief summary: key findings and core evidence tables. Charts and detailed breakdowns are in the full report.' : pdfLabel('Up to five items per section. The full report includes every record.',presentation.language),9);
  const drawTables = () => {
  // Repeat column headings after page breaks: a number carried onto a new page must keep its unit.
  for (const table of (presentation.tables ?? []).filter(t=>format==='full'||t.includeInSummary!==false)) {
    ensure(50); write(table.title,15,true); write(table.note,9);
    const widths = table.columns.length === 3 ? [65,40,69] : [55,38,32,49];
    const offsets = widths.map((_, i) => 18 + widths.slice(0,i).reduce((a,b)=>a+b,0));
    const heading = () => {
      doc.setFont('helvetica','bold'); doc.setFontSize(8);
      const labels = table.columns.map((c,i)=>doc.splitTextToSize(pdfSafe(c),widths[i]-5) as string[]);
      const h = Math.max(...labels.map(l=>l.length))*3.5+6;
      ensure(h+12); doc.setFillColor(ink?246:236,ink?246:241,ink?246:237); doc.rect(18,y-4,174,h,'F');
      doc.setTextColor(31,51,39); labels.forEach((l,i)=>doc.text(l,offsets[i]+2,y)); y+=h;
    };
    heading();
    const rows = format === 'summary' ? table.rows.slice(0,5) : table.rows;
    if (!rows.length) write('No records available for this selection.',9);
    for (const row of rows) {
      doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
      const cells = table.columns.map((_,i)=>doc.splitTextToSize(pdfSafe(row[i]??''),widths[i]-5) as string[]);
      // Long names and notes can exceed a page; carry their remaining lines rather than clipping.
      while(cells.some(c=>c.length)) {
        if(y+15>273) { page(); heading(); }
        const capacity = Math.max(1,Math.floor((273-y-6)/4));
        const count = Math.min(capacity,Math.max(...cells.map(c=>c.length)));
        const h = count*4+6;
        doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(31,51,39);
        cells.forEach((cell,i)=>{const part=cell.splice(0,count);if(part.length)doc.text(part,offsets[i]+2,y);});
        y+=h; doc.setDrawColor(207,220,211); doc.setLineWidth(.2); doc.line(18,y-4,192,y-4);
        if(cells.some(c=>c.length)) { page(); heading(); }
      }
    }
    if(format==='summary' && table.rows.length>rows.length) write(`${table.rows.length-rows.length} further rows in the full report.`,9);
    y+=10;
  }
  };
  let chapter=0;
  for(const [sectionIndex,section] of sections.entries()){
    if(presentation.session&&['Attendance register','Attendance summary'].includes(section.title))continue;
    ensure(24);doc.setDrawColor(69,117,82);doc.setLineWidth(.5);doc.line(18,y-3,192,y-3);y+=4;
    write(`${String(++chapter).padStart(2,'0')}  ${section.title}`,14,true);
    const lines=format==='summary'?(section.summaryLines??section.lines.slice(0,5)):section.lines;
    (lines.length?lines:[pdfLabel('Nothing recorded yet.',presentation.language)]).forEach(text=>write(text));
    for(const reference of section.references ?? []) {
      doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(35,75,49);
      const labels=doc.splitTextToSize(pdfSafe(reference.label+' (source)'),174) as string[];
      for(const label of labels){ensure(6);doc.textWithLink(label,18,y,{url:reference.url});y+=4.5;}y+=3;
    }
    y+=4;
    if(sectionIndex===1)drawTables();
  }
  if(sections.length<2)drawTables();
  const session=presentation.session;
  if(session&&!presentation.funder){
    const registerRows=format==='summary'?session.attendance.slice(0,5):session.attendance;
    ensure(Math.min(245,25+registerRows.slice(0,6).reduce((h,a)=>h+(a.signature?25:15),0)));write(pdfLabel('Attendance register',presentation.language),15,true);
    const widths=[43,32,21,43,35],xs=[18,61,93,114,157];
    const tableHead=()=>{doc.setFillColor(235,243,237);doc.rect(18,y-4,174,9,'F');doc.setFont('helvetica','bold');doc.setFontSize(7);['Name','ID / reference','Attendance','Signature','Certificate'].forEach((v,i)=>doc.text(pdfSafe(pdfLabel(v,presentation.language)),xs[i]+2,y+1));y+=10;};tableHead();
    for(const a of format==='summary'?session.attendance.slice(0,5):session.attendance){
      doc.setFont('helvetica','normal');doc.setFontSize(8);
      const values=[a.name,a.reference||'—',pdfLabel(a.present?'Present':'Absent',presentation.language),a.signature?'':a.present?pdfLabel('Not signed',presentation.language):'—',a.certificate||'—'];
      const lines=values.map((v,i)=>doc.splitTextToSize(pdfSafe(v),widths[i]-4) as string[]);
      const height=Math.max(a.signature?25:13,...lines.map(l=>l.length*3.6+7));
      if(y+height>273){page();tableHead();}
      doc.setFont('helvetica','normal');doc.setFontSize(8);
      doc.setTextColor(31,51,39);lines.forEach((l,i)=>doc.text(l,xs[i]+2,y+1));
      if(a.signature){doc.setDrawColor(24,52,39);doc.setLineWidth(.35);for(const stroke of a.signature.strokes)for(let i=1;i<stroke.length;i++)doc.line(116+stroke[i-1][0]/1000*37,y+stroke[i-1][1]/1000*15,116+stroke[i][0]/1000*37,y+stroke[i][1]/1000*15);doc.setFontSize(7);doc.text(a.signature.signedAt.slice(0,10),116,y+20);}
      y+=height;doc.setDrawColor(207,220,211);doc.setLineWidth(.2);doc.line(18,y-4,192,y-4);
    }y+=8;
  }
  if(session){
    const feedback=trainingFeedbackSummary(session,presentation.funder);
    ensure(30);write(pdfLabel('Training feedback',presentation.language),15,true);write(presentation.language==='zu'?`${feedback.completed} izimpendulo kubantu abangu-${feedback.assigned} abebehambele.`:`${feedback.completed} responses from ${feedback.assigned} attendees.`,10);
    if(!feedback.completed)write(pdfLabel('No feedback recorded yet.',presentation.language));
    if(feedback.completed&&feedback.metrics.length&&feedback.metrics.every(m=>m.suppressed))write(pdfLabel('Detailed findings are withheld for this small group.',presentation.language),10);
    for(const m of feedback.metrics.every(m=>m.suppressed)?[]:feedback.metrics){if(!feedback.completed)break;ensure(22);write(presentation.language==='zu'?m.zu:m.en,11,true);if(m.suppressed){write(pdfLabel('Results withheld for this small group.',presentation.language),9);continue;}write(`${m.n} ${presentation.language==='zu'?'baphendulile':'answered'} · ${m.missing} ${presentation.language==='zu'?'beqile':'skipped'}`,9);for(const c of m.choices??[])if(c.count)write(`${presentation.language==='zu'?c.zu:c.en}: ${c.count}`,10);}
    if(!presentation.funder)for(const response of session.feedback??[])for(const [key,value] of Object.entries(response.answers))if(['course_change','course_apply'].includes(key)&&value.trim())write(`${pdfLabel(key==='course_apply'?'First action':'Suggested improvement',presentation.language)}: ${value}`);
  }
  if(photos.length&&!visual){
    page();write(photoHeading,16,true);
    if(photos.length<=2){
      for(const photo of photos){
        doc.setFont('helvetica','normal');doc.setFontSize(9);
        const caption=doc.splitTextToSize(pdfSafe(photo.caption),174) as string[];
        const a=doc.getImageProperties(photo.image),ratio=Math.min(174/a.width,100/a.height),width=a.width*ratio,height=a.height*ratio;
        ensure(height+caption.length*4+12);
        doc.addImage(photo.image,a.fileType,18+(174-width)/2,y,width,height);
        doc.setTextColor(31,51,39);doc.text(caption,18,y+height+6);y+=height+caption.length*4+12;
      }
    }else{
    for(let i=0;i<photos.length;){
      const pair=photos.slice(i,i+2);ensure(105);
      let rowHeight=0;
      pair.forEach((photo,j)=>{const x=18+j*90,a=doc.getImageProperties(photo.image),ratio=Math.min(84/a.width,68/a.height);doc.addImage(photo.image,a.fileType,x,y,a.width*ratio,a.height*ratio);doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(31,51,39);const caption=doc.splitTextToSize(pdfSafe(photo.caption),84) as string[];doc.text(caption,x,y+73);rowHeight=Math.max(rowHeight,78+caption.length*4);});
      y+=rowHeight+10;i+=pair.length;
    }
    }
  }
  const pages=doc.getNumberOfPages();
  for(let p=1;p<=pages;p++){doc.setPage(p);doc.setDrawColor(207,220,211);doc.line(18,281,192,281);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(64,86,72);doc.text(presentation.language==='zu'?`ImbewuField · ${pdfLabel(presentation.session&&!presentation.funder?'Internal session record':'Programme report',presentation.language)}`:'ImbewuField',18,288);doc.text(`${p} / ${pages}`,192,288,{align:'right'});}
  return doc;
}

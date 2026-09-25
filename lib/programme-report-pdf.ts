import { numberLabel } from '@/lib/format-figures';
import { trainingEvidenceSummary, trainingFeedbackSummary, type ProgrammeBranding, type VenuePhoto, type TrainingRecord } from './programme-evidence';
import { pdfSafe } from '@/lib/crop-export-pdf';

export type ReportSection = { title: string; lines: string[] };
export type ReportMetric = { label: string; value: string; detail?: string };
export type ReportChart = { title: string; rows: { label: string; value: number; display?: string }[]; suffix?: string; minimumScale?:number };
export type ProgrammePresentation = { metrics?: ReportMetric[]; chart?: ReportChart; session?: TrainingRecord; funder?: boolean; ink?: boolean; language?: 'en' | 'zu' };
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
  const ink=presentation.ink===true;
  let y=20;
  const page=()=>{doc.addPage();y=23;};
  const ensure=(height:number)=>{if(y+height>273)page();};
  const write=(text:string,size=10.5,bold=false,width=174,x=18)=>{
    doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(31,51,39);
    const rows=doc.splitTextToSize(pdfSafe(text),width) as string[];
    for(const row of rows){ensure(size*.4+1);doc.text(row,x,y);y+=size*.4+1;}
    y+=3;
  };
  if (visual) {
    const { drawVisualReportFront } = await import('./report-visual-pdf');
    drawVisualReportFront(doc, visual.visuals, visual.assets, visual.date, presentation.language);page();
  }
  if(!ink){doc.setFillColor(23,62,44);doc.rect(0,0,210,presentation.language==='zu'?58:49,'F');doc.setTextColor(255);}
  else {doc.setDrawColor(35,75,49);doc.setLineWidth(.6);doc.line(18,46,192,46);doc.setTextColor(23,62,44);}
  doc.setFont('helvetica','bold');doc.setFontSize(22);
  const titleRows=doc.splitTextToSize(pdfSafe(presentation.session?.title??title),174) as string[];
  doc.text(titleRows.slice(0,2),18,22);
  doc.setFont('helvetica','normal');doc.setFontSize(9);
  doc.text(pdfSafe(`${sample?`${pdfLabel('Tour workspace',presentation.language)} · `:''}${pdfLabel(format==='full'?'Full report':'Brief summary',presentation.language)} · ${new Date().toISOString().slice(0,10)}`),18,38);
  if(presentation.language==='zu'){
    doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(ink?75:245,ink?95:245,ink?80:245);
    doc.text(pdfSafe('Izihloko zesiZulu azikabuyekezwa; umbhalo wobufakazi ugcinwa ngolimi oqoshwe ngalo.'),18,51);
  }
  y=presentation.language==='zu'?67:59;
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
    for(let i=0;i<metrics.length;i++){
      if(i&&i%4===0)y+=31;
      ensure(31);const x=18+(i%4)*width,m=metrics[i];
      if(!ink){doc.setFillColor(237,245,238);doc.roundedRect(x,y,width-3,28,2,2,'F');}
      doc.setTextColor(35,66,45);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(pdfSafe(pdfLabel(m.label,presentation.language)),x+3,y+6);
      doc.setFont('helvetica','bold');doc.setFontSize(m.value.length>14?13:18);doc.text(pdfSafe(m.value),x+3,y+16);
      if(m.detail){doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text(doc.splitTextToSize(pdfSafe(pdfLabel(m.detail,presentation.language)),width-8),x+3,y+22);}
    }y+=38;
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
  if(presentation.chart){
    ensure(25);write(presentation.chart.title,14,true);
    const chart=presentation.chart,max=Math.max(chart.minimumScale??1,...chart.rows.map(r=>r.value));
    for(const r of format==='summary'?chart.rows.slice(0,5):chart.rows){
      doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(31,51,39);
      const names=doc.splitTextToSize(pdfSafe(r.label),52) as string[];const h=Math.max(12,names.length*4+3);ensure(h);doc.text(names,18,y);
      doc.setFillColor(229,238,232);doc.rect(73,y-3,83,4,'F');doc.setFillColor(46,107,72);doc.rect(73,y-3,83*Math.max(0,r.value)/max,4,'F');
      doc.text(pdfSafe(r.display??`${numberLabel(r.value)}${chart.suffix??''}`),192,y,{align:'right'});y+=h;
    }y+=6;
  }
  if(format==='summary')write(pdfLabel('Up to five items per section. The full report includes every record.',presentation.language),9);
  let chapter=0;
  for(const section of sections){
    if(presentation.session&&['Attendance register','Attendance summary'].includes(section.title))continue;
    ensure(24);doc.setDrawColor(69,117,82);doc.setLineWidth(.5);doc.line(18,y-3,192,y-3);y+=4;
    write(`${String(++chapter).padStart(2,'0')}  ${section.title}`,14,true);
    const lines=format==='summary'?section.lines.slice(0,5):section.lines;
    (lines.length?lines:[pdfLabel('Nothing recorded yet.',presentation.language)]).forEach(text=>write(text));y+=4;
  }
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

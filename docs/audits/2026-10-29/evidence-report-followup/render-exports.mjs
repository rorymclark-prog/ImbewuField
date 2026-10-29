import fs from 'node:fs';
import { buildTrainingReport } from '../../../../lib/training-report.ts';
import { freshEvidenceData, aggregateProgrammeBranding } from '../../../../lib/programme-evidence.ts';
import { buildProgrammePdf } from '../../../../lib/programme-report-pdf.ts';
import { collectReportSiteFacts } from '../../../../lib/report-site-facts-collect.ts';
import { designSiteIdFromLocation } from '../../../../lib/design-studio.ts';
import { DEMO_LOCATION } from '../../../../lib/demo-site.ts';
import { sampleFullSiteReport } from '../../../../lib/report-summary.ts';
import { buildReportHeaderMarkdown } from '../../../../lib/report-site-facts.ts';
import { buildReportPdf } from '../../../../lib/report-pdf.ts';
const values = new Map();
const storage = { getItem:key=>values.get(key)??null, setItem:(key,value)=>values.set(key,value), removeItem:key=>values.delete(key) };
Object.assign(globalThis,{window:globalThis,localStorage:storage,sessionStorage:storage});
const data = freshEvidenceData();
const report = buildTrainingReport(data.sessions, {today:'2026-10-29'});
const out=process.argv[2] ?? '/tmp/imbewu-followup-pdfs';
fs.mkdirSync(out,{recursive:true});
const metadata=[];
for(const language of ['en','zu'])for(const format of ['summary','full']){
 const pdf=await buildProgrammePdf(report.title,true,report.sections,format,aggregateProgrammeBranding(data.branding),[], 'Training evidence',undefined,{metrics:report.metrics,tables:report.tables,subtitle:report.scope,date:'2026-10-29',language});
 const path=`${out}/training-${language}-${format}.pdf`;
 fs.writeFileSync(path,Buffer.from(pdf.output('arraybuffer')));
 metadata.push({path,pages:pdf.getNumberOfPages(),sessions:report.sessions.length});
}
const session=data.sessions[0];
const sessionPhotos=session.photos.map(photo=>photo.image.startsWith('/demo/')?{...photo,image:'data:image/jpeg;base64,'+fs.readFileSync(new URL('../../../../public'+photo.image,import.meta.url)).toString('base64')}:photo);
for(const language of ['en','zu'])for(const format of ['summary','full']){
 const sections=[{title:'Session delivery',lines:[session.report]},{title:'Assessment & follow-up',lines:[session.assessmentId?`Linked assessment: ${data.assessments.find(a=>a.id===session.assessmentId)?.title??'Course assessment'}`:'Feedback is recorded with this session.',session.nextSteps||'No follow-up recorded.']}];
 const pdf=await buildProgrammePdf('Training session report',true,sections,format,data.branding,sessionPhotos,'Training evidence',undefined,{session,funder:false,date:'2026-10-29',language});
 const path=`${out}/session-${language}-${format}.pdf`;
 fs.writeFileSync(path,Buffer.from(pdf.output('arraybuffer')));metadata.push({path,pages:pdf.getNumberOfPages()});
}
const d=DEMO_LOCATION;
const facts=collectReportSiteFacts({siteId:designSiteIdFromLocation(d),canvas:null,lat:d.lat,lon:d.lon,location:d,cropPlan:null,waterPoints:[{id:'qa-water',name:'Recorded water point',category:'Dam',lat:d.lat,lon:d.lon,createdAt:'2026-10-29T08:00:00Z'}]});
const headerInput={facts,biomeName:d.biome.name,lat:d.lat,lon:d.lon,dateLabel:'2026-10-29',rainfallMm:d.rainfall.annual,rainfallSource:d.rainfall.rainfallSource,wetSeason:d.rainfall.wetSeason,drySeason:d.rainfall.drySeason,soilPh:d.soil.ph,soilOrganicCarbon:d.soil.organicCarbon,soilTexture:d.soil.textureClass,soilSource:d.soil.soilSource,elevationM:d.elevation.elevation,slopeDeg:d.elevation.slopeDeg,aspectLabel:d.elevation.aspectLabel,hasMapWaterPolygons:false};
for(const language of ['en','zu']){
 const header=buildReportHeaderMarkdown(headerInput,language);
 const markdown=header+'\n\n'+sampleFullSiteReport(facts,DEMO_LOCATION,language);
 const blob=await buildReportPdf(markdown,{biome:DEMO_LOCATION.biome.name,lat:d.lat,lon:d.lon,rainfallMm:DEMO_LOCATION.rainfall.annual,meanTempC:d.climate.meanTemp,dateLabel:'2026-10-29',language,siteName:'Tour export QA'});
 const path=`${out}/site-${language}.pdf`;
 fs.writeFileSync(path,Buffer.from(await blob.arrayBuffer()));
 metadata.push({path});
}
fs.writeFileSync(out+'/manifest.json',JSON.stringify(metadata,null,2));
console.log(JSON.stringify(metadata));

#!/usr/bin/env node
// Reuse reviewed artwork while keeping unreviewed isiZulu text out of live registration.
import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{resolve}from'node:path';import{createRequire}from'node:module';
import{COURSE_NARRATION}from'../lib/course-audio.ts';
const sharp=createRequire(import.meta.url)('sharp');
const rows=JSON.parse(readFileSync('docs/course-production/illustrated-fronts.json','utf8'));
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const wrap=(text,max)=>{const lines=[];let line='';for(const word of text.split(/\s+/)){if(line&&(line+' '+word).length>max){lines.push(line);line=word}else line+=(line?' ':'')+word}if(line)lines.push(line);return lines};
const overrides={
 'course-art/market-community/cost-example.svg':[['Worked example','Isibonelo'],['Full cost per kilogram','Izindleko zonke ngekhilogremu'],['Selling price per kilogram','Inani lokuthengisa ngekhilogremu'],['R3 shortfall per kilogram','Kushoda u-R3 ngekhilogremu'],['Example figures — use your actual costs and prices','Sebenzisa izindleko namanani akho']],
 'course-art/vegetables-staples/sowing-record.svg':[['Sow again','Hlwanyela futhi'],['Sow','Hlwanyela'],['Record the date','Bhala usuku'],['Observe','Bheka'],['Check germination','Hlola ukumila'],['Use crop and season','Landela isitshalo nesizini'],['Harvest','Vuna'],['Record actual dates','Bhala izinsuku zangempela'],['Adjust the interval from your own harvest record','Lungisa isikhawu nge-rekhodi lesivuno sakho']]
};
const all=[...rows];for(const module of new Set(rows.map(r=>r.module)))all.push({...rows.find(r=>r.module===module),slide:1});
const report=[];
for(const row of all){
 const source=readFileSync(`docs/narration/${row.module}.zu.md`,'utf8');
 const found=source.match(new RegExp(`\\*\\*Ikhasi ${row.slide} — ([^\\n]+)\\*\\*\\n\\n([\\s\\S]*?)(?=\\n\\n---|\\n\\n## Notes|$)`));if(!found)throw Error(`Missing isiZulu ${row.module}/${row.slide}`);
 const title=found[1].replace(/\s*\(Slide \d+ —.*\)$/,'').trim();
 const choices=found[2].replaceAll('[pause]','').split(/(?<=[.!?])\s+|\n\n/).map(s=>s.trim()).filter(s=>s.length>=20&&s.length<=190);
 const preferred=({
  'small-livestock/16':'Vikela imfuyo ngokuyibheka njalo nangohlelo lwezilwane lokuphatha izimuncagazi olufanele izilwane nendawo.',
  'plant-guilds/7':'Ngemva kokusika, ukubola kuthatha isikhathi.',
  'plant-guilds/12':'Izitshalo eziqhakazayo njenge-African basil, i-borage ne-marigold zingasekela izinambuzane eziwusizo.'
 })[`${row.module}/${row.slide}`]??null;
 const caption=preferred??choices[0]??found[2].split(/[,;:] /).find(s=>s.length>=20&&s.length<=190)?.trim();
 if(!caption||!found[2].includes(caption))throw Error(`Caption needs editing: ${row.module}/${row.slide}`);
 let titleSize=44,titleLines=wrap(title,53);if(titleLines.length>2){titleSize=35;titleLines=wrap(title,67)}
 let captionSize=27,captionLines=wrap(caption,83);if(captionLines.length>2){captionSize=23;captionLines=wrap(caption,99)}
 if(titleLines.length>2||captionLines.length>2)throw Error(`Needs fitting: ${row.module}/${row.slide}`);
 let raw=readFileSync(resolve('public',row.art));
 if(overrides[row.art]){let svg=raw.toString();for(const[a,b]of overrides[row.art])svg=svg.replaceAll(a,b);svg=svg.replaceAll('font-size="36"','font-size="26"').replaceAll('font-size="23"','font-size="18"').replaceAll('font-size="38"','font-size="30"');raw=Buffer.from(svg)}
 const art=await sharp(raw).resize(1120,630,{fit:'contain',background:'#F7F2E9'}).toBuffer();
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#F7F2E9"/><text x="70" y="38" font-family="DejaVu Sans" font-size="18" fill="#8A4B2A">IMBEWUFIELD · isiZulu · DRAFT</text><text x="1530" y="38" text-anchor="end" font-family="DejaVu Sans" font-size="18" fill="#8A4B2A">${row.slide} / ${COURSE_NARRATION[row.module].tracks.length}</text>${titleLines.map((s,i)=>`<text x="70" y="${92+i*54}" font-family="DejaVu Serif" font-weight="bold" font-size="${titleSize}" fill="#1F4D2B">${esc(s)}</text>`).join('')}<rect x="239" y="169" width="1122" height="632" fill="none" stroke="#B07A1E" stroke-width="2"/>${captionLines.map((s,i)=>`<text x="800" y="${838+i*32}" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="${captionSize}" fill="#1F4D2B">${esc(s)}</text>`).join('')}</svg>`;
 const dir=`docs/course-production/isiZulu-drafts/${row.module}`;mkdirSync(dir,{recursive:true});await sharp(Buffer.from(svg)).composite([{input:art,left:240,top:170}]).jpeg({quality:82,mozjpeg:true}).toFile(`${dir}/slide-${String(row.slide).padStart(2,'0')}-front.jpg`);
 report.push({module:row.module,slide:row.slide,title,caption,art:row.art,status:'Unreviewed isiZulu text; first-language farmer review required'});
}
writeFileSync('docs/course-production/isiZulu-illustrated-fronts.json',JSON.stringify(report,null,2)+'\n');console.log(`Rendered ${report.length} isiZulu draft fronts, including covers.`);

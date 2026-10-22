import { programmeReportText, isProgrammeDraftLanguage } from './programme-report-copy';

/** Display-only schematic geometry. Never used as measured area or written to Design Studio. */
export function sampleGardenSvg(kind: string, variant: string, language = 'en'): string {
  const number = Number(variant.match(/^g(\d+)$/)?.[1]);
  const seed = Number.isFinite(number) ? number : [...variant].reduce((n,c)=>Math.imul(n,31)+c.charCodeAt(0),7) >>> 0;
  const shift = seed % 19;
  const forest = /forest/i.test(kind), commercial = /commercial/i.test(kind), school = /school/i.test(kind), creche = /crèche/i.test(kind), home = /homestead/i.test(kind);
  const parts: string[] = [];
  const native = isProgrammeDraftLanguage(language);
  const escape = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
  const label = (x:number,y:number,text:string,size=22,width=220) => {
    if (!native) return `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" fill="#284b36" font-family="Arial,sans-serif">${text}</text>`;
    const translated = programmeReportText(text,language);
    const lines:string[]=[];
    // Counting every letter as wide split "Inqolobane" before its final letter.
    // Estimate proportional Arial words, then keep each word intact on its line.
    const widthOf = (value:string) => [...value.normalize('NFD').replace(/\p{M}/gu,'')].reduce((sum,c)=>sum+(/[ilI.,' ]/.test(c)?.28:/[ft]/.test(c)?.32:c==='r'?.34:/[mwMW]/.test(c)?.85:/[A-Z]/.test(c)?.67:.56),0)*size;
    for (const word of translated.split(' ')) {
      const last=lines.at(-1),next=last?`${last} ${word}`:word;
      if(last && widthOf(next)<=width) lines[lines.length-1]=next;
      else lines.push(word);
    }
    return `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" fill="#284b36" font-family="Arial,sans-serif" stroke="#faf7ef" stroke-width="3" paint-order="stroke" stroke-linejoin="round">${lines.map((line,i)=>`<tspan x="${x}" y="${y+(i-(lines.length-1)/2)*(size+2)}">${escape(line)}</tspan>`).join('')}</text>`;
  };
  const paired = (x:number,y:number,first:string,second:string,phrase:string,width:number,gap=26) => native ? label(x,y+gap/2,phrase,22,width) : label(x,y,first)+label(x,y+gap,second);
  const rect = (x:number,y:number,w:number,h:number,fill:string,stroke='#8b9877') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  const building = (x:number,y:number,w:number,h:number,text:string) => { parts.push(rect(x,y,w,h,'#ddcead','#9b8766'), `<path d="M${x-4} ${y+12}L${x+w/2} ${y-16}L${x+w+4} ${y+12}" fill="#738887"/>`,label(x+w/2,y+h/2+18,text,22,w-10)); };
  const tree = (x:number,y:number) => parts.push(`<g><circle cx="${x}" cy="${y}" r="24" fill="#608a4d"/><circle cx="${x-8}" cy="${y-7}" r="17" fill="#91b76a"/><circle cx="${x+9}" cy="${y+6}" r="13" fill="#47733c"/></g>`);
  const beds = (x:number,y:number,cols:number,rows:number) => { for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){parts.push(rect(x+c*51,y+r*36,41,24,'#a8bd7d','#876b48'));for(let n=0;n<3;n++)parts.push(`<path d="M${x+c*51+8+n*11} ${y+r*36+5}v14" stroke="#547746" stroke-width="4"/>`);} parts.push(label(x+(cols*51-10)/2,y+rows*36+23,'Vegetables',22,cols*51+20)); };
  const staple = (x:number,y:number,w:number,h:number) => { parts.push(rect(x,y,w,h,'#cfcea0'));for(let n=12;n<w;n+=18)parts.push(`<path d="M${x+n} ${y+10}v${h-20}" stroke="#8aa069" stroke-width="5"/>`);parts.push(rect(x+8,y+h/2-16,w-16,32,'#f3f1da','none'),label(x+w/2,y+h/2+8,'Staples',20,w-16)); };
  parts.push(`<rect width="600" height="600" fill="#faf7ef"/><path d="M${40+shift} 40L${545-shift} 45L550 ${540-shift}L45 548Z" fill="#e9eedc" stroke="#779063" stroke-width="3" stroke-dasharray="9 5"/>`);
  parts.push(`<path d="M25 0V600" stroke="#d9cbb2" stroke-width="22"/><path d="M40 ${175+shift}H550M220 50V535" stroke="#f8f4e6" stroke-width="15"/>`);
  if(commercial){building(375,75,130,65,'Store');beds(75+shift,215,5,6);staple(390,210,115,255);[85,165,245,325,405,485].forEach(x=>tree(x,495));}
  else if(school){building(70,70,330,90,'School');parts.push(rect(65,235,150,85,'#e8d9b4'),paired(140,274,'Learning','area','Learning area',140));beds(260+shift,220,4,3);staple(285,390,210,100);[85,145,205].forEach(x=>tree(x,440));}
  else if(creche){building(80,75,190,90,'Crèche');parts.push(rect(80,230,210,115,'#e6d8b5'),label(185,293,'Play space',22,200));beds(350,205+shift,2,4);staple(345,405,135,75);[105,180,255].forEach(x=>tree(x,450));}
  else if(home){building(72,72,135,90,'Home');parts.push(rect(70,230,130,90,'#e9dabc'),label(135,278,'Yard',22,120));beds(275+shift,205,3,2+seed%2);staple(285,395,195,90);[[90,410],[160,470],[220,405]].forEach(([x,y])=>tree(x,y));}
  else if(forest){building(75,75,125,70,'Store');beds(75,245+shift,2,2);for(let r=0;r<4;r++)for(let c=0;c<4;c++)tree(290+c*62+(r%2)*7,240+r*65);parts.push(label(390,523,'Food forest'));}
  else{building(75,75,130,65,'Store');beds(275+shift,220,3+seed%2,3+seed%2);staple(280,420,200,85);parts.push(`<circle cx="142" cy="295" r="60" fill="#ded1ae" stroke="#ac9874" stroke-width="2"/>`,paired(142,289,'Meeting','space','Meeting space',170,27));[[80,410],[170,430],[110,505]].forEach(([x,y])=>tree(x,y));}
  const waterX = commercial ? 260 : 480;
  parts.push(`<circle cx="${waterX}" cy="110" r="20" fill="#6e9eb3" stroke="#fff" stroke-width="3"/>`,label(waterX,150,'Water',18),label(300,581,'Schematic layout · not measured',19,540));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">${parts.join('')}</svg>`;
}
export const sampleGardenImage = (kind:string,variant:string,language='en') => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sampleGardenSvg(kind,variant,language))}`;

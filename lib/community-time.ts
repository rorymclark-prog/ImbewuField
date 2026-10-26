import { recordsDate } from './records-months';

/** Both community views keep their original clocks; only the displayed words change. */
export function communityTimeAgo(timestamp:unknown,lang:string,t:(key:string)=>string,compact=false,now=Date.now()):string {
  const value=timestamp as {toDate?:()=>Date;seconds?:number}|null;
  if(!value)return '';
  try {
    const date=typeof value.toDate==='function'?value.toDate():new Date((value.seconds??0)*1000);
    if(!Number.isFinite(date.getTime()))return '';
    const difference=now-date.getTime();
    const text=(key:string,count?:number)=>t(key).replace('{count}',String(count));
    if(difference<60_000)return text(compact?'communityTimeNow':'communityTimeJustNow');
    if(difference<3_600_000)return text(compact?'communityTimeMinutes':'communityTimeMinutesAgo',Math.floor(difference/60_000));
    if(difference<86_400_000)return text(compact?'communityTimeHours':'communityTimeHoursAgo',Math.floor(difference/3_600_000));
    // Existing English/isiZulu date spelling stays exact. Other drafts share the money book's month authority.
    if(['st','ts','ve'].includes(lang))return recordsDate(lang,date,false);
    return date.toLocaleDateString(lang==='zu'?'zu-ZA':'en-ZA',{day:'numeric',month:'short'});
  } catch {return '';}
}

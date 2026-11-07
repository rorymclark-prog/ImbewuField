import { recordsMonthLong } from './records-months';
import { isUpdateCopyLanguage } from './update-copy';
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
// Afrikaans is not in the records month table (its reports and diagrams stay English), so the
// update history carries the standard Afrikaans month names itself.
const AF_MONTHS=['Januarie','Februarie','Maart','April','Mei','Junie','Julie','Augustus','September','Oktober','November','Desember'];
/** Group by the untouched source label; only its displayed month word changes. */
export function updateDateLabel(source:string,lang:string):string {
  if(!isUpdateCopyLanguage(lang))return source;
  const match=/^(\d{1,2}) ([A-Za-z]+) (\d{4})$/.exec(source);
  if(!match)return source;
  const month=MONTHS.indexOf(match[2])+1;
  if(!month)return source;
  const date=new Date(Date.UTC(Number(match[3]),month-1,Number(match[1])));
  if(date.getUTCFullYear()!==Number(match[3])||date.getUTCMonth()+1!==month||date.getUTCDate()!==Number(match[1]))return source;
  return `${match[1]} ${lang==='af'?AF_MONTHS[month-1]:recordsMonthLong(lang,month)} ${match[3]}`;
}

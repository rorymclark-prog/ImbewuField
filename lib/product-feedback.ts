export interface FeedbackInput { id:string; kind:'bug'|'feature'; title:string; details:string; path:string; sample:boolean }
export function validFeedback(v:unknown): v is FeedbackInput {
  if(!v||typeof v!=='object')return false;
  const x=v as FeedbackInput;
  return typeof x.id==='string'&&/^[a-zA-Z0-9_-]{8,80}$/.test(x.id)
    &&(x.kind==='bug'||x.kind==='feature')&&typeof x.title==='string'&&x.title.trim().length>=3&&x.title.length<=160
    &&typeof x.details==='string'&&x.details.trim().length>=10&&x.details.length<=4000
    &&typeof x.path==='string'&&/^\/[a-zA-Z0-9/_-]*$/.test(x.path)&&x.path.length<=200&&typeof x.sample==='boolean';
}
export function feedbackText(input:FeedbackInput):string {
  return `${input.kind==='bug'?'Bug report':'Feature request'}: ${input.title.trim()}\n\n${input.details.trim()}\n\nApp page: ${input.path}\nSample workspace: ${input.sample?'yes':'no'}\nReference: ${input.id}\n`;
}

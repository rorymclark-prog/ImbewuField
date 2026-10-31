'use client';
import { useEffect, useState } from 'react';
import { TRAINING_FEEDBACK_TEMPLATE, trainingFeedbackSummary, type FeedbackLanguage, type TrainingRecord } from '@/lib/programme-evidence';
import { useLanguage } from '@/lib/i18n';
import { inlineText, inlineTemplate, xhInlineDraft } from '@/lib/xh-inline';
import styles from './MelDashboard.module.css';

export default function TrainingFeedback({session,onChange,funder=false}:{session:TrainingRecord;onChange?:(session:TrainingRecord)=>void;funder?:boolean}) {
  const {lang}=useLanguage();
  // Consent and privacy wording: the isiXhosa draft always carries its English source beneath it.
  const pair=(en:string)=>{const draft=lang==='xh'?xhInlineDraft(en):null;return draft?<span style={{minWidth:0}}>{draft}<small style={{display:'block',fontSize:12,lineHeight:1.45}}>English source: {en}</small></span>:en;};
  const [person,setPerson]=useState(''),[answers,setAnswers]=useState<Record<string,string>>({}),[language,setLanguage]=useState<FeedbackLanguage>('en'),[consent,setConsent]=useState(false),[notice,setNotice]=useState('');
  const present=session.attendance.some(a=>a.id===person&&a.present);
  useEffect(()=>{if(person&&!present){setPerson('');setAnswers({});setConsent(false);}},[person,present]);
  const summary=trainingFeedbackSummary(session,funder),zu=language==='zu',xh=language==='xh';
  // The wording the participant is answering in: isiZulu from the template, isiXhosa from its inline drafts.
  const say=(en:string,zuText:string)=>inlineText(language,en,zuText);
  return <section><h3>{inlineText(lang,'Training feedback')}</h3><p>{inlineTemplate(lang,'{completed} responses · {assigned} attended',null,{completed:summary.completed,assigned:summary.assigned})}</p>
    {summary.completed>0?<details><summary>{inlineText(lang,'View feedback findings')}</summary><TrainingFeedbackFindings summary={summary} zu={zu} lang={language}/></details>:<p>{inlineText(lang,'Collect five short answers after the session. Participants may skip questions.')}</p>}
    {onChange&&<details><summary>{inlineText(lang,'Record a participant’s feedback')}</summary>
      <p>{pair('Ask the participant and record their own answers. This form saves their feedback with the session. For participants answering in their own account, link an assessment below.')}</p>
      <label>{inlineText(lang,'Participant')}<select value={person} onChange={e=>{const id=e.target.value,existing=session.feedback?.find(f=>f.participantId===id);setPerson(id);setAnswers(existing?.answers??{});setLanguage(existing?.language??'en');setConsent(false);setNotice('');}}><option value="">{inlineText(lang,'Choose an attendee')}</option>{session.attendance.filter(a=>a.present).map(a=><option key={a.id} value={a.id}>{a.name}{session.feedback?.some(f=>f.participantId===a.id)?` · ${inlineText(lang,'response recorded')}`:''}</option>)}</select></label>
      {person&&<><div className={styles.row}><button type="button" aria-pressed={!zu&&!xh} onClick={()=>setLanguage('en')}>English</button><button type="button" aria-pressed={zu} onClick={()=>setLanguage('zu')}>isiZulu</button><button type="button" aria-pressed={xh} onClick={()=>setLanguage('xh')}>isiXhosa</button></div>
        {TRAINING_FEEDBACK_TEMPLATE.questions.map(q=><label key={q.id}>{say(q.en,q.zu)}{q.kind==='choice'?<select value={answers[q.id]??''} onChange={e=>setAnswers({...answers,[q.id]:e.target.value})}><option value="">{say('Skip / choose an answer','Yeqa / khetha impendulo')}</option>{q.options?.map(o=><option key={o.value} value={o.value}>{say(o.en,o.zu)}</option>)}</select>:<textarea maxLength={1200} value={answers[q.id]??''} onChange={e=>setAnswers({...answers,[q.id]:e.target.value})}/>}</label>)}
        <label className={styles.option}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>{pair('The participant agrees to these answers being recorded for the programme team.')}</label>
        <button type="button" disabled={!present||!consent||!Object.values(answers).some(a=>a.trim())} onClick={()=>{if(!present)return;onChange({...session,feedback:[...(session.feedback??[]).filter(f=>f.participantId!==person),{participantId:person,answers,language,consent:true,recordedAt:new Date().toISOString()}]});setPerson('');setNotice('Response added. Save the session to keep it.');}}>{inlineText(lang,'Add response to session')}</button>
        {session.feedback?.some(f=>f.participantId===person)&&<button type="button" onClick={()=>{onChange({...session,feedback:session.feedback?.filter(f=>f.participantId!==person)});setPerson('');setNotice('Response removed from this draft. Save the session to keep this change.');}}>{inlineText(lang,'Remove response')}</button>}
      </>}
    </details>}
    {notice&&<p role="status">{inlineText(lang,notice)}</p>}
  </section>;
}


/** `lang` (the answer language) wins over the older `zu` flag; callers that only know isiZulu keep passing `zu`. */
export function TrainingFeedbackFindings({summary,zu=false,lang}:{summary:ReturnType<typeof trainingFeedbackSummary>;zu?:boolean;lang?:string}) {
  const l=lang??(zu?'zu':'en'),say=(en:string,zuText:string)=>inlineText(l,en,zuText);
  // The answer wording follows `lang`; the surrounding notices follow the reader's own language.
  const {lang:readerLang}=useLanguage();
  if(summary.metrics.length&&summary.metrics.every(m=>m.suppressed))return <p>{inlineText(readerLang,'Detailed findings are withheld for this small group.')}</p>;
  return <div className={styles.grid}>{summary.metrics.map(m=><section key={m.id} className={styles.card}>
    <h4 style={{fontSize:15,fontWeight:700,lineHeight:1.4,marginBottom:8}}>{say(m.en,m.zu)}</h4>
    {m.suppressed?<p>{inlineText(readerLang,'Results withheld for this small group.')}</p>:<><p>{inlineTemplate(readerLang,'{n} answered · {missing} skipped',null,{n:m.n,missing:m.missing})}</p>{m.choices?.filter(c=>c.count>0).map(c=><div key={c.value}><div className={styles.row} style={{justifyContent:'space-between',fontSize:14}}><span>{say(c.en,c.zu)}</span><strong>{c.count}</strong></div><div className={styles.bar}><span style={{width:`${m.n?c.count/m.n*100:0}%`}}/></div></div>)}</>}
  </section>)}</div>;
}

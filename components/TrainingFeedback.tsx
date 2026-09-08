'use client';
import { useEffect, useState } from 'react';
import { TRAINING_FEEDBACK_TEMPLATE, trainingFeedbackSummary, type TrainingRecord } from '@/lib/programme-evidence';
import styles from './MelDashboard.module.css';

export default function TrainingFeedback({session,onChange,funder=false}:{session:TrainingRecord;onChange?:(session:TrainingRecord)=>void;funder?:boolean}) {
  const [person,setPerson]=useState(''),[answers,setAnswers]=useState<Record<string,string>>({}),[language,setLanguage]=useState<'en'|'zu'>('en'),[consent,setConsent]=useState(false),[notice,setNotice]=useState('');
  const present=session.attendance.some(a=>a.id===person&&a.present);
  useEffect(()=>{if(person&&!present){setPerson('');setAnswers({});setConsent(false);}},[person,present]);
  const summary=trainingFeedbackSummary(session,funder),zu=language==='zu';
  return <section><h3>Training feedback</h3><p>{summary.completed} responses · {summary.assigned} attended</p>
    {summary.completed>0?<details><summary>View feedback findings</summary><TrainingFeedbackFindings summary={summary} zu={zu}/></details>:<p>Collect five short answers after the session. Participants may skip questions.</p>}
    {onChange&&<details><summary>Record a participant’s feedback</summary>
      <p>Ask the participant and record their own answers. This form saves their feedback with the session. For participants answering in their own account, link an assessment below.</p>
      <label>Participant<select value={person} onChange={e=>{const id=e.target.value,existing=session.feedback?.find(f=>f.participantId===id);setPerson(id);setAnswers(existing?.answers??{});setLanguage(existing?.language??'en');setConsent(false);setNotice('');}}><option value="">Choose an attendee</option>{session.attendance.filter(a=>a.present).map(a=><option key={a.id} value={a.id}>{a.name}{session.feedback?.some(f=>f.participantId===a.id)?' · response recorded':''}</option>)}</select></label>
      {person&&<><div className={styles.row}><button type="button" aria-pressed={!zu} onClick={()=>setLanguage('en')}>English</button><button type="button" aria-pressed={zu} onClick={()=>setLanguage('zu')}>isiZulu</button></div>
        {TRAINING_FEEDBACK_TEMPLATE.questions.map(q=><label key={q.id}>{zu?q.zu:q.en}{q.kind==='choice'?<select value={answers[q.id]??''} onChange={e=>setAnswers({...answers,[q.id]:e.target.value})}><option value="">{zu?'Yeqa / khetha impendulo':'Skip / choose an answer'}</option>{q.options?.map(o=><option key={o.value} value={o.value}>{zu?o.zu:o.en}</option>)}</select>:<textarea maxLength={1200} value={answers[q.id]??''} onChange={e=>setAnswers({...answers,[q.id]:e.target.value})}/>}</label>)}
        <label className={styles.option}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>The participant agrees to these answers being recorded for the programme team.</label>
        <button type="button" disabled={!present||!consent||!Object.values(answers).some(a=>a.trim())} onClick={()=>{if(!present)return;onChange({...session,feedback:[...(session.feedback??[]).filter(f=>f.participantId!==person),{participantId:person,answers,language,consent:true,recordedAt:new Date().toISOString()}]});setPerson('');setNotice('Response added. Save the session to keep it.');}}>Add response to session</button>
        {session.feedback?.some(f=>f.participantId===person)&&<button type="button" onClick={()=>{onChange({...session,feedback:session.feedback?.filter(f=>f.participantId!==person)});setPerson('');setNotice('Response removed from this draft. Save the session to keep this change.');}}>Remove response</button>}
      </>}
    </details>}
    {notice&&<p role="status">{notice}</p>}
  </section>;
}


export function TrainingFeedbackFindings({summary,zu=false}:{summary:ReturnType<typeof trainingFeedbackSummary>;zu?:boolean}) {
  if(summary.metrics.length&&summary.metrics.every(m=>m.suppressed))return <p>Detailed findings are withheld for this small group.</p>;
  return <div className={styles.grid}>{summary.metrics.map(m=><section key={m.id} className={styles.card}>
    <h4 style={{fontSize:15,fontWeight:700,lineHeight:1.4,marginBottom:8}}>{zu?m.zu:m.en}</h4>
    {m.suppressed?<p>Results withheld for this small group.</p>:<><p>{m.n} answered · {m.missing} skipped</p>{m.choices?.filter(c=>c.count>0).map(c=><div key={c.value}><div className={styles.row} style={{justifyContent:'space-between',fontSize:14}}><span>{zu?c.zu:c.en}</span><strong>{c.count}</strong></div><div className={styles.bar}><span style={{width:`${m.n?c.count/m.n*100:0}%`}}/></div></div>)}</>}
  </section>)}</div>;
}

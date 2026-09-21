'use client';

import { useState } from 'react';
import questions from '@/lib/course-design-practice.json';
import styles from './FinanceCourse.module.css';

export default function DesignCasePractice() {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  return <section className={styles.section} id="practice">
    <h2>Try the evidence checks</h2><p>Choose an explanation, read the feedback, then try again if needed. These are practice discussions; no result is saved or submitted.</p>
    {questions.map(question => {
      const selected = answers[question.id];
      const choice = selected === undefined ? undefined : question.choices[selected];
      return <section className={styles.practice} key={question.id} aria-labelledby={`question-${question.id}`}>
        <p className={styles.eyebrow}>Source: {question.source}</p><h3 id={`question-${question.id}`}>{question.question}</h3>
        <div className={styles.actions} role="group" aria-labelledby={`question-${question.id}`}>{question.choices.map((item, i) => <button key={item.label} type="button" aria-pressed={selected === i} onClick={() => setAnswers(current => ({ ...current, [question.id]: i }))}>{item.label}</button>)}</div>
        <div aria-live="polite" aria-atomic="true">{choice && <p><strong>{choice.correct ? 'Supported by the case.' : 'Look at the source again.'}</strong> {choice.feedback}</p>}</div>
      </section>;
    })}
  </section>;
}

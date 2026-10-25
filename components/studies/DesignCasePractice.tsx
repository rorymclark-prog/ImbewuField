'use client';

import { useState } from 'react';
import questions from '@/lib/course-design-practice.json';
import { useLanguage } from '@/lib/i18n';
import { inlineText, inlineTemplate } from '@/lib/xh-inline';
import styles from './FinanceCourse.module.css';

export default function DesignCasePractice() {
  const { lang } = useLanguage();
  const tx = (english: string) => inlineText(lang, english);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  return <section className={styles.section} id="practice">
    <h2>{tx('Try the evidence checks')}</h2><p>{tx('Choose an explanation, read the feedback, then try again if needed. These are practice discussions; no result is saved or submitted.')}</p>
    {questions.map(question => {
      const selected = answers[question.id];
      const choice = selected === undefined ? undefined : question.choices[selected];
      return <section className={styles.practice} key={question.id} aria-labelledby={`question-${question.id}`}>
        <p className={styles.eyebrow}>{inlineTemplate(lang, 'Source: {source}', null, { source: question.source })}</p><h3 id={`question-${question.id}`}>{tx(question.question)}</h3>
        <div className={styles.actions} role="group" aria-labelledby={`question-${question.id}`}>{question.choices.map((item, i) => <button key={item.label} type="button" aria-pressed={selected === i} onClick={() => setAnswers(current => ({ ...current, [question.id]: i }))}>{tx(item.label)}</button>)}</div>
        <div aria-live="polite" aria-atomic="true">{choice && <p><strong>{tx(choice.correct ? 'Supported by the case.' : 'Look at the source again.')}</strong> {tx(choice.feedback)}</p>}</div>
      </section>;
    })}
  </section>;
}

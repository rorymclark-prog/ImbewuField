'use client';

// Full lesson experience: goals, teaching sections (text, tips, diagrams,
// playable exercises), practice checklist and completion tracking.

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock, Lightbulb, Target,
} from 'lucide-react';
import type { Lesson, Section } from '@/lib/guitar/curriculum';
import { LESSONS } from '@/lib/guitar/curriculum';
import { getChord } from '@/lib/guitar/chords';
import { useGuitarProgress } from '@/lib/guitar/progress';
import ChordDiagram from './ChordDiagram';
import TabPlayer from './TabPlayer';
import FretboardDiagram from './FretboardDiagram';

function SectionBlock({ section }: { section: Section }) {
  switch (section.kind) {
    case 'text':
      return <p className="text-[15px] leading-relaxed text-ink">{section.body}</p>;
    case 'list':
      return (
        <div>
          {section.title && <p className="mb-2 font-display text-[15px] font-semibold text-ink">{section.title}</p>}
          <ul className="space-y-1.5">
            {section.items.map((item, i) => (
              <li key={i} className="flex gap-2.5 text-[14.5px] leading-relaxed text-ink">
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-forest-light" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      );
    case 'tip':
      return (
        <div className="flex gap-3 rounded-lg border border-ochre/30 bg-ochre/5 p-4">
          <Lightbulb size={18} className="mt-0.5 shrink-0 text-ochre" />
          <p className="text-[14px] leading-relaxed text-ink">{section.body}</p>
        </div>
      );
    case 'chords': {
      const chords = section.ids.map(getChord).filter(Boolean);
      return (
        <div className="flex flex-wrap gap-3">
          {chords.map((c) => c && <ChordDiagram key={c.id} chord={c} />)}
        </div>
      );
    }
    case 'exercise':
      return <TabPlayer ex={section.ex} />;
    case 'fretboard':
      return <FretboardDiagram marks={section.marks} title={section.title} />;
  }
}

export default function LessonView({ lesson }: { lesson: Lesson }) {
  const { completedLessons, toggleLesson, logPracticeToday } = useGuitarProgress();
  const complete = completedLessons.includes(lesson.id);
  const [checked, setChecked] = useState<boolean[]>(() => lesson.practice.map(() => false));

  const idx = LESSONS.findIndex((l) => l.id === lesson.id);
  const prev = LESSONS[idx - 1];
  const next = LESSONS[idx + 1];

  const markComplete = () => {
    if (!complete) logPracticeToday();
    toggleLesson(lesson.id);
  };

  return (
    <article className="space-y-8">
      {/* header */}
      <header>
        <Link href="/guitar" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
          <ArrowLeft size={15} /> All lessons
        </Link>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
          <span>Lesson {lesson.num} of {LESSONS.length}</span>
          <span aria-hidden>·</span>
          <span className="flex items-center gap-1"><Clock size={12} /> {lesson.minutes} min</span>
        </div>
        <h1 className="mt-1 font-display text-[clamp(1.5rem,3.5vw,2.1rem)] font-semibold leading-tight text-ink">
          {lesson.title}
        </h1>
        <p className="mt-1 text-[15px] text-ink-muted">{lesson.subtitle}</p>
      </header>

      {/* goals */}
      <section className="rounded-xl border border-hairline bg-card p-4 shadow-card">
        <p className="mb-2.5 flex items-center gap-2 font-display text-[15px] font-semibold text-ink">
          <Target size={16} className="text-forest" /> In this lesson you will
        </p>
        <ul className="space-y-1.5">
          {lesson.goals.map((g, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-ink">
              <span className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-ochre" />
              {g}
            </li>
          ))}
        </ul>
      </section>

      {/* sections */}
      <div className="space-y-6">
        {lesson.sections.map((s, i) => (
          <SectionBlock key={i} section={s} />
        ))}
      </div>

      {/* practice plan */}
      <section className="rounded-xl border border-hairline bg-card p-5 shadow-card">
        <p className="mb-3 font-display text-[15px] font-semibold text-ink">Practice plan for this week</p>
        <ul className="space-y-2.5">
          {lesson.practice.map((item, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))}
                className="flex w-full items-start gap-3 text-left"
              >
                {checked[i] ? (
                  <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-forest-light" />
                ) : (
                  <Circle size={19} className="mt-0.5 shrink-0 text-hairline" />
                )}
                <span className={'text-[14.5px] leading-relaxed ' + (checked[i] ? 'text-ink-faint line-through' : 'text-ink')}>
                  {item}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={markComplete}
          className={
            'mt-5 flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold transition sm:w-auto sm:px-6 ' +
            (complete
              ? 'border border-forest bg-forest/10 text-forest'
              : 'bg-ochre text-white hover:bg-ochre-dark')
          }
        >
          <CheckCircle2 size={16} />
          {complete ? 'Lesson complete — tap to unmark' : 'Mark lesson complete'}
        </button>
      </section>

      {/* prev / next */}
      <nav className="flex items-stretch justify-between gap-3 border-t border-hairline pt-5" aria-label="Lesson navigation">
        {prev ? (
          <Link href={`/guitar/lessons/${prev.id}`} className="group flex max-w-[48%] items-center gap-2 text-left">
            <ChevronLeft size={18} className="shrink-0 text-ink-faint" />
            <span>
              <span className="block text-xs text-ink-faint">Previous</span>
              <span className="block truncate text-sm font-medium text-ink-muted group-hover:text-ink">{prev.title}</span>
            </span>
          </Link>
        ) : <span />}
        {next ? (
          <Link href={`/guitar/lessons/${next.id}`} className="group flex max-w-[48%] items-center gap-2 text-right">
            <span>
              <span className="block text-xs text-ink-faint">Next</span>
              <span className="block truncate text-sm font-medium text-ink-muted group-hover:text-ink">{next.title}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-ink-faint" />
          </Link>
        ) : <span />}
      </nav>
    </article>
  );
}

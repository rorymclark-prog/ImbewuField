'use client';

// Guitar Studio home: pick up where you left off, see the whole path,
// and keep the practice streak alive.

import Link from 'next/link';
import { CheckCircle2, ChevronRight, Circle, Clock, Flame, Play } from 'lucide-react';
import { LESSONS, nextLesson } from '@/lib/guitar/curriculum';
import { useGuitarProgress } from '@/lib/guitar/progress';

export default function GuitarHome() {
  const { hydrated, completedLessons, streak, practicedToday, logPracticeToday } = useGuitarProgress();
  const upNext = nextLesson(completedLessons);
  const done = completedLessons.length;
  const pct = Math.round((done / LESSONS.length) * 100);

  return (
    <div className="space-y-8">
      {/* hero */}
      <section>
        <h1 className="font-display text-[clamp(1.7rem,4vw,2.4rem)] font-semibold leading-tight text-ink">
          Learn nylon-string guitar
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
          A step-by-step classical guitar course — from holding the guitar to playing the opening of
          Romanza. Every exercise plays out loud so you always know how it should sound. All you need
          is your guitar and fifteen minutes a day.
        </p>
      </section>

      {/* continue + streak */}
      <section className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <Link
          href={`/guitar/lessons/${upNext.id}`}
          className="group flex items-center gap-4 rounded-xl border border-hairline bg-card p-5 shadow-card transition hover:border-ochre/60"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ochre text-white transition group-hover:bg-ochre-dark">
            <Play size={20} />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-wide text-ink-faint">
              {done === 0 ? 'Start here' : done >= LESSONS.length ? 'Revisit' : 'Continue'}
            </span>
            <span className="block truncate font-display text-lg font-semibold text-ink">
              Lesson {upNext.num}: {upNext.title}
            </span>
            <span className="block truncate text-sm text-ink-muted">{upNext.subtitle}</span>
          </span>
          <ChevronRight size={18} className="ml-auto shrink-0 text-ink-faint" />
        </Link>

        <div className="flex items-center gap-4 rounded-xl border border-hairline bg-card p-5 shadow-card sm:w-56">
          <Flame size={26} className={streak > 0 ? 'text-ochre' : 'text-ink-faint'} />
          <div>
            <div className="font-display text-2xl font-semibold leading-none text-ink">
              {hydrated ? streak : '–'}<span className="ml-1 text-sm font-normal text-ink-muted">day{streak === 1 ? '' : 's'}</span>
            </div>
            <div className="text-xs text-ink-faint">practice streak</div>
            <button
              type="button"
              onClick={logPracticeToday}
              disabled={practicedToday}
              className={
                'mt-1.5 text-xs font-semibold ' +
                (practicedToday ? 'cursor-default text-forest-light' : 'text-ochre hover:text-ochre-dark')
              }
            >
              {practicedToday ? 'Practised today' : 'I practised today'}
            </button>
          </div>
        </div>
      </section>

      {/* progress bar */}
      <section aria-label="Course progress">
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className="font-medium text-ink">The path</span>
          <span className="text-ink-faint">{done} of {LESSONS.length} lessons · {pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-hairline">
          <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${Math.max(2, pct)}%` }} />
        </div>
      </section>

      {/* lesson list */}
      <section className="space-y-2.5">
        {LESSONS.map((lesson) => {
          const complete = completedLessons.includes(lesson.id);
          const isNext = lesson.id === upNext.id && done < LESSONS.length;
          return (
            <Link
              key={lesson.id}
              href={`/guitar/lessons/${lesson.id}`}
              className={
                'flex items-center gap-3.5 rounded-lg border bg-card px-4 py-3.5 shadow-card transition hover:border-ochre/60 ' +
                (isNext ? 'border-ochre/70' : 'border-hairline')
              }
            >
              {complete ? (
                <CheckCircle2 size={20} className="shrink-0 text-forest-light" />
              ) : (
                <Circle size={20} className={'shrink-0 ' + (isNext ? 'text-ochre' : 'text-hairline')} />
              )}
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[15px] font-semibold text-ink">
                  {lesson.num}. {lesson.title}
                </span>
                <span className="block truncate text-[13px] text-ink-muted">{lesson.subtitle}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-xs text-ink-faint">
                <Clock size={12} /> {lesson.minutes} min
              </span>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

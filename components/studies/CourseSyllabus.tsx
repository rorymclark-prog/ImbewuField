'use client';

import type { ReactNode } from 'react';
import { useAppLevel } from '@/lib/app-level';
import OfflinePageLink from './OfflinePageLink';
import styles from './FinanceCourse.module.css';

export interface SyllabusLesson {
  id: string;
  title: ReactNode;
}

export interface SyllabusUnit {
  id: string;
  number: number;
  title: ReactNode;
  blurb?: ReactNode;
  lessons: SyllabusLesson[];
  /** Numbering the unit's <ol> should continue from — e.g. Farm Finance runs 1–24 across all
   *  eight units rather than restarting at 1 in each card. Omit to restart at 1 (the design
   *  pathway's stages number this way already). */
  start?: number;
}

/**
 * The design/finance pathway syllabus grid. All tools keeps the full stage-by-stage grid exactly
 * as it always was; Simple collapses it to the pathway's first (next) lesson, with the same full
 * grid one tap away behind "See all" — the long grid of ten-plus stages was the single biggest
 * wall of text on a farmer's screen (see the Study — Simple mode track brief).
 */
export default function CourseSyllabus({ id, units, basePath, eyebrowPrefix, continueEyebrow, seeAllLabel }: {
  /** Anchor id — the hero's "See every lesson"/"See all stages" link jumps here in both layouts. */
  id?: string;
  units: SyllabusUnit[];
  /** A lesson's href is `${basePath}/${lessonId}` — a plain string, not a function: this is a
   *  client component rendered from a server page, and a function prop cannot cross that
   *  boundary (Next.js RSC serialises props, and functions are not serialisable). */
  basePath: string;
  eyebrowPrefix: ReactNode;
  continueEyebrow: ReactNode;
  seeAllLabel: ReactNode;
}) {
  const simple = useAppLevel() === 'simple';
  const hrefFor = (lessonId: string) => `${basePath}/${lessonId}`;

  const cards = units.map((unit) => (
    <section key={unit.id} className={styles.card}>
      <p className={styles.eyebrow}>{eyebrowPrefix} {unit.number}</p>
      <h2>{unit.title}</h2>
      {unit.blurb && <p>{unit.blurb}</p>}
      <ol start={unit.start}>
        {unit.lessons.map((lesson) => (
          <li key={lesson.id}><OfflinePageLink href={hrefFor(lesson.id)}>{lesson.title}</OfflinePageLink></li>
        ))}
      </ol>
    </section>
  ));

  // All tools — unchanged: the same grid div, same id, same cards.
  if (!simple) return <div id={id} className={styles.grid}>{cards}</div>;

  const first = units[0]?.lessons[0];
  return (
    <div id={id} className={styles.grid}>
      {first && (
        <section className={styles.card}>
          <p className={styles.eyebrow}>{continueEyebrow}</p>
          <h2>{first.title}</h2>
          <div className={styles.actions}>
            <OfflinePageLink className={styles.primary} href={hrefFor(first.id)}>{first.title} →</OfflinePageLink>
          </div>
        </section>
      )}
      <details className={styles.card}>
        <summary>{seeAllLabel}</summary>
        <div className={styles.grid}>{cards}</div>
      </details>
    </div>
  );
}

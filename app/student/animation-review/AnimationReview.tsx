'use client';

import { useRef, useState } from 'react';
import styles from './review.module.css';

export interface ReviewClip {
  id: string;
  title: string;
  courseTitle: string;
  slide: number;
  role: string;
  description: string;
  video: string;
  poster: string;
  bytes: number;
  seconds: number;
}

function pauseOtherVideos(active: HTMLVideoElement) {
  document.querySelectorAll('video').forEach(other => { if (other !== active) other.pause(); });
}

function Clip({ clip }: { clip: ReviewClip }) {
  const video = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  function watch() {
    const player = video.current;
    if (!player) return;
    // The page may be opened on mobile data. Assign src only after this explicit choice.
    pauseOtherVideos(player);
    if (!loaded) player.src = clip.video;
    setLoaded(true);
    setError(false);
    player.play().catch(() => setError(true));
  }
  return <article className={styles.card}>
    <div className={styles.videoWrap}>
      <video ref={video} poster={clip.poster} preload="none" controls={loaded} playsInline muted aria-label={clip.description} onPlay={event => pauseOtherVideos(event.currentTarget)} onError={() => setError(true)} />
      {!loaded && <button type="button" className={styles.watch} onClick={watch} aria-label={`Watch ${clip.title}, ${clip.seconds} seconds, ${(clip.bytes / 1_000_000).toFixed(1)} MB`}>
        <span className={styles.play} aria-hidden="true">▶</span>
        <span>Watch · {clip.seconds}s <small>{(clip.bytes / 1_000_000).toFixed(1)} MB</small></span>
      </button>}
    </div>
    <div className={styles.cardBody}>
      <p className={styles.eyebrow}>{clip.courseTitle} / Slide {clip.slide}</p>
      <h2>{clip.title}</h2>
      <p>{clip.description}</p>
      <p className={styles.role}>{clip.role}</p>
      {error && <p role="status">Use the player controls to start the clip, or <a href={clip.video}>open the video</a>.</p>}
      <a className={styles.download} href={clip.video} download>Save silent clip <span aria-hidden="true">↓</span></a>
    </div>
  </article>;
}

export default function AnimationReview({ clips }: { clips: ReviewClip[] }) {
  return <section className={styles.grid} aria-label="Six animation drafts">
    {clips.map(clip => <Clip key={clip.id} clip={clip} />)}
  </section>;
}

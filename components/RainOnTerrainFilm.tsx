// "Rain on this ground": a 76-second Blender film of the example farm. The ground is real
// elevation for DEMO_COORDS (open AWS Terrain Tiles, Terrarium z15, 962 m at the point, as the
// app stores), drawn at four times its height so a 1.3° slope can be seen at all. Water on the
// field follows lib/overland-flow.ts (one downhill bearing, stopped at the swale); the roof gets
// no flow arrow, for the reason that file gives. The tank's month-by-month level is
// lib/water-year.ts levelAtDay for this roof, this rain, the default household of four and the
// 10 000 L tank householdTank() picks, the same year the figure below plays.
//
// No autoplay: the film starts only when someone presses play, so reduced-motion readers are
// never handed motion they did not ask for. Build files: ~/Claude/media-catalogue/
// rain-on-terrain-2026-11-11 (BRIEF.md lists every on-screen number and its source).

import s from './RainOnTerrainFilm.module.css';

export default function RainOnTerrainFilm() {
  return (
    <section className={s.card} aria-labelledby="rain-film-title">
      <div>
        <h2 id="rain-film-title" className={s.title}>Rain on this ground</h2>
        <p className={s.sub}>
          A storm on the site&rsquo;s real terrain, where the water runs, and the tank through the year.
        </p>
      </div>
      <figure className={s.figure}>
        <video
          className={s.video}
          src="/films/rain-on-terrain-720.mp4"
          poster="/films/rain-on-terrain-poster.webp"
          controls
          playsInline
          muted
          preload="none"
          width={1280}
          height={720}
          aria-describedby="rain-film-notes"
        >
          Your browser cannot play this film.
        </video>
        <figcaption id="rain-film-notes" className={s.notes}>
          <span>Ground: real elevation for this point (open SRTM-class data), shown at four times its height.</span>
          <span>House, tank, field and swale are an example layout; the swale is the app&rsquo;s suggestion, not a surveyed feature.</span>
          <span>Tank levels: the app&rsquo;s own water year for 4 people, a 120&nbsp;m&sup2; roof and a 10&nbsp;000&nbsp;L tank.</span>
        </figcaption>
      </figure>
    </section>
  );
}

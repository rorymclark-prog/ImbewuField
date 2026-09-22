import { guideScreens } from './guide-screens';
import styles from './AppGuide.module.css';

export default function GuideScreenSlides({ guideId }: { guideId: string }) {
  const screens = guideScreens(guideId);
  if (!screens.length) return null;
  return <section className={styles.screenSection} aria-labelledby="guide-screens-title">
    <div className={styles.screenIntro}>
      <div>
        <p className={styles.eyebrow}>Pictures of the app</p>
        <h2 id="guide-screens-title">See where to go</h2>
      </div>
      <p>These screens use the sample farm. Your own records may look different. Swipe sideways to see each screen; open a picture to zoom in.</p>
    </div>
    <div className={styles.screenSlides} role="list" aria-label="Example app screens">
      {screens.map((screen, index) => <figure className={styles.screenSlide} role="listitem" key={screen.src}>
        <a href={screen.src} target="_blank" rel="noopener noreferrer" aria-label={`Open ${screen.title} picture at full size`}>
          <img src={screen.src} alt={`${screen.title} screen in the sample farm`} loading="lazy" />
        </a>
        <figcaption>
          <strong>Screen {index + 1} of {screens.length}: {screen.title}</strong>
          <span>{screen.caption}</span>
          {screen.src.endsWith('/map-tools.png') && <small>Imagery: Esri, Maxar, Earthstar Geographics · <a href="https://www.mapbox.com/about/maps/">© Mapbox</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a></small>}
        </figcaption>
      </figure>)}
    </div>
  </section>;
}

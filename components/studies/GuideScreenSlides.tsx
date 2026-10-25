'use client';

import { guideScreens } from './guide-screens';
import { useLanguage } from '@/lib/i18n';
import { inlineText, inlineTemplate } from '@/lib/xh-inline';
import styles from './AppGuide.module.css';

export default function GuideScreenSlides({ guideId }: { guideId: string }) {
  const { lang } = useLanguage();
  const tx = (english: string) => inlineText(lang, english);
  const screens = guideScreens(guideId);
  if (!screens.length) return null;
  return <section className={styles.screenSection} aria-labelledby="guide-screens-title">
    <div className={styles.screenIntro}>
      <div>
        <p className={styles.eyebrow}>{tx('Pictures of the app')}</p>
        <h2 id="guide-screens-title">{tx('See where to go')}</h2>
      </div>
      <p>{tx('These screens use the sample farm. Your own records may look different. Swipe sideways to see each screen; open a picture to zoom in.')}</p>
    </div>
    <div className={styles.screenSlides} role="list" aria-label={tx('Example app screens')}>
      {screens.map((screen, index) => <figure className={styles.screenSlide} role="listitem" key={screen.src}>
        <a href={screen.src} target="_blank" rel="noopener noreferrer" aria-label={inlineTemplate(lang, 'Open {title} picture at full size', null, { title: screen.title })}>
          <img src={screen.src} alt={inlineTemplate(lang, '{title} screen in the sample farm', null, { title: screen.title })} loading="lazy" />
        </a>
        <figcaption>
          <strong>{inlineTemplate(lang, 'Screen {n} of {total}: {title}', null, { n: index + 1, total: screens.length, title: screen.title })}</strong>
          <span>{screen.caption}</span>
          {screen.src.endsWith('/map-tools.png') && <small>Imagery: Esri, Maxar, Earthstar Geographics · <a href="https://www.mapbox.com/about/maps/">© Mapbox</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a></small>}
        </figcaption>
      </figure>)}
    </div>
  </section>;
}

import styles from './ChallengeIcon.module.css';

export type ChallengeKind = 'fire' | 'frost' | 'hail' | 'wind' | 'erosion' | 'water' | 'rain' | 'heat' | 'dot';

// Keyword table, checked in order (first match wins). Covers the English biome strings in
// lib/biome.ts and the isiZulu strings in lib/locales/zu.ts (biomeChallenges*).
const RULES: Array<[ChallengeKind, RegExp]> = [
  ['fire', /\bfire|burn|umlilo/],
  ['frost', /frost|isithwathwa/],
  ['hail', /hail|isiqhwa/],
  ['wind', /\bwind|umoya/],
  ['erosion', /erosion|erodible|slope|landslide|ukuguguleka|iwa kalula|ukuwa komhlabathi|amagquma/],
  ['water', /vlei|wetland|drainage|flood|swamp|waterlog|emanzi|ukwomisa|izikhukhula/],
  ['rain', /storm|cyclone|humid|izivunguvungu|umswakama|isiphepho/],
  ['heat', /heat|\bdry\b|dry-|-dry|drought|evaporation|hot\b|arid|brak|uv\b|shisa|omile|lomile|ukuhwamuka|ilanga elinamandla/],
];

export function challengeKind(text: string): ChallengeKind {
  const s = text.toLowerCase();
  for (const [kind, re] of RULES) if (re.test(s)) return kind;
  return 'dot';
}

export default function ChallengeIcon({ text }: { text: string }) {
  const kind = challengeKind(text);
  return (
    <svg className={styles.icon} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      {kind === 'frost' && (
        <g className={`${styles.spin} ${styles.ice}`}>
          <path d="M8 1.5v13M2.4 4.75l11.2 6.5M2.4 11.25l11.2-6.5" />
          <path d="M6.3 2.6 8 4.2l1.7-1.6M6.3 13.4 8 11.8l1.7 1.6" />
        </g>
      )}
      {kind === 'hail' && (
        <g className={styles.ice}>
          <circle className={`${styles.fall} ${styles.f1}`} cx="4" cy="2" r="1.5" />
          <circle className={`${styles.fall} ${styles.f2}`} cx="8.5" cy="2" r="1.5" />
          <circle className={`${styles.fall} ${styles.f3}`} cx="13" cy="2" r="1.5" />
        </g>
      )}
      {kind === 'rain' && (
        <g className={styles.water}>
          <path className={`${styles.fall} ${styles.f1}`} d="M4 1v3" />
          <path className={`${styles.fall} ${styles.f2}`} d="M8.5 1v3" />
          <path className={`${styles.fall} ${styles.f3}`} d="M13 1v3" />
        </g>
      )}
      {kind === 'erosion' && (
        <g>
          <path className={styles.earth} d="M1.5 4 14.5 12.5" />
          <circle className={`${styles.slide} ${styles.s1} ${styles.grain}`} cx="3.5" cy="3.2" r="1" />
          <circle className={`${styles.slide} ${styles.s2} ${styles.grain}`} cx="3.5" cy="3.2" r="1" />
          <circle className={`${styles.slide} ${styles.s3} ${styles.grain}`} cx="3.5" cy="3.2" r="1" />
        </g>
      )}
      {kind === 'water' && (
        <g className={styles.water}>
          <circle className={styles.dropDot} cx="8" cy="8" r="1" />
          <circle className={`${styles.ripple} ${styles.r1}`} cx="8" cy="8" r="2" />
          <circle className={`${styles.ripple} ${styles.r2}`} cx="8" cy="8" r="2" />
        </g>
      )}
      {kind === 'heat' && (
        <g>
          <g className={styles.sunPulse}>
            <circle className={styles.sun} cx="8" cy="9" r="3" />
            <path className={styles.sunRay} d="M8 2.5v1.5M2.5 9H4M12 9h1.5M4.1 5.1l1 1M11.9 5.1l-1 1" />
          </g>
          <path className={`${styles.shimmer} ${styles.sunRay}`} d="M3 13.5q1.25-1 2.5 0t2.5 0 2.5 0 2.5 0" />
        </g>
      )}
      {kind === 'wind' && (
        <g className={`${styles.windG} ${styles.air}`}>
          <path d="M1.5 6h8a2 2 0 1 0-2-2" />
          <path d="M1.5 10h10.5a2 2 0 1 1-2 2" />
        </g>
      )}
      {kind === 'fire' && (
        <path
          className={`${styles.flame} ${styles.fireShape}`}
          d="M8 1.5c.5 2.5 3.5 3.8 3.5 7a3.5 3.5 0 0 1-7 0c0-1.3.6-2.2 1.3-3 .2 1 .6 1.5 1.2 1.7C6.8 5.5 7.3 3.5 8 1.5z"
        />
      )}
      {kind === 'dot' && <circle className={styles.neutral} cx="8" cy="8" r="2" />}
    </svg>
  );
}

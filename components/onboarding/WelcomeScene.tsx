import styles from './WelcomeScene.module.css';

// Decorative welcome illustration: cloud drifts in and rains, the tank fills, the sun rises,
// seedlings sprout. Plays once (~4 s) and holds. The base CSS is the final frame, so under
// prefers-reduced-motion (animations off) the finished scene shows statically.
const BED_XS = [140, 177, 214, 251, 288];

export default function WelcomeScene() {
  return (
    <div className={styles.scene} aria-hidden="true">
      <svg viewBox="0 0 320 140" preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <clipPath id="welcome-tank-clip">
            <rect x="60" y="58" width="40" height="54" rx="4" />
          </clipPath>
        </defs>
        <rect className={styles.sky} x="0" y="0" width="320" height="140" />

        <g className={styles.sunRise}>
          <circle className={styles.sunGlow} cx="250" cy="58" r="22" />
          <circle className={styles.sun} cx="250" cy="58" r="14" />
        </g>

        <rect className={styles.ground} x="0" y="112" width="320" height="28" />

        {/* tank */}
        <g clipPath="url(#welcome-tank-clip)">
          <rect className={styles.tankWater} x="60" y="58" width="40" height="54" />
        </g>
        <rect className={styles.tankWall} x="60" y="58" width="40" height="54" rx="4" />
        <path className={styles.tankWall} d="M60 70h40M60 84h40M60 98h40" />

        {/* rain */}
        <g className={styles.rain}>
          <path className={`${styles.drop} ${styles.d1}`} d="M68 40v8" />
          <path className={`${styles.drop} ${styles.d2}`} d="M80 40v8" />
          <path className={`${styles.drop} ${styles.d3}`} d="M92 40v8" />
        </g>

        {/* cloud */}
        <g className={styles.cloud}>
          <path
            className={styles.cloudShape}
            d="M52 38a9 9 0 0 1 5-16 12 12 0 0 1 22-3 10 10 0 0 1 17 5 8 8 0 0 1-2 14z"
          />
        </g>

        {/* beds + seedlings */}
        {BED_XS.map((x, i) => (
          <g key={x} transform={`translate(${x} 104)`}>
            <rect className={styles.bed} x="-13" y="0" width="26" height="8" rx="2" />
            <g className={styles.sprout} style={{ animationDelay: `${2.4 + i * 0.3}s` }}>
              <path className={styles.stem} d="M0 0v-15" />
              <path className={styles.leaf} d="M0 -9c-8 0-9-6-9-6 7-1 9 2 9 6z" />
              <path className={styles.leaf} d="M0 -13c8 0 9-6 9-6-7-1-9 2-9 6z" />
            </g>
          </g>
        ))}
      </svg>
    </div>
  );
}

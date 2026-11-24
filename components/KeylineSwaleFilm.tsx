'use client';

/**
 * Blender 5.2 3D keyline contour swale cutaway comparison:
 * bare compacted slope sheet wash vs contour-level swales & infiltration.
 * Respects reduced motion — never autoplays; user plays or scrubs directly.
 */
export default function KeylineSwaleFilm() {
  return (
    <section
      aria-labelledby="keyline-swale-title"
      style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 'clamp(16px, 1.6vw, 24px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div>
        <h2
          id="keyline-swale-title"
          className="font-display font-semibold m-0"
          style={{ fontSize: 'clamp(16px, 1.3vw, 19px)', color: 'var(--text-primary)', lineHeight: 1.25 }}
        >
          Bare slope runoff vs contour keyline swales
        </h2>
        <p
          className="font-sans m-0"
          style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.45 }}
        >
          3D slope cutaway rendered in Blender 5.2: compacted bare earth sheds storm water into a silt trough on the left, while level contour bunds hold rain in recharge basins feeding the downhill root zone.
        </p>
      </div>
      <video
        poster="/films/keyline-swale-3d-poster.webp"
        controls
        playsInline
        muted
        preload="metadata"
        aria-label="3D Blender storm comparison between bare compacted slope runoff and contour keyline swales"
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          display: 'block',
          borderRadius: 10,
          background: 'var(--bg-0)',
          border: '1px solid var(--border)',
        }}
      >
        <source src="/films/keyline-swale-3d.mp4" type="video/mp4" />
      </video>
    </section>
  );
}

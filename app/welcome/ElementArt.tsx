import Image from 'next/image';

/**
 * One hand-drawn permaculture element from public/element-art — the same art the
 * farm-design canvas itself draws with (see design/DESIGN.md's design-system section).
 * Used here purely as decoration: the collages this renders into sit beside headline
 * copy that already says the same thing in words, so alt stays empty by default and
 * the caller wraps the group in aria-hidden. Fixed width/height (the source PNGs are
 * all 192x192) rather than `fill`, per the brief's "next/image, explicit width/height".
 */
export default function ElementArt({
  name,
  size = 96,
  rotate = 0,
  offset = 0,
  priority = false,
  className = '',
}: {
  name: string;
  size?: number;
  /** Degrees — small tilts give the collage its scrapbook feel. */
  rotate?: number;
  /** Pixels of vertical stagger. */
  offset?: number;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={`/element-art/${name}.png`}
      alt=""
      width={size}
      height={size}
      priority={priority}
      className={`select-none drop-shadow-md ${className}`}
      style={{ transform: `rotate(${rotate}deg) translateY(${offset}px)` }}
    />
  );
}

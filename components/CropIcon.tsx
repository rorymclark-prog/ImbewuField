import type { CSSProperties } from 'react';
import { getCropArt } from '@/lib/crop-art';

/**
 * Crop icon: real hand-drawn art from lib/crop-art.ts when it exists for this
 * crop, the catalog's emoji `icon` as a fallback otherwise — so this renders
 * identically to before until art actually lands. See docs/CROP-ART-BRIEF.md.
 */
export default function CropIcon({
  cropKey,
  icon,
  size,
  style,
}: {
  cropKey: string;
  icon: string;
  size: number;
  style?: CSSProperties;
}) {
  const art = getCropArt(cropKey);
  return art ? (
    <img
      src={art}
      alt=""
      aria-hidden
      style={{ width: size, height: size, objectFit: 'contain', display: 'inline-block', verticalAlign: '-15%', ...style }}
    />
  ) : (
    <span aria-hidden style={{ fontSize: size, ...style }}>
      {icon}
    </span>
  );
}

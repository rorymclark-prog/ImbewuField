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
  // Timeline bars are only 26px high; the general 32px list-art floor clips
  // their labels. An explicit size must apply to both artwork and emoji.
  const art = getCropArt(cropKey);
  return art ? (
    <img
      className="produce-art"
      src={art}
      alt=""
      aria-hidden
      style={{ width: size, height: size, minWidth: size, minHeight: size, flexShrink: 0, objectFit: 'contain', display: 'inline-block', verticalAlign: '-15%', ...style }}
    />
  ) : (
    <span aria-hidden className="produce-art-fallback" style={{ fontSize: size, width: size, height: size, lineHeight: 1, flexShrink: 0, ...style }}>
      {icon}
    </span>
  );
}

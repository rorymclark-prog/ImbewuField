// Finishes describe the drawing materials. The saved plan still supplies every feature and label.
export const CLASSIC_MAP_MEDIA = {
  watercolour: 'transparent watercolour washes',
  graphite_pencil: 'pressure-varied graphite strokes',
  pen_and_ink: 'black pen outlines and sparse hatching',
} as const;

export type ClassicMapStyle = keyof typeof CLASSIC_MAP_MEDIA;

export function isClassicMapStyle(style: string): style is ClassicMapStyle {
  return Object.hasOwn(CLASSIC_MAP_MEDIA, style);
}

// The provider draws only the artwork. The aerial surround, labels, legend and routes are added
// afterwards, so a pencil or ink prompt alone still sends coloured pixels to a printer.
export function finishClassicSheet(ctx: CanvasRenderingContext2D, style?: string): void {
  if (style !== 'graphite_pencil' && style !== 'pen_and_ink') return;
  const { width, height } = ctx.canvas;
  // A full-size print sheet already occupies a large canvas on a phone. Read one strip at a time.
  for (let y = 0; y < height; y += 64) {
    const strip = ctx.getImageData(0, y, width, Math.min(64, height - y));
    const rgba = strip.data;
    for (let i = 0; i < rgba.length; i += 4) {
      const grey = Math.round(0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]);
      rgba[i] = grey;
      rgba[i + 1] = grey;
      rgba[i + 2] = grey;
    }
    ctx.putImageData(strip, 0, y);
  }
}

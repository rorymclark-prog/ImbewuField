import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compositeAccurateMap,
  restoreProtectedPixels,
  type ImageInput,
} from '../lib/image-producer.ts';

type Rgba = readonly [number, number, number, number];

interface RasterSource {
  width: number;
  height: number;
  naturalWidth?: number;
  naturalHeight?: number;
  complete?: boolean;
  data: Uint8ClampedArray;
}

class RasterCanvas {
  private canvasWidth = 0;
  private canvasHeight = 0;
  data = new Uint8ClampedArray();
  readonly context = new RasterContext(this);

  get width(): number { return this.canvasWidth; }
  set width(value: number) {
    this.canvasWidth = value;
    this.reset();
  }

  get height(): number { return this.canvasHeight; }
  set height(value: number) {
    this.canvasHeight = value;
    this.reset();
  }

  getContext(kind: string): RasterContext | null {
    return kind === '2d' ? this.context : null;
  }

  /** The pixels as they stood when toDataURL ran. A real canvas encodes AT CALL TIME, and the
   *  production code drains (zeroes) each canvas right after extracting its picture — so the
   *  canvas object itself is empty by the time a test can look. Asserting on this snapshot is
   *  asserting on what actually left the canvas, and it fails if anything releases before it
   *  reads. */
  encoded: { width: number; height: number; data: Uint8ClampedArray } | null = null;

  toDataURL(): string {
    this.encoded = { width: this.width, height: this.height, data: this.data.slice() };
    return 'data:image/png;base64,synthetic-registration';
  }

  private reset(): void {
    this.data = new Uint8ClampedArray(Math.max(0, this.canvasWidth * this.canvasHeight * 4));
  }
}

class RasterContext {
  readonly canvas: RasterCanvas;
  fillStyle: string | CanvasGradient | CanvasPattern = '#000';
  strokeStyle: string | CanvasGradient | CanvasPattern = '#000';
  lineWidth = 1;
  lineJoin: CanvasLineJoin = 'miter';

  constructor(canvas: RasterCanvas) {
    this.canvas = canvas;
  }

  drawImage(image: CanvasImageSource, dx: number, dy: number, dw?: number, dh?: number): void {
    const source = image as unknown as RasterSource;
    const sourceWidth = source.naturalWidth || source.width;
    const sourceHeight = source.naturalHeight || source.height;
    const targetWidth = dw ?? sourceWidth;
    const targetHeight = dh ?? sourceHeight;
    for (let y = Math.max(0, Math.floor(dy)); y < Math.min(this.canvas.height, Math.ceil(dy + targetHeight)); y++) {
      for (let x = Math.max(0, Math.floor(dx)); x < Math.min(this.canvas.width, Math.ceil(dx + targetWidth)); x++) {
        const sx = Math.min(
          sourceWidth - 1,
          Math.max(0, Math.floor(((x - dx) / targetWidth) * sourceWidth)),
        );
        const sy = Math.min(
          sourceHeight - 1,
          Math.max(0, Math.floor(((y - dy) / targetHeight) * sourceHeight)),
        );
        const sourceIndex = (sy * sourceWidth + sx) * 4;
        const targetIndex = (y * this.canvas.width + x) * 4;
        const alpha = source.data[sourceIndex + 3] / 255;
        const inverse = 1 - alpha;
        for (let channel = 0; channel < 3; channel++) {
          this.canvas.data[targetIndex + channel] = Math.round(
            source.data[sourceIndex + channel] * alpha
            + this.canvas.data[targetIndex + channel] * inverse,
          );
        }
        this.canvas.data[targetIndex + 3] = Math.round(
          source.data[sourceIndex + 3]
          + this.canvas.data[targetIndex + 3] * inverse,
        );
      }
    }
  }

  getImageData(x: number, y: number, width: number, height: number): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let row = 0; row < height; row++) {
      for (let column = 0; column < width; column++) {
        const sourceIndex = ((y + row) * this.canvas.width + x + column) * 4;
        const targetIndex = (row * width + column) * 4;
        data.set(this.canvas.data.subarray(sourceIndex, sourceIndex + 4), targetIndex);
      }
    }
    return { data, width, height, colorSpace: 'srgb' } as ImageData;
  }

  createImageData(width: number, height: number): ImageData {
    return {
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
      colorSpace: 'srgb',
    } as ImageData;
  }

  putImageData(image: ImageData, dx: number, dy: number): void {
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const sourceIndex = (y * image.width + x) * 4;
        const targetIndex = ((dy + y) * this.canvas.width + dx + x) * 4;
        this.canvas.data.set(image.data.subarray(sourceIndex, sourceIndex + 4), targetIndex);
      }
    }
  }

  beginPath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  closePath(): void {}
  save(): void {}
  clip(): void {}
  restore(): void {}
  stroke(): void {}
}

function raster(width: number, height: number, fill: Rgba): RasterSource {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) data.set(fill, index);
  return { width, height, naturalWidth: width, naturalHeight: height, complete: true, data };
}

function setPixel(image: RasterSource, x: number, y: number, color: Rgba): void {
  image.data.set(color, (y * image.width + x) * 4);
}

function pixel(image: Pick<RasterSource, 'width' | 'data'>, x: number, y: number): number[] {
  const index = (y * image.width + x) * 4;
  return Array.from(image.data.subarray(index, index + 4));
}

function assertColorWithinOnePixel(
  image: Pick<RasterSource, 'width' | 'height' | 'data'>,
  expectedX: number,
  expectedY: number,
  color: Rgba,
): void {
  for (let y = Math.max(0, expectedY - 1); y <= Math.min(image.height - 1, expectedY + 1); y++) {
    for (let x = Math.max(0, expectedX - 1); x <= Math.min(image.width - 1, expectedX + 1); x++) {
      if (pixel(image, x, y).every((channel, index) => channel === color[index])) return;
    }
  }
  assert.fail(`expected colour within 1 px of (${expectedX}, ${expectedY})`);
}

function asImageInput(image: RasterSource): ImageInput {
  return image as unknown as HTMLImageElement;
}

async function withRasterDocument<T>(
  run: (canvases: RasterCanvas[]) => Promise<T>,
): Promise<T> {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const canvases: RasterCanvas[] = [];
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement(tag: string) {
        assert.equal(tag, 'canvas');
        const canvas = new RasterCanvas();
        canvases.push(canvas);
        return canvas;
      },
    },
  });
  try {
    return await run(canvases);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete (globalThis as { document?: unknown }).document;
  }
}

const EXACT = [235, 45, 190, 255] as const;
const MODEL = [34, 112, 58, 255] as const;
const SATELLITE = [70, 72, 74, 255] as const;
const AI_GROUND_MARKER = [20, 220, 240, 255] as const;
const HALF_EXACT_MARKER = [240, 20, 80, 128] as const;
const REGISTERED_BLEND = [130, 120, 160, 255] as const;

/**
 * The synthetic overlay is 12×8 while the requested map is 24×16. Its four two-pixel-inset
 * corners therefore land at (5,5), (19,5), (19,11), (5,11). One output pixel is the declared
 * tolerance: nearest-neighbour and browser bilinear sampling disagree only on which side of the
 * source pixel centre owns an edge, never by another ground cell.
 */
const HYBRID_EXPECTED_CORNERS = [[5, 5], [19, 5], [19, 11], [5, 11]] as const;

for (const sheet of ['masterplan', 'water layer'] as const) {
  test(`${sheet} hybrid burns exact boundary corners onto the AI-painted ground`, async () => {
    await withRasterDocument(async (canvases) => {
      const model = raster(20, 20, MODEL); // deliberately square; requested map is landscape
      const satellite = raster(24, 16, SATELLITE);
      const overlay = raster(12, 8, [0, 0, 0, 0]);
      setPixel(model, 10, 10, AI_GROUND_MARKER);
      setPixel(overlay, 6, 4, HALF_EXACT_MARKER);
      for (const [x, y] of [[2, 2], [9, 2], [9, 5], [2, 5]] as const) {
        setPixel(overlay, x, y, EXACT);
      }

      await compositeAccurateMap({
        modelImage: asImageInput(model),
        satelliteImage: asImageInput(satellite),
        boundaryPx: [4, 4, 20, 4, 20, 12, 4, 12],
        overlayImage: asImageInput(overlay),
        width: 24,
        height: 16,
      });

      const output = canvases.at(-1)?.encoded;
      assert.ok(output, 'the composite never encoded a picture — drained before toDataURL?');
      for (const [x, y] of HYBRID_EXPECTED_CORNERS) {
        assertColorWithinOnePixel(output, x, y, EXACT);
      }
      assert.deepEqual(
        pixel(output, 12, 8),
        [...REGISTERED_BLEND],
        'known AI ground marker and exact overlay marker must occupy the same output pixel',
      );
    });
  });

  test(`${sheet} restoration keeps exact corners when the AI returns a proportional resize`, async () => {
    await withRasterDocument(async (canvases) => {
      const finishedHybrid = raster(24, 16, MODEL);
      const polished = raster(36, 24, [120, 84, 48, 255]);
      const protectMask = raster(24, 16, [255, 255, 255, 0]);
      setPixel(finishedHybrid, 12, 8, [240, 20, 80, 255]);
      setPixel(protectMask, 12, 8, [255, 255, 255, 128]);
      setPixel(polished, 18, 12, AI_GROUND_MARKER);
      for (const [x, y] of [[6, 4], [18, 4], [18, 12], [6, 12]] as const) {
        setPixel(finishedHybrid, x, y, EXACT);
        setPixel(protectMask, x, y, [255, 255, 255, 255]);
      }

      await restoreProtectedPixels(
        asImageInput(finishedHybrid),
        asImageInput(polished),
        asImageInput(protectMask),
      );

      const output = canvases.at(-1)?.encoded;
      assert.ok(output, 'the restore never encoded a picture — drained before toDataURL?');
      // The old test accepted stretching a landscape map onto a square. Registering two
      // stretched layers together does not preserve ground geometry; only uniform resizing does.
      for (const [x, y] of [[9, 6], [27, 6], [27, 18], [9, 18]] as const) {
        assertColorWithinOnePixel(output, x, y, EXACT);
      }
      assert.deepEqual(
        pixel(output, 18, 12),
        [...REGISTERED_BLEND],
        'known Full Treatment ground marker and restored exact marker must share one output pixel',
      );
      assert.deepEqual(pixel(output, 20, 14), [120, 84, 48, 255], 'editable AI ground stays painted');
    });
  });
}

test('a square AI return cannot stretch a landscape source and protection mask into agreement', async () => {
  await withRasterDocument(async (canvases) => {
    await assert.rejects(restoreProtectedPixels(
      asImageInput(raster(24, 16, SATELLITE)),
      asImageInput(raster(20, 20, MODEL)),
      asImageInput(raster(24, 16, [255, 255, 255, 255])),
    ), /model aspect does not match source/);
    assert.equal(canvases.length, 0, 'mismatched geometry must be rejected before rasterising');
  });
});

test('a mask from a differently shaped map cannot restore pixels onto this map', async () => {
  await withRasterDocument(async (canvases) => {
    await assert.rejects(restoreProtectedPixels(
      asImageInput(raster(24, 16, SATELLITE)),
      asImageInput(raster(36, 24, MODEL)),
      asImageInput(raster(16, 16, [255, 255, 255, 255])),
    ), /mask aspect does not match source/);
    assert.equal(canvases.length, 0);
  });
});

test('a fully protected mask restores the source instead of exposing the whole AI redraw', async () => {
  await withRasterDocument(async (canvases) => {
    const source = raster(24, 16, SATELLITE);
    setPixel(source, 12, 8, EXACT);
    await restoreProtectedPixels(
      asImageInput(source),
      asImageInput(raster(36, 24, MODEL)),
      asImageInput(raster(12, 8, [255, 255, 255, 255])),
    );
    const output = canvases.at(-1)?.encoded;
    assert.ok(output, 'the source restoration must remain available as a PNG');
    assert.deepEqual(pixel(output, 18, 12), [...EXACT]);
    assert.deepEqual(pixel(output, 0, 0), [...SATELLITE]);
    assert.deepEqual(pixel(output, 35, 23), [...SATELLITE]);
    for (let i = 0; i < output.data.length; i += 4) {
      assert.notDeepEqual(Array.from(output.data.subarray(i, i + 4)), [...MODEL],
        'no raw model pixel may escape an entirely protected mask');
    }
  });
});

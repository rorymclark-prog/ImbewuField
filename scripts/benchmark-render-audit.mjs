#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';

function quantile(sorted, fraction) {
  if (sorted.length === 0) return null;
  return sorted[Math.floor((sorted.length - 1) * fraction)];
}

export function measureMask(mask) {
  const pixels = mask.width * mask.height;
  let fullyProtected = 0;
  let fullyEditable = 0;
  let partial = 0;
  let alphaSum = 0;

  for (let i = 3; i < mask.data.length; i += 4) {
    const alpha = mask.data[i];
    alphaSum += alpha;
    if (alpha === 255) fullyProtected += 1;
    else if (alpha === 0) fullyEditable += 1;
    else partial += 1;
  }

  return {
    width: mask.width,
    height: mask.height,
    pixels,
    fullyProtectedFraction: fullyProtected / pixels,
    fullyEditableFraction: fullyEditable / pixels,
    partialAlphaFraction: partial / pixels,
    sourceWeight: alphaSum / (255 * pixels),
    modelWeight: 1 - alphaSum / (255 * pixels),
  };
}

/**
 * Count the places where a deterministic composite switches authority between source and model.
 * Alpha 128 is the exact midpoint: pixels on one side are source-dominant, pixels on the other are
 * model-dominant. The component count is topology, not an aesthetic guess about whether a seam is
 * pretty enough.
 */
export function measureMaskTransitions(mask) {
  const { width, height, data } = mask;
  const pixels = width * height;
  const boundary = new Uint8Array(pixels);
  let transitionEdges = 0;

  const sourceDominant = (pixelIndex) => data[pixelIndex * 4 + 3] >= 128;
  const markTransition = (first, second) => {
    if (sourceDominant(first) === sourceDominant(second)) return;
    transitionEdges += 1;
    boundary[first] = 1;
    boundary[second] = 1;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (x + 1 < width) markTransition(index, index + 1);
      if (y + 1 < height) markTransition(index, index + width);
    }
  }

  const visited = new Uint8Array(pixels);
  const queue = new Int32Array(pixels);
  let boundaryPixels = 0;
  let boundaryComponents = 0;
  for (let index = 0; index < pixels; index += 1) {
    if (!boundary[index]) continue;
    boundaryPixels += 1;
    if (visited[index]) continue;
    boundaryComponents += 1;
    let head = 0;
    let tail = 0;
    queue[tail++] = index;
    visited[index] = 1;
    while (head < tail) {
      const current = queue[head++];
      const x = current % width;
      const y = Math.floor(current / width);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const neighbour = ny * width + nx;
          if (!boundary[neighbour] || visited[neighbour]) continue;
          visited[neighbour] = 1;
          queue[tail++] = neighbour;
        }
      }
    }
  }

  return {
    transitionEdges,
    boundaryPixels,
    boundaryComponents,
    transitionEdgesPerMegapixel: transitionEdges / (pixels / 1_000_000),
  };
}

function isParchmentPixel(red, green, blue) {
  const brightest = Math.max(red, green, blue);
  const darkest = Math.min(red, green, blue);
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance >= 180 && darkest >= 145 && brightest - darkest <= 85;
}

/**
 * Locate the light title/legend panel in the right-hand page band. Rounded cards leave a narrow
 * map-coloured margin at the physical edge, while text and swatches interrupt the card itself, so
 * this finds the longest majority-parchment run rather than assuming the last pixel is cream.
 */
export function measureRightPanel(image) {
  const fractions = [];
  for (let x = 0; x < image.width; x += 1) {
    let parchment = 0;
    for (let y = 0; y < image.height; y += 1) {
      const offset = (y * image.width + x) * 4;
      if (isParchmentPixel(image.data[offset], image.data[offset + 1], image.data[offset + 2])) {
        parchment += 1;
      }
    }
    fractions.push(parchment / image.height);
  }

  const searchStart = Math.floor(image.width * 0.6);
  let bestStart = image.width;
  let bestEnd = image.width;
  let runStart = null;
  for (let x = searchStart; x <= image.width; x += 1) {
    if (x < image.width && fractions[x] >= 0.5) {
      if (runStart === null) runStart = x;
      continue;
    }
    if (runStart !== null && x - runStart > bestEnd - bestStart) {
      bestStart = runStart;
      bestEnd = x;
    }
    runStart = null;
  }
  if (bestStart === image.width) {
    return { present: false, left: null, widthFraction: 0 };
  }
  return {
    present: true,
    left: bestStart,
    widthFraction: (bestEnd - bestStart) / image.width,
  };
}

export function parseTesseractTsv(tsv, imageHeight, minimumLeft = 0) {
  const rows = tsv
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split('\t'))
    .filter(
      (columns) =>
        columns.length >= 12
        && Number(columns[6]) >= minimumLeft
        && Number(columns[10]) >= 0
        && columns[11].trim(),
    );
  const confidences = rows.map((columns) => Number(columns[10])).sort((a, b) => a - b);
  const relativeHeights = rows
    .map((columns) => Number(columns[9]) / imageHeight)
    .sort((a, b) => a - b);
  return {
    wordCount: rows.length,
    confidenceP10: quantile(confidences, 0.1),
    confidenceMedian: quantile(confidences, 0.5),
    relativeWordHeightP10: quantile(relativeHeights, 0.1),
    relativeWordHeightMedian: quantile(relativeHeights, 0.5),
    text: rows.map((columns) => columns[11]).join(' '),
  };
}

export function normalizeOcrText(text) {
  return text
    .toLowerCase()
    .replace(/[×x]/g, 'x')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function expectedPhraseCoverage(recognizedText, expectedPhrases) {
  const normalizedText = normalizeOcrText(recognizedText);
  const compactText = normalizedText.replace(/ /g, '');
  const matches = expectedPhrases.map((phrase) => ({
    phrase,
    found:
      normalizedText.includes(normalizeOcrText(phrase))
      || compactText.includes(normalizeOcrText(phrase).replace(/ /g, '')),
  }));
  return {
    matched: matches.filter((match) => match.found).length,
    expected: matches.length,
    fraction: matches.length === 0 ? 1 : matches.filter((match) => match.found).length / matches.length,
    matches,
  };
}

function parseArgs(argv) {
  const options = { expected: [], image: '', mask: '', sourceImage: '', tesseract: 'tesseract' };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    i += 1;
    if (flag === '--expect') options.expected.push(value);
    else if (flag === '--image') options.image = value;
    else if (flag === '--mask') options.mask = value;
    else if (flag === '--source-image') options.sourceImage = value;
    else if (flag === '--tesseract') options.tesseract = value;
    else throw new Error(`Unknown argument: ${flag}`);
  }
  if (!options.image && !options.mask) throw new Error('Pass --image, --mask, or both');
  return options;
}

function readPng(path) {
  return PNG.sync.read(readFileSync(path));
}

export function auditImageFile(path, expectedPhrases = [], tesseractCommand = 'tesseract') {
  const image = readPng(path);
  const panel = measureRightPanel(image);
  const result = spawnSync(
    tesseractCommand,
    [path, 'stdout', '--psm', '11', 'tsv'],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(`Tesseract failed: ${result.stderr.trim()}`);
  }
  const ocr = parseTesseractTsv(result.stdout, image.height);
  const panelOcr = panel.present
    ? parseTesseractTsv(result.stdout, image.height, panel.left)
    : null;
  return {
    path,
    width: image.width,
    height: image.height,
    panel,
    ocr: {
      ...ocr,
      expectedPhraseCoverage: expectedPhraseCoverage(ocr.text, expectedPhrases),
    },
    panelOcr: panelOcr
      ? {
          ...panelOcr,
          expectedPhraseCoverage: expectedPhraseCoverage(panelOcr.text, expectedPhrases),
        }
      : null,
  };
}

export function measureAspectDrift(source, output) {
  const sourceAspect = source.width / source.height;
  const outputAspect = output.width / output.height;
  return {
    sourceAspect,
    outputAspect,
    relativeDrift: Math.abs(outputAspect / sourceAspect - 1),
    sameOrientation: (source.width >= source.height) === (output.width >= output.height),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = {};
  if (options.image) {
    report.image = auditImageFile(options.image, options.expected, options.tesseract);
    if (options.sourceImage) {
      report.aspect = measureAspectDrift(readPng(options.sourceImage), readPng(options.image));
    }
  }
  if (options.mask) {
    const mask = readPng(options.mask);
    report.mask = {
      ...measureMask(mask),
      transitions: measureMaskTransitions(mask),
    };
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

// Pictures for the printed food-availability page (lib/crop-export-pdf.ts).
//
// The page prints the same crop, fruit and animal art the app's calendars show. Plant pictures are
// a fallback for species without product art. Embedding full-size pictures repeatedly would add
// megabytes to a PDF a farmer shares over WhatsApp. Each is drawn onto a small canvas and embedded as a
// PNG data URL at print size. jsPDF then reuses it by alias wherever that crop appears again.
//
// Keys are 'crop:<cropKey>', 'tree:<speciesId>' and 'animal:<enterpriseId>', the same keys the PDF
// asks for. A key with no art, or art that fails to load, is simply left out, and the PDF prints
// that item's short code instead. A missing picture never stops the export.

import { getCropArt } from '@/lib/crop-art';
import { speciesPickerArtworkUrl, speciesFruitArtworkUrl } from '@/lib/species-art';
import { animalArtUrl } from '@/lib/animal-art';
import { ELEMENTS_BY_ID } from '@/lib/design-elements';

export type PdfIconMap = Record<string, string>;

/** The public URL of one icon key's artwork, or null when that item has none. */
export function pdfIconUrl(iconKey: string): string | null {
  const split = iconKey.indexOf(':');
  if (split < 0) return null;
  const kind = iconKey.slice(0, split);
  const id = iconKey.slice(split + 1);
  if (kind === 'crop') return getCropArt(id) ?? null;
  if (kind === 'tree') return speciesFruitArtworkUrl(id) ?? speciesPickerArtworkUrl(id);
  if (kind === 'animal') return animalArtUrl(id);
  if (kind === 'element') return ELEMENTS_BY_ID[id]?.art ?? null;
  return null;
}

/** The field calendar now uses larger pictures; 128px keeps them crisp on paper. */
export const PDF_ICON_PX = 128;

async function downscale(url: string, px: number): Promise<string | null> {
  const response = await fetch(url);
  if (!response.ok) return null;
  const blob = await response.blob();
  // Berry art is SVG. Decode it as an image because createImageBitmap does not
  // consistently accept SVG across the browsers farmers use to export a plan.
  const objectUrl = blob.type.includes('svg') ? URL.createObjectURL(blob) : null;
  const bitmap = objectUrl ? await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Product art did not load')); };
    img.src = objectUrl;
  }) : await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const scale = Math.min(px / bitmap.width, px / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (px - w) / 2, (px - h) / 2, w, h);
  if ('close' in bitmap) bitmap.close();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  return canvas.toDataURL('image/png');
}

/** Browser only. Loads every key that has art, in parallel; failures are dropped, not thrown. */
export async function loadPdfIcons(iconKeys: Iterable<string>, px = PDF_ICON_PX): Promise<PdfIconMap> {
  const out: PdfIconMap = {};
  await Promise.all([...new Set(iconKeys)].map(async (key) => {
    const url = pdfIconUrl(key);
    if (!url) return;
    try {
      const data = await downscale(url, px);
      if (data) out[key] = data;
    } catch {
      // A picture that will not load prints as its code.
    }
  }));
  return out;
}

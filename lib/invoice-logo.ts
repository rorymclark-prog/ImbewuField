/**
 * The enterprise logo a farmer puts on their invoices.
 *
 * It is stored inline on the profile as a data URL, so the size ceiling is not a nicety
 * — a Firestore document is capped at 1 MB, and a phone camera "logo" is several times
 * that. Everything here exists to make a photo of a hand-painted signboard land inside
 * that budget without the farmer having to know it.
 *
 * PNG is kept when the image actually uses transparency, because a logo dropped onto a
 * white square looks wrong on a tinted letterhead. When it does not, JPEG on white is
 * several times smaller for the same picture.
 */

/** Longest edge, in pixels. 320 covers the 52px screen slot and the 44pt PDF square at
 *  well past retina density; beyond that only the payload grows. */
export const LOGO_MAX_PX = 320;

/** Hard ceiling for the encoded data URL. Comfortably inside Firestore's 1 MB document
 *  limit even alongside the rest of the profile. */
export const LOGO_MAX_BYTES = 200_000;

/** Whether any pixel is not fully opaque — the only thing that justifies keeping PNG. */
function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const { data } = ctx.getImageData(0, 0, w, h);
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
  return false;
}

/**
 * Read an image file and return a data URL small enough to store on the profile.
 *
 * Rejects rather than returns a too-large payload: silently storing something that
 * Firestore will refuse would look like a successful upload and then lose the logo.
 */
export function resizeLogoForStorage(file: File, maxPx = LOGO_MAX_PX): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not an image we can read.'));
      img.onload = () => {
        const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * ratio));
        canvas.height = Math.max(1, Math.round(img.height * ratio));
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Could not process that image.')); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const transparent = hasTransparency(ctx, canvas.width, canvas.height);
        let jpegCanvas = canvas;
        let out = transparent ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85);

        // A photographed signboard can still exceed the ceiling as PNG. Falling back to
        // JPEG on white loses the transparency, but a logo that saves beats one that does not.
        if (out.length > LOGO_MAX_BYTES && transparent) {
          const flat = document.createElement('canvas');
          flat.width = canvas.width; flat.height = canvas.height;
          const flatCtx = flat.getContext('2d');
          if (flatCtx) {
            flatCtx.fillStyle = '#ffffff';
            flatCtx.fillRect(0, 0, flat.width, flat.height);
            flatCtx.drawImage(canvas, 0, 0);
            jpegCanvas = flat;
            out = flat.toDataURL('image/jpeg', 0.85);
          } else { reject(new Error('Could not process that image.')); return; }
        }

        // The evidence report also uses this bounded encoder for 640px photos. A
        // detailed garden exceeded 200k at quality .85 and blocked the whole PDF.
        // Keep its dimensions first; reduce them only if compression is not enough.
        if (out.length > LOGO_MAX_BYTES) {
          for (const quality of [0.75, 0.65, 0.55]) {
            out = jpegCanvas.toDataURL('image/jpeg', quality);
            if (out.length <= LOGO_MAX_BYTES) break;
          }
        }
        while (out.length > LOGO_MAX_BYTES && Math.max(jpegCanvas.width, jpegCanvas.height) > 160) {
          const smaller = document.createElement('canvas');
          smaller.width = Math.max(1, Math.round(jpegCanvas.width * 0.75));
          smaller.height = Math.max(1, Math.round(jpegCanvas.height * 0.75));
          const smallerCtx = smaller.getContext('2d');
          if (!smallerCtx) break;
          smallerCtx.fillStyle = '#ffffff';
          smallerCtx.fillRect(0, 0, smaller.width, smaller.height);
          smallerCtx.drawImage(jpegCanvas, 0, 0, smaller.width, smaller.height);
          jpegCanvas = smaller;
          out = jpegCanvas.toDataURL('image/jpeg', 0.75);
        }
        if (out.length > LOGO_MAX_BYTES) {
          reject(new Error('That image is too big to store. Try a smaller or simpler picture.'));
          return;
        }
        resolve(out);
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

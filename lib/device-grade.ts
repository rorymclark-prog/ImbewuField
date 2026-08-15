// IS THIS THE KIND OF DEVICE THE APP KEEPS DYING ON?
//
// The August crash saga (lib/crash-loop.ts has the diary) ended with one structural fact: the
// design page's peak memory — decoded drone photo + decoded satellite underlay + a supersampled
// bake canvas, live at once — fits on a laptop and does not fit on the phones farmers actually
// own. Every allocation in that pipeline is sized for print quality; none of it asked what it
// was running on.
//
// This module is the one place that question gets asked, so the answer stays consistent across
// the bake, the satellite fetch and the photo import. It deliberately does NOT use
// navigator.deviceMemory (Safari — the platform that crashes — never reports it) or the user
// agent (in-app browsers lie). A coarse pointer plus a phone-sized screen is the honest,
// feature-detected shape of "a phone".

/** True on phone-grade hardware: the primary pointer is a finger AND the screen is phone-sized.
 *  False on the server and on anything unreadable — desktops must keep full quality. */
export function phoneGradeDevice(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    // screen, not innerWidth: a phone browser's viewport shrinks under keyboards and toolbars,
    // but the hardware it must fit in does not. 820 clears every iPhone and almost all Androids
    // while staying under iPads in landscape, whose memory budget is closer to a laptop's.
    const shortSide = Math.min(window.screen?.width ?? Infinity, window.screen?.height ?? Infinity);
    return coarse && shortSide <= 820;
  } catch {
    return false;
  }
}

/**
 * The supersample ceiling for base-photo work on THIS device.
 *
 * 3 is BASE_PHOTO_EXPORT_SCALE (lib/design-canvas.ts): 2880×1920, sharp in print, ~22 MB of
 * RGBA pixel buffer while baking. On a phone that buffer — held TOGETHER with both decoded
 * source images — is the single allocation that tips iOS into killing the page. 2 keeps the
 * photo at twice the frame resolution (1920×1280, still above what a phone screen can show)
 * for 44% of the pixel cost. Print-grade 3× remains what laptops produce.
 */
export function deviceBakeScale(fullScale: number): number {
  return phoneGradeDevice() ? Math.min(2, fullScale) : fullScale;
}

/** Satellite/basemap pixel ratio for this device: @2x retina on laptops, @1x on phones — a
 *  960×640 frame is already 2.4× the width a small phone can physically display. */
export function deviceImageryRatio(): 1 | 2 {
  return phoneGradeDevice() ? 1 : 2;
}

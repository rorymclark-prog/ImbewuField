/**
 * Optional hand-drawn artwork per crop, keyed by CropDef.key from
 * lib/crop-catalog.ts. Deliberately a SIBLING lookup rather than a field on
 * CropDef itself — lib/crop-catalog.ts has in-flight unpushed changes on
 * another branch (codex/crop-plan-continuity), so this file avoids touching
 * it at all.
 *
 * Falls back to the crop's existing emoji `icon` wherever a key has no entry
 * here, so wiring this lookup in cannot change what a farmer sees until real
 * art actually exists for that crop. See docs/CROP-ART-BRIEF.md for the
 * generation brief, the self-check script, and the naming convention
 * (public/crop-art/<key>.png).
 */
export const CROP_ART: Record<string, string> = {
  // Populated once Codex delivers PNGs into public/crop-art/ — see
  // docs/CROP-ART-BRIEF.md. Left empty here so this wiring commit changes
  // nothing visible; a follow-up commit adds entries as art lands.
};

/** Returns the art path for a crop key, or undefined if none exists yet. */
export function getCropArt(key: string): string | undefined {
  return CROP_ART[key];
}

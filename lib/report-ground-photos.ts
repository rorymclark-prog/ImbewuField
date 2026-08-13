// THE REPORT LOOKS AT THE GROUND, NOT ONLY AT THE PLAN.
//
// Rory: "there is still no images … the audit said the report needs to also draw analyses from
// these images, not generic zone information."
//
// lib/report-site-images.ts answered half of that by sending the farmer's PLAN SHEETS to the model.
// This is the other half, and it is a different kind of evidence entirely. A plan sheet is drawn
// FROM the farmer's own traced geometry — it can only ever show what they already told the app.
// A photograph of the actual ground is the one input in the whole report that carries information
// nobody typed in: whether the soil is capped and bare or covered and worked, whether that dam wall
// is holding, whether the "existing trees" are a windbreak or three survivors of a fire.
//
// Those photos already existed, in lib/site-evidence.ts, filed against 52 catalogue tiles. The
// report threw every pixel of them away at the last moment before the request left the phone:
//
//     // Build evidence summary (strip base64 thumbnails — send counts + notes only)
//
// So the model was told "soil_compaction: 2 items" and asked to write about the soil. That is not
// a model failing to be specific; that is a model being handed a number and asked for a picture.
//
// WHAT THIS IS NOT. It does not re-run the vision pass in app/api/analyse-photos. That route is a
// separate, transient thing a farmer triggers by hand; this attaches the photos they have already
// filed, to the report they are already generating, with no extra step and no extra call.

import { EVIDENCE_CATALOGUE, evidenceKeyLabel } from './evidence-catalogue';
import type { EvidenceItem } from './site-evidence';
import { base64Bytes } from './report-site-images';

/** One ground photo, in the shape an Anthropic image block wants. */
export interface GroundPhoto {
  /** "Soil & growing beds · Compaction & hardpan" — what the model is looking at. */
  label: string;
  /** The farmer's own note on that photo, if they left one. Their words, not ours. */
  note?: string;
  mediaType: 'image/jpeg';
  /** Base64 WITHOUT the `data:` prefix. */
  data: string;
}

/**
 * How many photos go to the model.
 *
 * Same multiplication as the plan sheets: every batch of sections is an independent call, so this
 * is photos × batches. These are far cheaper than a sheet — lib/site-evidence.ts stores them at
 * ≤400px and quality 0.72, so ~30–50 KB each rather than a megabyte — which is what makes four
 * affordable where three sheets is the ceiling.
 */
export const MAX_GROUND_PHOTOS = 4;

/** Total base64 the photos may add to the request. A phone on a rural connection uploads this. */
export const GROUND_PHOTO_BUDGET_BYTES = 900_000;

/** Per-photo ceiling on the wire. Rejects rather than truncates. */
const MAX_WIRE_BYTES_PER_PHOTO = 400_000;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Which groups are worth looking at, best first.
 *
 * Ordered by how much a PICTURE adds over what the app already knows in numbers. Soil leads: there
 * is no field anywhere in this app that records whether the ground is capped, gullied or mulched,
 * and it decides what will grow. Water second — a tank's capacity is a number the farmer typed,
 * but whether the gutters actually reach it is not. Trees third: "existing trees" as a count says
 * nothing about age, health or canopy. Structures, animals and energy last, because their reports
 * lean hardest on figures the farmer has already entered.
 */
const GROUP_PRIORITY = ['soil', 'water', 'trees', 'structures', 'animals', 'energy'];

function groupRank(storageKey: string): number {
  for (let i = 0; i < GROUP_PRIORITY.length; i++) {
    const g = GROUP_PRIORITY[i];
    if (storageKey === `${g}_site_photos` || storageKey.startsWith(`${g}_`)) return i;
  }
  return GROUP_PRIORITY.length;
}

/** The group a storage key belongs to, for the round-robin below. */
function groupOf(storageKey: string): string {
  const hit = EVIDENCE_CATALOGUE.find(
    (g) => storageKey === `${g.key}_site_photos` || g.items.some((i) => storageKey === `${g.key}_${i.key}`),
  );
  return hit?.key ?? '';
}

/** Strip `data:image/jpeg;base64,`. Returns null for anything that is not a JPEG data URL. */
function jpegPayload(dataUrl: string): string | null {
  if (!dataUrl.startsWith('data:image/jpeg;base64,')) return null;
  const payload = dataUrl.slice('data:image/jpeg;base64,'.length);
  return payload.length ? payload : null;
}

/**
 * Choose the photos to send.
 *
 * ONE PER GROUP BEFORE ANY GROUP GETS A SECOND. A farmer who has photographed their rain tanks
 * from four angles and their soil once should not send four tanks and no soil — the point of the
 * exercise is that the model sees the whole holding, and a naive "newest four" or "best group
 * first" reduces to a single subject the moment somebody is thorough about one tile. Within a
 * group, newest first: the most recent photo is the current state of that thing.
 *
 * Notes ride along without a photo being required to have one, and a note-only or PDF item is
 * skipped here — it is already covered by the counts-and-notes summary the report has always sent.
 */
export function selectGroundPhotos(
  evidence: Readonly<Record<string, readonly EvidenceItem[]>>,
  max: number = MAX_GROUND_PHOTOS,
): { key: string; item: EvidenceItem }[] {
  const byGroup = new Map<string, { key: string; item: EvidenceItem }[]>();

  const keys = Object.keys(evidence ?? {}).sort((a, b) => groupRank(a) - groupRank(b) || a.localeCompare(b));
  for (const key of keys) {
    if (!evidenceKeyLabel(key)) continue; // a key the catalogue does not know
    const photos = (evidence[key] ?? [])
      .filter((i) => i && i.type === 'photo' && typeof i.dataUrl === 'string' && i.dataUrl)
      .sort((a, b) => (b.takenAt ?? 0) - (a.takenAt ?? 0));
    if (!photos.length) continue;
    const group = groupOf(key);
    const bucket = byGroup.get(group) ?? [];
    for (const item of photos) bucket.push({ key, item });
    byGroup.set(group, bucket);
  }

  // Round-robin across groups, in priority order.
  const order = [...byGroup.keys()].sort(
    (a, b) => GROUP_PRIORITY.indexOf(a) - GROUP_PRIORITY.indexOf(b),
  );
  const out: { key: string; item: EvidenceItem }[] = [];
  for (let round = 0; out.length < max; round++) {
    let placedThisRound = false;
    for (const group of order) {
      const bucket = byGroup.get(group)!;
      if (round >= bucket.length) continue;
      out.push(bucket[round]);
      placedThisRound = true;
      if (out.length >= max) break;
    }
    if (!placedThisRound) break; // every bucket exhausted
  }
  return out;
}

/**
 * Encode the chosen photos for the wire.
 *
 * No canvas and no downscaling: these were already resized at capture (lib/site-evidence.ts caps
 * them at 400px so they fit in localStorage at all), so the expensive, memory-hungry step the plan
 * sheets need is simply not needed here. Anything unreadable is skipped rather than thrown — a
 * report the model could not look at is still a report.
 */
export function prepareGroundPhotos(
  evidence: Readonly<Record<string, readonly EvidenceItem[]>>,
  budgetBytes: number = GROUND_PHOTO_BUDGET_BYTES,
): GroundPhoto[] {
  const out: GroundPhoto[] = [];
  let spent = 0;
  for (const { key, item } of selectGroundPhotos(evidence)) {
    const data = jpegPayload(item.dataUrl!);
    if (!data) continue;
    const bytes = base64Bytes(data);
    if (spent + bytes > budgetBytes) continue;
    const named = evidenceKeyLabel(key);
    if (!named) continue;
    spent += bytes;
    out.push({
      label: `${named.group} · ${named.item}`,
      note: item.note?.trim() || undefined,
      mediaType: 'image/jpeg',
      data,
    });
  }
  return out;
}

// ── The server side ───────────────────────────────────────────────────────────────────────────

/**
 * Validate what arrived. Crosses the wire from a client we do not control straight into a paid
 * upstream call, so it is checked and capped rather than trusted. Anything malformed is dropped,
 * never repaired.
 */
export function normaliseGroundPhotos(value: unknown): GroundPhoto[] {
  if (!Array.isArray(value)) return [];
  const out: GroundPhoto[] = [];
  let spent = 0;
  for (const raw of value.slice(0, MAX_GROUND_PHOTOS)) {
    if (typeof raw !== 'object' || raw === null) continue;
    const row = raw as Record<string, unknown>;
    if (row.mediaType !== 'image/jpeg') continue;
    if (typeof row.data !== 'string' || !row.data || row.data.length % 4 !== 0) continue;
    if (!BASE64.test(row.data)) continue;
    const bytes = base64Bytes(row.data);
    if (bytes > MAX_WIRE_BYTES_PER_PHOTO) continue;
    if (spent + bytes > GROUND_PHOTO_BUDGET_BYTES) continue;
    spent += bytes;
    const label = typeof row.label === 'string' ? row.label.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
    const note = typeof row.note === 'string' ? row.note.replace(/\s+/g, ' ').trim().slice(0, 300) : '';
    out.push({
      label: label || 'Site photo',
      ...(note ? { note } : {}),
      mediaType: 'image/jpeg',
      data: row.data,
    });
  }
  return out;
}

/**
 * What the model is told about the photographs, immediately before it is shown them.
 *
 * The distinction from siteImagesPromptBlock is the whole reason this is a separate block rather
 * than four more entries in that one. A PLAN is evidence of ARRANGEMENT — what sits where. A
 * PHOTOGRAPH is evidence of CONDITION — what state that thing is actually in. Told to treat them
 * the same, a model reads a photo for layout, which is the one thing a close-up of a gully cannot
 * tell it, and misses the only thing it can.
 *
 * The numbers rule is repeated verbatim rather than referenced. A photo is a far stronger pull
 * towards estimating than a plan is — a model that will not guess an area off a scaled drawing
 * will happily call a slope "about 15%" off a snapshot, and that guess would land in the report
 * beside the farmer's measured figures with nothing to tell them apart.
 */
export function groundPhotosPromptBlock(photos: readonly GroundPhoto[]): string {
  if (!photos.length) return '';
  const list = photos
    .map((p, i) => `Photo ${i + 1}: ${p.label}${p.note ? ` — the farmer's note: "${p.note}"` : ''}`)
    .join('\n');
  return [
    `THE FARMER'S OWN PHOTOGRAPHS OF THIS LAND ARE ATTACHED (${photos.length} photo${photos.length === 1 ? '' : 's'}), in this order:`,
    list,
    '',
    'These are not drawings. They are photographs of the actual ground, taken on this holding by',
    'the person the report is for, and filed by them against the thing each one shows.',
    '',
    'Read them for CONDITION, which is the one thing no other input in this report carries. The',
    'measurements say how big a bed is; only the photograph says whether the soil in it is capped',
    'and bare or covered and worked. The plan says a tank stands by the shed; only the photograph',
    'says whether a gutter actually reaches it. Say what you can see — bare or covered ground,',
    'erosion and gullying, existing plants and their condition, damage, repair, what is already',
    'working — and let it change the advice. Refer to a photo by its number and its subject when',
    'you use one ("photo 2 shows the beds are already mulched, so…").',
    '',
    'TWO LIMITS, both absolute:',
    '· EVERY NUMBER comes from the measured site data below. Never estimate an area, a distance, a',
    '  slope, a depth, a count or a capacity off a photograph — not even approximately, not even',
    '  hedged. A photograph is evidence of condition and of nothing else.',
    '· Describe only what is actually visible. Do not name a plant species, a soil type or a problem',
    '  you cannot see in the photograph and cannot find in the site data below. "I cannot tell from',
    '  the photo" is a correct and useful thing to write.',
  ].join('\n');
}

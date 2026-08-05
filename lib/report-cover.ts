/**
 * report-cover.ts — the cover page and document-control block.
 *
 * Written in code for the same reason as the Site at a Glance table: the first page of a document
 * handed to a funder is the page most likely to be quoted back, and not one field on it should be
 * capable of drifting. There is no prose here for a model to write.
 */

export interface ReportCoverInput {
  /** The farm's own name, when the farmer gave one. */
  farmName?: string | null;
  /** Vegetation unit / biome line, e.g. "Zululand Lowveld (Savanna)". */
  bioregion?: string | null;
  /** Municipality / district / province, when reverse geocoding answered. */
  adminLabel?: string | null;
  lat: number;
  lon: number;
  /** Already-formatted date, e.g. "5 August 2026". */
  dateLabel: string;
  /** ISO date, used to build the document reference. */
  isoDate: string;
  /** Which sections the reader asked for — drives "Basis of issue". */
  sectionCount: number;
  /** 'One page' | 'Standard' | 'Comprehensive' — the requested depth. */
  lengthLabel: string;
}

/** A stable, human-checkable reference: IF-SR-<yyyymmdd>-<initials of the site>. */
export function documentReference(input: Pick<ReportCoverInput, 'farmName' | 'isoDate'>): string {
  const date = input.isoDate.slice(0, 10).replace(/-/g, '');
  // An unnamed site gets the literal 'SITE' — not the initials of the word "site", which is how
  // an earlier version of this produced the reference "IF-SR-20260805-S" and made two different
  // unnamed farms look like the same document.
  const initials = (input.farmName ?? '')
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-z]/g, '').charAt(0))
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 4);
  return `IF-SR-${date}-${initials || 'SITE'}`;
}

/**
 * The cover page.
 *
 * `# ` is used once in the whole document, here. Everything the generator writes starts at `## `,
 * so the heading hierarchy has exactly one root.
 */
export function buildCoverMarkdown(input: ReportCoverInput): string {
  const out: string[] = [];
  const title = input.farmName ? `Permaculture Site Report — ${input.farmName}` : 'Permaculture Site Report';

  out.push(`# ${title}`);
  out.push('');
  const place = [input.bioregion, input.adminLabel].filter(Boolean).join(' · ');
  if (place) { out.push(place); out.push(''); }
  out.push(`${Math.abs(input.lat).toFixed(4)}° ${input.lat < 0 ? 'S' : 'N'}, ${Math.abs(input.lon).toFixed(4)}° ${input.lon < 0 ? 'W' : 'E'}`);
  out.push('');
  out.push(`Issued ${input.dateLabel}`);
  out.push('');

  out.push('## Document control');
  out.push('');
  // Named columns rather than a blank header row: an empty `| | |` head renders as an empty
  // thead in the in-app reader and gives the PDF exporter nothing to size its columns against.
  out.push('| Field | Detail |');
  out.push('|-------|--------|');
  out.push(`| Reference | ${documentReference(input)} |`);
  out.push(`| Site | ${input.farmName ?? 'Not named by the farmer'} |`);
  out.push(`| Issued | ${input.dateLabel} |`);
  out.push(`| Revision | 1 — first issue |`);
  out.push(`| Basis of issue | ${input.lengthLabel} report, ${input.sectionCount} section${input.sectionCount === 1 ? '' : 's'} requested |`);
  out.push('| Prepared by | ImbewuField, from the farmer\'s own map, survey and crop plan |');
  out.push('| Status | For the farmer\'s use and discussion. Not a professional engineering, agronomic or financial certification. |');
  out.push('');
  out.push('This report describes one site on one date. Where a figure was measured, the table beside it names what measured it; where the app had no data, the report says so rather than filling the gap.');
  out.push('');

  return out.join('\n');
}

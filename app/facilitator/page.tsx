// The legacy "Design canvas" (FacilitatorCanvas) was retired on 2026-08-04 — the Design
// Studio (/design) is the one place designs are made. This route survives only so old
// links and bookmarks land somewhere sensible. The legacy design STORE
// (imbewu_facilitator_design_v1) is untouched: /facilitator/crops still reads it as a
// bed-source fallback and /facilitator/print still prints from it.
//
// staff-15: this used to redirect to /design, which with no site chosen rendered a bare,
// unthemed page (no header, no nav, just a lone "Tour" pill) — a dead end for the mentor who
// followed an old /facilitator link or bookmark. /mentor is the workspace that link actually
// meant to reach.
import { redirect } from 'next/navigation';

export default function FacilitatorPage() {
  redirect('/mentor');
}

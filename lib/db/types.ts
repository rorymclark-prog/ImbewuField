// ImbewuField data types — mirror the Postgres schema in supabase/schema.sql.
// These are the contract the UI + data-access layer build against.

// Mentor merges the former 'supervisor' (farm visits / design sign-off) and
// 'trainer' (the 9-month course) into one field role, per the design handoff.
export type UserRole = 'farmer' | 'mentor' | 'student' | 'ngo' | 'funder' | 'admin';
export type GardenStatus = 'thriving' | 'establishing' | 'support';

export interface Organization { id: string; name: string; kind: 'ngo' | 'funder'; created_at: string }

export interface Programme {
  id: string; org_id: string; name: string; funder: string | null; deployed_amount: number | null; created_at: string;
}

export interface Profile {
  id: string; full_name: string | null; role: UserRole; org_id: string | null;
  language: string; id_number: string | null; phone: string | null; photo_url: string | null; created_at: string;
  bio?: string | null;
  /**
   * What the farmer calls their farm — "Tugela Valley smallholding", "Plot 14, Nquthu".
   *
   * Printed under the seller's name on every invoice. It was a hardcoded string until 2026-08-06,
   * so every farmer in the country invoiced their buyers from one particular smallholding in the
   * Tugela valley. Optional on purpose: an invoice with no farm line is fine, an invoice naming
   * the wrong farm is not, so an unset value prints nothing rather than a placeholder.
   */
  farm_name?: string | null;
  /**
   * The enterprise logo, as a downscaled data URL (see `resizeLogoForStorage`).
   *
   * Stored inline rather than in object storage because it is small, it is needed
   * synchronously by the jsPDF writer (which cannot await a fetch mid-document), and an
   * invoice must still render its letterhead offline. Unset means the app's own mark is
   * drawn instead — never an empty box, and never someone else's brand.
   */
  farm_logo?: string | null;
  skills?: string[] | null;
  showOnMap?: boolean;
  mapLat?: number | null;
  mapLon?: number | null;
  /**
   * Explicit, revocable opt-in for the farmer's own org staff (ngo/funder — never the farmer's
   * mentor, whose visibility predates this field and isn't gated by it) to see their
   * production/sales/course data on the NGO/funder dashboards. Absent or `granted: false` means
   * not opted in — this is opt-in, not opt-out, by design. The farmer owns this field and can
   * write it themselves (same as any other profile field except `role`/`org_id`); see the
   * settings toggle that sets it.
   */
  dataConsent?: {
    granted: boolean;
    grantedAt: string | null;
    revokedAt: string | null;
  };
}

/**
 * A funder org's standing permission to read one specific NGO org's data — the funder->many-NGOs
 * relationship a single `Profile.org_id` can't express on its own. Deterministic id
 * `${funder_org_id}_${ngo_org_id}` (mirrors `course_enrollments`' `${profile_id}_${track}`
 * pattern in `lib/course-enrollment.ts`), so a rule can check `exists()` on it directly without a
 * query. Admin-SDK-write-only: client-side rules deny all writes (see `firestore.rules`), created
 * via the platform admin panel (phase 2).
 */
export interface Grant {
  id: string;
  funder_org_id: string;
  ngo_org_id: string;
  created_at: string;
  created_by: string;
}

export interface Garden {
  id: string; programme_id: string | null; name: string; town: string | null;
  lat: number | null; lon: number | null; status: GardenStatus; supervisor_id: string | null; created_at: string;
  /**
   * Denormalised owning org — needed for the org-scoped `gardens` read rule (`sameOrg`/
   * `staffOrgAccess`) and for `listGardens()` to scope its query. Optional because gardens
   * written before this field existed have none (see scripts/backfill-org-id.mjs) — treat a
   * missing value the same as null, not as an error.
   */
  org_id?: string | null;
}

export interface GardenMember {
  id: string; garden_id: string; profile_id: string; plot: string | null; size_m2: number | null;
  lat: number | null; lon: number | null;
}

export interface ProductionLog {
  id: string; profile_id: string; garden_id: string | null; crop: string; kg: number;
  photo_url: string | null; logged_at: string; created_at: string;
}

export interface SalesLog {
  id: string; profile_id: string; garden_id: string | null; crop: string; kg: number;
  amount: number; buyer: string | null; sold_at: string; created_at: string;
  /** Present when this crop-sale row was generated from a paid invoice. */
  invoice_id?: string | null;
  invoice_line?: number | null;
}

export type ExpenseCategory = 'feed' | 'seed' | 'fuel' | 'equipment' | 'labour' | 'transport' | 'other';

export interface ExpenseLog {
  id: string; profile_id: string; garden_id: string | null; item: string;
  amount: number; supplier: string | null; spent_at: string; created_at: string;
  category?: ExpenseCategory | null;
  /** Optional: only tag a crop when this cost was genuinely for that crop. */
  crop?: string | null;
}

export interface Design {
  id: string; owner_id: string;
  /**
   * Denormalised from the owner's profile at save time — needed for the org-scoped staff read
   * rule. Optional because designs saved before this fix have no such field yet (see
   * scripts/backfill-org-id.mjs) — treat a missing value the same as null, not as an error.
   */
  org_id?: string | null;
  garden_id: string | null; title: string;
  data: Record<string, unknown>; shared_with: string | null; created_at: string;
  updated_at?: unknown;
}

export interface Report {
  id: string; owner_id: string; garden_id: string | null; title: string; content: string | null; lang: string; created_at: string;
}

export interface CourseProgress {
  id: string; profile_id: string;
  /**
   * Denormalised from the learner's profile at write time — needed for the org-scoped staff read
   * rule. Optional because rows written before this fix have no such field yet (see
   * scripts/backfill-org-id.mjs) — treat a missing value the same as null, not as an error.
   */
  org_id?: string | null;
  module: string; done: boolean; updated_at: string;
}

export interface MentorVisit {
  id: string; mentor_id: string; trainee_id: string;
  garden_id: string | null; notes: string; visited_at: string; created_at: string;
}

// Convenience view models the UI uses
export interface GardenerProfile {
  profile: Profile;
  member?: GardenMember; // optional: callers usually already hold it from listGardeners
  production: ProductionLog[];
  sales: SalesLog[];
  courses: CourseProgress[];
  /**
   * Whether this farmer has opted in to `dataConsent` — set even when the caller is an admin
   * (whose own reads bypass the consent gate, but the flag still reports the farmer's real
   * choice rather than always reading `true`). `getGardenerProfile()` uses this, not a caught
   * error code, to tell "not opted in yet" (expected, `production`/`sales`/`courses` come back
   * empty) apart from a genuine fetch failure (which still throws).
   */
  consented: boolean;
}

// ─── Surveys (NGO asks, farmer answers) ──────────────────────────────────────
export type SurveyQType = 'yesno' | 'choice' | 'text';
export interface SurveyQuestion { id: string; text: string; type: SurveyQType; options: string[] }
export interface Survey { id: string; org_name: string; title: string; questions: SurveyQuestion[]; created_by: string; created_at: string }
export interface SurveyResponse {
  id: string; survey_id: string; profile_id: string;
  /**
   * Denormalised from the responder's profile at write time — needed for the org-scoped staff
   * read rule. Optional because responses written before this fix have no such field yet (see
   * scripts/backfill-org-id.mjs) — treat a missing value the same as null, not as an error.
   */
  org_id?: string | null;
  answers: Record<string, string>; created_at: string;
}

// ─── Community layer (opt-in profiles, trade board, 1:1 messaging) ──────────
// All additive/new — none of this touches the Profile/Garden model above.
// Deliberately a separate doc from Profile.showOnMap/mapLat/mapLon, which
// stays org-internal and precise; this is cross-org, opt-in, and coarse.

export interface CommunityProfile {
  uid: string;
  display_name: string;
  area_text: string; // freeform town/district — never an exact address
  bio: string;
  crops: string[];
  photos: string[]; // up to 4, via the existing uploadPhoto('community') pipeline
  show_on_map: boolean;
  coarse_lat: number | null; // rounded/jittered to ~1km, computed client-side before write
  coarse_lon: number | null;
  updated_at?: unknown;
}

export type BoardCategory = 'seed' | 'seedlings' | 'produce' | 'tools' | 'other';
export type BoardKind = 'have' | 'want' | 'free';
export type BoardStatus = 'active' | 'closed';

export interface BoardPost {
  id: string;
  owner_id: string;
  owner_name: string; // denormalised at post time
  category: BoardCategory;
  kind: BoardKind;
  description: string;
  photo_url?: string | null;
  area_text: string;
  coarse_lat?: number | null;
  coarse_lon?: number | null;
  status: BoardStatus;
  created_at?: unknown;
}

export interface MessageThread {
  id: string;
  participants: string[]; // exactly 2 uids
  participant_names: Record<string, string>;
  last_message: string;
  last_message_at?: unknown;
  created_at?: unknown;
}

export interface ThreadMessage {
  id: string;
  sender_id: string;
  body: string;
  created_at?: unknown;
}

export type CommunityReportTargetType = 'profile' | 'board_post' | 'message';

export interface CommunityReport {
  id: string;
  reporter_id: string;
  target_type: CommunityReportTargetType;
  target_id: string;
  target_owner_id: string;
  reason: string;
  created_at?: unknown;
}

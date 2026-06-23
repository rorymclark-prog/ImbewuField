// ImbewuField data types — mirror the Postgres schema in supabase/schema.sql.
// These are the contract the UI + data-access layer build against.

export type UserRole = 'farmer' | 'supervisor' | 'trainer' | 'student' | 'ngo' | 'funder' | 'admin';
export type GardenStatus = 'thriving' | 'establishing' | 'support';

export interface Organization { id: string; name: string; kind: 'ngo' | 'funder'; created_at: string }

export interface Programme {
  id: string; org_id: string; name: string; funder: string | null; deployed_amount: number | null; created_at: string;
}

export interface Profile {
  id: string; full_name: string | null; role: UserRole; org_id: string | null;
  language: string; id_number: string | null; phone: string | null; photo_url: string | null; created_at: string;
}

export interface Garden {
  id: string; programme_id: string | null; name: string; town: string | null;
  lat: number | null; lon: number | null; status: GardenStatus; supervisor_id: string | null; created_at: string;
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
}

export interface Design {
  id: string; owner_id: string; garden_id: string | null; title: string;
  data: Record<string, unknown>; shared_with: string | null; created_at: string;
}

export interface Report {
  id: string; owner_id: string; garden_id: string | null; title: string; content: string | null; lang: string; created_at: string;
}

export interface SavedPlaceRow {
  id: string; profile_id: string; name: string; lat: number; lon: number;
  biome: string | null; rainfall: number | null; elevation: number | null; notes: string | null; created_at: string;
}

export interface CourseProgress { id: string; profile_id: string; module: string; done: boolean; updated_at: string }

export interface TrainerVisit {
  id: string; trainer_id: string; trainee_id: string;
  garden_id: string | null; notes: string; visited_at: string; created_at: string;
}

// Convenience view models the UI uses
export interface GardenerProfile {
  profile: Profile;
  member?: GardenMember; // optional: callers usually already hold it from listGardeners
  production: ProductionLog[];
  sales: SalesLog[];
  courses: CourseProgress[];
}

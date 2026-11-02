/** Read-only projections reference the existing books; they never become a second ledger. */
export type EvidenceAuthority = 'production-records' | 'farm-records' | 'task-board' | 'field-journal' | 'invoices' | 'programme-evidence' | 'mel';
export type EvidenceKind = 'harvest' | 'food-use' | 'payment' | 'cost' | 'planting' | 'survival' | 'practice' | 'soil-observation' | 'sale' | 'participation';
export type ProjectType = 'food-security' | 'livelihoods' | 'agroforestry' | 'agroecology' | 'market-garden';
export type EvidenceLevel = 'participation' | 'output' | 'outcome';
export type EvidenceReference = { authority: EvidenceAuthority; id: string };

export interface ProjectEvidence {
  reference: EvidenceReference;
  projectId: string;
  siteId: string;
  kind: EvidenceKind;
  level: EvidenceLevel;
  basis: 'actual' | 'estimate';
  provenance: 'source-record' | 'fictional-demo';
  /** Inclusive local dates. Monthly production cannot be split into invented daily observations. */
  periodStart: string;
  periodEnd: string;
  recordedOn: string;
  stage: 'baseline' | 'follow-up' | 'current';
  quantity: number | null;
  unit: string;
  currency?: string;
  denominator?: number | null;
  /** A population/cohort code, never participant names or private free text. */
  population?: string;
  method?: string;
  consent: 'granted' | 'withheld' | 'unknown';
  published: boolean;
}

export interface ProjectIndicator {
  id: string;
  existingProgrammeTemplateId?: string;
  title: string;
  definition: string;
  unit: string;
  kind: EvidenceKind;
  level: EvidenceLevel;
  authorities: readonly EvidenceAuthority[];
  aggregation: 'sum' | 'latest' | 'ratio' | 'change';
  requirements: { baseline: boolean; followUp: boolean; denominator: boolean; method: boolean };
  evidenceNeeded: string;
  limits: string;
}

export interface ProjectTemplate {
  id: ProjectType;
  title: string;
  objective: string;
  readiness: 'workflow-reference';
  owner: 'grower';
  supportRoles: readonly string[];
  steps: readonly { title: string; action: string; authority: EvidenceAuthority; review: string }[];
  indicators: readonly ProjectIndicator[];
  limits: readonly string[];
}

export interface ProjectReviewContext {
  projectId: string;
  siteId: string;
  periodStart: string;
  periodEnd: string;
  /** Submission cutoff and event end are separate; neither is inferred from today's clock. */
  cutoffDate: string;
  timeZone: string;
  audience: 'grower-review' | 'publication';
  allowDemo: boolean;
  currency?: string;
  measurementUnit?: string;
}

export interface IndicatorReview {
  indicatorId: string;
  state: 'reported' | 'incomplete' | 'unavailable';
  /** Null means no complete result. Known partial evidence is shown separately. */
  value: number | null;
  knownSubtotal: number | null;
  unit: string;
  currency: string | null;
  accepted: EvidenceReference[];
  rejected: { reference: EvidenceReference; reasons: string[] }[];
  gaps: string[];
  baseline: number | null;
  followUp: number | null;
  interpretation: string;
}

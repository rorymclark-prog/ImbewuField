import type { CropPlanState } from './crop-plan';
import type { Profile } from './db/types';
import { buildGreenHorizonChardTarget, buildGreenHorizonCropPlan, buildGreenHorizonLettuceTarget,
  buildGreenHorizonWeeklyPracticeDraft } from './green-horizon-demo';
import type { GrowerPlanningProfile } from './international/grower-planning';
import type { GrowerWorkflowDraft } from './international/grower-workflow';
import type { SellerLetterhead } from './invoice-seller';
import { RIVIER_UITSIG_SITE, RIVIER_UITSIG_SITE_ID } from './rivier-uitsig-layout';
import type { SavedPlace } from './saved-places';

const TIMESTAMP = '2026-11-02T08:00:00.000Z';
const practiceId = (id: string) => id.replace(/^green-horizon-/, 'rivier-uitsig-');
const practiceBeds = ['rivier-uitsig-bed-a01', 'rivier-uitsig-bed-b01'];

/** Reuse the existing exercise inputs. Only the map layout comes from Rivier Uitsig. */
export function buildRivierUitsigCropPlan(): CropPlanState {
  const exercise = buildGreenHorizonCropPlan();
  return {
    version: 1,
    updatedAt: exercise.updatedAt,
    plantings: [],
    harvestTargets: [buildGreenHorizonLettuceTarget(), buildGreenHorizonChardTarget()].map(target => ({
      ...target, id: practiceId(target.id), siteId: RIVIER_UITSIG_SITE_ID,
    })),
    growerPlanningProfiles: (exercise.growerPlanningProfiles ?? []).map(profile => ({
      ...profile,
      profileId: practiceId(profile.profileId),
      scope: { kind: 'mapped-site', siteId: RIVIER_UITSIG_SITE_ID },
      inputs: Object.fromEntries(Object.entries(profile.inputs).map(([key, input]) => [
        key, input.state === 'provided'
          ? { ...input, provenance: { ...input.provenance, note: 'Fictional practice input reused from the Green Horizon exercise.' } }
          : input,
      ])) as GrowerPlanningProfile['inputs'],
    })),
  };
}

export function buildRivierUitsigPlanningDraft(): GrowerWorkflowDraft {
  const exercise = buildGreenHorizonWeeklyPracticeDraft();
  return {
    ...exercise,
    targetProfiles: exercise.targetProfiles.map(reference => ({
      targetId: practiceId(reference.targetId), profileId: practiceId(reference.profileId),
    })),
    available: exercise.available.map((row, index) => ({ ...row, bedId: practiceBeds[index] })),
  };
}

export function buildRivierUitsigSavedPlace(): SavedPlace {
  return {
    ...RIVIER_UITSIG_SITE, id: 'rivier-uitsig-practice-place', label: 'field',
    biome: 'Practice layout', elevation: null, savedAt: TIMESTAMP,
    notes: 'The editable practice map uses a synthetic anchor and an approximate traced layout.',
  };
}

export function buildRivierUitsigProfile(): Profile {
  return {
    id: 'rivier-uitsig-practice-grower', full_name: 'Rivier Uitsig practice grower', role: 'farmer', org_id: null,
    language: 'en', id_number: null, phone: null, photo_url: null, created_at: TIMESTAMP,
    farm_name: RIVIER_UITSIG_SITE.name, farm_logo: null, showOnMap: false,
    bio: 'Practice workspace with a scale-referenced layout and fictional crop plans.',
  };
}

export function buildRivierUitsigLetterhead(): SellerLetterhead {
  return {
    address: '', email: '', taxNumber: '', bankName: '', bankAccountName: '', bankAccountNumber: '',
    bankBranchCode: '', paymentTermsDays: null, notes: 'Practice document only. Do not pay.',
  };
}

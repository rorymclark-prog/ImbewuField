import { DEMO_SITE, buildDemoSavedPlace } from './demo-farm';
import type { SiteSurvey } from './site-survey';
import type { ReportSection } from './programme-report-pdf';

export const SAMPLE_FARM_SITE_ID = `site:${DEMO_SITE.lat.toFixed(5)},${DEMO_SITE.lon.toFixed(5)}`;
export const SAMPLE_PHOTOS = [
  { src: '/demo/aerial.webp', caption: 'AI-generated example garden aerial. Not a satellite image or photograph of Ubhejane.' },
  { src: '/demo/harvest.webp', caption: 'AI-generated example harvest. Not evidence of the real garden\'s production.' },
] as const;

export function freshSampleAssessment(): SiteSurvey {
  return { siteId: SAMPLE_FARM_SITE_ID, placeId: buildDemoSavedPlace().id, savedAt: '2026-09-01T09:00:00Z',
    siteType: 'community', adults: '6-10', memberCount: 'under-20', goals: ['food','education','soil'],
    waterSource: ['municipal','rainwater'], waterDelivery: ['bucket'], waterStorage: ['jojo'],
    roofMainM2: 120, roofSecondaryM2: 20, hasGutters: true, roofAreaSource: 'manual', roofSecondarySource: 'manual',
    landPrepMethod: 'hand', soilCondition: 'compacted', soilAmendments: ['compost','mulch'], hasFencing: 'full',
    existingCrops: ['vegetables','fruit-trees'], existingGrowingAreaM2: 128, existingGrowingAreaSource: 'manual',
    livestock: ['none'], otherInfra: ['compost-bay'], farmingPractice: 'mostly-organic', challenges: ['water'],
    isCommercial: true, marketType: 'local-market', reportedProduction: [],
    notes: 'FICTIONAL TRAINING EXAMPLE. These answers and areas demonstrate the form; they are not observations at the real Ubhejane Crèche.' };
}

export interface SampleFarmPack {
  photos?: {image:string;caption:string}[];
  coordinator: string; visitDate: string; mentorNotes: string;
  household: { code: string; adults: number; children: number; water: string; food: string; priority: string; followUp: string };
  soil: { reference: string; sampledOn: string; ph: number; texture: string; note: string };
}
export function freshSampleFarmPack(): SampleFarmPack {
  return { coordinator: 'Nomvula Dlamini (fictional)', visitDate: '2026-09-01',
    mentorNotes: 'Example visit completed: reviewed bed labels and the water supply. Follow up on the damaged gutter and record the next harvest together.',
    household: { code: 'DEMO-HH-001', adults: 2, children: 3, water: 'Shared municipal tap; supply interrupted some days.',
      food: 'Example respondent reports vegetables from the garden supplement purchased staple foods.',
      priority: 'More reliable access to fresh vegetables.', followUp: 'Review household feedback at the next mentor visit.' },
    soil: { reference: 'DEMO-SOIL-001 — NOT A LAB CERTIFICATE', sampledOn: '2026-08-15', ph: 6.2, texture: 'Illustrative sandy loam',
      note: 'Invented values for demonstrating evidence capture only. No real sample was tested; do not use these values for fertiliser or planting decisions.' } };
}

export function sampleFarmSections(pack: SampleFarmPack, assessment: SiteSurvey): ReportSection[] {
  return [
    { title: 'Provenance and saved site', lines: [`${DEMO_SITE.name} sample workspace. Real map location, fictional layout and records.`,
      `Map reference: ${DEMO_SITE.lat}, ${DEMO_SITE.lon}. Generated photos do not depict this location.`,
      `Example coordinator: ${pack.coordinator}. Visit: ${pack.visitDate}.`,
      'This evidence pack accompanies the editable design, crop plan and records. It is not the full agronomic site report or a verified project return.'] },
    { title: 'Site assessment — current sample answers', lines: [`Site type: ${assessment.siteType}; goals: ${assessment.goals.join(', ')}.`,
      `Water: ${assessment.waterSource.join(', ')}; delivery: ${assessment.waterDelivery.join(', ')}; storage: ${assessment.waterStorage.join(', ')}.`,
      `Roof areas: ${assessment.roofMainM2 ?? 'not recorded'} + ${assessment.roofSecondaryM2 ?? 'not recorded'} m2.`,
      `Soil condition: ${assessment.soilCondition}; amendments: ${assessment.soilAmendments.join(', ')}; fencing: ${assessment.hasFencing}.`,
      `Growing area: ${assessment.existingGrowingAreaM2 ?? 'not recorded'} m2; crops: ${assessment.existingCrops.join(', ')}.`,
      `Challenges: ${assessment.challenges.join(', ')}. ${assessment.notes}`] },
    { title: 'Completed fictional household interview', lines: [`${pack.household.code}: ${pack.household.adults} adults, ${pack.household.children} children. No real household is represented.`,
      `Water access: ${pack.household.water}`, `Food access: ${pack.household.food}`, `Priority: ${pack.household.priority}`, `Follow-up: ${pack.household.followUp}`] },
    { title: 'Illustrative soil result — not a laboratory certificate', lines: [pack.soil.reference, `Example date: ${pack.soil.sampledOn}; pH: ${pack.soil.ph}; texture: ${pack.soil.texture}.`, pack.soil.note] },
    { title: 'Mentor visit and agreed follow-up', lines: [pack.mentorNotes] },
  ];
}

'use client';
import { getSampleWorkspace } from './sample-mode';
import { loadSurvey, saveSurvey } from './site-survey';
import { freshSampleAssessment, SAMPLE_FARM_SITE_ID } from './sample-farm-pack';

/** Seed once, then preserve the visitor's answers between tour stops. */
export function prepareSampleFarm() {
  if (getSampleWorkspace() !== 'ubhejane') throw Error('Open the Ubhejane sample before preparing its farm.');
  const existing = loadSurvey(SAMPLE_FARM_SITE_ID);
  if (existing) return existing;
  const saved = saveSurvey(freshSampleAssessment());
  if (!saved) throw Error('The tour assessment could not be prepared. Please allow browser storage.');
  return saved;
}

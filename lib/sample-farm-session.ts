'use client';
import { isSampleMode } from './sample-mode';
import { loadSurvey, saveSurvey } from './site-survey';
import { freshSampleAssessment, SAMPLE_FARM_SITE_ID } from './sample-farm-pack';

/** Seed once, then preserve the visitor's answers between tour stops. */
export function prepareSampleFarm() {
  if (!isSampleMode()) throw Error('Open a sample before preparing its farm.');
  const existing = loadSurvey(SAMPLE_FARM_SITE_ID);
  if (existing) return existing;
  const saved = saveSurvey(freshSampleAssessment());
  if (!saved) throw Error('The sample assessment could not be prepared. Please allow browser storage.');
  return saved;
}

'use client';
import { useEffect, useState } from 'react';
import { loadCanvasState, DESIGN_CANVAS_CHANGED_EVENT } from '@/lib/design-canvas';
import { loadCropPlan, CROP_PLAN_CHANGED_EVENT } from '@/lib/crop-plan';
import { collectReportCropSnapshot } from '@/lib/report-site-facts-collect';
import type { ReportProductionYear } from '@/lib/report-crop-plan';
import type { SiteSurvey } from '@/lib/site-survey';
import type { LocationData } from '@/lib/types';
import ProductionYearOverview from './report/ProductionYearOverview';

export default function SiteSurveyProductionYear({ survey, location, language }: { survey: SiteSurvey; location?: LocationData; language: string }) {
  const [production, setProduction] = useState<ReportProductionYear>();
  useEffect(() => {
    const refresh = () => {
      const canvas = loadCanvasState(survey.siteId);
      setProduction(canvas ? collectReportCropSnapshot(canvas, loadCropPlan(), survey.siteId, new Date(), location, survey).annualProduction : undefined);
    };
    refresh();
    window.addEventListener(DESIGN_CANVAS_CHANGED_EVENT, refresh); window.addEventListener(CROP_PLAN_CHANGED_EVENT, refresh); window.addEventListener('focus', refresh);
    return () => { window.removeEventListener(DESIGN_CANVAS_CHANGED_EVENT, refresh); window.removeEventListener(CROP_PLAN_CHANGED_EVENT, refresh); window.removeEventListener('focus', refresh); };
  }, [survey, location]);
  return <><ProductionYearOverview production={production} language={language}/><p><a href={`/facilitator/crops?canvasSite=${encodeURIComponent(survey.siteId)}`} target="_blank" rel="noopener noreferrer">Open this site's production plan to record product choices, planting ages and local picking months</a></p></>;
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n';
import { fieldApi } from '@/lib/field-api';
import { fieldDataReportNote } from '@/lib/field-request-model';
import { isSampleMode } from '@/lib/sample-mode';
import { sampleRead } from '@/lib/sample-operations';
import { validEvidenceDate, completeSampleEvidence, freshEvidenceData, type ProgrammeBranding, type ProgrammeMilestone } from '@/lib/programme-evidence';
import { analyseAssessment, compareAssessmentMeasures, compatibleMelStages } from '@/lib/mel';
import { MEL_TEMPLATES } from '@/lib/mel-templates';
import { sampleAssessments, samplePublishedAssessments } from '@/lib/sample-programme';
import { localTodayISODate } from '@/lib/field-teams';
import { buildMelEvidenceReport, MEL_STAGE_LABELS, type MelReportAssessment, type MelReportAnalysis } from '@/lib/mel-report';
import { readSampleProgramme } from './SampleProgramme';
import ReportComposer from './ReportComposer';
import styles from './MelDashboard.module.css';
import reports from './ProgrammeReports.module.css';
import { UserFacingError, userFacingMessage } from '@/lib/user-facing-error';

type EvidenceSources = { assessments: MelReportAssessment[]; milestones: ProgrammeMilestone[]; assessmentSource: boolean; milestoneSource: boolean; branding?: ProgrammeBranding; notes: string[]; errors: string[] };
export default function MelEvidenceReport({ orgId, organisation, funder, sample }: { orgId: string; organisation: string; funder: boolean; sample: boolean }) {
  const { lang } = useLanguage();
  const ui = (en: string, zu: string) => lang === 'zu' ? zu : en;
  const today = localTodayISODate();
  const [data, setData] = useState<EvidenceSources | null>(null), [reload, setReload] = useState(0);
  const [project, setProject] = useState(''), [asOf, setAsOf] = useState(today), [selectedId, setSelectedId] = useState(''), [beforeId, setBeforeId] = useState('');
  const [comparisonAsOf,setComparisonAsOf]=useState(''),[donorName,setDonorName]=useState(''),[donorReference,setDonorReference]=useState<'none'|'sef'>('none');
  const validDates=validEvidenceDate(asOf) && asOf<=today && (!comparisonAsOf || validEvidenceDate(comparisonAsOf) && comparisonAsOf<asOf);
  const [analysis, setAnalysis] = useState<MelReportAnalysis | null>(null), [analysisError, setAnalysisError] = useState('');
  useEffect(() => {
    let cancelled = false; setData(null); setAnalysis(null); setAnalysisError('');
    if (sample) {
      const controls = readSampleProgramme(), evidence = completeSampleEvidence(isSampleMode() ? sampleRead('programme-evidence', freshEvidenceData) : freshEvidenceData());
      const available = !funder || controls.funderAccess;
      const assessments = !available ? [] : funder ? samplePublishedAssessments(controls) : sampleAssessments(controls).map(({ assessment, rows }) => ({ ...assessment, ...analyseAssessment(assessment, MEL_TEMPLATES[assessment.stage], rows) }));
      setData({ assessments, milestones: available ? evidence.milestones.filter(milestone => !funder || milestone.published) : [], branding: evidence.branding, assessmentSource: available, milestoneSource: available, notes: [], errors: available ? [] : ['The organisation has switched off funder access.'] });
      return;
    }
    if (!orgId) return;
    void (async () => {
      const query = `org=${encodeURIComponent(orgId)}`;
      const [assessmentResult, milestoneResult] = await Promise.allSettled([fieldApi(`/api/assessments?${query}${funder ? '&mode=published' : ''}`), fieldApi(`/api/programme-evidence?${query}`)]);
      if (cancelled) return;
      const assessmentData = assessmentResult.status === 'fulfilled' ? assessmentResult.value : null, milestoneData = milestoneResult.status === 'fulfilled' ? milestoneResult.value : null;
      const assessmentSource = Boolean(assessmentData && (funder || assessmentData.permissions?.analyse)), milestoneSource = Boolean(milestoneData && !milestoneData.brandingOnly);
      setData({ assessments: assessmentSource ? assessmentData.assessments.map((assessment: MelReportAssessment) => ({ ...assessment, published: funder ? true : assessment.published })) : [], milestones: milestoneSource ? milestoneData.milestones : [], branding: milestoneData?.branding, assessmentSource, milestoneSource,
        notes: [["Assessment register", assessmentData], ["Milestone register", milestoneData]].flatMap(([source, payload]) => { const note = fieldDataReportNote(payload); return note ? [`${source}: ${note}`] : []; }),
        errors: [!assessmentSource ? 'Assessment analysis is unavailable or not enabled for this account.' : '', !milestoneSource ? 'Programme milestone evidence is unavailable for this account.' : ''].filter(Boolean) });
    })();
    return () => { cancelled = true; };
  }, [orgId, sample, funder, reload]);
  const assessments = data?.assessments.filter(assessment => !project || assessment.project === project) || [];
  const selected = assessments.find(assessment => assessment.id === selectedId);
  const earlier = selected ? assessments.filter(assessment => assessment.project === selected.project && typeof assessment.version === 'number' && assessment.version === selected.version && compatibleMelStages(assessment.stage, selected.stage) && (!funder || assessment.state === 'closed' && selected.state === 'closed')) : [];
  const selectionKey = `${selectedId}:${beforeId}`;
  useEffect(() => {
    let cancelled = false; setAnalysis(null); setAnalysisError('');
    if (!data || !selected) return;
    if (beforeId && !earlier.some(assessment => assessment.id === beforeId)) { setAnalysisError('The selected earlier assessment is unavailable or incompatible. Choose it again; the report has not widened.'); return; }
    if (sample) {
      const controls = readSampleProgramme(), all = sampleAssessments(controls), after = all.find(record => record.assessment.id === selected.id), before = all.find(record => record.assessment.id === beforeId);
      if (!after || funder && (!controls.funderAccess || !controls.published.includes(after.assessment.id) || beforeId && (!before || !controls.published.includes(before.assessment.id)))) { setAnalysisError('Selected assessment evidence is not available in this scope.'); return; }
      const summary = analyseAssessment(after.assessment, MEL_TEMPLATES[after.assessment.stage], after.rows, funder);
      setAnalysis({ assessmentId: selected.id, beforeId, metrics: summary.metrics, assigned: summary.assigned, completed: summary.completed, comparison: before ? compareAssessmentMeasures(before.assessment, after.assessment, MEL_TEMPLATES[before.assessment.stage], MEL_TEMPLATES[after.assessment.stage], before.rows, after.rows, funder) : null });
      return;
    }
    void (async () => {
      try {
        if (funder && !beforeId) { if (!selected.metrics) throw new UserFacingError('Published assessment findings are unavailable.'); setAnalysis({ assessmentId: selected.id, beforeId, metrics: selected.metrics, assigned: selected.assigned, completed: selected.completed, comparison: null }); return; }
        const result = await fieldApi(`/api/assessments?org=${encodeURIComponent(orgId)}&mode=${funder ? 'published' : 'analysis'}&id=${encodeURIComponent(selected.id)}${beforeId ? `&compare=${encodeURIComponent(beforeId)}` : ''}`);
        if (cancelled) return;
        setAnalysis({ assessmentId: selected.id, beforeId, metrics: funder ? selected.metrics || [] : result.metrics, assigned: funder ? selected.assigned : result.assigned, completed: funder ? selected.completed : result.completed, comparison: result.comparison, notes: fieldDataReportNote(result) ? [`Assessment findings: ${fieldDataReportNote(result)}`] : [] });
      } catch (error) { if (!cancelled) setAnalysisError(userFacingMessage(error, 'Selected assessment findings are unavailable.')); }
    })();
    return () => { cancelled = true; };
    // Source refreshes and the explicit IDs own this request. Project changes clear
    // both IDs synchronously; a response for an older pair is discarded above.
  }, [data, selectionKey, sample, funder, orgId]); // eslint-disable-line react-hooks/exhaustive-deps
  const projects = [...new Set([...(data?.assessments.map(assessment => assessment.project) || []), ...(data?.milestones.map(milestone => milestone.project) || [])])].sort();
  const readyAnalysis = analysis?.assessmentId === selectedId && analysis.beforeId === beforeId ? analysis : null;
  const donors=[...new Set((data?.milestones || []).filter(m=>(!project || m.project===project) && (!funder || m.published)).flatMap(m=>m.donor?[m.donor.funder]:[]))].sort();
  const report = data && validDates ? buildMelEvidenceReport({ organisation, project, funder, sample, today, asOf, comparisonAsOf, donorName, donorReference, assessments: data.assessments, milestones: data.milestones, assessmentSource: data.assessmentSource, milestoneSource: data.milestoneSource, selectedId, beforeId, analysis: readyAnalysis, sourceNotes: data.notes }) : null;
  if (!orgId && !sample) return <div className={reports.state} role="status">Choose an authorised organisation to review its MEL evidence.</div>;
  return <section aria-label="MEL evidence workspace">
    <header className={reports.intro}><div><p className={reports.eyebrow}>MONITORING, EVALUATION & LEARNING</p><h2>{ui('Evidence, change & learning', 'Ubufakazi, ushintsho nokufunda')}</h2><p>{ui('Bring agreed indicators and assessment evidence into the same review, keeping their populations and dates explicit.', 'Hlanganisa izinkomba okuvunyelwene ngazo nobufakazi bokuhlola, ucacise abantu nezinsuku ezithintekayo.')}</p></div></header>
    {!data ? <p role="status" className={reports.state}>{ui('Loading authorised MEL evidence…', 'Kusalayishwa ubufakazi be-MEL obugunyaziwe…')}</p> : <>
      {data.errors.map(error => <p role="alert" className={styles.error} key={error}>{error}</p>)}
      <section className={reports.scope} aria-label="MEL report scope"><div className={reports.filters}>
        <label>{ui('Project', 'Iphrojekthi')}<select value={project} onChange={event => { setProject(event.target.value); setDonorName(''); setSelectedId(''); setBeforeId(''); setAnalysis(null); }}><option value="">All visible projects</option>{projects.map(value => <option key={value} value={value}>{value}</option>)}{project && !projects.includes(project) && <option value={project}>Selected project · no visible records</option>}</select></label>
        <label>{ui('Milestone evidence date', 'Usuku lobufakazi bezinkomba')}<input type="date" max={today} value={asOf} onChange={event => setAsOf(event.target.value)} /></label>
        <div className={reports.fixedValue}><button type="button" onClick={() => { setData(null); setReload(value => value + 1); }}>{ui('Refresh evidence', 'Vuselela ubufakazi')}</button></div>
        <label>Earlier milestone cutoff · optional<input type="date" max={asOf} value={comparisonAsOf} onChange={event=>setComparisonAsOf(event.target.value)}/></label>
        <label>Indicator donor<select value={donorName} onChange={event=>setDonorName(event.target.value)}><option value="">All visible indicator donors</option>{donors.map(name=><option key={name} value={name}>{name}</option>)}{donorName&&!donors.includes(donorName)&&<option value={donorName}>Selected donor · no visible indicators</option>}</select></label>
        <label>Donor reporting reference<select value={donorReference} onChange={event=>setDonorReference(event.target.value as 'none'|'sef')}><option value="none">No additional reference</option><option value="sef">IDC / SEF · public May 2025 guidance</option></select></label>
      </div><p>Donor filters apply to linked milestone definitions only. Assessment scope is unchanged. Record donor codes, agreement, measurement period and population in Indicators &amp; targets. The public reference must be checked against your signed agreement.</p><div className={reports.months}>
        <label>{ui('Assessment findings', 'Okutholakele ekuhloleni')}<select value={selectedId} disabled={!data.assessmentSource} onChange={event => { setSelectedId(event.target.value); setBeforeId(''); setAnalysis(null); }}><option value="">Choose an assessment</option>{assessments.map(assessment => <option key={assessment.id} value={assessment.id}>{assessment.title} · {MEL_STAGE_LABELS[assessment.stage]}</option>)}{selectedId && !selected && <option value={selectedId}>Selected assessment · unavailable</option>}</select></label>
        <label>{ui('Compare with', 'Qhathanisa nokuthi')}<select value={beforeId} disabled={!selected || !earlier.length} onChange={event => { setBeforeId(event.target.value); setAnalysis(null); }}><option value="">No matched comparison</option>{earlier.map(assessment => <option key={assessment.id} value={assessment.id}>{assessment.title}</option>)}{beforeId && !earlier.some(assessment => assessment.id === beforeId) && <option value={beforeId}>Selected earlier assessment · unavailable</option>}</select></label>
      </div><p>{ui('Milestones use the selected observation cutoff. Assessment answers and action status remain current snapshots. Each measure shows its own coverage.', 'Izinkomba zisebenzisa usuku olukhethiwe. Izimpendulo zokuhlola nezimo zezenzo zisebenzisa amarekhodi amanje. Isilinganiso ngasinye sibonisa ububanzi baso.')}</p></section>
      {analysisError ? <div role="alert" className={reports.state}><p>{analysisError}</p><button type="button" onClick={() => setReload(value => value + 1)}>Retry evidence</button></div> : !validDates ? <p role="alert" className={reports.state}>Choose a valid milestone evidence date on or before today and an earlier comparison cutoff, or leave the comparison blank.</p> : selectedId && (!selected || !readyAnalysis) ? <p role="status" className={reports.state}>{selected ? 'Loading the selected assessment…' : 'The selected assessment is no longer available. Choose an assessment to continue.'}</p> : report && <ReportComposer aggregate key={`${project}:${asOf}:${comparisonAsOf}:${donorName}:${donorReference}:${selectionKey}`} title={report.title} reportLabel="MEL evidence" sample={sample} funder={funder} orgId={orgId} branding={data.branding} reportDate={today} filenameBase={report.filename} subtitle={report.scope} metrics={report.metrics} tables={report.tables} sections={report.sections} />}
      <div className={reports.nextReview}><div><h3>{ui('Turn findings into the next decision', 'Sebenzisa okutholakele ukwenza isinqumo esilandelayo')}</h3><p>Use the existing assessment and milestone workspaces to record the agreed action, owner, date and evidence.</p></div><div><Link className={styles.secondary} href={selected ? `/assessments?assessment=${encodeURIComponent(selected.id)}&org=${encodeURIComponent(orgId)}` : '/assessments'}>Review assessment evidence</Link></div></div>
    </>}
  </section>;
}

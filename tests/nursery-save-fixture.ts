import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as crop from '../lib/crop-plan.ts';
import * as account from '../lib/account-local-storage.ts';
import * as samples from '../lib/sample-mode.ts';
import { getFirebase, isBackendConfigured } from '../lib/firebase/init';
import * as receipts from '../lib/nursery-save-receipt.ts';
import { sanitiseNurserySettings, type NurserySettings } from '../lib/nursery-settings.ts';

const page = ts.createSourceFile('page.tsx', readFileSync(new URL('../app/facilitator/crops/page.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['plannerActorIsCurrent', 'growerActorIsCurrent', 'rememberStoredPlan', 'saveScopedGrowerInputs', 'saveNurserySettings', 'saveHarvestTargets'];
const bodies = new Map<string, string>();
function inspect(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.body && node.name && names.includes(node.name.text)) bodies.set(node.name.text, node.getText(page));
  ts.forEachChild(node, inspect);
}
inspect(page); assert.equal(bodies.size, names.length);
const code = ts.transpileModule([...bodies.values()].join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;

/** Caller installs its isolated browser and initializes the real canonical book.
 * This fixture controls React setters only: actor checks, scoped merge, admission,
 * real persistence and acknowledgment readback execute the production handlers. */
function createSharedSaveFixture(siteId: string) {
  const loaded = crop.loadCropPlanWithWriteAdmission(); assert.equal(loaded.admission.status, 'ready');
  const owner = account.activeAccountUid(), sample = samples.isSampleMode();
  const state: any = { plan: loaded.book, planWriteBase: { current: { owner, sample, token: loaded.token, planKey: JSON.stringify(loaded.book), admission: loaded.admission } },
    nurseryProducerLive: { current: { plan: loaded.book, conflict: false } }, nurserySaveContext: null, harvestSaveContext: null,
    planSaveConflict: false, planSaveFailed: false, growerOwner: owner, growerSample: sample, productionSiteId: siteId, growerScopeKey: 'fixture-mapped-source',
    growerBookContext: { current: { owner, sample, siteId, scopeKey: 'fixture-mapped-source' } }, saveTimer: { current: null }, clearTimeout() {},
    activeAccountUid: account.activeAccountUid, isSampleMode: samples.isSampleMode, isBackendConfigured, getFirebase,
    loadCropPlanWithWriteAdmission: crop.loadCropPlanWithWriteAdmission, cropPlanWriteAdmissionMatches: crop.cropPlanWriteAdmissionMatches,
    cropPlanWriteCandidateIsLossless: crop.cropPlanWriteCandidateIsLossless, cropPlanWriteToken: crop.cropPlanWriteToken,
    saveCropPlanWithReceipt: crop.saveCropPlanWithReceipt, sanitiseNurserySettings, sanitiseHarvestTargets: crop.sanitiseHarvestTargets,
    beginNurserySaveRequest: receipts.beginNurserySaveRequest, commitNurserySaveRequest: receipts.commitNurserySaveRequest, readNurserySaveConfirmation: receipts.readNurserySaveConfirmation,
    harvestTargetsSourceKey: receipts.harvestTargetsSourceKey, beginHarvestSaveRequest: receipts.beginHarvestSaveRequest, commitHarvestSaveRequest: receipts.commitHarvestSaveRequest, readHarvestSaveConfirmation: receipts.readHarvestSaveConfirmation,
    setPlan(value: crop.CropPlanState) { state.plan = value; }, setPlanSaveConflict(value: boolean) { state.planSaveConflict = value; }, setPlanSaveFailed(value: boolean) { state.planSaveFailed = value; } };
  const methods = Function('state', `with(state){${code};return {${names.join(',')}};}`)(state);
  const authority = receipts.createNurserySaveAuthority({ siteId, scopeKey: state.growerScopeKey,
    current: () => ({ book: state.nurseryProducerLive.current.plan, base: state.planWriteBase.current }),
    isCurrent: () => !state.planSaveConflict && methods.growerActorIsCurrent() });
  assert.ok(authority); state.nurserySaveAuthority = authority;
  function refreshContexts() {
    state.nurserySaveContext = receipts.createNurserySaveContext(state.nurserySaveAuthority);
    state.harvestSaveContext = receipts.createHarvestSaveContext(state.nurserySaveAuthority);
    assert.ok(state.nurserySaveContext); assert.ok(state.harvestSaveContext);
  }
  refreshContexts();
  return { state,
    nurseryContext: () => state.nurserySaveContext as receipts.NurserySaveContext,
    harvestContext: () => state.harvestSaveContext as receipts.HarvestSaveContext,
    reissueNurseryContext() { refreshContexts(); return state.nurserySaveContext as receipts.NurserySaveContext; },
    reissueHarvestContext() { refreshContexts(); return state.harvestSaveContext as receipts.HarvestSaveContext; },
    submitNursery(next: NurserySettings, request?: receipts.NurserySaveRequest): receipts.NurserySaveResult {
      const result = methods.saveNurserySettings(next, request);
      if (result?.status === 'confirmed') refreshContexts();
      return result;
    },
    submitHarvest(next: crop.HarvestTarget[], request?: receipts.HarvestSaveRequest): receipts.HarvestSaveResult {
      const result = methods.saveHarvestTargets(next, request);
      if (result?.status === 'confirmed') refreshContexts();
      return result;
    },
    dispose() { receipts.revokeNurserySaveAuthority(state.nurserySaveAuthority); if (state.nurserySaveAuthority !== authority) receipts.revokeNurserySaveAuthority(authority); } };
}

export function createNurserySaveFixture(siteId: string) {
  const shared = createSharedSaveFixture(siteId);
  return { ...shared, context: shared.nurseryContext, reissueContext: shared.reissueNurseryContext, submit: shared.submitNursery };
}
export function createHarvestSaveFixture(siteId: string) {
  const shared = createSharedSaveFixture(siteId);
  return { ...shared, context: shared.harvestContext, reissueContext: shared.reissueHarvestContext, submit: shared.submitHarvest };
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { activeAccountUid } from '@/lib/account-local-storage';
import { getFirebase, isBackendConfigured } from '@/lib/firebase/init';
import { loadPlaces } from '@/lib/saved-places';
import { coordinateSiteIdForPlace } from '@/lib/international/site-context';
import { CROP_PLAN_CHANGED_EVENT } from '@/lib/crop-plan';
import { CROP_PLAN_STORAGE_EVENT } from '@/lib/crop-plan-storage';
import { readRawCropPlanReadView, rawCropPlanReadViewIsCurrent, releaseRawCropPlanReadView,
  type RawCropPlanReadView } from '@/lib/crop-plan-read-view';
import { isSampleMode, SAMPLE_MODE_EVENT } from '@/lib/sample-mode';
import {
  captureProjectHarvestReadContext, projectHarvestReadContextIsCurrent, revokeProjectHarvestReadContext,
  subscribeProjectHarvestReadContext, type ProjectHarvestReadContext,
} from '@/lib/length-unit-preference';
import { previewRecordedHarvest, type PreviewRecordedHarvestResult } from '@/lib/international/projects/sources';
import RecordedHarvestPreview, { type RecordedHarvestSiteOption } from './RecordedHarvestPreview';

interface Actor {
  readonly context: ProjectHarvestReadContext;
  readonly owner: string | null;
  readonly sample: boolean;
  readonly sites: readonly RecordedHarvestSiteOption[];
  readonly sitesKey: string;
}
interface Form { siteId: string; periodStart: string; periodEnd: string }
type ReadyReadView = Extract<RawCropPlanReadView, { status: 'ready' }>;
interface Delivery { result: PreviewRecordedHarvestResult; view: ReadyReadView | null; actor: Actor; intent: object; revoked: boolean }
const emptyForm = (): Form => ({ siteId: '', periodStart: '', periodEnd: '' });
const held = (reason: string): PreviewRecordedHarvestResult => ({ status: 'held', reasons: [reason],
  rows: [], excluded: [], knownSubtotalKg: null, projectReportAvailable: false });
const changedNotice = 'Saved source records changed or became unavailable. Review the current records again.';

/** Canonical coordinates identify a production site; a saved-place label does
 * not. Several aliases of one location must not create separate source totals. */
function savedSites(): RecordedHarvestSiteOption[] {
  const choices = new Map<string, RecordedHarvestSiteOption>();
  for (const place of loadPlaces()) {
    const id = coordinateSiteIdForPlace(place);
    if (id && !choices.has(id)) choices.set(id, { id, label: place.name.trim() || 'Saved site' });
  }
  return [...choices.values()];
}

/** A device-source review only. Neither the actor proof nor the raw read receipt
 * is writer admission, live cloud freshness, consent or a project envelope. */
export default function RecordedHarvestPreviewController() {
  const { user, loading } = useAuth();
  const owner = user?.uid ?? null;
  const live = useRef({ owner, loading }); live.current = { owner, loading };
  const mounted = useRef(false), suspended = useRef(false), reading = useRef(false);
  const intent = useRef<object>({}), actorRef = useRef<Actor | null>(null), deliveryRef = useRef<Delivery | null>(null);
  const formRef = useRef<Form>(emptyForm());
  const [actor, setActor] = useState<Actor | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [revision, setRevision] = useState(0);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [notice, setNotice] = useState('Choose a saved site and dates, then review its monthly production records from this device.');

  function actorCurrent(expected: Actor | null): expected is Actor {
    try {
      if (!mounted.current || suspended.current || !expected || actorRef.current !== expected
        || live.current.loading || live.current.owner !== expected.owner
        || !projectHarvestReadContextIsCurrent(expected.context) || isSampleMode() !== expected.sample) return false;
      if (expected.sample) return activeAccountUid() === null;
      return !!expected.owner && isBackendConfigured() && activeAccountUid() === expected.owner
        && getFirebase()?.auth.currentUser?.uid === expected.owner;
    } catch { return false; }
  }
  function withdraw(message = changedNotice) {
    intent.current = {};
    if (deliveryRef.current) {
      deliveryRef.current.revoked = true;
      releaseRawCropPlanReadView(deliveryRef.current.view);
    }
    deliveryRef.current = null; setDelivery(null); setNotice(message);
  }
  function invalidateActor() {
    withdraw(); actorRef.current = null; setActor(null); setRevision(value => value + 1);
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false; intent.current = {}; actorRef.current = null;
      releaseRawCropPlanReadView(deliveryRef.current?.view); deliveryRef.current = null;
    };
  }, []);
  useEffect(() => {
    let active = true;
    withdraw(); actorRef.current = null; setActor(null);
    formRef.current = emptyForm(); setForm(formRef.current);
    if (loading || suspended.current) return;
    const context = captureProjectHarvestReadContext();
    if (!context) return;
    const sample = isSampleMode();
    const expected: Actor = { context, owner, sample, sites: [], sitesKey: '' };
    actorRef.current = expected;
    if (!actorCurrent(expected)) { actorRef.current = null; revokeProjectHarvestReadContext(context); return; }
    const sites = savedSites();
    if (!actorCurrent(expected)) { actorRef.current = null; revokeProjectHarvestReadContext(context); return; }
    const next: Actor = { ...expected, sites, sitesKey: JSON.stringify(sites) };
    actorRef.current = next; setActor(next);
    const stop = subscribeProjectHarvestReadContext(context, () => { if (active) invalidateActor(); });
    setNotice(sample
      ? 'DEMO — these monthly records belong to the sample session. They are not personal farm observations.'
      : 'Monthly production records saved on this device. Cloud freshness has not been verified.');
    return () => { active = false; stop(); revokeProjectHarvestReadContext(context); if (actorRef.current === next) actorRef.current = null; };
  }, [owner, loading, revision]);

  useEffect(() => {
    const bookChanged = () => withdraw();
    const contextChanged = () => invalidateActor();
    const hide = () => { suspended.current = true; invalidateActor(); };
    const show = () => { suspended.current = false; invalidateActor(); };
    const storageChanged = (event: StorageEvent) => {
      const key = event.key;
      if (!key || key.includes('permamap_saved_places') || key === 'imbewu_sample_mode') contextChanged();
      else if (key.includes('imbewu_crop_plan_')) bookChanged();
    };
    window.addEventListener(CROP_PLAN_CHANGED_EVENT, bookChanged);
    window.addEventListener(CROP_PLAN_STORAGE_EVENT, bookChanged);
    window.addEventListener('permamap-places-changed', contextChanged);
    window.addEventListener(SAMPLE_MODE_EVENT, contextChanged);
    window.addEventListener('storage', storageChanged);
    window.addEventListener('focus', contextChanged);
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', show);
    return () => {
      window.removeEventListener(CROP_PLAN_CHANGED_EVENT, bookChanged);
      window.removeEventListener(CROP_PLAN_STORAGE_EVENT, bookChanged);
      window.removeEventListener('permamap-places-changed', contextChanged);
      window.removeEventListener(SAMPLE_MODE_EVENT, contextChanged);
      window.removeEventListener('storage', storageChanged);
      window.removeEventListener('focus', contextChanged);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
    };
  }, []);

  let current = actorCurrent(actor);
  let review: PreviewRecordedHarvestResult | null = null;
  if (delivery && deliveryRef.current === delivery && current && delivery.actor === actor) {
    if (delivery.revoked) review = held('source-changed');
    else if (delivery.intent === intent.current) {
      let sourceCurrent = delivery.view === null, sitesCurrent = false;
      try {
        sourceCurrent ||= rawCropPlanReadViewIsCurrent(delivery.view);
        sitesCurrent = JSON.stringify(savedSites()) === actor!.sitesKey;
      } catch { sourceCurrent = false; }
      if (sourceCurrent && sitesCurrent && actorCurrent(actor) && delivery.intent === intent.current) review = delivery.result;
      else {
        delivery.revoked = true; releaseRawCropPlanReadView(delivery.view);
        intent.current = {}; review = held('source-changed');
      }
    }
  }
  current = actorCurrent(actor);
  const renderedIntent = intent.current;
  const isCurrent = () => current && intent.current === renderedIntent && actorCurrent(actor);
  function change(key: keyof Form, value: string) {
    if (!isCurrent() || reading.current) return;
    if (key === 'siteId' && value && !actor!.sites.some(site => site.id === value)) return;
    withdraw(actor!.sample
      ? 'DEMO — review the selected sample records again after changing the selection.'
      : 'Review the selected monthly records again after changing the selection. Cloud freshness has not been verified.');
    formRef.current = { ...formRef.current, [key]: value }; setForm(formRef.current);
  }
  function load() {
    if (!isCurrent() || reading.current || !actor || !formRef.current.siteId
      || !formRef.current.periodStart || !formRef.current.periodEnd) return;
    const expected = actor, selected = { ...formRef.current }, action = {};
    intent.current = action; reading.current = true;
    if (deliveryRef.current) {
      deliveryRef.current.revoked = true;
      releaseRawCropPlanReadView(deliveryRef.current.view);
    }
    deliveryRef.current = null; setDelivery(null);
    // Publishing runs through a guarded closure. Read the ref afresh after it
    // rather than relying on the null assignment's local control-flow type.
    const retainedView = () => deliveryRef.current?.view;
    const allowed = () => intent.current === action && actorCurrent(expected);
    const publish = (result: PreviewRecordedHarvestResult, view: ReadyReadView | null) => {
      if (!allowed()) { releaseRawCropPlanReadView(view); return; }
      const next: Delivery = { result, view, actor: expected, intent: action, revoked: false };
      deliveryRef.current = next; setDelivery(next);
    };
    let source: RawCropPlanReadView | null = null;
    try {
      const sites = savedSites();
      if (!allowed()) return;
      if (JSON.stringify(sites) !== expected.sitesKey || !sites.some(site => site.id === selected.siteId)) { invalidateActor(); return; }
      source = readRawCropPlanReadView();
      if (!allowed()) return;
      if (source.status !== 'ready' || !rawCropPlanReadViewIsCurrent(source) || !allowed()) {
        publish(held('source-unavailable'), null); return;
      }
      const raw = source.raw;
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)
        || (raw as { version?: unknown }).version !== 1 || !Array.isArray((raw as { plantings?: unknown }).plantings)) {
        publish(held('source-unavailable'), source); return;
      }
      const records = Object.getOwnPropertyDescriptor(raw, 'productionRecords');
      const result = previewRecordedHarvest({ records: records && 'value' in records ? records.value : undefined,
        ...selected });
      if (!allowed() || !rawCropPlanReadViewIsCurrent(source) || !allowed()) return;
      publish(result, source);
    } catch { publish(held('source-unavailable'), null); }
    finally {
      if (source && retainedView() !== source) releaseRawCropPlanReadView(source);
      reading.current = false;
    }
  }

  return <RecordedHarvestPreview sites={current ? actor!.sites : []} siteId={current ? form.siteId : ''}
    periodStart={current ? form.periodStart : ''} periodEnd={current ? form.periodEnd : ''}
    review={current ? review : null} busy={loading} canLoad={current && !!form.siteId && !!form.periodStart && !!form.periodEnd}
    sourceNotice={current ? (review?.status === 'held' && review.reasons.includes('source-changed') ? changedNotice : notice)
      : 'Saved harvest records are unavailable. Sign in to your own account, or open a DEMO workspace, before reviewing.'}
    onSiteChange={value => change('siteId', value)} onPeriodStartChange={value => change('periodStart', value)}
    onPeriodEndChange={value => change('periodEnd', value)} onLoad={load} />;
}

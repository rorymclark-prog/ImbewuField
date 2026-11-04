import { imageSize } from 'image-size';
import { ConnectorStorage, type Context } from './storage';
import { ConnectorMedia } from './media';
import { fail, hash, parseStore } from './policy';
import { fitPhotoRegistration, type RegistrationControl } from '../../../lib/assistant-registration';

export class ConnectorRegistrations {
  constructor(readonly store: ConnectorStorage, readonly media: ConnectorMedia, readonly appOrigin: string) {}
  async prepare(c: Context, input: { siteId: string; assetId: string; controls: RegistrationControl[]; expectedRevision: string; note: string; retryKey: string }) {
    await this.store.requireSite(c, input.siteId);
    const asset = await this.media.asset(c, input.assetId);
    if (asset.siteId !== input.siteId || !asset.mime.startsWith('image/')) fail('Choose an original photograph attached to this same site.');
    const [bytes] = await this.store.bucket().file(asset.path).download();
    if (hash(bytes) !== asset.sha256) fail('Original photograph verification failed.', 422);
    const dimensions = imageSize(bytes);
    if (!dimensions.width || !dimensions.height || (dimensions.orientation && dimensions.orientation !== 1)) fail('This original needs an explicitly oriented working copy before registration. The original will remain unchanged.', 422);
    const id = hash(`${c.grant.uid}:${input.retryKey}`);
    return this.store.once(c, input.retryKey, 'photo_registration', input, async tx => {
      const canvas = (await tx.get(this.store.map(c.grant.uid, 'design_canvas'))).data();
      const state = parseStore(canvas?.designCanvasJson)[input.siteId];
      if (!state || hash(JSON.stringify(state)) !== input.expectedRevision) fail('Design changed. Read its current frame before matching landmarks.', 409);
      let fit;
      try { fit = fitPhotoRegistration(input.controls, dimensions.width!, dimensions.height!, state.frame.imgW, state.frame.imgH); } catch (e) { fail((e as Error).message); }
      const registration = { id, uid: c.grant.uid, siteId: input.siteId, assetId: input.assetId, sourceWidth: dimensions.width, sourceHeight: dimensions.height, targetFrame: state.frame, frameFingerprint: hash(JSON.stringify(state.frame)), sourceSha256: asset.sha256, ...fit, note: input.note, status: 'needs-visual-review', purpose: 'historical-site-evidence', createdAt: new Date().toISOString(), limitation: 'Approximate image registration only. No survey accuracy, camera date, terrain correction or unphotographed ground is inferred. This draft does not replace the current map base or change saved geometry.' };
      tx.set(this.store.ref('registrations', id), registration);
      return { ...registration, uid: undefined, reviewUrl: `${this.appOrigin}/connect/imbewu?site=${encodeURIComponent(input.siteId)}`, next: 'Inspect the registered original and saved feature outlines in ImbewuField. It remains a historical evidence draft; current map generation uses the app’s existing baseline implementation.' };
    });
  }
  async list(c: Context, siteId: string) {
    await this.store.requireSite(c, siteId);
    return { registrations: await this.forAccount(c.grant.uid, siteId) };
  }
  async forAccount(uid: string, siteId: string) {
    const rows = await this.store.db.collection('assistant_registrations').where('uid', '==', uid).limit(101).get();
    if (rows.size > 100) fail('This account needs a filtered registration view.', 422);
    return rows.docs.map(d => d.data()).filter(r => r.siteId === siteId).map(({ uid: _uid, ...r }) => r);
  }
}

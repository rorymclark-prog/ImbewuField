import { ConnectorStorage, type Context } from './storage';
import { fail, hash, identifier, originalType, provenance, secret } from './policy';

export class ConnectorMedia {
  constructor(readonly store: ConnectorStorage, readonly transferOrigin: string) {}
  async prepare(c: Context, input: { siteId: string; retryKey: string; name: string; mime: string; size: number; sha256: string; source: unknown }) {
    await this.store.requireSite(c, input.siteId);
    const source = provenance(input.source);
    if (!input.name.trim() || input.name.length > 180 || /[/\\\x00-\x1f]/.test(input.name) || !['image/jpeg','image/png','image/webp','application/pdf'].includes(input.mime) || !Number.isSafeInteger(input.size) || input.size <= 0 || input.size > 25 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(input.sha256)) fail('Choose a JPEG, PNG, WebP or PDF up to 25 MiB, with its exact byte count and SHA-256.');
    const cap = secret();
    const assetId = hash(`${c.grant.uid}:${input.siteId}:${input.sha256}`);
    return this.store.once(c, input.retryKey, 'prepare_upload', { ...input, source }, async tx => {
      const existing = await tx.get(this.store.ref('assets', assetId));
      if (existing.exists) return { status: 'complete', assetId, deduplicated: true, sha256: input.sha256 };
      const expiresAt = Date.now() + 30 * 60_000;
      tx.set(this.store.ref('uploads', cap), { uid: c.grant.uid, grantId: c.grantId, assetId, siteId: input.siteId, name: input.name, mime: input.mime, size: input.size, sha256: input.sha256, source, expiresAt, status: 'awaiting_bytes' });
      return { status: 'awaiting_bytes', assetId, uploadId: cap, uploadUrl: `${this.transferOrigin}/upload/${cap}`, method: 'PUT', contentType: 'application/octet-stream', expiresAt, maxBytes: 25 * 1024 * 1024, next: 'Send the original bytes, then call finish_upload. A source link alone has not imported a file.' };
    });
  }
  async upload(cap: string, bytes: Buffer) {
    identifier(cap);
    const u = await this.store.get('uploads', cap);
    if (!u || u.expiresAt <= Date.now()) fail('Upload expired. Start a new upload with a new retry key.', 410);
    const c = await this.store.context(u.grantId);
    if (!c.grant.scopes.includes('field:write')) fail('File upload permission is missing.', 403);
    await this.store.requireSite(c, u.siteId);
    if (bytes.length !== u.size || hash(bytes) !== u.sha256 || !originalType(bytes, u.mime)) fail('The file bytes, type, size or SHA-256 do not match. Nothing was attached.', 422);
    const path = `assistant/originals/${c.grant.uid}/${u.assetId}`;
    // Content-addressed names and create-only writes make an interrupted upload safe to retry.
    try { await this.store.bucket().file(path).save(bytes, { resumable: false, contentType: u.mime, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { cacheControl: 'private, no-store', metadata: { sha256: u.sha256 } } }); }
    catch (e) { if ((e as { code?: number }).code !== 412) throw e; }
    await this.store.ref('uploads', cap).update({ status: 'bytes_received', path });
    return { status: 'bytes_received', assetId: u.assetId, sha256: u.sha256, next: 'Call finish_upload to attach and verify the original.' };
  }
  async finish(c: Context, uploadId: string) {
    identifier(uploadId);
    const u = await this.store.get('uploads', uploadId);
    if (!u || u.uid !== c.grant.uid || u.grantId !== c.grantId) fail('Upload not found for this connection.', 404);
    await this.store.requireSite(c, u.siteId);
    if (!u.path || !['bytes_received', 'complete'].includes(u.status)) fail('Original bytes have not arrived. Do not report the file as imported.', 409);
    const [bytes] = await this.store.bucket().file(u.path).download();
    if (bytes.length !== u.size || hash(bytes) !== u.sha256) fail('Stored original failed verification.', 422);
    const result = await this.store.once(c, uploadId, 'finish_upload', { assetId: u.assetId }, async tx => {
      const asset = await tx.get(this.store.ref('assets', u.assetId));
      if (!asset.exists) tx.set(this.store.ref('assets', u.assetId), { id: u.assetId, uid: u.uid, siteId: u.siteId, name: u.name, mime: u.mime, size: u.size, sha256: u.sha256, path: u.path, source: u.source, importedAt: new Date().toISOString() });
      tx.update(this.store.ref('uploads', uploadId), { status: 'complete' });
      return { status: 'complete', assetId: u.assetId, originalPreserved: true, sha256: u.sha256, deduplicated: asset.exists };
    });
    return result;
  }
  async list(c: Context, site: string, cursor = '') {
    await this.store.requireSite(c, site);
    let q = this.store.db.collection('assistant_assets').where('uid', '==', c.grant.uid).orderBy('__name__').limit(51);
    if (cursor) q = q.startAfter(identifier(cursor));
    // Filter only after the account boundary; never return other sites' metadata or cursors as assets.
    const docs = (await q.get()).docs;
    return { assets: docs.slice(0, 50).map(d => d.data()).filter(a => a.siteId === site).map(({ path: _path, uid: _uid, ...a }) => a), nextCursor: docs.length > 50 ? docs[49].id : null };
  }
  async asset(c: Context, assetId: string) {
    identifier(assetId);
    const a = await this.store.get('assets', assetId);
    if (!a || a.uid !== c.grant.uid) fail('Attachment not found.', 404);
    await this.store.requireSite(c, a.siteId);
    return a;
  }
  async download(c: Context, assetId: string) {
    const a = await this.asset(c, assetId);
    const cap = secret();
    await this.store.put('downloads', cap, { assetId, grantId: c.grantId, expiresAt: Date.now() + 5 * 60_000 });
    const { path: _path, uid: _uid, ...metadata } = a;
    return { ...metadata, downloadUrl: `${this.transferOrigin}/download/${cap}`, expiresInSeconds: 300 };
  }
  async readDownload(cap: string) {
    const d = await this.store.get('downloads', identifier(cap));
    if (!d || d.expiresAt <= Date.now()) fail('Download expired. Request a new attachment link.', 410);
    const c = await this.store.context(d.grantId);
    const a = await this.asset(c, d.assetId);
    return { metadata: a, file: this.store.bucket().file(a.path) };
  }
}

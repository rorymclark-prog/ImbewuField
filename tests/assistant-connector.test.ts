import assert from 'node:assert/strict';
import test from 'node:test';
import { fitPhotoRegistration } from '../lib/assistant-registration.ts';
import { originalType, assertSite, safeRedirect, provenance, scopes } from '../functions/src/connector/policy.ts';
import { createRequire } from 'node:module';
import { assistantProxy } from '../lib/assistant-proxy.ts';

const { NextRequest } = createRequire(import.meta.url)('next/server');

test('desktop OAuth callbacks retain the registered loopback host through NextRequest', async () => {
  const originalFetch = globalThis.fetch;
  const callbacks = [
    'http://127.0.0.1:7777/callback?source=desktop',
    'http://[::1]:7777/callback',
    'http://localhost:7777/callback',
    'https://chatgpt.com/connector/oauth/example',
  ];
  try {
    for (const callback of callbacks) {
      const url = new URL('https://imbewufield.vercel.app/api/assistant/authorize');
      url.searchParams.set('redirect_uri', callback);
      url.searchParams.set('state', 'state-127.0.0.1');
      url.searchParams.set('resource', 'https://imbewufield.vercel.app/api/assistant/mcp');
      const request = new NextRequest(url);
      let upstream: URL | undefined;
      globalThis.fetch = async input => {
        upstream = new URL(String(input));
        return new Response(null, { status: 302, headers: { location: 'https://imbewufield.vercel.app/connect/imbewu?request=synthetic' } });
      };
      const response = await assistantProxy(request, 'authorize');
      assert.equal(response.status, 302);
      assert.equal(upstream?.searchParams.get('redirect_uri'), callback);
      assert.equal(upstream?.searchParams.get('state'), 'state-127.0.0.1');
      assert.equal(upstream?.searchParams.get('resource'), 'https://imbewufield.vercel.app/api/assistant/mcp');
      assert.equal(upstream?.searchParams.get('connector_path'), '/authorize');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('photo registration aligns known landmarks without modifying either control array', () => {
  const controls = [{ source: [0,0] as [number,number], target: [10,20] as [number,number] }, { source: [100,0] as [number,number], target: [210,20] as [number,number] }, { source: [0,100] as [number,number], target: [10,220] as [number,number] }, { source: [100,100] as [number,number], target: [210,220] as [number,number] }];
  const original = structuredClone(controls), result = fitPhotoRegistration(controls,100,100,300,300);
  result.matrix.forEach((v,i) => assert.ok(Math.abs(v-[2,0,0,2,10,20][i]) < 1e-8));
  assert.ok(result.rmsPixels < 1e-8); assert.deepEqual(controls,original);
});
test('a perfect fit on collinear or collapsed controls cannot masquerade as a registered photo', () => {
  assert.throws(() => fitPhotoRegistration([{source:[0,0],target:[0,0]},{source:[50,50],target:[50,50]},{source:[100,100],target:[100,100]}],100,100,100,100), /straight line/);
  assert.throws(() => fitPhotoRegistration([{source:[0,0],target:[0,0]},{source:[100,0],target:[0,0]},{source:[0,100],target:[0,0]}],100,100,100,100), /collapse/);
});
test('a poor fourth landmark is measured instead of silently declared an accurate survey', () => {
  const fit = fitPhotoRegistration([{source:[0,0],target:[10,20]},{source:[100,0],target:[210,20]},{source:[0,100],target:[10,220]},{source:[100,100],target:[230,230]}],100,100,300,300);
  assert.ok(fit.rmsPixels > 5); assert.ok(fit.maxErrorPixels > 5);
});
test('a known site in another connection remains outside the chosen site boundary', () => {
  assert.throws(() => assertSite({ siteIds: ['site:-28.00000,30.00000'] }, 'site:-29.00000,30.00000'), /not authorised/);
  assert.throws(() => assertSite({ siteIds: ['__proto__'] }, '__proto__'), /Invalid/);
});
test('original files require real bytes and source authorisation rather than a URL reference', () => {
  assert.equal(originalType(Buffer.from('https://example.org/photo.jpg'),'image/jpeg'),false);
  assert.equal(originalType(Buffer.from('%PDF-1.7\n'),'application/pdf'),true);
  assert.throws(() => provenance({kind:'public_archive',reference:'https://example.org'}), /authorisation/);
  assert.throws(() => provenance({kind:'authorised_connector',reference:'Drive file',authorisation:'User selected',sourceUrl:'https://example.org/file?token=secret'}), /query tokens/);
});
test('OAuth callbacks reject credential-bearing and executable URLs while supporting desktop loopback', () => {
  assert.equal(safeRedirect('javascript:alert(1)'),false); assert.equal(safeRedirect('https://user:password@example.org/callback'),false);
  assert.equal(safeRedirect('http://example.org/callback'),false); assert.equal(safeRedirect('http://127.0.0.1:7777/callback'),true);
  assert.equal(safeRedirect('https://chatgpt.com/connector/oauth/example'),true);
});

test('prototype property names cannot become OAuth permissions', () => {
  assert.throws(() => scopes(['toString']), /Unsupported/);
  assert.throws(() => scopes(['constructor']), /Unsupported/);
});

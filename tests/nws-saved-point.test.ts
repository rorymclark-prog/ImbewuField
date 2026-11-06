import assert from 'node:assert/strict';
import test from 'node:test';
import { checkNwsPointReference, checkNwsPublicDemo } from '../app/international/nws-actions.ts';
import { COUNTRY_CLIMATE_DEMOS } from '../lib/international/providers/nasa-reference.ts';
import { fetchCountryNwsPublicDemo, fetchNwsPointReference, type NwsPublicDemoOptions } from '../lib/international/providers/nws-public-demo.ts';
import { decodeNwsPointReference, decodeNwsReference, parseNwsPointRequest,
  type NwsPointRequest, type NwsPointReferenceProvenance } from '../lib/international/providers/nws-reference.ts';

// These synthetic coordinates are the world origin and exact range boundaries,
// not farm locations, a US coverage assertion or retrieved weather evidence.
const origin: NwsPointRequest = { latitude4: '0.0000', longitude4: '0.0000' };
const edge: NwsPointRequest = { latitude4: '90.0000', longitude4: '180.0000' };
const now = () => new Date('2026-11-06T18:00:00.000Z');
const mapped = (office = 'ABC', x = 0, y = 0) => `https://api.weather.gov/gridpoints/${office}/${x},${y}/forecast`;
const pointUrl = (point: NwsPointRequest) => `https://api.weather.gov/points/${point.latitude4},${point.longitude4}`;
function mapping(point = origin, office = 'ABC', x = 0, y = 0) {
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [Number(point.longitude4), Number(point.latitude4)] },
    properties: { gridId: office, gridX: x, gridY: y, forecast: mapped(office, x, y) } };
}
function forecast() {
  return { type: 'Feature', properties: { units: 'si', generatedAt: '2026-11-06T11:00:00-05:00',
    updateTime: '2026-11-06T10:00:00-05:00', validTimes: '2026-11-06T12:00:00-05:00/P1D', periods: [{ number: 3,
      name: 'Synthetic period', startTime: '2026-11-06T12:00:00-05:00', endTime: '2026-11-07T00:00:00-05:00',
      isDaytime: true, temperature: { unitCode: 'wmoUnit:degC', value: 0 as number | null },
      probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 0 as number | null },
      shortForecast: 'Synthetic summary', detailedForecast: 'Synthetic reference, not growing instructions.' }] } };
}
const receipt = (): NwsPointReferenceProvenance => ({ providerId: 'nws-forecast-reference', fetchedAt: now().toISOString(),
  endpoint: `${mapped()}?units=si`, referenceOnly: true, kind: 'requested-point', requestedPoint: { ...origin } });
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/geo+json' } });
type Reply = Response | (() => Response | Promise<Response>);
function transport(replies: Reply[]) {
  const calls: { url: string; options: RequestInit | undefined }[] = [];
  const fetcher: typeof fetch = async (input, options) => {
    calls.push({ url: String(input), options });
    const reply = replies.shift();
    assert.ok(reply, 'No additional destination or retry may be requested');
    return typeof reply === 'function' ? reply() : reply;
  };
  return { calls, fetcher };
}
async function withFetch<T>(fetcher: typeof fetch, run: () => Promise<T>): Promise<T> {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetcher });
  try { return await run(); }
  finally { if (previous) Object.defineProperty(globalThis, 'fetch', previous); else Reflect.deleteProperty(globalThis, 'fetch'); }
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
const tick = () => new Promise<void>(yes => setImmediate(yes));
function publicPointReceipt(value: unknown, point: NwsPointRequest) {
  assert.ok(value && typeof value === 'object');
  assert.deepEqual(Object.keys(value).sort(), ['endpoint', 'fetchedAt', 'kind', 'providerId', 'referenceOnly', 'requestedPoint']);
  assert.deepEqual(Reflect.get(value, 'requestedPoint'), point);
  assert.equal(Reflect.get(value, 'kind'), 'requested-point');
  assert.equal(Reflect.get(value, 'referenceOnly'), true);
  assert.equal(Reflect.get(value, 'providerId'), 'nws-forecast-reference');
  assert.doesNotMatch(JSON.stringify(value), /demoPlace|private-|site:|alias|actor|owner|jurisdiction|cropAdvice|frostWarning/);
}
function invalidInputs() {
  const values: unknown[] = [undefined, null, false, 0, 'private-point', 'site:0.00000,0.00000',
    'https://private.invalid/points/0,0', [], [origin], {}, { latitude4: '0.0000' },
    { ...origin, siteId: 'site:0.00000,0.00000' }, { ...origin, actor: 'private-actor' },
    { ...origin, endpoint: 'https://private.invalid/' }, { ...origin, country: 'US' },
    { ...origin, demoPlace: 'private-label' }, { ...origin, kind: 'requested-point' },
    { ...origin, extra: undefined }, { ...origin, [Symbol('private-key')]: 'private-value' }];
  for (const key of ['latitude4', 'longitude4']) {
    for (const bad of [0, -0, NaN, Infinity, null, undefined, new String('0.0000'), '', '0', '0.000', '0.00000',
      '00.0000', '+0.0000', '-0.0000', '0e0', ' 0.0000', '0.0000 ', '0.0000\n', '.0000', 'NaN', 'Infinity',
      'https://private.invalid/', 'site:0.00000,0.00000']) values.push({ ...origin, [key]: bad });
  }
  values.push({ ...origin, latitude4: '90.0001' }, { ...origin, latitude4: '-90.0001' },
    { ...origin, longitude4: '180.0001' }, { ...origin, longitude4: '-180.0001' });
  return values;
}

test('the request parser preserves only exact canonical four-decimal pairs and detaches their identity', () => {
  for (const point of [origin, edge, { latitude4: '-90.0000', longitude4: '-180.0000' },
    { latitude4: '90.0000', longitude4: '-180.0000' }, { latitude4: '-90.0000', longitude4: '180.0000' }]) {
    const input = { ...point }, parsed = parseNwsPointRequest(input);
    assert.deepEqual(parsed, point); assert.notEqual(parsed, input); assert.equal(Object.isFrozen(parsed), true);
    assert.ok(parsed); input.latitude4 = 'private-mutation'; assert.equal(parsed.latitude4, point.latitude4);
    assert.deepEqual(Object.keys(parsed).sort(), ['latitude4', 'longitude4']);
  }
  for (const value of invalidInputs()) assert.equal(parseNwsPointRequest(value), null);
});

test('invalid points fail before inspecting options or using even the global transport and never fall back to Washington', async () => {
  let reads = 0, calls = 0;
  const options: NwsPublicDemoOptions = new Proxy({}, {
    get() { reads++; throw Error('Options must stay unread'); },
    ownKeys() { reads++; throw Error('Options must stay unread'); },
    getPrototypeOf() { reads++; throw Error('Options must stay unread'); },
    getOwnPropertyDescriptor() { reads++; throw Error('Options must stay unread'); },
  });
  await withFetch(async () => { calls++; throw Error('No invalid point may request a reference'); }, async () => {
    for (const value of invalidInputs()) {
      const result = await fetchNwsPointReference(value, options);
      assert.equal(result.status, 'failed');
      if (result.status !== 'failed') throw Error('Invalid point reached forecast output');
      assert.equal(result.reason, 'invalid-point'); assert.equal(result.stage, 'selection');
      publicPointReceipt(result.provenance, { latitude4: '', longitude4: '' });
      assert.equal(result.provenance.endpoint, ''); assert.equal(result.provenance.fetchedAt, '');
      assert.doesNotMatch(JSON.stringify(result), /private-|site:|Washington|Nairobi/);
    }
  });
  assert.equal(reads, 0); assert.equal(calls, 0);
});

test('unsafe descriptors, conversion hooks and throwing reflection never execute getters or acquire request authority', async () => {
  let executed = 0;
  const accessor = Object.defineProperty({ longitude4: '0.0000' }, 'latitude4', {
    enumerable: true, get() { executed++; return '0.0000'; },
  });
  const coercible = { toString() { executed++; return '0.0000'; }, valueOf() { executed++; return 0; },
    [Symbol.toPrimitive]() { executed++; return '0.0000'; } };
  const callable = () => { executed++; return origin; };
  const nonenumerable = Object.defineProperty({ ...origin }, 'private-key', { value: 'private-value' });
  const values = [accessor, { ...origin, latitude4: coercible }, callable, { ...origin, latitude4: callable }, nonenumerable,
    new Proxy({ ...origin }, { ownKeys() { throw Error('private-ownKeys'); } }),
    new Proxy({ ...origin }, { getPrototypeOf() { throw Error('private-prototype'); } }),
    new Proxy({ ...origin }, { getOwnPropertyDescriptor() { throw Error('private-descriptor'); } })];
  const revoked = Proxy.revocable({ ...origin }, {}); revoked.revoke(); values.push(revoked.proxy);
  for (const value of values) {
    assert.equal(parseNwsPointRequest(value), null);
    const wire = transport([]), result = await fetchNwsPointReference(value, { fetcher: wire.fetcher });
    assert.equal(result.status, 'failed');
    if (result.status !== 'failed') throw Error('Unsafe input received forecast values');
    assert.equal(result.reason, 'invalid-point'); assert.equal(wire.calls.length, 0);
    assert.doesNotMatch(JSON.stringify(result), /private-|site:/);
  }
  assert.equal(executed, 0);
});

test('a point request maps its exact outgoing pair, preserves native source metadata and carries only point provenance', async () => {
  for (const point of [origin, edge]) {
    const payload = forecast(), before = JSON.stringify(payload), input = { ...point };
    const wire = transport([json(mapping(point)), json(payload)]);
    const result = await fetchNwsPointReference(input, { fetcher: wire.fetcher, now });
    if (result.status === 'failed') throw Error(result.reason);
    assert.equal(result.status, 'available');
    assert.deepEqual(wire.calls.map(call => call.url), [pointUrl(point), `${mapped()}?units=si`]);
    for (const call of wire.calls) {
      assert.equal(call.options?.redirect, 'error'); assert.equal(call.options?.credentials, 'omit'); assert.equal(call.options?.cache, 'no-store');
      const headers = new Headers(call.options?.headers);
      assert.match(headers.get('user-agent')!, /ImbewuField/); assert.equal(headers.has('authorization'), false); assert.equal(headers.has('cookie'), false);
    }
    assert.equal(wire.calls[0].options?.signal, wire.calls[1].options?.signal);
    assert.equal(result.metadata.generatedAt, payload.properties.generatedAt); assert.equal(result.metadata.updateTime, payload.properties.updateTime);
    assert.equal(result.metadata.validTimes, payload.properties.validTimes); assert.equal(result.metadata.sourceUnits, 'si');
    assert.equal(result.periods[0].startTime, payload.properties.periods[0].startTime);
    assert.equal(result.periods[0].temperatureC, 0); assert.equal(result.periods[0].precipitationPercent, 0);
    publicPointReceipt(result.provenance, point); assert.equal(result.provenance.fetchedAt, now().toISOString());
    assert.equal(result.provenance.endpoint, `${mapped()}?units=si`); assert.equal(JSON.stringify(payload), before);
    input.latitude4 = 'private-later-change'; assert.deepEqual(result.provenance.requestedPoint, point);
    assert.equal('productionPlanSupported' in result, false); assert.equal('frostWarning' in result.periods[0], false);
  }
});

test('returned wrong, reversed, full-precision or unsafe mappings never authorize the forecast destination', async () => {
  const changes: ((value: ReturnType<typeof mapping>) => void)[] = [
    value => { value.geometry.coordinates = [90, 180]; },
    value => { value.geometry.coordinates = [0, 0]; },
    value => { value.geometry.coordinates = [180, 89.99999]; },
    value => { value.geometry.coordinates = [180, 90, 0]; },
    value => { value.type = 'FeatureCollection'; },
    value => { value.geometry.type = 'Polygon'; },
    value => { value.properties.gridId = '../'; },
    value => { value.properties.gridX = -1; },
    value => { value.properties.gridY = Number.MAX_SAFE_INTEGER + 1; },
    value => { value.properties.gridX = 1; },
    value => { value.properties.forecast = 'https://private.invalid/gridpoints/ABC/0,0/forecast'; },
    value => { value.properties.forecast = mapped().replace('https:', 'http:'); },
    value => { value.properties.forecast = mapped().replace('api.weather.gov', 'private:secret@api.weather.gov'); },
    value => { value.properties.forecast = mapped().replace('api.weather.gov', 'api.weather.gov:443'); },
    value => { value.properties.forecast = mapped().replace('/gridpoints/', '/a/../gridpoints/'); },
    value => { value.properties.forecast = mapped().replace('/0,0/', '/00,0/'); },
    value => { value.properties.forecast += '?units=si'; },
    value => { value.properties.forecast += '#private-fragment'; },
    value => { value.properties.forecast += '/hourly'; },
  ];
  for (const change of changes) {
    const point = mapping(edge); change(point);
    const wire = transport([json(point)]), result = await fetchNwsPointReference(edge, { fetcher: wire.fetcher, now });
    assert.equal(result.status, 'failed');
    if (result.status !== 'failed') throw Error('Unmatched point or unsafe mapping received forecast values');
    assert.equal(result.reason, 'malformed-response'); assert.equal(result.stage, 'point');
    assert.deepEqual(wire.calls.map(call => call.url), [pointUrl(edge)]);
    publicPointReceipt(result.provenance, edge); assert.doesNotMatch(JSON.stringify(result), /private-|secret/);
  }
});

test('each explicit point invocation discovers a new grid rather than caching the previous mapping', async () => {
  const wire = transport([json(mapping()), json(forecast()), json(mapping(origin, 'XY1', 1, 2)), json(forecast())]);
  for (let index = 0; index < 2; index++) assert.equal((await fetchNwsPointReference(origin, { fetcher: wire.fetcher, now })).status, 'available');
  assert.deepEqual(wire.calls.map(call => call.url), [pointUrl(origin), `${mapped()}?units=si`, pointUrl(origin), `${mapped('XY1', 1, 2)}?units=si`]);
});

test('point decoding retains real zero beside unknown measurements and withholds wrong-unit values', async () => {
  for (const metric of ['temperature', 'probabilityOfPrecipitation'] as const) {
    const payload = forecast(); payload.properties.periods[0][metric].value = null;
    const wire = transport([json(mapping()), json(payload)]), result = await fetchNwsPointReference(origin, { fetcher: wire.fetcher, now });
    if (result.status === 'failed') throw Error(result.reason);
    assert.equal(result.status, 'partial'); assert.equal(result.periods[0].temperatureC, metric === 'temperature' ? null : 0);
    assert.equal(result.periods[0].precipitationPercent, metric === 'probabilityOfPrecipitation' ? null : 0);
  }
  const payload = forecast(); payload.properties.periods[0].temperature.unitCode = 'wmoUnit:degF';
  const wire = transport([json(mapping()), json(payload)]), result = await fetchNwsPointReference(origin, { fetcher: wire.fetcher, now });
  assert.equal(result.status, 'failed');
  if (result.status !== 'failed') throw Error('Wrong unit reached point output');
  assert.equal(result.reason, 'malformed-response'); assert.equal(result.stage, 'decode'); assert.ok(result.decoderReason);
});

function decodeUntrustedPoint(provenance: unknown) {
  // Deliberately cross the typed trust boundary to exercise runtime validation.
  // @ts-expect-error Untrusted provenance is intentionally not a typed receipt.
  return decodeNwsPointReference(forecast(), provenance);
}
function decodeUntrustedDemo(provenance: unknown) {
  // @ts-expect-error Untrusted provenance is intentionally not a typed receipt.
  return decodeNwsReference(forecast(), provenance);
}
test('point and legacy decoder provenance cannot be confused, and unsafe or extra private evidence is never echoed', () => {
  const demo = { providerId: 'nws-forecast-reference', fetchedAt: now().toISOString(), endpoint: `${mapped()}?units=si`,
    demoPlace: 'Synthetic public demonstration', referenceOnly: true } as const;
  const requestedPoint = { ...origin }, point = { ...receipt(), requestedPoint }, good = decodeNwsPointReference(forecast(), point);
  assert.equal(good.status, 'available'); publicPointReceipt(good.provenance, origin);
  const legacy = decodeNwsReference(forecast(), demo); assert.equal(legacy.status, 'available');
  assert.deepEqual(legacy.provenance, demo); assert.equal('kind' in legacy.provenance, false);
  for (const bad of [demo, { ...point, demoPlace: 'private-demo-label' }, { ...point, siteId: 'site:0.00000,0.00000' },
    { ...point, actor: 'private-actor' }, { ...point, requestedPoint: { ...origin, alias: 'private-alias' } },
    { ...point, requestedPoint: { ...origin, latitude4: '0.00000' } }, { ...point, kind: 'public-demo' },
    { ...point, referenceOnly: false }, { ...point, fetchedAt: 'private-invalid-time' }]) {
    const result = decodeUntrustedPoint(bad); assert.equal(result.status, 'failed');
    assert.doesNotMatch(JSON.stringify(result), /private-|site:|Synthetic public demonstration|demoPlace/);
  }
  // Legacy callers already accept safe unknown metadata and project it away.
  // Point discrimination must not turn that old filtering contract into a hold.
  const extraDemo = { ...demo, siteId: 'site:0.00000,0.00000' };
  const filtered = decodeNwsReference(forecast(), extraDemo);
  assert.equal(filtered.status, 'available'); assert.deepEqual(filtered.provenance, demo);
  assert.doesNotMatch(JSON.stringify(filtered), /site:|siteId/);
  for (const bad of [point, { ...demo, ...point }, { ...demo, requestedPoint: origin }]) {
    const result = decodeUntrustedDemo(bad); assert.equal(result.status, 'failed');
    assert.doesNotMatch(JSON.stringify(result), /private-|site:|requestedPoint|requested-point/);
  }
  let reads = 0;
  const accessor = Object.defineProperty({ ...point }, 'requestedPoint', { enumerable: true, get() { reads++; return origin; } });
  for (const bad of [accessor, new Proxy(point, { ownKeys() { throw Error('private-reflection'); } })]) {
    const result = decodeUntrustedPoint(bad); assert.equal(result.status, 'failed');
    assert.doesNotMatch(JSON.stringify(result), /private-|demoPlace|site:/);
  }
  assert.equal(reads, 0);
  requestedPoint.latitude4 = 'private-mutation'; publicPointReceipt(good.provenance, origin);
});

test('a point fetch ignoring abort times out and its late point response cannot cause a second fetch', { timeout: 2000 }, async () => {
  const late = deferred<Response>(), wire = transport([() => late.promise]);
  const result = await fetchNwsPointReference(origin, { fetcher: wire.fetcher, now, timeoutMs: 5 });
  assert.equal(result.status, 'failed');
  if (result.status !== 'failed') throw Error('Unresponsive point escaped the bounded operation');
  assert.equal(result.reason, 'timeout'); assert.equal(result.stage, 'point'); assert.equal(wire.calls[0].options?.signal?.aborted, true);
  late.resolve(json(mapping())); await tick(); assert.equal(wire.calls.length, 1); publicPointReceipt(result.provenance, origin);
});

test('the point path shares one deadline across mapping and forecast rather than restarting its allowance', { timeout: 2000 }, async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const first = deferred<Response>(), second = deferred<Response>(), started = deferred<void>();
  const wire = transport([() => first.promise, () => { started.resolve(); return second.promise; }]);
  try {
    const pending = fetchNwsPointReference(origin, { fetcher: wire.fetcher, now, timeoutMs: 10 });
    context.mock.timers.tick(6); first.resolve(json(mapping())); await started.promise;
    context.mock.timers.tick(4); const result = await pending;
    assert.equal(result.status, 'failed');
    if (result.status !== 'failed') throw Error('Forecast acquired a separate deadline');
    assert.equal(result.reason, 'timeout'); assert.equal(result.stage, 'forecast'); assert.equal(wire.calls.length, 2);
    second.resolve(json(forecast())); await tick();
  } finally { context.mock.timers.reset(); }
});

test('the point server action delegates an untrusted pair to actual bounded transport without treating it as ownership or US proof', async () => {
  const wire = transport([json(mapping()), json(forecast())]);
  await withFetch(wire.fetcher, async () => {
    const result = await checkNwsPointReference(origin);
    if (result.status === 'failed') throw Error(result.reason);
    publicPointReceipt(result.provenance, origin);
    assert.deepEqual(wire.calls.map(call => call.url), [pointUrl(origin), `${mapped()}?units=si`]);
    assert.equal('ownershipVerified' in result, false); assert.equal('countryVerified' in result, false);
  });
  const blocked = transport([]);
  await withFetch(blocked.fetcher, async () => {
    for (const input of ['site:0.00000,0.00000', { ...origin, siteId: 'private-site' },
      { ...origin, url: 'https://private.invalid/' }, { ...origin, country: 'US' }, null]) {
      const result = await checkNwsPointReference(input); assert.equal(result.status, 'failed');
      if (result.status !== 'failed') throw Error('Server action accepted untrusted metadata');
      assert.equal(result.reason, 'invalid-point'); assert.doesNotMatch(JSON.stringify(result), /private-|site:|Washington/);
    }
  });
  assert.equal(blocked.calls.length, 0);
});

test('legacy demo transport and action retain demoPlace and their fixed public point after point support is added', async () => {
  const demo = COUNTRY_CLIMATE_DEMOS.US;
  const publicMapping = () => ({ ...mapping(), geometry: { type: 'Point', coordinates: [demo.longitude, demo.latitude] } });
  const wire = transport([json(publicMapping()), json(forecast()), json(publicMapping()), json(forecast())]);
  const direct = await fetchCountryNwsPublicDemo('US', { fetcher: wire.fetcher, now });
  assert.equal(direct.status, 'available'); assert.equal(direct.provenance.demoPlace, demo.label);
  assert.equal('kind' in direct.provenance, false); assert.equal('requestedPoint' in direct.provenance, false);
  await withFetch(wire.fetcher, async () => {
    const action = await checkNwsPublicDemo(); assert.equal(action.status, 'available');
    assert.equal(action.provenance.demoPlace, demo.label); assert.equal('requestedPoint' in action.provenance, false);
  });
  assert.deepEqual(wire.calls.map(call => call.url), [
    `https://api.weather.gov/points/${demo.latitude},${demo.longitude}`, `${mapped()}?units=si`,
    `https://api.weather.gov/points/${demo.latitude},${demo.longitude}`, `${mapped()}?units=si`,
  ]);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { deliverFile, downloadFile, type FileDelivery } from '../lib/file-delivery.ts';

const blob = new Blob(['saved-source export'], { type: 'application/pdf' });
const filename = 'saved-source.pdf';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

function platform() {
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  const createdUrls: string[] = [], revokedUrls: string[] = [];
  const timers: { callback: () => void; delay: number | undefined }[] = [];
  const state = {
    attached: false, clicks: 0, removes: 0, elementCreates: 0, shares: 0, coarse: false,
    onCreateUrl: () => {}, onCreateElement: () => {}, onAppend: () => {}, onClick: () => {},
  };
  const anchor = {
    hidden: false, tabIndex: 0, href: '', download: '', rel: '',
    click() { state.onClick(); state.clicks++; },
    remove() { state.removes++; state.attached = false; },
  };
  function replace(name: string, value: unknown) {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  const createUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const revokeUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: () => {
    const url = 'blob:current-context/' + createdUrls.length;
    createdUrls.push(url); state.onCreateUrl(); return url;
  } });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: (url: string) => { revokedUrls.push(url); } });
  replace('document', {
    createElement(tag: string) {
      assert.equal(tag, 'a'); state.elementCreates++; state.onCreateElement(); return anchor;
    },
    body: { appendChild(value: unknown) {
      assert.strictEqual(value, anchor); state.attached = true; state.onAppend(); return value;
    } },
  });
  replace('navigator', {});
  replace('window', { matchMedia: () => ({ matches: state.coarse }) });
  replace('setTimeout', (callback: () => void, delay?: number) => {
    timers.push({ callback, delay }); return timers.length;
  });
  return {
    state, anchor, createdUrls, revokedUrls, timers,
    shareWith(share: () => Promise<void>) {
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
        canShare: () => true,
        share: async () => { state.shares++; await share(); },
      } });
    },
    restore() {
      if (createUrl) Object.defineProperty(URL, 'createObjectURL', createUrl);
      else Reflect.deleteProperty(URL, 'createObjectURL');
      if (revokeUrl) Object.defineProperty(URL, 'revokeObjectURL', revokeUrl);
      else Reflect.deleteProperty(URL, 'revokeObjectURL');
      for (const [name, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
    },
  };
}
type Platform = ReturnType<typeof platform>;
async function withPlatform(run: (value: Platform) => void | Promise<void>) {
  const value = platform();
  try { await run(value); } finally { value.restore(); }
}
function assertWithheld(value: Platform) {
  assert.equal(value.state.clicks, 0, 'withdrawn source authority never reaches the browser click');
  assert.equal(value.state.attached, false);
  assert.deepEqual(value.revokedUrls, value.createdUrls, 'every allocated URL is immediately reclaimed');
  assert.equal(value.timers.length, 0, 'withheld delivery leaves no delayed cleanup timer');
}
function assertDownloaded(value: Platform) {
  assert.equal(value.state.clicks, 1);
  assert.equal(value.state.attached, false);
  assert.equal(value.anchor.download, filename);
  assert.equal(value.anchor.rel, 'noopener');
  assert.equal(value.revokedUrls.length, 0, 'WebKit keeps its original post-click grace period');
  assert.equal(value.timers.length, 1);
  assert.equal(value.timers[0].delay, 10_000);
  value.timers[0].callback();
  assert.deepEqual(value.revokedUrls, value.createdUrls);
}

test('ordinary two-argument and explicitly undefined downloads retain synchronous delivery and WebKit cleanup', async () => {
  for (const explicitUndefined of [false, true]) await withPlatform(value => {
    const result: FileDelivery = explicitUndefined
      ? downloadFile(blob, filename, undefined) : downloadFile(blob, filename);
    assert.equal(result, 'downloaded');
    assert.equal(typeof result, 'string');
    assertDownloaded(value);
  });
});

test('a missing strict-true initial admission allocates no URL or anchor', async () => {
  for (const answer of [false, undefined, null, 0, 'true']) await withPlatform(async value => {
    const result = await downloadFile(blob, filename, () => answer as boolean);
    assert.equal(result, 'cancelled');
    assert.equal(value.createdUrls.length, 0);
    assert.equal(value.state.elementCreates, 0);
    assertWithheld(value);
  });
});

test('throwing or rejected initial admission fails closed without allocation', async () => {
  for (const asynchronous of [false, true]) await withPlatform(async value => {
    const result = await downloadFile(blob, filename, () => {
      if (asynchronous) return Promise.reject(new Error('saved reader unavailable'));
      throw new Error('saved reader unavailable');
    });
    assert.equal(result, 'cancelled');
    assert.equal(value.createdUrls.length, 0);
    assert.equal(value.state.elementCreates, 0);
    assertWithheld(value);
  });
});

test('an unresolved initial fresh-reader check allocates nothing and can retire before preparation', async () => withPlatform(async value => {
  const entered = deferred(), release = deferred();
  let current = true;
  const result: Promise<FileDelivery> = downloadFile(blob, filename, async () => {
    entered.resolve(); await release.promise; return current;
  });
  await entered.promise;
  assert.equal(value.createdUrls.length, 0);
  assert.equal(value.state.elementCreates, 0);
  current = false; release.resolve();
  assert.equal(await result, 'cancelled');
  assertWithheld(value);
}));

test('source changes during URL, anchor creation or append are rejected by the post-preparation check', async () => {
  for (const stage of ['onCreateUrl', 'onCreateElement', 'onAppend'] as const) await withPlatform(async value => {
    let current = true, checks = 0;
    value.state[stage] = () => { current = false; };
    assert.equal(await downloadFile(blob, filename, () => { checks++; return current; }), 'cancelled');
    assert.equal(checks, 2);
    assert.equal(value.createdUrls.length, 1);
    assert.equal(value.state.removes, 1);
    assertWithheld(value);
  });
});

test('the final asynchronous check sees a hidden prepared anchor and can retire before click', async () => withPlatform(async value => {
  const entered = deferred(), release = deferred();
  let current = true, checks = 0;
  const result = downloadFile(blob, filename, async () => {
    if (++checks === 1) return current;
    assert.equal(value.createdUrls.length, 1);
    assert.equal(value.state.attached, true);
    assert.equal(value.anchor.hidden, true);
    assert.equal(value.anchor.tabIndex, -1);
    entered.resolve(); await release.promise; return current;
  });
  await entered.promise;
  assert.equal(value.state.clicks, 0);
  assert.equal(value.revokedUrls.length, 0);
  assert.equal(value.timers.length, 0);
  current = false; release.resolve();
  assert.equal(await result, 'cancelled');
  assertWithheld(value);
}));

test('a throwing final check removes its prepared anchor and immediately revokes its URL', async () => withPlatform(async value => {
  let checks = 0;
  assert.equal(await downloadFile(blob, filename, () => {
    if (++checks === 1) return true;
    throw new Error('saved source was withdrawn');
  }), 'cancelled');
  assert.equal(checks, 2);
  assert.equal(value.createdUrls.length, 1);
  assert.equal(value.state.removes, 1);
  assertWithheld(value);
}));

test('a successful guarded download waits for final admission and retains the original ten-second cleanup', async () => withPlatform(async value => {
  const entered = deferred(), release = deferred();
  let checks = 0;
  const result = downloadFile(blob, filename, async () => {
    if (++checks === 1) return true;
    assert.equal(value.state.attached, true);
    entered.resolve(); await release.promise; return true;
  });
  await entered.promise;
  assert.equal(value.state.clicks, 0);
  release.resolve();
  assert.equal(await result, 'downloaded');
  assert.equal(checks, 2);
  assertDownloaded(value);
}));

test('a microtask can retire an accepted source before the download continuation, and final revocation blocks its click', async () => withPlatform(async value => {
  let current = true, sourceChecks = 0, handoffChecks = 0;
  const order: string[] = [];
  const result = await downloadFile(blob, filename, async () => {
    if (++sourceChecks === 1) return current;
    await Promise.resolve();
    const accepted = current;
    order.push('source-accepted');
    // A normal view retirement queued by the completed source check runs before
    // the helper resumes its awaited download continuation. The earlier helper
    // clicked here despite the caller's original view already being withdrawn.
    queueMicrotask(() => { current = false; order.push('view-retired'); });
    return accepted;
  }, () => {
    handoffChecks++; order.push('handoff-checked'); return current;
  });
  assert.equal(result, 'cancelled');
  assert.equal(sourceChecks, 2);
  assert.equal(handoffChecks, 1);
  assert.deepEqual(order, ['source-accepted', 'view-retired', 'handoff-checked']);
  assert.equal(value.createdUrls.length, 1);
  assert.equal(value.state.removes, 1);
  assertWithheld(value);
}));

test('the synchronous final predicate requires strict true and cleans prepared resources on withdrawal or throw', async () => {
  for (const answer of [false, undefined, null, 0, 'true', Promise.resolve(true), new Error('view retired')]) {
    await withPlatform(async value => {
      let sourceChecks = 0, handoffChecks = 0;
      const result = await downloadFile(blob, filename, async () => { sourceChecks++; return true; }, () => {
        handoffChecks++;
        if (answer instanceof Error) throw answer;
        return answer as boolean;
      });
      assert.equal(result, 'cancelled');
      assert.equal(sourceChecks, 2, 'the actual awaited reader is still required');
      assert.equal(handoffChecks, 1);
      assert.equal(value.createdUrls.length, 1);
      assert.equal(value.state.removes, 1);
      assertWithheld(value);
    });
  }
});

test('final synchronous permission cannot replace a failed initial or post-preparation source check', async () => {
  for (const failAt of [1, 2]) await withPlatform(async value => {
    let sourceChecks = 0, handoffChecks = 0;
    assert.equal(await downloadFile(blob, filename, async () => ++sourceChecks !== failAt, () => {
      handoffChecks++; return true;
    }), 'cancelled');
    assert.equal(sourceChecks, failAt);
    assert.equal(handoffChecks, 0);
    assert.equal(value.createdUrls.length, failAt === 1 ? 0 : 1);
    assertWithheld(value);
  });
});

test('successful final revocation admission reaches click without another promise continuation', async () => withPlatform(async value => {
  let current = true, sourceChecks = 0, handoffChecks = 0;
  const order: string[] = [];
  value.state.onClick = () => {
    assert.equal(current, true, 'no microtask ran between synchronous admission and the actual click');
    order.push('click');
  };
  const result: Promise<FileDelivery> = downloadFile(blob, filename, async () => {
    sourceChecks++; return true;
  }, () => {
    handoffChecks++; order.push('handoff-checked');
    queueMicrotask(() => { current = false; order.push('later-retirement'); });
    return true;
  });
  assert.equal(await result, 'downloaded');
  assert.equal(sourceChecks, 2);
  assert.equal(handoffChecks, 1);
  assert.deepEqual(order, ['handoff-checked', 'click', 'later-retirement']);
  assertDownloaded(value);
}));

test('DOM and click failures remain failures instead of being reclassified as cancelled delivery', async () => {
  for (const stage of ['onCreateElement', 'onAppend', 'onClick'] as const) {
    for (const guarded of [false, true]) await withPlatform(async value => {
      const failure = new Error('platform failure at ' + stage);
      value.state[stage] = () => { throw failure; };
      if (guarded) await assert.rejects(downloadFile(blob, filename, () => true), error => error === failure);
      else assert.throws(() => downloadFile(blob, filename), error => error === failure);
      assertWithheld(value);
    });
  }
});

test('a share-unavailable fallback forwards its original context through final DOM preparation', async () => withPlatform(async value => {
  value.state.coarse = true;
  value.shareWith(async () => { throw new Error('sharing unavailable'); });
  let current = true;
  value.state.onAppend = () => { current = false; };
  assert.equal(await deliverFile(blob, filename, 'Saved source', () => current), 'cancelled');
  assert.equal(value.state.shares, 1);
  assert.equal(value.createdUrls.length, 1);
  assertWithheld(value);
}));

test('share fallback also forwards synchronous revocation across the final promise-continuation gap', async () => withPlatform(async value => {
  value.state.coarse = true;
  value.shareWith(async () => { throw new Error('sharing unavailable'); });
  let current = true, queued = false, preparedChecks = 0;
  const result = await deliverFile(blob, filename, 'Saved source', () => {
    if (value.state.attached) {
      preparedChecks++;
      if (!queued) {
        queued = true;
        queueMicrotask(() => { current = false; });
      }
    }
    return current;
  });
  assert.equal(result, 'cancelled');
  assert.equal(value.state.shares, 1);
  assert.equal(queued, true);
  assert.ok(preparedChecks >= 2, 'the same original predicate runs again at the synchronous click boundary');
  assert.equal(value.createdUrls.length, 1);
  assertWithheld(value);
}));

test('share cancellation still completes without downloading and desktop still prefers a download', async () => {
  await withPlatform(async value => {
    value.state.coarse = true;
    value.shareWith(async () => { const error = new Error('dismissed'); error.name = 'AbortError'; throw error; });
    assert.equal(await deliverFile(blob, filename, 'Saved source', () => true), 'cancelled');
    assert.equal(value.state.shares, 1);
    assert.equal(value.createdUrls.length, 0);
    assertWithheld(value);
  });
  await withPlatform(async value => {
    value.shareWith(async () => {});
    assert.equal(await deliverFile(blob, filename, 'Saved source', () => true), 'downloaded');
    assert.equal(value.state.shares, 0);
    assertDownloaded(value);
  });
});

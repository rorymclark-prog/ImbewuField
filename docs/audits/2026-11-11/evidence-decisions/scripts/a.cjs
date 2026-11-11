const L = require('./lib.cjs'); const { chromium, log, D } = L;
const chip = (p) => p.locator('header span').filter({ hasText: /\(fallback\)|satellite records for this site|chosen by you|still loading/ }).first();
async function chipInfo(p) { const c = chip(p); if (!(await c.count())) return null; return { text: (await c.innerText()).trim(), title: await c.getAttribute('title') }; }
async function noteOf(dlg) { const sel = dlg.getByLabel('Sowing calendar for this site'); const note = await sel.evaluate((s) => { let n = s.closest('label') || s.parentElement; const parent = n.parentElement; return (parent.innerText || '').trim(); }); return note; }
(async () => {
  const browser = await chromium.launch(); const errs = [];
  for (const [id, mode] of [['A1', '401'], ['A2', 'abort'], ['A4', 'none']]) {
    log('\n== ' + id + ' ' + mode);
    const ctx = await L.ctxOf(browser); const p = await ctx.newPage(); L.watch(p, id, errs);
    if (mode === '401') await p.route('**/api/location-data*', (r) => r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Authentication required."}' }));
    if (mode === 'abort') await p.route('**/api/location-data*', (r) => r.abort());
    await L.gotoCrops(p); await p.waitForTimeout(4000);
    log('header chip:', JSON.stringify(await chipInfo(p)));
    log('overflow phone:', JSON.stringify(await L.overflow(p)));
    const dlg = await L.openAuto(p);
    const sel = dlg.getByLabel('Sowing calendar for this site');
    log('select options:', JSON.stringify(await sel.locator('option').allInnerTexts()));
    log('select container text:', JSON.stringify(await noteOf(dlg)));
    await sel.scrollIntoViewIfNeeded(); await p.screenshot({ path: `${D}/${id}-autosuggest-note-phone-light.png` });
    if (id === 'A1') {
      await sel.selectOption('mild-frost'); await p.waitForTimeout(900);
      log('dialogs after choosing:', await p.locator('[role=dialog]').count());
      await p.keyboard.press('Escape'); await p.waitForTimeout(3500);
      log('header chip after choice:', JSON.stringify(await chipInfo(p)));
      await p.screenshot({ path: `${D}/A1-header-after-choice-phone-light.png` });
    }
    await ctx.close();
  }
  { log('\n== A1 dark phone');
    const ctx = await L.ctxOf(browser, { dark: true }); const p = await ctx.newPage(); L.watch(p, 'A1d', errs);
    await p.route('**/api/location-data*', (r) => r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Authentication required."}' }));
    await L.gotoCrops(p); await p.waitForTimeout(4000);
    const dlg = await L.openAuto(p); await dlg.getByLabel('Sowing calendar for this site').scrollIntoViewIfNeeded();
    log('dark data-theme/bg:', await p.evaluate(() => getComputedStyle(document.body).backgroundColor));
    await p.screenshot({ path: `${D}/A1-autosuggest-note-phone-dark.png` }); await ctx.close(); }
  { log('\n== A1 header desktop');
    const ctx = await L.ctxOf(browser, { phone: false }); const p = await ctx.newPage(); L.watch(p, 'A1x', errs);
    await p.route('**/api/location-data*', (r) => r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Authentication required."}' }));
    await L.gotoCrops(p); await p.waitForTimeout(4000);
    log('chip', JSON.stringify(await chipInfo(p))); await p.screenshot({ path: `${D}/A1-header-desktop.png` }); await ctx.close(); }
  { log('\n== A3 slow');
    const ctx = await L.ctxOf(browser); const p = await ctx.newPage(); L.watch(p, 'A3', errs);
    await p.route('**/api/location-data*', async (r) => { await new Promise((x) => setTimeout(x, 20000)); r.continue().catch(() => {}); });
    await p.goto(L.BASE + '/facilitator/crops', { waitUntil: 'domcontentloaded', timeout: 300000 });
    await L.settle(p, async () => { await p.locator('[data-crop-bed-scroll]').waitFor({ state: 'attached', timeout: 90000 }); });
    const t0 = Date.now();
    log('chip at +0:', JSON.stringify(await chipInfo(p)));
    const dlg = await L.openAuto(p); log('note at +' + (Date.now() - t0) + 'ms:', JSON.stringify(await noteOf(dlg)));
    await dlg.getByLabel('Sowing calendar for this site').scrollIntoViewIfNeeded(); await p.screenshot({ path: `${D}/A3-autosuggest-note-loading-phone-light.png` });
    await p.waitForTimeout(25000); log('note after 25s+:', JSON.stringify(await noteOf(dlg)));
    await ctx.close(); }
  log('\nERRORS', JSON.stringify(errs, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message.slice(0, 1500)); process.exit(1); });

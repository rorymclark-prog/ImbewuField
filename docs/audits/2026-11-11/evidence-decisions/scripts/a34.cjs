const L = require('./lib.cjs'); const { chromium, log, D } = L;
const chip = (p) => p.locator('header span').filter({ hasText: /\(fallback\)|satellite records for this site|chosen by you/ }).first();
const chipInfo = async (p) => { const c = chip(p); return (await c.count()) ? { text: (await c.innerText()).trim(), title: await c.getAttribute('title') } : null; };
const noteOf = (dlg) => dlg.getByLabel('Sowing calendar for this site').evaluate((s) => (s.closest('label') || s.parentElement).parentElement.innerText.trim());
(async () => {
  const browser = await chromium.launch(); const errs = [];
  { log('== A3 slow (20 s delay on /api/location-data)');
    const ctx = await L.ctxOf(browser); const p = await ctx.newPage(); L.watch(p, 'A3', errs);
    let hits = 0; await p.route('**/api/location-data*', async (r) => { hits++; await new Promise((x) => setTimeout(x, 20000)); r.continue().catch(() => {}); });
    await p.goto(L.BASE + '/facilitator/crops', { waitUntil: 'domcontentloaded', timeout: 300000 }); await p.waitForTimeout(3000);
    await L.settle(p);
    const btn = p.getByRole('button', { name: /Auto-suggest a plan/i }).first(); await btn.waitFor({ timeout: 120000 });
    const t0 = Date.now(); log('location-data requests so far:', hits, 'chip', JSON.stringify(await chipInfo(p)));
    const dlg = await L.openAuto(p); log('note at +' + (Date.now() - t0) + 'ms:', JSON.stringify(await noteOf(dlg)));
    await dlg.getByLabel('Sowing calendar for this site').scrollIntoViewIfNeeded(); await p.screenshot({ path: `${D}/A3-autosuggest-note-loading-phone-light.png` });
    await p.waitForTimeout(30000); log('requests', hits, 'note after +30s:', JSON.stringify(await noteOf(dlg)));
    await ctx.close(); }
  { log('\n== A4 no interception, wait for climate');
    const ctx = await L.ctxOf(browser); const p = await ctx.newPage(); L.watch(p, 'A4', errs);
    p.on('response', (r) => { if (/location-data/.test(r.url())) log('  location-data', r.status(), r.url().slice(-60)); });
    await L.gotoCrops(p);
    for (let i = 0; i < 40; i++) { const c = await chipInfo(p); if (c && /satellite records/.test(c.text)) break; await p.waitForTimeout(3000); }
    log('header chip:', JSON.stringify(await chipInfo(p)));
    const dlg = await L.openAuto(p); log('note:', JSON.stringify(await noteOf(dlg)));
    await dlg.getByLabel('Sowing calendar for this site').scrollIntoViewIfNeeded(); await p.screenshot({ path: `${D}/A4-autosuggest-note-phone-light.png` });
    await ctx.close(); }
  log('\nERRORS', JSON.stringify(errs, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message.slice(0, 1500)); process.exit(1); });

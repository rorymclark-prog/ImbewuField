const L = require('./lib.cjs'); const { chromium, log, D } = L;
(async () => { const browser = await chromium.launch();
  for (const [name, o] of [['light', {}], ['dark', { dark: true }]]) {
    const ctx = await L.ctxOf(browser, o); const p = await ctx.newPage();
    await p.route('**/api/location-data*', (r) => r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Authentication required."}' }));
    await L.gotoCrops(p); await p.waitForTimeout(4000); const dlg = await L.openAuto(p);
    const note = dlg.getByText(/Sign in, or choose your own sowing calendar/).last(); await note.scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
    log(name, 'note:', await note.innerText(), '| contains offline/loading:', /offline|loading/i.test(await note.innerText()));
    await p.screenshot({ path: `${D}/A1-autosuggest-note-phone-${name}.png` }); await ctx.close(); }
  await browser.close(); })().catch((e) => { console.error('FAIL', e.message.slice(0, 800)); process.exit(1); });

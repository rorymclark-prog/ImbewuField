const L = require('./lib.cjs'); const { chromium, log, D } = L;
(async () => { const browser = await chromium.launch();
  for (const [id, name, o, mode, re] of [['A1', 'light', {}, '401', /signed-in growers only/], ['A1', 'dark', { dark: true }, '401', /signed-in growers only/], ['A2', 'light', {}, 'abort', /could not be read just now/]]) {
    const ctx = await L.ctxOf(browser, o); const p = await ctx.newPage();
    await p.route('**/api/location-data*', (r) => mode === '401' ? r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Authentication required."}' }) : r.abort());
    await L.gotoCrops(p); await p.waitForTimeout(4000); const dlg = await L.openAuto(p);
    const par = dlg.locator('p', { hasText: re }).last(); await par.evaluate((e) => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(500);
    const bb = await par.boundingBox(); log(id, name, 'note:', await par.innerText(), '| in viewport:', bb && bb.y >= 0 && bb.y + bb.height <= 844);
    await p.screenshot({ path: `${D}/${id}-autosuggest-note-phone-${name}.png` }); await ctx.close(); }
  await browser.close(); })().catch((e) => { console.error('FAIL', e.message.slice(0, 800)); process.exit(1); });

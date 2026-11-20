const L = require('./lib.cjs'); const { chromium, log, D } = L;
(async () => { const browser = await chromium.launch();
  for (const [name, o] of [['phone-light', {}], ['phone-dark', { dark: true }], ['desktop', { phone: false }]]) {
    const ctx = await L.ctxOf(browser, o); const p = await ctx.newPage();
    await L.gotoCrops(p); for (let i = 0; i < 30; i++) { if (await p.locator('header span', { hasText: 'satellite records for this site' }).count()) break; await p.waitForTimeout(3000); } await p.waitForTimeout(2000);
    await p.goto(L.BASE + '/calendar', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(6000); await L.settle(p); await p.waitForTimeout(2500);
    const sec = p.locator('section[aria-label="Calendar reference context"]');
    await sec.locator('label', { hasText: /^Calendar context/ }).locator('select').selectOption({ index: 1 });
    const sel = sec.locator('label', { hasText: /^Sowing calendar/ }).locator('select'); await sel.waitFor({ timeout: 25000 }); await sel.selectOption('farm'); await p.waitForTimeout(2500);
    const lab = p.getByText(/Hot area, no frost · this farm.s crop plan/).first(); await lab.scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -120)); await p.waitForTimeout(500);
    log(name, 'label text:', await lab.innerText()); await p.screenshot({ path: `${D}/B2-picked-at-month-heading-${name}.png` }); await ctx.close(); }
  await browser.close(); })().catch((e) => { console.error('FAIL', e.message.slice(0, 800)); process.exit(1); });

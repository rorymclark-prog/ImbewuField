// The sample farm's fixed sowing calendar, on the public sample farm.
// Run twice by the script itself: with the climate route aborted, and with it answering.
// Usage: OUT=<dir for screenshots> DL=<dir for PDFs> node sample-calendar-check.cjs   (BASE defaults to a dev server on :4242)
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:4242'; const OUT = process.env.OUT; const DL = process.env.DL;
const log = (...a) => console.log(...a);
async function open(browser, { blockClimate, mode = 'light', level = 'simple', width = 390, height = 844 }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: width < 600 ? 2 : 1, colorScheme: mode, acceptDownloads: true });
  await ctx.addInitScript(([m]) => { try { sessionStorage.setItem('imbewu_sample_mode', '1'); localStorage.setItem('fp-mode', m); } catch {} }, [mode]);
  const climate = [];
  await ctx.route('**/api/location-data**', (route) => (blockClimate ? route.abort() : route.continue()));
  const p = await ctx.newPage(); p.on('pageerror', (e) => log('PAGEERROR', e.message.slice(0, 200)));
  p.on('response', (r) => { if (r.url().includes('/api/location-data')) climate.push(r.status()); });
  p.on('requestfailed', (r) => { if (r.url().includes('/api/location-data')) climate.push('aborted'); });
  await p.goto(BASE + '/facilitator/crops', { waitUntil: 'domcontentloaded', timeout: 240000 }); await p.waitForTimeout(5000);
  await p.evaluate((lv) => { localStorage.setItem('imbewu_app_level_v1', lv); window.dispatchEvent(new CustomEvent('imbewu-app-level-changed')); }, level); await p.waitForTimeout(800);
  const panel = p.locator('section[aria-label="Site country and region"]');
  if (await panel.count() && await panel.locator('button[type=submit]').count()) { await panel.locator('select').first().selectOption('ZA').catch(() => {}); await panel.getByRole('checkbox').check().catch(() => {}); await panel.locator('button[type=submit]').last().click().catch(() => {}); }
  await p.locator('[data-crop-bed-scroll]').waitFor({ state: 'attached', timeout: 90000 }); await p.waitForTimeout(blockClimate ? 4000 : 12000);
  const dismiss = async () => { const t = p.getByText('Update ready').first(); if (await t.count()) { await t.locator('xpath=ancestor::*[.//button][1]').locator('button').last().click().catch(() => {}); await p.waitForTimeout(300); } };
  const notice = p.locator('section[aria-label="Sowings outside the sowing calendar"]');
  const openModal = async () => { const b = p.getByRole('button', { name: /Auto-suggest a plan/i }).first(); await b.scrollIntoViewIfNeeded(); await b.click(); await p.waitForTimeout(1000); return p.locator('[role=dialog]').last(); };
  const box = async () => { const dlg = await openModal(); const sel = dlg.getByLabel('Sowing calendar for this site');
    const card = sel.locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
    const out = { value: await sel.inputValue(), firstOption: await sel.locator('option').first().innerText(), text: (await card.innerText()).replace(/\n+/g, ' | ').slice(0, 900) };
    return { dlg, sel, out }; };
  const close = async () => { await p.keyboard.press('Escape'); await p.waitForTimeout(700); };
  const choose = async (v) => { const { sel } = await box(); await sel.selectOption(v); await p.waitForTimeout(900); await close(); };
  return { ctx, p, dismiss, notice, box, close, choose, climate: () => climate };
}
(async () => {
  const browser = await chromium.launch();
  for (const blockClimate of [true, false]) {
    const tag = blockClimate ? 'climate BLOCKED' : 'climate ANSWERING';
    const s = await open(browser, { blockClimate });
    log(`\n== Phone 390 px, ${tag}; climate route answers: ${JSON.stringify(s.climate())}`);
    log('out-of-season list on first open:', await s.notice.count());
    let b = await s.box(); log('calendar box:', JSON.stringify(b.out));
    await b.sel.scrollIntoViewIfNeeded(); await s.dismiss(); await s.p.screenshot({ path: `${OUT}/sample-calendar-box-phone-light-${blockClimate ? 'blocked' : 'answering'}.png` }); await s.close();
    await s.choose('summer');
    log('after the visitor chooses Winter frost: list rows', await s.notice.count() ? (await s.notice.locator('li').count()) : 0, '| reason:', await s.notice.locator('p').first().innerText().catch(() => null));
    b = await s.box(); log('calendar box with a visitor choice:', JSON.stringify(b.out)); await s.close();
    await s.choose('');
    b = await s.box(); log('after "Sample farm calendar" again:', JSON.stringify({ value: b.out.value, firstOption: b.out.firstOption }), '| list:', await s.notice.count()); await s.close();
    if (blockClimate) {
      const btn = s.p.getByRole('button', { name: /Download the plan \(PDF\)|Share the plan \(PDF\)/ }).first();
      if (await btn.count()) { await btn.scrollIntoViewIfNeeded(); const dl = s.p.waitForEvent('download', { timeout: 180000 }).catch((e) => { log('no download:', e.message.slice(0, 100)); return null; }); await btn.click(); const d = await dl; if (d) { const f = `${DL}/sample-farm-plan.pdf`; await d.saveAs(f); log('PDF saved', fs.statSync(f).size, 'bytes'); } } else log('PDF button not found');
    }
    await s.ctx.close();
  }
  { const s = await open(browser, { blockClimate: true, mode: 'dark' });
    const b = await s.box(); await b.sel.scrollIntoViewIfNeeded(); await s.dismiss(); await s.p.screenshot({ path: `${OUT}/sample-calendar-box-phone-dark-blocked.png` });
    log('\n== Phone dark, climate BLOCKED: box', JSON.stringify(b.out.text.slice(0, 160)), '| overflow px:', await s.p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)); await s.close(); await s.ctx.close(); }
  for (const blockClimate of [true, false]) { const s = await open(browser, { blockClimate, level: 'all', width: 1280, height: 900 });
    log(`\n== Desktop 1280 px, ${blockClimate ? 'climate BLOCKED' : 'climate ANSWERING'}; header chip:`, await s.p.locator('header span', { hasText: /set for the sample farm|chosen by you|satellite records|nearest reference|No site set/ }).first().innerText().catch(() => null), '| list:', await s.notice.count());
    await s.p.evaluate(() => window.scrollTo(0, 0)); await s.dismiss(); if (blockClimate) await s.p.screenshot({ path: `${OUT}/sample-calendar-header-desktop-blocked.png` }); await s.ctx.close(); }
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message.slice(0, 1200)); process.exit(1); });

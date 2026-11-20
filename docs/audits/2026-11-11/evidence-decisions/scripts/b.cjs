const L = require('./lib.cjs'); const { chromium, log, D } = L;
const errs = [];
const OLD = /Summer-rainfall pattern|Winter-rainfall pattern|reference pattern/i;
async function cal(p) {
  await p.goto(L.BASE + '/calendar', { waitUntil: 'domcontentloaded', timeout: 300000 }); await p.waitForTimeout(6000);
  await L.settle(p); await p.waitForTimeout(2500);
  const sec = p.locator('section[aria-label="Calendar reference context"]'); await sec.waitFor({ timeout: 90000 }); return sec;
}
const ctxSel = (sec) => sec.locator('label', { hasText: /^Calendar context/ }).locator('select');
const calSel = (sec) => sec.locator('label', { hasText: /^Sowing calendar/ }).locator('select');
async function state(p, sec, tag) {
  const out = { tag };
  out.contextOptions = await ctxSel(sec).locator('option').allInnerTexts();
  out.hasSowingSelect = await calSel(sec).count();
  if (out.hasSowingSelect) { out.options = await calSel(sec).locator('option').allInnerTexts(); out.value = await calSel(sec).inputValue(); }
  out.notKnown = (await sec.innerText()).includes("This farm’s calendar is not known on this device yet. Open its crop plan once, or choose a calendar here.");
  const txt = await p.locator('body').innerText();
  out.oldNames = (txt.match(OLD) || null);
  out.gridOrTable = await p.locator('table, [aria-label="South African planting calendar"]').count();
  out.hasPicked = /this farm.s crop plan$/m.test(txt) || /· this farm.s crop plan/.test(txt);
  out.overflow = await L.overflow(p);
  log(JSON.stringify(out, null, 1)); return out;
}
async function pickSite(sec) { const o = await ctxSel(sec).locator('option').allInnerTexts(); const i = o.findIndex((t) => /· saved site/.test(t)); await ctxSel(sec).selectOption({ index: i }); await calSel(sec).waitFor({ timeout: 25000 }).catch(() => log('  (no Sowing calendar select appeared in 25 s)')); }
(async () => {
  const browser = await chromium.launch();
  { log('== B1 fresh, /calendar directly');
    const ctx = await L.ctxOf(browser); const p = await ctx.newPage(); L.watch(p, 'B1', errs);
    await p.route('**/api/location-data*', (r) => r.abort());
    await L.gotoCrops(p); await p.waitForTimeout(5000);
    log('B1 setup: opened crop plan once with /api/location-data aborted (country panel -> ZA); chip:', await p.locator('header span', { hasText: /\(fallback\)|satellite/ }).first().innerText());
    const sec = await cal(p); await state(p, sec, 'B1 initial');
    await pickSite(sec); await p.waitForTimeout(1500); await state(p, sec, 'B1 saved site chosen');
    await sec.scrollIntoViewIfNeeded(); await p.screenshot({ path: `${D}/B1-not-known-phone-light.png` });
    log('section text:', JSON.stringify(await sec.innerText()));
    await ctx.close(); }
  for (const [name, o] of [['phone-light', {}], ['phone-dark', { dark: true }], ['desktop', { phone: false }]]) {
    log('\n== B2 ' + name + ' (crop plan once, then /calendar)');
    const ctx = await L.ctxOf(browser, o); const p = await ctx.newPage(); L.watch(p, 'B2' + name, errs);
    await L.gotoCrops(p);
    for (let i = 0; i < 40; i++) { if (await p.locator('header span', { hasText: 'satellite records for this site' }).count()) break; await p.waitForTimeout(3000); }
    await p.waitForTimeout(2000);
    const sec = await cal(p); await pickSite(sec); await p.waitForTimeout(1500);
    await state(p, sec, 'B2 site chosen ' + name);
    if (name === 'phone-light') { await calSel(sec).scrollIntoViewIfNeeded(); await p.screenshot({ path: `${D}/B2-options-phone-light.png` }); }
    await calSel(sec).selectOption('farm'); await p.waitForTimeout(2000);
    await state(p, sec, 'B2 farm picked ' + name);
    const near = await p.evaluate(() => { const t = document.body.innerText; const i = t.indexOf("this farm’s crop plan"); return i < 0 ? null : t.slice(Math.max(0, i - 200), i + 60); });
    log('text near "this farm’s crop plan":', JSON.stringify(near));
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500);
    await p.screenshot({ path: `${D}/B2-picked-${name}.png` });
    await p.screenshot({ path: `${D}/B2-picked-${name}-full.png`, fullPage: false });
    if (name === 'phone-light') {
      // B3
      log('\n== B3 choose Light frost at most in crop plan');
      await L.gotoCrops(p); await p.waitForTimeout(3000);
      const dlg = await L.openAuto(p); await dlg.getByLabel('Sowing calendar for this site').selectOption('mild-frost'); await p.waitForTimeout(1200); await p.keyboard.press('Escape'); await p.waitForTimeout(3000);
      const s2 = await cal(p); await pickSite(s2); await p.waitForTimeout(1500);
      await state(p, s2, 'B3 site chosen'); await s2.scrollIntoViewIfNeeded(); await p.screenshot({ path: `${D}/B3-options-phone-light.png` });
      await calSel(s2).selectOption('farm'); await p.waitForTimeout(1500); await state(p, s2, 'B3 farm picked');
    }
    await ctx.close(); }
  { log('\n== B4 reference guide');
    const ctx = await L.ctxOf(browser); const p = await ctx.newPage(); L.watch(p, 'B4', errs);
    const sec = await cal(p);
    await ctxSel(sec).selectOption({ label: 'South African reference guide · no mapped farm' }); await p.waitForTimeout(1500);
    const cb = sec.getByRole('checkbox'); log('checkboxes in section:', await cb.count());
    if (await cb.count()) { await cb.first().check().catch((e) => log('check fail', e.message.slice(0, 80))); await p.waitForTimeout(800); }
    const btns = await sec.getByRole('button').allInnerTexts(); log('section buttons:', JSON.stringify(btns));
    for (const b of btns) if (/save|confirm|acknowledg|continue/i.test(b)) { await sec.getByRole('button', { name: b }).first().click().catch(() => {}); await p.waitForTimeout(800); break; }
    await state(p, sec, 'B4 reference chosen');
    if (await calSel(sec).count()) { await calSel(sec).selectOption('winter'); await p.waitForTimeout(1500).catch(()=>{}); await state(p, sec, 'B4 winter picked'); await p.screenshot({ path: `${D}/B4-winter-phone-light.png` }); }
    log('section text:', JSON.stringify(await sec.innerText()));
    await ctx.close(); }
  log('\nERRORS', JSON.stringify(errs, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message.slice(0, 1500)); process.exit(1); });

const L = require('./lib.cjs'); const { chromium, log, D } = L; const errs = [];
const OLD = /Summer-rainfall pattern|Winter-rainfall pattern|reference pattern/i;
const ctxSel = (sec) => sec.locator('label', { hasText: /^Calendar context/ }).locator('select');
const calSel = (sec) => sec.locator('label', { hasText: /^Sowing calendar/ }).locator('select');
async function cal(p) { await p.goto(L.BASE + '/calendar', { waitUntil: 'domcontentloaded', timeout: 300000 }); await p.waitForTimeout(6000); await L.settle(p); await p.waitForTimeout(2500);
  const sec = p.locator('section[aria-label="Calendar reference context"]'); await sec.waitFor({ timeout: 90000 }); return sec; }
async function pickSite(sec) { await ctxSel(sec).selectOption({ label: 'Ubhejane Crèche · saved site' }); await calSel(sec).waitFor({ timeout: 25000 }).catch(() => log('  (no Sowing select in 25 s)')); await sec.page().waitForTimeout(1200); }
async function state(p, sec, tag) {
  const o = { tag }; o.options = (await calSel(sec).count()) ? await calSel(sec).locator('option').allInnerTexts() : null;
  o.value = (await calSel(sec).count()) ? await calSel(sec).inputValue() : null;
  const t = await sec.innerText();
  o.noteLine = (t.match(/This farm.s crop plan uses the[^\n]*/) || [null])[0];
  o.notKnownLine = t.includes('This farm’s calendar is not known on this device yet. Open its crop plan once, or choose a calendar here.');
  o.oldNames = ((await p.locator('body').innerText()).match(OLD) || null);
  o.grid = await p.locator('table, [aria-label="South African planting calendar"]').count();
  o.overflow = await L.overflow(p);
  if (await calSel(sec).count()) o.trunc = await calSel(sec).evaluate((s) => { const cs = getComputedStyle(s); const c = document.createElement('canvas').getContext('2d'); c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const txt = s.options[s.selectedIndex].text; const inner = s.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); return { selected: txt, textWidthPx: Math.round(c.measureText(txt).width), innerWidthPx: Math.round(inner), clientWidth: s.clientWidth, scrollWidth: s.scrollWidth,
      longestOption: Math.round(Math.max(...[...s.options].map((x) => c.measureText(x.text).width))) }; });
  log(JSON.stringify(o, null, 1)); return o; }
(async () => {
  const browser = await chromium.launch();
  { log('== B1'); const ctx = await L.ctxOf(browser); const p = await ctx.newPage(); L.watch(p, 'B1', errs);
    await p.route('**/api/location-data*', (r) => r.abort()); await L.gotoCrops(p); await p.waitForTimeout(5000);
    const sec = await cal(p); await pickSite(sec); await state(p, sec, 'B1 site chosen'); await ctx.close(); }
  for (const [name, o] of [['phone-light', {}], ['phone-dark', { dark: true }], ['desktop', { phone: false }]]) {
    log('\n== B2 ' + name); const ctx = await L.ctxOf(browser, o); let p = await ctx.newPage(); L.watch(p, 'B2' + name, errs);
    await L.gotoCrops(p); for (let i = 0; i < 30; i++) { if (await p.locator('header span', { hasText: 'satellite records for this site' }).count()) break; await p.waitForTimeout(3000); } await p.waitForTimeout(2000);
    const sec = await cal(p); await pickSite(sec); await state(p, sec, 'B2 site chosen ' + name);
    if (name === 'phone-light') { await calSel(sec).scrollIntoViewIfNeeded(); await p.screenshot({ path: `${D}/B2-options-phone-light.png` }); }
    await calSel(sec).selectOption('farm'); await p.waitForTimeout(2000); await state(p, sec, 'B2 farm picked ' + name);
    log('near label:', await p.evaluate(() => { const t = document.body.innerText; const i = t.indexOf('· this farm’s crop plan'); return i < 0 ? null : t.slice(Math.max(0, i - 40), i + 30); }));
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(400); await p.screenshot({ path: `${D}/B2-picked-${name}.png` });
    if (name === 'phone-light') {
      log('\n== B3'); await ctx.close(); { const ctx3 = await L.ctxOf(browser); const p3 = await ctx3.newPage(); L.watch(p3, 'B3', errs); await L.gotoCrops(p3); for (let i = 0; i < 30; i++) { if (await p3.locator('header span', { hasText: 'satellite records for this site' }).count()) break; await p3.waitForTimeout(3000); } p = p3; } await p.waitForTimeout(1); const dlg = await L.openAuto(p); await dlg.getByLabel('Sowing calendar for this site').selectOption('mild-frost'); await p.waitForTimeout(1200); await p.keyboard.press('Escape'); await p.waitForTimeout(3000);
      const s2 = await cal(p); await pickSite(s2); await state(p, s2, 'B3 site chosen'); await calSel(s2).scrollIntoViewIfNeeded(); await p.screenshot({ path: `${D}/B3-options-phone-light.png` });
      await calSel(s2).selectOption('farm'); await p.waitForTimeout(1500); await state(p, s2, 'B3 farm picked'); }
    await ctx.close(); }
  { log('\n== B4'); const ctx = await L.ctxOf(browser); const p = await ctx.newPage(); L.watch(p, 'B4', errs);
    const sec = await cal(p); await ctxSel(sec).selectOption({ label: 'South African reference guide · no mapped farm' }); await p.waitForTimeout(1500);
    await sec.getByRole('checkbox').first().check(); await sec.getByRole('button', { name: 'Save reference choice' }).click(); await p.waitForTimeout(1500);
    await state(p, sec, 'B4 reference'); await calSel(sec).selectOption('winter'); await p.waitForTimeout(1500); await state(p, sec, 'B4 winter'); await ctx.close(); }
  log('\nERRORS', JSON.stringify(errs, null, 1)); await browser.close();
})().catch((e) => { console.error('FAIL', e.message.slice(0, 1500)); process.exit(1); });

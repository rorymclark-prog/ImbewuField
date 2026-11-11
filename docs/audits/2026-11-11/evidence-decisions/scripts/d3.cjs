const L = require('./lib.cjs'); const { chromium, log, D } = L; const { openTargets, addTarget, cards } = require('./d1.cjs'); const errs = [];
const MODE = process.env.MODE || 'phone-light';
const opts = { 'phone-light': {}, 'phone-dark': { dark: true }, desktop: { phone: false } }[MODE];
async function flow(p, det, label) {
  for (const cb of ['Reliable irrigation for every crop cycle', 'Allow standard bed shares (whole open fields stay whole)']) { const c = det.getByLabel(cb); log('  ticking', cb, 'checked before:', await c.isChecked()); await c.check(); }
  await det.getByRole('button', { name: 'Suggest target sowings' }).click(); await p.waitForTimeout(2500);
  const rev = det.locator('section[aria-label="Target sowing review"]');
  log(label + ' review present:', await rev.count()); if (await rev.count()) { log('REVIEW TEXT:', JSON.stringify(await rev.innerText())); }
  const add = det.getByRole('button', { name: /dated sowings? to my plan/ });
  if (await add.count()) { await add.click(); await p.waitForTimeout(3000); log('  accepted'); } else log('  no accept button (no sowings proposed)');
  log(label + ' status:', JSON.stringify(await det.locator('[role=status]').allInnerTexts()));
}
(async () => {
  const browser = await chromium.launch(); const ctx = await L.ctxOf(browser, opts); const p = await ctx.newPage(); L.watch(p, 'D', errs);
  await L.gotoCrops(p); for (let i = 0; i < 30; i++) { if (await p.locator('header span', { hasText: 'satellite records for this site' }).count()) break; await p.waitForTimeout(3000); }
  log('MODE', MODE, 'chip ok');
  const det = await openTargets(p);
  log('\n== Target 1: Carrots 3 kg/week 2027-06..2027-08'); await addTarget(p, det, 'Carrots', 3, '2027-06', '2027-08');
  log('after save:', JSON.stringify(await cards(det), null, 1));
  await flow(p, det, 'T1');
  const c1 = await cards(det); log('after accept:', JSON.stringify(c1, null, 1));
  const card = det.locator('article:has([data-target-coverage])').first(); await card.scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
  await p.screenshot({ path: `${D}/D-target-card-carrots-jun-aug-${MODE}.png` });
  log('overflow', JSON.stringify(await L.overflow(p)));
  log('\nERRORS', JSON.stringify(errs, null, 1)); await browser.close();
})().catch((e) => { console.error('FAIL', e.message.slice(0, 1500)); process.exit(1); });

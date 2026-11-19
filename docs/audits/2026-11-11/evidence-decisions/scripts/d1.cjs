const L = require('./lib.cjs'); const { chromium, log, D } = L; const errs = [];
async function openTargets(p) {
  const sum = p.locator('summary', { hasText: /Plan from weekly demand/ }).first(); await sum.waitFor({ timeout: 60000 }); await sum.scrollIntoViewIfNeeded();
  const det = p.locator('details', { has: sum }).first(); if (!(await det.evaluate((d) => d.open))) await sum.click(); await p.waitForTimeout(800); return det;
}
async function addTarget(p, det, crop, qty, start, end) {
  const form = det.locator('form').first();
  if (await form.getByLabel('Crop').isDisabled()) { log('  form disabled -> pressing "Reload saved harvest targets" (as the panel asks)'); await det.getByRole('button', { name: 'Reload saved harvest targets' }).click(); await p.waitForTimeout(2500); }
  await form.getByLabel('Crop').selectOption({ label: crop });
  await form.getByLabel(/Weekly quantity/).fill(String(qty));
  await form.getByLabel('First harvest month').fill(start); await form.getByLabel(/Last harvest month/).fill(end);
  await form.getByRole('button', { name: /Save harvest target|Save target changes/ }).click(); await p.waitForTimeout(2500);
  log('save status:', await det.locator('[role=status]').allInnerTexts());
}
async function cards(det) { return det.locator('article:has([data-target-coverage]), article:has(h3)').evaluateAll((els) => els.map((e) => ({ title: e.querySelector('h3')?.innerText, coverage: e.querySelector('[data-target-coverage]')?.getAttribute('data-target-coverage'), status: e.querySelector('[data-target-coverage]')?.innerText, text: e.innerText }))); }
module.exports = { openTargets, addTarget, cards };
if (require.main === module) (async () => {
  const browser = await chromium.launch(); const ctx = await L.ctxOf(browser); const p = await ctx.newPage(); L.watch(p, 'D', errs);
  await L.gotoCrops(p); for (let i = 0; i < 30; i++) { if (await p.locator('header span', { hasText: 'satellite records for this site' }).count()) break; await p.waitForTimeout(3000); }
  const det = await openTargets(p); log('panel text start:', (await det.innerText()).slice(0, 600));
  await addTarget(p, det, 'Carrots', 3, '2027-05', '2027-08');
  log(JSON.stringify(await cards(det), null, 1));
  await p.screenshot({ path: '/tmp/d1.png' });
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message.slice(0, 1500)); process.exit(1); });

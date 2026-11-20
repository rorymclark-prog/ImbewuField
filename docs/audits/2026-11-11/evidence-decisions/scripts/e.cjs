const L = require('./lib.cjs'); const { chromium, log, D, fs } = L; const errs = [];
const A = D + '/artifacts'; const SAMPLE = process.env.SAMPLE === '1';
(async () => {
  const browser = await chromium.launch(); const ctx = await L.ctxOf(browser, { phone: false, sample: SAMPLE, seed: !SAMPLE }); const p = await ctx.newPage(); L.watch(p, 'E', errs);
  await L.gotoCrops(p);
  if (!SAMPLE) for (let i = 0; i < 30; i++) { if (await p.locator('header span', { hasText: 'satellite records for this site' }).count()) break; await p.waitForTimeout(3000); }
  await p.waitForTimeout(3000);
  const dlg = await L.openAuto(p);
  log('Auto-suggest step 0 dialog buttons (last 6):', JSON.stringify((await dlg.getByRole('button').allInnerTexts()).slice(-6).map((s) => s.slice(0, 50))));
  const go = dlg.getByRole('button', { name: 'Suggest a plan', exact: true }); log('go buttons:', await go.count());
  await go.first().click({ timeout: 20000 }).catch((e) => log('go click fail', e.message.slice(0, 100))); await p.waitForTimeout(4000);
  const add = p.getByRole('button', { name: /^Add \d+ plantings? to my plan/ }); log('accept button:', await add.count(), (await add.count()) ? await add.first().innerText() : '');
  if (await add.count()) { await add.first().click(); await p.waitForTimeout(4000); }
  await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(1000);
  // list export-like controls
  const ctl = await p.locator('button, a').evaluateAll((els) => els.map((e) => (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ')).filter((t) => /pdf|csv|ics|calendar file|print|download|share|export|\.xlsx|spreadsheet/i.test(t)));
  log('export-like controls:', JSON.stringify([...new Set(ctl)]));
  const name = SAMPLE ? 'crop-plan-sample-farm' : 'crop-plan-local-farm';
  const dl = async (re, file) => { const btn = p.getByRole('button', { name: re }).first(); if (!(await btn.count())) { log('  not found:', re); return null; }
    await btn.scrollIntoViewIfNeeded(); const w = p.waitForEvent('download', { timeout: 180000 }).catch((e) => { log('  no download', e.message.slice(0, 80)); return null; }); await btn.click(); const d = await w; if (!d) return null;
    const f = file || `${A}/${d.suggestedFilename()}`; await d.saveAs(f); log('  saved', f, fs.statSync(f).size, 'bytes; suggested name', d.suggestedFilename()); return f; };
  const pdf = await dl(/Download the plan \(PDF\)|Share the plan \(PDF\)/, `${A}/${name}.pdf`);
  if (!SAMPLE) {
    for (const re of [/^Future harvest PDF/, /^Detailed reference PDF/, /CSV/i, /\.ics/i]) { const b = p.getByRole('button', { name: re }); if (await b.count()) { log('other export candidate:', re, await b.first().innerText()); const n = (await b.first().innerText()).replace(/\W+/g, '-').toLowerCase(); await dl(re, null); } }
    const keys = await p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/crop_plan/.test(k)) o[k] = localStorage.getItem(k); } return o; });
    fs.writeFileSync(`${A}/crop-plan-local-farm.json`, JSON.stringify(keys, null, 1)); log('json keys:', Object.keys(keys).join(','), JSON.stringify(Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, v.length]))));
  }
  log('overflow desktop', JSON.stringify(await L.overflow(p)));
  log('\nERRORS', JSON.stringify(errs, null, 1)); await browser.close();
})().catch((e) => { console.error('FAIL', e.message.slice(0, 1500)); process.exit(1); });

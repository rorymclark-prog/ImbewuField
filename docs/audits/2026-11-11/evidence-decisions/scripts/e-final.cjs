// Final export run for the review packet: the plan PDF, the two other PDFs, the calendar
// file (.ics) and the saved plan, from a plan the app itself suggested and the visitor accepted.
// SAMPLE=1 runs the sample farm. Sturdier than e.cjs: it waits for the suggested plan instead
// of a fixed pause, and it also takes the calendar file, which e.cjs did not look for.
const L = require('./lib.cjs'); const { chromium, log, D, fs } = L; const errs = [];
const A = D + '/artifacts'; const SAMPLE = process.env.SAMPLE === '1';
(async () => {
  const browser = await chromium.launch(); const ctx = await L.ctxOf(browser, { phone: false, sample: SAMPLE, seed: !SAMPLE }); const p = await ctx.newPage(); L.watch(p, 'E', errs);
  await L.gotoCrops(p);
  if (!SAMPLE) for (let i = 0; i < 40; i++) { if (await p.locator('header span', { hasText: 'satellite records for this site' }).count()) break; await p.waitForTimeout(3000); }
  log('header calendar chip:', JSON.stringify(await p.locator('header span', { hasText: /satellite records|sample farm|fallback|chosen by you/ }).allInnerTexts()));
  const dlg = await L.openAuto(p);
  await dlg.getByRole('button', { name: 'Suggest a plan', exact: true }).first().click({ timeout: 30000 });
  const add = p.getByRole('button', { name: /^Add \d+ plantings? to my plan/ }).first();
  await add.waitFor({ state: 'visible', timeout: 120000 });
  log('accept button:', await add.innerText());
  await add.click({ timeout: 15000 }).catch(async () => { log('  plain click blocked; clicking through the page'); await add.evaluate((el) => el.click()); });
  await p.waitForTimeout(5000); await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(1500);
  const stem = SAMPLE ? 'crop-plan-sample-farm' : 'crop-plan-local-farm';
  const take = async (re, file) => {
    const btn = p.getByRole('button', { name: re }).first();
    if (!(await btn.count())) { log('  not offered:', String(re)); return null; }
    const label = (await btn.innerText()).replace(/\s+/g, ' ');
    await btn.scrollIntoViewIfNeeded();
    const wait = p.waitForEvent('download', { timeout: 180000 }).catch((e) => { log('  no download for', label, e.message.slice(0, 80)); return null; });
    await btn.click(); const d = await wait; if (!d) return null;
    await d.saveAs(file); log(`  saved ${file.split('/').pop()} (${fs.statSync(file).size} bytes) from "${label}"; the app named it ${d.suggestedFilename()}`);
    await p.waitForTimeout(1500); return file;
  };
  await take(/Download the plan \(PDF\)|Share the plan \(PDF\)/, `${A}/${stem}.pdf`);
  const ics = await take(/^Add \d+ .*calendar/i, `${A}/${stem}.ics`);
  if (ics) { const text = fs.readFileSync(ics, 'utf8'); log(`  calendar file: ${(text.match(/BEGIN:VEVENT/g) || []).length} events; first lines: ${JSON.stringify(text.split(/\r?\n/).slice(0, 4))}`); }
  if (!SAMPLE) {
    await take(/^Future harvest PDF/, `${A}/${stem}-future-harvest.pdf`);
    await take(/^Detailed reference PDF/, `${A}/${stem}-reference.pdf`);
    const keys = await p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/crop_plan/.test(k)) o[k] = localStorage.getItem(k); } return o; });
    fs.writeFileSync(`${A}/${stem}.json`, JSON.stringify(keys, null, 1));
    const counts = Object.fromEntries(Object.entries(keys).map(([k, v]) => { try { return [k, (JSON.parse(v).plantings || []).length]; } catch { return [k, 'not a plan']; } }));
    log('  saved plan keys and planting counts:', JSON.stringify(counts));
  }
  log('ERRORS', JSON.stringify(errs)); await browser.close();
})().catch((e) => { console.error('FAIL', e.message.slice(0, 1200)); process.exit(1); });

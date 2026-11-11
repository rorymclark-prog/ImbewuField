// Follow-up to i.cjs: (A) the full stack of the Atlas "Invalid LngLat" error; (B) open the site data panel from
// the saved place on /farmer; (C) record frost months through the survey's own steps, then export the reference PDF.
//   node i2.cjs > ../outputs/I2.txt
const L = require('../../evidence-decisions/scripts/lib.cjs'); const { chromium, log, fs } = L;
const OUT = require('path').resolve(__dirname, '..'); const A = OUT + '/artifacts'; const SHOTS = OUT + '/screenshots';
(async () => {
  const browser = await chromium.launch();
  { log('== A  full stack of the first Atlas page error'); const ctx = await L.ctxOf(browser, { phone: true }); const p = await ctx.newPage(); let first = null;
    p.on('pageerror', (e) => { if (!first) first = e; });
    await p.goto(L.BASE + '/atlas', { waitUntil: 'networkidle', timeout: 300000 }).catch(() => {}); await p.waitForTimeout(4000);
    log(first ? (first.stack || first.message).split('\n').map((l) => l.replace(/webpack-internal:\/\/\/\(app-pages-browser\)\//, '').slice(0, 170)).join('\n') : 'no page error at load');
    await ctx.close(); }
  for (const dark of [false, true]) { log(`\n== B  /farmer, saved place, phone ${dark ? 'dark' : 'light'}`);
    const ctx = await L.ctxOf(browser, { phone: true, dark }); const p = await ctx.newPage(); p.on('response', (r) => { if (/location-data/.test(r.url())) log('  location-data', r.status()); });
    await p.goto(L.BASE + '/farmer?panel=Climate', { waitUntil: 'networkidle', timeout: 300000 }).catch(() => {}); await p.waitForTimeout(5000); await L.settle(p);
    for (const step of [() => p.getByText('Ubhejane Crèche').first(), () => p.getByRole('button', { name: /^Places/ }).first(), () => p.getByText('Ubhejane Crèche').last()]) {
      if (/Monthly sunshine is not shown/.test(await p.evaluate(() => document.body.innerText))) break;
      const t = step(); if (await t.count()) { await t.click({ timeout: 5000 }).catch(() => {}); await p.waitForTimeout(5000); } }
    const tab = p.getByRole('button', { name: /^Climate$/ }).first(); if (await tab.count()) { await tab.click({ timeout: 5000 }).catch(() => {}); await p.waitForTimeout(3000); }
    const body = await p.evaluate(() => document.body.innerText); const found = /Monthly sunshine is not shown/.test(body);
    log('  Climate tab reached:', found);
    if (found) { log('  lines:', JSON.stringify(body.split('\n').filter((l) => /sunshine|wind:|Wind|climate type|Climate zone|ecord low|December to|June to|No crops/.test(l)).slice(0, 20), null, 1));
      for (const [tag, re] of [['class', /No crops are suggested/], ['sun-wind', /Monthly wind is not shown/]]) { const t = p.getByText(re).first(); await t.scrollIntoViewIfNeeded(); await p.waitForTimeout(600); await p.screenshot({ path: `${SHOTS}/I-farmer-climate-${tag}-phone-${dark ? 'dark' : 'light'}.png` }); }
    } else { log('  page now shows:', JSON.stringify(body.split('\n').filter(Boolean).slice(0, 18))); await p.screenshot({ path: `${SHOTS}/I-farmer-${dark ? 'dark' : 'light'}-not-reached.png` }); }
    await ctx.close(); }
  { log('\n== C  record frost months through the survey, then export'); const ctx = await L.ctxOf(browser, { phone: false }); const p = await ctx.newPage();
    await L.gotoCrops(p); for (let i = 0; i < 40; i++) { if (await p.locator('header span', { hasText: 'satellite records for this site' }).count()) break; await p.waitForTimeout(3000); }
    const dlg = await L.openAuto(p); await dlg.getByRole('button', { name: 'Suggest a plan', exact: true }).first().click({ timeout: 30000 });
    const add = p.getByRole('button', { name: /^Add \d+ plantings? to my plan/ }).first(); await add.waitFor({ state: 'visible', timeout: 120000 });
    await add.click({ timeout: 15000 }).catch(async () => { await add.evaluate((el) => el.click()); }); await p.waitForTimeout(5000); await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(1500);
    await p.getByRole('button', { name: /site survey/i }).first().click(); await p.waitForTimeout(1500);
    const sheet = p.locator('[role=dialog][aria-label="Site questionnaire"]'); log('  survey open:', await sheet.count());
    let reached = false;
    for (let i = 0; i < 16 && !reached; i++) {
      if (await sheet.getByText('Have you seen frost in this growing area?').count()) { reached = true; break; }
      const names = await sheet.getByRole('button').allInnerTexts(); if (i === 0) log('  first screen buttons:', JSON.stringify(names.slice(0, 14)));
      const next = sheet.getByRole('button', { name: /^(Next|Continue|Start|Skip|Begin)/i }).last(); if (!(await next.count())) { log('  no next button; buttons:', JSON.stringify(names.slice(0, 14))); break; }
      await next.click({ timeout: 5000 }).catch(() => {}); await p.waitForTimeout(700); }
    log('  frost question reached:', reached);
    if (reached) { await sheet.getByText('Yes, we have seen frost here').first().click(); await p.waitForTimeout(500);
      for (const m of ['Apr', 'Jul', 'Dec']) { const b = sheet.getByRole('button', { name: new RegExp('^' + m) }).first(); if (await b.count()) { await b.scrollIntoViewIfNeeded(); await b.click(); } else log('  month button not found:', m); }
      await p.waitForTimeout(400); await p.screenshot({ path: `${SHOTS}/I-survey-frost-months.png` });
      for (let i = 0; i < 16; i++) { const save = sheet.getByRole('button', { name: /^(Save|Finish|Done|Save survey)/i }).last(); if (await save.count()) { log('  saving with:', await save.innerText()); await save.click().catch(() => {}); break; }
        const next = sheet.getByRole('button', { name: /^(Next|Continue|Skip)/i }).last(); if (!(await next.count())) break; await next.click().catch(() => {}); await p.waitForTimeout(600); }
      await p.waitForTimeout(3000); log('  survey still open:', await sheet.count());
      const lines = await p.evaluate(() => document.body.innerText.split('\n').filter((l) => /Frost has been observed|Frost-tender crops: frost months|Planned crops to check for frost|will hold ground in months when frost|: (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(, (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))*\.$/.test(l)));
      log('  guide after recording:', JSON.stringify(lines, null, 1));
      const notice = p.getByText('Planned crops to check for frost').first(); if (await notice.count()) { await notice.scrollIntoViewIfNeeded(); await p.waitForTimeout(500); await p.screenshot({ path: `${SHOTS}/I-plan-recorded-frost-desktop.png` }); }
      const btn = p.getByRole('button', { name: /^Detailed reference PDF/ }).first(); await btn.scrollIntoViewIfNeeded(); const wait = p.waitForEvent('download', { timeout: 180000 }).catch(() => null); await btn.click({ timeout: 20000 }).catch((e) => log('  export click failed', e.message.slice(0, 80))); const d = await wait;
      if (d) { const f = `${A}/reference-frost-recorded-apr-jul-dec.pdf`; await d.saveAs(f); log(`  saved ${f.split('/').pop()} (${fs.statSync(f).size} bytes)`); } }
    await ctx.close(); }
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message.slice(0, 900)); process.exit(1); });

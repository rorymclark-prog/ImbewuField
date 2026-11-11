// CP-108, CP-112, CP-107, CP-109: the crop plan page and its exported PDFs after the corrections.
//   node h-plan.cjs > ../outputs/H-plan.txt            (local fixture farm)
//   SAMPLE=1 node h-plan.cjs > ../outputs/H-sample.txt  (sample farm)
// The "local farm" is the published sample farm's design and coordinates saved as an ordinary farm in a
// signed-out browser with sample mode off (a constructed fixture, not grower data). No site survey is
// seeded, so the grower's frost months are NOT recorded: that is the case CP-108 is about.
const L = require('../../evidence-decisions/scripts/lib.cjs'); const { chromium, log, fs } = L; const errs = [];
const OUT = require('path').resolve(__dirname, '..'); const A = OUT + '/artifacts'; const SHOTS = OUT + '/screenshots';
const SAMPLE = process.env.SAMPLE === '1'; const stem = SAMPLE ? 'crop-plan-sample-farm' : 'crop-plan-local-farm';
(async () => {
  const browser = await chromium.launch(); const ctx = await L.ctxOf(browser, { phone: false, sample: SAMPLE, seed: !SAMPLE }); const p = await ctx.newPage(); L.watch(p, 'H', errs);
  await L.gotoCrops(p);
  if (!SAMPLE) for (let i = 0; i < 40; i++) { if (await p.locator('header span', { hasText: 'satellite records for this site' }).count()) break; await p.waitForTimeout(3000); }
  log('header calendar chip:', JSON.stringify(await p.locator('header span', { hasText: /satellite records|sample farm|fallback|chosen by you/ }).allInnerTexts()));
  const dlg = await L.openAuto(p);
  // CP-109: the always-shown reason, with its temperatures as printed.
  log('calendar reason lines with a temperature:', JSON.stringify((await dlg.innerText()).split('\n').filter((l) => /°C/.test(l)), null, 1));
  await dlg.getByRole('button', { name: 'Suggest a plan', exact: true }).first().click({ timeout: 30000 });
  const add = p.getByRole('button', { name: /^Add \d+ plantings? to my plan/ }).first();
  await add.waitFor({ state: 'visible', timeout: 120000 }); log('accept button:', await add.innerText());
  await add.click({ timeout: 15000 }).catch(async () => { await add.evaluate((el) => el.click()); });
  await p.waitForTimeout(5000); await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(1500);
  // CP-108 on the page: the production guide's observations and the survey button beside them.
  const notice = p.getByText('Frost-tender crops: frost months not confirmed').first();
  log('frost notice on the page:', await notice.count());
  if (await notice.count()) {
    const card = notice.locator('xpath=ancestor::*[.//button][1]');
    const text = await notice.locator('xpath=..').innerText().catch(() => '');
    log('notice text:', JSON.stringify(text.split('\n').filter(Boolean), null, 1));
    log('survey button near it:', JSON.stringify(await card.getByRole('button').allInnerTexts().catch(() => [])));
    await notice.scrollIntoViewIfNeeded(); await p.waitForTimeout(600);
    await p.screenshot({ path: `${SHOTS}/H-${SAMPLE ? 'sample' : 'local'}-frost-notice-desktop.png` });
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(1200); await notice.scrollIntoViewIfNeeded(); await p.waitForTimeout(600);
    await p.screenshot({ path: `${SHOTS}/H-${SAMPLE ? 'sample' : 'local'}-frost-notice-phone.png` });
    log('phone overflow:', JSON.stringify(await L.overflow(p)));
    await p.setViewportSize({ width: 1280, height: 800 }); await p.waitForTimeout(1200);
  }
  log('"Frost on this farm" lines:', JSON.stringify(await p.getByText(/Local frost observations are not recorded|Farmer reports no observed frost|Frost has been observed here/).allInnerTexts()));
  const take = async (re, file) => {
    const btn = p.getByRole('button', { name: re }).first();
    if (!(await btn.count())) { log('  not offered:', String(re)); return null; }
    const label = (await btn.innerText()).replace(/\s+/g, ' '); await btn.scrollIntoViewIfNeeded();
    const wait = p.waitForEvent('download', { timeout: 180000 }).catch((e) => { log('  no download for', label, e.message.slice(0, 80)); return null; });
    await btn.click(); const d = await wait; if (!d) return null;
    await d.saveAs(file); log(`  saved ${file.split('/').pop()} (${fs.statSync(file).size} bytes) from "${label}"`); await p.waitForTimeout(1500); return file;
  };
  await take(/Download the plan \(PDF\)|Share the plan \(PDF\)/, `${A}/${stem}.pdf`);
  if (!SAMPLE) { await take(/^Future harvest PDF/, `${A}/${stem}-future-harvest.pdf`); await take(/^Detailed reference PDF/, `${A}/${stem}-reference.pdf`); }
  log('ERRORS', JSON.stringify(errs.filter((e) => !/Mapbox|LngLat/.test(e)))); await browser.close();
})().catch((e) => { console.error('FAIL', e.message.slice(0, 1200)); process.exit(1); });

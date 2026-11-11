// Screenshots and the weekly-target flow for docs/audits/2026-11-10/crop-plan-reaudit-claude.md.
//
//   BASE_URL=http://localhost:4242 OUT=./raw-screens PLAYWRIGHT_MODULE=playwright node capture-screens.cjs [only-number ...]
//
// Writes the 17 numbered PNGs named in the record, plus weekly-target-flow.json (the text the
// weekly-target card and review actually showed) and capture-log.json (served build, and for
// every shot the viewport, theme, language, country state and whether the site climate loaded).
// Every shot starts from a new browser context and page load on the public sample farm.
// The committed PNGs were then reduced with ImageMagick; see README.md for that one command.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://localhost:4242';
const OUT = process.env.OUT || './raw-screens';
fs.mkdirSync(OUT, { recursive: true });
const only = new Set(process.argv.slice(2));

const PHONE = { w: 390, h: 844, dpr: 2 };
const SCROLLER = () => { const cal = document.querySelector('[data-crop-bed-scroll]'); let sc = cal ? cal.parentElement : null; while (sc && !(getComputedStyle(sc).overflowY === 'auto' && sc.scrollHeight > sc.clientHeight + 50)) sc = sc.parentElement; if (!sc) sc = [...document.querySelectorAll('div')].filter((d) => getComputedStyle(d).overflowY === 'auto' && d.scrollHeight > d.clientHeight + 50).sort((a, b) => b.scrollHeight - a.scrollHeight)[0]; if (sc) sc.setAttribute('data-audit-scroller', '1'); return !!sc; };

(async () => {
  const browser = await chromium.launch();
  const servedBuild = await fetch(BASE + '/api/build-info').then((r) => r.json()).then((j) => ({ branch: j.branch ?? null, sha: j.sha ?? null })).catch(() => ({ branch: null, sha: null }));
  const log = { servedBuild, site: 'public sample farm', shots: [] };
  const flow = {};

  const open = async ({ w = PHONE.w, h = PHONE.h, dpr = PHONE.dpr, mode = 'light', lang = 'en', level = 'simple', confirm = true, textscale = '1' } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, colorScheme: mode === 'dark' ? 'dark' : 'light' });
    await ctx.addInitScript(([m, l, ts]) => { try { sessionStorage.setItem('imbewu_sample_mode', '1'); if (l !== 'en') sessionStorage.setItem('imbewu_sample_lang', l); localStorage.setItem('fp-mode', m); localStorage.setItem('fp-theme', 'earth'); if (ts !== '1') localStorage.setItem('fp-textscale', ts); } catch {} }, [mode, lang, textscale]);
    const p = await ctx.newPage(); const climate = [];
    p.on('response', (r) => { if (r.url().includes('/api/location-data')) climate.push(r.status()); });
    await p.goto(BASE + '/facilitator/crops', { waitUntil: 'networkidle', timeout: 240000 }); await p.waitForTimeout(2500);
    await p.evaluate((lv) => { localStorage.setItem('imbewu_app_level_v1', lv); window.dispatchEvent(new CustomEvent('imbewu-app-level-changed')); }, level); await p.waitForTimeout(1000);
    if (confirm) {
      const panel = p.locator('section[aria-label="Site country and region"]');
      const climateAnswer = p.waitForResponse((r) => r.url().includes('/api/location-data'), { timeout: 45000 }).catch(() => null);
      await panel.locator('select').first().selectOption('ZA'); await panel.getByRole('checkbox').check(); await panel.locator('button[type=submit]').last().click();
      await p.locator('[data-crop-bed-scroll]').waitFor({ state: 'attached', timeout: 20000 });
      await climateAnswer; await p.waitForTimeout(2000);   // the site climate decides whether the fruit reference bars draw
    }
    await p.evaluate(SCROLLER);
    return { ctx, p, meta: { viewport: `${w}x${h}`, devicePixelRatio: dpr, theme: 'earth ' + mode, lang, level, countryHold: confirm ? 'confirmed as ZA' : 'left unconfirmed', appTextScale: +textscale, climate } };
  };
  // Put the top of `locator` `offset` px below the top of the scrolling area.
  const scrollTo = async (p, locator, offset = 8) => { await locator.first().evaluate((el, off) => { const sc = document.querySelector('[data-audit-scroller]'); const r = el.getBoundingClientRect(); const sr = sc.getBoundingClientRect(); sc.scrollTop += r.top - sr.top - off; }, offset); await p.waitForTimeout(350); };
  const save = async (p, meta, file, what) => { await p.screenshot({ path: `${OUT}/${file}` }); const refs = await p.evaluate(() => /·\s*reference/.test(document.body.innerText)); log.shots.push({ file, shows: what, ...meta, locationDataStatuses: meta.climate, fruitReferenceBarsOnPage: refs, climate: undefined }); console.log('saved', file); };
  const want = (n) => only.size === 0 || only.has(n);
  const details = (p, re) => p.locator('details', { has: p.locator('summary', { hasText: re }) }).first();

  if (want('01') || want('02')) { const { ctx, p, meta } = await open({ confirm: false });
    if (want('01')) await save(p, meta, '01-gate-first-screen-phone.png', 'first screen of the Production plan before the country is confirmed');
    if (want('02')) { await scrollTo(p, p.locator('section[aria-label="Planning support"]'), 60); await save(p, meta, '02-gate-hold-text-phone.png', 'the hold that replaces the planner'); }
    await ctx.close(); }
  if (want('03')) { const { ctx, p, meta } = await open({ confirm: false, lang: 'zu' }); await save(p, meta, '03-gate-isizulu-phone.png', 'the same first screen in isiZulu'); await ctx.close(); }
  if (want('04') || want('05') || want('06') || want('07') || want('17')) { const { ctx, p, meta } = await open();
    if (want('04')) await save(p, meta, '04-after-confirm-first-screen-phone.png', 'first screen after confirming South Africa');
    if (want('05')) { await p.evaluate(() => { const sc = document.querySelector('[data-audit-scroller]'); sc.scrollTop = sc.clientHeight - 140; }); await p.waitForTimeout(350); await save(p, meta, '05-after-confirm-second-screen-phone.png', 'second screen'); }
    if (want('06')) { await scrollTo(p, p.locator('[data-crop-month-header]'), 250); await save(p, meta, '06-calendar-phone-light.png', 'where the bed calendar starts; crop bar labels'); }
    if (want('07')) { await scrollTo(p, p.locator('[data-crop-calendar-section="trees"]'), 100); await save(p, meta, '07-sticky-header-bleed-and-clipped-notes-phone.png', 'section band and rows behind the pinned month header; clipped notes in the fruit and animal rows'); }
    if (want('17')) { await scrollTo(p, p.getByText('Fruit, nuts & berries on your map').first(), 130); await save(p, meta, '17-plant-list-repeated-phone.png', 'the plant list repeated below the calendar'); }
    await ctx.close(); }
  if (want('08')) { const { ctx, p, meta } = await open({ mode: 'dark' }); await scrollTo(p, p.locator('[data-crop-month-header]'), -150); await save(p, meta, '08-calendar-phone-dark.png', 'dark mode: current month label and bars'); await ctx.close(); }
  if (want('09')) { const { ctx, p, meta } = await open({ w: 1280, h: 800, dpr: 1 }); await scrollTo(p, p.locator('[data-crop-month-header]'), 60); await save(p, meta, '09-calendar-desktop-1280.png', 'desktop type sizes and the faded year-two bars'); await ctx.close(); }
  if (want('10')) { const { ctx, p, meta } = await open({ w: 640, h: 400, dpr: 2, level: 'full' }); await scrollTo(p, p.locator('[data-crop-month-header]'), 160); await save(p, { ...meta, note: 'a 640x400 CSS-pixel window at device pixel ratio 2: the layout a 1280x800 window gets at 200% zoom, emulated. Real browser zoom was not used.' }, '10-desktop-640x400-zoom-equivalent.png', 'room left for the plan at a 200%-zoom-equivalent window'); await ctx.close(); }
  if (want('11')) { const { ctx, p, meta } = await open({ lang: 'zu', textscale: '1.4' }); await scrollTo(p, p.locator('[data-crop-month-header]'), -420); await save(p, meta, '11-text-scale-140-isizulu-phone.png', 'app text size 1.4 in isiZulu'); await ctx.close(); }
  if (want('12') || want('13')) { const { ctx, p, meta } = await open();
    const ht = details(p, /Plan from weekly demand/); await ht.locator('summary').first().click(); await p.waitForTimeout(500);
    const form = ht.locator('form').first(); const selects = form.locator('select');
    for (let i = 0; i < await selects.count(); i++) { const opts = await selects.nth(i).locator('option').allInnerTexts(); if (opts.includes('Carrots')) { await selects.nth(i).selectOption({ label: 'Carrots' }); break; } }
    await form.getByLabel(/Weekly quantity/).fill('5'); await form.getByRole('button', { name: /Save harvest target/ }).click(); await p.waitForTimeout(900);
    const card = ht.locator('article').first(); flow.entered = { crop: 'Carrots', weeklyQuantity: '5', unit: 'kg', months: 'defaults (12 months from the current month)' };
    flow.targetCardText = (await card.innerText()).split('\n').map((s) => s.trim()).filter(Boolean);
    if (want('12')) { await scrollTo(p, card, 14); await save(p, meta, '12-weekly-target-card-phone.png', 'a saved 5 kg/week carrot target'); }
    await ht.getByLabel(/Reliable irrigation/).check(); await ht.getByRole('button', { name: /Suggest target sowings/ }).click(); await p.waitForTimeout(1500);
    const review = ht.locator('section[aria-label="Target sowing review"]'); flow.reviewText = (await review.innerText()).split('\n').map((s) => s.trim()).filter(Boolean);
    if (want('13')) { await scrollTo(p, review, 14); await save(p, meta, '13-weekly-target-review-phone.png', 'the proposal review for that target'); }
    flow.note = 'Synthetic entry on the public sample farm. Nothing was accepted onto the calendar.';
    await ctx.close(); }
  for (const [n, file, scope, text, what] of [['14', '14-sheet-crop-picker-phone.png', '[data-crop-bed-scroll]', '+ crop', 'crop picker sheet'], ['15', '15-sheet-planting-detail-phone.png', '[data-crop-bed-scroll]', 'Butternut', 'planting detail sheet']]) {
    if (!want(n)) continue; const { ctx, p, meta } = await open({ dpr: 1 });
    const btn = p.locator(scope).locator('button', { hasText: text }).first(); await btn.scrollIntoViewIfNeeded(); await btn.click(); await p.waitForTimeout(700); await save(p, meta, file, what); await ctx.close(); }
  if (want('16')) { const { ctx, p, meta } = await open(); const d = details(p, /Your growing estimates/); await d.locator('summary').first().click(); await p.waitForTimeout(600);
    await scrollTo(p, d.getByText('Establishment method').first(), 110); await save(p, meta, '16-own-estimates-form-phone.png', 'the own-estimate profile form'); await ctx.close(); }

  if (Object.keys(flow).length) fs.writeFileSync(`${OUT}/weekly-target-flow.json`, JSON.stringify({ servedBuild, ...flow }, null, 1));
  fs.writeFileSync(`${OUT}/capture-log.json`, JSON.stringify(log, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message.slice(0, 700)); process.exit(1); });

// The saved-plan path on a REAL local farm (signed out, not sample mode): the sample keeps its data in memory
// and forgets every edit on reload, so it cannot show whether a calendar choice is saved.
// The farm is the sample farm's design and saved place written into this browser's own storage by
// make-local-farm-seeds.ts. Nothing is sent anywhere: no account, no cloud write.
// Usage: node --import ./tests/register-alias.mjs make-local-farm-seeds.ts /tmp/seeds.json
//        SEEDS=/tmp/seeds.json OUT=<dir> DL=<dir for PDFs> node saved-plan-path-check.cjs   (dev server on :4242)
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:4242'; const OUT = process.env.OUT; const DL = process.env.DL;
const seeds = JSON.parse(fs.readFileSync(process.env.SEEDS, 'utf8'));
const log = (...a) => console.log(...a);
async function open(browser, { withOldPlan, level = 'simple', width = 390, height = 844 }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: width < 600 ? 2 : 1, acceptDownloads: true });
  await ctx.addInitScript(([design, plan, lv, places]) => { try {
    if (!localStorage.getItem('__review_seeded')) {
      localStorage.setItem('imbewu_facilitator_design_v1', design); localStorage.setItem('permamap_saved_places', places);
      if (plan) localStorage.setItem('imbewu_crop_plan_v1', plan);
      localStorage.setItem('permamap_onboarded', '1'); localStorage.setItem('imbewu_map_tips_seen', '1'); localStorage.setItem('imbewu_app_level_v1', lv); localStorage.setItem('fp-mode', 'light');
      localStorage.setItem('__review_seeded', '1');
    } } catch {} }, [seeds.design, withOldPlan ? seeds.plan : null, level, seeds.places]);
  const p = await ctx.newPage(); p.on('pageerror', (e) => log('PAGEERROR', e.message));
  let visits = 0;
  const enter = async () => {
    if (visits++ === 0) await p.goto(BASE + '/facilitator/crops', { waitUntil: 'networkidle', timeout: 240000 }); else await p.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
    await p.waitForTimeout(4000);
    const agree = p.getByRole('button', { name: 'I agree, continue' }); if (await agree.count()) { await agree.click(); await p.waitForTimeout(1500); }
    const goal = p.getByText('Feed my family').first(); if (await goal.count()) { await goal.click(); await p.waitForTimeout(400); await p.getByRole('button', { name: 'Get started' }).click().catch(() => {}); await p.waitForTimeout(1500); }
    const panel = p.locator('section[aria-label="Site country and region"]');
    if (await panel.count() && await panel.locator('button[type=submit]').count()) {
      await panel.locator('select').first().selectOption('ZA').catch(() => {}); await panel.getByRole('checkbox').check().catch(() => {}); await panel.locator('button[type=submit]').last().click().catch(() => {});
    }
    await p.locator('[data-crop-bed-scroll]').waitFor({ state: 'attached', timeout: 60000 }); await p.waitForTimeout(6000);
  };
  await enter();
  const notice = p.locator('section[aria-label="Sowings outside the sowing calendar"]');
  const openModal = async () => { const b = p.getByRole('button', { name: /Auto-suggest a plan/i }).first(); await b.scrollIntoViewIfNeeded(); await b.click(); await p.waitForTimeout(1000); return p.locator('[role=dialog]').last(); };
  const modalState = async () => { const dlg = await openModal(); const sel = dlg.getByLabel('Sowing calendar for this site');
    const out = { heading: await dlg.getByText(/Climate used automatically|Sowing calendar you chose/).first().innerText(), value: await sel.inputValue(), auto: await sel.locator('option').first().innerText() };
    await p.keyboard.press('Escape'); await p.waitForTimeout(600); return out; };
  const choose = async (v) => { const dlg = await openModal(); await dlg.getByLabel('Sowing calendar for this site').selectOption(v); await p.waitForTimeout(900); await p.keyboard.press('Escape'); await p.waitForTimeout(3500); };
  const stored = () => p.evaluate(() => { const out = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); const v = localStorage.getItem(k) || ''; if (/crop_plan/.test(k)) { let choices = null, plantings = null; try { const j = JSON.parse(v); const find = (o, key) => { if (!o || typeof o !== 'object') return undefined; if (key in o) return o[key]; for (const x of Object.values(o)) { const r = typeof x === 'string' && x.startsWith('{') ? (() => { try { return find(JSON.parse(x), key); } catch { return undefined; } })() : find(x, key); if (r !== undefined) return r; } return undefined; }; choices = find(j, 'sowingCalendarChoices') ?? null; const pl = find(j, 'plantings'); plantings = Array.isArray(pl) ? pl.length : null; } catch {} out[k] = { bytes: v.length, plantings, choices }; } } out.hidden = localStorage.getItem('imbewu_sowing_calendar_notice_hidden_v1'); return out; });
  const rows = async () => (await notice.count()) ? notice.locator('li').allInnerTexts() : [];
  const pdf = async (name) => { const btn = p.getByRole('button', { name: /Download the plan \(PDF\)|Share the plan \(PDF\)/ }).first(); if (!(await btn.count())) { log('  PDF button not found'); return null; }
    await btn.scrollIntoViewIfNeeded(); const dl = p.waitForEvent('download', { timeout: 180000 }).catch((e) => { log('  no download:', e.message.slice(0, 100)); return null; }); await btn.click(); const d = await dl; if (!d) return null; const f = `${DL}/${name}`; await d.saveAs(f); log('  PDF saved', name, fs.statSync(f).size, 'bytes'); return f; };
  return { ctx, p, enter, notice, modalState, choose, stored, rows, pdf };
}
(async () => {
  const browser = await chromium.launch();
  { log('== R1. A fresh farm with no saved plan at all');
    const s = await open(browser, { withOldPlan: false });
    log('stored at start:', JSON.stringify(await s.stored()));
    log('modal:', JSON.stringify(await s.modalState()));
    await s.choose('mild-frost');
    log('stored after choosing light frost:', JSON.stringify(await s.stored()));
    await s.enter();
    log('AFTER RELOAD modal:', JSON.stringify(await s.modalState()));
    await s.choose('');
    log('stored after "Let the app decide":', JSON.stringify(await s.stored()));
    await s.enter();
    log('AFTER RELOAD modal:', JSON.stringify(await s.modalState()));
    await s.ctx.close(); }
  { log('\n== R2. A plan saved before the calendar choice existed (15 sowings, old storage key)');
    const s = await open(browser, { withOldPlan: true });
    log('stored at start:', JSON.stringify(await s.stored()));
    log('modal:', JSON.stringify(await s.modalState()), '| list rows:', JSON.stringify(await s.rows()));
    await s.choose('mild-frost');
    log('after choosing light frost, list rows:', JSON.stringify(await s.rows()));
    log('reason:', await s.notice.locator('p').first().innerText().catch(() => null));
    log('stored:', JSON.stringify(await s.stored()));
    await s.enter();
    log('AFTER RELOAD modal:', JSON.stringify(await s.modalState()), '| list rows:', JSON.stringify(await s.rows()));
    await s.notice.scrollIntoViewIfNeeded(); await s.p.screenshot({ path: `${OUT}/real-farm-list-after-reload-phone.png` });
    await s.notice.getByRole('button', { name: 'Hide this list' }).click(); await s.p.waitForTimeout(600);
    log('after Hide: list', await s.notice.count(), '| hidden key:', (await s.stored()).hidden);
    await s.enter();
    log('AFTER RELOAD (hidden): list', await s.notice.count(), '| choice', (await s.modalState()).value);
    await s.pdf('real-farm-chosen-calendar.pdf');
    await s.choose('summer');
    log('after choosing a DIFFERENT calendar (hard frost): list rows returned:', (await s.rows()).length);
    await s.choose('');
    log('after "Let the app decide": modal', JSON.stringify(await s.modalState()), '| list', await s.notice.count());
    log('stored:', JSON.stringify(await s.stored()));
    await s.enter();
    log('AFTER RELOAD (cleared): modal', JSON.stringify(await s.modalState()), '| list', await s.notice.count());
    await s.pdf('real-farm-automatic-calendar.pdf');
    await s.ctx.close(); }
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message.slice(0, 1500)); process.exit(1); });

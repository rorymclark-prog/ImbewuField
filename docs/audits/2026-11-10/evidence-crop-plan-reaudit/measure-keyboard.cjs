// Keyboard checks for docs/audits/2026-11-10/crop-plan-reaudit-claude.md: the three crop sheets
// (role, name, focus on open, Tab containment, Escape, close control) and the first 45 tab stops.
//   BASE_URL=http://localhost:4242 OUT=./measurements PLAYWRIGHT_MODULE=playwright \
//   node measure-keyboard.cjs <width> <height> <light|dark>
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://localhost:4242';
const OUT = process.env.OUT || './measurements';
fs.mkdirSync(OUT, { recursive: true });
const [W, H, mode] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: +W, height: +H }, colorScheme: mode === 'dark' ? 'dark' : 'light' });
  await ctx.addInitScript(([mode]) => { try { sessionStorage.setItem('imbewu_sample_mode', '1'); localStorage.setItem('fp-mode', mode); } catch {} }, [mode]);
  const p = await ctx.newPage();
  await p.goto(BASE + '/facilitator/crops', { waitUntil: 'networkidle', timeout: 240000 }); await p.waitForTimeout(2500);
  await p.evaluate(() => { localStorage.setItem('imbewu_app_level_v1', 'simple'); window.dispatchEvent(new CustomEvent('imbewu-app-level-changed')); }); await p.waitForTimeout(800);
  const panel = p.locator('section[aria-label="Site country and region"]');
  await panel.locator('select').first().selectOption('ZA'); await panel.getByRole('checkbox').check(); await panel.locator('button[type=submit]').last().click(); await p.waitForTimeout(2200);
  const out = { config: { viewport: `${W}x${H}`, theme: 'earth ' + mode, level: 'simple', lang: 'en', build: 'main 8a4d1fd local dev, sample farm' }, overlays: [], tabStops: [] };
  const overlayInfo = () => p.evaluate(() => { const ov = [...document.querySelectorAll('div')].filter((d) => { const s = d.style; return s.position === 'fixed' && s.inset === '0px' && ['60', '61', '70'].includes(s.zIndex) && d.getBoundingClientRect().width > 200; }).pop(); if (!ov) return null; const dlg = ov.querySelector('[role=dialog]') || (ov.getAttribute('role') === 'dialog' ? ov : null); const title = (ov.querySelector('.font-display')?.innerText || '').slice(0, 50); return { present: true, title, role: (dlg || ov).getAttribute('role'), ariaModal: (dlg || ov).getAttribute('aria-modal'), labelled: !!((dlg || ov).getAttribute('aria-label') || (dlg || ov).getAttribute('aria-labelledby')), focusInside: ov.contains(document.activeElement), activeTag: document.activeElement?.tagName, activeText: (document.activeElement?.innerText || '').slice(0, 30), bodyInert: [...document.body.children].some((c) => c.hasAttribute('inert')) }; });
  const testOverlay = async (label, openFn) => {
    const rec = { overlay: label };
    await openFn(); await p.waitForTimeout(700);
    const a = await overlayInfo(); if (!a) { rec.opened = false; out.overlays.push(rec); return; }
    Object.assign(rec, { opened: true, title: a.title, role: a.role, ariaModal: a.ariaModal, labelled: a.labelled, focusMovedInOnOpen: a.focusInside, focusAfterOpen: `${a.activeTag} "${a.activeText}"` });
    await p.screenshot({ path: `${OUT}/sheet-${W}-${mode}-${label}.png` });
    let escaped = null; for (let i = 0; i < 140; i++) { await p.keyboard.press('Tab'); const s = await overlayInfo(); if (s && !s.focusInside && (i > 0 || !a.focusInside)) { escaped = i + 1; break; } }
    rec.tabLeavesOverlayAfterPresses = escaped; rec.tabTrapped = escaped === null;
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    const afterEsc = await overlayInfo(); rec.escapeCloses = !afterEsc;
    if (afterEsc) { rec.closeControl = await p.evaluate(() => { const ov = [...document.querySelectorAll('div')].filter((d) => d.style.position === 'fixed' && d.style.inset === '0px' && ['60', '61', '70'].includes(d.style.zIndex)).pop(); const btns = [...ov.querySelectorAll('button')]; const x = btns.find((b) => /close/i.test(b.getAttribute('aria-label') || b.getAttribute('title') || '')) || btns.find((b) => !(b.innerText || '').trim() && b.querySelector('svg')); if (!x) return 'none found'; const r = x.getBoundingClientRect(); const info = `${Math.round(r.width)}x${Math.round(r.height)} aria-label=${x.getAttribute('aria-label')} title=${x.getAttribute('title')}`; x.click(); return info; }); await p.waitForTimeout(500); }
    const stillOpen = await overlayInfo(); rec.closedForNextTest = !stillOpen;
    rec.focusAfterClose = await p.evaluate(() => `${document.activeElement?.tagName} "${(document.activeElement?.innerText || '').slice(0, 30)}"`);
    out.overlays.push(rec);
  };
  const cal = p.locator('[data-crop-bed-scroll]');
  await testOverlay('crop-picker', async () => { const btn = cal.locator('button', { hasText: '+ crop' }).first(); await btn.scrollIntoViewIfNeeded(); await btn.focus(); await p.keyboard.press('Enter'); });
  await testOverlay('planting-detail', async () => { const btn = cal.locator('button', { hasText: 'Butternut' }).first(); await btn.scrollIntoViewIfNeeded(); await btn.focus(); await p.keyboard.press('Enter'); });
  await testOverlay('auto-suggest', async () => { const btn = p.getByRole('button', { name: /Auto-suggest a plan/ }).first(); await btn.scrollIntoViewIfNeeded(); await btn.focus(); await p.keyboard.press('Enter'); });
  // Tab order and focus indicator from the top of the page
  await p.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); document.body.focus(); });
  await p.mouse.click(2, 2);
  for (let i = 0; i < 45; i++) {
    await p.keyboard.press('Tab');
    const s = await p.evaluate(() => { const el = document.activeElement; if (!el || el === document.body) return null; const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || /rgba?\(/.test(cs.boxShadow) && cs.boxShadow !== 'none'; return { tag: el.tagName.toLowerCase(), text: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || el.value || '').replace(/\s+/g, ' ').slice(0, 36), focusVisible: el.matches(':focus-visible'), outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, boxShadow: cs.boxShadow === 'none' ? 'none' : cs.boxShadow.slice(0, 50), hasIndicator: !!ring, inViewport: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, w: Math.round(r.width), h: Math.round(r.height) }; });
    if (s) out.tabStops.push(s);
  }
  out.summary = { tabStopsSampled: out.tabStops.length, withoutFocusIndicator: out.tabStops.filter((s) => !s.hasIndicator).length, focusedOffscreen: out.tabStops.filter((s) => !s.inViewport).length };
  fs.writeFileSync(`${OUT}/keyboard-${W}-${mode}.json`, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out.overlays, null, 0)); console.log(JSON.stringify(out.summary)); console.log(out.tabStops.filter((s) => !s.inViewport).map((s) => `${s.tag}:${s.text}|ind=${s.hasIndicator}|${s.outline}`).join('\n'));
  await b.close();
})().catch((e) => { console.error('FAIL', e.message.slice(0, 600)); process.exit(1); });

// Keyboard checks for docs/audits/2026-11-10/crop-plan-reaudit-claude.md.
//
//   BASE_URL=http://localhost:4242 OUT=./measurements PLAYWRIGHT_MODULE=playwright \
//   node measure-keyboard.cjs <width> <height> <light|dark>
//
// What it does, and what makes each result trustworthy:
//  - Every check starts from a NEW browser context and page load (public sample farm, country
//    confirmed as South Africa, Simple mode), so no sheet, focus position or scroll offset is
//    carried from one check into the next.
//  - A sheet is identified by its own structure AND its title: a fixed, inset-0 container whose
//    first child is the page's rgba(20,16,10,0.35) backdrop and whose header shows the expected
//    title. The nav drawer and the help widget also keep fixed inset-0 nodes in the document; the
//    first version of this script could mistake those for an open sheet, which is why it reported
//    closedForNextTest:false. "Closed" here means that specific sheet is no longer in the document.
//  - Each sheet gets two independent runs: A = open, press Escape straight away, then (if still
//    open) click the sheet's own Close button with a real pointer click; B = open, then Tab.
//  - The served build identity is read from /api/build-info, not typed in.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://localhost:4242';
const OUT = process.env.OUT || './measurements';
fs.mkdirSync(OUT, { recursive: true });
const [W, H, mode] = process.argv.slice(2);

const SHEETS = [
  { key: 'crop-picker', title: '^Add a crop$', trigger: { scope: '[data-crop-bed-scroll]', text: '+ crop' } },
  { key: 'planting-detail', title: '^Butternut', trigger: { scope: '[data-crop-bed-scroll]', text: 'Butternut' } },
  { key: 'auto-suggest', title: '^Auto-suggest a plan$', trigger: { scope: 'body', text: 'Auto-suggest a plan' } },
];

// Runs in the page. Returns null when the named sheet is not in the document.
const SHEET_STATE = (titleSource) => {
  const title = new RegExp(titleSource);
  const describe = (el) => el ? `${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute('aria-label') || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 36)}"` : 'none';
  for (const outer of document.querySelectorAll('div')) {
    if (outer.style.position !== 'fixed' || outer.style.inset !== '0px') continue;
    const backdrop = outer.firstElementChild;
    if (!backdrop || !/rgba\(20,\s*16,\s*10,\s*0\.35\)/.test(backdrop.style.background)) continue;
    const heading = [...outer.querySelectorAll('span.font-display')].find((s) => title.test(s.innerText.replace(/\s+/g, ' ').trim()));
    if (!heading) continue;
    const r = outer.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || (outer.checkVisibility && !outer.checkVisibility())) continue;
    outer.setAttribute('data-audit-sheet', '1');
    const card = backdrop.nextElementSibling;
    const roleEl = [outer, card, ...outer.querySelectorAll('[role=dialog],[role=alertdialog]')].find((e) => e && /dialog/.test(e.getAttribute('role') || '')) || null;
    const close = outer.querySelector('button[aria-label="Close"]');
    const cr = close ? close.getBoundingClientRect() : null;
    const focusables = [...outer.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((e) => e.getClientRects().length > 0);
    return {
      title: heading.innerText.replace(/\s+/g, ' ').trim().slice(0, 40),
      zIndex: outer.style.zIndex,
      role: roleEl ? roleEl.getAttribute('role') : null,
      ariaModal: roleEl ? roleEl.getAttribute('aria-modal') : null,
      accessibleName: roleEl ? (roleEl.getAttribute('aria-label') || (roleEl.getAttribute('aria-labelledby') || '').split(/\s+/).map((id) => document.getElementById(id)?.innerText || '').join(' ').trim() || null) : null,
      focusInside: outer.contains(document.activeElement),
      activeElement: describe(document.activeElement),
      focusOnTrigger: !!document.activeElement?.hasAttribute?.('data-audit-trigger'),
      focusableCount: focusables.length,
      closeButton: close ? { widthPx: Math.round(cr.width), heightPx: Math.round(cr.height), ariaLabel: close.getAttribute('aria-label') } : null,
    };
  }
  return null;
};

(async () => {
  const browser = await chromium.launch();
  const build = await fetch(BASE + '/api/build-info').then((r) => r.json()).then((j) => ({ branch: j.branch ?? null, sha: j.sha ?? null })).catch(() => ({ branch: null, sha: null, note: 'build-info not readable' }));
  const out = {
    config: { viewport: `${W}x${H}`, theme: 'earth ' + mode, level: 'simple', lang: 'en', url: '/facilitator/crops', servedBuild: build, site: 'public sample farm', countryConfirmed: 'ZA', isolation: 'new browser context and page load per check' },
    pageLoads: [], sheets: [], tabStops: [],
  };

  const freshPage = async () => {
    const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, colorScheme: mode === 'dark' ? 'dark' : 'light' });
    await ctx.addInitScript(([m]) => { try { sessionStorage.setItem('imbewu_sample_mode', '1'); localStorage.setItem('fp-mode', m); localStorage.setItem('fp-theme', 'earth'); } catch {} }, [mode]);
    const p = await ctx.newPage();
    await p.goto(BASE + '/facilitator/crops', { waitUntil: 'networkidle', timeout: 240000 });
    await p.waitForTimeout(2500);
    await p.evaluate(() => { localStorage.setItem('imbewu_app_level_v1', 'simple'); window.dispatchEvent(new CustomEvent('imbewu-app-level-changed')); });
    await p.waitForTimeout(800);
    const panel = p.locator('section[aria-label="Site country and region"]');
    await panel.locator('select').first().selectOption('ZA');
    await panel.getByRole('checkbox').check();
    const climateAnswer = p.waitForResponse((r) => r.url().includes('/api/location-data'), { timeout: 45000 }).catch(() => null);
    await panel.locator('button[type=submit]').last().click();
    await p.locator('[data-crop-bed-scroll]').waitFor({ state: 'attached', timeout: 20000 });
    const answer = await climateAnswer; await p.waitForTimeout(2000);
    // Tab counts depend on this: the two fruit reference bars are extra tab stops.
    out.pageLoads.push({ locationDataStatus: answer ? answer.status() : null, fruitReferenceBarsShown: await p.evaluate(() => /·\s*reference/.test(document.body.innerText)) });
    return { ctx, p };
  };

  const openByKeyboard = async (p, sheet) => {
    const btn = p.locator(sheet.trigger.scope).locator('button', { hasText: sheet.trigger.text }).first();
    await btn.scrollIntoViewIfNeeded();
    await btn.evaluate((el) => el.setAttribute('data-audit-trigger', '1'));
    await btn.focus();
    await p.keyboard.press('Enter');
    await p.waitForTimeout(700);
    return p.evaluate(SHEET_STATE, sheet.title);
  };

  // 1. Tab order and focus indicator from the top of an untouched page.
  {
    const { ctx, p } = await freshPage();
    await p.mouse.click(2, 2);
    for (let i = 0; i < 45; i++) {
      await p.keyboard.press('Tab');
      const s = await p.evaluate(() => {
        const el = document.activeElement; if (!el || el === document.body) return null;
        const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
        const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
        return { tag: el.tagName.toLowerCase(), text: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || el.value || '').replace(/\s+/g, ' ').slice(0, 36), focusVisible: el.matches(':focus-visible'), outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, boxShadow: cs.boxShadow === 'none' ? 'none' : cs.boxShadow.slice(0, 60), hasIndicator: outline || cs.boxShadow !== 'none', fullyInViewport: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, widthPx: Math.round(r.width), heightPx: Math.round(r.height) };
      });
      if (s) out.tabStops.push(s);
    }
    await ctx.close();
  }

  for (const sheet of SHEETS) {
    const rec = { sheet: sheet.key, expectedTitle: sheet.title };

    // Run A: Escape immediately after opening, then the sheet's own Close button.
    {
      const { ctx, p } = await freshPage();
      const opened = await openByKeyboard(p, sheet);
      rec.runA = { opened: !!opened };
      if (opened) {
        Object.assign(rec.runA, { title: opened.title, role: opened.role, ariaModal: opened.ariaModal, accessibleName: opened.accessibleName, focusMovedIntoSheetOnOpen: opened.focusInside, focusAfterOpen: opened.activeElement, focusStillOnTrigger: opened.focusOnTrigger, focusableControlsInSheet: opened.focusableCount, closeButton: opened.closeButton });
        await p.screenshot({ path: `${OUT}/sheet-${W}-${mode}-${sheet.key}.png` });
        await p.keyboard.press('Escape');
        await p.waitForTimeout(500);
        const afterEscape = await p.evaluate(SHEET_STATE, sheet.title);
        rec.runA.escapeClosesSheet = afterEscape === null;
        if (afterEscape) {
          await p.locator('[data-audit-sheet] button[aria-label="Close"]').click();   // real pointer click
          await p.waitForTimeout(500);
          rec.runA.closeButtonClosesSheet = (await p.evaluate(SHEET_STATE, sheet.title)) === null;
        }
        const after = await p.evaluate(() => ({ el: `${document.activeElement?.tagName.toLowerCase()} "${(document.activeElement?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 36)}"`, onTrigger: !!document.activeElement?.hasAttribute?.('data-audit-trigger') }));
        rec.runA.closedBy = rec.runA.escapeClosesSheet ? 'Escape key' : 'pointer click on its Close button';
        rec.runA.focusAfterClose = after.el;
        rec.runA.focusReturnedToTrigger = after.onTrigger;
      }
      await ctx.close();
    }

    // Run B: Tab behaviour, on a fresh page.
    {
      const { ctx, p } = await freshPage();
      const opened = await openByKeyboard(p, sheet);
      rec.runB = { opened: !!opened };
      if (opened) {
        let inside = opened.focusInside; let toReach = inside ? 0 : null; let untilLeaves = null; let afterEntry = 0;
        for (let i = 1; i <= 400; i++) {
          await p.keyboard.press('Tab');
          const s = await p.evaluate(SHEET_STATE, sheet.title);
          if (!s) { rec.runB.sheetVanishedDuringTab = i; break; }
          if (!inside && s.focusInside) { inside = true; toReach = i; continue; }
          if (inside) { afterEntry++; if (!s.focusInside) { untilLeaves = afterEntry; rec.runB.focusWentTo = s.activeElement; break; } }
          if (!inside && i >= 250) break;
        }
        Object.assign(rec.runB, { focusInsideOnOpen: opened.focusInside, tabPressesToReachSheet: toReach, tabPressesInsideBeforeFocusLeft: untilLeaves, focusableControlsInSheet: opened.focusableCount,
          reading: toReach === null ? 'Tab never reached the sheet in 250 presses: focus stays on the page behind it' : untilLeaves === null ? 'focus stayed inside for the rest of 400 presses' : 'focus is not contained: Tab leaves the sheet for the page behind it' });
      }
      await ctx.close();
    }
    out.sheets.push(rec);
  }

  out.summary = {
    tabStopsSampled: out.tabStops.length,
    tabStopsWithoutFocusIndicator: out.tabStops.filter((s) => !s.hasIndicator).length,
    sheetsOpened: out.sheets.filter((s) => s.runA.opened && s.runB.opened).length,
    sheetsWithDialogRole: out.sheets.filter((s) => s.runA.role).length,
    sheetsWithAccessibleName: out.sheets.filter((s) => s.runA.accessibleName).length,
    sheetsTakingFocusOnOpen: out.sheets.filter((s) => s.runA.focusMovedIntoSheetOnOpen).length,
    sheetsClosedByEscape: out.sheets.filter((s) => s.runA.escapeClosesSheet).length,
    sheetsClosedByOwnCloseButton: out.sheets.filter((s) => s.runA.escapeClosesSheet || s.runA.closeButtonClosesSheet).length,
    sheetsReturningFocusToTrigger: out.sheets.filter((s) => s.runA.focusReturnedToTrigger).length,
    sheetsContainingTab: out.sheets.filter((s) => s.runB.opened && s.runB.tabPressesToReachSheet !== null && s.runB.tabPressesInsideBeforeFocusLeft === null).length,
  };
  fs.writeFileSync(`${OUT}/keyboard-${W}-${mode}.json`, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out.summary));
  for (const s of out.sheets) console.log(s.sheet, JSON.stringify(s.runA), JSON.stringify(s.runB));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message.slice(0, 700)); process.exit(1); });

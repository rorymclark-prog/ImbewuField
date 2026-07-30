import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';

type SourceContract = {
  file: string;
  scopedExpression: RegExp;
  scopedUses: number;
  forbiddenBareArgument: RegExp;
};

function source(file: string): string {
  return readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
}

function matches(text: string, pattern: RegExp): number {
  return [...text.matchAll(new RegExp(pattern.source, `${pattern.flags.replaceAll('g', '')}g`))].length;
}

const contracts: SourceContract[] = [
  {
    file: 'components/PopiaConsent.tsx',
    scopedExpression: /activeAccountLocalStorageKey\((?:POPIA_KEY|ONBOARD_KEY)\)/,
    scopedUses: 5,
    forbiddenBareArgument:
      /localStorage\.(?:getItem|setItem|removeItem)\(\s*(?:POPIA_KEY|ONBOARD_KEY)\b/,
  },
  {
    file: 'lib/i18n.tsx',
    scopedExpression: /activeAccountLocalStorageKey\(ONBOARD_KEY\)/,
    scopedUses: 2,
    forbiddenBareArgument:
      /localStorage\.(?:getItem|setItem|removeItem)\(\s*(?:ONBOARD_KEY|['"]permamap_onboarded['"])\b/,
  },
  {
    file: 'components/NextStepCoach.tsx',
    scopedExpression: /activeAccountLocalStorageKey\(POPIA_KEY\)/,
    scopedUses: 1,
    forbiddenBareArgument: /localStorage\.(?:getItem|setItem|removeItem)\(\s*POPIA_KEY\b/,
  },
  {
    file: 'components/design/StepGuide.tsx',
    scopedExpression:
      /const skipsKey = \(siteId: string\) =>\s*activeAccountLocalStorageKey\(`imbewu_stepguide_skips_\$\{siteId\}`\)/,
    scopedUses: 1,
    forbiddenBareArgument:
      /localStorage\.(?:getItem|setItem|removeItem)\(\s*`imbewu_stepguide_skips_/,
  },
  {
    file: 'components/Map.tsx',
    scopedExpression:
      /activeAccountLocalStorageKey\('imbewu-recent-searches'\)/,
    scopedUses: 2,
    forbiddenBareArgument:
      /localStorage\.(?:getItem|setItem|removeItem)\(\s*['"]imbewu-recent-searches['"]/,
  },
  {
    file: 'components/FacilitatorCanvas.tsx',
    scopedExpression: /activeAccountLocalStorageKey\(BACKUP_KEY\)/,
    scopedUses: 4,
    forbiddenBareArgument:
      /localStorage\.(?:getItem|setItem|removeItem)\(\s*BACKUP_KEY\b/,
  },
  {
    file: 'components/GeometryDesignStudio.tsx',
    scopedExpression:
      /activeAccountLocalStorageKey\(`imbewu_airender_\$\{sid\}`\)/,
    scopedUses: 4,
    forbiddenBareArgument:
      /localStorage\.(?:getItem|setItem|removeItem)\(\s*`imbewu_airender_/,
  },
];

test('sensitive TSX storage call sites pass every account-owned key through the account boundary', () => {
  for (const contract of contracts) {
    const text = source(contract.file);
    assert.match(
      text,
      /import\s*\{[^}]*\bactiveAccountLocalStorageKey\b[^}]*\}\s*from\s*['"]@\/lib\/account-local-storage['"]/,
      `${contract.file} must import the shared account-storage boundary`,
    );
    assert.equal(
      matches(text, contract.scopedExpression),
      contract.scopedUses,
      `${contract.file} must scope every reviewed sensitive-key use`,
    );
    assert.doesNotMatch(
      text,
      contract.forbiddenBareArgument,
      `${contract.file} must not access the reviewed sensitive key as a bare localStorage argument`,
    );
  }
});

test('language and POPIA gates mount once above every returned app route', () => {
  const layout = source('app/layout.tsx');
  assert.match(layout, /<AccountOnboardingGates\s*\/>/);

  const gates = source('components/AccountOnboardingGates.tsx');
  assert.match(gates, /<Onboarding\s*\/>/);
  assert.match(gates, /<PopiaConsent\s*\/>/);
  assert.match(gates, /if \(sample\) return null/);
  assert.match(gates, /isBackendConfigured\(\) && \(loading \|\| !user\)/);

  for (const page of ['app/home/page.tsx', 'app/farmer/page.tsx']) {
    const text = source(page);
    assert.doesNotMatch(text, /<Onboarding\s*\/>/, `${page} must not duplicate the root gate`);
    assert.doesNotMatch(text, /<PopiaConsent\s*\/>/, `${page} must not duplicate the root gate`);
  }
});

const account = {
  configured: true,
  currentUid: 'farmer-a' as string | null,
};

Object.assign(globalThis, {
  __imbewuSensitiveTsxAccountHarness: account,
});

const fakeFirebaseInit = `data:text/javascript,${encodeURIComponent(`
const account = globalThis.__imbewuSensitiveTsxAccountHarness;
export const isBackendConfigured = () => account.configured;
export const getFirebase = () => ({
  auth: {
    currentUser: account.currentUid ? { uid: account.currentUid } : null,
  },
});
`)}`;

const accountBoundaryUrl = new URL('../lib/account-local-storage.ts', import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === accountBoundaryUrl && specifier === './firebase/init') {
      return { url: fakeFirebaseInit, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

class MemoryStorage {
  private readonly rows = new Map<string, string>();

  getItem(key: string): string | null {
    return this.rows.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.rows.set(String(key), String(value));
  }

  clear(): void {
    this.rows.clear();
  }
}

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { localStorage, sessionStorage },
});
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: localStorage,
});
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: sessionStorage,
});

const {
  accountLocalStorageKey,
  activeAccountLocalStorageKey,
} = await import('../lib/account-local-storage.ts');
hooks.deregister();

const sensitiveKeys = [
  'imbewu_popia',
  'permamap_onboarded',
  'imbewu-recent-searches',
  'imbewu_stepguide_skips_site:-29.00000,31.00000',
  'imbewu_facilitator_design_backup',
  'imbewu_airender_site:-29.00000,31.00000',
];

test('reviewed TSX key families quarantine bare legacy data and remain isolated across A to B', () => {
  localStorage.clear();
  sessionStorage.clear();

  for (const key of sensitiveKeys) {
    localStorage.setItem(key, `${key}:legacy-unknown-owner`);
    localStorage.setItem(accountLocalStorageKey(key, 'farmer-a'), `${key}:farmer-a`);
  }

  account.currentUid = 'farmer-b';
  for (const key of sensitiveKeys) {
    const bKey = activeAccountLocalStorageKey(key);
    assert.equal(
      localStorage.getItem(bKey),
      null,
      `${key}: B must not fall back to A's bare legacy value or A's scoped value`,
    );
    localStorage.setItem(bKey, `${key}:farmer-b`);
  }

  account.currentUid = 'farmer-a';
  for (const key of sensitiveKeys) {
    assert.equal(
      localStorage.getItem(activeAccountLocalStorageKey(key)),
      `${key}:farmer-a`,
    );
    assert.equal(
      localStorage.getItem(key),
      `${key}:legacy-unknown-owner`,
      `${key}: an unowned legacy row must remain quarantined, not claimed or deleted`,
    );
  }

  account.currentUid = 'farmer-b';
  for (const key of sensitiveKeys) {
    assert.equal(
      localStorage.getItem(activeAccountLocalStorageKey(key)),
      `${key}:farmer-b`,
    );
  }
});

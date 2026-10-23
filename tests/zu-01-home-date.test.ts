import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// zu-01 (wave 14): the Home header date read 'FRIDAY · OCTOBER 16' in isiZulu — English words,
// US month-first order — because zu-ZA has no Intl.DateTimeFormat data in most browsers, so
// toLocaleDateString silently fell back to the runtime default locale. getDayDate() in
// app/home/page.tsx (a 'use client' component) can't be imported directly under `node --test`
// (JSX further down the same file), so this follows the source-text guard style
// tests/home-next-step-links.test.ts already uses for that file, plus a direct import of the
// plain-object isiZulu dictionary to check the actual values getDayDate reads.

const HOME_SOURCE = readFileSync(new URL('../app/home/page.tsx', import.meta.url), 'utf8');

test('getDayDate builds isiZulu dates from the locale tables, day-first, instead of Intl', () => {
  assert.match(HOME_SOURCE, /function getDayDate\(lang: string, now: Date = new Date\(\)\) \{\s*\n\s*if \(lang === 'zu'\) \{/,
    'getDayDate must special-case isiZulu before falling through to Intl');
  const zuBlock = HOME_SOURCE.match(/if \(lang === 'zu'\) \{([\s\S]*?)\n  \}/);
  assert.ok(zuBlock, 'could not find the isiZulu branch of getDayDate');
  assert.match(zuBlock![1], /translate\('zu', ZU_WEEKDAY_KEYS\[now\.getDay\(\)\]\)/, 'weekday must come from the isiZulu locale table, not Intl');
  assert.match(zuBlock![1], /translate\('zu', ZU_MONTH_KEYS\[now\.getMonth\(\)\]\)/, 'month must come from the isiZulu locale table, not Intl');
  assert.match(zuBlock![1], /`\$\{day\} · \$\{now\.getDate\(\)\} \$\{month\}`/, 'isiZulu date must render day-before-month, matching the English twin\'s "16 October" order');

  // The English/other-locale path is untouched and still defaults an unlisted locale to 'en-ZA'.
  assert.match(HOME_SOURCE, /const locale = LANG_TO_LOCALE\[lang\] \?\? 'en-ZA';/);
});

test('isiZulu weekday and month tables exist in lib/locales/zu.ts with the keys Home reads', async () => {
  const zuDict = (await import('../lib/locales/zu.ts')).default as Record<string, string>;
  const weekdayKeys = ['homeWeekdaySun', 'homeWeekdayMon', 'homeWeekdayTue', 'homeWeekdayWed', 'homeWeekdayThu', 'homeWeekdayFri', 'homeWeekdaySat'];
  const monthKeys = ['homeMonthJan', 'homeMonthFeb', 'homeMonthMar', 'homeMonthApr', 'homeMonthMay', 'homeMonthJun', 'homeMonthJul', 'homeMonthAug', 'homeMonthSep', 'homeMonthOct', 'homeMonthNov', 'homeMonthDec'];

  for (const key of [...weekdayKeys, ...monthKeys]) {
    assert.ok(zuDict[key] && zuDict[key].length > 0, `lib/locales/zu.ts is missing ${key}`);
  }

  // The audit's own example: Friday 16 October -> 'uLwesihlanu · 16 Okthoba' (the header's
  // `uppercase` CSS class renders this as 'ULWESIHLANU · 16 OKTHOBA' without the source needing
  // to be pre-uppercased).
  assert.equal(zuDict.homeWeekdayFri, 'uLwesihlanu');
  assert.equal(zuDict.homeMonthOct, 'Okthoba');
});

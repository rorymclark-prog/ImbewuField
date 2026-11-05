import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// w22-02: /invoice is prerendered, so a clock read during render bakes the build day into the HTML
// and throws React #425 on every later day (or where the server's UTC day is not the farmer's).
const source = readFileSync('app/invoice/page.tsx', 'utf8');

test('invoice issue date and today start empty and are set after mount', () => {
  // Input setters now revoke queued price selections. Mount still seeds the
  // underlying state; derive that binding instead of pinning its local name.
  const ast = ts.createSourceFile('invoice.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const setters = new Map<string, string>(), effects: ts.CallExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) && node.initializer
      && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(ast) === 'useState') {
      const [value, setter] = node.name.elements;
      if (value && setter && ['issuedISO', 'today'].includes(value.getText(ast))) {
        const initial = node.initializer.arguments[0];
        assert.ok(initial && ts.isStringLiteral(initial) && initial.text === '', 'server and first render must have no clock-derived date');
        setters.set(value.getText(ast), setter.getText(ast));
      }
    }
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect') effects.push(node);
    ts.forEachChild(node, visit);
  };
  visit(ast); assert.equal(setters.size, 2);
  const mounts = effects.filter(effect => {
    const [callback, deps] = effect.arguments;
    if (!callback || !ts.isArrowFunction(callback) || !deps || !ts.isArrayLiteralExpression(deps) || deps.elements.length) return false;
    const calls = new Set<string>();
    const collect = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) calls.add(node.expression.text);
      ts.forEachChild(node, collect);
    };
    collect(callback.body);
    return [...setters.values()].every(setter => calls.has(setter));
  });
  assert.equal(mounts.length, 1, 'one mount effect seeds both empty dates');
  const callback = mounts[0].arguments[0]; assert.ok(ts.isArrowFunction(callback));
  let today = '', issued = '';
  const mountedNow = '2026-11-04T12:00:00.000Z';
  const effect = new Function(setters.get('today')!, setters.get('issuedISO')!, 'Date', callback.body.getText(ast));
  const mount = () => effect((next: string) => { today = next; }, (next: string | ((previous: string) => string)) => {
    issued = typeof next === 'function' ? next(issued) : next;
  }, class { toISOString() { return mountedNow; } });
  mount(); assert.equal(today, mountedNow); assert.equal(issued, mountedNow);
  issued = '2026-10-30T00:00:00.000Z';
  mount(); assert.equal(issued, '2026-10-30T00:00:00.000Z', 'mount must preserve an already issued document date');
});

test('no clock is read during render for state or the date inputs\' max', () => {
  assert.doesNotMatch(source, /useState\(\(\) => new Date\(/);
  assert.doesNotMatch(source, /max=\{invoiceDateInput\(new Date\(/);
  assert.equal((source.match(/max=\{today \? invoiceDateInput\(today\) : undefined\}/g) ?? []).length, 2);
});

test('the date message and save stay off until today is known', () => {
  assert.match(source, /const entryError = today \? invoiceEntryError\(/);
  // Read the actual boolean rule rather than pinning its first two operands:
  // source/currency gates now precede the unchanged mount-time date guard.
  const ast = ts.createSourceFile('invoice.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const eligibility: ts.VariableDeclaration[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'valid') eligibility.push(node);
    ts.forEachChild(node, visit);
  };
  visit(ast); assert.equal(eligibility.length, 1, 'the actual save eligibility must have one authority');
  const valid = eligibility[0].initializer; assert.ok(valid, 'the actual save eligibility rule must exist');
  const names = ['bookReady', 'currencyBasis', 'saving', 'today', 'paymentStatus', 'entryError', 'recordBasis', 'sourceSaleId', 'billTo', 'items'];
  const eligible = new Function(...names, `return (${valid.getText(ast)});`) as (...values: unknown[]) => boolean;
  const base = { bookReady: true, currencyBasis: { status: 'recorded' }, saving: false, today: '2026-11-04', paymentStatus: 'unpaid',
    entryError: null, recordBasis: 'new', sourceSaleId: '', billTo: 'Buyer', items: [{ desc: 'Recorded produce', qty: 1 }] };
  const run = (patch: Partial<typeof base> = {}) => { const values = { ...base, ...patch }; return eligible(...names.map(name => values[name as keyof typeof values])); };
  assert.equal(run(), true, 'the fixture must be a positive eligible document');
  assert.equal(run({ today: '' }), false, 'server/first-mount empty today must withhold saving');
  assert.equal(run({ saving: true }), false, 'an in-flight save must still withhold another save');
  assert.equal(run({ bookReady: false }), false, 'a known date cannot replace the actual storage-source gate');
  assert.equal(run({ currencyBasis: { status: 'held' } }), false, 'a known date cannot give an unreadable currency permission to save');
});

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import ts from 'typescript';

const actionUrl = new URL('../app/international/nws-actions.ts', import.meta.url).href;
const prior = Object.getOwnPropertyDescriptor(globalThis, '__nwsActionBoundary');
const probe = { calls: [] as unknown[], next: async (): Promise<unknown> => ({ status: 'failed', reason: 'timeout' }) };
Object.defineProperty(globalThis, '__nwsActionBoundary', { configurable: true, value: probe });
const hook = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL === actionUrl && specifier === '@/lib/international/providers/nws-public-demo') {
    return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(
      // The action module now imports both entry points. The legacy action must
      // still call only its original fixed-demo boundary.
      'export const fetchNwsPointReference=()=>{throw Error("Legacy demo cannot borrow point transport");}; export const fetchCountryNwsPublicDemo=(...args)=>{const p=globalThis.__nwsActionBoundary;p.calls.push(args);return p.next();};') };
  }
  return next(specifier, context);
} });
const { checkNwsPublicDemo } = await import('../app/international/nws-actions.ts');
after(() => {
  hook.deregister();
  if (prior) Object.defineProperty(globalThis, '__nwsActionBoundary', prior);
  else Reflect.deleteProperty(globalThis, '__nwsActionBoundary');
});

test('the server action accepts no farm inputs and requests only the fixed public US reference', async () => {
  const response = { status: 'partial', marker: 'synthetic gateway result' };
  probe.next = async () => response;
  const result = await (checkNwsPublicDemo as (...args: unknown[]) => Promise<unknown>)({ country: 'OTHER', latitude: 'private input must be ignored' });
  assert.equal(result, response, 'the action must not manufacture, relabel or normalize gateway values');
  assert.deepEqual(probe.calls, [['US']], 'arbitrary action arguments must never reach the network helper');
});

test('a rejected server operation stays rejected rather than returning old forecast values', async () => {
  const failure = new Error('synthetic action failure');
  probe.next = async () => { throw failure; };
  await assert.rejects(checkNwsPublicDemo(), error => error === failure);
});

function usOnlyMount(source: string): boolean {
  const tree = ts.createSourceFile('review.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let references = 0, guarded = 0;
  function walk(node: ts.Node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === 'NwsForecastReference') {
      references++;
      const parent = node.parent;
      if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
        && parent.right === node && ts.isBinaryExpression(parent.left)
        && parent.left.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
        && parent.left.left.getText(tree) === 'code'
        && ts.isStringLiteral(parent.left.right) && parent.left.right.text === 'US') guarded++;
    }
    ts.forEachChild(node, walk);
  }
  walk(tree);
  return references === 1 && guarded === 1;
}

test('switching away from the US removes the reference component instead of retaining an old country result', () => {
  const source = readFileSync(new URL('../components/international/countries/CountryReview.tsx', import.meta.url), 'utf8');
  assert.equal(usOnlyMount(source), true);
  // A broad mount or a different-country guard must fail this boundary check.
  assert.equal(usOnlyMount(source.replace("code === 'US' && <NwsForecastReference", '<NwsForecastReference')), false);
  assert.equal(usOnlyMount(source.replace("code === 'US' && <NwsForecastReference", "code === 'BR' && <NwsForecastReference")), false);
});

test('identifying NWS requests remain behind a server action, outside the client component', () => {
  const action = readFileSync(new URL(actionUrl), 'utf8');
  const tree = ts.createSourceFile('action.ts', action, ts.ScriptTarget.Latest, true);
  const first = tree.statements[0];
  assert.ok(ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text === 'use server');
  const client = readFileSync(new URL('../components/international/countries/NwsForecastReference.tsx', import.meta.url), 'utf8');
  const clientTree = ts.createSourceFile('client.tsx', client, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  for (const statement of clientTree.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)
      && statement.moduleSpecifier.text.endsWith('/nws-public-demo')) {
      assert.equal(statement.importClause?.isTypeOnly, true, 'the transport helper must not become client runtime code');
    }
  }
  assert.doesNotMatch(client, /\bfetch\s*\(|User-Agent/);
});

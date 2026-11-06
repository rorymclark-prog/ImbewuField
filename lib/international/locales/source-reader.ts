import ts from 'typescript';
import type { SourceDictionary, SourceMessage } from './types';

/** Tooling-only: inspect actual explicit T_en properties without executing a client provider. */
export function readCurrentEnglish(sourceText: string, messages: readonly SourceMessage[]): SourceDictionary {
  const source = ts.createSourceFile('lib/i18n.tsx', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let object: ts.ObjectLiteralExpression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'T_en'
      && node.initializer && ts.isObjectLiteralExpression(node.initializer)) object = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(source);
  const result: Record<string, string | undefined> = {};
  for (const message of messages) {
    const property = object?.properties.find((node) => ts.isPropertyAssignment(node)
      && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) && node.name.text === message.key);
    result[message.key] = property && ts.isPropertyAssignment(property)
      && (ts.isStringLiteral(property.initializer) || ts.isNoSubstitutionTemplateLiteral(property.initializer))
      ? property.initializer.text : undefined;
  }
  return result;
}

export type SourceLiteralSelector =
  | { readonly kind: 'function-call'; readonly functionName: string; readonly callee: string;
      readonly textArgument: number; readonly expectedCount: number; readonly ordinal: number;
      readonly nestedFunction?: string;
      readonly returned?: boolean;
      readonly firstArgument?: string; readonly nonEmpty?: boolean;
      readonly objectArgument?: { readonly index: number; readonly property: string; readonly value: string } }
  | { readonly kind: 'release-tour'; readonly variableName: string; readonly owningChange: string;
      readonly title: string; readonly href: string };

const literalText = (node: ts.Node | undefined): string | undefined => node
  && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined;
function namedProperty(object: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  // A spread or computed name could override the selected property at runtime.
  // This reader observes explicit source; it never evaluates that JavaScript.
  if (object.properties.some(node => ts.isSpreadAssignment(node) || node.name && ts.isComputedPropertyName(node.name))) return undefined;
  const found = object.properties.filter(node => !ts.isSpreadAssignment(node) && node.name
    && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) && node.name.text === name);
  return found.length === 1 && ts.isPropertyAssignment(found[0]) ? found[0].initializer : undefined;
}

/** Inspect complete AST literals in their named application role. A comment,
 * substring, dynamic template or an unrelated function cannot certify current
 * English. Count/identity ambiguity deliberately withdraws the binding. */
export function readCurrentSourceLiterals(sourceText: string, selectors: Readonly<Record<string, SourceLiteralSelector>>): SourceDictionary {
  const source = ts.createSourceFile('current-source.tsx', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const result: Record<string, string | undefined> = Object.fromEntries(Object.keys(selectors).map(key => [key, undefined]));
  // TypeScript exposes parser diagnostics on its created source file, although
  // the public SourceFile interface omits this field in some supported versions.
  if ((source as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics?.length) return result;
  for (const [key, selector] of Object.entries(selectors)) {
    if (selector.kind === 'function-call') {
      const functions: ts.FunctionDeclaration[] = [];
      const find = (node: ts.Node) => {
        if (ts.isFunctionDeclaration(node) && node.name?.text === selector.functionName && node.body) functions.push(node);
        ts.forEachChild(node, find);
      };
      find(source);
      if (functions.length !== 1) continue;
      let body: ts.Node = functions[0].body!;
      if (selector.nestedFunction !== undefined) {
        const nested: ts.Node[] = [];
        const findNested = (node: ts.Node) => {
          if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === selector.nestedFunction
            && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) nested.push(node.initializer.body);
          if (ts.isFunctionLike(node)) return;
          ts.forEachChild(node, findNested);
        };
        findNested(body);
        if (nested.length !== 1) continue;
        body = nested[0];
      }
      const matches: string[] = [];
      const returned = (node: ts.Node) => {
        for (let parent = node.parent; parent && parent !== body; parent = parent.parent) {
          if (ts.isFunctionLike(parent)) return false;
          if (ts.isReturnStatement(parent)) return true;
        }
        return false;
      };
      const visit = (node: ts.Node) => {
        // An unused nested helper is not the owner's rendered message. The
        // one actual callback carrying text is selected by its own name above.
        if (ts.isFunctionLike(node)) return;
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === selector.callee
          && (!selector.returned || returned(node))
          && (selector.firstArgument === undefined || literalText(node.arguments[0]) === selector.firstArgument)) {
          const constraint = selector.objectArgument;
          const argument = constraint ? node.arguments[constraint.index] : undefined;
          const constrained = !constraint || !!argument && ts.isObjectLiteralExpression(argument)
            && literalText(namedProperty(argument, constraint.property)) === constraint.value;
          const text = literalText(node.arguments[selector.textArgument]);
          if (constrained && text !== undefined && (!selector.nonEmpty || !!text.trim())) matches.push(text);
        }
        ts.forEachChild(node, visit);
      };
      visit(body);
      if (matches.length === selector.expectedCount && Number.isInteger(selector.ordinal) && selector.ordinal >= 0) {
        result[key] = matches[selector.ordinal];
      }
    } else {
      const arrays: ts.ArrayLiteralExpression[] = [];
      const find = (node: ts.Node) => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === selector.variableName
          && node.initializer && ts.isArrayLiteralExpression(node.initializer)) arrays.push(node.initializer);
        ts.forEachChild(node, find);
      };
      find(source);
      if (arrays.length !== 1 || arrays[0].elements.some(ts.isSpreadElement)) continue;
      const owners = arrays[0].elements.filter((node): node is ts.ObjectLiteralExpression => {
        if (!ts.isObjectLiteralExpression(node)) return false;
        const changes = namedProperty(node, 'changes');
        return !!changes && ts.isArrayLiteralExpression(changes)
          && changes.elements.filter(value => literalText(value) === selector.owningChange).length === 1;
      });
      if (owners.length !== 1) continue;
      const tour = namedProperty(owners[0], 'tour');
      if (!tour || !ts.isArrayLiteralExpression(tour) || tour.elements.some(ts.isSpreadElement)) continue;
      const stops = tour.elements.filter((node): node is ts.ObjectLiteralExpression => ts.isObjectLiteralExpression(node)
        && literalText(namedProperty(node, 'title')) === selector.title && literalText(namedProperty(node, 'href')) === selector.href);
      if (stops.length === 1) result[key] = literalText(namedProperty(stops[0], 'where'));
    }
  }
  return result;
}

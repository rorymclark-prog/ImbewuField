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
      readonly title: string; readonly href: string }
  | { readonly kind: 'function-message'; readonly functionName: string; readonly callee: string;
      readonly receiver?: string; readonly argumentCount: number;
      readonly literalArguments?: readonly { readonly index: number; readonly value: string }[];
      readonly templateArgument?: { readonly index: number; readonly expressions: readonly string[] };
      readonly withinIf?: string; readonly returned?: boolean;
      readonly text: { readonly argument: number; readonly arrayElement?: number;
        readonly conditionalFalse?: string } };

export interface SourceDelegationSelector {
  readonly functionName: string;
  readonly module: string;
  readonly importedName: string;
  readonly resultName: string;
  readonly argumentName: string;
  readonly arrayProperty: string;
}

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

function hasParseErrors(source: ts.SourceFile): boolean {
  return !!(source as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics?.length;
}
function exportedFunction(source: ts.SourceFile, name: string): ts.FunctionDeclaration | undefined {
  const matches: ts.FunctionDeclaration[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) matches.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  const found = matches.length === 1 ? matches[0] : undefined;
  return found?.parent === source && found.body
    && found.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) ? found : undefined;
}
function expressionKey(text: string): string {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, text);
  const tokens: (string | number)[][] = [];
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    tokens.push([token, token === ts.SyntaxKind.StringLiteral ? scanner.getTokenValue() : scanner.getTokenText()]);
  }
  return JSON.stringify(tokens);
}
function inSelectedBranch(node: ts.Node, body: ts.Node, condition: string): boolean {
  let child = node;
  for (let parent = node.parent; parent && parent !== body; child = parent, parent = parent.parent) {
    if (ts.isFunctionLike(parent)) return false;
    if (ts.isIfStatement(parent)) return child === parent.thenStatement
      && expressionKey(parent.expression.getText()) === expressionKey(condition);
  }
  return false;
}
function functionMessage(source: ts.SourceFile, selector: Extract<SourceLiteralSelector, { kind: 'function-message' }>): string | undefined {
  const owner = exportedFunction(source, selector.functionName);
  if (!owner?.body) return undefined;
  const matches: ts.CallExpression[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isFunctionLike(node)) return;
    if (ts.isCallExpression(node) && node.arguments.length === selector.argumentCount) {
      const call = node.expression;
      const named = selector.receiver === undefined ? ts.isIdentifier(call) && call.text === selector.callee
        : ts.isPropertyAccessExpression(call) && ts.isIdentifier(call.expression)
          && call.expression.text === selector.receiver && call.name.text === selector.callee;
      const direct = selector.returned ? ts.isReturnStatement(node.parent) && node.parent.expression === node
        : ts.isExpressionStatement(node.parent);
      const argument = node.arguments[selector.text.argument];
      const conditional = selector.text.conditionalFalse === undefined || !!argument && ts.isConditionalExpression(argument)
        && expressionKey(argument.condition.getText()) === expressionKey(selector.text.conditionalFalse);
      const template = selector.templateArgument, templateNode = template && node.arguments[template.index];
      const templated = !template || !!templateNode && ts.isTemplateExpression(templateNode)
        && templateNode.templateSpans.length === template.expressions.length
        && templateNode.templateSpans.every((span, index) => expressionKey(span.expression.getText()) === expressionKey(template.expressions[index]));
      if (named && direct && (!selector.withinIf || inSelectedBranch(node, owner.body!, selector.withinIf))
        && conditional && templated
        && selector.literalArguments?.every(argument => literalText(node.arguments[argument.index]) === argument.value) !== false) {
        matches.push(node);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(owner.body);
  // Count role candidates before reading text: replacing a real literal with a
  // dynamic expression must not let a second, unused literal win its identity.
  if (matches.length !== 1) return undefined;
  let text: ts.Node | undefined = matches[0].arguments[selector.text.argument];
  if (selector.text.arrayElement !== undefined) {
    text = text && ts.isArrayLiteralExpression(text) && !text.elements.some(ts.isSpreadElement)
      ? text.elements[selector.text.arrayElement] : undefined;
  }
  if (selector.text.conditionalFalse !== undefined) {
    text = text && ts.isConditionalExpression(text)
      && expressionKey(text.condition.getText()) === expressionKey(selector.text.conditionalFalse) ? text.whenFalse : undefined;
  }
  return literalText(text);
}

/** Source wiring evidence only: a named component must actually render the
 * imported presenter's lines. An unused import or frozen wording is insufficient. */
export function hasCurrentSourceDelegation(sourceText: string, selector: SourceDelegationSelector): boolean {
  const source = ts.createSourceFile('current-delegation.tsx', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (hasParseErrors(source)) return false;
  const imports = source.statements.filter(ts.isImportDeclaration).filter(node => literalText(node.moduleSpecifier) === selector.module
    && !node.importClause?.isTypeOnly && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
    && node.importClause.namedBindings.elements.some(item => !item.isTypeOnly && item.name.text === selector.importedName
      && (item.propertyName?.text ?? item.name.text) === selector.importedName));
  const owner = exportedFunction(source, selector.functionName);
  if (imports.length !== 1 || !owner?.body || owner.body.statements.length !== 2) return false;
  const [declaration, returned] = owner.body.statements;
  if (!ts.isVariableStatement(declaration) || !(declaration.declarationList.flags & ts.NodeFlags.Const)
    || declaration.declarationList.declarations.length !== 1 || !ts.isReturnStatement(returned)) return false;
  const value = declaration.declarationList.declarations[0], call = value.initializer;
  if (!ts.isIdentifier(value.name) || value.name.text !== selector.resultName || !call || !ts.isCallExpression(call)
    || !ts.isIdentifier(call.expression) || call.expression.text !== selector.importedName || call.arguments.length !== 1
    || !ts.isIdentifier(call.arguments[0]) || call.arguments[0].text !== selector.argumentName) return false;
  const render = returned.expression;
  if (!render || !ts.isCallExpression(render) || !ts.isIdentifier(render.expression) || render.expression.text !== 'createElement'
    || literalText(render.arguments[0]) !== 'div') return false;
  const maps = render.arguments.filter(ts.isSpreadElement).map(item => item.expression).filter(ts.isCallExpression)
    .filter(item => ts.isPropertyAccessExpression(item.expression) && item.expression.name.text === 'map'
      && ts.isPropertyAccessExpression(item.expression.expression) && item.expression.expression.name.text === selector.arrayProperty
      && ts.isIdentifier(item.expression.expression.expression) && item.expression.expression.expression.text === selector.resultName);
  if (maps.length !== 1 || maps[0].arguments.length !== 1) return false;
  const callback = maps[0].arguments[0];
  if (!ts.isArrowFunction(callback) || !callback.parameters.length || !ts.isIdentifier(callback.parameters[0].name) || !ts.isCallExpression(callback.body)
    || !ts.isIdentifier(callback.body.expression) || callback.body.expression.text !== 'createElement'
    || literalText(callback.body.arguments[0]) !== 'p' || callback.body.arguments.length !== 3) return false;
  const content = callback.body.arguments[2];
  return ts.isIdentifier(content) && content.text === callback.parameters[0].name.text;
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
    if (selector.kind === 'function-message') {
      result[key] = functionMessage(source, selector);
    } else if (selector.kind === 'function-call') {
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

export interface BoundSourceNode {
  readonly selector: string;
  readonly nodeKind: 'JsxText' | 'StringLiteral' | 'NoSubstitutionTemplateLiteral';
  readonly startUtf16: number;
  readonly endUtf16: number;
  readonly startByte: number;
  readonly endByte: number;
  readonly line: number;
  readonly column: number;
  readonly rawSource: string;
  readonly english: string;
}

/** A complete captured node, not a substring or a similarly worded comment.
 * Callers still own the whole-file identity and the immutable packet binding.
 * JSX text is intentionally raw: fragment edge whitespace is evidence here. */
export function readCurrentBoundSourceNodes(sourceText: string, bindings: Readonly<Record<string, BoundSourceNode>>): SourceDictionary {
  const source = ts.createSourceFile('bound-source.tsx', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const entries = Object.entries(bindings);
  const result: Record<string, string | undefined> = Object.fromEntries(entries.map(([key]) => [key, undefined]));
  if (hasParseErrors(source) || entries.some(([, binding]) => !binding || typeof binding.selector !== 'string'
    || typeof binding.rawSource !== 'string' || typeof binding.english !== 'string'
    || !['JsxText', 'StringLiteral', 'NoSubstitutionTemplateLiteral'].includes(binding.nodeKind))
    || new Set(entries.map(([, binding]) => binding.selector)).size !== entries.length) return result;
  for (const [key, binding] of entries) {
    if (![binding.startUtf16, binding.endUtf16, binding.startByte, binding.endByte, binding.line, binding.column].every(Number.isSafeInteger)
      || binding.startUtf16 < 0 || binding.endUtf16 <= binding.startUtf16 || binding.endUtf16 > sourceText.length
      || binding.startByte < 0 || binding.endByte <= binding.startByte || binding.line < 1 || binding.column < 1) continue;
    const parts = binding.selector.split('/');
    if (parts.shift() !== 'SourceFile' || !parts.length) continue;
    let node: ts.Node | undefined = source;
    for (const part of parts) {
      const match = /^forEachChild\[(\d+)\]:([A-Za-z]+)$/.exec(part);
      if (!match || !node) { node = undefined; break; }
      const children: ts.Node[] = [];
      ts.forEachChild(node, child => { children.push(child); });
      node = children[Number(match[1])];
      if (node && ts.SyntaxKind[node.kind] !== match[2]) node = undefined;
    }
    if (!node || ts.SyntaxKind[node.kind] !== binding.nodeKind) continue;
    // getStart/getText trim JSX leading spaces. node.pos owns the raw fragment,
    // including the space after a strong title and the row023 newline/indent.
    const start = ts.isJsxText(node) ? node.pos : node.getStart(source);
    const raw = sourceText.slice(start, node.end);
    if (start !== binding.startUtf16 || node.end !== binding.endUtf16 || raw !== binding.rawSource
      || Buffer.byteLength(sourceText.slice(0, start), 'utf8') !== binding.startByte
      || Buffer.byteLength(sourceText.slice(0, node.end), 'utf8') !== binding.endByte) continue;
    const position = source.getLineAndCharacterOfPosition(binding.startUtf16);
    if (position.line + 1 !== binding.line || position.character + 1 !== binding.column) continue;
    const decoded = ts.isJsxText(node) ? raw : literalText(node);
    if (decoded === binding.english) result[key] = decoded;
  }
  return result;
}

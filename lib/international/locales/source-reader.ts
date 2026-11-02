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

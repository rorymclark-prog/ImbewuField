import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import * as pending from '../lib/i18n-pending.ts';
import { LEARNER_UI_ENGLISH } from '../lib/learner-ui-english.ts';
import type { Dict } from '../lib/i18n-pending.ts';

export function englishDictionary(): Dict {
  const source = readFileSync(new URL('../lib/i18n.tsx', import.meta.url), 'utf8');
  const literal = source.match(/export const T_en: Dict = (\{[\s\S]*?\n\});/)?.[1];
  if (!literal) throw new Error('Cannot find the English source dictionary');
  // Evaluate the actual spreads too: counting only literal keys hid whole pending screen areas.
  return new Function(...Object.keys(pending), 'LEARNER_UI_ENGLISH', `return (${literal})`)(
    ...Object.values(pending), LEARNER_UI_ENGLISH,
  ) as Dict;
}

export interface UnwiredText {
  file: string;
  line: number;
  kind: 'text' | 'attribute' | 'conditional';
  text: string;
}

/** Candidates for review, not proof that each English word should be translated (names exist). */
export function visibleLiteralCandidates(file: string, source: string): UnwiredText[] {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: UnwiredText[] = [];
  const add = (node: ts.Node, text: string, kind: UnwiredText['kind']) => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (/[A-Za-z]{2}/.test(normalized)) found.push({
      file, line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1, kind, text: normalized,
    });
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) add(node, node.text, 'text');
    if (ts.isJsxAttribute(node) && /^(aria-label|title|placeholder|alt)$/.test(node.name.getText(tree))) {
      const value = node.initializer;
      if (value && ts.isStringLiteral(value)) add(value, value.text, 'attribute');
      else if (value && ts.isJsxExpression(value) && value.expression && ts.isStringLiteral(value.expression)) {
        add(value.expression, value.expression.text, 'attribute');
      }
    }
    if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) {
      const expression = node.expression;
      if (ts.isStringLiteral(expression)) add(expression, expression.text, 'text');
      if (ts.isConditionalExpression(expression)) {
        for (const branch of [expression.whenTrue, expression.whenFalse]) {
          if (ts.isStringLiteral(branch)) add(branch, branch.text, 'conditional');
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return found;
}

export function appVisibleLiteralCandidates(root: string): UnwiredText[] {
  const found: UnwiredText[] = [];
  const walk = (folder: string) => {
    for (const entry of readdirSync(resolve(root, folder), { withFileTypes: true })) {
      const file = `${folder}/${entry.name}`;
      if (entry.isDirectory()) walk(file);
      else if (file.endsWith('.tsx')) found.push(...visibleLiteralCandidates(file, readFileSync(resolve(root, file), 'utf8')));
    }
  };
  for (const folder of ['app', 'components']) walk(folder);
  return found;
}

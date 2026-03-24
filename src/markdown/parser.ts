import type { MindMapNode } from '../types';
import { generateId } from '../utils/idGenerator';

interface ParsedLine {
  depth: number;
  text: string;
}

function parseLine(line: string): ParsedLine | null {
  // Try heading: # text, ## text, etc.
  const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
  if (headingMatch) {
    const level = headingMatch[1].length; // 1-6
    return { depth: level - 1, text: headingMatch[2].trim() };
  }

  // Try bullet: - text, with optional indentation
  const bulletMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
  if (bulletMatch) {
    const indent = bulletMatch[1].length;
    const bulletDepth = Math.floor(indent / 2);
    // Bullets start at depth 6 (after H6 which is depth 5)
    return { depth: 6 + bulletDepth, text: bulletMatch[2].trim() };
  }

  return null;
}

function makeNode(text: string): MindMapNode {
  return { id: generateId(), text, children: [], collapsed: false };
}

export function parseMarkdown(markdown: string): MindMapNode {
  const lines = markdown.split('\n');
  const parsed: ParsedLine[] = [];

  for (const line of lines) {
    const result = parseLine(line);
    if (result) parsed.push(result);
  }

  if (parsed.length === 0) {
    return makeNode('Untitled');
  }

  // First parsed line becomes root
  const root = makeNode(parsed[0].text);
  const rootDepth = parsed[0].depth;

  // Stack: [node, depth]
  const stack: [MindMapNode, number][] = [[root, rootDepth]];

  for (let i = 1; i < parsed.length; i++) {
    const { depth, text } = parsed[i];
    const newNode = makeNode(text);

    // Pop stack until we find a parent (a node with depth < current)
    while (stack.length > 1 && stack[stack.length - 1][1] >= depth) {
      stack.pop();
    }

    const parent = stack[stack.length - 1][0];
    parent.children.push(newNode);
    stack.push([newNode, depth]);
  }

  return root;
}

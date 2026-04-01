import type { MindMapNode } from '../types';
import { generateId } from '../utils/idGenerator';

interface ParsedLine {
  depth: number;
  text: string;
}

function parseLine(line: string): ParsedLine | null {
  const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    return { depth: level - 1, text: headingMatch[2].trim() };
  }

  const bulletMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
  if (bulletMatch) {
    const indent = bulletMatch[1].length;
    const bulletDepth = Math.floor(indent / 2);
    return { depth: 6 + bulletDepth, text: bulletMatch[2].trim() };
  }

  return null;
}

function parseImageLine(line: string): string | null {
  const match = line.match(/^\s*!\[.*?\]\((.+?)\)\s*$/);
  return match ? match[1] : null;
}

function makeNode(text: string): MindMapNode {
  return { id: generateId(), text, children: [], collapsed: false };
}

export function parseMarkdown(markdown: string): MindMapNode {
  const lines = markdown.split('\n');

  // First pass: parse structural lines, attach images to previous node
  const nodes: { depth: number; text: string; imageUrl?: string }[] = [];

  for (const line of lines) {
    // Check if this line is an image reference
    const imageUrl = parseImageLine(line);
    if (imageUrl && nodes.length > 0) {
      nodes[nodes.length - 1].imageUrl = imageUrl;
      continue;
    }

    const result = parseLine(line);
    if (result) nodes.push(result);
  }

  if (nodes.length === 0) {
    return makeNode('Untitled');
  }

  const root = makeNode(nodes[0].text);
  if (nodes[0].imageUrl) root.imageUrl = nodes[0].imageUrl;
  const rootDepth = nodes[0].depth;

  const stack: [MindMapNode, number][] = [[root, rootDepth]];

  for (let i = 1; i < nodes.length; i++) {
    const { depth, text, imageUrl } = nodes[i];
    const newNode = makeNode(text);
    if (imageUrl) newNode.imageUrl = imageUrl;

    while (stack.length > 1 && stack[stack.length - 1][1] >= depth) {
      stack.pop();
    }

    const parent = stack[stack.length - 1][0];
    parent.children.push(newNode);
    stack.push([newNode, depth]);
  }

  return root;
}

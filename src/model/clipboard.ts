import type { MindMapNode } from '../types';

export interface ParsedNode {
  text: string;
  imageUrl?: string;
  children: ParsedNode[];
}

/** Serialize a node subtree to tab-indented text for clipboard */
export function serializeNodeToText(node: MindMapNode, depth = 0): string {
  const indent = '\t'.repeat(depth);
  const lines = [indent + node.text];
  if (node.imageUrl) {
    lines.push(indent + `![image](${node.imageUrl})`);
  }
  for (const child of node.children) {
    lines.push(serializeNodeToText(child, depth + 1));
  }
  return lines.join('\n');
}

/** Parse tab-indented text into a tree of ParsedNodes */
export function parseIndentedText(text: string): ParsedNode[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) return [];

  const roots: ParsedNode[] = [];
  const stack: { node: ParsedNode; depth: number }[] = [];

  for (const line of lines) {
    const stripped = line.replace(/^\t*/, '');
    const depth = line.length - stripped.length;

    // Image line: ![image](filename)
    const imgMatch = stripped.match(/^!\[image\]\((.+)\)$/);
    if (imgMatch) {
      const parent = stack.length > 0 ? stack[stack.length - 1].node : null;
      if (parent) parent.imageUrl = imgMatch[1];
      continue;
    }

    const node: ParsedNode = { text: stripped, children: [] };

    // Pop stack to find parent
    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].node.children.push(node);
    }
    stack.push({ node, depth });
  }

  return roots;
}

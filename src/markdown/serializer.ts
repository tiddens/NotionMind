import type { MindMapNode } from '../types';

export function serializeToMarkdown(root: MindMapNode): string {
  const lines: string[] = [];
  serializeNode(root, 0, lines);
  return lines.join('\n') + '\n';
}

function serializeNode(node: MindMapNode, depth: number, lines: string[]): void {
  if (depth === 0) {
    // Root → H1
    lines.push(`# ${node.text}`);
  } else if (depth <= 5) {
    // Depths 1-5 → H2-H6
    lines.push('');
    lines.push(`${'#'.repeat(depth + 1)} ${node.text}`);
  } else {
    // Depth 6+ → nested bullets
    const indent = '  '.repeat(depth - 6);
    lines.push(`${indent}- ${node.text}`);
  }

  for (const child of node.children) {
    serializeNode(child, depth + 1, lines);
  }
}

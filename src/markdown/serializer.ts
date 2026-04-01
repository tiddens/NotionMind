import type { MindMapNode } from '../types';

export function serializeToMarkdown(root: MindMapNode): string {
  const lines: string[] = [];
  serializeNode(root, 0, lines);
  return lines.join('\n') + '\n';
}

function serializeNode(node: MindMapNode, depth: number, lines: string[]): void {
  if (depth === 0) {
    lines.push(`# ${node.text}`);
  } else if (depth <= 5) {
    lines.push('');
    lines.push(`${'#'.repeat(depth + 1)} ${node.text}`);
  } else {
    const indent = '  '.repeat(depth - 6);
    lines.push(`${indent}- ${node.text}`);
  }

  if (node.imageUrl) {
    if (depth <= 5) {
      lines.push(`![image](${node.imageUrl})`);
    } else {
      const indent = '  '.repeat(depth - 6);
      lines.push(`${indent}  ![image](${node.imageUrl})`);
    }
  }

  for (const child of node.children) {
    serializeNode(child, depth + 1, lines);
  }
}

import { describe, it, expect } from 'vitest';
import type { MindMapNode } from '../types';
import { serializeToMarkdown } from './serializer';
import { parseMarkdown } from './parser';

function node(text: string, children: MindMapNode[] = []): MindMapNode {
  return { id: text, text, children, collapsed: false };
}

describe('serializeToMarkdown', () => {
  it('root becomes H1', () => {
    const md = serializeToMarkdown(node('Root'));
    expect(md.trim()).toBe('# Root');
  });

  it('children become H2-H6', () => {
    const tree = node('R', [node('D1', [node('D2', [node('D3', [node('D4', [node('D5')])])])])]);
    const md = serializeToMarkdown(tree);
    expect(md).toContain('## D1');
    expect(md).toContain('### D2');
    expect(md).toContain('#### D3');
    expect(md).toContain('##### D4');
    expect(md).toContain('###### D5');
  });

  it('depth 6+ becomes bullet lists', () => {
    const d6 = node('D6');
    const d5 = node('D5', [d6]);
    const tree = node('R', [node('1', [node('2', [node('3', [node('4', [d5])])])])]);
    const md = serializeToMarkdown(tree);
    expect(md).toContain('- D6');
  });

  it('round-trip preserves structure', () => {
    const tree = node('Root', [
      node('A', [node('A1'), node('A2')]),
      node('B'),
    ]);
    const md = serializeToMarkdown(tree);
    const parsed = parseMarkdown(md);
    expect(parsed.text).toBe('Root');
    expect(parsed.children.length).toBe(2);
    expect(parsed.children[0].text).toBe('A');
    expect(parsed.children[0].children.length).toBe(2);
    expect(parsed.children[1].text).toBe('B');
  });
});

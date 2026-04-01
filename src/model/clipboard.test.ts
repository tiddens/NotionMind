import { describe, it, expect } from 'vitest';
import type { MindMapNode } from '../types';
import { serializeNodeToText, parseIndentedText } from './clipboard';

function makeNode(text: string, children: MindMapNode[] = [], imageUrl?: string): MindMapNode {
  return { id: text, text, children, collapsed: false, imageUrl };
}

// Strip IDs/collapsed for comparison — just text, imageUrl, children structure
function toStructure(parsed: ReturnType<typeof parseIndentedText>): unknown[] {
  return parsed.map(n => ({
    text: n.text,
    ...(n.imageUrl ? { imageUrl: n.imageUrl } : {}),
    ...(n.children.length > 0 ? { children: toStructure(n.children) } : {}),
  }));
}

function nodeToStructure(node: MindMapNode): unknown {
  return {
    text: node.text,
    ...(node.imageUrl ? { imageUrl: node.imageUrl } : {}),
    ...(node.children.length > 0 ? { children: node.children.map(nodeToStructure) } : {}),
  };
}

describe('clipboard round-trip', () => {
  it('single node', () => {
    const node = makeNode('Hello');
    const text = serializeNodeToText(node);
    expect(text).toBe('Hello');
    const parsed = parseIndentedText(text);
    expect(toStructure(parsed)).toEqual([{ text: 'Hello' }]);
  });

  it('node with children', () => {
    const node = makeNode('Parent', [
      makeNode('Child 1'),
      makeNode('Child 2'),
    ]);
    const text = serializeNodeToText(node);
    expect(text).toBe('Parent\n\tChild 1\n\tChild 2');
    const parsed = parseIndentedText(text);
    expect(toStructure(parsed)).toEqual([{
      text: 'Parent',
      children: [{ text: 'Child 1' }, { text: 'Child 2' }],
    }]);
  });

  it('deep nesting (3 levels)', () => {
    const node = makeNode('A', [
      makeNode('B', [
        makeNode('C'),
      ]),
    ]);
    const text = serializeNodeToText(node);
    expect(text).toBe('A\n\tB\n\t\tC');
    const parsed = parseIndentedText(text);
    expect(toStructure(parsed)).toEqual([{
      text: 'A',
      children: [{ text: 'B', children: [{ text: 'C' }] }],
    }]);
  });

  it('node with image', () => {
    const node = makeNode('Photo', [], 'abc123.jpg');
    const text = serializeNodeToText(node);
    expect(text).toBe('Photo\n![image](abc123.jpg)');
    const parsed = parseIndentedText(text);
    expect(toStructure(parsed)).toEqual([{ text: 'Photo', imageUrl: 'abc123.jpg' }]);
  });

  it('nested node with image', () => {
    const node = makeNode('Parent', [
      makeNode('Child', [], 'img.png'),
    ]);
    const text = serializeNodeToText(node);
    expect(text).toBe('Parent\n\tChild\n\t![image](img.png)');
    const parsed = parseIndentedText(text);
    expect(toStructure(parsed)).toEqual([{
      text: 'Parent',
      children: [{ text: 'Child', imageUrl: 'img.png' }],
    }]);
  });

  it('multiple root nodes (multi-select copy)', () => {
    const nodes = [makeNode('First'), makeNode('Second')];
    const text = nodes.map(n => serializeNodeToText(n)).join('\n');
    expect(text).toBe('First\nSecond');
    const parsed = parseIndentedText(text);
    expect(toStructure(parsed)).toEqual([{ text: 'First' }, { text: 'Second' }]);
  });

  it('complex tree round-trips correctly', () => {
    const node = makeNode('Root', [
      makeNode('A', [
        makeNode('A1', [], 'a1.jpg'),
        makeNode('A2'),
      ]),
      makeNode('B', [
        makeNode('B1', [
          makeNode('B1a'),
        ]),
      ], 'b.png'),
      makeNode('C'),
    ]);
    const text = serializeNodeToText(node);
    const parsed = parseIndentedText(text);
    const expected = nodeToStructure(node);
    expect(toStructure(parsed)).toEqual([expected]);
  });

  it('round-trip with multiple root nodes and deep nesting', () => {
    const nodes = [
      makeNode('X', [makeNode('X1', [makeNode('X1a')])]),
      makeNode('Y', [], 'y.gif'),
      makeNode('Z', [makeNode('Z1'), makeNode('Z2', [makeNode('Z2a')])]),
    ];
    const text = nodes.map(n => serializeNodeToText(n)).join('\n');
    const parsed = parseIndentedText(text);
    expect(toStructure(parsed)).toEqual(nodes.map(nodeToStructure));
  });

  it('handles empty text', () => {
    const parsed = parseIndentedText('');
    expect(parsed).toEqual([]);
  });

  it('handles whitespace-only text', () => {
    const parsed = parseIndentedText('  \n  \n  ');
    expect(parsed).toEqual([]);
  });

  it('plain text (no tabs) creates flat siblings', () => {
    const parsed = parseIndentedText('Line 1\nLine 2\nLine 3');
    expect(toStructure(parsed)).toEqual([
      { text: 'Line 1' },
      { text: 'Line 2' },
      { text: 'Line 3' },
    ]);
  });

  it('handles Windows-style line endings (\\r\\n)', () => {
    const parsed = parseIndentedText('Parent\r\n\tChild 1\r\n\tChild 2');
    expect(toStructure(parsed)).toEqual([{
      text: 'Parent',
      children: [{ text: 'Child 1' }, { text: 'Child 2' }],
    }]);
  });

  it('handles mixed depths with siblings', () => {
    const text = 'A\n\tA1\n\tA2\n\t\tA2a\nB\n\tB1';
    const parsed = parseIndentedText(text);
    expect(toStructure(parsed)).toEqual([
      { text: 'A', children: [
        { text: 'A1' },
        { text: 'A2', children: [{ text: 'A2a' }] },
      ]},
      { text: 'B', children: [{ text: 'B1' }] },
    ]);
  });

  it('image on first node (no indent) attaches correctly', () => {
    const text = 'My Node\n![image](photo.jpg)\n\tChild';
    const parsed = parseIndentedText(text);
    expect(toStructure(parsed)).toEqual([{
      text: 'My Node',
      imageUrl: 'photo.jpg',
      children: [{ text: 'Child' }],
    }]);
  });

  it('skipping indent levels still parses correctly', () => {
    // Tab jumps from 0 to 2 — should treat as child of most recent
    const text = 'Root\n\t\tDeep';
    const parsed = parseIndentedText(text);
    expect(toStructure(parsed)).toEqual([{
      text: 'Root',
      children: [{ text: 'Deep' }],
    }]);
  });
});

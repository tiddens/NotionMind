import { describe, it, expect } from 'vitest';
import type { MindMapNode } from '../types';
import { computeLayout, splitSides, getSide } from './treeLayout';

function node(id: string, text: string, children: MindMapNode[] = [], side?: 'left' | 'right'): MindMapNode {
  return { id, text, children, collapsed: false, side };
}

describe('splitSides', () => {
  it('distributes unsided children evenly', () => {
    const root = node('r', 'R', [node('a', 'A'), node('b', 'B'), node('c', 'C')]);
    const { right, left } = splitSides(root);
    expect(right.length).toBe(2);
    expect(left.length).toBe(1);
  });

  it('respects explicit side property', () => {
    const root = node('r', 'R', [
      node('a', 'A', [], 'left'),
      node('b', 'B', [], 'left'),
      node('c', 'C', [], 'right'),
    ]);
    const { right, left } = splitSides(root);
    expect(right.length).toBe(1);
    expect(right[0].id).toBe('c');
    expect(left.length).toBe(2);
  });

  it('allows all children on one side', () => {
    const root = node('r', 'R', [
      node('a', 'A', [], 'right'),
      node('b', 'B', [], 'right'),
      node('c', 'C', [], 'right'),
    ]);
    const { right, left } = splitSides(root);
    expect(right.length).toBe(3);
    expect(left.length).toBe(0);
  });
});

describe('computeLayout', () => {
  it('places root near center', () => {
    const root = node('r', 'Root');
    const layout = computeLayout(root);
    const rl = layout.get('r')!;
    expect(rl.y).toBe(0);
    expect(rl.x).toBeLessThan(0); // centered: x = -width/2
  });

  it('places right children to the right', () => {
    const root = node('r', 'R', [node('a', 'A', [], 'right')]);
    const layout = computeLayout(root);
    expect(layout.get('a')!.x).toBeGreaterThan(0);
  });

  it('places left children to the left', () => {
    const root = node('r', 'R', [node('a', 'A', [], 'left')]);
    const layout = computeLayout(root);
    expect(layout.get('a')!.x).toBeLessThan(0);
  });

  it('collapsed node has no children in layout', () => {
    const root = node('r', 'R', [
      { id: 'a', text: 'A', children: [node('a1', 'A1')], collapsed: true, side: 'right' },
    ]);
    const layout = computeLayout(root);
    expect(layout.has('a')).toBe(true);
    expect(layout.has('a1')).toBe(false);
  });

  it('sets depth and branchIndex', () => {
    const root = node('r', 'R', [
      node('a', 'A', [node('a1', 'A1')], 'right'),
    ]);
    const layout = computeLayout(root);
    expect(layout.get('r')!.depth).toBe(0);
    expect(layout.get('a')!.depth).toBe(1);
    expect(layout.get('a1')!.depth).toBe(2);
    expect(layout.get('a1')!.branchIndex).toBe(layout.get('a')!.branchIndex);
  });
});

describe('getSide', () => {
  it('returns correct side for direct children', () => {
    const root = node('r', 'R', [
      node('a', 'A', [], 'right'),
      node('b', 'B', [], 'left'),
    ]);
    expect(getSide(root, 'a')).toBe('right');
    expect(getSide(root, 'b')).toBe('left');
  });

  it('returns correct side for deeply nested nodes', () => {
    const root = node('r', 'R', [
      node('a', 'A', [node('a1', 'A1', [node('a1x', 'Deep')])], 'left'),
    ]);
    expect(getSide(root, 'a1x')).toBe('left');
  });
});

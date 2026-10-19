import { describe, it, expect } from 'vitest';
import type { ImageDimensions, MindMapNode } from '../types';
import { computeLayout, splitSides, getSide } from './treeLayout';
import { LAYOUT } from '../utils/constants';

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

  it('fits a wide image without reserving unused vertical space', () => {
    const child = { ...node('a', 'A'), imageUrl: 'wide.png' };
    const root = node('r', 'R', [child]);
    const sizes = new Map([['wide.png', { width: 1400, height: 200 }]]);
    const layout = computeLayout(root, sizes).get('a')!;
    expect(layout.imageWidth).toBe(140);
    expect(layout.imageHeight).toBe(20);
    expect(layout.width).toBe(140 + LAYOUT.NODE_PADDING_X * 2);
    expect(layout.height).toBe(LAYOUT.NODE_HEIGHT + 20 + LAYOUT.IMAGE_PADDING);
    expect(layout.height).toBeLessThan(computeLayout(root).get('a')!.height);
  });

  it('fits portrait images while preserving the minimum and text widths', () => {
    const short = { ...node('a', 'A'), imageUrl: 'portrait.png' };
    const long = { ...node('b', 'A longer node title still needs its full width'), imageUrl: 'portrait.png' };
    const sizes = new Map([['portrait.png', { width: 200, height: 1000 }]]);
    const layout = computeLayout(node('r', 'R', [short, long]), sizes);
    expect(layout.get('a')!.imageWidth).toBe(18);
    expect(layout.get('a')!.imageHeight).toBe(90);
    expect(layout.get('a')!.width).toBe(LAYOUT.NODE_MIN_WIDTH);
    expect(layout.get('a')!.height).toBe(LAYOUT.NODE_HEIGHT + 90 + LAYOUT.IMAGE_PADDING);
    expect(layout.get('b')!.width).toBe(long.text.length * LAYOUT.NODE_CHAR_WIDTH + LAYOUT.NODE_PADDING_X * 2);
  });

  it('sizes image roots and keeps branches outside the centered root', () => {
    const root = {
      ...node('r', 'R', [node('a', 'A', [], 'left'), node('b', 'B', [], 'right')]),
      imageUrl: 'root.png',
    };
    const layout = computeLayout(root, new Map([['root.png', { width: 700, height: 100 }]]));
    const rootLayout = layout.get('r')!;
    expect(rootLayout.imageWidth).toBe(140);
    expect(rootLayout.imageHeight).toBe(20);
    expect(rootLayout.height).toBe(LAYOUT.NODE_HEIGHT + 20 + LAYOUT.IMAGE_PADDING);
    expect(rootLayout.x).toBe(-rootLayout.width / 2);
    expect(rootLayout.y).toBe(0);
    expect(layout.get('a')!.x + layout.get('a')!.width).toBe(rootLayout.x - LAYOUT.HORIZONTAL_GAP);
    expect(layout.get('b')!.x).toBe(rootLayout.x + rootLayout.width + LAYOUT.HORIZONTAL_GAP);
  });

  it.each(['left', 'right'] as const)('preserves sibling and subtree spacing on the %s side', side => {
    const wide = { ...node('wide', 'Wide'), imageUrl: 'wide.png' };
    const portrait = { ...node('portrait', 'Portrait'), imageUrl: 'portrait.png' };
    const first = { ...node('first', 'First', [wide, portrait], side), imageUrl: 'wide.png' };
    const second = { ...node('second', 'Second', [], side), imageUrl: 'portrait.png' };
    const sizes = new Map<string, ImageDimensions>([
      ['wide.png', { width: 1400, height: 200 }],
      ['portrait.png', { width: 200, height: 1000 }],
    ]);
    const layout = computeLayout(node('r', 'Root', [first, second]), sizes);
    const wideLayout = layout.get('wide')!;
    const portraitLayout = layout.get('portrait')!;
    const firstLayout = layout.get('first')!;
    const secondLayout = layout.get('second')!;
    expect(portraitLayout.y - portraitLayout.height / 2 - (wideLayout.y + wideLayout.height / 2)).toBeCloseTo(LAYOUT.VERTICAL_GAP);
    expect(secondLayout.y - secondLayout.height / 2 - (portraitLayout.y + portraitLayout.height / 2)).toBeCloseTo(LAYOUT.VERTICAL_GAP);
    for (const child of [wideLayout, portraitLayout]) {
      expect(child.side).toBe(side);
      expect(child.depth).toBe(2);
      const gap = side === 'left'
        ? firstLayout.x - (child.x + child.width)
        : child.x - (firstLayout.x + firstLayout.width);
      expect(gap).toBeCloseTo(LAYOUT.HORIZONTAL_GAP);
    }
  });

  it('retains the fallback image area until valid natural dimensions are available', () => {
    const root = { ...node('r', 'R'), imageUrl: 'pending.png' };
    for (const dimensions of [undefined, { width: 0, height: 100 }, { width: 100, height: -1 }, { width: Infinity, height: 10 }]) {
      const sizes = new Map<string, ImageDimensions>();
      if (dimensions) sizes.set('pending.png', dimensions);
      const layout = computeLayout(root, sizes).get('r')!;
      expect(layout.imageWidth).toBe(LAYOUT.IMAGE_MAX_WIDTH);
      expect(layout.imageHeight).toBe(LAYOUT.IMAGE_MAX_HEIGHT);
      expect(layout.height).toBe(LAYOUT.NODE_HEIGHT + LAYOUT.IMAGE_MAX_HEIGHT + LAYOUT.IMAGE_PADDING);
    }
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

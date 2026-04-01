import { describe, it, expect } from 'vitest';
import type { MindMapNode } from '../types';
import {
  createNode, createDefaultTree, findNode, findParent, findSiblingIndex,
  addChild, addSibling, removeNode, moveAmongSiblings,
  promote, demote, moveToSide, moveAllToSide, moveLeft, moveRight,
  moveBatchAmongSiblings, moveBatchLeft, moveBatchRight,
  updateText, toggleCollapsed,
  updateNodeImage, removeNodeImage,
  getVisiblePrevSibling, getVisibleNextSibling, getFirstChild, getDeepestLastChild,
  extractSideMeta, applySideMeta, assignMissingSides,
  collectVisibleNodes, collectEdges,
} from './MindMapTree';
import { splitSides } from '../layout/treeLayout';

/**
 * Standard test tree:
 *
 * Root
 * ├── A (right)   children: [A1, A2]
 * │   ├── A1
 * │   └── A2
 * ├── B (right)   leaf
 * ├── C (left)    children: [C1]
 * │   └── C1
 * └── D (left)    leaf
 */
function buildTree(): MindMapNode {
  return {
    id: 'root', text: 'Root', collapsed: false, children: [
      {
        id: 'a', text: 'A', collapsed: false, side: 'right', children: [
          { id: 'a1', text: 'A1', collapsed: false, children: [] },
          { id: 'a2', text: 'A2', collapsed: false, children: [] },
        ]
      },
      { id: 'b', text: 'B', collapsed: false, side: 'right', children: [] },
      {
        id: 'c', text: 'C', collapsed: false, side: 'left', children: [
          { id: 'c1', text: 'C1', collapsed: false, children: [] },
        ]
      },
      { id: 'd', text: 'D', collapsed: false, side: 'left', children: [] },
    ]
  };
}

// ============================================================
// Basic CRUD
// ============================================================

describe('createNode / createDefaultTree', () => {
  it('creates a node with correct shape', () => {
    const n = createNode('Test');
    expect(n.text).toBe('Test');
    expect(n.children).toEqual([]);
    expect(n.collapsed).toBe(false);
    expect(n.id).toBeTruthy();
  });

  it('createDefaultTree has "Central Topic"', () => {
    expect(createDefaultTree().text).toBe('Central Topic');
  });
});

describe('findNode / findParent / findSiblingIndex', () => {
  const root = buildTree();

  it('finds root', () => expect(findNode(root, 'root')?.text).toBe('Root'));
  it('finds nested node', () => expect(findNode(root, 'a1')?.text).toBe('A1'));
  it('returns null for missing id', () => expect(findNode(root, 'nope')).toBeNull());
  it('parent of root child', () => expect(findParent(root, 'a')?.id).toBe('root'));
  it('parent of grandchild', () => expect(findParent(root, 'a1')?.id).toBe('a'));
  it('root has no parent', () => expect(findParent(root, 'root')).toBeNull());
  it('sibling index', () => expect(findSiblingIndex(root, 'b')).toBe(1));
});

// ============================================================
// addChild — side assignment
// ============================================================

describe('addChild — side assignment', () => {
  it('adds child to non-root, no side', () => {
    const { tree, newId } = addChild(buildTree(), 'a');
    expect(findNode(tree, newId)!.side).toBeUndefined();
    expect(findNode(tree, 'a')!.children.length).toBe(3);
  });

  it('adds child to root, assigns side for balance', () => {
    const { tree, newId } = addChild(buildTree(), 'root');
    expect(findNode(tree, newId)!.side).toBeDefined();
  });

  it('assigns left when right has more', () => {
    const root = buildTree(); // 2 right (A,B), 2 left (C,D) → balanced, next goes right
    const { tree, newId } = addChild(root, 'root');
    // With 2R 2L, right.length <= left.length is true (equal), so it goes right
    expect(findNode(tree, newId)!.side).toBe('right');
  });

  it('un-collapses parent', () => {
    const root = buildTree();
    findNode(root, 'a')!.collapsed = true;
    const { tree } = addChild(root, 'a');
    expect(findNode(tree, 'a')!.collapsed).toBe(false);
  });

  it('does not mutate original', () => {
    const root = buildTree();
    addChild(root, 'a');
    expect(findNode(root, 'a')!.children.length).toBe(2);
  });
});

// ============================================================
// addSibling — side inheritance
// ============================================================

describe('addSibling — side inheritance', () => {
  it('on root falls back to addChild', () => {
    const { tree } = addSibling(buildTree(), 'root');
    expect(tree.children.length).toBe(5);
  });

  it('inserts after target', () => {
    const { tree, newId } = addSibling(buildTree(), 'a1');
    expect(findNode(tree, 'a')!.children[1].id).toBe(newId);
  });

  it('inherits right side from right root child', () => {
    const { tree, newId } = addSibling(buildTree(), 'a');
    expect(findNode(tree, newId)!.side).toBe('right');
  });

  it('inherits left side from left root child', () => {
    const { tree, newId } = addSibling(buildTree(), 'c');
    expect(findNode(tree, newId)!.side).toBe('left');
  });

  it('nested sibling gets no side', () => {
    const { tree, newId } = addSibling(buildTree(), 'a1');
    expect(findNode(tree, newId)!.side).toBeUndefined();
  });
});

// ============================================================
// removeNode
// ============================================================

describe('removeNode', () => {
  it('cannot delete root', () => {
    const { tree, nextSelectId } = removeNode(buildTree(), 'root');
    expect(tree.children.length).toBe(4);
    expect(nextSelectId).toBe('root');
  });

  it('deletes and selects next sibling', () => {
    const { tree, nextSelectId } = removeNode(buildTree(), 'a');
    expect(tree.children.length).toBe(3);
    expect(nextSelectId).toBe('b');
  });

  it('selects previous sibling if deleting last', () => {
    const { nextSelectId } = removeNode(buildTree(), 'd');
    expect(nextSelectId).toBe('c');
  });

  it('selects parent when no siblings left', () => {
    const { nextSelectId } = removeNode(buildTree(), 'c1');
    expect(nextSelectId).toBe('c');
  });
});

// ============================================================
// moveAmongSiblings — Ctrl+Up/Down (same-side at root)
// ============================================================

describe('moveAmongSiblings — same-side at root level', () => {
  it('move B up: swaps with A (both right)', () => {
    const tree = moveAmongSiblings(buildTree(), 'b', 'up');
    const right = tree.children.filter(c => c.side === 'right');
    expect(right[0].id).toBe('b');
    expect(right[1].id).toBe('a');
  });

  it('move A down: swaps with B (both right)', () => {
    const tree = moveAmongSiblings(buildTree(), 'a', 'down');
    const right = tree.children.filter(c => c.side === 'right');
    expect(right[0].id).toBe('b');
    expect(right[1].id).toBe('a');
  });

  it('move A up: no-op (already top of right)', () => {
    const root = buildTree();
    const tree = moveAmongSiblings(root, 'a', 'up');
    expect(tree.children.filter(c => c.side === 'right').map(c => c.id)).toEqual(['a', 'b']);
  });

  it('move B down: no-op (already bottom of right)', () => {
    const tree = moveAmongSiblings(buildTree(), 'b', 'down');
    expect(tree.children.filter(c => c.side === 'right').map(c => c.id)).toEqual(['a', 'b']);
  });

  it('move C down: swaps with D (both left)', () => {
    const tree = moveAmongSiblings(buildTree(), 'c', 'down');
    const left = tree.children.filter(c => c.side === 'left');
    expect(left[0].id).toBe('d');
    expect(left[1].id).toBe('c');
  });

  it('move D up: swaps with C (both left)', () => {
    const tree = moveAmongSiblings(buildTree(), 'd', 'up');
    const left = tree.children.filter(c => c.side === 'left');
    expect(left[0].id).toBe('d');
    expect(left[1].id).toBe('c');
  });

  it('move C up: no-op (already top of left)', () => {
    const tree = moveAmongSiblings(buildTree(), 'c', 'up');
    expect(tree.children.filter(c => c.side === 'left').map(c => c.id)).toEqual(['c', 'd']);
  });

  it('CROSS-SIDE ISOLATION: B down does NOT jump to C', () => {
    const tree = moveAmongSiblings(buildTree(), 'b', 'down');
    // B should still be a root child, not moved into left side
    expect(tree.children.some(c => c.id === 'b')).toBe(true);
    expect(tree.children.filter(c => c.side === 'left').map(c => c.id)).toEqual(['c', 'd']);
  });

  it('nested: A1 down swaps with A2 normally', () => {
    const tree = moveAmongSiblings(buildTree(), 'a1', 'down');
    const a = findNode(tree, 'a')!;
    expect(a.children[0].id).toBe('a2');
    expect(a.children[1].id).toBe('a1');
  });

  it('root itself: no-op', () => {
    const tree = moveAmongSiblings(buildTree(), 'root', 'down');
    expect(tree.children.length).toBe(4);
  });
});

// ============================================================
// demote — Ctrl+Right
// ============================================================

describe('demote — side-aware for root children', () => {
  it('demote B (right): becomes child of A (prev right sibling)', () => {
    const tree = demote(buildTree(), 'b');
    expect(tree.children.some(c => c.id === 'b')).toBe(false);
    expect(findNode(tree, 'a')!.children.some(c => c.id === 'b')).toBe(true);
  });

  it('demote D (left): becomes child of C (prev left sibling)', () => {
    const tree = demote(buildTree(), 'd');
    expect(tree.children.some(c => c.id === 'd')).toBe(false);
    expect(findNode(tree, 'c')!.children.some(c => c.id === 'd')).toBe(true);
  });

  it('demote A (first right): no-op', () => {
    const tree = demote(buildTree(), 'a');
    expect(tree.children.filter(c => c.side === 'right').length).toBe(2);
  });

  it('demote C (first left): no-op', () => {
    const tree = demote(buildTree(), 'c');
    expect(tree.children.filter(c => c.side === 'left').length).toBe(2);
  });

  it('demote A1 (first nested child): no-op', () => {
    const tree = demote(buildTree(), 'a1');
    expect(findNode(tree, 'a')!.children.length).toBe(2);
  });

  it('demote A2 (nested): becomes child of A1', () => {
    const tree = demote(buildTree(), 'a2');
    expect(findNode(tree, 'a1')!.children[0].id).toBe('a2');
    expect(findNode(tree, 'a')!.children.length).toBe(1);
  });

  it('SIDE CLEANUP: demoted root child loses .side property', () => {
    const tree = demote(buildTree(), 'b');
    const b = findNode(tree, 'b')!;
    expect(b.side).toBeUndefined();
  });

  it('UN-COLLAPSE: demoting into collapsed target un-collapses it', () => {
    const root = buildTree();
    findNode(root, 'a')!.collapsed = true;
    const tree = demote(root, 'b');
    expect(findNode(tree, 'a')!.collapsed).toBe(false);
  });

  it('root itself: no-op', () => {
    const tree = demote(buildTree(), 'root');
    expect(tree.children.length).toBe(4);
  });
});

// ============================================================
// promote — Ctrl+Left (for non-root children)
// ============================================================

describe('promote', () => {
  it('promote A1: becomes root child after A', () => {
    const tree = promote(buildTree(), 'a1');
    expect(tree.children.some(c => c.id === 'a1')).toBe(true);
    const aIdx = tree.children.findIndex(c => c.id === 'a');
    const a1Idx = tree.children.findIndex(c => c.id === 'a1');
    expect(a1Idx).toBe(aIdx + 1);
  });

  it('promote A2: also becomes root child after A', () => {
    const tree = promote(buildTree(), 'a2');
    expect(tree.children.some(c => c.id === 'a2')).toBe(true);
    expect(findNode(tree, 'a')!.children.length).toBe(1);
  });

  it('promote root child A: no-op', () => {
    const tree = promote(buildTree(), 'a');
    expect(tree.children.length).toBe(4);
  });

  it('promote root: no-op', () => {
    const tree = promote(buildTree(), 'root');
    expect(tree.children.length).toBe(4);
  });

  it('does not mutate original', () => {
    const root = buildTree();
    promote(root, 'a1');
    expect(findNode(root, 'a')!.children.length).toBe(2);
  });
});

// ============================================================
// moveLeft / moveRight (high-level)
// ============================================================

describe('moveLeft / moveRight — high-level operations', () => {
  it('moveLeft on root: all children get side left', () => {
    const tree = moveLeft(buildTree(), 'root');
    tree.children.forEach(c => expect(c.side).toBe('left'));
  });

  it('moveRight on root: all children get side right', () => {
    const tree = moveRight(buildTree(), 'root');
    tree.children.forEach(c => expect(c.side).toBe('right'));
  });

  it('moveLeft on root child A: switches side to left', () => {
    const tree = moveLeft(buildTree(), 'a');
    expect(findNode(tree, 'a')!.side).toBe('left');
  });

  it('moveRight on root child B: demotes into A', () => {
    const tree = moveRight(buildTree(), 'b');
    expect(findNode(tree, 'a')!.children.some(c => c.id === 'b')).toBe(true);
    expect(tree.children.some(c => c.id === 'b')).toBe(false);
  });

  it('moveRight on first root child A (already right): stays as root child', () => {
    const tree = moveRight(buildTree(), 'a');
    expect(tree.children.some(c => c.id === 'a')).toBe(true);
    expect(tree.children.length).toBe(4);
  });

  it('moveRight on first-on-left root child C: switches to right side', () => {
    const tree = moveRight(buildTree(), 'c');
    expect(findNode(tree, 'c')!.side).toBe('right');
    expect(tree.children.some(c => c.id === 'c')).toBe(true);
  });

  it('moveLeft on A1 (nested): promotes to root level', () => {
    const tree = moveLeft(buildTree(), 'a1');
    expect(tree.children.some(c => c.id === 'a1')).toBe(true);
  });

  it('moveRight on A2 (nested): demotes into A1', () => {
    const tree = moveRight(buildTree(), 'a2');
    expect(findNode(tree, 'a1')!.children[0].id).toBe('a2');
  });

  it('moveRight on D (left): demotes into C', () => {
    const tree = moveRight(buildTree(), 'd');
    expect(findNode(tree, 'c')!.children.some(c => c.id === 'd')).toBe(true);
  });
});

// ============================================================
// moveToSide / moveAllToSide
// ============================================================

describe('moveToSide / moveAllToSide', () => {
  it('moveToSide A to left', () => {
    const tree = moveToSide(buildTree(), 'a', 'left');
    expect(findNode(tree, 'a')!.side).toBe('left');
  });

  it('moveToSide on non-root-child: no-op', () => {
    const tree = moveToSide(buildTree(), 'a1', 'right');
    expect(findNode(tree, 'a1')!.side).toBeUndefined();
  });

  it('moveAllToSide right: all on right', () => {
    const tree = moveAllToSide(buildTree(), 'right');
    const { right, left } = splitSides(tree);
    expect(right.length).toBe(4);
    expect(left.length).toBe(0);
  });

  it('moveAllToSide left: all on left', () => {
    const tree = moveAllToSide(buildTree(), 'left');
    const { right, left } = splitSides(tree);
    expect(right.length).toBe(0);
    expect(left.length).toBe(4);
  });
});

// ============================================================
// Navigation — getVisiblePrevSibling / getVisibleNextSibling
// ============================================================

describe('navigation — same-side sibling traversal', () => {
  it('next of A (right) → B', () => {
    expect(getVisibleNextSibling(buildTree(), 'a')?.id).toBe('b');
  });

  it('next of B (right) → null (end of right)', () => {
    expect(getVisibleNextSibling(buildTree(), 'b')).toBeNull();
  });

  it('next of C (left) → D', () => {
    expect(getVisibleNextSibling(buildTree(), 'c')?.id).toBe('d');
  });

  it('next of D (left) → null (end of left)', () => {
    expect(getVisibleNextSibling(buildTree(), 'd')).toBeNull();
  });

  it('prev of B (right) → A', () => {
    expect(getVisiblePrevSibling(buildTree(), 'b')?.id).toBe('a');
  });

  it('prev of A (right) → null (start of right)', () => {
    expect(getVisiblePrevSibling(buildTree(), 'a')).toBeNull();
  });

  it('prev of C (left) → null (start of left)', () => {
    expect(getVisiblePrevSibling(buildTree(), 'c')).toBeNull();
  });

  it('prev of D (left) → C', () => {
    expect(getVisiblePrevSibling(buildTree(), 'd')?.id).toBe('c');
  });

  it('CROSS-SIDE ISOLATION: next of B is NOT C', () => {
    const next = getVisibleNextSibling(buildTree(), 'b');
    expect(next?.id).not.toBe('c');
    expect(next).toBeNull();
  });

  it('nested: next of A1 → A2', () => {
    expect(getVisibleNextSibling(buildTree(), 'a1')?.id).toBe('a2');
  });

  it('nested: prev of A2 → A1', () => {
    expect(getVisiblePrevSibling(buildTree(), 'a2')?.id).toBe('a1');
  });

  it('nested: next of A2 → null', () => {
    expect(getVisibleNextSibling(buildTree(), 'a2')).toBeNull();
  });

  it('nested: prev of A1 → null', () => {
    expect(getVisiblePrevSibling(buildTree(), 'a1')).toBeNull();
  });
});

// ============================================================
// Navigation — getFirstChild / getDeepestLastChild
// ============================================================

describe('navigation — getFirstChild / getDeepestLastChild', () => {
  it('first child of A → A1', () => {
    expect(getFirstChild(findNode(buildTree(), 'a')!)?.id).toBe('a1');
  });

  it('first child of leaf B → null', () => {
    expect(getFirstChild(findNode(buildTree(), 'b')!)).toBeNull();
  });

  it('first child of collapsed A → null', () => {
    const root = buildTree();
    findNode(root, 'a')!.collapsed = true;
    expect(getFirstChild(findNode(root, 'a')!)).toBeNull();
  });

  it('deepest last child of root → D (last root child is leaf)', () => {
    expect(getDeepestLastChild(buildTree()).id).toBe('d');
  });

  it('deepest last child of A → A2', () => {
    expect(getDeepestLastChild(findNode(buildTree(), 'a')!).id).toBe('a2');
  });
});

// ============================================================
// updateText / toggleCollapsed / updateNodeImage / removeNodeImage
// ============================================================

describe('updateText / toggleCollapsed / images', () => {
  it('updates text without mutating original', () => {
    const root = buildTree();
    const tree = updateText(root, 'a', 'New A');
    expect(findNode(tree, 'a')!.text).toBe('New A');
    expect(findNode(root, 'a')!.text).toBe('A');
  });

  it('toggles collapsed', () => {
    expect(findNode(toggleCollapsed(buildTree(), 'a'), 'a')!.collapsed).toBe(true);
  });

  it('toggle on leaf is no-op', () => {
    expect(findNode(toggleCollapsed(buildTree(), 'a1'), 'a1')!.collapsed).toBe(false);
  });

  it('updateNodeImage sets imageUrl', () => {
    const tree = updateNodeImage(buildTree(), 'a', 'test.png');
    expect(findNode(tree, 'a')!.imageUrl).toBe('test.png');
  });

  it('removeNodeImage clears imageUrl', () => {
    const root = buildTree();
    findNode(root, 'a')!.imageUrl = 'test.png';
    const tree = removeNodeImage(root, 'a');
    expect(findNode(tree, 'a')!.imageUrl).toBeUndefined();
  });
});

// ============================================================
// Side meta helpers
// ============================================================

describe('side meta helpers', () => {
  it('extractSideMeta returns correct mapping', () => {
    expect(extractSideMeta(buildTree())).toEqual({ A: 'right', B: 'right', C: 'left', D: 'left' });
  });

  it('applySideMeta sets sides', () => {
    const root = buildTree();
    root.children.forEach(c => delete c.side);
    applySideMeta(root, { A: 'left', C: 'right' });
    expect(root.children[0].side).toBe('left');
    expect(root.children[2].side).toBe('right');
  });

  it('assignMissingSides fills all missing', () => {
    const root = buildTree();
    root.children.forEach(c => delete c.side);
    assignMissingSides(root);
    root.children.forEach(c => expect(c.side).toBeDefined());
  });

  it('assignMissingSides balances evenly', () => {
    const root = buildTree();
    root.children.forEach(c => delete c.side);
    assignMissingSides(root);
    const r = root.children.filter(c => c.side === 'right').length;
    const l = root.children.filter(c => c.side === 'left').length;
    expect(Math.abs(r - l)).toBeLessThanOrEqual(1);
  });
});

// ============================================================
// collectVisibleNodes / collectEdges
// ============================================================

describe('collectVisibleNodes / collectEdges', () => {
  it('collects all 8 nodes (root + a,a1,a2 + b + c,c1 + d)', () => {
    expect(collectVisibleNodes(buildTree()).length).toBe(8);
  });

  it('excludes collapsed children', () => {
    const root = buildTree();
    findNode(root, 'a')!.collapsed = true;
    // root + a(collapsed, hides a1,a2) + b + c + c1 + d = 6
    expect(collectVisibleNodes(root).length).toBe(6);
  });

  it('collects 7 edges', () => {
    // root->a, root->b, root->c, root->d, a->a1, a->a2, c->c1
    expect(collectEdges(buildTree()).length).toBe(7);
  });
});

// ============================================================
// Immutability — every mutation returns new tree
// ============================================================

describe('immutability', () => {
  it('moveAmongSiblings', () => {
    const root = buildTree();
    const tree = moveAmongSiblings(root, 'a', 'down');
    expect(root.children[0].id).toBe('a');
    expect(tree.children[0].id).not.toBe('a');
  });

  it('promote', () => {
    const root = buildTree();
    promote(root, 'a1');
    expect(findNode(root, 'a')!.children.length).toBe(2);
  });

  it('demote', () => {
    const root = buildTree();
    demote(root, 'b');
    expect(root.children.length).toBe(4);
  });

  it('moveToSide', () => {
    const root = buildTree();
    moveToSide(root, 'a', 'left');
    expect(findNode(root, 'a')!.side).toBe('right');
  });

  it('moveAllToSide', () => {
    const root = buildTree();
    moveAllToSide(root, 'left');
    expect(findNode(root, 'a')!.side).toBe('right');
  });

  it('updateText', () => {
    const root = buildTree();
    updateText(root, 'a', 'Changed');
    expect(findNode(root, 'a')!.text).toBe('A');
  });

  it('toggleCollapsed', () => {
    const root = buildTree();
    toggleCollapsed(root, 'a');
    expect(findNode(root, 'a')!.collapsed).toBe(false);
  });
});

// ============================================================
// Batch operations — multi-select move
// ============================================================

describe('moveBatchAmongSiblings — Ctrl+Up/Down with multi-select', () => {
  it('move {A,B} up: no-op (A is already top of right side)', () => {
    const tree = moveBatchAmongSiblings(buildTree(), new Set(['a', 'b']), 'up');
    const right = tree.children.filter(c => c.side === 'right');
    expect(right.map(c => c.id)).toEqual(['a', 'b']);
  });

  it('move {C,D} down: no-op (D is already bottom of left side)', () => {
    const tree = moveBatchAmongSiblings(buildTree(), new Set(['c', 'd']), 'down');
    const left = tree.children.filter(c => c.side === 'left');
    expect(left.map(c => c.id)).toEqual(['c', 'd']);
  });

  it('move {A1,A2} down: no-op (A2 already at bottom)', () => {
    const tree = moveBatchAmongSiblings(buildTree(), new Set(['a1', 'a2']), 'down');
    expect(findNode(tree, 'a')!.children.map(c => c.id)).toEqual(['a1', 'a2']);
  });

  it('move single node B up via batch: same as moveAmongSiblings', () => {
    const tree = moveBatchAmongSiblings(buildTree(), new Set(['b']), 'up');
    const right = tree.children.filter(c => c.side === 'right');
    expect(right[0].id).toBe('b');
    expect(right[1].id).toBe('a');
  });

  // Build a larger tree for more interesting batch tests
  function buildWideTree(): MindMapNode {
    return {
      id: 'root', text: 'Root', collapsed: false, children: [
        { id: 'x1', text: 'X1', collapsed: false, side: 'right' as const, children: [] },
        { id: 'x2', text: 'X2', collapsed: false, side: 'right' as const, children: [] },
        { id: 'x3', text: 'X3', collapsed: false, side: 'right' as const, children: [] },
        { id: 'x4', text: 'X4', collapsed: false, side: 'right' as const, children: [] },
      ]
    };
  }

  it('move {x2,x3} down: x4 moves above them', () => {
    const tree = moveBatchAmongSiblings(buildWideTree(), new Set(['x2', 'x3']), 'down');
    expect(tree.children.map(c => c.id)).toEqual(['x1', 'x4', 'x2', 'x3']);
  });

  it('move {x2,x3} up: x1 moves below them', () => {
    const tree = moveBatchAmongSiblings(buildWideTree(), new Set(['x2', 'x3']), 'up');
    expect(tree.children.map(c => c.id)).toEqual(['x2', 'x3', 'x1', 'x4']);
  });

  it('move {x3,x4} up: block moves above x2', () => {
    const tree = moveBatchAmongSiblings(buildWideTree(), new Set(['x3', 'x4']), 'up');
    expect(tree.children.map(c => c.id)).toEqual(['x1', 'x3', 'x4', 'x2']);
  });

  it('move {x1,x2} down: block moves below x3', () => {
    const tree = moveBatchAmongSiblings(buildWideTree(), new Set(['x1', 'x2']), 'down');
    expect(tree.children.map(c => c.id)).toEqual(['x3', 'x1', 'x2', 'x4']);
  });
});

describe('moveBatchRight — Ctrl+Right with multi-select (demote together)', () => {
  // Root children: demote into previous same-side sibling
  it('root children {B}: demotes into A (prev right-side sibling)', () => {
    const tree = moveBatchRight(buildTree(), new Set(['b']));
    expect(tree.children.some(c => c.id === 'b')).toBe(false);
    expect(findNode(tree, 'a')!.children.some(c => c.id === 'b')).toBe(true);
  });

  it('root children {C,D} left-side, no prev: switches both to right', () => {
    const tree = moveBatchRight(buildTree(), new Set(['c', 'd']));
    expect(findNode(tree, 'c')!.side).toBe('right');
    expect(findNode(tree, 'd')!.side).toBe('right');
    expect(tree.children.length).toBe(4); // still root children
  });

  it('root children {D}: demotes into C', () => {
    const tree = moveBatchRight(buildTree(), new Set(['d']));
    expect(tree.children.some(c => c.id === 'd')).toBe(false);
    expect(findNode(tree, 'c')!.children.some(c => c.id === 'd')).toBe(true);
  });

  it('root children {A}: no-op (first on right, no prev sibling)', () => {
    const tree = moveBatchRight(buildTree(), new Set(['a']));
    expect(tree.children.some(c => c.id === 'a')).toBe(true);
    expect(tree.children.length).toBe(4);
  });

  it('demoted root children lose .side property', () => {
    const tree = moveBatchRight(buildTree(), new Set(['b']));
    expect(findNode(tree, 'b')!.side).toBeUndefined();
  });

  it('demote multiple root children into same target', () => {
    // Build: root -> [X1(right), X2(right), X3(right)]
    const root: MindMapNode = {
      id: 'root', text: 'Root', collapsed: false, children: [
        { id: 'x1', text: 'X1', collapsed: false, side: 'right', children: [] },
        { id: 'x2', text: 'X2', collapsed: false, side: 'right', children: [] },
        { id: 'x3', text: 'X3', collapsed: false, side: 'right', children: [] },
      ]
    };
    const tree = moveBatchRight(root, new Set(['x2', 'x3']));
    expect(tree.children.length).toBe(1);
    expect(tree.children[0].id).toBe('x1');
    expect(findNode(tree, 'x1')!.children.map(c => c.id)).toEqual(['x2', 'x3']);
  });

  it('demoted nodes stay together in order', () => {
    const root: MindMapNode = {
      id: 'root', text: 'Root', collapsed: false, children: [
        { id: 'x1', text: 'X1', collapsed: false, side: 'right', children: [] },
        { id: 'x2', text: 'X2', collapsed: false, side: 'right', children: [] },
        { id: 'x3', text: 'X3', collapsed: false, side: 'right', children: [] },
        { id: 'x4', text: 'X4', collapsed: false, side: 'right', children: [] },
      ]
    };
    const tree = moveBatchRight(root, new Set(['x3', 'x4']));
    expect(findNode(tree, 'x2')!.children.map(c => c.id)).toEqual(['x3', 'x4']);
  });

  // Nested children
  it('nested: demote {A1,A2} into prev sibling A0', () => {
    const root: MindMapNode = {
      id: 'root', text: 'Root', collapsed: false, children: [{
        id: 'a', text: 'A', collapsed: false, side: 'right', children: [
          { id: 'a0', text: 'A0', collapsed: false, children: [] },
          { id: 'a1', text: 'A1', collapsed: false, children: [] },
          { id: 'a2', text: 'A2', collapsed: false, children: [] },
        ]
      }]
    };
    const tree = moveBatchRight(root, new Set(['a1', 'a2']));
    const a = findNode(tree, 'a')!;
    expect(a.children.length).toBe(1);
    expect(a.children[0].id).toBe('a0');
    expect(findNode(tree, 'a0')!.children.map(c => c.id)).toEqual(['a1', 'a2']);
  });

  it('nested: demote first children (no prev): no-op', () => {
    const tree = moveBatchRight(buildTree(), new Set(['a1']));
    expect(findNode(tree, 'a')!.children.length).toBe(2);
  });

  it('nested: target un-collapsed after demote', () => {
    const root: MindMapNode = {
      id: 'root', text: 'Root', collapsed: false, children: [{
        id: 'a', text: 'A', collapsed: false, side: 'right', children: [
          { id: 'a0', text: 'A0', collapsed: true, children: [] },
          { id: 'a1', text: 'A1', collapsed: false, children: [] },
        ]
      }]
    };
    const tree = moveBatchRight(root, new Set(['a1']));
    expect(findNode(tree, 'a0')!.collapsed).toBe(false);
  });
});

describe('moveBatchLeft — Ctrl+Left with multi-select (side-switch or promote)', () => {
  it('switch multiple root children to left', () => {
    const tree = moveBatchLeft(buildTree(), new Set(['a', 'b']));
    expect(findNode(tree, 'a')!.side).toBe('left');
    expect(findNode(tree, 'b')!.side).toBe('left');
  });

  it('does not affect nodes already on left', () => {
    const tree = moveBatchLeft(buildTree(), new Set(['c', 'd']));
    expect(findNode(tree, 'c')!.side).toBe('left');
    expect(findNode(tree, 'd')!.side).toBe('left');
  });
});

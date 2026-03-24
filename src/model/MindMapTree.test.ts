import { describe, it, expect } from 'vitest';
import type { MindMapNode } from '../types';
import {
  createNode, createDefaultTree, findNode, findParent, findSiblingIndex,
  addChild, addSibling, removeNode, moveAmongSiblings,
  promote, demote, moveToSide, moveAllToSide, moveLeft, moveRight,
  updateText, toggleCollapsed,
  getVisiblePrevSibling, getVisibleNextSibling, getFirstChild, getDeepestLastChild,
  extractSideMeta, applySideMeta, assignMissingSides,
  collectVisibleNodes, collectEdges,
} from './MindMapTree';

function buildTree(): MindMapNode {
  const root: MindMapNode = { id: 'root', text: 'Root', children: [], collapsed: false };
  const a: MindMapNode = { id: 'a', text: 'A', children: [], collapsed: false, side: 'right' };
  const b: MindMapNode = { id: 'b', text: 'B', children: [], collapsed: false, side: 'right' };
  const c: MindMapNode = { id: 'c', text: 'C', children: [], collapsed: false, side: 'left' };
  const a1: MindMapNode = { id: 'a1', text: 'A1', children: [], collapsed: false };
  const a2: MindMapNode = { id: 'a2', text: 'A2', children: [], collapsed: false };
  a.children = [a1, a2];
  root.children = [a, b, c];
  return root;
}

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

  it('finds root by id', () => {
    expect(findNode(root, 'root')?.text).toBe('Root');
  });

  it('finds nested node', () => {
    expect(findNode(root, 'a1')?.text).toBe('A1');
  });

  it('returns null for missing id', () => {
    expect(findNode(root, 'nope')).toBeNull();
  });

  it('finds parent of child', () => {
    expect(findParent(root, 'a')?.id).toBe('root');
  });

  it('finds parent of grandchild', () => {
    expect(findParent(root, 'a1')?.id).toBe('a');
  });

  it('returns null for root parent', () => {
    expect(findParent(root, 'root')).toBeNull();
  });

  it('findSiblingIndex returns correct index', () => {
    expect(findSiblingIndex(root, 'b')).toBe(1);
  });
});

describe('addChild', () => {
  it('adds child and returns new tree', () => {
    const root = buildTree();
    const { tree, newId } = addChild(root, 'a');
    expect(newId).toBeTruthy();
    expect(findNode(tree, 'a')!.children.length).toBe(3);
    // Original is not mutated
    expect(findNode(root, 'a')!.children.length).toBe(2);
  });

  it('assigns side when adding to root', () => {
    const root = buildTree();
    const { tree, newId } = addChild(root, 'root');
    const newNode = findNode(tree, newId)!;
    expect(newNode.side).toBeDefined();
  });

  it('does not assign side for non-root parent', () => {
    const root = buildTree();
    const { tree, newId } = addChild(root, 'a');
    expect(findNode(tree, newId)!.side).toBeUndefined();
  });

  it('un-collapses parent', () => {
    const root = buildTree();
    const a = findNode(root, 'a')!;
    a.collapsed = true;
    const { tree } = addChild(root, 'a');
    expect(findNode(tree, 'a')!.collapsed).toBe(false);
  });
});

describe('addSibling', () => {
  it('on root falls back to addChild', () => {
    const root = buildTree();
    const { tree } = addSibling(root, 'root');
    expect(tree.children.length).toBe(4);
  });

  it('inserts after target', () => {
    const root = buildTree();
    const { tree, newId } = addSibling(root, 'a1');
    const a = findNode(tree, 'a')!;
    expect(a.children[1].id).toBe(newId);
  });

  it('inherits side from root-child sibling', () => {
    const root = buildTree();
    const { tree, newId } = addSibling(root, 'a');
    expect(findNode(tree, newId)!.side).toBe('right');
  });
});

describe('removeNode', () => {
  it('cannot delete root', () => {
    const root = buildTree();
    const { tree, nextSelectId } = removeNode(root, 'root');
    expect(tree.children.length).toBe(3);
    expect(nextSelectId).toBe('root');
  });

  it('deletes node and selects next sibling', () => {
    const root = buildTree();
    const { tree, nextSelectId } = removeNode(root, 'a');
    expect(tree.children.length).toBe(2);
    expect(nextSelectId).toBe('b');
  });

  it('selects parent when no siblings left', () => {
    const root: MindMapNode = { id: 'r', text: 'R', children: [
      { id: 'x', text: 'X', children: [{ id: 'y', text: 'Y', children: [], collapsed: false }], collapsed: false }
    ], collapsed: false };
    const { nextSelectId } = removeNode(root, 'y');
    expect(nextSelectId).toBe('x');
  });
});

describe('moveAmongSiblings', () => {
  it('moves down among same-side root children', () => {
    const root = buildTree();
    const tree = moveAmongSiblings(root, 'a', 'down');
    // a and b are both right-side, so they should swap
    const rightChildren = tree.children.filter(c => c.side === 'right');
    expect(rightChildren[0].id).toBe('b');
    expect(rightChildren[1].id).toBe('a');
  });

  it('is no-op at boundary', () => {
    const root = buildTree();
    const tree = moveAmongSiblings(root, 'c', 'down');
    expect(tree.children.map(c => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('moves non-root children normally', () => {
    const root = buildTree();
    const tree = moveAmongSiblings(root, 'a1', 'down');
    expect(findNode(tree, 'a')!.children[0].id).toBe('a2');
    expect(findNode(tree, 'a')!.children[1].id).toBe('a1');
  });
});

describe('promote / demote', () => {
  it('promote moves node up one level', () => {
    const root = buildTree();
    const tree = promote(root, 'a1');
    expect(findNode(tree, 'a')!.children.length).toBe(1);
    expect(tree.children.some(c => c.id === 'a1')).toBe(true);
  });

  it('promote on root child is no-op', () => {
    const root = buildTree();
    const tree = promote(root, 'a');
    expect(tree.children.length).toBe(3);
  });

  it('demote makes node child of previous sibling', () => {
    const root = buildTree();
    const tree = demote(root, 'a2');
    const a1 = findNode(tree, 'a1')!;
    expect(a1.children.length).toBe(1);
    expect(a1.children[0].id).toBe('a2');
  });

  it('demote on first child is no-op', () => {
    const root = buildTree();
    const tree = demote(root, 'a1');
    expect(findNode(tree, 'a')!.children.length).toBe(2);
  });
});

describe('moveToSide / moveAllToSide / moveLeft / moveRight', () => {
  it('moveToSide sets side property', () => {
    const root = buildTree();
    const tree = moveToSide(root, 'a', 'left');
    expect(findNode(tree, 'a')!.side).toBe('left');
  });

  it('moveAllToSide sets all children to one side', () => {
    const root = buildTree();
    const tree = moveAllToSide(root, 'right');
    tree.children.forEach(c => expect(c.side).toBe('right'));
  });

  it('moveLeft on root moves all to left', () => {
    const root = buildTree();
    const tree = moveLeft(root, 'root');
    tree.children.forEach(c => expect(c.side).toBe('left'));
  });

  it('moveRight on root child sets side to right', () => {
    const root = buildTree();
    const tree = moveRight(root, 'c');
    expect(findNode(tree, 'c')!.side).toBe('right');
  });

  it('moveLeft on deep node promotes', () => {
    const root = buildTree();
    const tree = moveLeft(root, 'a1');
    expect(tree.children.some(c => c.id === 'a1')).toBe(true);
  });
});

describe('updateText / toggleCollapsed', () => {
  it('updates text without mutating original', () => {
    const root = buildTree();
    const tree = updateText(root, 'a', 'New A');
    expect(findNode(tree, 'a')!.text).toBe('New A');
    expect(findNode(root, 'a')!.text).toBe('A');
  });

  it('toggles collapsed', () => {
    const root = buildTree();
    const tree = toggleCollapsed(root, 'a');
    expect(findNode(tree, 'a')!.collapsed).toBe(true);
  });

  it('toggle on leaf is no-op', () => {
    const root = buildTree();
    const tree = toggleCollapsed(root, 'a1');
    expect(findNode(tree, 'a1')!.collapsed).toBe(false);
  });
});

describe('navigation helpers', () => {
  it('getVisibleNextSibling stays on same side', () => {
    const root = buildTree();
    const next = getVisibleNextSibling(root, 'a');
    expect(next?.id).toBe('b'); // both right
  });

  it('getVisibleNextSibling returns null at end of side', () => {
    const root = buildTree();
    expect(getVisibleNextSibling(root, 'b')).toBeNull();
  });

  it('getVisiblePrevSibling works', () => {
    const root = buildTree();
    expect(getVisiblePrevSibling(root, 'b')?.id).toBe('a');
  });

  it('getFirstChild returns first child', () => {
    const root = buildTree();
    expect(getFirstChild(findNode(root, 'a')!)?.id).toBe('a1');
  });

  it('getFirstChild returns null when collapsed', () => {
    const root = buildTree();
    findNode(root, 'a')!.collapsed = true;
    expect(getFirstChild(findNode(root, 'a')!)).toBeNull();
  });

  it('getDeepestLastChild recurses', () => {
    const root = buildTree();
    expect(getDeepestLastChild(root).id).toBe('c');
  });
});

describe('side meta helpers', () => {
  it('extractSideMeta returns side mapping', () => {
    const root = buildTree();
    const meta = extractSideMeta(root);
    expect(meta).toEqual({ A: 'right', B: 'right', C: 'left' });
  });

  it('applySideMeta sets sides', () => {
    const root = buildTree();
    root.children.forEach(c => delete c.side);
    applySideMeta(root, { A: 'left', C: 'right' });
    expect(root.children[0].side).toBe('left');
    expect(root.children[2].side).toBe('right');
  });

  it('assignMissingSides fills in missing sides', () => {
    const root = buildTree();
    root.children.forEach(c => delete c.side);
    assignMissingSides(root);
    root.children.forEach(c => expect(c.side).toBeDefined());
  });
});

describe('collectVisibleNodes / collectEdges', () => {
  it('collects all visible nodes', () => {
    const root = buildTree();
    expect(collectVisibleNodes(root).length).toBe(6);
  });

  it('excludes collapsed children', () => {
    const root = buildTree();
    findNode(root, 'a')!.collapsed = true;
    expect(collectVisibleNodes(root).length).toBe(4); // root, a, b, c
  });

  it('collects edges', () => {
    const root = buildTree();
    const edges = collectEdges(root);
    expect(edges.length).toBe(5); // root->a, root->b, root->c, a->a1, a->a2
  });
});

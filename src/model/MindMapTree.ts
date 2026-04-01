import type { MindMapNode } from '../types';
import { generateId } from '../utils/idGenerator';
import { splitSides } from '../layout/treeLayout';

export function createNode(text: string): MindMapNode {
  return { id: generateId(), text, children: [], collapsed: false };
}

export function createDefaultTree(): MindMapNode {
  return createNode('Central Topic');
}

export function findNode(root: MindMapNode, id: string): MindMapNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function findParent(root: MindMapNode, id: string): MindMapNode | null {
  for (const child of root.children) {
    if (child.id === id) return root;
    const found = findParent(child, id);
    if (found) return found;
  }
  return null;
}

export function findSiblingIndex(parent: MindMapNode, id: string): number {
  return parent.children.findIndex(c => c.id === id);
}

function cloneTree(root: MindMapNode): MindMapNode {
  return structuredClone(root);
}

export function addChild(root: MindMapNode, parentId: string, text = 'New Node'): { tree: MindMapNode; newId: string } {
  const tree = cloneTree(root);
  const parent = findNode(tree, parentId);
  if (!parent) return { tree, newId: '' };
  const newNode = createNode(text);
  // If adding to root, assign a side (same side as last child, or balance)
  if (parent.id === tree.id) {
    const { right, left } = splitSides(tree);
    newNode.side = right.length <= left.length ? 'right' : 'left';
  }
  parent.children.push(newNode);
  parent.collapsed = false;
  return { tree, newId: newNode.id };
}

export function addSibling(root: MindMapNode, nodeId: string, text = 'New Node'): { tree: MindMapNode; newId: string } {
  if (root.id === nodeId) {
    // Can't add sibling to root, add child instead
    return addChild(root, nodeId, text);
  }
  const tree = cloneTree(root);
  const parent = findParent(tree, nodeId);
  if (!parent) return { tree, newId: '' };
  const idx = findSiblingIndex(parent, nodeId);
  const newNode = createNode(text);
  // If sibling of a root child, inherit the same side
  if (parent.id === tree.id) {
    const sibling = parent.children[idx];
    if (sibling?.side) newNode.side = sibling.side;
  }
  parent.children.splice(idx + 1, 0, newNode);
  return { tree, newId: newNode.id };
}

export function removeNode(root: MindMapNode, nodeId: string): { tree: MindMapNode; nextSelectId: string } {
  if (root.id === nodeId) {
    // Can't delete root
    return { tree: root, nextSelectId: root.id };
  }
  const tree = cloneTree(root);
  const parent = findParent(tree, nodeId);
  if (!parent) return { tree, nextSelectId: root.id };
  const idx = findSiblingIndex(parent, nodeId);
  parent.children.splice(idx, 1);

  // Determine next selection
  let nextSelectId: string;
  if (parent.children.length > 0) {
    const nextIdx = Math.min(idx, parent.children.length - 1);
    nextSelectId = parent.children[nextIdx].id;
  } else {
    nextSelectId = parent.id;
  }
  return { tree, nextSelectId };
}

export function moveAmongSiblings(root: MindMapNode, nodeId: string, direction: 'up' | 'down'): MindMapNode {
  if (root.id === nodeId) return root;
  const tree = cloneTree(root);
  const parent = findParent(tree, nodeId);
  if (!parent) return tree;

  // For direct children of root, only swap within the same side
  if (parent.id === tree.id) {
    const sameSide = getSameSideSiblings(tree, nodeId);
    const sideIdx = sameSide.findIndex(c => c.id === nodeId);
    const targetSideIdx = direction === 'up' ? sideIdx - 1 : sideIdx + 1;
    if (targetSideIdx < 0 || targetSideIdx >= sameSide.length) return tree;
    // Find the actual nodes in tree.children and swap them
    const nodeA = sameSide[sideIdx];
    const nodeB = sameSide[targetSideIdx];
    const idxA = tree.children.indexOf(nodeA);
    const idxB = tree.children.indexOf(nodeB);
    [tree.children[idxA], tree.children[idxB]] = [tree.children[idxB], tree.children[idxA]];
    return tree;
  }

  const idx = findSiblingIndex(parent, nodeId);
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= parent.children.length) return tree;
  [parent.children[idx], parent.children[targetIdx]] = [parent.children[targetIdx], parent.children[idx]];
  return tree;
}

export function promote(root: MindMapNode, nodeId: string): MindMapNode {
  // Move node to be a sibling of its parent (one level up)
  if (root.id === nodeId) return root;
  const tree = cloneTree(root);
  const parent = findParent(tree, nodeId);
  if (!parent || parent.id === tree.id) return tree; // Can't promote direct children of root further
  const grandparent = findParent(tree, parent.id);
  if (!grandparent) return tree;

  const idx = findSiblingIndex(parent, nodeId);
  const [node] = parent.children.splice(idx, 1);
  const parentIdx = findSiblingIndex(grandparent, parent.id);
  grandparent.children.splice(parentIdx + 1, 0, node);
  return tree;
}

export function demote(root: MindMapNode, nodeId: string): MindMapNode {
  // Move node to be last child of its previous sibling
  if (root.id === nodeId) return root;
  const tree = cloneTree(root);
  const parent = findParent(tree, nodeId);
  if (!parent) return tree;

  // For root children, find previous same-side sibling
  if (parent.id === tree.id) {
    const sameSide = getSameSideSiblings(tree, nodeId);
    const sideIdx = sameSide.findIndex(c => c.id === nodeId);
    if (sideIdx <= 0) return tree;
    const prevSibling = sameSide[sideIdx - 1];
    const idx = tree.children.findIndex(c => c.id === nodeId);
    const [node] = tree.children.splice(idx, 1);
    delete node.side; // no longer a root child
    prevSibling.children.push(node);
    prevSibling.collapsed = false;
    return tree;
  }

  const idx = findSiblingIndex(parent, nodeId);
  if (idx <= 0) return tree;
  const [node] = parent.children.splice(idx, 1);
  const prevSibling = parent.children[idx - 1];
  prevSibling.children.push(node);
  prevSibling.collapsed = false;
  return tree;
}

export function moveToSide(root: MindMapNode, nodeId: string, targetSide: 'left' | 'right'): MindMapNode {
  if (root.id === nodeId) return root;
  const tree = cloneTree(root);
  const parent = findParent(tree, nodeId);
  // Only works for direct children of root
  if (!parent || parent.id !== tree.id) return tree;

  const node = findNode(tree, nodeId);
  if (!node) return tree;
  node.side = targetSide;
  return tree;
}

export function moveAllToSide(root: MindMapNode, targetSide: 'left' | 'right'): MindMapNode {
  const tree = cloneTree(root);
  for (const child of tree.children) {
    child.side = targetSide;
  }
  return tree;
}

export function updateText(root: MindMapNode, nodeId: string, text: string): MindMapNode {
  const tree = cloneTree(root);
  const node = findNode(tree, nodeId);
  if (node) node.text = text;
  return tree;
}

export function updateNodeImage(root: MindMapNode, nodeId: string, imageUrl: string): MindMapNode {
  const tree = cloneTree(root);
  const node = findNode(tree, nodeId);
  if (node) node.imageUrl = imageUrl;
  return tree;
}

export function removeNodeImage(root: MindMapNode, nodeId: string): MindMapNode {
  const tree = cloneTree(root);
  const node = findNode(tree, nodeId);
  if (node) delete node.imageUrl;
  return tree;
}

export function toggleCollapsed(root: MindMapNode, nodeId: string): MindMapNode {
  const tree = cloneTree(root);
  const node = findNode(tree, nodeId);
  if (node && node.children.length > 0) {
    node.collapsed = !node.collapsed;
  }
  return tree;
}

// Navigation helpers

function getSameSideSiblings(root: MindMapNode, nodeId: string): MindMapNode[] {
  const { right, left } = splitSides(root);
  if (right.some(c => c.id === nodeId)) return right;
  if (left.some(c => c.id === nodeId)) return left;
  return root.children;
}

export function getVisiblePrevSibling(root: MindMapNode, nodeId: string): MindMapNode | null {
  const parent = findParent(root, nodeId);
  if (!parent) return null;

  if (parent.id === root.id) {
    const sameSide = getSameSideSiblings(root, nodeId);
    const sideIdx = sameSide.findIndex(c => c.id === nodeId);
    if (sideIdx <= 0) return null;
    return sameSide[sideIdx - 1];
  }

  const idx = findSiblingIndex(parent, nodeId);
  if (idx <= 0) return null;
  return parent.children[idx - 1];
}

export function getVisibleNextSibling(root: MindMapNode, nodeId: string): MindMapNode | null {
  const parent = findParent(root, nodeId);
  if (!parent) return null;

  if (parent.id === root.id) {
    const sameSide = getSameSideSiblings(root, nodeId);
    const sideIdx = sameSide.findIndex(c => c.id === nodeId);
    if (sideIdx >= sameSide.length - 1) return null;
    return sameSide[sideIdx + 1];
  }

  const idx = findSiblingIndex(parent, nodeId);
  if (idx >= parent.children.length - 1) return null;
  return parent.children[idx + 1];
}

export function getFirstChild(node: MindMapNode): MindMapNode | null {
  if (node.collapsed || node.children.length === 0) return null;
  return node.children[0];
}

export function getDeepestLastChild(node: MindMapNode): MindMapNode {
  if (node.collapsed || node.children.length === 0) return node;
  return getDeepestLastChild(node.children[node.children.length - 1]);
}

// --- Higher-level move operations ---

export function moveLeft(root: MindMapNode, nodeId: string): MindMapNode {
  if (root.id === nodeId) return moveAllToSide(root, 'left');
  const parent = findParent(root, nodeId);
  if (parent && parent.id === root.id) {
    // Root children: switch side to left
    return moveToSide(root, nodeId, 'left');
  }
  return promote(root, nodeId);
}

export function moveRight(root: MindMapNode, nodeId: string): MindMapNode {
  if (root.id === nodeId) return moveAllToSide(root, 'right');
  const parent = findParent(root, nodeId);
  if (parent && parent.id === root.id) {
    // Root child: try demote first, fall back to side-switch if no prev sibling
    const sameSide = getSameSideSiblings(root, nodeId);
    const sideIdx = sameSide.findIndex(c => c.id === nodeId);
    if (sideIdx <= 0) {
      // No prev same-side sibling — switch side to right
      return moveToSide(root, nodeId, 'right');
    }
  }
  return demote(root, nodeId);
}

// --- Batch operations (multi-select) ---

/**
 * Move a group of sibling nodes up/down together.
 * All nodeIds must share the same parent. Non-siblings are ignored.
 */
export function moveBatchAmongSiblings(root: MindMapNode, nodeIds: Set<string>, direction: 'up' | 'down'): MindMapNode {
  if (nodeIds.size === 0) return root;
  const tree = cloneTree(root);
  const firstId = [...nodeIds][0];
  const parent = findParent(tree, firstId);
  if (!parent) return tree;

  // Get the sibling list (side-aware for root children)
  const siblings = parent.id === tree.id
    ? getSameSideSiblings(tree, firstId)
    : parent.children;

  // Find indices of selected nodes within the sibling list
  const selectedIndices = siblings
    .map((c, i) => nodeIds.has(c.id) ? i : -1)
    .filter(i => i >= 0)
    .sort((a, b) => a - b);

  if (selectedIndices.length === 0) return tree;

  if (direction === 'up') {
    const topIdx = selectedIndices[0];
    if (topIdx <= 0) return tree; // already at top
    // For root children, we need to swap in tree.children using actual indices
    if (parent.id === tree.id) {
      const aboveNode = siblings[topIdx - 1];
      const aboveActual = tree.children.indexOf(aboveNode);
      // Move the "above" node to after the last selected
      const lastSelected = siblings[selectedIndices[selectedIndices.length - 1]];
      tree.children.splice(aboveActual, 1);
      const newLastActual = tree.children.indexOf(lastSelected);
      tree.children.splice(newLastActual + 1, 0, aboveNode);
    } else {
      // Simple: move the node above the block to after the block
      const above = parent.children[topIdx - 1];
      parent.children.splice(topIdx - 1, 1);
      const lastIdx = selectedIndices[selectedIndices.length - 1] - 1; // shifted by removal
      parent.children.splice(lastIdx + 1, 0, above);
    }
  } else {
    const bottomIdx = selectedIndices[selectedIndices.length - 1];
    if (bottomIdx >= siblings.length - 1) return tree; // already at bottom
    if (parent.id === tree.id) {
      const belowNode = siblings[bottomIdx + 1];
      const belowActual = tree.children.indexOf(belowNode);
      const firstSelected = siblings[selectedIndices[0]];
      const firstActual = tree.children.indexOf(firstSelected);
      tree.children.splice(belowActual, 1);
      tree.children.splice(firstActual, 0, belowNode);
    } else {
      const below = parent.children[bottomIdx + 1];
      parent.children.splice(bottomIdx + 1, 1);
      parent.children.splice(selectedIndices[0], 0, below);
    }
  }

  return tree;
}

/**
 * Move a group of sibling nodes left.
 * Root children: switch side to left.
 * Nested: promote all (preserving order).
 */
export function moveBatchLeft(root: MindMapNode, nodeIds: Set<string>): MindMapNode {
  if (nodeIds.size === 0) return root;
  const tree = cloneTree(root);
  const firstId = [...nodeIds][0];
  const parent = findParent(tree, firstId);
  if (!parent) return tree;

  if (parent.id === tree.id) {
    // Root children: switch side to left
    for (const id of nodeIds) {
      const node = findNode(tree, id);
      if (node) node.side = 'left';
    }
    return tree;
  }

  // Nested: promote all (process in reverse order to maintain positions)
  let result = tree;
  const ids = [...nodeIds].reverse();
  for (const id of ids) result = promote(result, id);
  return result;
}

/**
 * Move a group of sibling nodes right (demote into prev sibling).
 * All selected nodes go into the same target to stay together.
 * Works for both root children and nested children.
 */
export function moveBatchRight(root: MindMapNode, nodeIds: Set<string>): MindMapNode {
  if (nodeIds.size === 0) return root;
  const tree = cloneTree(root);
  const firstId = [...nodeIds][0];
  const parent = findParent(tree, firstId);
  if (!parent) return tree;

  // For root children, use same-side siblings to find the target
  if (parent.id === tree.id) {
    const sameSide = getSameSideSiblings(tree, firstId);
    const selectedInOrder = sameSide.filter(c => nodeIds.has(c.id));
    if (selectedInOrder.length === 0) return tree;
    const firstSideIdx = sameSide.indexOf(selectedInOrder[0]);

    // Find first non-selected node above on the same side
    let targetIdx = firstSideIdx - 1;
    while (targetIdx >= 0 && nodeIds.has(sameSide[targetIdx].id)) targetIdx--;
    if (targetIdx < 0) {
      // No target to demote into — switch sides to right instead
      for (const id of nodeIds) {
        const node = findNode(tree, id);
        if (node) node.side = 'right';
      }
      return tree;
    }
    const target = sameSide[targetIdx];

    // Remove selected from tree.children and add to target
    for (const sel of selectedInOrder) {
      const idx = tree.children.indexOf(sel);
      if (idx >= 0) {
        tree.children.splice(idx, 1);
        delete sel.side;
      }
    }
    target.children.push(...selectedInOrder);
    target.collapsed = false;
    return tree;
  }

  // Nested: find prev non-selected sibling
  const children = parent.children;
  const selectedInOrder = children.filter(c => nodeIds.has(c.id));
  if (selectedInOrder.length === 0) return tree;
  const firstIdx = children.indexOf(selectedInOrder[0]);
  let targetIdx = firstIdx - 1;
  while (targetIdx >= 0 && nodeIds.has(children[targetIdx].id)) targetIdx--;
  if (targetIdx < 0) return tree;
  const target = children[targetIdx];

  for (const sel of [...selectedInOrder].reverse()) {
    const idx = children.indexOf(sel);
    if (idx >= 0) children.splice(idx, 1);
  }
  target.children.push(...selectedInOrder);
  target.collapsed = false;

  return tree;
}

// --- Side metadata helpers ---

export function extractSideMeta(root: MindMapNode): Record<string, 'left' | 'right'> {
  const sides: Record<string, 'left' | 'right'> = {};
  for (const child of root.children) {
    if (child.side) sides[child.text] = child.side;
  }
  return sides;
}

export function applySideMeta(root: MindMapNode, sides: Record<string, 'left' | 'right'>): void {
  for (const child of root.children) {
    if (sides[child.text]) child.side = sides[child.text];
  }
}

export function assignMissingSides(root: MindMapNode): void {
  let rightCount = root.children.filter(c => c.side === 'right').length;
  let leftCount = root.children.filter(c => c.side === 'left').length;
  for (const child of root.children) {
    if (!child.side) {
      if (rightCount <= leftCount) { child.side = 'right'; rightCount++; }
      else { child.side = 'left'; leftCount++; }
    }
  }
}

// --- Tree traversal helpers ---

export function collectVisibleNodes(node: MindMapNode): MindMapNode[] {
  const nodes: MindMapNode[] = [node];
  if (!node.collapsed) {
    for (const child of node.children) nodes.push(...collectVisibleNodes(child));
  }
  return nodes;
}

export function collectEdges(node: MindMapNode): { parentId: string; childId: string }[] {
  const edges: { parentId: string; childId: string }[] = [];
  if (!node.collapsed) {
    for (const child of node.children) {
      edges.push({ parentId: node.id, childId: child.id });
      edges.push(...collectEdges(child));
    }
  }
  return edges;
}

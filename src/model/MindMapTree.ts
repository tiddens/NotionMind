import type { MindMapNode } from '../types';
import { generateId } from '../utils/idGenerator';

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
  const idx = findSiblingIndex(parent, nodeId);
  if (idx <= 0) return tree; // No previous sibling
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

export function toggleCollapsed(root: MindMapNode, nodeId: string): MindMapNode {
  const tree = cloneTree(root);
  const node = findNode(tree, nodeId);
  if (node && node.children.length > 0) {
    node.collapsed = !node.collapsed;
  }
  return tree;
}

// Navigation helpers

export function getVisiblePrevSibling(root: MindMapNode, nodeId: string): MindMapNode | null {
  const parent = findParent(root, nodeId);
  if (!parent) return null;
  const idx = findSiblingIndex(parent, nodeId);
  if (idx <= 0) return null;
  return parent.children[idx - 1];
}

export function getVisibleNextSibling(root: MindMapNode, nodeId: string): MindMapNode | null {
  const parent = findParent(root, nodeId);
  if (!parent) return null;
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

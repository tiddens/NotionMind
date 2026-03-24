import type { MindMapNode, LayoutNode } from '../types';
import { LAYOUT } from '../utils/constants';

function measureNode(node: MindMapNode): { width: number; height: number } {
  const textWidth = node.text.length * LAYOUT.NODE_CHAR_WIDTH + LAYOUT.NODE_PADDING_X * 2;
  const width = Math.max(LAYOUT.NODE_MIN_WIDTH, textWidth);
  return { width, height: LAYOUT.NODE_HEIGHT };
}

function computeSubtreeHeight(node: MindMapNode): number {
  if (node.collapsed || node.children.length === 0) {
    return LAYOUT.NODE_HEIGHT;
  }
  let total = 0;
  for (const child of node.children) {
    total += computeSubtreeHeight(child);
  }
  total += (node.children.length - 1) * LAYOUT.VERTICAL_GAP;
  return Math.max(LAYOUT.NODE_HEIGHT, total);
}

function layoutSubtree(
  node: MindMapNode,
  x: number,
  yCenter: number,
  side: 'left' | 'right',
  result: Map<string, LayoutNode>
): void {
  const { width, height } = measureNode(node);
  result.set(node.id, { id: node.id, x, y: yCenter, width, height, side });

  if (node.collapsed || node.children.length === 0) return;

  const totalHeight = computeSubtreeHeight(node);
  let currentY = yCenter - totalHeight / 2;

  const childX = side === 'right'
    ? x + width + LAYOUT.HORIZONTAL_GAP
    : x - LAYOUT.HORIZONTAL_GAP;

  for (const child of node.children) {
    const childSubtreeHeight = computeSubtreeHeight(child);
    const childYCenter = currentY + childSubtreeHeight / 2;

    const { width: childWidth } = measureNode(child);
    const adjustedX = side === 'left' ? childX - childWidth : childX;

    layoutSubtree(child, adjustedX, childYCenter, side, result);
    currentY += childSubtreeHeight + LAYOUT.VERTICAL_GAP;
  }
}

/**
 * Split root's children into left and right lists.
 * Uses explicit `side` property when set, auto-distributes the rest.
 */
export function splitSides(root: MindMapNode): { right: MindMapNode[]; left: MindMapNode[] } {
  const right: MindMapNode[] = [];
  const left: MindMapNode[] = [];
  const unsided: MindMapNode[] = [];

  for (const child of root.children) {
    if (child.side === 'left') left.push(child);
    else if (child.side === 'right') right.push(child);
    else unsided.push(child);
  }

  for (const child of unsided) {
    if (right.length <= left.length) right.push(child);
    else left.push(child);
  }

  return { right, left };
}

export function computeLayout(root: MindMapNode): Map<string, LayoutNode> {
  const result = new Map<string, LayoutNode>();
  const { width: rootWidth, height: rootHeight } = measureNode(root);

  result.set(root.id, {
    id: root.id,
    x: -rootWidth / 2,
    y: 0,
    width: rootWidth,
    height: rootHeight,
    side: 'right',
  });

  if (root.collapsed || root.children.length === 0) return result;

  const { right: rightChildren, left: leftChildren } = splitSides(root);

  // Layout right side
  const rightTotalHeight = rightChildren.reduce(
    (sum, child) => sum + computeSubtreeHeight(child) + LAYOUT.VERTICAL_GAP, -LAYOUT.VERTICAL_GAP
  );
  let currentY = -rightTotalHeight / 2;
  for (const child of rightChildren) {
    const subtreeH = computeSubtreeHeight(child);
    const childYCenter = currentY + subtreeH / 2;
    const childX = rootWidth / 2 + LAYOUT.HORIZONTAL_GAP;
    layoutSubtree(child, childX, childYCenter, 'right', result);
    currentY += subtreeH + LAYOUT.VERTICAL_GAP;
  }

  // Layout left side
  const leftTotalHeight = leftChildren.reduce(
    (sum, child) => sum + computeSubtreeHeight(child) + LAYOUT.VERTICAL_GAP, -LAYOUT.VERTICAL_GAP
  );
  currentY = -leftTotalHeight / 2;
  for (const child of leftChildren) {
    const subtreeH = computeSubtreeHeight(child);
    const childYCenter = currentY + subtreeH / 2;
    const { width: childWidth } = measureNode(child);
    const childX = -rootWidth / 2 - LAYOUT.HORIZONTAL_GAP - childWidth;
    layoutSubtree(child, childX, childYCenter, 'left', result);
    currentY += subtreeH + LAYOUT.VERTICAL_GAP;
  }

  return result;
}

/**
 * Determine which visual side a node is on.
 */
export function getSide(root: MindMapNode, nodeId: string): 'left' | 'right' {
  if (root.id === nodeId) return 'right';
  const { right, left } = splitSides(root);
  for (const child of right) {
    if (isDescendantOrSelf(child, nodeId)) return 'right';
  }
  for (const child of left) {
    if (isDescendantOrSelf(child, nodeId)) return 'left';
  }
  return 'right';
}

function isDescendantOrSelf(node: MindMapNode, id: string): boolean {
  if (node.id === id) return true;
  return node.children.some(child => isDescendantOrSelf(child, id));
}

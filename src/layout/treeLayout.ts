import type { ImageDimensions, MindMapNode, LayoutNode } from '../types';
import { LAYOUT } from '../utils/constants';
import { measureNodeText } from './textLayout';

type NodeMeasurements = Pick<LayoutNode, 'width' | 'height' | 'textLines' | 'textHeight' | 'imageWidth' | 'imageHeight'>;
type TextBoxes = ReadonlyMap<string, { width: number; textHeight?: number }>;

function measureNode(node: MindMapNode, imageSizes: ReadonlyMap<string, ImageDimensions>, depth: number, textBoxes?: TextBoxes): NodeMeasurements {
  const box = textBoxes?.get(node.id);
  const measured = measureNodeText(node.text, depth, box?.width);
  const { width: textWidth, textLines } = measured;
  const textHeight = Math.max(LAYOUT.NODE_HEIGHT, box?.textHeight ?? measured.textHeight);
  let width = textWidth;
  let height = textHeight;

  if (node.imageUrl) {
    let imageWidth: number = LAYOUT.IMAGE_MAX_WIDTH;
    let imageHeight: number = LAYOUT.IMAGE_MAX_HEIGHT;
    const dimensions = imageSizes.get(node.imageUrl);
    if (dimensions && Number.isFinite(dimensions.width) && Number.isFinite(dimensions.height)
      && dimensions.width > 0 && dimensions.height > 0) {
      const scale = Math.min(LAYOUT.IMAGE_MAX_WIDTH / dimensions.width, LAYOUT.IMAGE_MAX_HEIGHT / dimensions.height);
      imageWidth = dimensions.width * scale;
      imageHeight = dimensions.height * scale;
    }
    width = Math.max(width, imageWidth + LAYOUT.NODE_PADDING_X * 2);
    height += imageHeight + LAYOUT.IMAGE_PADDING;
    return { width, height, textLines, textHeight, imageWidth, imageHeight };
  }

  return { width, height, textLines, textHeight };
}

function computeSubtreeHeight(node: MindMapNode, imageSizes: ReadonlyMap<string, ImageDimensions>, depth: number, textBoxes?: TextBoxes): number {
  const nodeHeight = measureNode(node, imageSizes, depth, textBoxes).height;
  if (node.collapsed || node.children.length === 0) {
    return nodeHeight;
  }
  let total = 0;
  for (const child of node.children) {
    total += computeSubtreeHeight(child, imageSizes, depth + 1, textBoxes);
  }
  total += (node.children.length - 1) * LAYOUT.VERTICAL_GAP;
  return Math.max(nodeHeight, total);
}

function layoutSubtree(
  node: MindMapNode,
  x: number,
  yCenter: number,
  side: 'left' | 'right',
  depth: number,
  branchIndex: number,
  result: Map<string, LayoutNode>,
  imageSizes: ReadonlyMap<string, ImageDimensions>,
  textBoxes?: TextBoxes,
): void {
  const measurements = measureNode(node, imageSizes, depth, textBoxes);
  const { width } = measurements;
  result.set(node.id, { id: node.id, x, y: yCenter, ...measurements, side, depth, branchIndex, hasImage: !!node.imageUrl });

  if (node.collapsed || node.children.length === 0) return;

  const totalHeight = computeSubtreeHeight(node, imageSizes, depth, textBoxes);
  let currentY = yCenter - totalHeight / 2;

  const childX = side === 'right'
    ? x + width + LAYOUT.HORIZONTAL_GAP
    : x - LAYOUT.HORIZONTAL_GAP;

  for (const child of node.children) {
    const childSubtreeHeight = computeSubtreeHeight(child, imageSizes, depth + 1, textBoxes);
    const childYCenter = currentY + childSubtreeHeight / 2;

    const { width: childWidth } = measureNode(child, imageSizes, depth + 1, textBoxes);
    const adjustedX = side === 'left' ? childX - childWidth : childX;

    layoutSubtree(child, adjustedX, childYCenter, side, depth + 1, branchIndex, result, imageSizes, textBoxes);
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

export function computeLayout(root: MindMapNode, imageSizes: ReadonlyMap<string, ImageDimensions> = new Map(), textBoxes?: TextBoxes): Map<string, LayoutNode> {
  const result = new Map<string, LayoutNode>();
  const rootMeasurements = measureNode(root, imageSizes, 0, textBoxes);
  const { width: rootWidth } = rootMeasurements;

  result.set(root.id, {
    id: root.id,
    x: -rootWidth / 2,
    y: 0,
    ...rootMeasurements,
    side: 'right',
    depth: 0,
    branchIndex: -1,
    hasImage: !!root.imageUrl,
  });

  if (root.collapsed || root.children.length === 0) return result;

  const { right: rightChildren, left: leftChildren } = splitSides(root);

  // Build a map from child id to its branch index (order among all root children)
  let branchIdx = 0;
  const branchMap = new Map<string, number>();
  for (const child of root.children) {
    branchMap.set(child.id, branchIdx++);
  }

  // Layout right side
  const rightTotalHeight = rightChildren.reduce(
    (sum, child) => sum + computeSubtreeHeight(child, imageSizes, 1, textBoxes) + LAYOUT.VERTICAL_GAP, -LAYOUT.VERTICAL_GAP
  );
  let currentY = -rightTotalHeight / 2;
  for (const child of rightChildren) {
    const subtreeH = computeSubtreeHeight(child, imageSizes, 1, textBoxes);
    const childYCenter = currentY + subtreeH / 2;
    const childX = rootWidth / 2 + LAYOUT.HORIZONTAL_GAP;
    layoutSubtree(child, childX, childYCenter, 'right', 1, branchMap.get(child.id) ?? 0, result, imageSizes, textBoxes);
    currentY += subtreeH + LAYOUT.VERTICAL_GAP;
  }

  // Layout left side
  const leftTotalHeight = leftChildren.reduce(
    (sum, child) => sum + computeSubtreeHeight(child, imageSizes, 1, textBoxes) + LAYOUT.VERTICAL_GAP, -LAYOUT.VERTICAL_GAP
  );
  currentY = -leftTotalHeight / 2;
  for (const child of leftChildren) {
    const subtreeH = computeSubtreeHeight(child, imageSizes, 1, textBoxes);
    const childYCenter = currentY + subtreeH / 2;
    const { width: childWidth } = measureNode(child, imageSizes, 1, textBoxes);
    const childX = -rootWidth / 2 - LAYOUT.HORIZONTAL_GAP - childWidth;
    layoutSubtree(child, childX, childYCenter, 'left', 1, branchMap.get(child.id) ?? 0, result, imageSizes, textBoxes);
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

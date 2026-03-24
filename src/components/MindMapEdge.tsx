import type { LayoutNode } from '../types';
import { useTheme } from '../hooks/useTheme';
import { BRANCH_COLORS } from '../utils/constants';

interface Props {
  parentLayout: LayoutNode;
  childLayout: LayoutNode;
}

export function MindMapEdge({ parentLayout, childLayout }: Props) {
  const { colors, mode } = useTheme();
  const isRight = childLayout.side === 'right';

  const startX = isRight
    ? parentLayout.x + parentLayout.width
    : parentLayout.x;
  const startY = parentLayout.y;

  const endX = isRight
    ? childLayout.x
    : childLayout.x + childLayout.width;
  const endY = childLayout.y;

  // Smoother S-curve with offset control points
  const dx = Math.abs(endX - startX);
  const cp = dx * 0.5;
  const cpx1 = isRight ? startX + cp : startX - cp;
  const cpx2 = isRight ? endX - cp : endX + cp;

  const d = `M ${startX} ${startY} C ${cpx1} ${startY}, ${cpx2} ${endY}, ${endX} ${endY}`;

  const branchColor = BRANCH_COLORS[childLayout.branchIndex % BRANCH_COLORS.length];
  const opacity = mode === 'light' ? 0.3 : 0.4;
  const strokeColor = childLayout.branchIndex >= 0 ? branchColor : colors.edgeColor;

  return (
    <path
      d={d}
      fill="none"
      stroke={strokeColor}
      strokeWidth={2}
      strokeLinecap="round"
      opacity={opacity}
    />
  );
}

import type { LayoutNode } from '../types';
import { useTheme } from '../hooks/useTheme';

interface Props {
  parentLayout: LayoutNode;
  childLayout: LayoutNode;
}

export function MindMapEdge({ parentLayout, childLayout }: Props) {
  const { colors } = useTheme();
  const isRight = childLayout.side === 'right';

  const startX = isRight
    ? parentLayout.x + parentLayout.width
    : parentLayout.x;
  const startY = parentLayout.y;

  const endX = isRight
    ? childLayout.x
    : childLayout.x + childLayout.width;
  const endY = childLayout.y;

  const midX = (startX + endX) / 2;

  const d = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

  return (
    <path
      d={d}
      fill="none"
      stroke={colors.edgeColor}
      strokeWidth={2}
      strokeLinecap="round"
    />
  );
}

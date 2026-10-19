import type { LayoutNode } from '../types';
import { useTheme } from '../hooks/useTheme';
import { BRANCH_COLORS, LAYOUT } from '../utils/constants';

const TEXT_LEFT_PAD = 12;

interface Props {
  layout: LayoutNode;
  text: string;
  imageUrl?: string;
  isRoot: boolean;
  isSelected: boolean;
  isEditing: boolean;
  isCollapsed: boolean;
  hasChildren: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onRemoveImage?: () => void;
  onViewImage?: () => void;
}

export function MindMapNode({
  layout,
  text,
  imageUrl,
  isRoot,
  isSelected,
  isEditing,
  isCollapsed,
  hasChildren,
  onClick,
  onDoubleClick,
  onRemoveImage,
  onViewImage,
}: Props) {
  const { colors, mode } = useTheme();

  const branchColor = BRANCH_COLORS[layout.branchIndex % BRANCH_COLORS.length];
  const isLight = mode === 'light';
  const rx = 8;
  const hasImage = !!imageUrl;
  const imageWidth = layout.imageWidth ?? LAYOUT.IMAGE_MAX_WIDTH;
  const imageHeight = layout.imageHeight ?? LAYOUT.IMAGE_MAX_HEIGHT;
  const imagePreview = hasImage && (
    <g>
      <g
        className="image-thumbnail"
        role="button"
        tabIndex={0}
        aria-label={`View image: ${text}`}
        style={{ cursor: 'zoom-in' }}
        onMouseDown={event => event.stopPropagation()}
        onClick={event => {
          event.stopPropagation();
          event.currentTarget.focus();
          onViewImage?.();
        }}
        onDoubleClick={event => event.stopPropagation()}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            onViewImage?.();
          }
        }}
      >
        <title>Open full-screen image</title>
        <image
          href={`/api/images/${encodeURIComponent(imageUrl!)}`}
          x={(layout.width - imageWidth) / 2}
          y={layout.textHeight + LAYOUT.IMAGE_PADDING / 2}
          width={imageWidth}
          height={imageHeight}
          preserveAspectRatio="xMidYMid meet"
        />
      </g>
      {isSelected && onRemoveImage && (
        <g
          transform={`translate(${(layout.width + imageWidth) / 2 - 2}, ${layout.textHeight + LAYOUT.IMAGE_PADDING / 2 + 2})`}
          onClick={event => { event.stopPropagation(); onRemoveImage(); }}
          onDoubleClick={event => event.stopPropagation()}
          style={{ cursor: 'pointer' }}
        >
          <title>Remove image</title>
          <circle r={8} fill="#ce4334" />
          <text textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={11} fontWeight={700}>×</text>
        </g>
      )}
    </g>
  );

  // Root node
  if (isRoot) {
    const rootRx = hasImage || layout.textLines.length > 1 ? rx : layout.height / 2;
    return (
      <g
        transform={`translate(${layout.x}, ${layout.y - layout.height / 2})`}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(); }}
        style={{ cursor: 'pointer' }}
      >
        <rect
          width={layout.width}
          height={layout.height}
          rx={rootRx}
          ry={rootRx}
          fill={colors.rootBg}
          stroke={isSelected ? '#ce4334' : 'transparent'}
          strokeWidth={isSelected ? 2.5 : 0}
        />
        {!isEditing && (
          <NodeText layout={layout} text={text} color="#ffffff" centered />
        )}
        {imagePreview}
      </g>
    );
  }

  // Branch nodes
  const borderColor = isSelected ? colors.nodeSelected : colors.nodeBorder;
  const borderWidth = isSelected ? 2 : 1;

  return (
    <g
      transform={`translate(${layout.x}, ${layout.y - layout.height / 2})`}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(); }}
      style={{ cursor: 'pointer' }}
    >
      {/* Soft shadow */}
      <rect
        x={0} y={1}
        width={layout.width} height={layout.height}
        rx={rx} ry={rx}
        fill={isLight ? 'rgba(0,0,0,0.03)' : 'rgba(0,0,0,0.15)'}
      />
      {/* Background */}
      <rect
        width={layout.width} height={layout.height}
        rx={rx} ry={rx}
        fill={colors.nodeBg}
        stroke={borderColor}
        strokeWidth={borderWidth}
      />
      {/* Text */}
      {!isEditing && (
        <NodeText layout={layout} text={text} color={colors.nodeText} />
      )}
      {/* Image */}
      {imagePreview}
      {/* Collapse indicator */}
      {isCollapsed && hasChildren && (
        <g transform={`translate(${layout.side === 'right' ? layout.width + 6 : -12}, ${layout.height / 2})`}>
          <circle r={6} fill={branchColor} opacity={0.15} />
          <text textAnchor="middle" dominantBaseline="central" fill={branchColor} fontSize={9} fontWeight={700}>+</text>
        </g>
      )}
    </g>
  );
}

function NodeText({ layout, text, color, centered = false }: { layout: LayoutNode; text: string; color: string; centered?: boolean }) {
  const x = centered ? layout.width / 2 : TEXT_LEFT_PAD;
  const firstY = (layout.textHeight - (layout.textLines.length - 1) * LAYOUT.NODE_LINE_HEIGHT) / 2;
  return (
    <text
      x={x}
      y={firstY}
      aria-label={text}
      textAnchor={centered ? 'middle' : 'start'}
      dominantBaseline="central"
      fill={color}
      fontSize={centered ? 14 : 13}
      fontWeight={centered ? 600 : layout.depth === 1 ? 500 : 400}
      fontFamily="system-ui, -apple-system, sans-serif"
      pointerEvents="none"
    >
      {layout.textLines.map((line, index) => (
        <tspan key={index} x={x} y={firstY + index * LAYOUT.NODE_LINE_HEIGHT}>{line}{index < layout.textLines.length - 1 ? ' ' : ''}</tspan>
      ))}
    </text>
  );
}

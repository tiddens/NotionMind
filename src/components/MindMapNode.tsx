import { useEffect, useRef } from 'react';
import type { LayoutNode } from '../types';
import { useTheme } from '../hooks/useTheme';

interface Props {
  layout: LayoutNode;
  text: string;
  isRoot: boolean;
  isSelected: boolean;
  isEditing: boolean;
  isCollapsed: boolean;
  hasChildren: boolean;
  editText: string;
  onEditChange: (text: string) => void;
  onEditConfirm: () => void;
  onEditCancel: () => void;
  onClick: () => void;
  onDoubleClick: () => void;
}

export function MindMapNode({
  layout,
  text,
  isRoot,
  isSelected,
  isEditing,
  isCollapsed,
  hasChildren,
  editText,
  onEditChange,
  onEditConfirm,
  onEditCancel,
  onClick,
  onDoubleClick,
}: Props) {
  const { colors } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const rx = 6;
  const bgColor = isRoot ? colors.rootBg : colors.nodeBg;
  const borderColor = isSelected ? colors.nodeSelected : colors.nodeBorder;
  const borderWidth = isSelected ? 2.5 : 1.5;

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
        rx={rx}
        ry={rx}
        fill={bgColor}
        stroke={borderColor}
        strokeWidth={borderWidth}
      />
      {isEditing ? (
        <foreignObject
          x={4}
          y={2}
          width={layout.width - 8}
          height={layout.height - 4}
        >
          <input
            ref={inputRef}
            value={editText}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onEditConfirm();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onEditCancel();
              }
              e.stopPropagation();
            }}
            onBlur={onEditConfirm}
            style={{
              width: '100%',
              height: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: isRoot ? '#ffffff' : colors.nodeText,
              fontSize: '13px',
              fontFamily: 'inherit',
              padding: '0 4px',
              boxSizing: 'border-box',
            }}
          />
        </foreignObject>
      ) : (
        <text
          x={layout.width / 2}
          y={layout.height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill={isRoot ? '#ffffff' : colors.nodeText}
          fontSize={13}
          fontFamily="system-ui, -apple-system, sans-serif"
          pointerEvents="none"
        >
          {text}
        </text>
      )}
      {isCollapsed && hasChildren && (
        <circle
          cx={layout.side === 'right' ? layout.width + 8 : -8}
          cy={layout.height / 2}
          r={5}
          fill={colors.nodeBorder}
          stroke={colors.nodeText}
          strokeWidth={1}
        />
      )}
    </g>
  );
}

import { useEffect, useRef } from 'react';
import type { LayoutNode } from '../types';
import { useTheme } from '../hooks/useTheme';
import { BRANCH_COLORS } from '../utils/constants';

const TEXT_LEFT_PAD = 12;

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
  const { colors, mode } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const branchColor = BRANCH_COLORS[layout.branchIndex % BRANCH_COLORS.length];
  const isLight = mode === 'light';
  const rx = 8;

  // Root node — pill shape with brand color + red accent line
  if (isRoot) {
    const rootRx = layout.height / 2;
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
        {isEditing ? renderInput(layout, editText, '#ffffff', true, inputRef, onEditChange, onEditConfirm, onEditCancel) : (
          <text
            x={layout.width / 2}
            y={layout.height / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#ffffff"
            fontSize={14}
            fontWeight={600}
            fontFamily="system-ui, -apple-system, sans-serif"
            pointerEvents="none"
          >
            {text}
          </text>
        )}
      </g>
    );
  }

  // Branch nodes — left-aligned text, compact
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
        x={0}
        y={1}
        width={layout.width}
        height={layout.height}
        rx={rx}
        ry={rx}
        fill={isLight ? 'rgba(0,0,0,0.03)' : 'rgba(0,0,0,0.15)'}
      />
      {/* Background */}
      <rect
        width={layout.width}
        height={layout.height}
        rx={rx}
        ry={rx}
        fill={colors.nodeBg}
        stroke={borderColor}
        strokeWidth={borderWidth}
      />
      {/* Text or input */}
      {isEditing ? renderInput(layout, editText, colors.nodeText, false, inputRef, onEditChange, onEditConfirm, onEditCancel) : (
        <text
          x={TEXT_LEFT_PAD}
          y={layout.height / 2}
          textAnchor="start"
          dominantBaseline="central"
          fill={colors.nodeText}
          fontSize={13}
          fontWeight={layout.depth === 1 ? 500 : 400}
          fontFamily="system-ui, -apple-system, sans-serif"
          pointerEvents="none"
        >
          {text}
        </text>
      )}
      {/* Collapse indicator */}
      {isCollapsed && hasChildren && (
        <g transform={`translate(${layout.side === 'right' ? layout.width + 6 : -12}, ${layout.height / 2})`}>
          <circle r={6} fill={branchColor} opacity={0.15} />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fill={branchColor}
            fontSize={9}
            fontWeight={700}
          >
            +
          </text>
        </g>
      )}
    </g>
  );
}

function renderInput(
  layout: LayoutNode,
  editText: string,
  textColor: string,
  centered: boolean,
  inputRef: React.RefObject<HTMLInputElement | null>,
  onEditChange: (text: string) => void,
  onEditConfirm: () => void,
  onEditCancel: () => void,
) {
  const pad = centered ? 12 : TEXT_LEFT_PAD - 2;
  return (
    <foreignObject
      x={pad}
      y={2}
      width={layout.width - pad - 8}
      height={layout.height - 4}
    >
      <input
        ref={inputRef}
        value={editText}
        onChange={(e) => onEditChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); onEditConfirm(); }
          else if (e.key === 'Escape') { e.preventDefault(); onEditCancel(); }
          e.stopPropagation();
        }}
        onBlur={onEditConfirm}
        style={{
          width: '100%',
          height: '100%',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: textColor,
          fontSize: '13px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: centered ? 'center' : 'left',
          padding: 0,
          boxSizing: 'border-box',
        }}
      />
    </foreignObject>
  );
}

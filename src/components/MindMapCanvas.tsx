import { useRef, useMemo, useCallback, useState } from 'react';
import type { MindMapNode as MindMapNodeType, LayoutNode } from '../types';
import { computeLayout } from '../layout/treeLayout';
import { serializeToMarkdown } from '../markdown/serializer';
import { collectVisibleNodes, collectEdges } from '../model/MindMapTree';
import { MindMapNode } from './MindMapNode';
import { MindMapEdge } from './MindMapEdge';
import { useTheme } from '../hooks/useTheme';

interface Props {
  root: MindMapNodeType;
  selectedId: string | null;
  editingId: string | null;
  editText: string;
  onSelect: (id: string) => void;
  onStartEdit: (id: string) => void;
  onEditChange: (text: string) => void;
  onEditConfirm: () => void;
  onEditCancel: () => void;
  onTogglePreview: () => void;
  previewVisible: boolean;
}

export function MindMapCanvas({
  root,
  selectedId,
  editingId,
  editText,
  onSelect,
  onStartEdit,
  onEditChange,
  onEditConfirm,
  onEditCancel,
  onTogglePreview,
  previewVisible,
}: Props) {
  const { colors } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const layoutMap = useMemo(() => computeLayout(root), [root]);
  const edges = useMemo(() => collectEdges(root) as { parentId: string; childId: string }[], [root]);
  const visibleNodes = useMemo(() => collectVisibleNodes(root), [root]);

  // Compute SVG viewBox from layout bounds
  const bounds = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    layoutMap.forEach((l) => {
      minX = Math.min(minX, l.x - 20);
      minY = Math.min(minY, l.y - l.height / 2 - 20);
      maxX = Math.max(maxX, l.x + l.width + 20);
      maxY = Math.max(maxY, l.y + l.height / 2 + 20);
    });
    if (minX === Infinity) {
      return { x: -500, y: -300, w: 1000, h: 600 };
    }
    // Enforce minimum viewBox so a single node doesn't fill the screen
    const rawW = maxX - minX;
    const rawH = maxY - minY;
    const w = Math.max(rawW, 800);
    const h = Math.max(rawH, 400);
    const cx = minX + rawW / 2;
    const cy = minY + rawH / 2;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }, [layoutMap]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(z => Math.max(0.2, Math.min(3, z * delta)));
    } else {
      setPan(p => ({
        x: p.x - e.deltaX,
        y: p.y - e.deltaY,
      }));
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: panStart.current.panX + (e.clientX - panStart.current.x),
      y: panStart.current.panY + (e.clientY - panStart.current.y),
    });
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: 'hidden',
        background: colors.bgPrimary,
        cursor: isPanning ? 'grabbing' : 'default',
        position: 'relative',
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
        }}
      >
        {/* Edges */}
        {edges.map(({ parentId, childId }) => {
          const parentLayout = layoutMap.get(parentId);
          const childLayout = layoutMap.get(childId);
          if (!parentLayout || !childLayout) return null;
          return (
            <MindMapEdge
              key={`${parentId}-${childId}`}
              parentLayout={parentLayout}
              childLayout={childLayout}
            />
          );
        })}
        {/* Nodes */}
        {visibleNodes.map((node) => {
          const layout = layoutMap.get(node.id);
          if (!layout) return null;
          return (
            <MindMapNode
              key={node.id}
              layout={layout}
              text={node.text}
              isRoot={node.id === root.id}
              isSelected={node.id === selectedId}
              isEditing={node.id === editingId}
              isCollapsed={node.collapsed}
              hasChildren={node.children.length > 0}
              editText={node.id === editingId ? editText : node.text}
              onEditChange={onEditChange}
              onEditConfirm={onEditConfirm}
              onEditCancel={onEditCancel}
              onClick={() => onSelect(node.id)}
              onDoubleClick={() => onStartEdit(node.id)}
            />
          );
        })}
      </svg>
      {/* Top-right buttons */}
      <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6 }}>
        <CopyButton root={root} colors={colors} />
        <button
          onClick={onTogglePreview}
          title={previewVisible ? 'Hide markdown preview' : 'Show markdown preview'}
          style={{
            background: colors.nodeBg,
            border: `1px solid ${colors.nodeBorder}`,
            color: colors.textPrimary,
            padding: '6px 10px',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 12,
            opacity: previewVisible ? 1 : 0.7,
          }}
        >
          MD
        </button>
      </div>
    </div>
  );
}

function CopyButton({ root, colors }: { root: MindMapNodeType; colors: Record<string, string> }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const md = serializeToMarkdown(root);
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [root]);

  return (
    <button
      onClick={handleCopy}
      title="Copy markdown to clipboard"
      style={{
        background: copied ? colors.nodeSelected : colors.nodeBg,
        border: `1px solid ${colors.nodeBorder}`,
        color: copied ? '#fff' : colors.textPrimary,
        padding: '6px 10px',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 12,
        transition: 'background 0.2s, color 0.2s',
      }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

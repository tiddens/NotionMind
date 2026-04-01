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
  selectedIds: Set<string>;
  editingId: string | null;
  editText: string;
  onSelect: (id: string) => void;
  onStartEdit: (id: string) => void;
  onEditChange: (text: string) => void;
  onEditConfirm: () => void;
  onEditCancel: () => void;
  onTogglePreview: () => void;
  previewVisible: boolean;
  onRemoveImage: (nodeId: string) => void;
}

export function MindMapCanvas({
  root,
  selectedId,
  selectedIds,
  editingId,
  editText,
  onSelect,
  onStartEdit,
  onEditChange,
  onEditConfirm,
  onEditCancel,
  onTogglePreview,
  previewVisible,
  onRemoveImage,
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
              imageUrl={node.imageUrl}
              isRoot={node.id === root.id}
              isSelected={node.id === selectedId || selectedIds.has(node.id)}
              isEditing={node.id === editingId}
              isCollapsed={node.collapsed}
              hasChildren={node.children.length > 0}
              editText={node.id === editingId ? editText : node.text}
              onEditChange={onEditChange}
              onEditConfirm={onEditConfirm}
              onEditCancel={onEditCancel}
              onClick={() => onSelect(node.id)}
              onDoubleClick={() => onStartEdit(node.id)}
              onRemoveImage={node.imageUrl ? () => onRemoveImage(node.id) : undefined}
            />
          );
        })}
      </svg>
      {/* Top-right buttons */}
      <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6 }}>
        <CopyButtons root={root} colors={colors} />
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

async function fetchImageAsDataUrl(filename: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/images/${filename}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function mdToHtml(md: string): Promise<string> {
  const lines = md.split('\n');
  const html: string[] = [];
  let inList = false;
  let listDepth = 0;

  for (const line of lines) {
    const imgMatch = line.match(/^\s*!\[.*?\]\((.+?)\)\s*$/);
    if (imgMatch) {
      const dataUrl = await fetchImageAsDataUrl(imgMatch[1]);
      if (dataUrl) {
        html.push(`<img src="${dataUrl}" alt="image" style="max-width:600px" />`);
      }
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (inList) { html.push('</ul>'.repeat(listDepth + 1)); inList = false; listDepth = 0; }
      const level = headingMatch[1].length;
      html.push(`<h${level}>${headingMatch[2]}</h${level}>`);
      continue;
    }

    const bulletMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (bulletMatch) {
      const depth = Math.floor(bulletMatch[1].length / 2);
      if (!inList) { html.push('<ul>'); inList = true; listDepth = 0; }
      while (listDepth < depth) { html.push('<ul>'); listDepth++; }
      while (listDepth > depth) { html.push('</ul>'); listDepth--; }
      html.push(`<li>${bulletMatch[2]}</li>`);
      continue;
    }

    if (line.trim() === '' && inList) {
      html.push('</ul>'.repeat(listDepth + 1)); inList = false; listDepth = 0;
    }
  }
  if (inList) html.push('</ul>'.repeat(listDepth + 1));
  return html.join('\n');
}

function copyRichHtml(html: string): void {
  // Create a hidden container, set innerHTML, select it, and copy via execCommand
  // This is the most reliable way to get rich HTML onto the clipboard
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.opacity = '0';
  document.body.appendChild(container);

  const range = document.createRange();
  range.selectNodeContents(container);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);

  document.execCommand('copy');

  selection?.removeAllRanges();
  document.body.removeChild(container);
}

function treeToPlainText(node: MindMapNodeType, depth = 0): string {
  const indent = '\t'.repeat(depth);
  const lines = [indent + node.text];
  for (const child of node.children) {
    lines.push(treeToPlainText(child, depth + 1));
  }
  return lines.join('\n');
}

function CopyButtons({ root, colors }: { root: MindMapNodeType; colors: Record<string, string> }) {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const handleCopyRich = useCallback(async () => {
    const md = serializeToMarkdown(root);
    const html = await mdToHtml(md);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([md], { type: 'text/plain' }),
        }),
      ]);
    } catch {
      copyRichHtml(html);
    }
    setCopiedType('rich');
    setTimeout(() => setCopiedType(null), 1500);
  }, [root]);

  const handleCopyPlain = useCallback(() => {
    const text = treeToPlainText(root);
    navigator.clipboard.writeText(text);
    setCopiedType('plain');
    setTimeout(() => setCopiedType(null), 1500);
  }, [root]);

  const btnStyle = (active: boolean) => ({
    background: active ? colors.nodeSelected : colors.nodeBg,
    border: `1px solid ${colors.nodeBorder}`,
    color: active ? '#fff' : colors.textPrimary,
    padding: '6px 10px',
    borderRadius: 6,
    cursor: 'pointer' as const,
    fontSize: 12,
    transition: 'background 0.2s, color 0.2s',
  });

  return (
    <>
      <button onClick={handleCopyPlain} title="Copy as plain text (tab-indented)" style={btnStyle(copiedType === 'plain')}>
        {copiedType === 'plain' ? 'Copied!' : 'Text'}
      </button>
      <button onClick={handleCopyRich} title="Copy as rich HTML (for Google Docs, Word)" style={btnStyle(copiedType === 'rich')}>
        {copiedType === 'rich' ? 'Copied!' : 'Copy'}
      </button>
    </>
  );
}

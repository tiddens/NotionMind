import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import type { MindMapNode as MindMapNodeType } from '../types';
import { computeLayout } from '../layout/treeLayout';
import { serializeToMarkdown } from '../markdown/serializer';
import { collectVisibleNodes, collectEdges, updateText } from '../model/MindMapTree';
import { MindMapNode } from './MindMapNode';
import { MindMapEdge } from './MindMapEdge';
import { NodeEditor } from './NodeEditor';
import { useTheme } from '../hooks/useTheme';
import { useImageSizes } from '../hooks/useImageSizes';
import { LAYOUT } from '../utils/constants';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;

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
  onViewImage: (filename: string, title: string) => void;
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
  onViewImage,
}: Props) {
  const { colors } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [{ pan, zoom }, setView] = useState({ pan: { x: 0, y: 0 }, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [editorSize, setEditorSize] = useState<{ id: string; width: number; textHeight: number } | null>(null);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const edges = useMemo(() => collectEdges(root) as { parentId: string; childId: string }[], [root]);
  const visibleNodes = useMemo(() => collectVisibleNodes(root), [root]);
  const imageFilenames = useMemo(() => [...new Set(visibleNodes.flatMap(node => node.imageUrl ? [node.imageUrl] : []))], [visibleNodes]);
  const imageSizes = useImageSizes(imageFilenames);
  const savedLayout = useMemo(() => computeLayout(root, imageSizes), [root, imageSizes]);
  const layoutMap = useMemo(() => {
    const saved = editingId ? savedLayout.get(editingId) : undefined;
    if (!editingId || !saved) return savedLayout;
    const width = editorSize?.id === editingId ? editorSize.width : Math.min(LAYOUT.NODE_MAX_WIDTH, Math.max(240, saved.width));
    const textHeight = editorSize?.id === editingId ? editorSize.textHeight : undefined;
    const layout = computeLayout(updateText(root, editingId, editText), imageSizes, new Map([[editingId, { width, textHeight }]]));
    const edited = layout.get(editingId)!;
    // Keep the edited card's top-left corner still as its height changes.
    const dx = saved.x - edited.x;
    const dy = saved.y - saved.height / 2 - (edited.y - edited.height / 2);
    for (const item of layout.values()) { item.x += dx; item.y += dy; }
    return layout;
  }, [root, imageSizes, editingId, editText, savedLayout, editorSize]);
  const onEditorSizeChange = useCallback((size: { width: number; textHeight: number }) => {
    if (!editingId) return;
    setEditorSize(previous => previous?.id === editingId && Math.abs(previous.width - size.width) < 0.01 && previous.textHeight === size.textHeight ? previous : { id: editingId, ...size });
  }, [editingId]);

  // Compute SVG viewBox from layout bounds
  const bounds = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    savedLayout.forEach((l) => {
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
  }, [savedLayout]);
  const viewBox = `${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`;
  const editingLayout = editingId ? layoutMap.get(editingId) : undefined;

  const zoomBy = useCallback((factor: number, clientX?: number, clientY?: number) => {
    const canvas = containerRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX === undefined ? 0 : clientX - rect.left - rect.width / 2;
    const y = clientY === undefined ? 0 : clientY - rect.top - rect.height / 2;
    setView(previous => {
      const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, previous.zoom * factor));
      if (nextZoom === previous.zoom) return previous;
      const ratio = nextZoom / previous.zoom;
      return {
        zoom: nextZoom,
        pan: { x: x - (x - previous.pan.x) * ratio, y: y - (y - previous.pan.y) * ratio },
      };
    });
  }, []);

  useEffect(() => {
    const canvas = containerRef.current;
    if (!canvas) return;
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey && event.target instanceof HTMLTextAreaElement && event.target.scrollHeight > event.target.clientHeight + 1) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
      if (event.ctrlKey || event.metaKey) {
        zoomBy(Math.exp(Math.max(-1, Math.min(1, -event.deltaY * unit * 0.002))), event.clientX, event.clientY);
      } else {
        setView(previous => ({
          ...previous,
          pan: { x: previous.pan.x - event.deltaX * unit, y: previous.pan.y - event.deltaY * unit },
        }));
      }
    };
    // React wheel listeners are passive; a native listener can cancel browser zoom.
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [zoomBy]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setView(previous => ({ ...previous, pan: {
      x: panStart.current.panX + (e.clientX - panStart.current.x),
      y: panStart.current.panY + (e.clientY - panStart.current.y),
    } }));
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Mind map canvas"
      style={{
        flex: 1,
        overflow: 'clip',
        background: colors.bgPrimary,
        cursor: isPanning ? 'grabbing' : 'default',
        position: 'relative',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={viewBox}
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
              onClick={() => onSelect(node.id)}
              onDoubleClick={() => onStartEdit(node.id)}
              onRemoveImage={node.imageUrl ? () => onRemoveImage(node.id) : undefined}
              onViewImage={node.imageUrl ? () => onViewImage(node.imageUrl!, node.text) : undefined}
            />
          );
        })}
      </svg>
      {editingLayout && (
        <NodeEditor
          key={editingId}
          layout={editingLayout}
          svgRef={svgRef}
          canvasRef={containerRef}
          pan={pan}
          zoom={zoom}
          viewBox={viewBox}
          text={editText}
          color={editingLayout.depth === 0 ? '#ffffff' : colors.nodeText}
          onChange={onEditChange}
          onConfirm={onEditConfirm}
          onCancel={onEditCancel}
          preferredWidth={Math.min(LAYOUT.NODE_MAX_WIDTH, Math.max(240, savedLayout.get(editingLayout.id)!.width))}
          onSizeChange={onEditorSizeChange}
        />
      )}
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
      <div
        role="group"
        aria-label="Mind map zoom controls"
        style={{ position: 'absolute', bottom: 14, right: 14, display: 'flex', gap: 4, padding: 4, borderRadius: 8, background: colors.nodeBg, border: `1px solid ${colors.nodeBorder}`, boxShadow: '0 2px 8px #00000014' }}
        onMouseDown={event => event.stopPropagation()}
        onKeyDown={event => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Zoom out"
          title="Zoom out (Ctrl + mouse wheel)"
          disabled={zoom <= MIN_ZOOM}
          onClick={() => zoomBy(1 / 1.25)}
          style={{ minWidth: 34, minHeight: 34, border: 0, borderRadius: 5, background: 'transparent', color: colors.textPrimary, fontSize: 20, cursor: zoom <= MIN_ZOOM ? 'default' : 'pointer', opacity: zoom <= MIN_ZOOM ? 0.35 : 1 }}
        >−</button>
        <button
          type="button"
          aria-label="Reset mind map view"
          title="Reset zoom to 100% and center the map"
          onClick={() => setView({ zoom: 1, pan: { x: 0, y: 0 } })}
          style={{ minWidth: 58, minHeight: 34, border: 0, borderRadius: 5, background: 'transparent', color: colors.textPrimary, fontSize: 12, fontVariantNumeric: 'tabular-nums', cursor: 'pointer' }}
        >{Math.round(zoom * 100)}%</button>
        <button
          type="button"
          aria-label="Zoom in"
          title="Zoom in (Ctrl + mouse wheel)"
          disabled={zoom >= MAX_ZOOM}
          onClick={() => zoomBy(1.25)}
          style={{ minWidth: 34, minHeight: 34, border: 0, borderRadius: 5, background: 'transparent', color: colors.textPrimary, fontSize: 20, cursor: zoom >= MAX_ZOOM ? 'default' : 'pointer', opacity: zoom >= MAX_ZOOM ? 0.35 : 1 }}
        >+</button>
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
        html.push(`<img src="${escapeHtml(dataUrl)}" alt="image" style="max-width:600px" />`);
      }
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (inList) { html.push('</ul>'.repeat(listDepth + 1)); inList = false; listDepth = 0; }
      const level = headingMatch[1].length;
      html.push(`<h${level}>${escapeHtml(headingMatch[2])}</h${level}>`);
      continue;
    }

    const bulletMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (bulletMatch) {
      const depth = Math.floor(bulletMatch[1].length / 2);
      if (!inList) { html.push('<ul>'); inList = true; listDepth = 0; }
      while (listDepth < depth) { html.push('<ul>'); listDepth++; }
      while (listDepth > depth) { html.push('</ul>'); listDepth--; }
      html.push(`<li>${escapeHtml(bulletMatch[2])}</li>`);
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

import { useEffect, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { LayoutNode } from '../types';
import { LAYOUT } from '../utils/constants';

interface Props {
  layout: LayoutNode;
  svgRef: RefObject<SVGSVGElement | null>;
  canvasRef: RefObject<HTMLDivElement | null>;
  pan: { x: number; y: number };
  zoom: number;
  viewBox: string;
  text: string;
  color: string;
  onChange: (text: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  preferredWidth: number;
  onSizeChange: (size: { width: number; textHeight: number }) => void;
}

// Render the editor in ordinary HTML. Scaling a textarea inside an SVG
// foreignObject can leave its native caret painted over the wrong pixels.
export function NodeEditor({ layout, svgRef, canvasRef, pan, zoom, viewBox, text, color, onChange, onConfirm, onCancel, preferredWidth, onSizeChange }: Props) {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const measureRef = useRef<HTMLTextAreaElement>(null);
  const centered = layout.depth === 0;

  useLayoutEffect(() => {
    const editor = editorRef.current;
    const svg = svgRef.current;
    const canvas = canvasRef.current;
    const measure = measureRef.current;
    if (!editor || !svg || !canvas || !measure) return;
    const positionEditor = () => {
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const rect = canvas.getBoundingClientRect();
      const verticalPad = (LAYOUT.NODE_HEIGHT - LAYOUT.NODE_LINE_HEIGHT) / 2;
      const point = new DOMPoint(layout.x + LAYOUT.NODE_PADDING_X, layout.y - layout.height / 2 + verticalPad).matrixTransform(matrix);
      const scale = Math.hypot(matrix.a, matrix.b);
      const availableWidth = Math.max((LAYOUT.NODE_MIN_WIDTH - LAYOUT.NODE_PADDING_X * 2) * scale, canvas.clientWidth - (point.x - rect.left) - LAYOUT.NODE_PADDING_X * scale - 12);
      const width = Math.min((preferredWidth - LAYOUT.NODE_PADDING_X * 2) * scale, availableWidth);
      const typography = {
        width: `${width}px`,
        fontSize: `${(centered ? 14 : 13) * scale}px`,
        lineHeight: `${LAYOUT.NODE_LINE_HEIGHT * scale}px`,
      };
      Object.assign(measure.style, typography);
      // Measure a separate textarea so measuring never scrolls the live caret.
      // This includes repeated spaces, long URLs, and fractional font sizes.
      const naturalHeight = Math.max(LAYOUT.NODE_LINE_HEIGHT * scale, measure.scrollHeight) + 2;
      const availableHeight = Math.max(LAYOUT.NODE_LINE_HEIGHT * scale, canvas.clientHeight - (point.y - rect.top) - verticalPad * scale - 12);
      const height = Math.min(naturalHeight, availableHeight);
      Object.assign(editor.style, {
        ...typography,
        left: `${point.x - rect.left + canvas.scrollLeft}px`,
        top: `${point.y - rect.top + canvas.scrollTop}px`,
        height: `${height}px`,
        visibility: 'visible',
      });
      if (naturalHeight <= availableHeight) editor.scrollTop = 0;
      editor.scrollLeft = 0;
      onSizeChange({ width: width / scale + LAYOUT.NODE_PADDING_X * 2, textHeight: Math.ceil(height / scale) + verticalPad * 2 });
    };
    positionEditor();
    const observer = new ResizeObserver(positionEditor);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvasRef, centered, layout, onSizeChange, pan, preferredWidth, svgRef, text, viewBox, zoom]);

  useEffect(() => {
    editorRef.current?.focus({ preventScroll: true });
    editorRef.current?.select();
  }, []);

  const textStyle = {
    fontWeight: centered ? 600 : layout.depth === 1 ? 500 : 400,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textAlign: centered ? 'center' as const : 'left' as const,
    padding: 0, margin: 0, border: 'none', boxSizing: 'border-box' as const,
    resize: 'none' as const, overflowX: 'hidden' as const, overflowY: 'auto' as const,
    // Preserve trailing spaces as visible caret positions instead of hanging
    // them outside the line box, including when a space causes wrapping.
    overflowWrap: 'anywhere' as const, whiteSpace: 'break-spaces' as const,
    scrollbarGutter: 'stable',
  };

  return (
    <>
    <textarea
      ref={editorRef}
      aria-label="Edit node text"
      rows={1}
      value={text}
      onMouseDown={event => event.stopPropagation()}
      onClick={event => event.stopPropagation()}
      onDoubleClick={event => event.stopPropagation()}
      onChange={event => onChange(event.target.value)}
      onKeyDown={event => {
        if (!event.nativeEvent.isComposing) {
          if (event.key === 'Enter') { event.preventDefault(); onConfirm(); }
          else if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
        }
        event.stopPropagation();
      }}
      onBlur={onConfirm}
      style={{
        ...textStyle,
        position: 'absolute', visibility: 'hidden',
        background: 'transparent', border: 'none', outline: 'none',
        color, caretColor: color, cursor: 'text',
      }}
    />
    <textarea
      ref={measureRef}
      aria-hidden="true"
      tabIndex={-1}
      readOnly
      value={text}
      style={{ ...textStyle, position: 'fixed', left: -10000, top: 0, height: 0, visibility: 'hidden', pointerEvents: 'none' }}
    />
    </>
  );
}

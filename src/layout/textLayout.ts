import { LAYOUT } from '../utils/constants';

let context: CanvasRenderingContext2D | null | undefined;

export function wrapText(text: string, maxWidth: number, measure: (value: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r\n?|\n/)) {
    let line = '';
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      // Long URLs and words must fit too; never split a Unicode surrogate pair.
      for (const character of word) {
        if (line && measure(line + character) > maxWidth) {
          lines.push(line);
          line = '';
        }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function measureNodeText(text: string, depth: number, fixedWidth?: number) {
  if (typeof document !== 'undefined' && context === undefined) {
    context = document.createElement('canvas').getContext('2d');
  }
  if (context) context.font = `${depth === 0 ? 600 : depth === 1 ? 500 : 400} ${depth === 0 ? 14 : 13}px system-ui, -apple-system, sans-serif`;
  const measure = (value: string) => context
    ? context.measureText(value).width
    : Array.from(value).length * LAYOUT.NODE_CHAR_WIDTH;
  const maxWidth = Math.max(LAYOUT.NODE_MIN_WIDTH, Math.min(LAYOUT.NODE_MAX_WIDTH, fixedWidth ?? LAYOUT.NODE_MAX_WIDTH));
  const textLines = wrapText(text, maxWidth - LAYOUT.NODE_PADDING_X * 2, measure);
  return {
    textLines,
    width: fixedWidth === undefined ? Math.min(maxWidth, Math.max(LAYOUT.NODE_MIN_WIDTH, ...textLines.map(measure).map(width => width + LAYOUT.NODE_PADDING_X * 2))) : maxWidth,
    textHeight: LAYOUT.NODE_HEIGHT + (textLines.length - 1) * LAYOUT.NODE_LINE_HEIGHT,
  };
}

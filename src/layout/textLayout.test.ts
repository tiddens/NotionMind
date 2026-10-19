import { describe, expect, it } from 'vitest';
import { computeLayout } from './treeLayout';
import { wrapText } from './textLayout';
import { LAYOUT } from '../utils/constants';
import type { MindMapNode } from '../types';

describe('node text wrapping', () => {
  it('wraps at word boundaries without losing words', () => {
    const text = 'Downscale the company and focus the team on product development and customer success.';
    const lines = wrapText(text, 24, value => value.length);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe(text);
    expect(lines.every(line => line.length <= 24)).toBe(true);
  });

  it('breaks long URLs without losing characters or splitting surrogate pairs', () => {
    const text = 'https://example.com/' + '📊'.repeat(50);
    const lines = wrapText(text, 10, value => Array.from(value).length);
    expect(lines.join('')).toBe(text);
    expect(lines.every(line => Array.from(line).length <= 10)).toBe(true);
    expect(lines.every(line => !/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/.test(line))).toBe(true);
  });

  it('keeps explicit line breaks and blank lines', () => {
    expect(wrapText('First\r\n\r\nLast', 20, value => value.length)).toEqual(['First', '', 'Last']);
    expect(wrapText('', 20, value => value.length)).toEqual(['']);
  });

  it('reserves the browser-measured editor height when arranging neighboring nodes', () => {
    const root: MindMapNode = {
      id: 'root', text: 'Plan', collapsed: false,
      children: [
        { id: 'edit', text: 'Draft', collapsed: false, children: [], side: 'right' },
        { id: 'next', text: 'Next', collapsed: false, children: [], side: 'right' },
      ],
    };
    const layout = computeLayout(root, new Map(), new Map([['edit', { width: 240, textHeight: 214 }]]));
    const edited = layout.get('edit')!;
    const next = layout.get('next')!;
    expect(edited.width).toBe(240);
    expect(edited.textHeight).toBe(214);
    expect(edited.height).toBe(214);
    expect(next.y - next.height / 2 - (edited.y + edited.height / 2)).toBeCloseTo(LAYOUT.VERTICAL_GAP);
  });

  it('caps long root and branch widths and leaves space for siblings and images', () => {
    const longText = 'Product development and customer success '.repeat(35).trim();
    const root: MindMapNode = {
      id: 'root', text: longText, collapsed: false,
      children: [
        { id: 'long', text: longText, collapsed: false, children: [], side: 'right', imageUrl: 'wide.png' },
        { id: 'short', text: 'Next step', collapsed: false, children: [], side: 'right' },
      ],
    };
    const layout = computeLayout(root, new Map([['wide.png', { width: 1200, height: 150 }]]));
    for (const id of ['root', 'long']) {
      const item = layout.get(id)!;
      expect(item.width).toBeLessThanOrEqual(LAYOUT.NODE_MAX_WIDTH);
      expect(item.textLines.length).toBeGreaterThan(1);
      expect(item.textLines.join(' ')).toBe(longText);
      expect(item.textHeight).toBeGreaterThan(LAYOUT.NODE_HEIGHT);
    }
    const long = layout.get('long')!;
    const short = layout.get('short')!;
    expect(long.height).toBe(long.textHeight + long.imageHeight! + LAYOUT.IMAGE_PADDING);
    expect(short.y - short.height / 2 - (long.y + long.height / 2)).toBeCloseTo(LAYOUT.VERTICAL_GAP);
  });
});

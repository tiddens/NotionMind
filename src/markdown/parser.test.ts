import { describe, it, expect } from 'vitest';
import { parseMarkdown } from './parser';
import { serializeToMarkdown } from './serializer';

describe('parseMarkdown', () => {
  it('parses H1 as root', () => {
    const tree = parseMarkdown('# Hello');
    expect(tree.text).toBe('Hello');
    expect(tree.children.length).toBe(0);
  });

  it('parses nested headings', () => {
    const md = '# Root\n\n## Child1\n\n### Grandchild\n\n## Child2';
    const tree = parseMarkdown(md);
    expect(tree.children.length).toBe(2);
    expect(tree.children[0].text).toBe('Child1');
    expect(tree.children[0].children[0].text).toBe('Grandchild');
    expect(tree.children[1].text).toBe('Child2');
  });

  it('parses Windows line endings in headings, lists and image references', () => {
    const tree = parseMarkdown('# Root\r\n\r\n## Topic\r\n- Item\r\n  - Sub item\r\n![](photo.png)\r\n');
    expect(tree.text).toBe('Root');
    expect(tree.children[0].text).toBe('Topic');
    expect(tree.children[0].children[0].text).toBe('Item');
    expect(tree.children[0].children[0].children[0]).toMatchObject({ text: 'Sub item', imageUrl: 'photo.png' });
  });

  it('parses bullet lists', () => {
    const md = '# Root\n\n## Topic\n- Item 1\n  - Sub item\n- Item 2';
    const tree = parseMarkdown(md);
    const topic = tree.children[0];
    expect(topic.children.length).toBe(2);
    expect(topic.children[0].text).toBe('Item 1');
    expect(topic.children[0].children[0].text).toBe('Sub item');
  });

  it('returns Untitled for empty input', () => {
    const tree = parseMarkdown('');
    expect(tree.text).toBe('Untitled');
  });

  it('skips blank lines', () => {
    const md = '# Root\n\n\n\n## Child';
    const tree = parseMarkdown(md);
    expect(tree.children.length).toBe(1);
  });

  it('round-trip preserves text content', () => {
    const md = '# My Map\n\n## Branch A\n\n### Leaf 1\n\n### Leaf 2\n\n## Branch B\n';
    const tree = parseMarkdown(md);
    const output = serializeToMarkdown(tree);
    const reparsed = parseMarkdown(output);
    expect(reparsed.text).toBe('My Map');
    expect(reparsed.children.length).toBe(2);
    expect(reparsed.children[0].children.length).toBe(2);
  });
});

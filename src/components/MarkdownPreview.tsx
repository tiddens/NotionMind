import { useMemo } from 'react';
import type { MindMapNode } from '../types';
import { serializeToMarkdown } from '../markdown/serializer';
import { useTheme } from '../hooks/useTheme';

interface Props {
  root: MindMapNode;
  visible: boolean;
  onToggle: () => void;
}

function renderMarkdownToHtml(md: string): string {
  const lines = md.split('\n');
  const html: string[] = [];
  let inList = false;
  let listDepth = 0;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (inList) { html.push('</ul>'.repeat(listDepth + 1)); inList = false; listDepth = 0; }
      const level = headingMatch[1].length;
      const text = escapeHtml(headingMatch[2]);
      html.push(`<h${level}>${text}</h${level}>`);
      continue;
    }

    const bulletMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (bulletMatch) {
      const depth = Math.floor(bulletMatch[1].length / 2);
      const text = escapeHtml(bulletMatch[2]);
      if (!inList) {
        html.push('<ul>');
        inList = true;
        listDepth = 0;
      }
      while (listDepth < depth) { html.push('<ul>'); listDepth++; }
      while (listDepth > depth) { html.push('</ul>'); listDepth--; }
      html.push(`<li>${text}</li>`);
      continue;
    }

    if (line.trim() === '') {
      if (inList) { html.push('</ul>'.repeat(listDepth + 1)); inList = false; listDepth = 0; }
    }
  }
  if (inList) html.push('</ul>'.repeat(listDepth + 1));

  return html.join('\n');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function MarkdownPreview({ root, visible, onToggle }: Props) {
  const { colors } = useTheme();
  const markdown = useMemo(() => serializeToMarkdown(root), [root]);
  const html = useMemo(() => renderMarkdownToHtml(markdown), [markdown]);

  if (!visible) return null;

  return (
    <div style={{
      width: 360,
      minWidth: 360,
      background: colors.sidebarBg,
      borderLeft: `1px solid ${colors.nodeBorder}`,
      display: 'flex',
      flexDirection: 'column',
      color: colors.textPrimary,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 13,
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px',
        borderBottom: `1px solid ${colors.nodeBorder}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Markdown Preview</span>
        <button
          onClick={onToggle}
          title="Close preview"
          style={{
            background: 'none',
            border: 'none',
            color: colors.textSecondary,
            cursor: 'pointer',
            fontSize: 16,
            padding: '0 4px',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {/* Tabs: rendered / raw */}
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
        {/* Rendered view */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
          <div
            dangerouslySetInnerHTML={{ __html: html }}
            style={{
              lineHeight: 1.6,
              color: colors.textPrimary,
            }}
            className="md-preview"
          />
        </div>

        {/* Raw markdown */}
        <details style={{ borderTop: `1px solid ${colors.nodeBorder}` }}>
          <summary style={{
            padding: '8px 12px',
            cursor: 'pointer',
            fontSize: 12,
            color: colors.textSecondary,
            userSelect: 'none',
          }}>
            Raw Markdown
          </summary>
          <pre style={{
            padding: '12px 16px',
            margin: 0,
            fontSize: 11,
            lineHeight: 1.5,
            overflow: 'auto',
            maxHeight: 200,
            background: colors.bgPrimary,
            color: colors.textPrimary,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {markdown}
          </pre>
        </details>
      </div>
    </div>
  );
}

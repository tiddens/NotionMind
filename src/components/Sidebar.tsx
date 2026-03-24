import { useState, useRef } from 'react';
import type { FileEntry } from '../types';
import { useTheme } from '../hooks/useTheme';

const ACCENT = '#ce4334'; // lumored-600

interface Props {
  files: FileEntry[];
  currentFile: string | null;
  isDirty: boolean;
  visible: boolean;
  onToggleVisible: () => void;
  onOpenFile: (name: string) => void;
  onNewFile: (name: string) => void;
  onDeleteFile: (name: string) => void;
  onRenameFile: (oldName: string, newName: string) => void;
  onCreateFolder: (name: string) => void;
}

export function Sidebar({
  files, currentFile, isDirty, visible, onToggleVisible,
  onOpenFile, onNewFile, onDeleteFile, onRenameFile, onCreateFolder,
}: Props) {
  const { colors, mode, toggle } = useTheme();
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState<'file' | 'folder' | null>(null);
  const [renamingFile, setRenamingFile] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState<string | null>(null);
  const draggedFile = useRef<string | null>(null);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    if (isCreating === 'folder') onCreateFolder(name);
    else onNewFile(name);
    setNewName('');
    setIsCreating(null);
  };

  const handleRename = (oldName: string) => {
    const name = renameValue.trim();
    if (name && name !== oldName) {
      const dir = oldName.includes('/') ? oldName.substring(0, oldName.lastIndexOf('/') + 1) : '';
      const newFullName = name.includes('/') ? name : dir + name;
      onRenameFile(oldName, newFullName);
    }
    setRenamingFile(null);
    setRenameValue('');
  };

  const toggleFolder = (folder: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder); else next.add(folder);
      return next;
    });
  };

  const handleDrop = (targetFolder: string | null) => {
    const source = draggedFile.current;
    if (!source) return;
    const fileName = source.split('/').pop()!;
    const newPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;
    if (newPath !== source) onRenameFile(source, newPath);
    draggedFile.current = null;
    setDragOver(null);
  };

  const iconBtn = (title: string, onClick: (e: React.MouseEvent) => void, children: React.ReactNode) => (
    <button
      title={title}
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: colors.textSecondary,
        cursor: 'pointer',
        padding: '2px 4px',
        fontSize: 12,
        lineHeight: 1,
        borderRadius: 3,
        opacity: 0.6,
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = ACCENT; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.color = colors.textSecondary; }}
    >
      {children}
    </button>
  );

  const renderEntry = (entry: FileEntry, depth = 0) => {
    if (entry.type === 'folder') {
      const isExpanded = expandedFolders.has(entry.name);
      const isDragTarget = dragOver === entry.name;
      return (
        <div key={entry.name}>
          <div
            onClick={() => toggleFolder(entry.name)}
            onDragOver={e => { e.preventDefault(); setDragOver(entry.name); }}
            onDragLeave={() => { if (dragOver === entry.name) setDragOver(null); }}
            onDrop={e => { e.preventDefault(); handleDrop(entry.name); }}
            style={{
              padding: `5px 12px 5px ${14 + depth * 18}px`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 500,
              color: colors.textSecondary,
              letterSpacing: '0.02em',
              textTransform: 'uppercase' as const,
              background: isDragTarget ? ACCENT + '15' : 'transparent',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (!isDragTarget) e.currentTarget.style.background = colors.sidebarHover; }}
            onMouseLeave={e => { if (!isDragTarget) e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ fontSize: 8, width: 8, textAlign: 'center', opacity: 0.6 }}>
              {isExpanded ? '\u25BC' : '\u25B6'}
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {entry.name.split('/').pop()}
            </span>
          </div>
          {isExpanded && entry.children?.map(child => renderEntry(child, depth + 1))}
        </div>
      );
    }

    const isRenaming = renamingFile === entry.name;
    const isCurrent = entry.name === currentFile;
    const displayName = (entry.name.split('/').pop() || entry.name).replace(/\.md$/, '');

    return (
      <div
        key={entry.name}
        draggable={!isRenaming}
        onDragStart={() => { draggedFile.current = entry.name; }}
        onDragEnd={() => { draggedFile.current = null; setDragOver(null); }}
        onClick={() => { if (!isRenaming) onOpenFile(entry.name); }}
        style={{
          padding: `7px 10px 7px ${14 + depth * 18}px`,
          cursor: isRenaming ? 'default' : 'pointer',
          background: isCurrent ? colors.sidebarHover : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 4,
          borderLeft: isCurrent ? `3px solid ${ACCENT}` : '3px solid transparent',
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = colors.sidebarHover; }}
        onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
      >
        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleRename(entry.name);
              if (e.key === 'Escape') { setRenamingFile(null); setRenameValue(''); }
              e.stopPropagation();
            }}
            onBlur={() => handleRename(entry.name)}
            onClick={e => e.stopPropagation()}
            style={{
              flex: 1,
              background: colors.bgPrimary,
              border: `1px solid ${ACCENT}40`,
              color: colors.textPrimary,
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        ) : (
          <>
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              fontSize: 13,
              fontWeight: isCurrent ? 500 : 400,
              color: isCurrent ? colors.textPrimary : colors.textPrimary,
            }}>
              {displayName}
              {isCurrent && isDirty && (
                <span style={{ color: ACCENT, marginLeft: 4, fontSize: 11 }}>*</span>
              )}
            </span>
            <div style={{ display: 'flex', gap: 0, flexShrink: 0, opacity: 0 }}
              className="file-actions"
            >
              {iconBtn('Rename', (e) => {
                e.stopPropagation();
                setRenamingFile(entry.name);
                setRenameValue(displayName);
              }, '\u270E')}
              {iconBtn('Delete', (e) => {
                e.stopPropagation();
                if (confirm(`Delete "${displayName}"?`)) onDeleteFile(entry.name);
              }, '\u00D7')}
            </div>
          </>
        )}
      </div>
    );
  };

  // Collapsed sidebar
  if (!visible) {
    return (
      <div style={{
        width: 40,
        minWidth: 40,
        background: colors.sidebarBg,
        borderRight: `1px solid ${colors.nodeBorder}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 14,
      }}>
        <button
          onClick={onToggleVisible}
          title="Show sidebar"
          style={{
            background: 'none',
            border: 'none',
            color: colors.textSecondary,
            cursor: 'pointer',
            fontSize: 14,
            padding: 4,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = ACCENT}
          onMouseLeave={e => e.currentTarget.style.color = colors.textSecondary}
        >
          &#x25B6;
        </button>
      </div>
    );
  }

  const isRootDragTarget = dragOver === '__root__';

  return (
    <div style={{
      width: 240,
      minWidth: 240,
      background: colors.sidebarBg,
      borderRight: `1px solid ${colors.nodeBorder}`,
      display: 'flex',
      flexDirection: 'column',
      color: colors.textPrimary,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 13,
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 14px 12px',
        borderBottom: `1px solid ${colors.nodeBorder}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onToggleVisible}
            title="Hide sidebar"
            style={{
              background: 'none', border: 'none', color: colors.textSecondary,
              cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = ACCENT}
            onMouseLeave={e => e.currentTarget.style.color = colors.textSecondary}
          >
            &#x25C0;
          </button>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em' }}>
            Notion<span style={{ color: ACCENT }}>Mind</span>
          </span>
        </div>
        <button
          onClick={toggle}
          title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
          style={{
            background: 'none', border: 'none',
            color: colors.textSecondary, cursor: 'pointer',
            fontSize: 14, padding: '2px 4px', lineHeight: 1,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = colors.textPrimary}
          onMouseLeave={e => e.currentTarget.style.color = colors.textSecondary}
        >
          {mode === 'light' ? '\u263E' : '\u2600'}
        </button>
      </div>

      {/* Action bar */}
      <div style={{
        padding: '8px 14px',
        borderBottom: `1px solid ${colors.nodeBorder}`,
        display: 'flex',
        gap: 6,
      }}>
        <button
          onClick={() => setIsCreating('file')}
          style={{
            flex: 1,
            background: ACCENT,
            border: 'none',
            color: '#fff',
            padding: '6px 0',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          + New Map
        </button>
        <button
          onClick={() => setIsCreating('folder')}
          title="New folder"
          style={{
            background: colors.sidebarHover,
            border: `1px solid ${colors.nodeBorder}`,
            color: colors.textSecondary,
            padding: '6px 10px',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          + Folder
        </button>
      </div>

      {/* Create input */}
      {isCreating && (
        <div style={{ padding: '8px 14px', borderBottom: `1px solid ${colors.nodeBorder}` }}>
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') { setIsCreating(null); setNewName(''); }
              e.stopPropagation();
            }}
            placeholder={isCreating === 'folder' ? 'folder name' : 'filename'}
            style={{
              width: '100%',
              background: colors.bgPrimary,
              border: `1px solid ${ACCENT}40`,
              color: colors.textPrimary,
              padding: '6px 10px',
              borderRadius: 6,
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {/* File tree */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingTop: 4,
          background: isRootDragTarget ? ACCENT + '08' : 'transparent',
        }}
        onDragOver={e => { e.preventDefault(); setDragOver('__root__'); }}
        onDragLeave={e => { if (e.currentTarget === e.target) setDragOver(null); }}
        onDrop={e => { e.preventDefault(); handleDrop(null); }}
      >
        {files.map(entry => renderEntry(entry))}
        {files.length === 0 && (
          <div style={{ padding: '24px 16px', color: colors.textSecondary, textAlign: 'center', fontSize: 12, lineHeight: 1.6 }}>
            No maps yet.<br />Click "+ New Map" to get started.
          </div>
        )}
      </div>
    </div>
  );
}

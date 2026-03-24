import { useState, useRef } from 'react';
import type { FileEntry } from '../types';
import { useTheme } from '../hooks/useTheme';

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
  const [dragOver, setDragOver] = useState<string | null>(null); // folder name or '__root__'
  const draggedFile = useRef<string | null>(null);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    if (isCreating === 'folder') {
      onCreateFolder(name);
    } else {
      onNewFile(name);
    }
    setNewName('');
    setIsCreating(null);
  };

  const handleRename = (oldName: string) => {
    const name = renameValue.trim();
    if (name && name !== oldName) {
      // Preserve folder prefix if renaming a file inside a folder
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
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  };

  const handleDrop = (targetFolder: string | null) => {
    const source = draggedFile.current;
    if (!source) return;
    const fileName = source.split('/').pop()!;
    const newPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;
    if (newPath !== source) {
      onRenameFile(source, newPath);
    }
    draggedFile.current = null;
    setDragOver(null);
  };

  const inputStyle = {
    width: '100%',
    background: colors.bgPrimary,
    border: `1px solid ${colors.nodeBorder}`,
    color: colors.textPrimary,
    padding: '4px 8px',
    borderRadius: 4,
    fontSize: 12,
    outline: 'none',
    boxSizing: 'border-box' as const,
  };

  const smallBtnStyle = {
    background: 'none',
    border: 'none',
    color: colors.textSecondary,
    cursor: 'pointer',
    padding: '0 3px',
    fontSize: 13,
    lineHeight: 1,
    opacity: 0.5,
    flexShrink: 0,
  };

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
              padding: `6px 16px 6px ${16 + depth * 16}px`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: colors.textSecondary,
              fontSize: 12,
              fontWeight: 500,
              background: isDragTarget ? colors.nodeSelected + '30' : 'transparent',
              borderRadius: isDragTarget ? 4 : 0,
            }}
            onMouseEnter={e => { if (!isDragTarget) e.currentTarget.style.background = colors.sidebarHover; }}
            onMouseLeave={e => { if (!isDragTarget) e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ fontSize: 10, width: 10, textAlign: 'center' }}>{isExpanded ? '\u25BC' : '\u25B6'}</span>
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
    const displayName = entry.name.split('/').pop() || entry.name;

    return (
      <div
        key={entry.name}
        draggable={!isRenaming}
        onDragStart={() => { draggedFile.current = entry.name; }}
        onDragEnd={() => { draggedFile.current = null; setDragOver(null); }}
        onClick={() => { if (!isRenaming) onOpenFile(entry.name); }}
        style={{
          padding: `6px 8px 6px ${16 + depth * 16}px`,
          cursor: isRenaming ? 'default' : 'grab',
          background: isCurrent ? colors.sidebarHover : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 4,
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
            style={{ ...inputStyle, padding: '2px 6px' }}
          />
        ) : (
          <>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {displayName}
              {isCurrent && isDirty && (
                <span style={{ color: colors.nodeSelected, marginLeft: 4 }}>*</span>
              )}
            </span>
            <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
              <button
                title="Rename"
                onClick={(e) => {
                  e.stopPropagation();
                  setRenamingFile(entry.name);
                  setRenameValue(displayName);
                }}
                style={smallBtnStyle}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
              >
                &#x270E;
              </button>
              <button
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${displayName}"?`)) onDeleteFile(entry.name);
                }}
                style={smallBtnStyle}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
              >
                ×
              </button>
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
        width: 36,
        minWidth: 36,
        background: colors.sidebarBg,
        borderRight: `1px solid ${colors.nodeBorder}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 10,
      }}>
        <button
          onClick={onToggleVisible}
          title="Show sidebar"
          style={{
            background: 'none',
            border: 'none',
            color: colors.textPrimary,
            cursor: 'pointer',
            fontSize: 16,
            padding: 4,
          }}
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
        padding: '10px 12px',
        borderBottom: `1px solid ${colors.nodeBorder}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={onToggleVisible}
            title="Hide sidebar"
            style={{
              background: 'none',
              border: 'none',
              color: colors.textSecondary,
              cursor: 'pointer',
              fontSize: 14,
              padding: 0,
              lineHeight: 1,
            }}
          >
            &#x25C0;
          </button>
          <span style={{ fontWeight: 600, fontSize: 14 }}>NotionMind</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={toggle}
            title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
            style={{
              background: colors.nodeBorder,
              border: 'none',
              color: colors.textPrimary,
              padding: '4px 7px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 13,
              lineHeight: 1,
            }}
          >
            {mode === 'light' ? '\u263E' : '\u2600'}
          </button>
          <button
            onClick={() => setIsCreating('folder')}
            title="New folder"
            style={{
              background: colors.nodeBorder,
              border: 'none',
              color: colors.textPrimary,
              padding: '4px 7px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            +&#x1F4C1;
          </button>
          <button
            onClick={() => setIsCreating('file')}
            title="New file"
            style={{
              background: colors.nodeBorder,
              border: 'none',
              color: colors.textPrimary,
              padding: '4px 7px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            + New
          </button>
        </div>
      </div>

      {/* New file/folder input */}
      {isCreating && (
        <div style={{ padding: '8px 16px', borderBottom: `1px solid ${colors.nodeBorder}` }}>
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') { setIsCreating(null); setNewName(''); }
              e.stopPropagation();
            }}
            placeholder={isCreating === 'folder' ? 'folder name' : 'filename.md'}
            style={inputStyle}
          />
        </div>
      )}

      {/* File tree — root drop zone for moving files out of folders */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          background: isRootDragTarget ? colors.nodeSelected + '15' : 'transparent',
        }}
        onDragOver={e => { e.preventDefault(); setDragOver('__root__'); }}
        onDragLeave={e => {
          // Only clear if leaving the root container itself
          if (e.currentTarget === e.target) setDragOver(null);
        }}
        onDrop={e => { e.preventDefault(); handleDrop(null); }}
      >
        {files.map(entry => renderEntry(entry))}
        {files.length === 0 && (
          <div style={{ padding: '16px', color: colors.textSecondary, textAlign: 'center' }}>
            No maps yet. Click "+ New" to create one.
          </div>
        )}
      </div>
    </div>
  );
}

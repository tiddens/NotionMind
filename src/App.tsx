import { useEffect, useMemo, useState, useCallback } from 'react';
import { MindMapCanvas } from './components/MindMapCanvas';
import { Sidebar } from './components/Sidebar';
import { MarkdownPreview } from './components/MarkdownPreview';
import { useMindMap } from './hooks/useMindMap';
import { useKeyboard } from './hooks/useKeyboard';
import { ThemeContext, getColors } from './hooks/useTheme';
import type { ThemeMode } from './hooks/useTheme';
import type { FileEntry } from './types';
import './App.css';

function findFirstFile(entries: FileEntry[]): string | null {
  for (const e of entries) {
    if (e.type === 'file') return e.name;
    if (e.type === 'folder' && e.children) {
      const found = findFirstFile(e.children);
      if (found) return found;
    }
  }
  return null;
}

function getInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem('notionmind-theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* ignore */ }
  return 'light';
}

export default function App() {
  const mindMap = useMindMap();
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialTheme);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [previewVisible, setPreviewVisible] = useState(false);

  const toggleTheme = useCallback(() => {
    setThemeMode(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      try { localStorage.setItem('notionmind-theme', next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const themeValue = useMemo(() => ({
    mode: themeMode,
    colors: getColors(themeMode),
    toggle: toggleTheme,
  }), [themeMode, toggleTheme]);

  // Apply theme to html root
  useEffect(() => {
    const c = themeValue.colors;
    document.documentElement.style.background = c.bgPrimary;
    document.documentElement.style.color = c.textPrimary;
  }, [themeValue]);

  // Load file list on mount and auto-open first file
  useEffect(() => {
    mindMap.fileManager.loadFileList().then(entries => {
      const firstFile = findFirstFile(entries);
      if (firstFile) mindMap.openFile(firstFile);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const keyboardActions = useMemo(() => ({
    editingId: mindMap.editingId,
    navigateUp: mindMap.navigateUp,
    navigateDown: mindMap.navigateDown,
    navigateLeft: mindMap.navigateLeft,
    navigateRight: mindMap.navigateRight,
    doAddChild: mindMap.doAddChild,
    doAddSibling: mindMap.doAddSibling,
    doDelete: mindMap.doDelete,
    doMoveUp: mindMap.doMoveUp,
    doMoveDown: mindMap.doMoveDown,
    doMoveLeft: mindMap.doMoveLeft,
    doMoveRight: mindMap.doMoveRight,
    doToggleCollapse: mindMap.doToggleCollapse,
    selectRoot: mindMap.selectRoot,
    startEdit: mindMap.startEdit,
    startEditEmpty: mindMap.startEditEmpty,
    confirmEdit: mindMap.confirmEdit,
    cancelEdit: mindMap.cancelEdit,
    undo: mindMap.undo,
    redo: mindMap.redo,
    save: mindMap.save,
    copyNodes: mindMap.copyNodes,
    paste: mindMap.paste,
  }), [
    mindMap.editingId,
    mindMap.navigateUp, mindMap.navigateDown, mindMap.navigateLeft, mindMap.navigateRight,
    mindMap.doAddChild, mindMap.doAddSibling, mindMap.doDelete,
    mindMap.doMoveUp, mindMap.doMoveDown, mindMap.doMoveLeft, mindMap.doMoveRight,
    mindMap.doToggleCollapse, mindMap.selectRoot,
    mindMap.startEdit, mindMap.startEditEmpty, mindMap.confirmEdit, mindMap.cancelEdit,
    mindMap.undo, mindMap.redo, mindMap.save, mindMap.copyNodes, mindMap.paste,
  ]);

  useKeyboard(keyboardActions);

  return (
    <ThemeContext.Provider value={themeValue}>
      <Sidebar
        files={mindMap.fileManager.files}
        currentFile={mindMap.fileManager.currentFile}
        isDirty={mindMap.isDirty}
        visible={sidebarVisible}
        onToggleVisible={() => setSidebarVisible(v => !v)}
        onOpenFile={mindMap.openFile}
        onNewFile={mindMap.newFile}
        onDeleteFile={mindMap.fileManager.deleteFile}
        onRenameFile={mindMap.fileManager.renameFile}
        onCreateFolder={mindMap.fileManager.createFolder}
      />
      <MindMapCanvas
        root={mindMap.tree}
        selectedId={mindMap.selectedId}
        selectedIds={mindMap.selectedIds}
        editingId={mindMap.editingId}
        editText={mindMap.editText}
        onSelect={mindMap.selectSingle}
        onStartEdit={mindMap.startEdit}
        onEditChange={mindMap.setEditText}
        onEditConfirm={mindMap.confirmEdit}
        onEditCancel={mindMap.cancelEdit}
        onTogglePreview={() => setPreviewVisible(v => !v)}
        previewVisible={previewVisible}
        onRemoveImage={mindMap.doRemoveImage}
      />
      <MarkdownPreview
        root={mindMap.tree}
        visible={previewVisible}
        onToggle={() => setPreviewVisible(false)}
      />
    </ThemeContext.Provider>
  );
}

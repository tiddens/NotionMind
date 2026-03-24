import { useState, useRef, useCallback, useEffect } from 'react';
import type { MindMapNode } from '../types';
import {
  createDefaultTree,
  findNode,
  findParent,
  addChild,
  addSibling,
  removeNode,
  moveAmongSiblings,
  moveLeft,
  moveRight,
  updateText,
  toggleCollapsed,
  getVisiblePrevSibling,
  getVisibleNextSibling,
  getFirstChild,
  extractSideMeta,
  applySideMeta,
  assignMissingSides,
} from '../model/MindMapTree';
import { UndoManager } from '../model/UndoManager';
import { getSide, splitSides } from '../layout/treeLayout';
import { serializeToMarkdown } from '../markdown/serializer';
import { parseMarkdown } from '../markdown/parser';
import { useFileManager } from './useFileManager';

export function useMindMap() {
  const [tree, setTree] = useState<MindMapNode>(createDefaultTree);
  const [selectedId, setSelectedId] = useState<string | null>(() => tree.id);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const undoManager = useRef(new UndoManager<MindMapNode>());
  const fileManager = useFileManager();

  const initialized = useRef(false);
  if (!initialized.current) {
    undoManager.current.push(tree);
    initialized.current = true;
  }

  const pushState = useCallback((newTree: MindMapNode) => {
    setTree(newTree);
    undoManager.current.push(newTree);
    setIsDirty(true);
  }, []);

  // --- Tree mutations ---

  const doAddChild = useCallback(() => {
    const targetId = selectedId || tree.id;
    const { tree: newTree, newId } = addChild(tree, targetId);
    if (newId) {
      pushState(newTree);
      setSelectedId(newId);
      setEditingId(newId);
      setEditText('');
    }
  }, [tree, selectedId, pushState]);

  const doAddSibling = useCallback(() => {
    const targetId = selectedId || tree.id;
    const { tree: newTree, newId } = addSibling(tree, targetId);
    if (newId) {
      pushState(newTree);
      setSelectedId(newId);
      setEditingId(newId);
      setEditText('');
    }
  }, [tree, selectedId, pushState]);

  const doDelete = useCallback(() => {
    if (!selectedId || selectedId === tree.id) return;
    const { tree: newTree, nextSelectId } = removeNode(tree, selectedId);
    pushState(newTree);
    setSelectedId(nextSelectId);
  }, [tree, selectedId, pushState]);

  const doMoveUp = useCallback(() => {
    if (!selectedId) return;
    pushState(moveAmongSiblings(tree, selectedId, 'up'));
  }, [tree, selectedId, pushState]);

  const doMoveDown = useCallback(() => {
    if (!selectedId) return;
    pushState(moveAmongSiblings(tree, selectedId, 'down'));
  }, [tree, selectedId, pushState]);

  const doMoveLeft = useCallback(() => {
    if (!selectedId) return;
    pushState(moveLeft(tree, selectedId));
  }, [tree, selectedId, pushState]);

  const doMoveRight = useCallback(() => {
    if (!selectedId) return;
    pushState(moveRight(tree, selectedId));
  }, [tree, selectedId, pushState]);

  const doToggleCollapse = useCallback(() => {
    if (!selectedId) return;
    pushState(toggleCollapsed(tree, selectedId));
  }, [tree, selectedId, pushState]);

  // --- Editing ---

  const startEdit = useCallback((id?: string) => {
    const nodeId = id || selectedId;
    if (!nodeId) return;
    const node = findNode(tree, nodeId);
    if (!node) return;
    setEditingId(nodeId);
    setEditText(node.text);
    setSelectedId(nodeId);
  }, [tree, selectedId]);

  const startEditEmpty = useCallback((initialChar: string) => {
    if (!selectedId) return;
    const node = findNode(tree, selectedId);
    if (!node) return;
    setEditingId(selectedId);
    setEditText(initialChar);
  }, [tree, selectedId]);

  const confirmEdit = useCallback(() => {
    if (!editingId) return;
    const trimmed = editText.trim();
    if (trimmed) {
      pushState(updateText(tree, editingId, trimmed));
    }
    setEditingId(null);
    setEditText('');
  }, [tree, editingId, editText, pushState]);

  const cancelEdit = useCallback(() => {
    if (editingId) {
      const node = findNode(tree, editingId);
      if (node && node.text === 'New Node' && editText.trim() === '') {
        const { tree: newTree, nextSelectId } = removeNode(tree, editingId);
        pushState(newTree);
        setSelectedId(nextSelectId);
      }
    }
    setEditingId(null);
    setEditText('');
  }, [tree, editingId, editText, pushState]);

  // --- Navigation ---

  const navigateUp = useCallback(() => {
    if (!selectedId) { setSelectedId(tree.id); return; }
    const prev = getVisiblePrevSibling(tree, selectedId);
    if (prev) setSelectedId(prev.id);
    else {
      const parent = findParent(tree, selectedId);
      if (parent) setSelectedId(parent.id);
    }
  }, [tree, selectedId]);

  const navigateDown = useCallback(() => {
    if (!selectedId) { setSelectedId(tree.id); return; }
    const next = getVisibleNextSibling(tree, selectedId);
    if (next) setSelectedId(next.id);
  }, [tree, selectedId]);

  const navigateLeft = useCallback(() => {
    if (!selectedId) { setSelectedId(tree.id); return; }
    if (selectedId === tree.id) {
      const { left } = splitSides(tree);
      if (left.length > 0) setSelectedId(left[0].id);
      return;
    }
    const side = getSide(tree, selectedId);
    if (side === 'right') {
      const parent = findParent(tree, selectedId);
      if (parent) setSelectedId(parent.id);
    } else {
      const node = findNode(tree, selectedId);
      if (node) {
        const child = getFirstChild(node);
        if (child) setSelectedId(child.id);
      }
    }
  }, [tree, selectedId]);

  const navigateRight = useCallback(() => {
    if (!selectedId) { setSelectedId(tree.id); return; }
    if (selectedId === tree.id) {
      const { right } = splitSides(tree);
      if (right.length > 0) setSelectedId(right[0].id);
      return;
    }
    const side = getSide(tree, selectedId);
    if (side === 'right') {
      const node = findNode(tree, selectedId);
      if (node) {
        const child = getFirstChild(node);
        if (child) setSelectedId(child.id);
      }
    } else {
      const parent = findParent(tree, selectedId);
      if (parent) setSelectedId(parent.id);
    }
  }, [tree, selectedId]);

  const selectRoot = useCallback(() => setSelectedId(tree.id), [tree]);

  // --- Undo/Redo ---

  const undo = useCallback(() => {
    const prev = undoManager.current.undo();
    if (prev) { setTree(prev); setIsDirty(true); }
  }, []);

  const redo = useCallback(() => {
    const next = undoManager.current.redo();
    if (next) { setTree(next); setIsDirty(true); }
  }, []);

  // --- File operations ---

  const saveMeta = useCallback((fileName: string) => {
    fileManager.saveMeta(fileName, { sides: extractSideMeta(tree) });
  }, [tree, fileManager]);

  const save = useCallback(async () => {
    const fileName = fileManager.currentFile || 'untitled.md';
    const ok = await fileManager.saveFile(fileName, serializeToMarkdown(tree));
    if (ok) { saveMeta(fileName); setIsDirty(false); }
    return ok;
  }, [tree, fileManager, saveMeta]);

  // Autosave
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isDirty || !fileManager.currentFile) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      const fileName = fileManager.currentFile!;
      fileManager.saveFile(fileName, serializeToMarkdown(tree)).then(ok => {
        if (ok) { saveMeta(fileName); setIsDirty(false); }
      });
    }, 1000);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [tree, isDirty, fileManager, saveMeta]);

  const openFile = useCallback(async (name: string) => {
    const content = await fileManager.openFile(name);
    if (content !== null) {
      const newTree = parseMarkdown(content);
      const meta = await fileManager.loadMeta(name);
      if (meta && typeof meta.sides === 'object' && meta.sides) {
        applySideMeta(newTree, meta.sides as Record<string, 'left' | 'right'>);
      }
      assignMissingSides(newTree);
      setTree(newTree);
      setSelectedId(newTree.id);
      setEditingId(null);
      undoManager.current.clear();
      undoManager.current.push(newTree);
      setIsDirty(false);
    }
  }, [fileManager]);

  const newFile = useCallback(async (name: string) => {
    const fileName = name.endsWith('.md') ? name : `${name}.md`;
    const newTree = createDefaultTree();
    const ok = await fileManager.saveFile(fileName, serializeToMarkdown(newTree));
    if (ok) {
      setTree(newTree);
      setSelectedId(newTree.id);
      setEditingId(null);
      undoManager.current.clear();
      undoManager.current.push(newTree);
      setIsDirty(false);
    }
  }, [fileManager]);

  return {
    tree, selectedId, editingId, editText, isDirty, fileManager,
    setSelectedId, setEditText,
    doAddChild, doAddSibling, doDelete,
    doMoveUp, doMoveDown, doMoveLeft, doMoveRight,
    doToggleCollapse,
    startEdit, startEditEmpty, confirmEdit, cancelEdit,
    navigateUp, navigateDown, navigateLeft, navigateRight, selectRoot,
    undo, redo,
    save, openFile, newFile,
  };
}

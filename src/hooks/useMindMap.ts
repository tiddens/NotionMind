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
  moveBatchAmongSiblings,
  moveBatchLeft,
  moveBatchRight,
  updateText,
  updateNodeImage,
  removeNodeImage,
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
import { serializeNodeToText, parseIndentedText } from '../model/clipboard';
import type { ParsedNode } from '../model/clipboard';

// Recursively add parsed nodes as children of parentId
function addParsedNodes(tree: MindMapNode, parentId: string, nodes: ParsedNode[]): MindMapNode {
  let current = tree;
  for (const parsed of nodes) {
    const result = addChild(current, parentId, parsed.text);
    current = result.tree;
    if (parsed.imageUrl) {
      current = updateNodeImage(current, result.newId, parsed.imageUrl);
    }
    if (parsed.children.length > 0) {
      current = addParsedNodes(current, result.newId, parsed.children);
    }
  }
  return current;
}

export function useMindMap() {
  const [tree, setTree] = useState<MindMapNode>(createDefaultTree);
  const [selectedId, setSelectedId] = useState<string | null>(() => tree.id);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set([tree.id]));
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

  const selectSingle = useCallback((id: string | null) => {
    setSelectedId(id);
    setSelectedIds(id ? new Set([id]) : new Set());
  }, []);

  const extendSelection = useCallback((id: string) => {
    setSelectedId(id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // Always include the primary
      next.add(id);
      return next;
    });
  }, []);

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
      selectSingle(newId);
      setEditingId(newId);
      setEditText('');
    }
  }, [tree, selectedId, pushState, selectSingle]);

  const doAddSibling = useCallback(() => {
    const targetId = selectedId || tree.id;
    const { tree: newTree, newId } = addSibling(tree, targetId);
    if (newId) {
      pushState(newTree);
      selectSingle(newId);
      setEditingId(newId);
      setEditText('');
    }
  }, [tree, selectedId, pushState, selectSingle]);

  const doDelete = useCallback(() => {
    if (!selectedId || selectedId === tree.id) return;
    const node = findNode(tree, selectedId);
    if (node?.imageUrl) {
      pushState(removeNodeImage(tree, selectedId));
      return;
    }
    const { tree: newTree, nextSelectId } = removeNode(tree, selectedId);
    pushState(newTree);
    selectSingle(nextSelectId);
  }, [tree, selectedId, pushState]);

  const doMoveUp = useCallback(() => {
    if (!selectedId) return;
    if (selectedIds.size > 1) {
      pushState(moveBatchAmongSiblings(tree, selectedIds, 'up'));
    } else {
      pushState(moveAmongSiblings(tree, selectedId, 'up'));
    }
  }, [tree, selectedId, selectedIds, pushState]);

  const doMoveDown = useCallback(() => {
    if (!selectedId) return;
    if (selectedIds.size > 1) {
      pushState(moveBatchAmongSiblings(tree, selectedIds, 'down'));
    } else {
      pushState(moveAmongSiblings(tree, selectedId, 'down'));
    }
  }, [tree, selectedId, selectedIds, pushState]);

  const doRemoveImage = useCallback((nodeId: string) => {
    pushState(removeNodeImage(tree, nodeId));
  }, [tree, pushState]);

  const doMoveLeft = useCallback(() => {
    if (!selectedId) return;
    if (selectedIds.size > 1) {
      pushState(moveBatchLeft(tree, selectedIds));
    } else {
      pushState(moveLeft(tree, selectedId));
    }
  }, [tree, selectedId, selectedIds, pushState]);

  const doMoveRight = useCallback(() => {
    if (!selectedId) return;
    if (selectedIds.size > 1) {
      pushState(moveBatchRight(tree, selectedIds));
    } else {
      pushState(moveRight(tree, selectedId));
    }
  }, [tree, selectedId, selectedIds, pushState]);

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
    selectSingle(nodeId);
  }, [tree, selectedId, selectSingle]);

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
        selectSingle(nextSelectId);
      }
    }
    setEditingId(null);
    setEditText('');
  }, [tree, editingId, editText, pushState, selectSingle]);

  // --- Navigation ---

  const navigateUp = useCallback((extend = false) => {
    if (!selectedId) { selectSingle(tree.id); return; }
    const prev = getVisiblePrevSibling(tree, selectedId);
    if (prev) {
      if (extend) extendSelection(prev.id);
      else selectSingle(prev.id);
    } else {
      const parent = findParent(tree, selectedId);
      if (parent) selectSingle(parent.id);
    }
  }, [tree, selectedId, selectSingle, extendSelection]);

  const navigateDown = useCallback((extend = false) => {
    if (!selectedId) { selectSingle(tree.id); return; }
    const next = getVisibleNextSibling(tree, selectedId);
    if (next) {
      if (extend) extendSelection(next.id);
      else selectSingle(next.id);
    }
  }, [tree, selectedId, selectSingle, extendSelection]);

  const navigateLeft = useCallback(() => {
    if (!selectedId) { selectSingle(tree.id); return; }
    if (selectedId === tree.id) {
      const { left } = splitSides(tree);
      if (left.length > 0) selectSingle(left[0].id);
      return;
    }
    const side = getSide(tree, selectedId);
    if (side === 'right') {
      const parent = findParent(tree, selectedId);
      if (parent) selectSingle(parent.id);
    } else {
      const node = findNode(tree, selectedId);
      if (node) {
        const child = getFirstChild(node);
        if (child) selectSingle(child.id);
      }
    }
  }, [tree, selectedId, selectSingle]);

  const navigateRight = useCallback(() => {
    if (!selectedId) { selectSingle(tree.id); return; }
    if (selectedId === tree.id) {
      const { right } = splitSides(tree);
      if (right.length > 0) selectSingle(right[0].id);
      return;
    }
    const side = getSide(tree, selectedId);
    if (side === 'right') {
      const node = findNode(tree, selectedId);
      if (node) {
        const child = getFirstChild(node);
        if (child) selectSingle(child.id);
      }
    } else {
      const parent = findParent(tree, selectedId);
      if (parent) selectSingle(parent.id);
    }
  }, [tree, selectedId, selectSingle]);

  const selectRoot = useCallback(() => selectSingle(tree.id), [tree, selectSingle]);

  // --- Paste image ---

  const copyNodes = useCallback(() => {
    if (selectedIds.size === 0) return;
    const nodes = [...selectedIds]
      .map(id => findNode(tree, id))
      .filter((n): n is MindMapNode => n !== null);
    if (nodes.length === 0) return;
    const text = nodes.map(n => serializeNodeToText(n, 0)).join('\n');
    navigator.clipboard.writeText(text);
  }, [tree, selectedIds]);

  const paste = useCallback(async () => {
    if (!selectedId) return;
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        // Check for image first
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const filename = await fileManager.uploadImage(blob);
          if (filename) {
            pushState(updateNodeImage(tree, selectedId, filename));
          }
          return;
        }
        // Check for text — parse indented hierarchy or flat lines
        if (item.types.includes('text/plain')) {
          const blob = await item.getType('text/plain');
          const text = await blob.text();
          const parsed = parseIndentedText(text);
          if (parsed.length === 0) return;
          const updated = addParsedNodes(tree, selectedId, parsed);
          pushState(updated);
          return;
        }
      }
    } catch { /* clipboard access denied */ }
  }, [tree, selectedId, pushState, fileManager]);

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
      selectSingle(newTree.id);
      setEditingId(null);
      undoManager.current.clear();
      undoManager.current.push(newTree);
      setIsDirty(false);
    }
  }, [fileManager, selectSingle]);

  const newFile = useCallback(async (name: string) => {
    const fileName = name.endsWith('.md') ? name : `${name}.md`;
    const newTree = createDefaultTree();
    const ok = await fileManager.saveFile(fileName, serializeToMarkdown(newTree));
    if (ok) {
      setTree(newTree);
      selectSingle(newTree.id);
      setEditingId(null);
      undoManager.current.clear();
      undoManager.current.push(newTree);
      setIsDirty(false);
    }
  }, [fileManager, selectSingle]);

  return {
    tree, selectedId, selectedIds, editingId, editText, isDirty, fileManager,
    selectSingle, setEditText,
    doAddChild, doAddSibling, doDelete,
    doMoveUp, doMoveDown, doMoveLeft, doMoveRight,
    doToggleCollapse,
    startEdit, startEditEmpty, confirmEdit, cancelEdit,
    navigateUp, navigateDown, navigateLeft, navigateRight, selectRoot,
    undo, redo,
    copyNodes, paste, doRemoveImage,
    save, openFile, newFile,
  };
}

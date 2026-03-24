import { useState, useRef, useCallback, useEffect } from 'react';
import type { MindMapNode } from '../types';
import {
  createDefaultTree,
  findNode,
  findParent,
  findSiblingIndex,
  addChild,
  addSibling,
  removeNode,
  moveAmongSiblings,
  promote,
  demote,
  moveToSide,
  moveAllToSide,
  updateText,
  toggleCollapsed,
  getVisiblePrevSibling,
  getVisibleNextSibling,
  getFirstChild,
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

  // Initialize undo with first state
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
    const newTree = moveAmongSiblings(tree, selectedId, 'up');
    pushState(newTree);
  }, [tree, selectedId, pushState]);

  const doMoveDown = useCallback(() => {
    if (!selectedId) return;
    const newTree = moveAmongSiblings(tree, selectedId, 'down');
    pushState(newTree);
  }, [tree, selectedId, pushState]);

  const doMoveLeft = useCallback(() => {
    if (!selectedId) return;
    if (selectedId === tree.id) {
      // Root selected: move ALL children to left
      const newTree = moveAllToSide(tree, 'left');
      pushState(newTree);
      return;
    }
    const parent = findParent(tree, selectedId);
    if (parent && parent.id === tree.id) {
      // Direct child of root: move to left side
      const newTree = moveToSide(tree, selectedId, 'left');
      pushState(newTree);
    } else {
      // Deeper node: promote
      const newTree = promote(tree, selectedId);
      pushState(newTree);
    }
  }, [tree, selectedId, pushState]);

  const doMoveRight = useCallback(() => {
    if (!selectedId) return;
    if (selectedId === tree.id) {
      // Root selected: move ALL children to right
      const newTree = moveAllToSide(tree, 'right');
      pushState(newTree);
      return;
    }
    const parent = findParent(tree, selectedId);
    if (parent && parent.id === tree.id) {
      // Direct child of root: move to right side
      const newTree = moveToSide(tree, selectedId, 'right');
      pushState(newTree);
    } else {
      // Deeper node: demote
      const newTree = demote(tree, selectedId);
      pushState(newTree);
    }
  }, [tree, selectedId, pushState]);

  const doToggleCollapse = useCallback(() => {
    if (!selectedId) return;
    const newTree = toggleCollapsed(tree, selectedId);
    pushState(newTree);
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
      const newTree = updateText(tree, editingId, trimmed);
      pushState(newTree);
    }
    setEditingId(null);
    setEditText('');
  }, [tree, editingId, editText, pushState]);

  const cancelEdit = useCallback(() => {
    // If the node was just created (text is "New Node" and edit is empty), delete it
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
    if (prev) {
      setSelectedId(prev.id);
    } else {
      const parent = findParent(tree, selectedId);
      if (parent) setSelectedId(parent.id);
    }
  }, [tree, selectedId]);

  const navigateDown = useCallback(() => {
    if (!selectedId) { setSelectedId(tree.id); return; }
    const next = getVisibleNextSibling(tree, selectedId);
    if (next) {
      setSelectedId(next.id);
    }
  }, [tree, selectedId]);

  const navigateLeft = useCallback(() => {
    if (!selectedId) { setSelectedId(tree.id); return; }
    if (selectedId === tree.id) {
      // From root, go to first left-side child
      const { left } = splitSides(tree);
      if (left.length > 0) setSelectedId(left[0].id);
      return;
    }
    const side = getSide(tree, selectedId);
    if (side === 'right') {
      // Left = toward root (parent)
      const parent = findParent(tree, selectedId);
      if (parent) setSelectedId(parent.id);
    } else {
      // Left = away from root (first child)
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
      // From root, go to first right-side child
      const { right } = splitSides(tree);
      if (right.length > 0) setSelectedId(right[0].id);
      return;
    }
    const side = getSide(tree, selectedId);
    if (side === 'right') {
      // Right = away from root (first child)
      const node = findNode(tree, selectedId);
      if (node) {
        const child = getFirstChild(node);
        if (child) setSelectedId(child.id);
      }
    } else {
      // Right = toward root (parent)
      const parent = findParent(tree, selectedId);
      if (parent) setSelectedId(parent.id);
    }
  }, [tree, selectedId]);

  const selectRoot = useCallback(() => {
    setSelectedId(tree.id);
  }, [tree]);

  // --- Undo/Redo ---

  const undo = useCallback(() => {
    const prev = undoManager.current.undo();
    if (prev) {
      setTree(prev);
      setIsDirty(true);
    }
  }, []);

  const redo = useCallback(() => {
    const next = undoManager.current.redo();
    if (next) {
      setTree(next);
      setIsDirty(true);
    }
  }, []);

  // --- File operations ---

  const save = useCallback(async () => {
    const markdown = serializeToMarkdown(tree);
    const fileName = fileManager.currentFile || 'untitled.md';
    const ok = await fileManager.saveFile(fileName, markdown);
    if (ok) setIsDirty(false);
    return ok;
  }, [tree, fileManager]);

  // Autosave: debounced save whenever tree changes and there's a current file
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isDirty || !fileManager.currentFile) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      const markdown = serializeToMarkdown(tree);
      fileManager.saveFile(fileManager.currentFile!, markdown).then(ok => {
        if (ok) setIsDirty(false);
      });
    }, 1000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [tree, isDirty, fileManager]);

  const openFile = useCallback(async (name: string) => {
    const content = await fileManager.openFile(name);
    if (content !== null) {
      const newTree = parseMarkdown(content);
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
    const markdown = serializeToMarkdown(newTree);
    const ok = await fileManager.saveFile(fileName, markdown);
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
    tree,
    selectedId,
    editingId,
    editText,
    isDirty,
    fileManager,

    setSelectedId,
    setEditText,

    doAddChild,
    doAddSibling,
    doDelete,
    doMoveUp,
    doMoveDown,
    doMoveLeft,
    doMoveRight,
    doToggleCollapse,

    startEdit,
    startEditEmpty,
    confirmEdit,
    cancelEdit,

    navigateUp,
    navigateDown,
    navigateLeft,
    navigateRight,
    selectRoot,

    undo,
    redo,

    save,
    openFile,
    newFile,
  };
}

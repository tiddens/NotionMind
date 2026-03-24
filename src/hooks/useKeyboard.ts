import { useEffect } from 'react';

interface KeyboardActions {
  editingId: string | null;
  navigateUp: () => void;
  navigateDown: () => void;
  navigateLeft: () => void;
  navigateRight: () => void;
  doAddChild: () => void;
  doAddSibling: () => void;
  doDelete: () => void;
  doMoveUp: () => void;
  doMoveDown: () => void;
  doMoveLeft: () => void;
  doMoveRight: () => void;
  doToggleCollapse: () => void;
  selectRoot: () => void;
  startEdit: () => void;
  startEditEmpty: (char: string) => void;
  confirmEdit: () => void;
  cancelEdit: () => void;
  undo: () => void;
  redo: () => void;
  save: () => Promise<boolean>;
}

export function useKeyboard(actions: KeyboardActions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isEditing = actions.editingId !== null;

      // Ctrl+S: Save (always)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        actions.save();
        return;
      }

      // Ctrl+Z: Undo (not while editing)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !isEditing) {
        e.preventDefault();
        actions.undo();
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z: Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'Z' && e.shiftKey)) && !isEditing) {
        e.preventDefault();
        actions.redo();
        return;
      }

      // During editing, only handle Enter/Escape (handled in the input component)
      if (isEditing) return;

      // Ctrl+Arrow: Move/promote/demote
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            actions.doMoveUp();
            return;
          case 'ArrowDown':
            e.preventDefault();
            actions.doMoveDown();
            return;
          case 'ArrowLeft':
            e.preventDefault();
            actions.doMoveLeft();
            return;
          case 'ArrowRight':
            e.preventDefault();
            actions.doMoveRight();
            return;
        }
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          actions.navigateUp();
          break;
        case 'ArrowDown':
          e.preventDefault();
          actions.navigateDown();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          actions.navigateLeft();
          break;
        case 'ArrowRight':
          e.preventDefault();
          actions.navigateRight();
          break;
        case 'Tab':
        case 'Insert':
          e.preventDefault();
          actions.doAddChild();
          break;
        case 'Enter':
          e.preventDefault();
          actions.doAddSibling();
          break;
        case 'Delete':
          e.preventDefault();
          actions.doDelete();
          break;
        case ' ':
          e.preventDefault();
          actions.doToggleCollapse();
          break;
        case 'Escape':
          e.preventDefault();
          actions.selectRoot();
          break;
        case 'F2':
          e.preventDefault();
          actions.startEdit();
          break;
        default:
          // Start editing with typed character
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            actions.startEditEmpty(e.key);
          }
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [actions]);
}

import { describe, it, expect } from 'vitest';
import { UndoManager } from './UndoManager';

describe('UndoManager', () => {
  it('push then undo returns previous state', () => {
    const um = new UndoManager<number>();
    um.push(1);
    um.push(2);
    expect(um.undo()).toBe(1);
  });

  it('undo when nothing to undo returns null', () => {
    const um = new UndoManager<number>();
    um.push(1);
    expect(um.canUndo()).toBe(false);
    expect(um.undo()).toBeNull();
  });

  it('redo after undo returns next state', () => {
    const um = new UndoManager<number>();
    um.push(1);
    um.push(2);
    um.undo();
    expect(um.redo()).toBe(2);
  });

  it('redo when nothing to redo returns null', () => {
    const um = new UndoManager<number>();
    um.push(1);
    expect(um.canRedo()).toBe(false);
    expect(um.redo()).toBeNull();
  });

  it('push after undo truncates future', () => {
    const um = new UndoManager<number>();
    um.push(1);
    um.push(2);
    um.push(3);
    um.undo();
    um.push(4);
    expect(um.canRedo()).toBe(false);
    expect(um.undo()).toBe(2);
  });

  it('clear resets everything', () => {
    const um = new UndoManager<number>();
    um.push(1);
    um.push(2);
    um.clear();
    expect(um.canUndo()).toBe(false);
    expect(um.canRedo()).toBe(false);
  });

  it('states are cloned (no shared references)', () => {
    const um = new UndoManager<{ val: number }>();
    const obj = { val: 1 };
    um.push(obj);
    obj.val = 999;
    um.push(obj);
    const prev = um.undo()!;
    expect(prev.val).toBe(1);
  });
});

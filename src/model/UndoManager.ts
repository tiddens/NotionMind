const MAX_HISTORY = 100;

export class UndoManager<T> {
  private history: T[] = [];
  private pointer: number = -1;

  push(state: T): void {
    const clone = structuredClone(state);
    // Truncate any future states
    this.history = this.history.slice(0, this.pointer + 1);
    this.history.push(clone);
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    } else {
      this.pointer++;
    }
  }

  undo(): T | null {
    if (!this.canUndo()) return null;
    this.pointer--;
    return structuredClone(this.history[this.pointer]);
  }

  redo(): T | null {
    if (!this.canRedo()) return null;
    this.pointer++;
    return structuredClone(this.history[this.pointer]);
  }

  canUndo(): boolean {
    return this.pointer > 0;
  }

  canRedo(): boolean {
    return this.pointer < this.history.length - 1;
  }

  clear(): void {
    this.history = [];
    this.pointer = -1;
  }
}

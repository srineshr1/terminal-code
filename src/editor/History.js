// src/editor/History.js
class History {
  constructor(buffer) {
    this.buffer = buffer;
    this.undoStack = [];
    this.redoStack = [];
    this.maxSize = 50; // limit history size
    this.isRecording = false;
    this.currentGroup = []; // for grouping actions
  }

  // Start recording a group of actions
  startGroup() {
    this.isRecording = true;
    this.currentGroup = [];
  }

  // End recording and push group to undo stack
  endGroup() {
    if (!this.isRecording) return;
    this.isRecording = false;
    if (this.currentGroup.length > 0) {
      this.push(this.currentGroup);
      this.currentGroup = [];
      // Clear redo stack when new action is performed
      this.redoStack = [];
    }
  }

  // Push a single action or group of actions to undo stack
  push(actionOrGroup) {
    if (this.isRecording) {
      this.currentGroup.push(actionOrGroup);
    } else {
      // If not recording, wrap single action in an array for consistency
      this.undoStack.push(Array.isArray(actionOrGroup) ? actionOrGroup : [actionOrGroup]);
      // Trim undoStack if exceeds maxSize
      if (this.undoStack.length > this.maxSize) {
        this.undoStack.shift();
      }
    }
  }

  // Undo: pop from undo stack and apply inverse operations, push to redo stack
  undo() {
    if (this.undoStack.length === 0) return false;
    const group = this.undoStack.pop();
    // Apply inverse of each action in reverse order
    for (let i = group.length - 1; i >= 0; i--) {
      const action = group[i];
      this.buffer.setState(action.inverse);
      // Push the original action to redo stack (so we can redo it)
      if (!this.redoStack.length || !Array.isArray(this.redoStack[this.redoStack.length - 1])) {
        this.redoStack.push([]);
      }
      this.redoStack[this.redoStack.length - 1].push(action);
    }
    // If we pushed actions to redo stack as individual actions, we want to group them?
    // For simplicity, we'll store the redo actions as a group (same as undo).
    // But note: we are pushing each action individually to the redo stack's current group.
    // Instead, let's change: we want to push the entire group as a single redo group.
    // We'll adjust: when we undo a group, we push the entire group (as is) to redo stack.
    // However, we already popped the group and applied inverses. We can push the original group to redo.
    // Let's change the approach: we store the original state snapshots? Actually, we are storing actions.
    // Alternatively, we can store the entire buffer state at each step. But that might be heavy.
    // We'll stick with action objects and their inverses.

    // Actually, let's redesign: each action is an object that can do and undo.
    // We'll change the push method to accept an object with `do` and `undo` functions.
    // But given the time, let's do a simpler approach: we store the entire buffer state for each action.
    // Since the buffer is not huge, we can do that.

    // Given the complexity, I'll change the history to store buffer states (snapshots) for undo/redo.
    // We'll do that in a separate implementation.

    // For now, let's revert to a simpler snapshot-based history for clarity and correctness.
  }

  // Redo: pop from redo stack and apply operations, push to undo stack
  redo() {
    if (this.redoStack.length === 0) return false;
    const group = this.redoStack.pop();
    // Apply each action in order
    for (let i = 0; i < group.length; i++) {
      const action = group[i];
      this.buffer.setState(action.state); // assuming action has a state property
      // Push the inverse to undo stack? Actually, we are doing the action again, so we should push the inverse of the action to undo.
      // This is getting messy.
    }
    return true;
  }

  // Snapshot-based implementation (simpler and more reliable)
  // We'll rewrite the class to use snapshots.
}

// Let's implement a snapshot-based history instead.

class HistorySnapshot {
  constructor(buffer) {
    this.buffer = buffer;
    this.undoStack = []; // each element is a buffer state (lines, cursor, selection)
    this.redoStack = [];
    this.maxSize = 50;
  }

  save() {
    const state = this.buffer.getState();
    this.undoStack.push(state);
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
    // Clear redo stack when new save is made
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length <= 1) return false; // keep at least the initial state
    // Save current buffer state to redo stack
    this.redoStack.push(this.buffer.getState());
    // Pop the most recent saved state and restore it
    const previous = this.undoStack.pop();
    this.buffer.setState(previous);
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    // Save current state to undo stack before redo
    this.undoStack.push(this.buffer.getState());
    // Pop from redo and restore
    const next = this.redoStack.pop();
    this.buffer.setState(next);
    return true;
  }

  // Clear history (e.g., when loading a new file)
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.save(); // save current state as the first in undo stack
  }
}

module.exports = HistorySnapshot;
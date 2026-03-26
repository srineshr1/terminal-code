# Memory

## Created Files and Exported APIs

### src/core/state.js
- Exports: Singleton instance of State class
- API: 
  - get(): Returns current state
  - set(partialState): Updates state
  - subscribe(listener): Returns unsubscribe function
  - updateTabs(tabs)
  - updateBuffers(buffers)
  - updateExplorerTree(tree)
  - setUiFocus(focus)
  - updateSearchState(searchState)
  - setTerminalSize(size)
  - setActiveTabId(tabId)
  - setClipboard(clipboard)

### src/core/actions.js
- Exports: { actions, ACTION_TYPES }
- API:
  - ACTION_TYPES: Object with string constants for action types
  - actions: Object with action creators:
    - updateTabs(tabs)
    - updateBuffers(buffers)
    - updateExplorerTree(tree)
    - setUiFocus(focus)
    - updateSearchState(searchState)
    - setTerminalSize(size)
    - setActiveTabId(tabId)
    - setClipboard(clipboard)

### src/editor/Buffer.js
- Exports: Buffer class
- API:
  - constructor(id, initialContent = '')
  - getLine(row)
  - getLineCount()
  - insertText(text)
  - insertNewline()
  - backspace()
  - delete()
  - moveCursorUp()
  - moveCursorDown()
  - moveCursorLeft()
  - moveCursorRight()
  - setSelection(start, end)
  - clearSelection()
  - deleteSelection()
  - copy(): Returns selected text
  - cut(): Returns selected text and removes it
  - paste(text)
  - duplicateLine()
  - deleteLine()
  - moveLineUp()
  - moveLineDown()
  - selectAll()
  - goToLine(lineNumber)
  - getState(): Returns serializable state
  - setState(state): Restores state

### src/editor/History.js
- Exports: HistorySnapshot class
- API:
  - constructor(buffer)
  - save(): Saves current buffer state
  - undo(): Returns true if undone, false if at earliest state
  - redo(): Returns true if redone, false if no more redos
  - clear(): Clears history and saves current state

### src/editor/Search.js
- Exports: Search class
- API:
  - constructor(buffer)
  - setQuery(query): Sets search query and performs search, returns state
  - findNext(): Returns true if moved to next match
  - findPrevious(): Returns true if moved to previous match
  - getCurrentMatch(): Returns current match object or null
  - replaceCurrent(newText): Replaces current match, returns true if successful
  - replaceAll(newText): Replaces all matches, returns count of replacements
  - getState(): Returns current search state

### src/files/fileSystem.js
- Exports: Object with filesystem utility functions
- API:
  - setBaseDir(dir): Sets base directory for operations
  - getBaseDir(): Returns current base directory
  - resolveSafePath(userPath): Resolves path safely within baseDir
  - readFileSafe(filePath): Reads file as UTF-8 string
  - writeFileSafe(filePath, data, options): Writes file
  - listDirSafe(dirPath): Lists directory contents
  - statSafe(filePath): Gets file/directory stats
  - isDirSafe(dirPath): Checks if path is directory
  - isFileSafe(filePath): Checks if path is file
  - removeSafe(targetPath, options): Removes file/directory
  - mkdirSafe(dirPath, options): Creates directory

### src/files/FileTree.js
- Exports: FileTree class
- API:
  - constructor(baseDir)
  - build(): Builds tree from baseDir, returns root node
  - findNodeByPath(absPath): Finds node by absolute path
  - toggleExpanded(absPath): Toggles directory expanded state
  - getVisibleNodes(): Returns array of visible nodes (depth-first)
  - setSelectedNodeByPath(absPath): Sets selected node by path
  - getSelectedNode(): Returns currently selected node
  - selectNext(): Selects next visible node
  - selectPrevious(): Selects previous visible node
  - selectRight(): Expands directory or moves to first child
  - selectLeft(): Collapses directory or moves to parent
  - refresh(): Rebuilds tree from baseDir

### src/files/fileOps.js
- Exports: Object with file operation functions
- API:
  - createFile(filePath, content = ''): Creates file with optional content
  - createDirectory(dirPath): Creates directory
  - rename(oldPath, newPath): Renames file/directory
  - deleteItem(targetPath): Deletes file/directory recursively
  - exists(targetPath): Checks if path exists
  - copy(sourcePath, destPath): Copies file/directory
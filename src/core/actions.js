// src/core/actions.js
const state = require('./state');

// Action types
const ACTION_TYPES = {
  UPDATE_TABS: 'UPDATE_TABS',
  UPDATE_BUFFERS: 'UPDATE_BUFFERS',
  UPDATE_EXPLORER_TREE: 'UPDATE_EXPLORER_TREE',
  SET_UI_FOCUS: 'SET_UI_FOCUS',
  UPDATE_SEARCH_STATE: 'UPDATE_SEARCH_STATE',
  SET_TERMINAL_SIZE: 'SET_TERMINAL_SIZE',
  SET_ACTIVE_TAB_ID: 'SET_ACTIVE_TAB_ID',
  SET_CLIPBOARD: 'SET_CLIPBOARD'
};

// Action creators
const actions = {
  updateTabs: (tabs) => {
    state.updateTabs(tabs);
    return { type: ACTION_TYPES.UPDATE_TABS, payload: tabs };
  },
  updateBuffers: (buffers) => {
    state.updateBuffers(buffers);
    return { type: ACTION_TYPES.UPDATE_BUFFERS, payload: buffers };
  },
  updateExplorerTree: (tree) => {
    state.updateExplorerTree(tree);
    return { type: ACTION_TYPES.UPDATE_EXPLORER_TREE, payload: tree };
  },
  setUiFocus: (focus) => {
    state.setUiFocus(focus);
    return { type: ACTION_TYPES.SET_UI_FOCUS, payload: focus };
  },
  updateSearchState: (searchState) => {
    state.updateSearchState(searchState);
    return { type: ACTION_TYPES.UPDATE_SEARCH_STATE, payload: searchState };
  },
  setTerminalSize: (size) => {
    state.setTerminalSize(size);
    return { type: ACTION_TYPES.SET_TERMINAL_SIZE, payload: size };
  },
  setActiveTabId: (tabId) => {
    state.setActiveTabId(tabId);
    return { type: ACTION_TYPES.SET_ACTIVE_TAB_ID, payload: tabId };
  },
  setClipboard: (clipboard) => {
    state.setClipboard(clipboard);
    return { type: ACTION_TYPES.SET_CLIPBOARD, payload: clipboard };
  }
};

module.exports = { actions, ACTION_TYPES };
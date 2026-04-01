'use strict';

const theme = {
  name: 'vscode-dark-plus',

  menuBarBg: [48, 48, 48],
  menuBarFg: [220, 220, 220],
  menuItemHoverBg: [60, 60, 60],
  menuItemHoverFg: [255, 255, 255],

  menuDropdownBg: [20, 20, 20],
  menuDropdownFg: [204, 204, 204],
  menuDropdownHoverBg: [9, 71, 113],
  menuDropdownHoverFg: [255, 255, 255],
  menuDropdownBorder: [60, 60, 60],
  menuSeparatorFg: [80, 80, 80],
  menuShortcutFg: [140, 140, 140],

  tabBarBg: [28, 28, 28],
  tabFg: [102, 102, 102],
  tabBg: [28, 28, 28],
  tabActiveBg: [41, 45, 66],
  tabActiveFg: [192, 202, 245],
  tabActiveBorder: [0, 122, 204],
  tabModifiedFg: [224, 175, 104],
  tabNumberFg: [86, 95, 137],
  tabActiveNumberFg: [122, 162, 247],
  tabDividerFg: [51, 51, 51],
  tabCloseFg: [102, 102, 102],
  tabHoverBg: [50, 50, 51],
  tabHoverFg: [220, 220, 220],

  activityBarBg: [48, 48, 48],
  activityBarFg: [150, 150, 150],

  sidebarBg: [37, 37, 38],
  sidebarFg: [204, 204, 204],
  sidebarHeaderFg: [150, 150, 150],
  sidebarSelectedBg: [9, 71, 113],
  sidebarSelectedFg: [255, 255, 255],
  sidebarHoverBg: [50, 50, 51],
  sidebarHoverFg: [255, 255, 255],
  sidebarFolderFg: [220, 200, 128],
  sidebarFileFg: [204, 204, 204],

  editorBg: [30, 30, 30],
  editorFg: [212, 212, 212],
  gutterBg: [30, 30, 30],
  gutterFg: [85, 85, 85],
  selectionBg: [38, 79, 120],
  selectionFg: [255, 255, 255],
  cursorBg: [255, 255, 255],
  cursorFg: [30, 30, 30],

  searchBg: [37, 37, 38],
  searchFg: [204, 204, 204],
  searchLabelFg: [86, 156, 214],
  searchFieldBg: [50, 50, 50],
  searchFieldActiveBg: [60, 60, 60],
  searchMatchBg: [255, 200, 0],
  searchMatchFg: [30, 30, 30],
  searchCurrentBg: [9, 71, 113],
  searchCurrentFg: [255, 255, 255],

  statusBarBg: [0, 122, 204],
  statusBarFg: [255, 255, 255],

  scrollbarBg: [37, 37, 38],
  scrollbarThumbBg: [121, 121, 121],

  promptBg: [37, 37, 38],
  promptFg: [204, 204, 204],
  promptBorderFg: [60, 60, 60],
  promptTitleFg: [122, 162, 247],
  promptLabelFg: [156, 220, 254],
  promptHintFg: [100, 100, 100],
  promptInputBg: [45, 45, 45],
  promptInputBorderFg: [0, 122, 204],
  promptButtonFg: [204, 204, 204],
  promptButtonBg: [60, 60, 60],

  syntax: {
    keyword: [197, 134, 192],       // #C586C0 - Purple (keep)
    string: [206, 145, 120],        // #CE9178 - Orange (keep)
    number: [181, 206, 168],        // #B5CEA8 - Light green (keep)
    comment: [106, 153, 85],        // #6A9955 - Darker green (fixed)
    function: [220, 220, 170],      // #DCDCAA - Light yellow (keep)
    type: [78, 201, 176],           // #4EC9B0 - Teal (keep)
    constant: [86, 156, 214],       // #569CD6 - Blue (fixed)
    operator: [212, 212, 212],      // #D4D4D4 - Light gray (keep)
    punctuation: [212, 212, 212],   // #D4D4D4 - Light gray (keep)
    variable: [156, 220, 254],      // #9CDCFE - Light blue (keep)
    tag: [86, 156, 214],            // #569CD6 - Blue (fixed)
    attribute: [156, 220, 254],     // #9CDCFE - Light blue (keep)
    property: [156, 220, 254],      // #9CDCFE - Light blue (fixed)
  },
};

module.exports = theme;
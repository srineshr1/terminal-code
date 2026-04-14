'use strict';

const theme = {
  name: 'one-dark',

  // Menu bar - darker background
  menuBarBg: [22, 22, 30],          // #16161e
  menuBarFg: [192, 202, 245],       // #c0caf5
  menuItemHoverBg: [41, 46, 66],    // #292e42
  menuItemHoverFg: [255, 255, 255],

  // Dropdown menus
  menuDropdownBg: [22, 22, 30],     // #16161e
  menuDropdownFg: [192, 202, 245],  // #c0caf5
  menuDropdownHoverBg: [61, 89, 161], // #3d59a1
  menuDropdownHoverFg: [255, 255, 255],
  menuDropdownBorder: [59, 66, 97], // #3b4261
  menuSeparatorFg: [59, 66, 97],    // #3b4261
  menuShortcutFg: [86, 95, 137],    // #565f89

  // Tab bar - Tokyo Night style
  tabBarBg: [22, 22, 30],           // #16161e
  tabFg: [86, 95, 137],             // #565f89
  tabBg: [22, 22, 30],              // #16161e
  tabActiveBg: [26, 27, 38],        // #1a1b26
  tabActiveFg: [192, 202, 245],     // #c0caf5
  tabActiveBorder: [122, 162, 247], // #7aa2f7
  tabModifiedFg: [224, 175, 104],   // #e0af68
  tabNumberFg: [86, 95, 137],       // #565f89
  tabActiveNumberFg: [122, 162, 247], // #7aa2f7
  tabDividerFg: [59, 66, 97],       // #3b4261
  tabCloseFg: [86, 95, 137],        // #565f89
  tabHoverBg: [41, 46, 66],         // #292e42
  tabHoverFg: [192, 202, 245],      // #c0caf5

  // Activity bar
  activityBarBg: [22, 22, 30],      // #16161e
  activityBarFg: [169, 177, 214],   // #a9b1d6

  // Sidebar / Explorer
  sidebarBg: [22, 22, 30],          // #16161e
  sidebarFg: [169, 177, 214],       // #a9b1d6
  sidebarHeaderFg: [122, 162, 247], // #7aa2f7
  sidebarSelectedBg: [41, 46, 66],  // #292e42
  sidebarSelectedFg: [192, 202, 245], // #c0caf5
  sidebarHoverBg: [41, 46, 66],     // #292e42
  sidebarHoverFg: [192, 202, 245],  // #c0caf5
  sidebarFolderFg: [122, 162, 247], // #7aa2f7 - Blue folders
  sidebarFileFg: [169, 177, 214],   // #a9b1d6

  // Editor area - Tokyo Night background
  editorBg: [26, 27, 38],           // #1a1b26
  editorFg: [192, 202, 245],        // #c0caf5
  gutterBg: [26, 27, 38],           // #1a1b26
  gutterFg: [59, 66, 97],           // #3b4261
  selectionBg: [40, 52, 87],        // #283457
  selectionFg: [192, 202, 245],     // #c0caf5
  cursorBg: [192, 202, 245],        // #c0caf5
  cursorFg: [26, 27, 38],           // #1a1b26

  // Search
  searchBg: [22, 22, 30],           // #16161e
  searchFg: [192, 202, 245],        // #c0caf5
  searchLabelFg: [122, 162, 247],   // #7aa2f7
  searchFieldBg: [41, 46, 66],      // #292e42
  searchFieldActiveBg: [59, 66, 97], // #3b4261
  searchMatchBg: [224, 175, 104],   // #e0af68
  searchMatchFg: [26, 27, 38],      // #1a1b26
  searchCurrentBg: [61, 89, 161],   // #3d59a1
  searchCurrentFg: [255, 255, 255],

  // Status bar - Blue accent
  statusBarBg: [61, 89, 161],       // #3d59a1
  statusBarFg: [192, 202, 245],     // #c0caf5

  // Scrollbar
  scrollbarBg: [26, 27, 38],        // #1a1b26
  scrollbarThumbBg: [59, 66, 97],   // #3b4261

  // Prompts/Dialogs
  promptBg: [22, 22, 30],           // #16161e
  promptFg: [192, 202, 245],        // #c0caf5
  promptBorderFg: [39, 161, 185],   // #27a1b9
  promptTitleFg: [122, 162, 247],   // #7aa2f7
  promptLabelFg: [125, 207, 255],   // #7dcfff
  promptHintFg: [86, 95, 137],      // #565f89
  promptInputBg: [41, 46, 66],      // #292e42
  promptInputBorderFg: [122, 162, 247], // #7aa2f7
  promptButtonFg: [192, 202, 245],  // #c0caf5
  promptButtonBg: [59, 66, 97],     // #3b4261

  // Syntax highlighting - One Dark colors
  syntax: {
    keyword: [166, 38, 164],       // #a626a4 - Purple
    string: [80, 161, 79],         // #50a14f - Green
    number: [193, 132, 1],         // #c18401 - Yellow
    comment: [160, 161, 167],      // #a0a1a7 - Gray
    function: [64, 120, 242],      // #4078f2 - Blue
    type: [193, 132, 1],           // #c18401 - Yellow
    constant: [193, 132, 1],       // #c18401 - Yellow
    operator: [1, 132, 188],       // #0184bc - Cyan
    punctuation: [160, 161, 167],  // #a0a1a7 - Gray
    variable: [229, 192, 123],    // #e5c07b - Light
    tag: [228, 86, 73],            // #e45649 - Red
    attribute: [80, 161, 79],      // #50a14f - Green
    property: [1, 132, 188],       // #0184bc - Cyan
  },
};

module.exports = theme;
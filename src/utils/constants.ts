export const LAYOUT = {
  NODE_HEIGHT: 34,
  NODE_PADDING_X: 14,
  NODE_CHAR_WIDTH: 7.2,
  NODE_MIN_WIDTH: 60,
  NODE_MAX_WIDTH: 600,
  HORIZONTAL_GAP: 50,
  VERTICAL_GAP: 10,
  ROOT_NODE_EXTRA_PADDING: 10,
} as const;

export type ColorTheme = typeof DARK_COLORS;

// Lumoview branch colors
export const BRANCH_COLORS = [
  '#10a5ca', // lumowater-500
  '#22c55e', // lumogreen-500
  '#ffd166', // lumogolden-300
  '#e26254', // lumored-500
  '#3b82f6', // lumoblue-500
  '#2cc2e4', // lumowater-400
  '#f98f07', // lumogolden-500
  '#8f2f25', // lumored-800
] as const;

// Lumoview dark theme
export const DARK_COLORS = {
  bgPrimary: '#212121',       // lumogray-900
  bgSecondary: '#303030',     // lumogray-800
  textPrimary: '#EEEEED',     // lumogray-100
  textSecondary: '#A3A29F',   // lumogray-400
  nodeBg: '#303030',          // lumogray-800
  nodeSelected: '#ce4334',    // lumored-600
  nodeBorder: '#484847',      // lumogray-700
  nodeText: '#F4F2F1',        // lumogray-50
  edgeColor: '#484847',       // lumogray-700
  sidebarBg: '#303030',       // lumogray-800
  sidebarHover: '#484847',    // lumogray-700
  rootBg: '#2e2382',          // lumoblue
  scrollTrack: '#303030',     // lumogray-800
  scrollThumb: '#646462',     // lumogray-600
} as const;

// Lumoview light theme
export const LIGHT_COLORS: ColorTheme = {
  bgPrimary: '#F4F2F1',       // lumogray-50
  bgSecondary: '#ffffff',
  textPrimary: '#212121',      // lumogray-900
  textSecondary: '#81807E',    // lumogray-500
  nodeBg: '#ffffff',
  nodeSelected: '#ce4334',     // lumored-600
  nodeBorder: '#D9DAD8',       // lumogray-200
  nodeText: '#303030',         // lumogray-800
  edgeColor: '#C4C4C0',        // lumogray-300
  sidebarBg: '#ffffff',
  sidebarHover: '#EEEEED',     // lumogray-100
  rootBg: '#2e2382',           // lumoblue
  scrollTrack: '#EEEEED',      // lumogray-100
  scrollThumb: '#C4C4C0',      // lumogray-300
} as const;

export const COLORS = DARK_COLORS;

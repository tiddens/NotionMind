export const LAYOUT = {
  NODE_HEIGHT: 32,
  NODE_PADDING_X: 20,
  NODE_CHAR_WIDTH: 8,
  NODE_MIN_WIDTH: 80,
  NODE_MAX_WIDTH: 300,
  HORIZONTAL_GAP: 200,
  VERTICAL_GAP: 8,
  ROOT_NODE_EXTRA_PADDING: 10,
} as const;

export type ColorTheme = typeof DARK_COLORS;

export const DARK_COLORS = {
  bgPrimary: '#1a1a2e',
  bgSecondary: '#16213e',
  textPrimary: '#e0e0e0',
  textSecondary: '#a0a0b0',
  nodeBg: '#0f3460',
  nodeSelected: '#e94560',
  nodeBorder: '#533483',
  nodeText: '#e0e0e0',
  edgeColor: '#533483',
  sidebarBg: '#16213e',
  sidebarHover: '#1a2a4e',
  rootBg: '#533483',
  scrollTrack: '#16213e',
  scrollThumb: '#533483',
} as const;

export const LIGHT_COLORS: ColorTheme = {
  bgPrimary: '#f8f9fa',
  bgSecondary: '#ffffff',
  textPrimary: '#1a1a2e',
  textSecondary: '#6b7280',
  nodeBg: '#ffffff',
  nodeSelected: '#6366f1',
  nodeBorder: '#d1d5db',
  nodeText: '#1f2937',
  edgeColor: '#c7c9cc',
  sidebarBg: '#ffffff',
  sidebarHover: '#f3f4f6',
  rootBg: '#6366f1',
  scrollTrack: '#f3f4f6',
  scrollThumb: '#c7c9cc',
} as const;

// Keep backward-compatible default export
export const COLORS = DARK_COLORS;

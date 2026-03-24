import { createContext, useContext } from 'react';
import { DARK_COLORS, LIGHT_COLORS } from '../utils/constants';
import type { ColorTheme } from '../utils/constants';

export type ThemeMode = 'dark' | 'light';

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ColorTheme;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  colors: LIGHT_COLORS,
  toggle: () => {},
});

export function getColors(mode: ThemeMode): ColorTheme {
  return mode === 'dark' ? DARK_COLORS : LIGHT_COLORS;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

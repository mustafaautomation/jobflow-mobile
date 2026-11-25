import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import type { KeyValue } from '@/storage/kv';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

export interface Palette {
  frame: string;
  bg: string;
  bgElevated: string;
  bgSunken: string;
  ink: string;
  inkMuted: string;
  line: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  accent: string;
  accentSoft: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  info: string;
  infoSoft: string;
  warning: string;
  warningSoft: string;
}

export const lightColors: Palette = {
  frame: '#102421',
  bg: '#F3F0E7',
  bgElevated: '#FFFCF6',
  bgSunken: '#E7E1D4',
  ink: '#17211E',
  inkMuted: '#3E514B',
  line: '#DDD4C6',
  primary: '#0E6B62',
  primaryPressed: '#0A524C',
  onPrimary: '#F4FFFC',
  accent: '#C9841A',
  accentSoft: '#F8E7C8',
  danger: '#9E342C',
  dangerSoft: '#F8E3E0',
  success: '#1F6B42',
  successSoft: '#DDF1E5',
  info: '#1C5C84',
  infoSoft: '#DDEFF8',
  warning: '#8A5A12',
  warningSoft: '#F8EBD4',
};

export const darkColors: Palette = {
  frame: '#070C0B',
  bg: '#101614',
  bgElevated: '#1B2421',
  bgSunken: '#0C1210',
  ink: '#F4F1EA',
  inkMuted: '#B7C4BE',
  line: '#2E3C38',
  primary: '#49C7B8',
  primaryPressed: '#7EDCD0',
  onPrimary: '#06211E',
  accent: '#F0B45A',
  accentSoft: '#3A2C14',
  danger: '#F0A8A2',
  dangerSoft: '#3A201E',
  success: '#8ED4A8',
  successSoft: '#163024',
  info: '#9FCBE4',
  infoSoft: '#142A36',
  warning: '#F0C48A',
  warningSoft: '#332614',
};

const THEME_KEY = 'jobflow.theme.v1';

export interface ThemeValue {
  scheme: ColorScheme;
  colors: Palette;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const fallback: ThemeValue = {
  scheme: 'light',
  colors: lightColors,
  preference: 'system',
  setPreference: () => {},
};

const ThemeContext = createContext<ThemeValue>(fallback);

export function ThemeProvider({ children, storage }: { children: ReactNode; storage?: KeyValue }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    if (!storage) return;
    let cancel = false;
    storage.getItem(THEME_KEY).then((value) => {
      if (cancel) return;
      if (value === 'light' || value === 'dark' || value === 'system') setPreferenceState(value);
    });
    return () => {
      cancel = true;
    };
  }, [storage]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      void storage?.setItem(THEME_KEY, next);
    },
    [storage],
  );

  const scheme: ColorScheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const value = useMemo<ThemeValue>(
    () => ({
      scheme,
      colors: scheme === 'dark' ? darkColors : lightColors,
      preference,
      setPreference,
    }),
    [scheme, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

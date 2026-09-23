import { useColorScheme } from 'react-native';

const light = {
  bg: '#F6F7F9',
  card: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  accent: '#2563EB',
  accentText: '#FFFFFF',
  good: '#15803D',
  warn: '#B45309',
  bad: '#B91C1C',
  codeBg: '#F1F5F9',
};

const dark: typeof light = {
  bg: '#0B1120',
  card: '#131C2E',
  text: '#E2E8F0',
  muted: '#94A3B8',
  border: '#1E293B',
  accent: '#3B82F6',
  accentText: '#FFFFFF',
  good: '#4ADE80',
  warn: '#FBBF24',
  bad: '#F87171',
  codeBg: '#1E293B',
};

export type Palette = typeof light;

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export function gradeColor(p: Palette, grade: string | null | undefined) {
  if (!grade) return p.muted;
  if (grade.startsWith('A') || grade.startsWith('B')) return p.good;
  if (grade.startsWith('C')) return p.warn;
  return p.bad;
}

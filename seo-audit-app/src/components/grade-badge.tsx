import { Text, View } from 'react-native';

import { gradeColor, usePalette } from '@/lib/theme';

export function GradeBadge({ grade, score, size = 64 }: { grade: string | null; score: number | null; size?: number }) {
  const p = usePalette();
  const color = gradeColor(p, grade);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: Math.max(3, size / 14),
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color, fontWeight: '900', fontSize: size * 0.36 }}>{grade ?? '–'}</Text>
      {score !== null && size >= 56 && <Text style={{ color: p.muted, fontSize: size * 0.16, fontWeight: '600' }}>{score}/100</Text>}
    </View>
  );
}

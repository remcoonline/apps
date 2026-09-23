// Minimal Markdown renderer for the report: headings, bullets, numbered lists,
// checkboxes, tables, rules, **bold**, `code` and [links](url). No dependency.
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { usePalette, type Palette } from '@/lib/theme';

function Inline({ text, p, style }: { text: string; p: Palette; style?: object }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);
  return (
    <Text style={[{ color: p.text, fontSize: 15, lineHeight: 22 }, style]}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <Text key={i} style={{ fontWeight: '700' }}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <Text key={i} style={{ fontFamily: 'monospace', backgroundColor: p.codeBg, fontSize: 13 }}>
              {part.slice(1, -1)}
            </Text>
          );
        }
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          return (
            <Text key={i} style={{ color: p.accent }} onPress={() => Linking.openURL(link[2])}>
              {link[1]}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}

function Table({ rows, p }: { rows: string[][]; p: Palette }) {
  return (
    <ScrollView horizontal style={{ marginVertical: 8 }}>
      <View style={{ borderWidth: 1, borderColor: p.border, borderRadius: 8 }}>
        {rows.map((cells, r) => (
          <View key={r} style={{ flexDirection: 'row', backgroundColor: r === 0 ? p.codeBg : undefined }}>
            {cells.map((c, i) => (
              <View key={i} style={{ width: 160, padding: 8, borderColor: p.border, borderTopWidth: r ? 1 : 0, borderLeftWidth: i ? 1 : 0 }}>
                <Inline text={c} p={p} style={{ fontSize: 13, lineHeight: 18, fontWeight: r === 0 ? '700' : '400' }} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export function Markdown({ source }: { source: string }) {
  const p = usePalette();
  const lines = source.replace(/\r/g, '').split('\n');
  const out: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (!t) continue;

    if (t.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      i--;
      out.push(<Table key={i} rows={rows} p={p} />);
      continue;
    }

    const h = t.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      out.push(
        <Text
          key={i}
          style={[
            styles.heading,
            { color: p.text },
            level <= 2 ? { fontSize: 20, marginTop: 22, borderBottomWidth: 1, borderColor: p.border, paddingBottom: 6 } : { fontSize: 16, marginTop: 14 },
          ]}>
          {h[2].replace(/\*\*/g, '')}
        </Text>,
      );
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(t)) {
      out.push(<View key={i} style={{ height: 1, backgroundColor: p.border, marginVertical: 12 }} />);
      continue;
    }

    const indent = Math.min(3, Math.floor((line.length - line.trimStart().length) / 2));
    const check = t.match(/^[-*]\s+\[( |x)\]\s+(.*)$/i);
    const bullet = t.match(/^[-*•]\s+(.*)$/);
    const num = t.match(/^(\d+)[.)]\s+(.*)$/);
    const marker = check ? (check[1].trim() ? '☑' : '☐') : bullet ? '•' : num ? `${num[1]}.` : null;
    const body = check ? check[2] : bullet ? bullet[1] : num ? num[2] : null;

    if (marker && body !== null) {
      out.push(
        <View key={i} style={[styles.row, { paddingLeft: indent * 16 }]}>
          <Text style={[styles.marker, { color: check ? p.accent : p.muted, fontSize: check ? 18 : 15 }]}>{marker}</Text>
          <View style={{ flex: 1 }}>
            <Inline text={body} p={p} />
          </View>
        </View>,
      );
      continue;
    }

    out.push(
      <View key={i} style={{ marginVertical: 4 }}>
        <Inline text={t.replace(/^>\s?/, '')} p={p} />
      </View>,
    );
  }

  return <View>{out}</View>;
}

const styles = StyleSheet.create({
  heading: { fontWeight: '800', marginBottom: 6 },
  row: { flexDirection: 'row', marginVertical: 3 },
  marker: { width: 26, lineHeight: 22 },
});

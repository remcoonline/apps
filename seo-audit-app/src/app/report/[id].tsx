import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { GradeBadge } from '@/components/grade-badge';
import { Markdown } from '@/components/markdown';
import type { Check } from '@/lib/score';
import { deleteAudit, getAudit, type SavedAudit } from '@/lib/storage';
import { usePalette } from '@/lib/theme';

type Tab = 'report' | 'checks';

export default function ReportScreen() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [audit, setAudit] = useState<SavedAudit | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('report');

  useEffect(() => {
    getAudit(id).then(setAudit);
  }, [id]);

  if (audit === undefined) return <ActivityIndicator style={{ flex: 1, backgroundColor: p.bg }} />;
  if (audit === null) {
    return (
      <View style={[styles.center, { backgroundColor: p.bg }]}>
        <Text style={{ color: p.muted }}>Audit not found.</Text>
      </View>
    );
  }

  const host = audit.url.replace(/^https?:\/\//, '').replace(/\/$/, '');

  const share = () =>
    Share.share({
      title: `Website audit – ${host}`,
      message: `WEBSITE AUDIT – ${host}\nHealth score: ${audit.grade ?? '–'} (${audit.score ?? '–'}/100)\nTechnical score: ${audit.tech?.grade ?? '–'} (${audit.tech?.score ?? '–'}/100)\n\n${audit.markdown}`,
    });

  const remove = () =>
    Alert.alert('Delete audit?', host, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteAudit(audit.id);
          router.back();
        },
      },
    ]);

  const byCategory = (audit.tech?.checks ?? []).reduce<Record<string, Check[]>>((acc, c) => {
    (acc[c.category] ??= []).push(c);
    return acc;
  }, {});

  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: host,
          headerRight: () => (
            <Pressable onPress={share} hitSlop={12}>
              <Text style={{ color: p.accent, fontSize: 16, fontWeight: '600' }}>Share</Text>
            </Pressable>
          ),
        }}
      />

      <View style={[styles.card, styles.scoreRow, { backgroundColor: p.card, borderColor: p.border }]}>
        <View style={styles.scoreCol}>
          <GradeBadge grade={audit.grade} score={audit.score} size={84} />
          <Text style={[styles.scoreLabel, { color: p.muted }]}>Overall health{'\n'}(Claude)</Text>
        </View>
        <View style={styles.scoreCol}>
          <GradeBadge grade={audit.tech?.grade ?? null} score={audit.tech?.score ?? null} size={84} />
          <Text style={[styles.scoreLabel, { color: p.muted }]}>Technical score{'\n'}(measured)</Text>
        </View>
      </View>
      <Text style={{ color: p.muted, fontSize: 12, marginBottom: 12, textAlign: 'center' }}>
        {new Date(audit.createdAt).toLocaleString()} · {audit.model}
        {audit.crawl.ok ? ` · ${audit.crawl.responseMs} ms` : ' · on-device crawl failed, Claude fetched the site'}
      </Text>

      <View style={[styles.tabs, { backgroundColor: p.card, borderColor: p.border }]}>
        {(['report', 'checks'] as Tab[]).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && { backgroundColor: p.accent }]}>
            <Text style={{ color: tab === t ? p.accentText : p.text, fontWeight: '700' }}>
              {t === 'report' ? 'Full Report' : `Checks (${audit.tech?.checks.filter((c) => !c.pass).length ?? 0} failing)`}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'report' ? (
        <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
          <Markdown source={audit.markdown} />
          {audit.sources.length > 0 && (
            <View style={{ marginTop: 20 }}>
              <Text style={{ color: p.text, fontWeight: '800', fontSize: 16, marginBottom: 6 }}>Sources Claude researched</Text>
              {audit.sources.map((s) => (
                <Text key={s.url} onPress={() => Linking.openURL(s.url)} style={{ color: p.accent, marginVertical: 3 }} numberOfLines={1}>
                  {s.title || s.url}
                </Text>
              ))}
            </View>
          )}
        </View>
      ) : audit.tech ? (
        Object.entries(byCategory).map(([cat, checks]) => (
          <View key={cat} style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
            <Text style={{ color: p.text, fontWeight: '800', fontSize: 16, marginBottom: 8 }}>
              {cat} · {checks.filter((c) => c.pass).length}/{checks.length}
            </Text>
            {checks
              .slice()
              .sort((a, b) => Number(a.pass) - Number(b.pass) || b.weight - a.weight)
              .map((c) => (
                <View key={c.id} style={styles.checkRow}>
                  <Text style={{ color: c.pass ? p.good : p.bad, fontSize: 16, width: 24 }}>{c.pass ? '✓' : '✗'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: p.text, fontWeight: '600' }}>{c.label}</Text>
                    <Text style={{ color: p.muted, fontSize: 13, marginTop: 2 }}>{c.detail}</Text>
                  </View>
                </View>
              ))}
          </View>
        ))
      ) : (
        <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
          <Text style={{ color: p.muted }}>
            The on-device crawl could not load this site ({audit.crawl.error ?? `HTTP ${audit.crawl.status}`}), so no measured checks are
            available. If you ran this in a web browser, run it from Expo Go on your phone instead; browsers block cross-site requests.
          </Text>
        </View>
      )}

      <Pressable onPress={remove} style={{ alignSelf: 'center', marginTop: 16, padding: 8 }}>
        <Text style={{ color: p.bad, fontWeight: '600' }}>Delete audit</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 12 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-around' },
  scoreCol: { alignItems: 'center' },
  scoreLabel: { fontSize: 12, textAlign: 'center', marginTop: 8, fontWeight: '600' },
  tabs: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: 4, marginBottom: 12 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9 },
  checkRow: { flexDirection: 'row', paddingVertical: 7 },
});

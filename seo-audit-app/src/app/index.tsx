import { Link, router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { GradeBadge } from '@/components/grade-badge';
import { describeError, runAudit } from '@/lib/audit';
import { crawlSite, normalizeUrl } from '@/lib/crawl';
import { scoreCrawl } from '@/lib/score';
import { getApiKey, getModel, listAudits, saveAudit, type SavedAudit } from '@/lib/storage';
import { usePalette } from '@/lib/theme';

const STEPS = ['Fetching homepage', 'Checking robots.txt, sitemap & llms.txt', 'Scoring technical signals', 'Claude is researching & writing the audit'];

export default function HomeScreen() {
  const p = usePalette();
  const [url, setUrl] = useState('');
  const [context, setContext] = useState('');
  const [step, setStep] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [history, setHistory] = useState<SavedAudit[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useFocusEffect(
    useCallback(() => {
      listAudits().then(setHistory);
    }, []),
  );

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const running = step !== null;

  async function start() {
    let target: string;
    try {
      target = normalizeUrl(url);
    } catch {
      Alert.alert('Invalid URL', 'Enter a website like example.com or https://example.com');
      return;
    }
    const apiKey = await getApiKey();
    if (!apiKey) {
      Alert.alert('API key needed', 'Add your Anthropic API key in Settings first.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => router.push('/settings') },
      ]);
      return;
    }

    setElapsed(0);
    const t0 = Date.now();
    timer.current = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    try {
      const model = await getModel();
      const crawl = await crawlSite(target, setStep);
      setStep(STEPS[2]);
      const tech = scoreCrawl(crawl);
      setStep(STEPS[3]);
      const result = await runAudit({ apiKey, model, url: target, context, crawl, tech });
      const audit: SavedAudit = {
        id: `${Date.now()}`,
        url: crawl.finalUrl || target,
        context,
        createdAt: Date.now(),
        model,
        crawl,
        tech,
        ...result,
      };
      await saveAudit(audit);
      setUrl('');
      setContext('');
      router.push({ pathname: '/report/[id]', params: { id: audit.id } });
    } catch (e) {
      Alert.alert('Audit failed', describeError(e));
    } finally {
      if (timer.current) clearInterval(timer.current);
      setStep(null);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/settings" asChild>
              <Pressable hitSlop={12}>
                <Text style={{ color: p.accent, fontSize: 16, fontWeight: '600' }}>Settings</Text>
              </Pressable>
            </Link>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={[styles.hero, { color: p.text }]}>Audit any website in ~2 minutes</Text>
        <Text style={[styles.sub, { color: p.muted }]}>
          Technical crawl + SEO score + AI search (GEO) visibility + a 60-day ranking roadmap, written by Claude.
        </Text>

        <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
          <Text style={[styles.label, { color: p.muted }]}>WEBSITE URL</Text>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="example.com"
            placeholderTextColor={p.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={start}
            editable={!running}
            style={[styles.input, { color: p.text, borderColor: p.border, backgroundColor: p.bg }]}
          />
          <Text style={[styles.label, { color: p.muted, marginTop: 12 }]}>NICHE & TARGET MARKET (OPTIONAL)</Text>
          <TextInput
            value={context}
            onChangeText={setContext}
            placeholder="e.g. We buy houses cash – Newark, NJ"
            placeholderTextColor={p.muted}
            editable={!running}
            style={[styles.input, { color: p.text, borderColor: p.border, backgroundColor: p.bg }]}
          />
          <Pressable
            onPress={start}
            disabled={running || !url.trim()}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: p.accent, opacity: running || !url.trim() ? 0.5 : pressed ? 0.85 : 1 },
            ]}>
            {running ? <ActivityIndicator color={p.accentText} /> : <Text style={[styles.buttonText, { color: p.accentText }]}>Run Audit</Text>}
          </Pressable>

          {running && (
            <View style={{ marginTop: 14 }}>
              {STEPS.map((s) => {
                const idx = STEPS.indexOf(s);
                const cur = STEPS.indexOf(step!);
                const state = idx < cur ? '✓' : idx === cur ? '›' : '·';
                return (
                  <Text key={s} style={{ color: idx === cur ? p.text : p.muted, fontWeight: idx === cur ? '700' : '400', marginVertical: 2 }}>
                    {state} {s}
                  </Text>
                );
              })}
              <Text style={{ color: p.muted, marginTop: 6, fontSize: 12 }}>
                {elapsed}s elapsed · deep audits with web research take 1–4 minutes. Keep the app open.
              </Text>
            </View>
          )}
        </View>

        {history.length > 0 && (
          <>
            <Text style={[styles.section, { color: p.text }]}>Recent audits</Text>
            {history.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => router.push({ pathname: '/report/[id]', params: { id: a.id } })}
                style={({ pressed }) => [styles.historyRow, { backgroundColor: p.card, borderColor: p.border, opacity: pressed ? 0.7 : 1 }]}>
                <GradeBadge grade={a.grade ?? a.tech?.grade ?? null} score={a.score} size={44} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text numberOfLines={1} style={{ color: p.text, fontWeight: '700', fontSize: 15 }}>
                    {a.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </Text>
                  <Text style={{ color: p.muted, fontSize: 12, marginTop: 2 }}>
                    {new Date(a.createdAt).toLocaleString()} · {a.score ?? '–'}/100
                  </Text>
                </View>
                <Text style={{ color: p.muted, fontSize: 20 }}>›</Text>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  hero: { fontSize: 26, fontWeight: '800', marginTop: 8 },
  sub: { fontSize: 15, lineHeight: 21, marginTop: 6, marginBottom: 16 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 },
  button: { marginTop: 16, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
  section: { fontSize: 18, fontWeight: '800', marginTop: 28, marginBottom: 10 },
  historyRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
});

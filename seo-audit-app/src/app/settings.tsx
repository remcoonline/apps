import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { MODELS, type ModelId } from '@/lib/audit';
import { clearAudits, getApiKey, getModel, setApiKey, setModel } from '@/lib/storage';
import { usePalette } from '@/lib/theme';

export default function SettingsScreen() {
  const p = usePalette();
  const [key, setKey] = useState('');
  const [model, setModelState] = useState<ModelId>('claude-opus-5');

  useEffect(() => {
    getApiKey().then(setKey);
    getModel().then(setModelState);
  }, []);

  async function save() {
    await setApiKey(key.trim());
    await setModel(model);
    router.back();
  }

  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
        <Text style={[styles.label, { color: p.muted }]}>ANTHROPIC API KEY</Text>
        <TextInput
          value={key}
          onChangeText={setKey}
          placeholder="sk-ant-..."
          placeholderTextColor={p.muted}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={[styles.input, { color: p.text, borderColor: p.border, backgroundColor: p.bg }]}
        />
        <Text style={{ color: p.muted, fontSize: 12, marginTop: 8 }}>
          Stored in this device&apos;s secure keychain. Get a key at{' '}
          <Text style={{ color: p.accent }} onPress={() => Linking.openURL('https://platform.claude.com/settings/keys')}>
            platform.claude.com
          </Text>
          .
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
        <Text style={[styles.label, { color: p.muted }]}>MODEL</Text>
        {MODELS.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => setModelState(m.id)}
            style={[styles.option, { borderColor: model === m.id ? p.accent : p.border }]}>
            <Text style={{ color: p.text, fontWeight: '700' }}>
              {model === m.id ? '● ' : '○ '}
              {m.label}
            </Text>
            <Text style={{ color: p.muted, fontSize: 12, marginTop: 2 }}>{m.note}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={save} style={[styles.button, { backgroundColor: p.accent }]}>
        <Text style={{ color: p.accentText, fontWeight: '700', fontSize: 16 }}>Save</Text>
      </Pressable>

      <Pressable
        onPress={() =>
          Alert.alert('Clear all saved audits?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: () => clearAudits() },
          ])
        }
        style={{ alignSelf: 'center', marginTop: 20, padding: 8 }}>
        <Text style={{ color: p.bad, fontWeight: '600' }}>Clear audit history</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 },
  option: { borderWidth: 1.5, borderRadius: 10, padding: 12, marginTop: 8 },
  button: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
});

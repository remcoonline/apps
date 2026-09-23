// Persistence: API key in the OS keychain (SecureStore), audit history and
// preferences in AsyncStorage. Everything stays on the device.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { ModelId, Source } from './audit';
import type { CrawlData } from './crawl';
import type { TechScore } from './score';

export type SavedAudit = {
  id: string;
  url: string;
  context: string;
  createdAt: number;
  model: ModelId;
  grade: string | null;
  score: number | null;
  markdown: string;
  sources: Source[];
  crawl: CrawlData;
  tech: TechScore | null;
};

const KEY_NAME = 'anthropic_api_key';
const HISTORY = 'audits_v1';
const MODEL = 'model_v1';
const MAX_HISTORY = 30;

// SecureStore is native-only; fall back to AsyncStorage on web.
export async function getApiKey(): Promise<string> {
  const stored = Platform.OS === 'web' ? await AsyncStorage.getItem(KEY_NAME) : await SecureStore.getItemAsync(KEY_NAME);
  return stored || process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || '';
}

export async function setApiKey(key: string) {
  if (Platform.OS === 'web') await AsyncStorage.setItem(KEY_NAME, key);
  else await SecureStore.setItemAsync(KEY_NAME, key);
}

export async function getModel(): Promise<ModelId> {
  return ((await AsyncStorage.getItem(MODEL)) as ModelId | null) ?? 'claude-opus-5';
}

export const setModel = (m: ModelId) => AsyncStorage.setItem(MODEL, m);

export async function listAudits(): Promise<SavedAudit[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(HISTORY)) ?? '[]');
  } catch {
    return [];
  }
}

export async function getAudit(id: string) {
  return (await listAudits()).find((a) => a.id === id) ?? null;
}

export async function saveAudit(a: SavedAudit) {
  const all = [a, ...(await listAudits()).filter((x) => x.id !== a.id)].slice(0, MAX_HISTORY);
  await AsyncStorage.setItem(HISTORY, JSON.stringify(all));
}

export async function deleteAudit(id: string) {
  await AsyncStorage.setItem(HISTORY, JSON.stringify((await listAudits()).filter((a) => a.id !== id)));
}

export const clearAudits = () => AsyncStorage.removeItem(HISTORY);

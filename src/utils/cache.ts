import { UserProfile } from '../types';

type CacheEntry = {
  value: string;
  timestamp: number;
};

type CacheStore = Record<string, CacheEntry>;

export type CacheFieldContext = {
  label?: string;
  placeholder?: string;
  name?: string;
  id?: string;
};

const STORAGE_KEY = 'fillai_cache';
const MAX_ENTRIES = 100;
const MIN_CACHEABLE_LENGTH = 20;
export const TTL = 24 * 60 * 60 * 1000;

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[-|–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

export function getSimpleKey(fieldType: string, profile: Pick<UserProfile, 'fullName'>): string {
  const normalizedType = normalizeText(fieldType);
  const normalizedName = normalizeText(profile.fullName || '');
  return `simple:${simpleHash(`${normalizedType}|${normalizedName}`)}`;
}

function normalizeFieldContext(value: string | CacheFieldContext): string {
  if (typeof value === 'string') {
    return normalizeText(value);
  }

  const combined = [
    value.label || '',
    value.placeholder || '',
    value.name || '',
    value.id || '',
  ].join(' | ');

  return normalizeText(combined);
}

export function getContextKey(fieldType: string, fieldContext: string | CacheFieldContext = ''): string {
  const normalizedType = normalizeText(fieldType);
  const normalizedHost = normalizeText(window.location.hostname || '');
  const normalizedPageTitle = normalizeTitle(document.title || '');
  const normalizedFieldContext = normalizeFieldContext(fieldContext);

  return `context:${simpleHash(`${normalizedType}|${normalizedHost}|${normalizedPageTitle}|${normalizedFieldContext}`)}`;
}

async function getStore(): Promise<CacheStore> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return {};
  }

  const data = await chrome.storage.local.get(STORAGE_KEY);
  const store = data?.[STORAGE_KEY];
  if (!store || typeof store !== 'object') {
    return {};
  }

  return store as CacheStore;
}

async function saveStore(store: CacheStore): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return;
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: store });
}

export async function getCache(key: string): Promise<string | null> {
  const store = await getStore();
  const entry = store[key];

  if (!entry) {
    console.log('[Cache] MISS:', key);
    return null;
  }

  if (!entry.value || typeof entry.timestamp !== 'number') {
    delete store[key];
    await saveStore(store);
    console.log('[Cache] MISS:', key);
    return null;
  }

  if (Date.now() - entry.timestamp > TTL) {
    delete store[key];
    await saveStore(store);
    console.log('[Cache] MISS:', key);
    return null;
  }

  console.log('[Cache] HIT:', key);
  return entry.value;
}

export async function setCache(
  key: string,
  value: string,
  options?: { bypassMinLength?: boolean }
): Promise<void> {
  const trimmedValue = value.trim();
  if (!trimmedValue) return;
  const bypassMinLength = options?.bypassMinLength === true;
  if (!bypassMinLength && trimmedValue.length < MIN_CACHEABLE_LENGTH) return;

  const store = await getStore();
  store[key] = {
    value: trimmedValue,
    timestamp: Date.now(),
  };

  const entries = Object.entries(store);
  if (entries.length > MAX_ENTRIES) {
    entries
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, entries.length - MAX_ENTRIES)
      .forEach(([oldestKey]) => {
        delete store[oldestKey];
      });
  }

  await saveStore(store);
}

export async function clearCache(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return;
  }

  await chrome.storage.local.remove(STORAGE_KEY);
}
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

class LocalStorageAdapter implements StorageAdapter {
  async get(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }
  async set(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  }
  async remove(key: string): Promise<void> {
    localStorage.removeItem(key);
  }
  async clear(): Promise<void> {
    localStorage.clear();
  }
}

class CapacitorStorageAdapter implements StorageAdapter {
  async get(key: string): Promise<string | null> {
    const { value } = await Preferences.get({ key });
    return value;
  }
  async set(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  }
  async remove(key: string): Promise<void> {
    await Preferences.remove({ key });
  }
  async clear(): Promise<void> {
    await Preferences.clear();
  }
}

const isNative = Capacitor.isNativePlatform();
const adapter: StorageAdapter = isNative ? new CapacitorStorageAdapter() : new LocalStorageAdapter();

export const storageService = {
  async getItem<T>(key: string, fallback: T): Promise<T> {
    const val = await adapter.get(key);
    if (val === null) return fallback;
    try {
      // Try to parse as JSON, but if it's just a string, return as is
      return JSON.parse(val) as T;
    } catch {
      return val as unknown as T;
    }
  },
  async setItem(key: string, value: any): Promise<void> {
    const stringified = typeof value === 'string' ? value : JSON.stringify(value);
    await adapter.set(key, stringified);
  },
  async removeItem(key: string): Promise<void> {
    await adapter.remove(key);
  }
};

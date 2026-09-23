/* Jest setup: in-memory stand-ins for native modules that have no JS implementation. */
import mockNetInfo from '@react-native-community/netinfo/jest/netinfo-mock.js';

jest.mock('@react-native-community/netinfo', () => mockNetInfo);

jest.mock('react-native-mmkv', () => {
  const stores = new Map<string, Map<string, string>>();
  return {
    createMMKV: ({ id = 'default' }: { id?: string } = {}) => {
      if (!stores.has(id)) stores.set(id, new Map());
      const map = stores.get(id)!;
      return {
        id,
        getString: (k: string) => map.get(k),
        set: (k: string, v: string) => void map.set(k, String(v)),
        remove: (k: string) => map.delete(k),
        clearAll: () => map.clear(),
        getAllKeys: () => Array.from(map.keys()),
        contains: (k: string) => map.has(k),
      };
    },
  };
});

// expo-sqlite/kv-store: synchronous SQLite key-value store (the Expo Go storage fallback).
jest.mock('expo-sqlite/kv-store', () => {
  class SQLiteStorage {
    private static dbs = new Map<string, Map<string, string>>();
    private map: Map<string, string>;
    constructor(name: string) {
      if (!SQLiteStorage.dbs.has(name)) SQLiteStorage.dbs.set(name, new Map());
      this.map = SQLiteStorage.dbs.get(name)!;
    }
    getItemSync(k: string) {
      return this.map.get(k) ?? null;
    }
    setItemSync(k: string, v: string) {
      this.map.set(k, v);
    }
    removeItemSync(k: string) {
      return this.map.delete(k);
    }
    getAllKeysSync() {
      return [...this.map.keys()];
    }
    clearSync() {
      this.map.clear();
      return true;
    }
  }
  return { SQLiteStorage, default: new SQLiteStorage('ExpoSQLiteStorage') };
});

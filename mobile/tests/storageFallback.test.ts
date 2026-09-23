/* eslint-disable @typescript-eslint/no-require-imports -- jest.isolateModules needs require() to load fresh module instances */
/** Expo Go has no Nitro modules, so MMKV throws; storage must fall back to the SQLite kv-store. */
describe('storage engine selection', () => {
  it('uses MMKV when available', () => {
    jest.isolateModules(() => {
      const { StorageRepository } = require('../src/storage/storageRepository');
      expect(new StorageRepository().getEngine()).toBe('mmkv');
    });
  });

  it('falls back to the persistent SQLite kv-store when MMKV is unavailable (Expo Go)', () => {
    jest.isolateModules(() => {
      jest.doMock('react-native-mmkv', () => ({
        createMMKV: () => {
          throw new Error('NitroModules are not supported in Expo Go');
        },
      }));
      const { StorageRepository } = require('../src/storage/storageRepository');
      const first = new StorageRepository();
      expect(first.getEngine()).toBe('sqlite');
      expect(first.isPersistent()).toBe(true);
      first.setFavorites(['XRPUSDT']);
      expect(new StorageRepository().getFavorites()).toEqual(['XRPUSDT']);
    });
  });

  it('falls back to memory only when no persistent engine works', () => {
    jest.isolateModules(() => {
      jest.doMock('react-native-mmkv', () => ({
        createMMKV: () => {
          throw new Error('unavailable');
        },
      }));
      jest.doMock('expo-sqlite/kv-store', () => ({
        SQLiteStorage: class {
          getAllKeysSync(): string[] {
            throw new Error('unavailable');
          }
        },
      }));
      const { StorageRepository } = require('../src/storage/storageRepository');
      const s = new StorageRepository();
      expect(s.getEngine()).toBe('memory');
      expect(s.getStorageStats().isPersistent).toBe(false);
    });
  });
});

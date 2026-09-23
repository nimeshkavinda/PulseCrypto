import { StorageEngine } from './storageRepository';

export const STORAGE_ENGINE_LABEL: Record<StorageEngine, string> = {
  mmkv: 'MMKV (persistent)',
  sqlite: 'SQLite (persistent, Expo Go)',
  memory: 'In-memory (not persisted)',
};

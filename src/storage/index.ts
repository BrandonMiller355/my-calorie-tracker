import { IndexedDbRepository, openCalTrackerDb } from './IndexedDbRepository';
import { InMemoryRepository } from './InMemoryRepository';
import type { StorageRepository } from './StorageRepository';

export type { StorageRepository } from './StorageRepository';
export { IndexedDbRepository } from './IndexedDbRepository';
export { InMemoryRepository } from './InMemoryRepository';

export interface RepositoryHandle {
  repository: StorageRepository;
  /** false means data will not survive a reload (in-memory fallback). */
  persistent: boolean;
}

/** Open IndexedDB, falling back to in-memory storage when unavailable. */
export async function createRepository(): Promise<RepositoryHandle> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('indexedDB not defined');
    const db = await openCalTrackerDb();
    return { repository: new IndexedDbRepository(db), persistent: true };
  } catch (err) {
    console.warn('IndexedDB unavailable, using in-memory storage', err);
    return { repository: new InMemoryRepository(), persistent: false };
  }
}

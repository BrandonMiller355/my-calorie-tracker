import { supabase } from '../lib/supabase';
import { SupabaseRepository } from './SupabaseRepository';
import type { StorageRepository } from './StorageRepository';

export type { StorageRepository } from './StorageRepository';
export { SupabaseRepository } from './SupabaseRepository';

/** Repository for the signed-in user; RLS scopes all rows server-side. */
export function createRepository(): StorageRepository {
  return new SupabaseRepository(supabase);
}

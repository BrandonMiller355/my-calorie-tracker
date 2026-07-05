import type { SupabaseClient } from '@supabase/supabase-js';
import type { FoodEntry, Goals, Meal } from '../types';
import type { StorageRepository } from './StorageRepository';

/** Row shape of the food_entries table (snake_case, per supabase/schema.sql). */
interface FoodEntryRow {
  id: string;
  date: string;
  meal: Meal;
  name: string;
  serving_desc: string | null;
  quantity: number;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  source: FoodEntry['source'];
}

function toRow(entry: FoodEntry): FoodEntryRow {
  return {
    id: entry.id,
    date: entry.date,
    meal: entry.meal,
    name: entry.name,
    serving_desc: entry.servingDesc ?? null,
    quantity: entry.quantity,
    calories: entry.calories,
    carbs: entry.carbs,
    protein: entry.protein,
    fat: entry.fat,
    source: entry.source,
  };
}

function fromRow(row: FoodEntryRow): FoodEntry {
  return {
    id: row.id,
    date: row.date,
    meal: row.meal,
    name: row.name,
    servingDesc: row.serving_desc ?? undefined,
    quantity: row.quantity,
    calories: row.calories,
    carbs: row.carbs,
    protein: row.protein,
    fat: row.fat,
    source: row.source,
  };
}

/**
 * Persistence against Supabase Postgres. Rows are scoped to the signed-in
 * user by RLS, and user_id is filled in server-side (default auth.uid()),
 * so no user filtering happens client-side.
 */
export class SupabaseRepository implements StorageRepository {
  constructor(private client: SupabaseClient) {}

  async getEntriesByDate(date: string): Promise<FoodEntry[]> {
    const { data, error } = await this.client.from('food_entries').select('*').eq('date', date);
    if (error) throw new Error(`Loading entries failed: ${error.message}`);
    return ((data ?? []) as FoodEntryRow[]).map(fromRow);
  }

  async addEntry(entry: FoodEntry): Promise<void> {
    const { error } = await this.client.from('food_entries').insert(toRow(entry));
    if (error) throw new Error(`Adding entry failed: ${error.message}`);
  }

  async updateEntry(entry: FoodEntry): Promise<void> {
    const { id, ...row } = toRow(entry);
    const { error } = await this.client.from('food_entries').update(row).eq('id', id);
    if (error) throw new Error(`Updating entry failed: ${error.message}`);
  }

  async deleteEntry(id: string): Promise<void> {
    const { error } = await this.client.from('food_entries').delete().eq('id', id);
    if (error) throw new Error(`Deleting entry failed: ${error.message}`);
  }

  async getGoals(): Promise<Goals | null> {
    const { data, error } = await this.client
      .from('goals')
      .select('calories, carbs, protein, fat')
      .maybeSingle();
    if (error) throw new Error(`Loading goals failed: ${error.message}`);
    return data as Goals | null;
  }

  async saveGoals(goals: Goals): Promise<void> {
    // user_id defaults to auth.uid() server-side; the conflict on the goals
    // primary key (user_id) turns repeat saves into updates.
    const { error } = await this.client.from('goals').upsert(goals);
    if (error) throw new Error(`Saving goals failed: ${error.message}`);
  }
}

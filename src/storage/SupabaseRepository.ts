import type { SupabaseClient } from '@supabase/supabase-js';
import type { FoodEntry, Goals, LibraryFood, Meal, MealSuggestions } from '../types';
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
  food_id: string | null;
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
    food_id: entry.foodId ?? null,
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
    foodId: row.food_id ?? undefined,
  };
}

/** Row shape of the foods table; also what meal_suggestions() returns per food. */
interface FoodRow {
  id: string;
  name: string;
  description: string | null;
  serving_desc: string | null;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  source: LibraryFood['source'];
}

function toFoodRow(food: LibraryFood): FoodRow {
  return {
    id: food.id,
    name: food.name,
    description: food.description ?? null,
    serving_desc: food.servingDesc ?? null,
    calories: food.calories,
    carbs: food.carbs,
    protein: food.protein,
    fat: food.fat,
    source: food.source,
  };
}

function fromFoodRow(row: FoodRow): LibraryFood {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    servingDesc: row.serving_desc ?? undefined,
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

  async getDefaultGoals(): Promise<Goals | null> {
    const { data, error } = await this.client
      .from('goals')
      .select('calories, carbs, protein, fat')
      .maybeSingle();
    if (error) throw new Error(`Loading goals failed: ${error.message}`);
    return data as Goals | null;
  }

  async saveDefaultGoals(goals: Goals): Promise<void> {
    // user_id defaults to auth.uid() server-side; the conflict on the goals
    // primary key (user_id) turns repeat saves into updates.
    const { error } = await this.client.from('goals').upsert(goals);
    if (error) throw new Error(`Saving goals failed: ${error.message}`);
  }

  async getGoalsForDate(date: string): Promise<Goals | null> {
    const { data, error } = await this.client
      .from('daily_goals')
      .select('calories, carbs, protein, fat')
      .eq('date', date)
      .maybeSingle();
    if (error) throw new Error(`Loading day goals failed: ${error.message}`);
    return data as Goals | null;
  }

  async saveGoalsForDate(date: string, goals: Goals): Promise<void> {
    // user_id defaults to auth.uid() server-side; the conflict on the
    // daily_goals primary key (user_id, date) turns repeat saves into updates.
    const { error } = await this.client.from('daily_goals').upsert({ ...goals, date });
    if (error) throw new Error(`Saving day goals failed: ${error.message}`);
  }

  async clearGoalsForDate(date: string): Promise<void> {
    const { error } = await this.client.from('daily_goals').delete().eq('date', date);
    if (error) throw new Error(`Clearing day goals failed: ${error.message}`);
  }

  async getFoods(): Promise<LibraryFood[]> {
    const { data, error } = await this.client.from('foods').select('*').is('archived_at', null);
    if (error) throw new Error(`Loading food library failed: ${error.message}`);
    return ((data ?? []) as FoodRow[]).map(fromFoodRow);
  }

  async addFood(food: LibraryFood): Promise<void> {
    const { error } = await this.client.from('foods').insert(toFoodRow(food));
    if (error) throw new Error(`Saving food failed: ${error.message}`);
  }

  async updateFood(food: LibraryFood): Promise<void> {
    const { id, ...row } = toFoodRow(food);
    const { error } = await this.client.from('foods').update(row).eq('id', id);
    if (error) throw new Error(`Updating food failed: ${error.message}`);
  }

  async archiveFood(id: string): Promise<void> {
    const { error } = await this.client
      .from('foods')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(`Archiving food failed: ${error.message}`);
  }

  async getMealSuggestions(meal: Meal): Promise<MealSuggestions> {
    const { data, error } = await this.client.rpc('meal_suggestions', { p_meal: meal });
    if (error) throw new Error(`Loading suggestions failed: ${error.message}`);
    const rows = (data ?? []) as (FoodRow & { suggestion_group: 'recent' | 'most_used' })[];
    return {
      recent: rows.filter((r) => r.suggestion_group === 'recent').map(fromFoodRow),
      mostUsed: rows.filter((r) => r.suggestion_group === 'most_used').map(fromFoodRow),
    };
  }
}

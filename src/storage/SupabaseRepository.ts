import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_GOALS,
  type FoodEntry,
  type Goals,
  type LibraryFood,
  type Meal,
  type MealSuggestions,
  type MeasureUnit,
  type ServingAnchor,
  type WeekDeficitDay,
} from '../types';
import type { StorageRepository } from './StorageRepository';

/** Serving anchor columns shared by food_entries and foods rows. */
interface AnchorColumns {
  serving_label: string;
  serving_size_amount: number | null;
  serving_size_unit: MeasureUnit | null;
}

function toAnchorColumns(anchor: ServingAnchor): AnchorColumns {
  return {
    serving_label: anchor.servingLabel,
    serving_size_amount: anchor.servingSize?.amount ?? null,
    serving_size_unit: anchor.servingSize?.unit ?? null,
  };
}

function fromAnchorColumns(row: AnchorColumns): ServingAnchor {
  return {
    servingLabel: row.serving_label,
    servingSize:
      row.serving_size_amount !== null && row.serving_size_unit !== null
        ? { amount: row.serving_size_amount, unit: row.serving_size_unit }
        : undefined,
  };
}

/** Row shape of the food_entries table (snake_case, per supabase/schema.sql). */
interface FoodEntryRow extends AnchorColumns {
  id: string;
  date: string;
  meal: Meal;
  name: string;
  amount: number;
  unit: string;
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
    amount: entry.amount,
    unit: entry.unit,
    ...toAnchorColumns(entry),
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
    amount: row.amount,
    unit: row.unit,
    ...fromAnchorColumns(row),
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
interface FoodRow extends AnchorColumns {
  id: string;
  name: string;
  description: string | null;
  recipe: string | null;
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
    recipe: food.recipe ?? null,
    ...toAnchorColumns(food),
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
    recipe: row.recipe ?? undefined,
    ...fromAnchorColumns(row),
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

  async getWeekDeficitSummary(from: string, through: string): Promise<WeekDeficitDay[]> {
    const { data, error } = await this.client.rpc('week_deficit_summary', {
      p_from: from,
      p_through: through,
    });
    if (error) throw new Error(`Loading weekly deficit summary failed: ${error.message}`);
    const rows = (data ?? []) as {
      date: string;
      consumed_calories: number;
      effective_goal_calories: number;
      has_entries: boolean;
    }[];
    return rows.map((row) => ({
      date: row.date,
      consumedCalories: row.consumed_calories,
      effectiveGoalCalories: row.effective_goal_calories,
      hasEntries: row.has_entries,
    }));
  }

  async getWeeklyDeficitGoal(): Promise<number | null> {
    const { data, error } = await this.client
      .from('goals')
      .select('weekly_deficit_goal')
      .maybeSingle();
    if (error) throw new Error(`Loading weekly deficit goal failed: ${error.message}`);
    return (data as { weekly_deficit_goal: number | null } | null)?.weekly_deficit_goal ?? null;
  }

  async saveWeeklyDeficitGoal(goal: number): Promise<void> {
    // The goals row may not exist yet (user has never saved default goals), so
    // the other columns are re-read and carried through the upsert to avoid
    // clobbering them with placeholder values.
    const { data: existing, error: selectError } = await this.client
      .from('goals')
      .select('calories, carbs, protein, fat')
      .maybeSingle();
    if (selectError) throw new Error(`Saving weekly deficit goal failed: ${selectError.message}`);
    const base = (existing as Goals | null) ?? DEFAULT_GOALS;
    const { error } = await this.client.from('goals').upsert({ ...base, weekly_deficit_goal: goal });
    if (error) throw new Error(`Saving weekly deficit goal failed: ${error.message}`);
  }
}

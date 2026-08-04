import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_GOALS,
  type DayGoalOverride,
  type FoodEntry,
  type Goals,
  type LibraryFood,
  type Meal,
  type MealComponent,
  type MealSuggestions,
  type MeasureUnit,
  type SavedMeal,
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
  description: string | null;
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
    description: entry.description ?? null,
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
    description: row.description ?? undefined,
  };
}

/** Private Storage bucket holding one downscaled JPEG per food. */
const FOOD_IMAGE_BUCKET = 'food-images';
/** Signed-URL lifetime for displaying a food photo, in seconds. */
const FOOD_IMAGE_URL_TTL = 60 * 60;

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
  image_path: string | null;
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
    image_path: food.imagePath ?? null,
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
    imagePath: row.image_path ?? undefined,
  };
}

/**
 * Row shape of the saved_meals table. Components are stored as an opaque JSON
 * array in the `items` column, so they round-trip in their app-side camelCase
 * shape without a per-key mapping.
 */
interface SavedMealRow {
  id: string;
  name: string;
  items: MealComponent[];
}

function toMealRow(meal: SavedMeal): SavedMealRow {
  return { id: meal.id, name: meal.name, items: meal.items };
}

function fromMealRow(row: SavedMealRow): SavedMeal {
  return { id: row.id, name: row.name, items: row.items };
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

  async getGoalsForDate(date: string): Promise<DayGoalOverride | null> {
    const { data, error } = await this.client
      .from('daily_goals')
      .select('calories, carbs, protein, fat')
      .eq('date', date)
      .maybeSingle();
    if (error) throw new Error(`Loading day goals failed: ${error.message}`);
    return data as DayGoalOverride | null;
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

  /** The signed-in user's id, used as the owner segment of image object keys. */
  private async userId(): Promise<string> {
    const { data, error } = await this.client.auth.getUser();
    if (error || !data.user) throw new Error('Not signed in');
    return data.user.id;
  }

  /** Owner-scoped object key for a food's photo: `${uid}/${foodId}.jpg`. */
  private async imageKey(foodId: string): Promise<string> {
    return `${await this.userId()}/${foodId}.jpg`;
  }

  async uploadFoodImage(foodId: string, blob: Blob): Promise<string> {
    const path = await this.imageKey(foodId);
    // upsert so replacing a photo overwrites the single object for this food.
    const { error: uploadError } = await this.client.storage
      .from(FOOD_IMAGE_BUCKET)
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    if (uploadError) throw new Error(`Uploading food image failed: ${uploadError.message}`);
    const { error } = await this.client.from('foods').update({ image_path: path }).eq('id', foodId);
    if (error) throw new Error(`Saving food image reference failed: ${error.message}`);
    return path;
  }

  async removeFoodImage(foodId: string): Promise<void> {
    const path = await this.imageKey(foodId);
    const { error: removeError } = await this.client.storage
      .from(FOOD_IMAGE_BUCKET)
      .remove([path]);
    if (removeError) throw new Error(`Removing food image failed: ${removeError.message}`);
    const { error } = await this.client.from('foods').update({ image_path: null }).eq('id', foodId);
    if (error) throw new Error(`Clearing food image reference failed: ${error.message}`);
  }

  async getFoodImageUrl(path: string): Promise<string> {
    const { data, error } = await this.client.storage
      .from(FOOD_IMAGE_BUCKET)
      .createSignedUrl(path, FOOD_IMAGE_URL_TTL);
    if (error || !data) throw new Error(`Signing food image URL failed: ${error?.message ?? 'no url'}`);
    return data.signedUrl;
  }

  async getMeals(): Promise<SavedMeal[]> {
    const { data, error } = await this.client
      .from('saved_meals')
      .select('id, name, items')
      .is('archived_at', null);
    if (error) throw new Error(`Loading meals failed: ${error.message}`);
    return ((data ?? []) as SavedMealRow[]).map(fromMealRow);
  }

  async addMeal(meal: SavedMeal): Promise<void> {
    const { error } = await this.client.from('saved_meals').insert(toMealRow(meal));
    if (error) throw new Error(`Saving meal failed: ${error.message}`);
  }

  async updateMeal(meal: SavedMeal): Promise<void> {
    const { id, ...row } = toMealRow(meal);
    const { error } = await this.client.from('saved_meals').update(row).eq('id', id);
    if (error) throw new Error(`Updating meal failed: ${error.message}`);
  }

  async archiveMeal(id: string): Promise<void> {
    const { error } = await this.client
      .from('saved_meals')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(`Archiving meal failed: ${error.message}`);
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

  async getFoodLastUsed(): Promise<Record<string, string>> {
    const { data, error } = await this.client.rpc('food_last_used');
    if (error) throw new Error(`Loading food usage failed: ${error.message}`);
    const rows = (data ?? []) as { food_id: string; last_date: string }[];
    return Object.fromEntries(rows.map((r) => [r.food_id, r.last_date]));
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

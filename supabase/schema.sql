-- cal-tracker database schema.
-- Source of truth for the Supabase project; apply via the dashboard SQL editor.
-- The app connects with the publishable key, so RLS below is the security
-- boundary: every row is owned by a user and only that user can touch it.

create table food_entries (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Local calendar date as YYYY-MM-DD text (not a Postgres date) to match the
  -- app's timezone-safe date convention.
  date text not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snacks')),
  name text not null,
  -- What the user logged: an amount in either a measure unit or the entry's
  -- own serving label. The serving anchor (label + optional equivalence) is
  -- snapshotted per entry so history never depends on the foods table.
  amount numeric not null,
  unit text not null,
  serving_label text not null default 'serving',
  serving_size_amount numeric,
  serving_size_unit text,
  -- Serving multiplier derived from amount+unit at save; nutrition is per serving.
  quantity numeric not null default 1,
  calories numeric not null,
  carbs numeric not null,
  protein numeric not null,
  fat numeric not null,
  source text not null check (source in ('manual', 'search')),
  check (serving_size_unit is null or serving_size_unit in
    ('g', 'oz', 'lb', 'kg', 'ml', 'floz', 'cup', 'tbsp', 'tsp')),
  check ((serving_size_amount is null) = (serving_size_unit is null)),
  check (serving_size_amount is null or serving_size_amount > 0),
  -- The logged unit is either a measure unit or exactly this row's label.
  check (unit in ('g', 'oz', 'lb', 'kg', 'ml', 'floz', 'cup', 'tbsp', 'tsp')
    or unit = serving_label)
);

create index food_entries_user_date on food_entries (user_id, date);

create table goals (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  calories numeric not null,
  carbs numeric not null,
  protein numeric not null,
  fat numeric not null,
  -- Target weekly calorie deficit (kcal); null means the user hasn't set one.
  -- Unlike the other columns this has no per-day override — it's a single
  -- current value applied uniformly to any week viewed, past or present.
  weekly_deficit_goal numeric
);

-- Per-day overrides of the default in `goals`. A date with no row here falls
-- back to the default.
create table daily_goals (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date text not null,
  calories numeric not null,
  carbs numeric not null,
  protein numeric not null,
  fat numeric not null,
  primary key (user_id, date)
);

alter table food_entries enable row level security;
alter table goals enable row level security;
alter table daily_goals enable row level security;

create policy "own entries select" on food_entries
  for select using (user_id = auth.uid());
create policy "own entries insert" on food_entries
  for insert with check (user_id = auth.uid());
create policy "own entries update" on food_entries
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own entries delete" on food_entries
  for delete using (user_id = auth.uid());

create policy "own goals select" on goals
  for select using (user_id = auth.uid());
create policy "own goals insert" on goals
  for insert with check (user_id = auth.uid());
create policy "own goals update" on goals
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own goals delete" on goals
  for delete using (user_id = auth.uid());

create policy "own daily goals select" on daily_goals
  for select using (user_id = auth.uid());
create policy "own daily goals insert" on daily_goals
  for insert with check (user_id = auth.uid());
create policy "own daily goals update" on daily_goals
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own daily goals delete" on daily_goals
  for delete using (user_id = auth.uid());

-- Personal food library. One row per distinct food name per user; entries
-- reference these for provenance but keep their own copies of nutrition
-- values, so editing a food never rewrites logged history.
create table foods (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  -- Brand, prep notes, weights, e.g. "15g jelly, 16g pbfit, 2 sara lee slices"
  description text,
  -- Serving anchor: nutrition is per one `serving_label` (e.g. "serving",
  -- "can (drained)"); the optional equivalence states what one count equals
  -- and unlocks logging in same-dimension measure units.
  serving_label text not null default 'serving',
  serving_size_amount numeric,
  serving_size_unit text,
  -- Per single serving
  calories numeric not null,
  carbs numeric not null,
  protein numeric not null,
  fat numeric not null,
  source text not null check (source in ('manual', 'search')),
  created_at timestamptz not null default now(),
  -- Archived foods are hidden from suggestions and search but never deleted,
  -- so old entries keep a valid reference.
  archived_at timestamptz,
  check (serving_size_unit is null or serving_size_unit in
    ('g', 'oz', 'lb', 'kg', 'ml', 'floz', 'cup', 'tbsp', 'tsp')),
  check ((serving_size_amount is null) = (serving_size_unit is null)),
  check (serving_size_amount is null or serving_size_amount > 0)
);

-- The dedup key: logging the same name twice resolves to one library row,
-- and makes any future import idempotent.
create unique index foods_user_name on foods (user_id, lower(trim(name)));

alter table food_entries add column food_id uuid references foods (id);

alter table foods enable row level security;

create policy "own foods select" on foods
  for select using (user_id = auth.uid());
create policy "own foods insert" on foods
  for insert with check (user_id = auth.uid());
create policy "own foods update" on foods
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own foods delete" on foods
  for delete using (user_id = auth.uid());

-- Free-text prep instructions, e.g. "Boil water... 53g powder... 7g salt...".
-- Never snapshotted onto food_entries. (Description is likewise never
-- snapshotted from a food; the later food_entries.description column is
-- written only by quick calories-only entries.)
alter table foods add column recipe text;

-- Name-field suggestions: up to 5 foods most recently logged for the meal,
-- then up to 5 most often logged for it, deduped across the two groups and
-- excluding archived foods. security invoker (the default), so RLS on both
-- tables scopes everything to the calling user. `date` is YYYY-MM-DD text,
-- which sorts correctly lexicographically.
create function meal_suggestions(p_meal text)
returns table (
  id uuid,
  name text,
  description text,
  recipe text,
  serving_label text,
  serving_size_amount numeric,
  serving_size_unit text,
  calories numeric,
  carbs numeric,
  protein numeric,
  fat numeric,
  source text,
  suggestion_group text
)
language sql
stable
as $$
  with meal_foods as (
    select e.food_id, max(e.date) as last_date, count(*) as times_logged
    from food_entries e
    join foods f on f.id = e.food_id
    where e.meal = p_meal and f.archived_at is null
    group by e.food_id
  ),
  recent as (
    select food_id, row_number() over (order by last_date desc) as ord
    from meal_foods
    order by last_date desc
    limit 5
  ),
  most_used as (
    select food_id,
      row_number() over (order by times_logged desc, last_date desc) as ord
    from meal_foods
    where food_id not in (select food_id from recent)
    order by times_logged desc, last_date desc
    limit 5
  ),
  ranked as (
    select food_id, 'recent' as suggestion_group, ord from recent
    union all
    select food_id, 'most_used' as suggestion_group, ord from most_used
  )
  select f.id, f.name, f.description, f.recipe,
    f.serving_label, f.serving_size_amount, f.serving_size_unit,
    f.calories, f.carbs, f.protein, f.fat, f.source, r.suggestion_group
  from ranked r
  join foods f on f.id = r.food_id
  order by case r.suggestion_group when 'recent' then 0 else 1 end, r.ord;
$$;

-- Per-date consumed calories, effective calorie-burn goal (daily_goals
-- override falling back to the default goals row), and whether any entries
-- exist, for the weekly deficit widget. security invoker (the default), so
-- RLS on all three tables scopes everything to the calling user. `p_from`/
-- `p_through` are inclusive YYYY-MM-DD text bounds; the date series is
-- generated server-side so the widget is a single round trip regardless of
-- range length.
create function week_deficit_summary(p_from text, p_through text)
returns table (
  date text,
  consumed_calories numeric,
  effective_goal_calories numeric,
  has_entries boolean
)
language sql
stable
as $$
  with days as (
    select generate_series(p_from::date, p_through::date, interval '1 day')::date::text as date
  ),
  consumed as (
    select e.date, sum(e.calories * e.quantity) as total
    from food_entries e
    where e.date between p_from and p_through
    group by e.date
  )
  select d.date,
    coalesce(c.total, 0) as consumed_calories,
    coalesce(dg.calories, g.calories) as effective_goal_calories,
    c.date is not null as has_entries
  from days d
  left join consumed c on c.date = d.date
  left join daily_goals dg on dg.date = d.date
  left join goals g on true
  order by d.date;
$$;

-- Quick calories-only entries (source 'quick'): logged without naming a food
-- and never captured, matched, or linked to the library. Unlike normal
-- entries, their free-text description is stored on the entry itself.
-- Run in the dashboard BEFORE deploying app code that saves quick entries.
alter table food_entries add column description text;
alter table food_entries drop constraint food_entries_source_check;
alter table food_entries add constraint food_entries_source_check
  check (source in ('manual', 'search', 'quick'));

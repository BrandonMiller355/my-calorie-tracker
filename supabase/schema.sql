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
  serving_desc text,
  quantity numeric not null default 1,
  calories numeric not null,
  carbs numeric not null,
  protein numeric not null,
  fat numeric not null,
  source text not null check (source in ('manual', 'search'))
);

create index food_entries_user_date on food_entries (user_id, date);

create table goals (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  calories numeric not null,
  carbs numeric not null,
  protein numeric not null,
  fat numeric not null
);

alter table food_entries enable row level security;
alter table goals enable row level security;

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

-- One-time migration for structured-serving-units.
-- Run in the Supabase SQL editor. Existing food/entry rows are disposable
-- (owner-approved), so they are wiped instead of migrated; goals are kept.

truncate table food_entries, foods;

alter table food_entries
  drop column serving_desc,
  add column amount numeric not null,
  add column unit text not null,
  add column serving_label text not null default 'serving',
  add column serving_size_amount numeric,
  add column serving_size_unit text,
  add constraint food_entries_size_unit_check check (serving_size_unit is null
    or serving_size_unit in ('g', 'oz', 'lb', 'kg', 'ml', 'floz', 'cup', 'tbsp', 'tsp')),
  add constraint food_entries_size_pair_check
    check ((serving_size_amount is null) = (serving_size_unit is null)),
  add constraint food_entries_size_amount_check
    check (serving_size_amount is null or serving_size_amount > 0),
  add constraint food_entries_unit_check
    check (unit in ('g', 'oz', 'lb', 'kg', 'ml', 'floz', 'cup', 'tbsp', 'tsp')
      or unit = serving_label);

alter table foods
  drop column serving_desc,
  add column serving_label text not null default 'serving',
  add column serving_size_amount numeric,
  add column serving_size_unit text,
  add constraint foods_size_unit_check check (serving_size_unit is null
    or serving_size_unit in ('g', 'oz', 'lb', 'kg', 'ml', 'floz', 'cup', 'tbsp', 'tsp')),
  add constraint foods_size_pair_check
    check ((serving_size_amount is null) = (serving_size_unit is null)),
  add constraint foods_size_amount_check
    check (serving_size_amount is null or serving_size_amount > 0);

-- Return type changes, so the function must be dropped before recreating.
drop function meal_suggestions(text);

create function meal_suggestions(p_meal text)
returns table (
  id uuid,
  name text,
  description text,
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
    limit 3
  ),
  most_used as (
    select food_id,
      row_number() over (order by times_logged desc, last_date desc) as ord
    from meal_foods
    where food_id not in (select food_id from recent)
    order by times_logged desc, last_date desc
    limit 3
  ),
  ranked as (
    select food_id, 'recent' as suggestion_group, ord from recent
    union all
    select food_id, 'most_used' as suggestion_group, ord from most_used
  )
  select f.id, f.name, f.description,
    f.serving_label, f.serving_size_amount, f.serving_size_unit,
    f.calories, f.carbs, f.protein, f.fat, f.source, r.suggestion_group
  from ranked r
  join foods f on f.id = r.food_id
  order by case r.suggestion_group when 'recent' then 0 else 1 end, r.ord;
$$;

-- Run once in the Supabase SQL Editor for this project.
-- Additive: imported patients/drugs/interactions tables are not changed or linked.
begin;

create table if not exists public.vediora_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text check (char_length(phone) <= 30),
  date_of_birth date check (date_of_birth >= date '1900-01-01'),
  gender text check (char_length(gender) <= 40),
  blood_group text check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  height_cm numeric check (height_cm > 0 and height_cm <= 300),
  weight_kg numeric check (weight_kg > 0 and weight_kg <= 700),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vediora_profiles enable row level security;
revoke all on public.vediora_profiles from public, anon, authenticated;
grant select on public.vediora_profiles to authenticated;
grant update (full_name, phone, date_of_birth, gender, blood_group, height_cm, weight_kg)
  on public.vediora_profiles to authenticated;

drop policy if exists vediora_read_own_profile on public.vediora_profiles;
create policy vediora_read_own_profile on public.vediora_profiles
  for select to authenticated using ((select auth.uid()) = id);
drop policy if exists vediora_update_own_profile on public.vediora_profiles;
create policy vediora_update_own_profile on public.vediora_profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.vediora_create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.vediora_profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.vediora_create_profile() from public, anon, authenticated;
drop trigger if exists vediora_on_auth_user_created on auth.users;
create trigger vediora_on_auth_user_created after insert on auth.users
  for each row execute function public.vediora_create_profile();

create or replace function public.vediora_touch_profile()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.vediora_touch_profile() from public, anon, authenticated;
drop trigger if exists vediora_profile_updated on public.vediora_profiles;
create trigger vediora_profile_updated before update on public.vediora_profiles
  for each row execute function public.vediora_touch_profile();

-- Provision profiles for existing Supabase Auth users too. Never copy legacy passwords.
insert into public.vediora_profiles (id, full_name)
select id, left(coalesce(raw_user_meta_data ->> 'full_name', ''), 120) from auth.users
on conflict (id) do nothing;

commit;
notify pgrst, 'reload schema';

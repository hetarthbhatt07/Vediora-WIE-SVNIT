-- Additive clinician identity and patient-controlled access workflow.
-- Existing imported clinical tables and rows are not changed or deleted.
begin;

alter table public.vediora_profiles
  add column if not exists account_type text not null default 'patient';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vediora_profiles_account_type_check'
      and conrelid = 'public.vediora_profiles'::regclass
  ) then
    alter table public.vediora_profiles
      add constraint vediora_profiles_account_type_check
      check (account_type in ('patient', 'doctor'));
  end if;
end $$;

create table if not exists public.vediora_doctor_profiles (
  id uuid primary key references public.vediora_profiles(id) on delete cascade,
  license_number text not null check (char_length(license_number) between 2 and 80),
  specialization text check (char_length(specialization) <= 120),
  organization text check (char_length(organization) <= 160),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'verified', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vediora_access_requests (
  id uuid primary key,
  doctor_id uuid not null references public.vediora_doctor_profiles(id) on delete cascade,
  patient_id uuid not null references public.vediora_profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied', 'revoked')),
  request_message text check (char_length(request_message) <= 500),
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  check (doctor_id <> patient_id)
);

create unique index if not exists vediora_one_pending_access_request
  on public.vediora_access_requests (doctor_id, patient_id)
  where status = 'pending';
create index if not exists vediora_access_requests_doctor_status
  on public.vediora_access_requests (doctor_id, status, requested_at desc);
create index if not exists vediora_access_requests_patient_status
  on public.vediora_access_requests (patient_id, status, requested_at desc);

create table if not exists public.vediora_access_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.vediora_access_requests(id) on delete cascade,
  actor_id uuid not null references public.vediora_profiles(id) on delete cascade,
  event_type text not null
    check (event_type in ('requested', 'approved', 'denied', 'revoked', 'profile_viewed')),
  created_at timestamptz not null default now()
);
create index if not exists vediora_access_events_request_time
  on public.vediora_access_events (request_id, created_at desc);

alter table public.vediora_doctor_profiles enable row level security;
alter table public.vediora_access_requests enable row level security;
alter table public.vediora_access_events enable row level security;
revoke all on public.vediora_doctor_profiles from public, anon, authenticated;
revoke all on public.vediora_access_requests from public, anon, authenticated;
revoke all on public.vediora_access_events from public, anon, authenticated;
revoke all on sequence public.vediora_access_events_id_seq from public, anon, authenticated;

create or replace function public.vediora_create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  requested_type text;
begin
  requested_type := case
    when new.raw_user_meta_data ->> 'account_type' = 'doctor' then 'doctor'
    else 'patient'
  end;

  insert into public.vediora_profiles (id, full_name, account_type)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    requested_type
  )
  on conflict (id) do nothing;

  if requested_type = 'doctor' then
    insert into public.vediora_doctor_profiles (
      id, license_number, specialization, organization
    ) values (
      new.id,
      left(coalesce(nullif(new.raw_user_meta_data ->> 'license_number', ''), 'UNVERIFIED'), 80),
      left(nullif(new.raw_user_meta_data ->> 'specialization', ''), 120),
      left(nullif(new.raw_user_meta_data ->> 'organization', ''), 160)
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;
revoke all on function public.vediora_create_profile() from public, anon, authenticated;

create or replace function public.vediora_touch_doctor_profile()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.vediora_touch_doctor_profile() from public, anon, authenticated;
drop trigger if exists vediora_doctor_profile_updated on public.vediora_doctor_profiles;
create trigger vediora_doctor_profile_updated
  before update on public.vediora_doctor_profiles
  for each row execute function public.vediora_touch_doctor_profile();

create or replace function public.vediora_touch_access_request()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.vediora_touch_access_request() from public, anon, authenticated;
drop trigger if exists vediora_access_request_updated on public.vediora_access_requests;
create trigger vediora_access_request_updated
  before update on public.vediora_access_requests
  for each row execute function public.vediora_touch_access_request();

commit;
notify pgrst, 'reload schema';

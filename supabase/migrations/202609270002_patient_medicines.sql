-- Patient-owned medicine list. Additive and history-preserving: application APIs
-- change status to discontinued instead of deleting records.
begin;

create table if not exists public.vediora_patient_medicines (
  id uuid primary key,
  patient_id uuid not null references public.vediora_profiles(id) on delete cascade,
  drug_id integer not null references public.drugs(drug_id),
  medicine_name text not null check (char_length(medicine_name) between 1 and 200),
  dosage text check (char_length(dosage) <= 120),
  frequency text check (char_length(frequency) <= 120),
  notes text check (char_length(notes) <= 500),
  status text not null default 'active' check (status in ('active', 'discontinued')),
  source text not null default 'manual' check (source in ('manual', 'prescription')),
  started_at date,
  ended_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or started_at is null or ended_at >= started_at)
);

create unique index if not exists vediora_one_active_patient_drug
  on public.vediora_patient_medicines (patient_id, drug_id)
  where status = 'active';
create index if not exists vediora_patient_medicines_patient_status
  on public.vediora_patient_medicines (patient_id, status, updated_at desc);

alter table public.vediora_patient_medicines enable row level security;
revoke all on public.vediora_patient_medicines from public, anon, authenticated;

create or replace function public.vediora_touch_patient_medicine()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  if new.status = 'discontinued' and new.ended_at is null then
    new.ended_at = current_date;
  elsif new.status = 'active' then
    new.ended_at = null;
  end if;
  return new;
end;
$$;
revoke all on function public.vediora_touch_patient_medicine() from public, anon, authenticated;
drop trigger if exists vediora_patient_medicine_updated on public.vediora_patient_medicines;
create trigger vediora_patient_medicine_updated
  before update on public.vediora_patient_medicines
  for each row execute function public.vediora_touch_patient_medicine();

commit;
notify pgrst, 'reload schema';

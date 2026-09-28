-- Patient-owned confirmed prescriptions and immutable evidence reports.
-- These tables are additive and do not modify the imported clinical dataset.
begin;

create table if not exists public.vediora_patient_prescriptions (
  id uuid primary key,
  patient_id uuid not null references public.vediora_profiles(id) on delete cascade,
  prescriber_name text check (char_length(prescriber_name) <= 200),
  prescribed_on date,
  source_type text not null default 'manual' check (source_type in ('manual', 'ocr')),
  source_filename text check (char_length(source_filename) <= 255),
  notes text check (char_length(notes) <= 1000),
  status text not null default 'confirmed' check (status in ('draft', 'confirmed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vediora_prescription_items (
  id uuid primary key,
  prescription_id uuid not null references public.vediora_patient_prescriptions(id) on delete cascade,
  drug_id integer not null references public.drugs(drug_id),
  medicine_name text not null check (char_length(medicine_name) between 1 and 200),
  dosage text check (char_length(dosage) <= 120),
  frequency text check (char_length(frequency) <= 120),
  duration text check (char_length(duration) <= 120),
  instructions text check (char_length(instructions) <= 500),
  confirmed_by_patient boolean not null default true,
  added_to_profile boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.vediora_safety_reports (
  id uuid primary key,
  patient_id uuid not null references public.vediora_profiles(id) on delete cascade,
  prescription_id uuid references public.vediora_patient_prescriptions(id) on delete set null,
  version integer not null check (version > 0),
  overall_severity text not null,
  summary text not null check (char_length(summary) between 1 and 2000),
  evidence_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (patient_id, version)
);

create index if not exists vediora_prescriptions_patient_created
  on public.vediora_patient_prescriptions (patient_id, created_at desc);
create index if not exists vediora_prescription_items_prescription
  on public.vediora_prescription_items (prescription_id, created_at);
create index if not exists vediora_safety_reports_patient_version
  on public.vediora_safety_reports (patient_id, version desc);

alter table public.vediora_patient_prescriptions enable row level security;
alter table public.vediora_prescription_items enable row level security;
alter table public.vediora_safety_reports enable row level security;
revoke all on public.vediora_patient_prescriptions from public, anon, authenticated;
revoke all on public.vediora_prescription_items from public, anon, authenticated;
revoke all on public.vediora_safety_reports from public, anon, authenticated;

commit;
notify pgrst, 'reload schema';

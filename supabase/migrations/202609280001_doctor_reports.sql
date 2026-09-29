-- Record report provenance while preserving reports created before this migration.
begin;

alter table public.vediora_safety_reports
  add column if not exists generated_by uuid references public.vediora_profiles(id) on delete set null,
  add column if not exists generator_role text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'vediora_report_generator_role_check'
      and conrelid = 'public.vediora_safety_reports'::regclass
  ) then
    alter table public.vediora_safety_reports
      add constraint vediora_report_generator_role_check
      check (generator_role is null or generator_role in ('patient', 'doctor'));
  end if;
end $$;

create index if not exists vediora_safety_reports_generator
  on public.vediora_safety_reports (generated_by, created_at desc);

commit;
notify pgrst, 'reload schema';

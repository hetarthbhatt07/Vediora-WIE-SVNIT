-- Clinical reference data is queried only by authenticated server routes.
-- The imported dump granted browser roles full write access; remove it.
begin;

revoke all privileges on table public.drugs from anon, authenticated;
revoke all privileges on table public.drug_interactions from anon, authenticated;
revoke all privileges on table public.drug_classes from anon, authenticated;
revoke all privileges on table public.drug_warnings from anon, authenticated;
revoke all privileges on table public.contraindications from anon, authenticated;
revoke all privileges on table public.medical_conditions from anon, authenticated;
revoke all privileges on table public.patient_conditions from anon, authenticated;
revoke all privileges on table public.patients from anon, authenticated;
revoke all privileges on table public.prescription_drugs from anon, authenticated;
revoke all privileges on table public.prescriptions from anon, authenticated;

revoke all privileges on all sequences in schema public from anon, authenticated;

commit;
notify pgrst, 'reload schema';

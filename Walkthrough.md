# Vediora connected demo walkthrough

This walkthrough demonstrates the functionality connected to Supabase and local Ollama on the `final-project-kunj` branch. It does not present prototype-only OCR, condition rules, or administrator pages as completed features.

## Prepare the local environment

Complete the setup in [README.md](README.md) before the demonstration:

1. Install dependencies with `bun install`.
2. Configure `.env.local` from `.env.example`.
3. Apply all SQL files in `supabase/migrations` in filename order.
4. Import the `drugs` and `drug_interactions` clinical tables.
5. Start Ollama with `mistral-nemo:12b` available.
6. Start the application with `bun run dev`.

Create one patient account and one doctor account through `/signup`. Confirm both email addresses before signing in. Do not place account credentials in source files or documentation.

For a local video demonstration, `scripts/seed-video-demo.ts` can add synthetic records to the newest patient and doctor accounts. Review the script and point `DATABASE_URL` at the intended local Supabase project before running it.

## Demonstrate the public landing page

Open `http://localhost:3000`:

- Review the product explanation and connected patient and doctor capabilities.
- Ask the guest preview about `aspirin and warfarin`.
- Explain that imported interaction rows provide the documented finding.
- Explain that a missing database record does not establish safety.
- Open the sign-up or sign-in flow from the header.

## Demonstrate the patient workspace

### 1. Review the dashboard

Open `/patient/dashboard` after signing in as the patient:

- Show live counts for active medicines, prescriptions, reports, and approved doctors.
- Show recent medicines and profile-completion guidance.
- Use the quick actions to open the chat or medicine form.

### 2. Complete the health profile

Open `/patient/profile`:

- Add or update the supported profile fields.
- Save the profile and return to the dashboard.
- Confirm that the updated profile and completion percentage appear without signing in again.

### 3. Maintain the medicine list

Open `/patient/medications`:

- Add a medicine using a name matched to the imported drug catalog.
- Add dose and frequency information.
- Update an existing medicine.
- Discontinue a medicine and show that the history remains available instead of deleting the record.

### 4. Save a confirmed prescription

Open `/patient/prescriptions`:

- Enter one or more catalog-matched medicines manually.
- Review and confirm the details before saving.
- Choose whether the confirmed medicines should update the active medicine list.

Prescription optical character recognition (OCR) is deferred. The connected workflow requires reviewed manual entry.

### 5. Use the medicine safety chat

Open `/patient/chat` and demonstrate one conversation:

1. Ask `What does aspirin do?`.
2. Add `I also take warfarin`.
3. Ask `Explain the interaction in detail`.
4. Start **New chat** and confirm the new conversation does not inherit the previous medicines.
5. Reopen the earlier conversation from **Previous chats**.

Explain the answer boundary:

- The server recognizes medicines against the imported catalog.
- It checks every recognized medicine pair in the interaction database.
- Local Mistral explains the retrieved evidence and general medicine information.
- The application constructs documented-interaction and missing-coverage sections from database results.

### 6. Generate an evidence report

Open `/patient/reports`:

- Generate a report from the current active medicine profile.
- Review the version number, medicines, documented findings, uncovered pairs, sources, and limitation text.
- Generate another version after changing the medicine list to show that earlier evidence remains preserved.

## Demonstrate doctor consent

### 1. Complete the doctor profile

Sign in as the doctor and open `/doctor/profile`:

- Add professional details and a license identifier.
- Explain that credentials are self-declared and remain unverified until an administrator-verification workflow is built.

### 2. Request patient access

Open `/doctor/dashboard` or `/doctor/patients`:

- Enter the patient account email.
- Add a reason for the request.
- Submit the access request.
- Confirm that the doctor cannot open the patient record before approval.

### 3. Approve the request as the patient

Return to the patient account and open `/patient/access`:

- Review the doctor identity, verification status, and request reason.
- Approve the request.
- Explain that the decision is stored as a consent event.

### 4. Review the approved patient

Return to the doctor account:

- Open `/doctor/patients` and select the approved patient.
- Review the consent-scoped profile and active medicines.
- Open `/doctor/analysis` to check the approved medicine regimen.
- Generate and reopen a doctor evidence report from `/doctor/reports`.
- Use `/doctor/chat` to demonstrate the same database-first assistant available to patients.

### 5. Revoke access

Return to `/patient/access` and revoke the approval. Then retry the patient record from the doctor account. The next server read must be denied because every protected read rechecks active approval.

## Connected architecture to explain

```text
Browser
  -> Next.js pages and authenticated API routes
  -> Supabase Authentication for account identity
  -> Supabase PostgreSQL for profiles, medicines, consent, chats, and reports
  -> imported drugs and drug_interactions for documented findings
  -> loopback Ollama and Mistral for explanations
  -> optional Langfuse traces for workflow observability
```

## Current project boundaries

- OCR and prescription-image storage are not connected
- Condition, allergy, pregnancy, dose, and laboratory rules are not connected
- Administrator authorization and doctor credential verification are not connected
- Interaction coverage depends on the imported dataset
- Local Mistral can be slow and may fall back to a deterministic database answer
- Vediora supports education and clinical review; it does not diagnose or prescribe

## Validate before presenting

Run the checks sequentially:

```bash
bun run typecheck
bun run test
bun run test:e2e
bun run build
```

The latest verified branch result is 18 unit tests, 6 Playwright tests, TypeScript validation, and a successful production build.

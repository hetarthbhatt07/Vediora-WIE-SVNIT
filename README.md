# Vediora — medication safety workspace

Vediora is a Next.js application for patient-owned medication records, database-grounded drug-interaction checks, consent-based doctor access, and local Mistral explanations.

The connected application uses:

- **Next.js 15**, React 18, TypeScript, and Tailwind CSS
- **Supabase Auth** for patient and doctor email accounts
- **Supabase PostgreSQL** for profiles, medicines, access requests, conversations, prescriptions, reports, and imported clinical data
- **Ollama with `mistral-nemo:12b`** on the local machine for medical explanations
- **Langfuse** optionally for LLM tracing
- **Bun** for installation, development, testing, and builds

## Implemented workflows

### Patient workspace

- Email registration, confirmation, login, password recovery, and logout
- Health profile and profile-completion summary
- Active medicine list with history-preserving discontinuation
- Confirmed manual prescription entry
- Versioned evidence reports generated from current medicines
- Medicine and general medical chat with saved conversations
- Patient approval, denial, and revocation of doctor access requests
- Responsive dashboard with synchronized live summaries

### Doctor workspace

- Professional profile
- Patient access requests by account email
- Approved-patient directory and consent-scoped patient views
- Database-grounded clinical medicine review
- Accessible evidence reports while patient consent remains active
- Medicine and general medical chat with saved conversations
- Responsive dashboard with synchronized live summaries

The patient and doctor chat use the same local Mistral workflow. Drug-interaction findings remain tied to imported database records; missing records are shown as uncertainty.

## Current boundary

Prescription OCR is intentionally deferred. The current connected ingestion workflow is manual entry followed by explicit patient confirmation. Legacy admin and experimental analysis pages may still exist in the repository, but they are not part of the connected Supabase workflow.

## Download and run

### Prerequisites

- [Bun](https://bun.sh/) 1.4 or newer
- [Ollama](https://ollama.com/)
- A Supabase project
- PostgreSQL clinical tables named `drugs` and `drug_interactions`

### 1. Clone this branch

```bash
git clone --branch final-project-kunj --single-branch https://github.com/hetarthbhatt07/Vediora-WIE-SVNIT.git
cd Vediora-WIE-SVNIT
```

Alternatively, download the branch ZIP from GitHub, extract it, and open a terminal in the extracted folder.

### 2. Install dependencies

```bash
bun install
```

### 3. Create the local environment file

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

macOS or Linux:

```bash
cp .env.example .env.local
```

Fill these values in `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
DATABASE_URL=postgresql://postgres.your-project:encoded-password@your-pooler-host:5432/postgres

OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=mistral-nemo:12b
OLLAMA_NUM_GPU=0
```

If the database password contains reserved URL characters, percent-encode them in `DATABASE_URL`. Never place a database password or Supabase service-role key in a `NEXT_PUBLIC_*` variable.

Langfuse is optional. To enable traces, also configure:

```dotenv
LANGFUSE_SECRET_KEY=your-secret-key
LANGFUSE_PUBLIC_KEY=your-public-key
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
LANGFUSE_TRACING_ENVIRONMENT=development
```

Local `.env` files are ignored by Git.

### 4. Prepare Supabase

Enable email authentication in Supabase. Import the clinical `drugs` and `drug_interactions` tables before using medicine checks.

Apply every SQL file in `supabase/migrations/` in filename order:

1. `202609260001_patient_profiles.sql`
2. `202609260002_lock_clinical_tables.sql`
3. `202609270001_doctor_consent.sql`
4. `202609270002_patient_medicines.sql`
5. `202609270003_chat_history.sql`
6. `202609270004_prescriptions_reports.sql`
7. `202609280001_doctor_reports.sql`

These migrations add Vediora application tables and access controls. They do not delete imported drug or interaction rows.

### 5. Start local Mistral

```bash
ollama pull mistral-nemo:12b
ollama serve
```

Keep Ollama running while using the chat. Vediora only connects to the configured loopback Ollama endpoint for model generation.

### 6. Start Vediora

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000), create a patient or doctor account, confirm the email, and sign in.

## Production build

```bash
bun run build
bun run start
```

## Validation

```bash
bun run typecheck
bun run test
bun run test:e2e
bun run build
```

The Playwright suite starts an isolated local Supabase-compatible fixture. It does not use production accounts or patient data.

## Project structure

```text
app/
  api/                 Authenticated patient, doctor, and public routes
  patient/             Connected patient workspace
  doctor/              Connected doctor workspace
components/
  patient/             Shared medicine chat and patient UI
  doctor/              Doctor report UI
  navigation/          Navbar, sidebar, and authenticated shells
lib/
  server/              PostgreSQL, account, Ollama, and tracing helpers
  supabase/            Browser and server Supabase clients
supabase/migrations/   Additive application migrations
tests/                 Unit and authenticated Playwright tests
scripts/               Local demo-data helper
```

## Security and medical limits

- Patient and doctor roles come from the authenticated Supabase account and database profile.
- Doctors can read patient data only while an approved access request remains active.
- Patient medicine records are discontinued rather than deleted through the application.
- Database interaction findings are authoritative for the interaction workflow; the model explains them but does not create primary findings.
- A missing interaction record does not prove that a medicine combination is safe.
- Vediora provides educational decision support and does not replace a doctor, pharmacist, diagnosis, or emergency service.

For detailed implementation boundaries, see [docs/implementation-status.md](docs/implementation-status.md).

<div align="center">

# Vediora

### Medication safety and consent-based clinical collaboration

[![Next.js](https://img.shields.io/badge/Next.js-15.5-000000?logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20Postgres-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Ollama](https://img.shields.io/badge/Ollama-Local%20Mistral-111111)](https://ollama.com/)
[![Bun](https://img.shields.io/badge/Bun-1.4%2B-FBF0DF?logo=bun&logoColor=000000)](https://bun.sh/)

Vediora connects patient-managed health records, doctor consent, medication interaction data, local artificial intelligence, and versioned evidence reports in one web application.

</div>

## What Vediora does

Vediora helps patients organize medication information and decide which doctors may access it. Doctors can request access, review approved patient records, check medicine interactions, and save evidence reports. The medical chat combines imported database records with a locally hosted Mistral model through Ollama.

The application treats database interaction records as authoritative. A missing record never means that a medicine combination is safe.

## Current implementation

The connected application includes these workflows:

| Area | Available functionality |
| --- | --- |
| Authentication | Email sign-up, sign-in, callback handling, password recovery, password reset, and sign-out |
| Patient workspace | Dashboard, health profile, medicine list, prescription records, evidence reports, doctor access, and medical chat |
| Doctor workspace | Dashboard, doctor profile, access requests, approved patients, clinical medicine review, evidence reports, and medical chat |
| Consent | Doctors request access by patient email; patients approve, deny, or revoke access |
| Medicine chat | Saved conversations, new chats, follow-up context, multiple medicine names, database interaction checks, and local Mistral explanations |
| Reports | Versioned patient and doctor evidence reports linked to current medication findings |
| Observability | Optional Langfuse traces for the chat pipeline |

These areas remain outside the connected release:

- Prescription optical character recognition (OCR)
- Automated condition and allergy contraindication rules
- Administrative doctor verification screens
- External hosted large language model APIs

Doctor registration details are currently self-declared. Do not treat a doctor account as independently verified.

## Project documentation

Use these text files to review, demonstrate, and understand the connected project:

| Material | Purpose |
| --- | --- |
| [Connected demo walkthrough](Walkthrough.md) | Patient, doctor, consent, chat, and evidence-report demonstration flow |
| [Implementation status](docs/implementation-status.md) | Connected features, verification, limitations, and next milestone |
| [Langfuse tracing guide](docs/langfuse-tracing.md) | Medicine-chat trace structure and privacy boundary |

Presentations, PDFs, private environment files, database exports, project memory, local logs, and source documents containing personal contact information are intentionally excluded from Git.

## How the system works

The browser uses Supabase Authentication for identity. Next.js server routes read and update PostgreSQL through the Supabase session pooler. Chat routes retrieve medicine and interaction records before calling the local Ollama service for an explanation.

```mermaid
flowchart LR
    Browser[Patient or doctor browser]
    App[Next.js application]
    Auth[Supabase Authentication]
    API[Next.js server routes]
    DB[(Supabase PostgreSQL)]
    Ollama[Local Ollama and Mistral]
    Trace[Optional Langfuse tracing]

    Browser --> App
    App --> Auth
    App --> API
    API --> DB
    API --> Ollama
    API -.-> Trace
```

### Medication answer flow

1. The server resolves medicine names and aliases against the imported drug data.
2. It checks every recognized medicine pair against the interaction table.
3. It loads relevant saved medicines and recent messages when the current conversation needs context.
4. Local Mistral explains medicine information and database findings in readable language.
5. The response separates documented interactions, missing records, and model knowledge.
6. Langfuse records each stage when its environment variables are configured.

## Technology stack

| Layer | Technology |
| --- | --- |
| Web application | Next.js 15 App Router and React 18 |
| Language | TypeScript 5.6 |
| Styling | Tailwind CSS 3.4 |
| Authentication | Supabase Auth with server-side rendering helpers |
| Database | Supabase PostgreSQL through the session pooler |
| Local model | Ollama with `mistral-nemo:12b` |
| Observability | Langfuse, optional |
| Package manager | Bun |
| Testing | Bun test runner and Playwright |

## Repository structure

The main directories separate pages, reusable components, database migrations, server logic, documentation, and automated checks:

```text
Vediora-WIE-SVNIT/
|-- app/                  Next.js pages, layouts, and API routes
|-- components/           Shared interface components
|-- lib/                  Auth, database, chat, reports, and domain logic
|-- services/             Prototype clinical service modules
|-- supabase/migrations/  Additive PostgreSQL migrations
|-- tests/                Unit and Playwright browser tests
|-- docs/                 Implementation status and tracing guidance
|-- scripts/              Local migration, verification, and demo helpers
|-- .env.example          Environment variable template
|-- .gitignore            Private and generated file exclusions
`-- package.json          Bun scripts and dependencies
```

## Run Vediora locally

You need [Bun](https://bun.sh/), a [Supabase](https://supabase.com/) project, and [Ollama](https://ollama.com/) before starting the app.

### 1. Clone the project branch

```bash
git clone --branch final-project-kunj --single-branch \
  https://github.com/hetarthbhatt07/Vediora-WIE-SVNIT.git
cd Vediora-WIE-SVNIT
```

### 2. Install dependencies

```bash
bun install
```

### 3. Configure environment variables

Copy `.env.example` to `.env.local`, then replace the example values:

```bash
cp .env.example .env.local
```

PowerShell users can run:

```powershell
Copy-Item .env.example .env.local
```

The application requires these values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your_project_ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key_here
DATABASE_URL=postgresql://your_database_user:your_encoded_password@your_pooler_host:5432/postgres

OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=mistral-nemo:12b
OLLAMA_NUM_GPU=0
```

Percent-encode reserved characters in the database password before adding it to `DATABASE_URL`. Never commit `.env.local`.

Langfuse tracing is optional:

```dotenv
LANGFUSE_SECRET_KEY=your_langfuse_secret_key_here
LANGFUSE_PUBLIC_KEY=your_langfuse_public_key_here
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
```

### 4. Configure Supabase Authentication

Enable email authentication in Supabase. For local development, set:

- **Site URL**: `http://localhost:3000`
- **Redirect URL**: `http://localhost:3000/auth/callback`

Import the clinical `drugs` and `drug_interactions` data before using medicine interaction checks.

### 5. Apply database migrations

Run the SQL files from `supabase/migrations` in filename order:

1. `202609260001_patient_profiles.sql`
2. `202609260002_lock_clinical_tables.sql`
3. `202609270001_doctor_consent.sql`
4. `202609270002_patient_medicines.sql`
5. `202609270003_chat_history.sql`
6. `202609270004_prescriptions_reports.sql`
7. `202609280001_doctor_reports.sql`

The migrations add application tables and security policies. They do not delete imported clinical records.

### 6. Start the local model

Download the configured model once:

```bash
ollama pull mistral-nemo:12b
```

Start Ollama if it is not already running:

```bash
ollama serve
```

Vediora only accepts loopback Ollama addresses. This keeps model prompts on the local machine.

### 7. Start the application

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Connected routes

### Public and authentication routes

| Route | Purpose |
| --- | --- |
| `/` | Product overview and guest chat preview |
| `/login` | Email sign-in |
| `/signup` | Patient or doctor account creation |
| `/forgot-password` | Password recovery request |
| `/reset-password` | Password update after recovery |
| `/auth/callback` | Supabase Authentication callback |
| `/access-pending` | Role or access status guidance |

### Patient routes

| Route | Purpose |
| --- | --- |
| `/patient/dashboard` | Patient overview and live record counts |
| `/patient/chat` | Medical and medicine chat history |
| `/patient/medications` | Active and discontinued medicines |
| `/patient/prescriptions` | Confirmed prescription records |
| `/patient/reports` | Versioned evidence reports |
| `/patient/access` | Doctor access requests and approvals |
| `/patient/profile` | Health profile editor |

### Doctor routes

| Route | Purpose |
| --- | --- |
| `/doctor/dashboard` | Doctor overview and live record counts |
| `/doctor/chat` | Medical and medicine chat history |
| `/doctor/patients` | Access requests and approved patients |
| `/doctor/patients/[id]` | Consent-scoped patient record |
| `/doctor/analysis` | Clinical medicine review |
| `/doctor/reports` | Doctor evidence reports |
| `/doctor/profile` | Doctor profile editor |

## Validate a local installation

Run these checks before sharing changes:

```bash
bun run typecheck
bun run test
bun run test:e2e
bun run build
```

The current branch passes TypeScript checking, 18 unit tests, 6 Playwright tests, and a production build.

## Data and security model

Vediora applies role-aware access in server routes and database policies. Patients control doctor access, and doctors can read patient records only while approval remains active. Public browser clients cannot edit imported clinical reference tables.

Keep these files and values private:

- `.env.local`
- Supabase database passwords and service credentials
- Langfuse secret keys
- Local logs containing prompts or health information
- Database exports with patient data

The repository excludes generated build output, dependencies, local logs, and environment files through `.gitignore`.

## Known limitations

- Medical responses depend on the coverage of the imported interaction dataset
- Local Mistral can respond slowly on CPU-only machines
- Missing interaction records do not establish safety
- Prescription records require manual confirmation because OCR is deferred
- Condition, pregnancy, allergy, dose, and laboratory checks require clinical review
- The application does not independently verify doctor credentials

## Team Vediora

| Name | Role |
| --- | --- |
| Darji Avani Rajendrabhai | Team Leader |
| Darji Janvi Navinbhai | Co-Leader |
| Dobariya Bhavarth Jitendra | Member |
| Shaikh Ayanuddin Ayazuddin | Member |
| Kunj Shaileshbhai Darji | Member |
| Hetarth Umang Bhatt | Member |

LDRP Institute of Technology and Research

## Medical disclaimer

Vediora supports medication education and clinical review. It does not diagnose conditions or replace a doctor, pharmacist, emergency service, or other qualified healthcare professional. Do not start, stop, or change medication based only on this application.

## License

No open-source license has been added to this repository. Contact the project team before copying, distributing, or reusing the code.

<div align="center">

Built by Team Vediora

</div>

# Vediora implementation status

Last updated: 2026-09-30

## Implemented

- Supabase email/password authentication: sign up, sign in, email confirmation callback, password recovery, password update, session refresh, and sign out.
- Protected patient, doctor, admin, API, and access-pending routes through Supabase SSR middleware plus server-side database role checks.
- A self-owned `public.vediora_profiles` table with an `auth.users` foreign key, provisioning trigger, update timestamp trigger, grants, and row-level security.
- Authenticated `GET` and `PATCH /api/patient/profile` endpoints with field allowlisting, validation, same-origin write protection, and database-error redaction.
- Real patient profile editing and a dashboard populated from the signed-in user's Supabase profile.
- Supabase-backed patient prescriptions with one-to-twenty exact catalog-matched medicines, explicit patient confirmation, prescription provenance, retained history, and optional synchronization into the active medicine list.
- Immutable, versioned evidence reports containing the checked medicines, every retrieved database finding, uncovered pairs, source metadata, references, severity, and safety limitation.
- Consent-scoped doctor clinical reviews and report history. Active patient approval is checked at generation and read time, and doctor report provenance is recorded.
- Patient and doctor account registration with the account type stored in `vediora_profiles`; browser metadata only hints at navigation and cannot bypass server role checks.
- A connected doctor workspace with editable professional profile, patient-email access requests, request history, and a directory containing only currently approved patients.
- Patient approval, denial, and revocation in `/patient/access`. Requests and every consent transition are stored; records are never deleted by the application.
- Approved doctor profile reads are checked on every request and recorded as `profile_viewed` audit events. Revocation prevents the next read.
- A Supabase-backed patient medicine list with exact imported-drug matching, dosage/frequency updates, and history-preserving discontinuation. Approved doctors read the same current active rows.
- Admin screens remain denied pending a separately approved admin authorization model.
- Local mocked end-to-end auth/isolation coverage and profile validation tests.
- A shared patient and doctor medical chat inside their existing workspaces, backed by role-checked server APIs, local Mistral, and the imported `drugs` and `drug_interactions` tables.
- Generic/brand-name recognition, pairwise database checks, evidence details, explicit unresolved states, and careful wording when no interaction record exists.
- Patient-language alias normalization maps `aspirin` and `ASA` to the imported acetylsalicylic-acid record, so aspirin plus warfarin reaches the existing Major interaction record.
- Answers name the recognized medicines and highest recorded severity while separating interaction checking from deciding whether a medicine treats or cures a condition.
- Local `mistral-nemo:12b` through Ollama uses structured prompt version 2. It classifies medicine information, broader medical education, and unsupported requests; detailed answers can cover benefits, disadvantages, risks, practical considerations, care guidance, and clinician questions.
- There is no fixed medicine-count limit. Every recognized medicine is profiled and every recognized pair is checked; the request body retains a 2,000-character safety and resource limit.
- Interaction findings remain deterministic: Mistral receives the retrieved database evidence but the application itself constructs the verified-findings and missing-record sections.
- Langfuse Cloud tracing records medicine recognition, database retrieval, the real Mistral generation, prompt version, model, token usage, latency, and final structured result. No Supabase user ID is attached to traces.
- Each completed request records 19 named observations, or 20 when saved active medicines are added, covering request controls, role matching, catalog/profile retrieval, recognition, regimen expansion, pair construction, interaction evidence, conversation context, Mistral generation, structured-answer validation, persistence, and response-boundary checks.
- Patient comparison questions automatically include saved active medicines when the wording indicates a combination or interaction check. The UI explicitly lists which saved medicines were added.
- Ambiguous imported medicine names return a confirmation request with candidate generic names before any interaction analysis runs.
- Patient and doctor conversations persist in account-owned Supabase tables. The latest conversation reloads in the workspace and its last 10 messages are supplied to local Mistral for follow-up context. A New chat action starts a separate conversation.
- The chat workspace lists the 30 most recently updated conversations. Patients and doctors can start a blank chat, reopen an earlier conversation with its structured interaction cards, and continue that selected conversation without mixing contexts.
- Workspace loading no longer waits for a duplicate browser-side Supabase session check after server authorization. Server layouts use one combined auth/account lookup, protected page responses can use Next.js client navigation caching, and the shared drug catalog cache lasts one hour.
- Follow-up wording such as “explain it” or “tell me more” reuses medicine names from recent user messages before deterministic database checks. Saved active medicines are deduplicated by canonical name.
- Langfuse isolated failed answers to Ollama timeouts and a Blackwell CUDA Flash Attention initialization fault. The stable local configuration disables Flash Attention and uses 20 GPU layers through the private `OLLAMA_NUM_GPU` environment setting.
- Ollama proved unstable when given a JSON Schema object. Vediora now uses stable JSON mode with a compact three-field contract, accepts structured-object answers defensively, and formats them into readable headings and bullet points. Recent conversation context is capped to six messages of 600 characters each, generation is capped at 900 tokens, and stalled generations stop after 120 seconds.
- One-character follow-ups are accepted. `?`, “explain me,” “tell me more,” and “I also take …” are resolved against the selected conversation before medicine recognition and generation.
- Browser access removed from imported clinical tables; the chat queries them only through the server-side Session Pooler connection.
- The public landing page now describes only connected capabilities and includes a two-message guest preview. Combination questions use imported database records; detailed local-Mistral education requires sign-in.
- Hackathon branding, unfinished OCR claims, fake compliance wording, and the Next.js development indicator were removed from the public presentation.
- An idempotent synthetic video-data script prepares the current patient/doctor demo pair without deleting existing records.

All seven Vediora migrations were applied to the configured Supabase project. They are additive: the imported drugs, interactions, prescriptions, and legacy patient tables were not changed.

## Verification

- `bun run typecheck` passes.
- `bun run test` passes: 18 tests.
- `bun run test:e2e` passes: 6 Playwright tests.
- `bun run build` passes with Next.js 15.5.26.
- The rebuilt landing route loads about 113 kB of first-load JavaScript, down from about 193 kB before the redesign.
- A live anonymous Supabase Data API probe reaches `vediora_profiles` and is denied because `anon` has no table grant, confirming the profile boundary is active.
- A synthetic trace was exported to the configured Langfuse US Cloud project and read back through Observations API v2.
- Real authenticated one- and three-medicine requests completed against the live database and local Mistral. The three-medicine request recognized all medicines, checked all three pairs, returned all three interaction cards, and exported a 15-observation Langfuse trace with model and token data.
- The live database contains acetylsalicylic acid (RxCUI 1191), warfarin (RxCUI 11289), and their existing Major interaction record.
- Applied the additive doctor-consent and patient-medicine migrations to the configured Supabase project. Existing profiles and imported clinical rows were preserved.
- Rollback-only live database verification completed request, approval, doctor read, revocation, medicine update, and medicine discontinuation flows without retaining test data.
- The configured local Ollama endpoint returned HTTP 200 from `mistral-nemo:12b`. The code rejects non-loopback `OLLAMA_URL` values, so an external model endpoint cannot be configured accidentally.
- The exact production generator passed an aspirin -> add warfarin -> explain follow-up -> fresh warfarin conversation sequence. It retained context only inside the selected chat, returned the imported Major interaction, and completed the four generations in 38.4, 31.6, 35.5, and 28.4 seconds.
- Removed a duplicate `next dev` process tree that was corrupting the shared `.next` chunk manifest. After a clean single-server restart, the homepage stylesheet and all six referenced JavaScript assets return HTTP 200.
- Restored conversations use deterministic user-before-assistant ordering when both rows share their transaction timestamp. Assistant Markdown is rendered safely instead of displaying raw formatting markers.
- New Chat and saved-chat selection cancel the active turn, invalidate late client replies, propagate cancellation to local Ollama, and prevent an asynchronous history refresh from reopening the chat that was left.
- Short follow-ups including “Explain in detail” and “In detail” now resolve against medicines in the selected conversation. The local RTX configuration uses a stable 20-layer partial offload; the production generator completed aspirin, aspirin-plus-warfarin, detailed follow-up, and clean-new-chat checks in 52.9-77.9 seconds.

## Required Supabase dashboard setting

Under **Authentication -> URL Configuration**, set the local site URL to `http://localhost:3000` and allow `http://localhost:3000/auth/callback` as a redirect URL. This is required for email confirmation and password recovery to return to the local application.

Email confirmation is enabled. Each new Auth user receives a patient or doctor profile automatically from the validated signup metadata.

## Next milestone

1. Add secure document storage and real OCR, keeping mandatory human confirmation before persistence.
2. Add patient conditions and allergies after their evidence rules are validated.
3. Add administrator verification for doctor licenses.

## Known limitations

- OCR, alerts, optional condition/allergy rules, and admin screens remain unconnected prototypes. Manual prescription ingestion, patient reports, doctor clinical review, and consent-scoped doctor reports are connected.
- Chat history is persisted, but it is not yet converted into a signed or versioned clinical report.
- Medicine recognition is deterministic name matching with explicit ambiguity rejection against imported generic, brand, and ingredient names. It is not yet a full RxNorm normalization workflow.
- Local Mistral generation remains slower than the database workflow. With the stable 20-layer partial offload, the latest four-turn production sequence completed each answer in about 53 to 78 seconds; model and hardware tuning remain future performance work.
- Ollama must be running and must have the configured model installed. The chat safely falls back to a deterministic database response when generation fails.
- Langfuse receives the medicine-chat question and structured workflow output. It does not receive the authenticated user's Supabase identifier in this implementation.
- Doctor registration currently records a self-declared license and marks it `unverified`; a real administrator verification process is not implemented. Patients see this status before approval.
- The consent and medicine tables are available only to server routes. The current model does not yet support fine-grained consent by data category or expiration date.
- `npm audit --omit=dev` currently reports two production dependency advisories: one moderate and one high. A future framework dependency upgrade must be tested before deployment.
- The supplied database password has appeared in conversation and should be rotated before any hosted or shared deployment.

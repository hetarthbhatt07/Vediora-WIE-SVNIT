# Reading Vediora medicine-chat traces

Open the configured Langfuse project, select **Tracing**, and open a trace named `medicine-safety-chat`. Each submitted medicine question produces one trace tree.

## Current trace steps

| Observation | Type | What it shows |
| --- | --- | --- |
| `medicine-safety-chat` | Chain | The submitted question, final counts, final answer, workflow version, whether Mistral was used, and its model name. |
| `validate-request-origin` | Guardrail | Whether the browser request came from the Vediora origin. |
| `authenticate-workspace-account` | Guardrail | Whether Supabase authenticated the request and the account role matches the patient or doctor endpoint. The user identifier is not exported. |
| `validate-question` | Guardrail | Accepted field names and the 2,000-character message limit. |
| `load-medicine-catalog` | Retriever | Number of records available from `public.drugs` and the cache duration. |
| `recognize-medicines` | Chain | Each recognized database medicine and whether a reviewed patient alias was used. |
| `expand-with-active-medicines` | Retriever | For relevant patient comparison questions, which saved active medicines were added to the regimen. This observation is omitted when expansion is unnecessary. |
| `count-recognized-medicines` | Span | How many medicines were recognized and confirmation that no fixed medicine-count limit was applied. |
| `load-medicine-profiles` | Retriever | Database profiles supplied to Mistral for the recognized medicines. |
| `build-medicine-pairs` | Chain | Every recognized pair that must be checked. Pair count grows as n(n-1)/2. |
| `retrieve-interactions` | Retriever | Database interaction IDs, medicine pairs, severity, table name, and result count. |
| `prepare-evidence` | Chain | Which evidence fields were usable and whether a corrupted clinical-effect field was suppressed. |
| `check-pair-coverage` | Chain | Which requested pairs had no database record. |
| `load-conversation-context` | Retriever | How many recent messages were supplied for follow-up context, capped at 10. Account identity is not exported. |
| `prepare-medical-context` | Chain | The database evidence counts and whether the request is likely medicine information or a broader medical/unsupported question. |
| `mistral-medicine-explanation` | Generation | The complete system/user prompt, local Ollama model, structured model output, latency, and prompt/completion token counts. |
| `validate-structured-medical-answer` | Guardrail | Mistral's response type, section counts, unsupported-topic handling, and coverage of recognized medicines. |
| `compose-patient-response` | Chain | Whether the response used Mistral or the deterministic fallback and the exact patient response. |
| `verify-response-boundaries` | Guardrail | Checks for limitations, missing-record uncertainty, database-grounded interaction findings, and medication-change wording. |
| `persist-conversation-turn` | Tool | Whether the user question, assistant answer, and structured result were appended to account-owned history. |

## Mistral generation

The `mistral-medicine-explanation` generation uses the local Ollama model configured by `OLLAMA_MODEL` (currently `mistral-nemo:12b`). Prompt version 2 classifies requests as medicine information, medical education, or unsupported. Detailed answers can cover overview, benefits, disadvantages, risks, practical considerations, and when to seek care. Records from `public.drug_interactions` remain the only authoritative interaction findings; the model cannot add, infer, or change interaction records.

The application validates structured JSON from Mistral, then builds the final database-findings and safety sections from deterministic application data. The latest 10 messages from the current conversation let Mistral resolve follow-up wording. Relevant patient comparison questions are expanded with saved active medicines before pair construction, and the response names the medicines that were added. A medical question can be answered even when it contains no recognized medicine. Unknown or unrelated questions must return a polite unsupported response. If Ollama is unavailable, the API returns the database-only fallback and records the generation error instead of inventing an answer.

The current local 12.2B model uses a stable partial GPU offload on the development workstation. The latest four-turn production sequence completed each answer in about 53 to 78 seconds. The exact time depends on hardware, the configured private `OLLAMA_NUM_GPU` value, prompt length, and whether the model is warm. If Ollama fails or times out, Vediora returns the deterministic database fallback and records the generation error.

## Privacy boundary

The trace includes the submitted chat text, up to 10 recent conversation messages, medicine profiles, retrieved interaction evidence, prompts, model output, and final response. It does not attach the Supabase user ID, email address, access token, database credentials, or Langfuse credentials. Do not enter names, contact details, or other unnecessary patient identifiers in the chat.

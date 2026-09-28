import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { unstable_cache } from 'next/cache';
import { startActiveObservation } from '@langfuse/tracing';
import { currentAccount } from '@/lib/server/account';
import { appendConversationTurn, loadConversationContext, loadConversationHistory } from '@/lib/server/chat-history';
import { query } from '@/lib/server/database';
import { langfuseSpanProcessor } from '@/instrumentation';
import {
  generateMedicineExplanation,
  MEDICINE_ASSISTANT_PROMPT_VERSION,
  type MistralMedicineProfile,
} from '@/lib/server/mistral';
import {
  MEDICINE_CHAT_LIMITATION,
  findAmbiguousMedicineMentions,
  findMentionedMedicines,
  makePatientAnswer,
  medicineLabel,
  normalizeMedicineText,
  pairKey,
  parseMedicineQuestion,
  referencesMedicineConversation,
  type DrugCatalogRow,
  type InteractionFinding,
  type RecognizedMedicine,
} from '@/lib/medicine-chat';

export const dynamic = 'force-dynamic';

interface InteractionRow {
  interaction_id: number;
  drug1_id: number;
  drug2_id: number;
  drug1_name: string;
  drug2_name: string;
  severity: string | null;
  interaction_type: string | null;
  description: string | null;
  clinical_effect: string | null;
  evidence_source: string | null;
  reference_url: string | null;
}

interface DrugProfileRow {
  drug_id: number;
  rxcui: string | null;
  generic_name: string | null;
  brand_name: string | null;
  ingredient_name: string | null;
  dosage_form: string | null;
  route: string | null;
  source: string | null;
}

interface ActiveMedicineRow extends DrugCatalogRow {
  medicine_name: string;
}

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
const getDrugCatalog = unstable_cache(async () => {
  const result = await query<DrugCatalogRow>(
    'select drug_id, generic_name, brand_name, ingredient_name from public.drugs where generic_name is not null or brand_name is not null or ingredient_name is not null',
  );
  return result.rows;
}, ['vediora-drug-catalog'], { revalidate: 3_600 });

function evidenceText(value: string | null) {
  if (!value) return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > 1_200 ? `${clean.slice(0, 1_197)}…` : clean;
}

function clinicalEffectText(value: string | null) {
  if (!value) return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  // Some imported enrichment rows contain an unfiltered list of hundreds of
  // unrelated events. Do not present that corrupted field to a patient.
  if (clean.length > 800 || (clean.match(/,/g)?.length || 0) > 12) return null;
  return clean;
}

function referenceUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function hasSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '');
  return !!host && origin === `${protocol}://${host}`;
}

function workspaceRole(request: NextRequest) {
  return request.nextUrl.pathname.startsWith('/api/doctor/') ? 'doctor' as const : 'patient' as const;
}

function conversationId(value: unknown) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('The conversation identifier is invalid.');
  }
  return value;
}

export async function GET(request: NextRequest) {
  try {
    const current = await currentAccount();
    const role = workspaceRole(request);
    if (!current) return json({ error: 'Please sign in again.' }, 401);
    if (current.account.account_type !== role) return json({ error: `A ${role} account is required.` }, 403);
    const selectedConversationId = conversationId(request.nextUrl.searchParams.get('conversationId'));
    const history = await loadConversationHistory(current.user.id, role, selectedConversationId);
    return json(history);
  } catch (error) {
    console.error('Load chat history error', error instanceof Error ? error.message : 'Unknown error');
    return json({ error: 'Chat history could not be loaded.' }, 503);
  }
}

export async function POST(request: NextRequest) {
  return startActiveObservation('medicine-safety-chat', async workflow => {
    workflow.update({
      metadata: {
        workflow: 'database-grounded-mistral-explanation',
        workflowVersion: '3',
        llmProvider: 'local-ollama',
        llmModel: process.env.OLLAMA_MODEL || 'mistral-nemo:12b',
        identityAttached: false,
      },
    });
    after(async () => {
      try {
        await langfuseSpanProcessor.forceFlush();
      } catch (error) {
        console.error('Langfuse flush error', error instanceof Error ? error.message : 'Unknown tracing error');
      }
    });

    const originAllowed = await startActiveObservation('validate-request-origin', observation => {
      const allowed = hasSameOrigin(request);
      observation.update({
        input: { originPresent: request.headers.has('origin') },
        output: { allowed },
      });
      return allowed;
    }, { asType: 'guardrail' });
    if (!originAllowed) {
      workflow.update({ output: { status: 403, outcome: 'rejected-origin' } });
      return json({ error: 'Invalid request origin.' }, 403);
    }

    const current = await startActiveObservation('authenticate-workspace-account', async observation => {
      const account = await currentAccount();
      const expectedRole = workspaceRole(request);
      const valid = !!account && account.account.account_type === expectedRole;
      observation.update({
        output: { authenticated: valid, roleMatched: valid },
        metadata: { provider: 'supabase-auth', identityExported: false },
      });
      return valid ? account : null;
    }, { asType: 'guardrail' });
    if (!current) {
      workflow.update({ output: { status: 401, outcome: 'authentication-or-role-required' } });
      return json({ error: 'Please sign in again.' }, 401);
    }

    let message: string;
    let activeConversationId: string | null;
    try {
      const parsed = await startActiveObservation('validate-question', async observation => {
        const body = await request.json();
        const keys = body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body) : [];
        if (keys.some(key => key !== 'message' && key !== 'conversationId')) throw new Error('The request contains unsupported fields.');
        const parsedMessage = parseMedicineQuestion({ message: body?.message });
        const parsedConversationId = conversationId(body?.conversationId);
        observation.update({
          input: { fieldNames: keys },
          output: { valid: true, characterCount: parsedMessage.length, continuingConversation: !!parsedConversationId },
        });
        return { message: parsedMessage, conversationId: parsedConversationId };
      }, { asType: 'guardrail' });
      message = parsed.message;
      activeConversationId = parsed.conversationId;
      workflow.update({ input: { message } });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Invalid question.';
      workflow.update({ output: { status: 400, outcome: 'invalid-question', error: errorMessage } });
      return json({ error: errorMessage }, 400);
    }

    try {
      const conversation = await startActiveObservation('load-conversation-context', async observation => {
        const context = await loadConversationContext(
          activeConversationId,
          current.user.id,
          current.account.account_type,
        );
        observation.update({
          input: { continuingConversation: !!activeConversationId },
          output: { messageCount: context.length },
          metadata: { maximumMessages: 10, identityExported: false },
        });
        return context;
      }, { asType: 'retriever' });
      const catalog = await startActiveObservation('load-medicine-catalog', async catalogObservation => {
        const rows = await getDrugCatalog();
        catalogObservation.update({
          output: { medicineCount: rows.length },
          metadata: { source: 'public.drugs', cacheSeconds: 300 },
        });
        return rows;
      }, { asType: 'retriever' });
      const directMedicines = findMentionedMedicines(message, catalog);
      const referencesPriorContext = referencesMedicineConversation(message);
      const contextualFollowUp = conversation.length > 0
        && referencesPriorContext
        && (directMedicines.length === 0 || /\b(also|with it|with them)\b/i.test(message));
      const recognitionText = contextualFollowUp
        ? `${conversation.filter(item => item.role === 'user').map(item => item.content).join(' ')} ${message}`
        : message;
      const ambiguous = findAmbiguousMedicineMentions(recognitionText, catalog);
      if (ambiguous.length > 0) {
        workflow.update({ output: { status: 409, outcome: 'medicine-confirmation-required', ambiguous } });
        return json({
          error: 'I found more than one possible medicine for part of your question. Please use an exact generic name.',
          ambiguity: ambiguous,
        }, 409);
      }
      let recognized = await startActiveObservation('recognize-medicines', async observation => {
        observation.update({ input: { message, catalogSize: catalog.length, contextualFollowUp } });
        const medicines = contextualFollowUp ? findMentionedMedicines(recognitionText, catalog) : directMedicines;
        observation.update({
          output: medicines.map(medicine => ({
            id: medicine.id,
            label: medicineLabel(medicine),
            matchedByPatientAlias: !!medicine.matchedAlias,
          })),
          metadata: { catalogSource: 'public.drugs', matching: 'exact-normalized-phrase-plus-reviewed-aliases', conversationContextUsed: contextualFollowUp },
        });
        return medicines;
      }, { asType: 'chain' });

      const activeMedicinesIncluded: RecognizedMedicine[] = [];
      const shouldCompareSavedMedicines = current.account.account_type === 'patient'
        && recognized.length > 0
        && (recognized.length > 1 || /\b(interact|interaction|together|combine|combined|mix|safe|take|taking|with)\b/i.test(message));
      if (shouldCompareSavedMedicines) {
        recognized = await startActiveObservation('expand-with-active-medicines', async observation => {
          const saved = await query<ActiveMedicineRow>(
            `select d.drug_id, d.generic_name, d.brand_name, d.ingredient_name, m.medicine_name
               from public.vediora_patient_medicines m
               join public.drugs d on d.drug_id = m.drug_id
              where m.patient_id = $1 and m.status = 'active'
              order by m.updated_at desc`,
            [current.user.id],
          );
          const existing = new Set(recognized.map(item => item.id));
          const existingNames = new Set(recognized.map(item => normalizeMedicineText(item.name)));
          for (const row of saved.rows) {
            if (existing.has(row.drug_id)) continue;
            const savedName = row.generic_name?.trim() || row.ingredient_name?.trim() || row.brand_name?.trim() || row.medicine_name;
            if (existingNames.has(normalizeMedicineText(savedName))) continue;
            const medicine: RecognizedMedicine = {
              id: row.drug_id,
              name: savedName,
              brandName: row.brand_name?.trim() || null,
              matchedAlias: null,
            };
            activeMedicinesIncluded.push(medicine);
            existing.add(medicine.id);
            existingNames.add(normalizeMedicineText(medicine.name));
          }
          const expanded = [...recognized, ...activeMedicinesIncluded].sort((a, b) => a.name.localeCompare(b.name));
          observation.update({
            input: { mentionedMedicineCount: recognized.length },
            output: {
              activeMedicineCount: saved.rows.length,
              addedMedicineCount: activeMedicinesIncluded.length,
              addedMedicines: activeMedicinesIncluded.map(medicineLabel),
              expandedMedicineCount: expanded.length,
            },
          });
          return expanded;
        }, { asType: 'retriever' });
      }

      await startActiveObservation('count-recognized-medicines', observation => {
        observation.update({
          input: { questionCharacterCount: message.length },
          output: { recognizedCount: recognized.length, fixedMedicineLimitApplied: false },
        });
      });

      const medicineProfiles = await startActiveObservation('load-medicine-profiles', async observation => {
        if (recognized.length === 0) {
          observation.update({ output: { profileCount: 0 } });
          return [] as MistralMedicineProfile[];
        }
        const profileResult = await query<DrugProfileRow>(
          `select drug_id, rxcui, generic_name, brand_name, ingredient_name,
                  dosage_form, route, source
             from public.drugs
            where drug_id = any($1::int[])
            order by generic_name nulls last, drug_id`,
          [recognized.map(medicine => medicine.id)],
        );
        const labels = new Map(recognized.map(medicine => [medicine.id, medicineLabel(medicine)]));
        const profiles = profileResult.rows.map(row => ({
          medicine: labels.get(row.drug_id) || row.generic_name || row.ingredient_name || row.brand_name || `Medicine ${row.drug_id}`,
          rxcui: row.rxcui,
          ingredient: row.ingredient_name,
          brand: row.brand_name,
          dosageForm: row.dosage_form,
          route: row.route,
          source: row.source,
        }));
        observation.update({
          input: { medicineIds: recognized.map(medicine => medicine.id) },
          output: profiles,
          metadata: { source: 'public.drugs' },
        });
        return profiles;
      }, { asType: 'retriever' });

      let interactions: InteractionFinding[] = [];
      let pairsWithoutRecords: string[] = [];

      if (recognized.length >= 2) {
        const ids = recognized.map(medicine => medicine.id);
        const requestedPairs = await startActiveObservation('build-medicine-pairs', observation => {
          const pairs: Array<{ firstId: number; secondId: number; label: string }> = [];
          for (let first = 0; first < recognized.length; first += 1) {
            for (let second = first + 1; second < recognized.length; second += 1) {
              pairs.push({
                firstId: recognized[first].id,
                secondId: recognized[second].id,
                label: `${medicineLabel(recognized[first])} + ${medicineLabel(recognized[second])}`,
              });
            }
          }
          observation.update({
            input: { medicineCount: recognized.length },
            output: { pairCount: pairs.length, pairs: pairs.map(pair => pair.label) },
          });
          return pairs;
        }, { asType: 'chain' });

        const interactionResult = await startActiveObservation('retrieve-interactions', async observation => {
          observation.update({ input: { medicineIds: ids, medicines: recognized.map(medicineLabel) } });
          const databaseResult = await query<InteractionRow>(
            `select i.interaction_id, i.drug1_id, i.drug2_id,
              coalesce(d1.generic_name, d1.ingredient_name, d1.brand_name, 'Unknown medicine') as drug1_name,
              coalesce(d2.generic_name, d2.ingredient_name, d2.brand_name, 'Unknown medicine') as drug2_name,
              i.severity, i.interaction_type, i.description, i.clinical_effect,
              i.evidence_source, i.reference_url
         from public.drug_interactions i
         join public.drugs d1 on d1.drug_id = i.drug1_id
         join public.drugs d2 on d2.drug_id = i.drug2_id
        where i.drug1_id = any($1::int[]) and i.drug2_id = any($1::int[])
        order by case i.severity when 'Major' then 1 when 'Moderate' then 2 when 'Minor' then 3 else 4 end,
                 i.interaction_id`,
            [ids],
          );
          observation.update({
            output: databaseResult.rows.map(row => ({
              interactionId: row.interaction_id,
              pair: `${row.drug1_name} + ${row.drug2_name}`,
              severity: row.severity,
            })),
            metadata: { table: 'public.drug_interactions', resultCount: databaseResult.rowCount },
          });
          return databaseResult;
        }, { asType: 'retriever' });

        interactions = await startActiveObservation('prepare-evidence', observation => {
          const prepared = interactionResult.rows.map(row => ({
            id: row.interaction_id,
            medicineA: row.drug1_name,
            medicineB: row.drug2_name,
            severity: row.severity,
            type: row.interaction_type,
            description: evidenceText(row.description),
            clinicalEffect: clinicalEffectText(row.clinical_effect),
            evidenceSource: evidenceText(row.evidence_source),
            referenceUrl: referenceUrl(row.reference_url),
          }));
          observation.update({
            input: { databaseRecordCount: interactionResult.rows.length },
            output: prepared.map((finding, index) => ({
              interactionId: finding.id,
              severity: finding.severity,
              descriptionIncluded: !!finding.description,
              clinicalEffectIncluded: !!finding.clinicalEffect,
              clinicalEffectSuppressed: !!interactionResult.rows[index].clinical_effect && !finding.clinicalEffect,
              sourceIncluded: !!finding.evidenceSource,
              referenceIncluded: !!finding.referenceUrl,
            })),
          });
          return prepared;
        }, { asType: 'chain' });

        pairsWithoutRecords = await startActiveObservation('check-pair-coverage', observation => {
          const recordedPairs = new Set(interactionResult.rows.map(row => pairKey(row.drug1_id, row.drug2_id)));
          const missingPairs = requestedPairs
            .filter(pair => !recordedPairs.has(pairKey(pair.firstId, pair.secondId)))
            .map(pair => pair.label);
          observation.update({
            input: { requestedPairCount: requestedPairs.length, recordedPairCount: recordedPairs.size },
            output: { missingPairCount: missingPairs.length, missingPairs },
          });
          return missingPairs;
        }, { asType: 'chain' });
      }

      let mistralAnswer: string | null = null;
      let generatedBy: { provider: 'Ollama'; model: string } | null = null;
      let responseType: 'medicine_information' | 'medical_education' | 'unsupported' | null = null;
      const resolvedQuestion = contextualFollowUp
        ? `Continue the current conversation about ${recognized.map(medicineLabel).join(' and ')}. The user's follow-up is: "${message}". Answer that follow-up directly and use the recent conversation plus verified findings.`
        : message;
      const modelConversation = conversation.slice(-6).map(item => ({
        role: item.role,
        content: item.content.replace(/\s+/g, ' ').trim().slice(0, 600),
      }));
      await startActiveObservation('prepare-medical-context', observation => {
        observation.update({
          input: { question: message },
          output: {
            recognizedMedicineCount: medicineProfiles.length,
            databaseInteractionCount: interactions.length,
            missingDatabasePairCount: pairsWithoutRecords.length,
            likelyMode: medicineProfiles.length > 0 ? 'medicine_information' : 'medical_education-or-unsupported',
          },
          metadata: {
            databaseEvidenceAuthoritativeForInteractions: true,
            generalKnowledgeProvider: 'local-ollama',
          },
        });
      }, { asType: 'chain' });
      try {
        const explanation = await startActiveObservation('mistral-medicine-explanation', async generation => {
          try {
            const generated = await generateMedicineExplanation({
              question: resolvedQuestion,
              conversation: modelConversation,
              medicines: medicineProfiles,
              savedActiveMedicinesIncluded: activeMedicinesIncluded.map(medicineLabel),
              interactions: interactions.map(interaction => ({
                pair: `${interaction.medicineA} + ${interaction.medicineB}`,
                severity: interaction.severity,
                type: interaction.type,
                description: interaction.description,
                clinicalEffect: interaction.clinicalEffect,
                source: interaction.evidenceSource,
              })),
              pairsWithoutRecords,
            }, request.signal);
            generation.update({
              model: generated.model,
              input: generated.prompt,
              output: generated.rawOutput,
              modelParameters: { temperature: 0.1 },
              usageDetails: {
                promptTokens: generated.promptTokens,
                completionTokens: generated.completionTokens,
                totalTokens: generated.promptTokens + generated.completionTokens,
              },
              prompt: {
                name: 'vediora-medical-information-assistant',
                version: MEDICINE_ASSISTANT_PROMPT_VERSION,
                isFallback: false,
              },
              metadata: {
                provider: 'ollama',
                totalDurationMs: generated.totalDurationMs,
                recognizedMedicineCount: medicineProfiles.length,
                verifiedInteractionCount: interactions.length,
                responseType: generated.responseType,
                sectionCounts: generated.sectionCounts,
              },
            });
            return generated;
          } catch (error) {
            generation.update({
              level: 'ERROR',
              statusMessage: error instanceof Error ? error.message : 'Unknown Mistral error',
            });
            throw error;
          }
        }, { asType: 'generation' });
        mistralAnswer = explanation.answer;
        generatedBy = { provider: 'Ollama', model: explanation.model };
        responseType = explanation.responseType;
        await startActiveObservation('validate-structured-medical-answer', observation => {
          observation.update({
            input: { responseType: explanation.responseType, sectionCounts: explanation.sectionCounts },
            output: {
              valid: true,
              answeredWithoutRecognizedMedicine: medicineProfiles.length === 0 && explanation.responseType === 'medical_education',
              unsupportedHandledExplicitly: explanation.responseType === 'unsupported',
              allRecognizedMedicinesCovered: explanation.responseType !== 'medicine_information'
                || explanation.sectionCounts.medicines >= medicineProfiles.length,
            },
          });
        }, { asType: 'guardrail' });
      } catch (error) {
        console.error('Mistral medicine explanation error', error instanceof Error ? error.message : 'Unknown Mistral error');
      }

      if (request.signal.aborted) {
        workflow.update({ output: { status: 499, outcome: 'client-cancelled' } });
        return new NextResponse(null, { status: 499 });
      }

      const result = await startActiveObservation('compose-patient-response', observation => {
        const response = {
          answer: mistralAnswer || `${makePatientAnswer(recognized, interactions, pairsWithoutRecords)} Detailed Mistral medicine information is temporarily unavailable.`,
          recognized,
          interactions,
          pairsWithoutRecords,
          limitation: MEDICINE_CHAT_LIMITATION,
          generatedBy,
          responseType,
          activeMedicinesIncluded,
        };
        observation.update({
          input: {
            recognizedMedicineCount: recognized.length,
            interactionCount: interactions.length,
            missingPairCount: pairsWithoutRecords.length,
          },
          output: { answer: response.answer, limitation: response.limitation },
          metadata: { responseMethod: mistralAnswer ? 'mistral-grounded-explanation' : 'deterministic-fallback' },
        });
        return response;
      }, { asType: 'chain' });

      await startActiveObservation('verify-response-boundaries', observation => {
        observation.update({
          input: { interactionCount: result.interactions.length },
          output: {
            interactionFindingsDatabaseGrounded: true,
            missingPairsShownAsUncertainty: result.pairsWithoutRecords.length === 0 || /does not confirm|no interaction record/i.test(result.answer),
            limitationIncluded: !!result.limitation,
            independentMedicationChangeDiscouraged: result.interactions.length === 0 || /do not [^.\n]*(?:stop|change)/i.test(result.answer),
            llmExplanationUsed: !!result.generatedBy,
            responseType: result.responseType,
          },
        });
      }, { asType: 'guardrail' });

      const savedConversationId = await startActiveObservation('persist-conversation-turn', async observation => {
        const id = await appendConversationTurn({
          conversationId: activeConversationId,
          ownerId: current.user.id,
          role: current.account.account_type,
          question: message,
          answer: result.answer,
          result,
        });
        observation.update({
          input: { continuingConversation: !!activeConversationId },
          output: { persisted: true },
          metadata: { identityExported: false },
        });
        return id;
      }, { asType: 'tool' });

      workflow.update({
        output: {
          status: 200,
          recognizedMedicineCount: result.recognized.length,
          interactionCount: result.interactions.length,
          missingPairCount: result.pairsWithoutRecords.length,
          llmUsed: !!result.generatedBy,
          model: result.generatedBy?.model || null,
          responseType: result.responseType,
          answer: result.answer,
        },
      });
      return json({ result, conversationId: savedConversationId });
    } catch (error) {
      workflow.update({
        level: 'ERROR',
        statusMessage: error instanceof Error ? error.message : 'Unknown database error',
      });
      console.error('Medicine chat database error', error instanceof Error ? error.message : 'Unknown database error');
      return json({ error: 'The medicine database is temporarily unavailable. Please try again shortly.' }, 503);
    }
  }, { asType: 'chain' });
}

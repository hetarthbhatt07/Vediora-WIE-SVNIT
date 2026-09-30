import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { findAmbiguousMedicineMentions, findMentionedMedicines, medicineLabel, pairKey, type DrugCatalogRow } from '@/lib/medicine-chat';
import { query } from '@/lib/server/database';
import { generateMedicineExplanation, type MistralMedicineProfile } from '@/lib/server/mistral';
import { hasSameOrigin } from '@/lib/server/request';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
const getCatalog = unstable_cache(async () => (await query<DrugCatalogRow>('select drug_id, generic_name, brand_name, ingredient_name from public.drugs where generic_name is not null or brand_name is not null or ingredient_name is not null')).rows, ['public-preview-catalog'], { revalidate: 3600 });
interface InteractionRow { interaction_id:number; drug1_id:number; drug2_id:number; a:string; b:string; severity:string|null; interaction_type:string|null; description:string|null; clinical_effect:string|null; evidence_source:string|null; }
interface ProfileRow { drug_id:number; rxcui:string|null; generic_name:string|null; brand_name:string|null; ingredient_name:string|null; dosage_form:string|null; route:string|null; source:string|null; }

function clean(value: string | null, maximum = 1000) { if (!value) return null; const result=value.replace(/\s+/g,' ').trim(); return result.length>maximum?`${result.slice(0,maximum-1)}…`:result; }
function clinicalEffect(value:string|null){const result=value?.replace(/\s+/g,' ').trim()||'';return result.length>800||(result.match(/,/g)?.length||0)>12?null:result||null;}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  let message = ''; let conversation: Array<{role:'user'|'assistant';content:string}> = [];
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['message','conversation'].includes(key)) || typeof body.message !== 'string') throw new Error();
    message=body.message.trim(); if(!message||message.length>500) throw new Error();
    if(body.conversation!=null){if(!Array.isArray(body.conversation))throw new Error();conversation=body.conversation.slice(-6).map((item:unknown)=>{if(!item||typeof item!=='object'||Array.isArray(item))throw new Error();const row=item as Record<string,unknown>;if(!['user','assistant'].includes(String(row.role))||typeof row.content!=='string')throw new Error();return {role:row.role as 'user'|'assistant',content:row.content.replace(/\s+/g,' ').trim().slice(0,600)};});}
  } catch { return json({ error: 'Enter a valid question using 500 characters or fewer.' }, 400); }
  try {
    if (/\b(sign|account|patient|doctor|report|vediora|what can|how (?:does|it)|feature)\b/i.test(message) && !/\b(medicine|drug|health|medical|symptom|condition|test)\b/i.test(message)) {
      return json({ answer: 'After signing in, patients can save medicines and confirmed prescriptions, generate evidence reports, and control doctor access. Approved doctors can review the current records and create consent-scoped clinical reports.', remaining: 2 });
    }
    const catalog=await getCatalog(); const ambiguous=findAmbiguousMedicineMentions(message,catalog);
    if(ambiguous.length>0) return json({answer:`I found more than one possible match for “${ambiguous[0].mention}”. Please enter an exact generic medicine name.`,remaining:2});
    const medicines=findMentionedMedicines(message,catalog);
    const profiles:MistralMedicineProfile[]=medicines.length===0?[]:(await query<ProfileRow>(`select drug_id,rxcui,generic_name,brand_name,ingredient_name,dosage_form,route,source from public.drugs where drug_id=any($1::int[])`,[medicines.map(item=>item.id)])).rows.map(row=>({medicine:medicineLabel(medicines.find(item=>item.id===row.drug_id)!),rxcui:row.rxcui,ingredient:row.ingredient_name,brand:row.brand_name,dosageForm:row.dosage_form,route:row.route,source:row.source}));
    let interactions:InteractionRow[]=[];const missingPairs:string[]=[];
    if(medicines.length>=2){const ids=medicines.map(item=>item.id);interactions=(await query<InteractionRow>(`select i.interaction_id,i.drug1_id,i.drug2_id,coalesce(d1.generic_name,d1.ingredient_name,d1.brand_name,'Medicine') a,coalesce(d2.generic_name,d2.ingredient_name,d2.brand_name,'Medicine') b,i.severity,i.interaction_type,i.description,i.clinical_effect,i.evidence_source from public.drug_interactions i join public.drugs d1 on d1.drug_id=i.drug1_id join public.drugs d2 on d2.drug_id=i.drug2_id where i.drug1_id=any($1::int[]) and i.drug2_id=any($1::int[]) order by case lower(coalesce(i.severity,'')) when 'major' then 1 when 'moderate' then 2 when 'minor' then 3 else 4 end`,[ids])).rows;const recorded=new Set(interactions.map(row=>pairKey(row.drug1_id,row.drug2_id)));for(let first=0;first<medicines.length;first++)for(let second=first+1;second<medicines.length;second++)if(!recorded.has(pairKey(medicines[first].id,medicines[second].id)))missingPairs.push(`${medicineLabel(medicines[first])} + ${medicineLabel(medicines[second])}`);}
    try {
      const generated=await generateMedicineExplanation({question:message,conversation,medicines:profiles,savedActiveMedicinesIncluded:[],interactions:interactions.map(row=>({pair:`${row.a} + ${row.b}`,severity:row.severity,type:row.interaction_type,description:clean(row.description),clinicalEffect:clinicalEffect(row.clinical_effect),source:clean(row.evidence_source)})),pairsWithoutRecords:missingPairs},request.signal);
      return json({answer:generated.answer.replace(/\*/g,''),remaining:2,generatedBy:{provider:'Ollama',model:generated.model}});
    } catch(error) {
      console.error('Guest Mistral preview error',error instanceof Error?error.message:'Unknown error');
      if(interactions.length>0){const top=interactions[0];return json({answer:`Database finding\n\nVediora found ${interactions.length} documented interaction record${interactions.length===1?'':'s'} for ${medicines.map(medicineLabel).join(', ')}. The highest recorded severity is ${top.severity||'not recorded'}.\n\nWhat the record says\n\n${clean(top.description)||'A description is not available in the imported record.'}\n\nWhat to do\n\nDo not stop, combine, or change a prescribed medicine based only on this preview. Review the combination with your doctor or pharmacist.`,remaining:2});}
      return json({answer:'I could not reach the local medical explanation model just now. Sign in to use the full workspace, or try the preview again shortly.',remaining:2});
    }
  } catch(error){console.error('Guest preview error',error instanceof Error?error.message:'Unknown error');return json({error:'The medicine preview is temporarily unavailable. You can still sign in to use your workspace.'},503);}
}

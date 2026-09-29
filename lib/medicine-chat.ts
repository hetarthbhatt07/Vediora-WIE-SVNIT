export interface DrugCatalogRow {
  drug_id: number;
  generic_name: string | null;
  brand_name: string | null;
  ingredient_name: string | null;
}

export interface RecognizedMedicine {
  id: number;
  name: string;
  brandName: string | null;
  matchedAlias: string | null;
}

export interface AmbiguousMedicineMention {
  mention: string;
  candidates: string[];
}

export interface InteractionFinding {
  id: number;
  medicineA: string;
  medicineB: string;
  severity: string | null;
  type: string | null;
  description: string | null;
  clinicalEffect: string | null;
  evidenceSource: string | null;
  referenceUrl: string | null;
}

export interface MedicineChatResult {
  answer: string;
  recognized: RecognizedMedicine[];
  interactions: InteractionFinding[];
  pairsWithoutRecords: string[];
  limitation: string;
  generatedBy?: { provider: 'Ollama'; model: string } | null;
  responseType?: 'medicine_information' | 'medical_education' | 'unsupported' | null;
  activeMedicinesIncluded?: RecognizedMedicine[];
}

const NON_WORDS = /[^a-z0-9]+/g;

// Common patient terms whose canonical database name is different. Keep this
// list small and map only to an exact imported ingredient/generic name.
const MEDICINE_ALIASES: Record<string, string[]> = {
  'acetylsalicylic acid': ['aspirin', 'asa'],
};

export function normalizeMedicineText(value: string) {
  return value.toLowerCase().replace(NON_WORDS, ' ').replace(/\s+/g, ' ').trim();
}

export function parseMedicineQuestion(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Please enter a medicine question.');
  const keys = Object.keys(value);
  if (keys.some(key => key !== 'message')) throw new Error('The request contains unsupported fields.');
  const message = typeof (value as { message?: unknown }).message === 'string' ? (value as { message: string }).message.trim() : '';
  if (message.length < 1) throw new Error('Please enter a medical question.');
  if (message.length > 2_000) throw new Error('Please keep the question under 2,000 characters.');
  return message;
}

export function referencesMedicineConversation(message: string) {
  return /^\W+$/.test(message)
    || /\b(it|them|those|these|that|this|more|detail|details|detailed|explain|elaborate|clarify|continue|previous|above|again|also|why|how|benefits?|advantages?|disadvantages?|risks?|warnings?|side effects?|dosage|dose|interaction|with it|with them)\b/i.test(message);
}

export function findMentionedMedicines(message: string, catalog: DrugCatalogRow[]): RecognizedMedicine[] {
  const normalizedMessage = ` ${normalizeMedicineText(message)} `;
  const matches = new Map<number, RecognizedMedicine>();

  for (const drug of catalog) {
    const databaseAliases = [drug.generic_name, drug.brand_name, drug.ingredient_name]
      .filter((alias): alias is string => typeof alias === 'string')
      .map(normalizeMedicineText)
      .filter(alias => alias.length >= 3);
    const canonicalNames = new Set(databaseAliases);
    const configuredAliases = [...canonicalNames]
      .flatMap(canonicalName => MEDICINE_ALIASES[canonicalName] || [])
      .map(normalizeMedicineText);
    const matchedDatabaseName = databaseAliases.find(alias => normalizedMessage.includes(` ${alias} `));
    const matchedAlias = configuredAliases.find(alias => normalizedMessage.includes(` ${alias} `));
    if (!matchedDatabaseName && !matchedAlias) continue;

    matches.set(drug.drug_id, {
      id: drug.drug_id,
      name: drug.generic_name?.trim() || drug.ingredient_name?.trim() || drug.brand_name?.trim() || `Medicine ${drug.drug_id}`,
      brandName: drug.brand_name?.trim() || null,
      matchedAlias: matchedAlias || null,
    });
  }

  return [...matches.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function findAmbiguousMedicineMentions(message: string, catalog: DrugCatalogRow[]): AmbiguousMedicineMention[] {
  const normalizedMessage = ` ${normalizeMedicineText(message)} `;
  const names = new Map<string, Set<string>>();
  for (const drug of catalog) {
    const canonical = drug.generic_name?.trim() || drug.ingredient_name?.trim() || drug.brand_name?.trim();
    if (!canonical) continue;
    const aliases = [drug.generic_name, drug.brand_name, drug.ingredient_name]
      .filter((alias): alias is string => typeof alias === 'string')
      .map(normalizeMedicineText)
      .filter(alias => alias.length >= 3 && normalizedMessage.includes(` ${alias} `));
    for (const alias of aliases) {
      const candidates = names.get(alias) || new Set<string>();
      candidates.add(canonical);
      names.set(alias, candidates);
    }
  }
  return [...names.entries()]
    .filter(([, candidates]) => candidates.size > 1)
    .map(([mention, candidates]) => ({ mention, candidates: [...candidates].sort().slice(0, 6) }));
}

export function pairKey(firstId: number, secondId: number) {
  return firstId < secondId ? `${firstId}:${secondId}` : `${secondId}:${firstId}`;
}

export function medicineLabel(medicine: RecognizedMedicine) {
  if (medicine.matchedAlias && normalizeMedicineText(medicine.matchedAlias) !== normalizeMedicineText(medicine.name)) {
    const displayAlias = medicine.matchedAlias === 'asa' ? 'ASA' : medicine.matchedAlias.replace(/\b\w/g, letter => letter.toUpperCase());
    return `${displayAlias} (${medicine.name})`;
  }
  if (!medicine.brandName || medicine.brandName.toLowerCase() === medicine.name.toLowerCase()) return medicine.name;
  return `${medicine.name} (${medicine.brandName})`;
}

export function makePatientAnswer(recognized: RecognizedMedicine[], interactions: InteractionFinding[], pairsWithoutRecords: string[]) {
  const names = recognized.map(medicineLabel).join(' and ');
  if (recognized.length === 0) {
    return "I couldn't confidently match a medicine name in your question. Please enter the generic or brand names of the medicines you want to compare.";
  }
  if (recognized.length === 1) {
    return `I recognized ${names}. To check for an interaction, please add the name of the other medicine. This check cannot tell whether a medicine will treat or cure your condition.`;
  }
  if (interactions.length === 0) {
    return `I recognized ${names}. I couldn't find a documented interaction for this combination in Vediora's current database. This does not confirm that they are safe together, and it does not tell whether they will treat or cure your condition. Please check with your doctor or pharmacist before making a medicine decision.`;
  }
  const recordText = interactions.length === 1 ? '1 documented interaction' : `${interactions.length} documented interactions`;
  const severityOrder: Record<string, number> = { major: 0, moderate: 1, minor: 2 };
  const highestSeverity = interactions
    .map(interaction => interaction.severity)
    .filter((severity): severity is string => !!severity)
    .sort((first, second) => (severityOrder[first.toLowerCase()] ?? 3) - (severityOrder[second.toLowerCase()] ?? 3))[0];
  const severityText = highestSeverity ? ` The highest recorded severity is ${highestSeverity}.` : '';
  const missingText = pairsWithoutRecords.length > 0 ? ` I also found ${pairsWithoutRecords.length} medicine pair${pairsWithoutRecords.length === 1 ? '' : 's'} with no interaction record in this database.` : '';
  return `I recognized ${names}. I found ${recordText}.${severityText}${missingText} This interaction check cannot tell whether these medicines will treat or cure your condition. Please review the details below with your doctor or pharmacist, and do not stop or change a prescribed medicine based only on this result.`;
}

export const MEDICINE_CHAT_LIMITATION = 'This response combines local Mistral medical knowledge with Vediora’s current medicine and interaction database when relevant. It does not replace a clinical assessment and may not account for your dose, allergies, conditions, pregnancy, laboratory results, or every possible interaction.';

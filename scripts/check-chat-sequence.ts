import { generateMedicineExplanation, type MedicineExplanationInput } from '@/lib/server/mistral';

const aspirin = {
  medicine: 'Aspirin (acetylsalicylic acid)', rxcui: '1191', ingredient: 'acetylsalicylic acid',
  brand: null, dosageForm: null, route: null, source: 'RxNorm',
};
const warfarin = {
  medicine: 'warfarin', rxcui: '11289', ingredient: 'warfarin',
  brand: null, dosageForm: null, route: null, source: 'RxNorm',
};
const interaction = {
  pair: 'acetylsalicylic acid + warfarin', severity: 'Major', type: 'Drug interaction',
  description: 'Warfarin may increase the anticoagulant activities of acetylsalicylic acid.',
  clinicalEffect: null, source: 'DDInter Database',
};

const transcript: Array<{ role: 'user' | 'assistant'; content: string }> = [];

async function run(label: string, input: MedicineExplanationInput) {
  const started = Date.now();
  try {
    const result = await generateMedicineExplanation(input);
    const elapsedSeconds = Math.round((Date.now() - started) / 100) / 10;
    console.log(JSON.stringify({
      label, ok: true, elapsedSeconds, responseType: result.responseType,
      promptTokens: result.promptTokens, completionTokens: result.completionTokens,
      answer: result.answer,
    }, null, 2));
    return result.answer;
  } catch (error) {
    console.log(JSON.stringify({ label, ok: false, elapsedSeconds: Math.round((Date.now() - started) / 100) / 10, error: error instanceof Error ? error.message : String(error) }, null, 2));
    return '';
  }
}

const firstQuestion = 'What does aspirin do? Explain its uses, benefits, disadvantages, side effects, and warnings.';
const firstAnswer = await run('chat-1-turn-1-aspirin', {
  question: firstQuestion, conversation: [], medicines: [aspirin], savedActiveMedicinesIncluded: [], interactions: [], pairsWithoutRecords: [],
});
transcript.push({ role: 'user', content: firstQuestion }, { role: 'assistant', content: firstAnswer.slice(0, 600) });

const secondQuestion = 'I also take warfarin. Explain both medicines and their documented interaction.';
const secondAnswer = await run('chat-1-turn-2-add-warfarin', {
  question: secondQuestion, conversation: transcript.slice(-6), medicines: [aspirin, warfarin], savedActiveMedicinesIncluded: [], interactions: [interaction], pairsWithoutRecords: [],
});
transcript.push({ role: 'user', content: secondQuestion }, { role: 'assistant', content: secondAnswer.slice(0, 600) });

await run('chat-1-turn-3-follow-up', {
  question: 'Explain aspirin and warfarin in more detail using the recent conversation and verified finding.',
  conversation: transcript.slice(-6), medicines: [aspirin, warfarin], savedActiveMedicinesIncluded: [], interactions: [interaction], pairsWithoutRecords: [],
});

await run('chat-2-fresh-warfarin', {
  question: 'What does warfarin do? Explain its uses, benefits, disadvantages, side effects, and warnings.',
  conversation: [], medicines: [warfarin], savedActiveMedicinesIncluded: [], interactions: [], pairsWithoutRecords: [],
});

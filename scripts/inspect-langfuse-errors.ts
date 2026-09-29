export {};

const baseUrl = process.env.LANGFUSE_BASE_URL;
const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
const secretKey = process.env.LANGFUSE_SECRET_KEY;
if (!baseUrl || !publicKey || !secretKey) throw new Error('Langfuse is not configured.');

const url = new URL('/api/public/v2/observations', baseUrl);
url.searchParams.set('name', 'mistral-medicine-explanation');
url.searchParams.set('limit', '10');
const response = await fetch(url, {
  headers: { Authorization: `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString('base64')}` },
});
if (!response.ok) throw new Error(`Langfuse returned HTTP ${response.status}.`);
const payload = await response.json() as { data?: Array<Record<string, unknown>> };
console.log(JSON.stringify((payload.data || []).map(item => ({
  startTime: item.startTime,
  level: item.level,
  statusMessage: item.statusMessage,
  model: item.model,
  metadata: item.metadata,
})), null, 2));

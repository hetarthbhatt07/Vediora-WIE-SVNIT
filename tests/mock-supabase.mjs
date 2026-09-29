// Local protocol fixture only. Never imported by application code.
import http from 'node:http';
import { createHmac } from 'node:crypto';

const accounts = [
  { id: '11111111-1111-4111-8111-111111111111', email: 'alice@example.test', name: 'Alice Patient' },
  { id: '22222222-2222-4222-8222-222222222222', email: 'bob@example.test', name: 'Bob Patient' },
];
const profiles = new Map(accounts.map(a => [a.id, { id: a.id, full_name: a.name, phone: null, date_of_birth: null, gender: null, blood_group: null, height_cm: null, weight_kg: null, account_type: 'patient', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]));
const user = a => ({ id: a.id, aud: 'authenticated', role: 'authenticated', email: a.email, email_confirmed_at: new Date().toISOString(), created_at: new Date().toISOString(), app_metadata: { provider: 'email' }, user_metadata: { full_name: a.name }, identities: [] });
const tokens = new Map();
const session = a => {
  const part = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub: a.id, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) })}`;
  const token = `${unsigned}.${createHmac('sha256', 'local-test-only').update(unsigned).digest('base64url')}`;
  tokens.set(token, a);
  return { access_token: token, refresh_token: `refresh-${a.id}`, token_type: 'bearer', expires_in: 3600, user: user(a) };
};
let missingTable = false;
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization,apikey,content-type,x-client-info,x-supabase-api-version');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  const url = new URL(req.url, 'http://127.0.0.1:54329');
  const reply = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  let body = '';
  for await (const chunk of req) body += chunk;
  let input = {};
  try { input = body ? JSON.parse(body) : {}; } catch { reply({ message: 'Invalid JSON' }, 400); return; }
  const account = tokens.get(req.headers.authorization?.replace('Bearer ', ''));
  if (url.pathname === '/health') return reply({ ok: true });
  if (url.pathname === '/test/missing-table') { missingTable = !!input.enabled; return reply({ ok: true }); }
  if (url.pathname === '/auth/v1/token') {
    const matched = accounts.find(a => input.email === a.email && input.password === 'test-only-password' || input.refresh_token === `refresh-${a.id}`);
    if (!matched) return reply({ code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400);
    return reply(session(matched));
  }
  if (url.pathname === '/auth/v1/user') {
    if (!account) return reply({ message: 'Invalid session' }, 401);
    return reply(user(account));
  }
  if (url.pathname === '/auth/v1/logout') { tokens.delete(req.headers.authorization?.replace('Bearer ', '')); res.writeHead(204).end(); return; }
  if (url.pathname === '/auth/v1/signup') return reply({ ...user({ ...accounts[0], email: input.email }), identities: [{ id: 'test-signup' }] });
  if (url.pathname === '/auth/v1/recover') return reply({});
  if (url.pathname === '/rest/v1/vediora_profiles') {
    if (missingTable) return reply({ code: 'PGRST205', message: 'Missing fixture table' }, 404);
    if (!account) return reply({ code: '42501', message: 'Forbidden' }, 403);
    // Enforce the same owner-only boundary as the migration, and require an explicit filter.
    if (url.searchParams.get('id') !== `eq.${account.id}`) return reply(null);
    if (req.method === 'PATCH') profiles.set(account.id, { ...profiles.get(account.id), ...input, updated_at: new Date().toISOString() });
    return reply(profiles.get(account.id));
  }
  reply({ message: 'Unknown fixture endpoint' }, 404);
});
server.listen(54329, '127.0.0.1', () => console.log('Synthetic Supabase fixture ready on 54329'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));

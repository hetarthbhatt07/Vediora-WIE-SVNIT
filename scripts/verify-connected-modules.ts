import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
const databaseUrl = new URL(process.env.DATABASE_URL);
databaseUrl.searchParams.delete('sslmode');
const client = new pg.Client({ connectionString: databaseUrl.toString(), ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const tables = await client.query<{ table_name: string }>(
    `select table_name from information_schema.tables
      where table_schema='public' and table_name = any($1::text[]) order by table_name`,
    [['vediora_patient_prescriptions', 'vediora_prescription_items', 'vediora_safety_reports']],
  );
  const reportColumns = await client.query<{ column_name: string }>(
    `select column_name from information_schema.columns
      where table_schema='public' and table_name='vediora_safety_reports' order by ordinal_position`,
  );
  const clinical = await client.query<{ drugs: string; interactions: string }>(
    `select (select count(*) from public.drugs)::text drugs,
            (select count(*) from public.drug_interactions)::text interactions`,
  );
  const expected = ['vediora_patient_prescriptions', 'vediora_prescription_items', 'vediora_safety_reports'];
  if (tables.rows.map(row => row.table_name).join(',') !== [...expected].sort().join(',')) throw new Error('Connected module tables are incomplete.');
  for (const column of ['evidence_snapshot', 'generated_by', 'generator_role', 'version']) {
    if (!reportColumns.rows.some(row => row.column_name === column)) throw new Error(`Missing report column: ${column}`);
  }
  console.log(JSON.stringify({ connectedTables: tables.rows.length, reportColumns: reportColumns.rows.length, clinicalData: clinical.rows[0] }));
} finally {
  await client.end();
}

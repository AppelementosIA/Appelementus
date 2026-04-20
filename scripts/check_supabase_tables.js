const { Client } = require("pg");

async function main() {
  const client = new Client({
    host: process.env.SUPABASE_DB_HOST,
    port: Number(process.env.SUPABASE_DB_PORT || 6543),
    database: process.env.SUPABASE_DB_NAME || "postgres",
    user: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
    query_timeout: 15000,
  });

  await client.connect();

  try {
    const result = await client.query(
      "select table_name from information_schema.tables where table_schema = 'public' and table_name in ('platform_users', 'platform_user_profiles', 'report_signers') order by table_name"
    );
    console.log(JSON.stringify(result.rows));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error && (error.stack || error.message) ? error.stack || error.message : error);
  process.exit(1);
});

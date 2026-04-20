const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

async function main() {
  const migrationPathArg = process.argv[2];

  if (!migrationPathArg) {
    throw new Error("Passe o caminho da migration como primeiro argumento.");
  }

  const migrationPath = path.resolve(process.cwd(), migrationPathArg);
  const sql = fs.readFileSync(migrationPath, "utf8");

  const client = new Client({
    host: process.env.SUPABASE_DB_HOST,
    port: Number(process.env.SUPABASE_DB_PORT || 6543),
    database: process.env.SUPABASE_DB_NAME || "postgres",
    user: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
    query_timeout: 60000,
  });

  console.log("CONNECTING");
  await client.connect();

  try {
    console.log(`RUNNING_MIGRATION ${migrationPath}`);
    await client.query(sql);
    console.log("MIGRATION_DONE");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error && (error.stack || error.message) ? error.stack || error.message : error);
  process.exit(1);
});

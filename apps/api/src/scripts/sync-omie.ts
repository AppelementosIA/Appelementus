import { syncOmieClients, syncOmieProjects } from "../lib/omie-sync.js";

function parseArg(name: string) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));

  if (!raw) {
    return null;
  }

  return raw.slice(prefix.length);
}

function getNumericArg(name: string, fallback: number) {
  const raw = parseArg(name);
  const parsed = Number(raw);

  if (!raw || !Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

async function main() {
  const target = process.argv[2] || "all";
  const pageSize = getNumericArg("page-size", 50);
  const maxPagesArg = parseArg("max-pages");
  const maxPages = maxPagesArg ? getNumericArg("max-pages", 1) : undefined;

  if (target === "clients") {
    console.log(
      JSON.stringify(
        {
          target,
          ...(await syncOmieClients({ pageSize, maxPages })),
        },
        null,
        2
      )
    );
    return;
  }

  if (target === "projects") {
    console.log(
      JSON.stringify(
        {
          target,
          ...(await syncOmieProjects({ pageSize, maxPages })),
        },
        null,
        2
      )
    );
    return;
  }

  const clients = await syncOmieClients({ pageSize, maxPages });
  const projects = await syncOmieProjects({ pageSize, maxPages });

  console.log(
    JSON.stringify(
      {
        target: "all",
        clients,
        projects,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Falha ao sincronizar dados da Omie."
  );
  process.exitCode = 1;
});

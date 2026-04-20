import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function parseEnvFile(contents: string) {
  const parsed: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value.replace(/\\n/g, "\n");
  }

  return parsed;
}

export function loadAppEnvironment() {
  const protectedKeys = new Set(Object.keys(process.env));
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const appRoot = resolve(currentDir, "..", "..");
  const repoRoot = resolve(appRoot, "..", "..");
  const envFiles = [
    resolve(repoRoot, ".env"),
    resolve(repoRoot, ".env.local"),
    resolve(appRoot, ".env"),
    resolve(appRoot, ".env.local"),
  ];

  for (const envFile of envFiles) {
    if (!existsSync(envFile)) {
      continue;
    }

    const parsed = parseEnvFile(readFileSync(envFile, "utf8"));

    for (const [key, value] of Object.entries(parsed)) {
      if (protectedKeys.has(key)) {
        continue;
      }

      process.env[key] = value;
    }
  }
}

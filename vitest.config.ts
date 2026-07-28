import { defineConfig } from "vitest/config";
import { readFileSync, existsSync } from "fs";
import path from "path";

// Charge .env manuellement : vitest ne le fait pas automatiquement, et on
// évite une dépendance supplémentaire (dotenv) pour un simple KEY=VALUE.
function loadDotEnv(envPath: string) {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv(path.resolve(__dirname, ".env"));

// Les tests tournent dans un schéma Postgres "test" dédié, sur la même base
// Supabase que le développement — jamais dans "public", pour ne jamais
// toucher aux données de démo. Toujours via DIRECT_URL (connexion non
// poolée) : plus simple et plus fiable pour de courtes suites de tests que
// de passer par le pooler PgBouncer.
function withTestSchema(url: string | undefined): string {
  if (!url) {
    throw new Error(
      "DIRECT_URL est requis pour lancer les tests (voir .env.example). " +
        "Renseignez la connexion directe Postgres (Supabase) dans .env."
    );
  }
  const [base, query = ""] = url.split("?");
  const params = new URLSearchParams(query);
  params.set("schema", "test");
  return `${base}?${params.toString()}`;
}

const testDatabaseUrl = withTestSchema(process.env.DIRECT_URL);

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    env: {
      DATABASE_URL: testDatabaseUrl,
      DIRECT_URL: testDatabaseUrl,
    },
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});

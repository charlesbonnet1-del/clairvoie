import { execSync } from "child_process";
import path from "path";

const rootDir = path.resolve(__dirname, "..");

/**
 * Pousse le schéma Prisma vers un schéma Postgres "test" dédié (voir
 * vitest.config.ts -> withTestSchema), distinct du schéma "public" utilisé
 * en développement/production. Exécuté une seule fois avant l'ensemble de
 * la suite (globalSetup).
 */
export default async function globalSetup() {
  const testDatabaseUrl = process.env.DIRECT_URL;
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: rootDir,
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
      DIRECT_URL: testDatabaseUrl,
    },
    stdio: "inherit",
  });
}

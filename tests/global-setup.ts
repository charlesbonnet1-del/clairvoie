import { execSync } from "child_process";
import path from "path";

const rootDir = path.resolve(__dirname, "..");
const testDbPath = path.resolve(rootDir, "prisma/test.db");

/**
 * Pousse le schéma Prisma vers une base SQLite dédiée aux tests, distincte
 * de la base de développement (prisma/dev.db). Exécuté une seule fois avant
 * l'ensemble de la suite (voir vitest.config.ts -> globalSetup).
 */
export default async function globalSetup() {
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: rootDir,
    env: { ...process.env, DATABASE_URL: `file:${testDbPath}` },
    stdio: "inherit",
  });
}

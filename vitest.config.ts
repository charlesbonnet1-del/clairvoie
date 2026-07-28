import { defineConfig } from "vitest/config";
import path from "path";

const testDbPath = path.resolve(__dirname, "prisma/test.db");

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    env: {
      DATABASE_URL: `file:${testDbPath}`,
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

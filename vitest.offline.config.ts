import { defineConfig } from "vitest/config";
import path from "node:path";

/** Dedicated configuration: it never loads the repository's default test setup. */
export default defineConfig({
  envDir: false,
  test: {
    environment: "node",
    include: ["tests/contracts/**/*.test.ts", "tests/integration/network-none-worker.v1.test.ts"],
    exclude: ["node_modules", ".next", "dist"],
    setupFiles: ["./tests/offline/setup.ts"],
    typecheck: {
      enabled: true,
      include: ["tests/contracts/**/*.test.ts"],
    },
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});

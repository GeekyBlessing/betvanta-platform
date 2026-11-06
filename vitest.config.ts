import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"], fileParallelism: false, testTimeout: 20000, setupFiles: ["tests/setup.ts"] },
});

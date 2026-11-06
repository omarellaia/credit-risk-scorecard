import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  resolve: { alias: { "@data": path.resolve(__dirname, "public/data"), "@": path.resolve(__dirname, "src") } },
  test: { include: ["src/**/*.test.ts"] },
});

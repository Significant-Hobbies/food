import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

// The native verification adapter cannot select Vitest's separate Worker config.
// Run the same repository-owned D1 regression with its authoritative config.
test("product-detail nutrient D1 migration regression", () => {
  const result = spawnSync(process.execPath, [
    "node_modules/vitest/vitest.mjs", "run", "--config", "vitest.worker.config.ts",
    "test/nutrient-detail.worker.test.ts",
  ], { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8", timeout: 120000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

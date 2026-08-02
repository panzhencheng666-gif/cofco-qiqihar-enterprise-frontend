import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import process from "node:process";
import { URL } from "node:url";
import { promisify } from "node:util";
import assert from "node:assert/strict";
import test from "node:test";

const exec = promisify(execFile);
const projectRoot = new URL("../", import.meta.url);
const guardScript = new URL("verify-architecture-guard.mjs", import.meta.url);
const stableFixtures = [
  "scripts/architecture-fixtures/dependency-cruiser.cjs",
  "scripts/architecture-fixtures/tsconfig.json",
  "scripts/architecture-fixtures/application/direct-react.ts",
  "scripts/architecture-fixtures/application/ui-barrel.ts",
  "scripts/architecture-fixtures/application/infrastructure-barrel.ts",
  "scripts/architecture-fixtures/domain/transitive-ui.ts",
  "scripts/architecture-fixtures/domain/alias-ui.ts",
  "scripts/architecture-fixtures/ui/index.ts",
  "scripts/architecture-fixtures/infrastructure/index.ts",
];

test("architecture probes are stable, read-only, and safe to run concurrently", async () => {
  for (const fixture of stableFixtures) {
    assert.equal(existsSync(new URL(fixture, projectRoot)), true, `missing ${fixture}`);
  }
  const before = await status();

  const [first, second] = await Promise.all([runGuard(), runGuard()]);

  assert.deepEqual(JSON.parse(first.stdout), JSON.parse(second.stdout));
  assert.deepEqual(JSON.parse(first.stdout), {
    errorCount: 5,
    covered: ["alias-ui", "direct-react", "infrastructure", "transitive-ui"],
  });
  assert.equal(await status(), before);
});

function runGuard() {
  return exec(process.execPath, [guardScript.pathname], {
    cwd: projectRoot,
    encoding: "utf8",
  });
}

async function status() {
  const result = await exec("git", ["status", "--short"], {
    cwd: projectRoot,
    encoding: "utf8",
  });
  return result.stdout;
}

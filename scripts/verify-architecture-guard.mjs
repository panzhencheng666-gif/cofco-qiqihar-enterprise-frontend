import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const result = spawnSync(
  process.execPath,
  [
    "node_modules/dependency-cruiser/bin/dependency-cruise.mjs",
    "scripts/architecture-fixtures",
    "--config",
    "scripts/architecture-fixtures/dependency-cruiser.cjs",
    "--output-type",
    "json",
  ],
  { cwd: projectRoot, encoding: "utf8" },
);
if (result.error || result.signal) {
  throw result.error ?? new Error(`Architecture probe interrupted by ${result.signal}`);
}
const report = JSON.parse(result.stdout || "{}");
const serializedViolations = JSON.stringify(report.summary?.violations ?? []);
const requiredEvidence = [
  "fixture-application-and-domain-must-not-reach-react-ui-or-infrastructure",
  "application/direct-react.ts",
  "node_modules/react/index.js",
  "application/ui-barrel.ts",
  "barrels/ui.ts",
  "domain/transitive-ui.ts",
  "application/infrastructure-barrel.ts",
  "barrels/infrastructure.ts",
  "infrastructure/index.ts",
  "domain/alias-ui.ts",
  "aliased-tsconfig-paths",
];
if (
  report.summary?.error !== 5 ||
  !requiredEvidence.every((evidence) => serializedViolations.includes(evidence))
) {
  throw new Error(
    `Architecture guard did not reject every stable fixture: ${serializedViolations}`,
  );
}
process.stdout.write(
  `${JSON.stringify({
    errorCount: report.summary.error,
    covered: ["alias-ui", "direct-react", "infrastructure", "transitive-ui"],
  })}\n`,
);

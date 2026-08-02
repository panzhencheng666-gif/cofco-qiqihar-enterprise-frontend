import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, rmdir, writeFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const applicationDirectory = fileURLToPath(
  new URL("../src/shared/application/", import.meta.url),
);
const domainDirectory = fileURLToPath(
  new URL("../src/shared/domain/", import.meta.url),
);
const directReactProbe = `${applicationDirectory}__architecture_probe_direct_react.ts`;
const barrelProbe = `${applicationDirectory}__architecture_probe_barrel.ts`;
const transitiveProbe = `${domainDirectory}__architecture_probe_transitive_ui.ts`;
const domainDirectoryExisted = existsSync(domainDirectory);

try {
  await mkdir(domainDirectory, { recursive: true });
  await writeFile(
    directReactProbe,
    'import React from "react";\nexport const architectureProbe = React;\n',
  );
  await writeFile(
    barrelProbe,
    'export { ListWorkbench as architectureProbe } from "../ui/list-workbench";\n',
  );
  await writeFile(
    transitiveProbe,
    'export { architectureProbe } from "../application/__architecture_probe_barrel";\n',
  );

  const result = spawnSync(
    process.execPath,
    [
      "node_modules/dependency-cruiser/bin/dependency-cruise.mjs",
      "src",
      "--config",
      ".dependency-cruiser.cjs",
      "--output-type",
      "json",
    ],
    { cwd: projectRoot, encoding: "utf8" },
  );
  const report = JSON.parse(result.stdout || "{}");
  const serializedViolations = JSON.stringify(report.summary?.violations ?? []);
  const requiredEvidence = [
    "application-and-domain-must-not-reach-react-ui-or-infrastructure",
    "__architecture_probe_direct_react",
    "__architecture_probe_transitive_ui",
    "node_modules/react/index.js",
    "src/shared/ui/list-workbench/index.ts",
  ];
  if (
    !Number.isInteger(report.summary?.error) ||
    report.summary.error < 2 ||
    !requiredEvidence.every((evidence) => serializedViolations.includes(evidence))
  ) {
    throw new Error(
      `Architecture guard did not reject the direct and transitive probes: ${serializedViolations}`,
    );
  }
} finally {
  await rm(directReactProbe, { force: true });
  await rm(barrelProbe, { force: true });
  await rm(transitiveProbe, { force: true });
  if (!domainDirectoryExisted) await rmdir(domainDirectory);
}

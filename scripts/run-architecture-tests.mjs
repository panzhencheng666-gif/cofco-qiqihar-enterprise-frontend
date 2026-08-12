import { spawn } from "node:child_process";
import process from "node:process";
import { resolveVerifiedNginx } from "./verified-nginx-tool.mjs";

const testFiles = [
  "scripts/verify-architecture-guard.node-test.mjs",
  "scripts/deploy-nginx-security.node-test.mjs",
  "scripts/verified-nginx-tool.node-test.mjs",
  "scripts/deploy-nginx-forwarding.node-test.mjs",
];

function printTool(tool) {
  process.stdout.write(
    `NGINX_TEST_TOOL_READY version=nginx/${tool.version} source_sha256=${tool.sourceSha256} binary=${tool.binaryPath}\n`,
  );
}

const tool = await resolveVerifiedNginx();
printTool(tool);

if (process.argv[2] === "--resolve-nginx") {
  process.exitCode = 0;
} else {
  const child = spawn(process.execPath, ["--test", ...testFiles], {
    env: { ...process.env, COFCO_TEST_NGINX_BIN: tool.binaryPath },
    stdio: "inherit",
  });
  const result = await new Promise((resolveChild, rejectChild) => {
    child.once("error", rejectChild);
    child.once("exit", (code, signal) => resolveChild({ code, signal }));
  });
  if (result.signal) {
    throw new Error(`architecture tests terminated by ${result.signal}`);
  }
  process.exitCode = result.code ?? 1;
}

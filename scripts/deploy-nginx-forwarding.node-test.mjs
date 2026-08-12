import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawn, spawnSync } from "node:child_process";
import { createServer, request } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { resolveVerifiedNginx } from "./verified-nginx-tool.mjs";

const nginxBinary =
  process.env.COFCO_TEST_NGINX_BIN ?? (await resolveVerifiedNginx()).binaryPath;
const forgedHeaders = {
  "x-actor": "forged-actor",
  "x-qiqihar-authenticated-subject": "forged-subject",
  "x-authenticated-subject": "forged-proxy-subject",
  "x-remote-user": "forged-remote-user",
};

test("nginx fixture exits promptly for missing tools and early child exits", async () => {
  const probeDirectory = await mkdtemp(
    join(tmpdir(), "cofco-frontend-nginx-lifecycle-"),
  );
  const earlyExitBinary = join(probeDirectory, "nginx-early-exit");
  const missingBinary = join(probeDirectory, "cofco-definitely-missing-nginx-binary");
  let earlyExitProcess;
  await writeFile(
    earlyExitBinary,
    '#!/usr/bin/env bash\ncase " $* " in *" -t "*) exit 0 ;; esac\nexit 23\n',
    { mode: 0o700 },
  );

  try {
    const missingCheck = spawnSync(missingBinary, ["-t"], {
      encoding: "utf8",
    });
    assert.throws(
      () => requireSuccessfulConfigCheck(missingCheck, missingBinary),
      /required nginx binary is unavailable/iu,
    );

    const earlyCheck = spawnSync(earlyExitBinary, ["-t"], {
      encoding: "utf8",
    });
    requireSuccessfulConfigCheck(earlyCheck, earlyExitBinary);
    const unusedPort = await reservePort();
    earlyExitProcess = watchProcess(
      spawn(earlyExitBinary, [], { stdio: ["ignore", "ignore", "pipe"] }),
      "nginx",
    );
    await assert.rejects(
      waitForHttp(unusedPort, earlyExitProcess),
      /nginx exited before readiness/iu,
    );
  } finally {
    try {
      await stopProcess(earlyExitProcess);
    } finally {
      await rm(probeDirectory, { recursive: true, force: true });
    }
  }
});

async function listen(server) {
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  return server.address().port;
}

async function closeServer(server) {
  if (!server?.listening) return;
  server.closeAllConnections?.();
  await new Promise((resolveClose) => server.close(resolveClose));
}

async function reservePort() {
  const probe = createServer();
  try {
    return await listen(probe);
  } finally {
    await closeServer(probe);
  }
}

function watchProcess(child, label) {
  let outcome;
  let stderr = "";
  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk) => {
    stderr += chunk;
  });
  const terminated = new Promise((resolveTermination) => {
    const settle = (nextOutcome) => {
      if (outcome) return;
      outcome = nextOutcome;
      resolveTermination(nextOutcome);
    };
    child.once("error", (error) => settle({ error }));
    child.once("exit", (code, signal) => settle({ code, signal }));
    child.once("close", (code, signal) => settle({ code, signal }));
  });
  return {
    child,
    label,
    terminated,
    get outcome() {
      return outcome;
    },
    get stderr() {
      return stderr;
    },
  };
}

function processExitError(processHandle, outcome) {
  if (outcome.error) {
    return new Error(
      `${processHandle.label} failed to spawn: ${outcome.error.message}`,
    );
  }
  const detail = processHandle.stderr.trim();
  return new Error(
    `${processHandle.label} exited before readiness (code=${String(outcome.code)} signal=${String(outcome.signal)})${detail ? `: ${detail}` : ""}`,
  );
}

async function stopProcess(processHandle) {
  if (!processHandle) return;
  if (!processHandle.outcome) processHandle.child.kill("SIGQUIT");
  let outcome = await Promise.race([
    processHandle.terminated,
    delay(2_000, undefined, { ref: false }).then(() => undefined),
  ]);
  if (!outcome) {
    processHandle.child.kill("SIGKILL");
    outcome = await Promise.race([
      processHandle.terminated,
      delay(1_000, undefined, { ref: false }).then(() => undefined),
    ]);
  }
  assert.notEqual(outcome, undefined, `${processHandle.label} did not terminate`);
}

function requireSuccessfulConfigCheck(result, binary = nginxBinary) {
  if (result.error) {
    throw new Error(
      `required nginx binary is unavailable: ${binary}: ${result.error.message}`,
    );
  }
  assert.equal(result.signal, null, `nginx -t terminated by ${result.signal}`);
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function httpGet(port, path, signal) {
  return new Promise((resolveRequest, rejectRequest) => {
    const outgoing = request(
      { host: "127.0.0.1", port, path, headers: forgedHeaders, signal },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () =>
          resolveRequest({
            status: response.statusCode,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    outgoing.once("error", rejectRequest);
    outgoing.setTimeout(500, () => {
      outgoing.destroy(new Error("nginx HTTP probe timed out"));
    });
    outgoing.end();
  });
}

async function waitForHttp(port, processHandle) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (processHandle.outcome) {
      throw processExitError(processHandle, processHandle.outcome);
    }
    const abortController = new globalThis.AbortController();
    let result;
    try {
      result = await Promise.race([
        httpGet(port, "/healthz", abortController.signal).then(
          () => ({ ready: true }),
          () => ({ ready: false }),
        ),
        processHandle.terminated.then((outcome) => ({ outcome })),
      ]);
    } finally {
      abortController.abort();
    }
    if (result.outcome) throw processExitError(processHandle, result.outcome);
    if (result.ready) return;
    await delay(10);
  }
  throw new Error("nginx did not become ready");
}

test("real nginx removes forged identity headers from api and actuator proxies while rendering healthz locally", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cofco-frontend-nginx-"));
  let nginxProcess;
  let upstream;

  try {
    await mkdir(join(directory, "logs"), { mode: 0o700 });
    upstream = createServer((incoming, response) => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(incoming.headers));
    });
    const upstreamPort = await listen(upstream);
    const proxyPort = await reservePort();
    const source = await readFile(
      resolve(import.meta.dirname, "../deploy/nginx.conf"),
      "utf8",
    );
    const server = source
      .replace("listen 8080;", `listen 127.0.0.1:${proxyPort};`)
      .replaceAll(
        "proxy_pass http://backend:8090;",
        `proxy_pass http://127.0.0.1:${upstreamPort};`,
      );
    const configPath = join(directory, "nginx.conf");
    await writeFile(
      configPath,
      `daemon off;\npid ${join(directory, "nginx.pid")};\nevents {}\nhttp {\n${server}\n}\n`,
      { mode: 0o600 },
    );
    const nginxArgs = ["-p", directory, "-c", configPath];
    const checked = spawnSync(nginxBinary, [...nginxArgs, "-t"], {
      encoding: "utf8",
    });
    requireSuccessfulConfigCheck(checked);
    nginxProcess = watchProcess(
      spawn(nginxBinary, nginxArgs, { stdio: ["ignore", "ignore", "pipe"] }),
      "nginx",
    );
    await waitForHttp(proxyPort, nginxProcess);

    for (const path of ["/api/whoami", "/actuator/health"]) {
      const response = await httpGet(proxyPort, path);
      assert.equal(response.status, 200, `${path}: ${response.body}`);
      const received = JSON.parse(response.body);
      for (const header of Object.keys(forgedHeaders)) {
        assert.equal(received[header], undefined, `${path} forwarded ${header}`);
      }
    }
    const health = await httpGet(proxyPort, "/healthz");
    assert.equal(health.status, 200);
    assert.equal(health.body, "ok\n");
  } finally {
    try {
      await stopProcess(nginxProcess);
    } finally {
      try {
        await closeServer(upstream);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
  }
});

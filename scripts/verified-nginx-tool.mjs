import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  open,
  readFile,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

export const nginxToolVersion = "1.30.4";
export const nginxSourceSha256 =
  "4261dc90e9e47c1c4041276e9aaa3d48ebe2e664f728e14fa95ae6c67d57a08b";

const sourceUrl = `https://nginx.org/download/nginx-${nginxToolVersion}.tar.gz`;
const cacheRoot = join(
  tmpdir(),
  "cofco-qiqihar-test-tools",
  "nginx",
  nginxToolVersion,
  `${process.platform}-${process.arch}`,
);
const binaryPath = join(cacheRoot, "sbin/nginx");
const manifestPath = join(cacheRoot, "manifest.json");
const lockPath = `${cacheRoot}.lock`;
const lockWaitMilliseconds = 180_000;

async function sha256(path) {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: options.env ?? process.env,
  });
  if (result.error) {
    throw new Error(`${command} is unavailable: ${result.error.message}`);
  }
  if (result.signal || result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed (status=${String(result.status)} signal=${String(result.signal)}):\n${result.stderr || result.stdout}`,
    );
  }
  return result;
}

function assertExpectedVersion(path) {
  const result = run(path, ["-v"]);
  const output = `${result.stdout}\n${result.stderr}`;
  if (!new RegExp(`nginx/${nginxToolVersion}(?:\\s|$)`, "u").test(output)) {
    throw new Error(
      `verified nginx version mismatch: expected ${nginxToolVersion}, received ${output.trim()}`,
    );
  }
}

async function readVerifiedCache() {
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (
      manifest.version !== nginxToolVersion ||
      manifest.sourceSha256 !== nginxSourceSha256 ||
      manifest.platform !== process.platform ||
      manifest.arch !== process.arch ||
      manifest.binarySha256 !== (await sha256(binaryPath))
    ) {
      return undefined;
    }
    assertExpectedVersion(binaryPath);
    return {
      binaryPath,
      binarySha256: manifest.binarySha256,
      sourceSha256: manifest.sourceSha256,
      version: manifest.version,
    };
  } catch {
    return undefined;
  }
}

async function downloadSource(destination) {
  const response = await globalThis.fetch(sourceUrl, {
    redirect: "follow",
    signal: globalThis.AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(
      `failed to download verified nginx source: ${response.status} ${response.statusText}`,
    );
  }
  await writeFile(destination, Buffer.from(await response.arrayBuffer()), {
    mode: 0o600,
  });
  const actualSha256 = await sha256(destination);
  if (actualSha256 !== nginxSourceSha256) {
    throw new Error(
      `nginx source digest mismatch: expected ${nginxSourceSha256}, received ${actualSha256}`,
    );
  }
}

async function buildVerifiedTool() {
  const buildRoot = await mkdtemp(join(tmpdir(), `cofco-nginx-${nginxToolVersion}-`));
  try {
    const archivePath = join(buildRoot, `nginx-${nginxToolVersion}.tar.gz`);
    await downloadSource(archivePath);
    run("tar", ["-xzf", archivePath, "-C", buildRoot]);
    const sourceDirectory = join(buildRoot, `nginx-${nginxToolVersion}`);
    run("./configure", [`--prefix=${cacheRoot}`, "--without-http_gzip_module"], {
      cwd: sourceDirectory,
    });
    run("make", ["-j2"], { cwd: sourceDirectory });

    const stagedRoot = join(buildRoot, "ready");
    const stagedBinary = join(stagedRoot, "sbin/nginx");
    await mkdir(dirname(stagedBinary), { recursive: true, mode: 0o700 });
    await copyFile(join(sourceDirectory, "objs/nginx"), stagedBinary);
    await chmod(stagedBinary, 0o700);
    assertExpectedVersion(stagedBinary);
    const binarySha256 = await sha256(stagedBinary);
    await writeFile(
      join(stagedRoot, "manifest.json"),
      `${JSON.stringify(
        {
          arch: process.arch,
          binarySha256,
          platform: process.platform,
          sourceSha256: nginxSourceSha256,
          sourceUrl,
          version: nginxToolVersion,
        },
        undefined,
        2,
      )}\n`,
      { mode: 0o600 },
    );
    await rm(cacheRoot, { recursive: true, force: true });
    await mkdir(dirname(cacheRoot), { recursive: true, mode: 0o700 });
    await rename(stagedRoot, cacheRoot);
  } finally {
    await rm(buildRoot, { recursive: true, force: true });
  }
}

function ownerIsAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

async function removeStaleLock() {
  try {
    const owner = JSON.parse(await readFile(lockPath, "utf8"));
    if (ownerIsAlive(owner.pid)) return false;
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    return false;
  }
  await unlink(lockPath).catch((error) => {
    if (error?.code !== "ENOENT") throw error;
  });
  return true;
}

async function acquireBuildLock() {
  await mkdir(dirname(lockPath), { recursive: true, mode: 0o700 });
  const deadline = Date.now() + lockWaitMilliseconds;
  while (Date.now() < deadline) {
    try {
      const handle = await open(lockPath, "wx", 0o600);
      await handle.writeFile(
        `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`,
      );
      return handle;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const ready = await readVerifiedCache();
      if (ready) return ready;
      if (!(await removeStaleLock())) await delay(250);
    }
  }
  throw new Error(`timed out waiting for verified nginx tool lock: ${lockPath}`);
}

export async function resolveVerifiedNginx() {
  const cached = await readVerifiedCache();
  if (cached) return cached;

  const lock = await acquireBuildLock();
  if (!("close" in lock)) return lock;
  try {
    const readyAfterLock = await readVerifiedCache();
    if (readyAfterLock) return readyAfterLock;
    await buildVerifiedTool();
    const built = await readVerifiedCache();
    if (!built) throw new Error("verified nginx cache was invalid after build");
    return built;
  } finally {
    await lock.close();
    await unlink(lockPath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  }
}

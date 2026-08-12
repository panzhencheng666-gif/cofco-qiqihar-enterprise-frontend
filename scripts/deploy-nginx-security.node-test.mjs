import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

test("container proxy strips all client-controlled identity headers", async () => {
  const nginx = await readFile(
    resolve(import.meta.dirname, "../deploy/nginx.conf"),
    "utf8",
  );

  const proxyLocations = ["api", "actuator"].map((name) => {
    const start = nginx.indexOf(`location /${name}/`);
    const end = nginx.indexOf("\n  }", start);
    return nginx.slice(start, end);
  });
  assert.equal(proxyLocations.length, 2);
  for (const location of proxyLocations) {
    for (const header of [
      "X-Actor",
      "X-Qiqihar-Authenticated-Subject",
      "X-Authenticated-Subject",
      "X-Remote-User",
    ]) {
      assert.match(location, new RegExp(`proxy_set_header ${header} "";`, "u"));
    }
  }
  assert.doesNotMatch(nginx, /\$http_x_qiqihar_authenticated_subject/u);
});

test("overview container uses unprivileged nginx and a dedicated health probe", async () => {
  const [dockerfile, nginx] = await Promise.all([
    readFile(resolve(import.meta.dirname, "../Dockerfile"), "utf8"),
    readFile(resolve(import.meta.dirname, "../deploy/nginx.conf"), "utf8"),
  ]);

  assert.match(dockerfile, /nginxinc\/nginx-unprivileged:/u);
  assert.doesNotMatch(dockerfile, /^FROM nginx:/mu);
  assert.match(nginx, /location = \/healthz/u);
  assert.match(nginx, /server_tokens off;/u);
});

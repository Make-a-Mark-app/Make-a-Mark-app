import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = path.join(projectRoot, "deploy/local/compose.yaml");
const envFile = path.join(projectRoot, ".env.example");

function resolvedCompose(overrides = {}) {
  const env = { ...process.env, WEB_PORT: "8080", GRAFANA_PORT: "3000", GRAFANA_PASSWORD: "compose-config-test-password", ...overrides };
  const result = spawnSync("docker", ["compose", "--env-file", envFile, "-f", composeFile, "config", "--format", "json"], {
    cwd: projectRoot,
    encoding: "utf8",
    env,
  });
  return result;
}

test("the local Compose contract exposes only loopback web and Grafana ports", () => {
  const result = resolvedCompose();
  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(result.stdout);

  assert.equal(config.name, "cognizant-local");
  assert.deepEqual(Object.keys(config.services).sort(), ["alloy", "api", "grafana", "loki", "prometheus", "web"]);
  assert.deepEqual(config.services.web.ports.map(({ target, published, protocol, host_ip }) => ({ target, published, protocol, host_ip })), [
    { target: 80, published: "8080", protocol: "tcp", host_ip: "127.0.0.1" },
  ]);
  assert.deepEqual(config.services.grafana.ports.map(({ target, published, protocol, host_ip }) => ({ target, published, protocol, host_ip })), [
    { target: 3000, published: "3000", protocol: "tcp", host_ip: "127.0.0.1" },
  ]);
  for (const service of ["api", "prometheus", "loki", "alloy"]) {
    assert.equal(config.services[service].ports, undefined, `${service} must not publish a host port`);
  }

  const apiEnvironment = config.services.api.environment;
  assert.equal(apiEnvironment.ENGINEER_PROVIDER_ENABLED, "false");
  assert.equal(apiEnvironment.ENGINEER_PROVIDER_URL, "");
  assert.equal(apiEnvironment.ENGINEER_PROVIDER_API_KEY, "");
  for (const [serviceName, service] of Object.entries(config.services)) {
    if (serviceName !== "api") {
      assert.equal(service.environment?.ENGINEER_PROVIDER_URL, undefined, `${serviceName} must not receive provider configuration`);
      assert.equal(service.environment?.ENGINEER_PROVIDER_API_KEY, undefined, `${serviceName} must not receive provider credentials`);
      assert.equal(service.environment?.ENGINEER_PROVIDER_ENABLED, undefined, `${serviceName} must not receive the provider flag`);
    }
  }

  assert.equal(config.services.grafana.environment.GF_SECURITY_ADMIN_USER, "admin");
  assert.equal(config.services.grafana.environment.GF_SECURITY_ADMIN_PASSWORD, "compose-config-test-password");
  assert.equal(config.services.grafana.environment.GF_USERS_ALLOW_SIGN_UP, "false");
});

test("loopback ports are configurable", () => {
  const result = resolvedCompose({ WEB_PORT: "8181", GRAFANA_PORT: "3131" });
  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(result.stdout);
  assert.equal(config.services.web.ports[0].published, "8181");
  assert.equal(config.services.web.ports[0].host_ip, "127.0.0.1");
  assert.equal(config.services.grafana.ports[0].published, "3131");
  assert.equal(config.services.grafana.ports[0].host_ip, "127.0.0.1");
});

test("Compose refuses to start without a locally generated Grafana password", () => {
  const result = resolvedCompose({ GRAFANA_PASSWORD: "" });
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /GRAFANA_PASSWORD/i);
});

test("local setup creates a private password once and preserves existing settings", () => {
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "make-a-mark-compose-setup-"));
  const scriptsDirectory = path.join(temporaryRoot, "scripts");
  const scriptPath = path.join(projectRoot, "scripts/setup-local-env.mjs");
  const examplePath = path.join(projectRoot, ".env.example");

  try {
    const tempScriptDirectory = path.join(temporaryRoot, "scripts");
    mkdirSync(scriptsDirectory, { recursive: true });
    copyFileSync(scriptPath, path.join(tempScriptDirectory, "setup-local-env.mjs"));
    copyFileSync(examplePath, path.join(temporaryRoot, ".env.example"));

    execFileSync(process.execPath, [path.join(tempScriptDirectory, "setup-local-env.mjs")], { cwd: temporaryRoot });
    const generatedPath = path.join(temporaryRoot, ".env");
    const generated = readFileSync(generatedPath, "utf8");
    const password = generated.match(/^GRAFANA_PASSWORD=(.+)$/m)?.[1];
    assert.ok(password && password !== "admin");
    assert.match(generated, /^ENGINEER_PROVIDER_ENABLED=false$/m);
    assert.equal(statSync(generatedPath).mode & 0o777, 0o600);

    writeFileSync(generatedPath, generated + "LOCAL_CUSTOM_SETTING=preserve-me\n");
    const beforeRerun = readFileSync(generatedPath, "utf8");
    execFileSync(process.execPath, [path.join(tempScriptDirectory, "setup-local-env.mjs")], { cwd: temporaryRoot });
    assert.equal(readFileSync(generatedPath, "utf8"), beforeRerun);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

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

  const apiLogVolume = config.services.api.volumes.find(({ target }) => target === "/var/log/cognizant");
  const alloyLogVolume = config.services.alloy.volumes.find(({ target }) => target === "/var/log/cognizant");
  const alloyPositionVolume = config.services.alloy.volumes.find(({ target }) => target === "/var/lib/alloy/data");
  assert.equal(apiLogVolume?.source, "service-logs");
  assert.equal(apiLogVolume?.read_only, undefined);
  assert.equal(alloyLogVolume?.source, "service-logs");
  assert.equal(alloyLogVolume?.read_only, true);
  assert.equal(alloyPositionVolume?.source, "alloy-data");
  assert.equal(alloyPositionVolume?.read_only, undefined);
  for (const volume of ["grafana-data", "loki-data", "prometheus-data", "service-logs", "alloy-data"]) {
    assert.ok(config.volumes[volume], `the Compose project must own ${volume}`);
  }
  assert.deepEqual(Object.keys(config.volumes).sort(), ["alloy-data", "grafana-data", "loki-data", "prometheus-data", "service-logs"]);
  assert.equal(JSON.stringify(config.services.alloy.volumes).includes("docker.sock"), false);
  const alloyConfig = readFileSync(path.join(projectRoot, "deploy/local/alloy/config.alloy"), "utf8");
  assert.match(alloyConfig, /loki\.source\.file/);
  assert.match(alloyConfig, /local\.file_match/);
  assert.match(alloyConfig, /stage\.label_keep/);
  assert.doesNotMatch(alloyConfig, /docker\.sock|discovery\.docker/);

  const apiEnvironment = config.services.api.environment;
  assert.equal(apiEnvironment.ENGINEER_PROVIDER_ENABLED, "false");
  assert.equal(apiEnvironment.ENGINEER_PROVIDER_URL, "https://kiraai.vn/api/v1/chat/completions");
  assert.equal(apiEnvironment.ENGINEER_PROVIDER_API_KEY, "");
  assert.equal(apiEnvironment.ENGINEER_PROVIDER_MODEL, "gpt-oss-120b");
  for (const [serviceName, service] of Object.entries(config.services)) {
    if (serviceName !== "api") {
      assert.equal(service.environment?.ENGINEER_PROVIDER_URL, undefined, `${serviceName} must not receive provider configuration`);
      assert.equal(service.environment?.ENGINEER_PROVIDER_API_KEY, undefined, `${serviceName} must not receive provider credentials`);
      assert.equal(service.environment?.ENGINEER_PROVIDER_ENABLED, undefined, `${serviceName} must not receive the provider flag`);
      assert.equal(service.environment?.ENGINEER_PROVIDER_MODEL, undefined, `${serviceName} must not receive the provider model configuration`);
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
    assert.match(generated, /^ENGINEER_PROVIDER_URL=https:\/\/kiraai\.vn\/api\/v1\/chat\/completions$/m);
    assert.match(generated, /^ENGINEER_PROVIDER_MODEL=gpt-oss-120b$/m);
    assert.match(readFileSync(path.join(projectRoot, ".gitignore"), "utf8"), /^\.env$/m);
    assert.match(readFileSync(path.join(projectRoot, ".dockerignore"), "utf8"), /^\.env$/m);
    assert.equal(statSync(generatedPath).mode & 0o777, 0o600);

    writeFileSync(generatedPath, generated + "LOCAL_CUSTOM_SETTING=preserve-me\n");
    const beforeRerun = readFileSync(generatedPath, "utf8");
    execFileSync(process.execPath, [path.join(tempScriptDirectory, "setup-local-env.mjs")], { cwd: temporaryRoot });
    assert.equal(readFileSync(generatedPath, "utf8"), beforeRerun);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("local observability applies retention targets and provisions actionable dashboards and alerts", () => {
  const result = resolvedCompose();
  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(result.stdout);
  const prometheusArgs = config.services.prometheus.command.join(" ");
  assert.match(prometheusArgs, /--storage\.tsdb\.retention\.time=15d/);
  assert.match(prometheusArgs, /--storage\.tsdb\.retention\.size=850MB/);

  const prometheusConfig = readFileSync(path.join(projectRoot, "deploy/local/prometheus/prometheus.yml"), "utf8");
  assert.match(prometheusConfig, /job_name:\s*loki[\s\S]*?targets:\s*\[loki:3100\]/);
  const lokiConfig = readFileSync(path.join(projectRoot, "deploy/local/loki/config.yaml"), "utf8");
  assert.match(lokiConfig, /retention_period:\s*168h/);
  assert.match(lokiConfig, /reporting_enabled:\s*false/);

  const grafanaProvisioning = path.join(projectRoot, "deploy/local/grafana/provisioning");
  const dashboard = JSON.parse(readFileSync(path.join(grafanaProvisioning, "dashboards/impact-drive.json"), "utf8"));
  const dashboardText = JSON.stringify(dashboard);
  for (const signal of ["API availability", "API latency p95", "HTTP request rate by status", "Validation failures", "Race Engineer response modes", "Optional provider errors", "Prometheus storage", "Local log volume", "Loki WAL disk usage"]) {
    assert.ok(dashboardText.includes(signal), "dashboard must show " + signal);
  }
  const alertingPath = path.join(grafanaProvisioning, "alerting/alerts.yaml");
  const alerting = readFileSync(alertingPath, "utf8");
  assert.match(alerting, /API Down/);
  assert.match(alerting, /for:\s*1m/);
  assert.match(alerting, /Prometheus Storage Target/);
  assert.match(alerting, /858993459/);
  assert.match(alerting, /80%/);
  assert.match(alerting, /WAL Disk Full/);
  assert.match(alerting, /loki_ingester_wal_disk_full_failures_total/);
  assert.doesNotMatch(alerting, /latency|validation|provider error/i);
  assert.doesNotMatch(alerting, /contactPoints:|receivers:|https?:\/\//i);
  const grafanaProvisioningVolume = config.services.grafana.volumes.find(({ target }) => target === "/etc/grafana/provisioning");
  assert.ok(grafanaProvisioningVolume);
  assert.equal(grafanaProvisioningVolume.read_only, true);
  assert.equal(config.services.grafana.environment.GF_ANALYTICS_REPORTING_ENABLED, "false");

  const docs = readFileSync(path.join(projectRoot, "docs/build-plan/step-05-local-containers-and-observability.md"), "utf8");
  for (const statement of ["15 days", "850 MiB", "1 GiB", "7 days", "2 GiB", "256 MiB", "age-based", "disk pressure", "API continues serving"]) {
    assert.ok(docs.toLowerCase().includes(statement.toLowerCase()), "docs must explain " + statement);
  }
  const readme = readFileSync(path.join(projectRoot, "README.md"), "utf8");
  for (const statement of ["npm run setup:local", "WEB_PORT", "GRAFANA_PORT", "up --build web api", "down --volumes", "alloy-data", "Clear my discoveries"]) {
    assert.ok(readme.includes(statement), `README must document ${statement}`);
  }
  assert.match(readme, /down --volumes[\s\S]*?service-logs[\s\S]*?alloy-data/);
  assert.match(readme, /\.env[\s\S]*?versioned demo fixture[\s\S]*?source-reviewed evidence/);
  assert.match(readme, /\/summary[\s\S]*?Clear my discoveries/);
});

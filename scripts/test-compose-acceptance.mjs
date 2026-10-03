import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const webPort = process.env.WEB_PORT ?? "8080";
const projectName = `make-a-mark-r1-acceptance-${process.pid}`;
const composeArgs = ["compose", "--project-name", projectName, "--env-file", ".env.example", "-f", "deploy/local/compose.yaml"];
const environment = {
  ...process.env,
  WEB_PORT: webPort,
  GRAFANA_PASSWORD: randomBytes(32).toString("base64url"),
  ENGINEER_PROVIDER_ENABLED: "false",
  ENGINEER_PROVIDER_URL: "",
  ENGINEER_PROVIDER_API_KEY: "",
};

function run(command, args, env = environment) {
  const result = spawnSync(command, args, { stdio: "inherit", env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} exited with status ${result.status ?? "unknown"}.`);
}

function capture(command, args, env = environment) {
  const result = spawnSync(command, args, { encoding: "utf8", env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} exited with status ${result.status ?? "unknown"}: ${result.stderr}`);
  return result.stdout;
}

let startupAttempted = false;
try {
  startupAttempted = true;
  run("docker", [...composeArgs, "up", "--build", "--detach", "--wait", "--wait-timeout", "180"]);
  run("npx", ["playwright", "test", "tests/compose-acceptance.spec.ts"], {
    ...environment,
    PLAYWRIGHT_EXTERNAL: "1",
    PLAYWRIGHT_BASE_URL: `http://127.0.0.1:${webPort}`,
  });
  run("docker", [...composeArgs, "exec", "-T", "alloy", "/bin/bash", "-c", "test -r /var/log/cognizant/api.jsonl && ! test -w /var/log/cognizant/api.jsonl"]);

  const logContents = capture("docker", [...composeArgs, "exec", "-T", "api", "node", "-e", "process.stdout.write(require('node:fs').readFileSync('/var/log/cognizant/api.jsonl', 'utf8'))"]);
  if (logContents.includes("SENTINEL_QUESTION_SHOULD_NOT_BE_LOGGED")) {
    throw new Error("A request question sentinel was found in the shared service log volume.");
  }
  const stdoutLogs = capture("docker", [...composeArgs, "logs", "--no-color", "api"]);
  if (!stdoutLogs.includes('"route":"/api/health"') || stdoutLogs.includes("SENTINEL_QUESTION_SHOULD_NOT_BE_LOGGED")) {
    throw new Error("API stdout logs are missing the health event or include the request sentinel.");
  }
  const records = logContents.trim().split("\n").map((line) => JSON.parse(line));
  if (!records.some((record) => record.route === "/api/health") || !records.some((record) => record.route === "/api/engineer")) {
    throw new Error("The shared service log volume is missing expected API route records.");
  }
  const queryLoki = `const url = new URL('http://loki:3100/loki/api/v1/query_range'); url.searchParams.set('query', '{service="api"}'); url.searchParams.set('start', String(BigInt(Date.now() - 60000) * 1000000n)); url.searchParams.set('end', String(BigInt(Date.now()) * 1000000n)); url.searchParams.set('limit', '100'); const deadline = Date.now() + 15000; while (Date.now() < deadline) { const response = await fetch(url); if (!response.ok) throw new Error('Loki query failed.'); const result = await response.json(); if (result.data?.result?.length) { process.stdout.write(JSON.stringify(result.data.result)); process.exit(0); } await new Promise((resolve) => setTimeout(resolve, 500)); } process.exit(2);`;
  const forwardedStreams = JSON.parse(capture("docker", [...composeArgs, "exec", "-T", "api", "node", "--input-type=module", "-e", queryLoki]));
  if (!forwardedStreams.length) throw new Error("Loki did not return any forwarded API service logs.");
  const forwardedLogs = forwardedStreams.flatMap((stream) => stream.values.map(([, line]) => line)).join("\n");
  for (const stream of forwardedStreams) {
    if (Object.keys(stream.stream).sort().join(",") !== "environment,service,severity") {
      throw new Error(`Loki log stream has unexpected labels: ${Object.keys(stream.stream).join(",")}`);
    }
  }
  if (forwardedLogs.includes("SENTINEL_QUESTION_SHOULD_NOT_BE_LOGGED")) {
    throw new Error("A request question sentinel was forwarded to Loki.");
  }
} finally {
  if (startupAttempted) {
    try {
      run("docker", [...composeArgs, "down", "--volumes"]);
    } catch (error) {
      process.stderr.write(`Compose cleanup failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
    }
  }
}

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

let startupAttempted = false;
try {
  startupAttempted = true;
  run("docker", [...composeArgs, "up", "--build", "--detach", "--wait", "--wait-timeout", "180"]);
  run("npx", ["playwright", "test", "tests/compose-acceptance.spec.ts"], {
    ...environment,
    PLAYWRIGHT_EXTERNAL: "1",
    PLAYWRIGHT_BASE_URL: `http://127.0.0.1:${webPort}`,
  });
} finally {
  if (startupAttempted) {
    try {
      run("docker", [...composeArgs, "down", "--volumes"]);
    } catch (error) {
      process.stderr.write(`Compose cleanup failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
    }
  }
}

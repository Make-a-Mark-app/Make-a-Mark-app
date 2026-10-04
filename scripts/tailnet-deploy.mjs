import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = "deploy/local/compose.yaml";
const composeProject = "make-a-mark-tailnet";
const stateDirectory = path.join(projectRoot, ".tailnet-state");
const stateFile = path.join(stateDirectory, "deployment.json");
const defaultWebPort = 8081;
const defaultGrafanaPort = 3001;
const servePath = "/";
const candidateServePorts = Array.from({ length: 101 }, (_, index) => 10000 + index);

process.chdir(projectRoot);

function command(program, args, { capture = false, env = process.env } = {}) {
  const result = spawnSync(program, args, {
    cwd: projectRoot,
    encoding: "utf8",
    env,
    stdio: capture ? "pipe" : "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = capture ? result.stderr.trim() || result.stdout.trim() : "";
    throw new Error(`${program} ${args.join(" ")} failed${detail ? `: ${detail}` : "."}`);
  }

  return capture ? result.stdout.trim() : "";
}

function composeArgs(args) {
  return ["compose", "--project-name", composeProject, "-f", composeFile, ...args];
}

function composeEnvironment(webPort, grafanaPort) {
  return {
    ...process.env,
    WEB_PORT: String(webPort),
    GRAFANA_PORT: String(grafanaPort),
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(readFileSync(stateFile, "utf8"));
    if (!Number.isInteger(parsed.servePort) || !Number.isInteger(parsed.webPort) || !Number.isInteger(parsed.grafanaPort)) {
      throw new Error("The saved tailnet deployment settings are invalid.");
    }
    return parsed;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function saveState(state) {
  mkdirSync(stateDirectory, { recursive: true });
  const temporaryFile = `${stateFile}.tmp`;
  writeFileSync(temporaryFile, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporaryFile, stateFile);
}

function clearState() {
  rmSync(stateFile, { force: true });
  rmSync(stateDirectory, { recursive: true, force: true });
}

function readTailscaleJson(args) {
  const output = command("tailscale", args, { capture: true });
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`Tailscale returned invalid JSON for ${args.join(" ")}.`);
  }
}

function statusHasPort(status, port) {
  const key = String(port);
  const webEndpoint = Object.keys(status.Web ?? {}).some((hostPort) => hostPort.endsWith(`:${key}`));
  return webEndpoint || Object.hasOwn(status.TCP ?? {}, key) || Object.keys(status.AllowFunnel ?? {}).some((hostPort) => hostPort.endsWith(`:${key}`));
}

function funnelEnabled(status, port) {
  return Object.entries(status.AllowFunnel ?? {}).some(([hostPort, enabled]) => hostPort.endsWith(`:${port}`) && enabled === true);
}

function routeState(serveStatus, port, webPort) {
  const hasPort = statusHasPort(serveStatus, port);
  if (!hasPort) return "missing";
  const expectedTarget = `http://127.0.0.1:${webPort}`;
  const endpoints = Object.entries(serveStatus.Web ?? {}).filter(([hostPort]) => hostPort.endsWith(`:${port}`));
  const servesExpectedTarget = endpoints.some(([, endpoint]) =>
    endpoint.Handlers?.[servePath]?.Proxy === expectedTarget,
  );
  return servesExpectedTarget ? "make-a-mark" : "other";
}

function tailnetUrl(port) {
  const status = readTailscaleJson(["status", "--json"]);
  const dnsName = status.Self?.DNSName?.replace(/\.$/, "");
  if (!dnsName) throw new Error("Tailscale did not report a tailnet DNS name. Check that this machine is connected to the tailnet and MagicDNS is available.");
  return `https://${dnsName}:${port}/`;
}

function readDeploymentSettings(state) {
  const requestedWebPort = process.env.TAILNET_WEB_PORT;
  const requestedGrafanaPort = process.env.TAILNET_GRAFANA_PORT;

  if (state && requestedWebPort && Number(requestedWebPort) !== state.webPort) {
    throw new Error(`This deployment uses web port ${state.webPort}. Run tailnet:down before changing TAILNET_WEB_PORT.`);
  }
  if (state && requestedGrafanaPort && Number(requestedGrafanaPort) !== state.grafanaPort) {
    throw new Error(`This deployment uses Grafana port ${state.grafanaPort}. Run tailnet:down before changing TAILNET_GRAFANA_PORT.`);
  }

  const webPort = state?.webPort ?? Number(requestedWebPort ?? defaultWebPort);
  const grafanaPort = state?.grafanaPort ?? Number(requestedGrafanaPort ?? defaultGrafanaPort);
  for (const [name, port] of [["web", webPort], ["Grafana", grafanaPort]]) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`TAILNET_${name.toUpperCase()}_PORT must be a valid port number.`);
  }
  return { webPort, grafanaPort };
}

function selectServePort(serveStatus, funnelStatus, state, webPort) {
  const requestedPort = process.env.TAILNET_HTTPS_PORT;
  const existingPort = state?.servePort ?? candidateServePorts.find((port) => routeState(serveStatus, port, webPort) === "make-a-mark");
  const candidates = requestedPort ? [Number(requestedPort)] : existingPort ? [existingPort] : candidateServePorts;

  if (requestedPort && (!Number.isInteger(Number(requestedPort)) || Number(requestedPort) < 1 || Number(requestedPort) > 65535)) {
    throw new Error("TAILNET_HTTPS_PORT must be a valid port number.");
  }

  for (const port of candidates) {
    const existingRoute = routeState(serveStatus, port, webPort);
    const funnelPortInUse = funnelEnabled(funnelStatus, port);

    if (existingRoute === "make-a-mark" && !funnelPortInUse) return { port, alreadyConfigured: true };
    if (existingRoute === "other" || funnelPortInUse) {
      if (requestedPort || state?.servePort === port || existingPort === port) {
        throw new Error(`HTTPS port ${port} is already used by another Tailscale route. Set TAILNET_HTTPS_PORT to a free port after checking Tailscale Serve status.`);
      }
      continue;
    }
    return { port, alreadyConfigured: false };
  }

  throw new Error(`No unused Tailscale HTTPS port was found in ${candidateServePorts[0]}–${candidateServePorts.at(-1)}. Check Serve status or set TAILNET_HTTPS_PORT to another free port.`);
}

async function checkHealth(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Health check failed at ${url} with HTTP ${response.status}.`);
  return (await response.text()).trim();
}

async function start() {
  const state = loadState();
  const { webPort, grafanaPort } = readDeploymentSettings(state);
  const serveStatus = readTailscaleJson(["serve", "status", "--json"]);
  const funnelStatus = readTailscaleJson(["funnel", "status", "--json"]);
  const { port: servePort, alreadyConfigured } = selectServePort(serveStatus, funnelStatus, state, webPort);
  const env = composeEnvironment(webPort, grafanaPort);

  command("docker", composeArgs(["up", "--build", "--detach", "--wait", "--wait-timeout", "180"]), { env });
  await checkHealth(`http://127.0.0.1:${webPort}/api/health`);

  if (!alreadyConfigured) {
    command("tailscale", ["serve", "--yes", `--https=${servePort}`, `--set-path=${servePath}`, "--bg", `http://127.0.0.1:${webPort}`]);
  }

  const currentServeStatus = readTailscaleJson(["serve", "status", "--json"]);
  if (routeState(currentServeStatus, servePort, webPort) !== "make-a-mark") {
    throw new Error("Tailscale Serve did not report the expected Make a Mark route. The Compose stack is still running for diagnosis.");
  }
  const currentFunnelStatus = readTailscaleJson(["funnel", "status", "--json"]);
  if (funnelEnabled(currentFunnelStatus, servePort)) {
    throw new Error(`Tailscale Funnel is configured on HTTPS port ${servePort}; refusing to report this route as tailnet-only.`);
  }

  saveState({ servePort, webPort, grafanaPort });
  const url = tailnetUrl(servePort);
  const response = await checkHealth(`${url}api/health`);
  process.stdout.write(`Make a Mark is healthy at ${url}\n`);
  process.stdout.write(`Access: Tailscale Serve on the tailnet; Funnel is not enabled for this route.\n`);
  process.stdout.write(`API health: ${response}\n`);
  process.stdout.write(`Grafana remains local at http://127.0.0.1:${grafanaPort}.\n`);
}

async function showStatus() {
  const state = loadState();
  if (!state) {
    process.stdout.write("Make a Mark does not have a saved tailnet deployment.\n");
    return;
  }

  const env = composeEnvironment(state.webPort, state.grafanaPort);
  const serveStatus = readTailscaleJson(["serve", "status", "--json"]);
  const funnelStatus = readTailscaleJson(["funnel", "status", "--json"]);
  const route = routeState(serveStatus, state.servePort, state.webPort);
  process.stdout.write(`Compose project: ${composeProject}\n`);
  if (route === "make-a-mark") {
    const url = tailnetUrl(state.servePort);
    const health = await checkHealth(`${url}api/health`);
    process.stdout.write(`Make a Mark: ${url} (healthy: ${health})\n`);
  } else if (route === "missing") {
    process.stdout.write(`Make a Mark Serve route on port ${state.servePort}: missing\n`);
  } else {
    throw new Error(`HTTPS port ${state.servePort} no longer points to this Make a Mark deployment. No Tailscale route was changed.`);
  }
  process.stdout.write(`Funnel on this port: ${funnelEnabled(funnelStatus, state.servePort) ? "configured; investigate before sharing" : "not configured"}\n`);
  command("docker", composeArgs(["ps"]), { env });
}

async function stop() {
  const state = loadState();
  const { webPort, grafanaPort } = readDeploymentSettings(state);
  const env = composeEnvironment(webPort, grafanaPort);

  if (state) {
    const serveStatus = readTailscaleJson(["serve", "status", "--json"]);
    const route = routeState(serveStatus, state.servePort, state.webPort);
    if (route === "other") {
      throw new Error(`HTTPS port ${state.servePort} no longer points to this Make a Mark deployment. Refusing to remove another Tailscale route.`);
    }
    if (route === "make-a-mark") {
      const funnelStatus = readTailscaleJson(["funnel", "status", "--json"]);
      if (funnelEnabled(funnelStatus, state.servePort)) {
        throw new Error(`Funnel is configured on HTTPS port ${state.servePort}. Refusing to change its access mode.`);
      }
      command("tailscale", ["serve", "--yes", `--https=${state.servePort}`, `--set-path=${servePath}`, "--bg", "off"]);
    }
  }

  command("docker", composeArgs(["down"]), { env });
  clearState();
  process.stdout.write("Make a Mark stopped. Named Compose volumes and other Tailscale Serve routes were preserved.\n");
}

async function main() {
  const action = process.argv[2];
  if (action === "up") return start();
  if (action === "status") return showStatus();
  if (action === "down") return stop();
  process.stderr.write("Usage: npm run tailnet:up | tailnet:status | tailnet:down\n");
  process.exitCode = 2;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Tailnet deployment failed."}\n`);
  process.exitCode = 1;
});

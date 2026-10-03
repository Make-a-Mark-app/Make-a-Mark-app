import { spawnSync } from "node:child_process";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL;

if (!baseUrl) {
  process.stderr.write("Set PLAYWRIGHT_BASE_URL to the Make a Mark Tailscale HTTPS URL.\n");
  process.exit(2);
}

try {
  if (new URL(baseUrl).protocol !== "https:") {
    throw new Error("The tailnet acceptance URL must use HTTPS.");
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "The tailnet acceptance URL is invalid."}\n`);
  process.exit(2);
}

const result = spawnSync("npx", ["playwright", "test"], {
  stdio: "inherit",
  env: {
    ...process.env,
    PLAYWRIGHT_EXTERNAL: "1",
  },
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);

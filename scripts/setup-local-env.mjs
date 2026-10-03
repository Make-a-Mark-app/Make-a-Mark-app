import { randomBytes } from "node:crypto";
import { closeSync, openSync, readFileSync, unlinkSync, writeSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(projectRoot, ".env");
const examplePath = path.join(projectRoot, ".env.example");

let descriptor;
try {
  descriptor = openSync(envPath, "wx", 0o600);
} catch (error) {
  if (error.code === "EEXIST") {
    process.stdout.write("Local .env already exists; keeping its current settings.\n");
    process.exit(0);
  }
  throw error;
}

try {
  const example = readFileSync(examplePath, "utf8");
  if (!/^GRAFANA_PASSWORD=$/m.test(example)) {
    throw new Error(".env.example must contain an empty GRAFANA_PASSWORD entry");
  }
  const password = randomBytes(32).toString("base64url");
  const localConfig = example.replace(/^GRAFANA_PASSWORD=$/m, `GRAFANA_PASSWORD=${password}`);
  writeSync(descriptor, localConfig);
} catch (error) {
  closeSync(descriptor);
  unlinkSync(envPath);
  throw error;
}
closeSync(descriptor);
process.stdout.write("Created .env with a generated Grafana password (file mode 0600).\n");

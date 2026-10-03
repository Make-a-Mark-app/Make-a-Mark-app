import { appendFile, mkdir, rename, stat, unlink } from "node:fs/promises";
import { closeSync, mkdirSync, openSync } from "node:fs";
import path from "node:path";

export type ServiceLogEntry = {
  severity: "info" | "warn" | "error";
  method: "GET" | "POST" | "OTHER";
  route: string;
  status: string;
  duration_ms: number;
  response_mode?: "grounded_ai" | "prepared_fallback" | "no_answer";
  dependency_error_category?: "request_failed" | "invalid_response";
};

export type ServiceLogWriter = {
  write(entry: ServiceLogEntry): void;
  flush(): Promise<void>;
};

type ServiceLogOptions = {
  directory: string;
  service: "api" | "web";
  environment: "local" | "test" | "production";
  maxBytes?: number;
  retainedFiles?: number;
  stdout?: Pick<NodeJS.WriteStream, "write">;
};

async function fileSize(filename: string): Promise<number> {
  try {
    return (await stat(filename)).size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
}

async function rotate(filename: string, retainedFiles: number): Promise<void> {
  try {
    await unlink(`${filename}.${retainedFiles}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  for (let index = retainedFiles - 1; index >= 1; index -= 1) {
    const source = index === 1 ? filename : `${filename}.${index - 1}`;
    const destination = `${filename}.${index}`;
    try {
      await rename(source, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

export function createServiceLogWriter(options: ServiceLogOptions): ServiceLogWriter {
  const filename = path.join(options.directory, `${options.service}.jsonl`);
  const maxBytes = options.maxBytes ?? 10 * 1024 * 1024;
  const retainedFiles = options.retainedFiles ?? 3;
  const stdout = options.stdout ?? process.stdout;
  let writeQueue = Promise.resolve();

  try {
    mkdirSync(options.directory, { recursive: true, mode: 0o755 });
    const descriptor = openSync(filename, "a", 0o644);
    closeSync(descriptor);
  } catch {
    // Startup must remain independent of optional file logging.
  }

  return {
    write(entry) {
      const record = {
        service: options.service,
        environment: options.environment,
        severity: entry.severity,
        method: entry.method,
        route: entry.route,
        status: entry.status,
        duration_ms: entry.duration_ms,
        ...(entry.response_mode && { response_mode: entry.response_mode }),
        ...(entry.dependency_error_category && { dependency_error_category: entry.dependency_error_category }),
      };
      const line = JSON.stringify(record) + "\n";
      try {
        stdout.write(line);
      } catch {
        // Logging must not change request handling.
      }
      writeQueue = writeQueue.then(async () => {
        await mkdir(options.directory, { recursive: true, mode: 0o755 });
        if (await fileSize(filename) + Buffer.byteLength(line) > maxBytes) {
          await rotate(filename, retainedFiles);
        }
        await appendFile(filename, line, { encoding: "utf8", mode: 0o644 });
      }).catch(() => {
        // A file-system logging failure must not change request handling or health.
      });
    },
    async flush() {
      await writeQueue;
    },
  };
}

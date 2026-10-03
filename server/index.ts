import { createServer } from "node:http";
import { createApp } from "./app.js";
import { createEngineerProvider } from "./provider.js";
import { createServiceLogWriter } from "./logging.js";

const port = Number(process.env.PORT ?? 4178);
const app = createApp({
  provider: createEngineerProvider(process.env),
  logger: createServiceLogWriter({
    directory: process.env.LOG_DIRECTORY ?? "./logs",
    service: "api",
    environment: process.env.APP_ENV === "production" ? "production" : "local",
  }),
});

createServer(app).listen(port, "0.0.0.0", () => {
  console.log("Impact Drive API listening on http://0.0.0.0:" + port);
});

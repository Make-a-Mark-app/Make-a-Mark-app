import { createServer } from "node:http";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 4178);
const app = createApp();

createServer(app).listen(port, "0.0.0.0", () => {
  console.log("Impact Drive API listening on http://0.0.0.0:" + port);
});

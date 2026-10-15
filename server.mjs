import "dotenv/config";
import express from "express";
import compression from "compression";
import * as entry from "./dist/server/entry.mjs";

const ssrHandler = entry.handler ?? entry.default;

const app = express();
// No filtrar tecnología del backend (#235).
app.disable("x-powered-by");
// Trust proxy acotado a loopback: Express honra X-Forwarded-For sólo del Apache local.
app.set("trust proxy", "loopback");

app.use(compression());
app.use(
  express.static("dist/client", {
    immutable: true,
    maxAge: "1y",
    // Los estáticos no pasan por el middleware de Astro: heredar acá el header
    // que importa para assets (#235).
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  }),
);
app.use(ssrHandler);

const port = Number(process.env.PORT) || 4321;
const host = process.env.HOST || "127.0.0.1";

app.listen(port, host, () => {
  console.log(`Server listening on http://${host}:${port}`);
});

// Builds ONE self-contained browser bundle of the SDK (no Node built-ins left, no bundler config needed
// in the consuming app). Output: sdk/browser/tmb-sdk.js (ESM) and tmb-sdk.iife.js (for tests).
import { build } from "esbuild";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
const here = path.dirname(fileURLToPath(import.meta.url));
const req = createRequire(import.meta.url);
const r = (m) => req.resolve(m);
const empty = path.join(here, "shims/empty.js");
const alias = {
  https: path.join(here, "shims/https.ts"),
  http: path.join(here, "shims/https.ts"),
  events: r("events/"),
  buffer: r("buffer/"),
  stream: r("stream-browserify"),
  util: r("util/"),
  crypto: r("crypto-browserify"),
  vm: r("vm-browserify"),
};
for (const m of ["zlib", "url", "net", "tls", "assert", "os", "fs", "path", "http2", "child_process", "readline", "dns", "dgram", "querystring", "string_decoder", "timers", "worker_threads"]) alias[m] = empty;

const common = {
  entryPoints: [path.join(here, "src/browser.ts")],
  bundle: true,
  platform: "browser",
  target: "es2020",
  alias,
  define: { global: "globalThis", "process.env.NODE_ENV": '"production"' },
  inject: [path.join(here, "shims/process-inject.js")],
  logLevel: "warning",
  legalComments: "none",
  minify: true,
  loader: { ".node": "empty" },
};
await build({ ...common, format: "esm", outfile: path.join(here, "browser/tmb-sdk.js") });
await build({ ...common, format: "iife", globalName: "TMB", outfile: path.join(here, "browser/tmb-sdk.iife.js") });
console.log("built sdk/browser/tmb-sdk.js");

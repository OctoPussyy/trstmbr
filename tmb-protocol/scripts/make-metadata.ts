/**
 * Writes Metaplex-standard metadata JSON for the 5 Bro variants into assets/bros/metadata/.
 *   ts-node scripts/make-metadata.ts --base-url https://yoursite.com/bros
 * Then host the whole assets/bros folder at that base URL (e.g. copy it into your web app's public/bros/),
 * so that  <base>/1.png  and  <base>/metadata/1.json  are publicly reachable.
 */
import * as fs from "fs";
import * as path from "path";
import { ROOT, arg } from "./lib";

const base = (arg("base-url") ?? "").replace(/\/$/, "");
if (!base) throw new Error("--base-url is required (where assets/bros will be hosted)");
const dir = path.join(ROOT, "assets/bros/metadata");
fs.mkdirSync(dir, { recursive: true });
for (let v = 1; v <= 5; v++) {
  const meta = {
    name: "Trust Me Bro",
    symbol: "TMB",
    description: "Trust me, bro. Five losses and I'm gone forever.",
    image: `${base}/${v}.png`,
    external_url: base,
    attributes: [{ trait_type: "Variant", value: String(v) }],
    properties: { category: "image", files: [{ uri: `${base}/${v}.png`, type: "image/png" }] },
  };
  fs.writeFileSync(path.join(dir, `${v}.json`), JSON.stringify(meta, null, 2) + "\n");
}
console.log(`wrote 5 files to assets/bros/metadata (base ${base})`);

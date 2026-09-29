// Browsers have no global `Buffer`; @solana/web3.js, Anchor and this SDK all rely on it.
// Import this FIRST (index.ts does) so the SDK works in Vite/Next/etc. without extra config.
import { Buffer } from "buffer";

const g = globalThis as any;
if (typeof g.Buffer === "undefined") g.Buffer = Buffer;
if (typeof g.global === "undefined") g.global = g;
if (typeof g.process === "undefined") g.process = { env: {} };

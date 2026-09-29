// Entry of the prebuilt browser bundle: the SDK plus the two libraries most apps need alongside it.
export * from "./index";
import * as web3 from "@solana/web3.js";
import BN from "bn.js";
export { web3, BN };

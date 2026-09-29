import { PublicKey } from "@solana/web3.js";

const enc = (s: string) => Buffer.from(s);
const u32le = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
};

export const MPL_CORE_PROGRAM_ID = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
export const BPF_LOADER_UPGRADEABLE = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");

export const SWITCHBOARD_PROGRAM_IDS = {
  devnet: new PublicKey("Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2"),
  mainnet: new PublicKey("SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv"),
} as const;

export function findPdas(programId: PublicKey) {
  const f = (seeds: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(seeds, programId)[0];
  return {
    config: f([enc("config")]),
    prizes: f([enc("prizes")]),
    vault: f([enc("vault")]),
    price: f([enc("price")]),
    escrowAuth: f([enc("escrow_auth")]),
    bro: (asset: PublicKey, owner: PublicKey) => f([enc("bro"), asset.toBuffer(), owner.toBuffer()]),
    escrow: (asset: PublicKey) => f([enc("escrow"), asset.toBuffer()]),
    spin: (asset: PublicKey, n: number) => f([enc("spin"), asset.toBuffer(), u32le(n)]),
    graveyard: (asset: PublicKey) => f([enc("burned"), asset.toBuffer()]),
    programData: PublicKey.findProgramAddressSync([programId.toBuffer()], BPF_LOADER_UPGRADEABLE)[0],
  };
}

export type TmbPdas = ReturnType<typeof findPdas>;

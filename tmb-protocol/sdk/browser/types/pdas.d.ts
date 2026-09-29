import { PublicKey } from "@solana/web3.js";
export declare const MPL_CORE_PROGRAM_ID: PublicKey;
export declare const BPF_LOADER_UPGRADEABLE: PublicKey;
export declare const SWITCHBOARD_PROGRAM_IDS: {
    readonly devnet: PublicKey;
    readonly mainnet: PublicKey;
};
export declare function findPdas(programId: PublicKey): {
    config: PublicKey;
    prizes: PublicKey;
    vault: PublicKey;
    price: PublicKey;
    escrowAuth: PublicKey;
    bro: (asset: PublicKey, owner: PublicKey) => PublicKey;
    escrow: (asset: PublicKey) => PublicKey;
    spin: (asset: PublicKey, n: number) => PublicKey;
    graveyard: (asset: PublicKey) => PublicKey;
    programData: PublicKey;
};
export type TmbPdas = ReturnType<typeof findPdas>;

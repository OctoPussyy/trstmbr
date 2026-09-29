/** The 5 Bro art variants (assets/bros/1..5.png). Repeats are fine: every mint is its own NFT. */
export declare const BRO_VARIANTS = 5;
/**
 * Picks a random variant for `mintBro(name, uri)`.
 * `baseUrl` is where you host assets/bros/metadata/*.json (see scripts/make-metadata.ts), e.g.
 * "https://yoursite.com/bros" -> uri "https://yoursite.com/bros/metadata/3.json".
 */
export declare function pickBro(baseUrl: string, variant?: number): {
    variant: number;
    name: string;
    uri: string;
};

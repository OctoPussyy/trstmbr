/** The 5 Bro art variants (assets/bros/1..5.png). Repeats are fine: every mint is its own NFT. */
export const BRO_VARIANTS = 5;

/**
 * Picks a random variant for `mintBro(name, uri)`.
 * `baseUrl` is where you host assets/bros/metadata/*.json (see scripts/make-metadata.ts), e.g.
 * "https://yoursite.com/bros" -> uri "https://yoursite.com/bros/metadata/3.json".
 */
export function pickBro(baseUrl: string, variant = 1 + Math.floor(Math.random() * BRO_VARIANTS)) {
  const serial = Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
  return {
    variant,
    name: `Trust Me Bro #${serial}`.slice(0, 32),
    uri: `${baseUrl.replace(/\/$/, "")}/metadata/${variant}.json`,
  };
}

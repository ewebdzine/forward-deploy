/**
 * Optional token pricing - set PRICE_PER_MTOK_IN / PRICE_PER_MTOK_OUT (USD
 * per million tokens, from Anthropic's pricing page for your model) and every
 * usage surface shows estimated dollars. Unset = tokens only. Cache math per
 * Anthropic billing: cache writes 1.25x the input rate, cache reads 0.1x.
 */
export type Usage = {
  tokensIn: number;
  tokensOut: number;
  tokensCacheWrite: number;
  tokensCacheRead: number;
};

export function estimateCostUsd(u: Usage): number | null {
  const priceIn = Number(process.env.PRICE_PER_MTOK_IN);
  const priceOut = Number(process.env.PRICE_PER_MTOK_OUT);
  if (!Number.isFinite(priceIn) || !Number.isFinite(priceOut)) return null;
  if (priceIn <= 0 || priceOut <= 0) return null;
  return (
    (u.tokensIn * priceIn +
      u.tokensCacheWrite * priceIn * 1.25 +
      u.tokensCacheRead * priceIn * 0.1 +
      u.tokensOut * priceOut) /
    1_000_000
  );
}

export function formatUsd(v: number): string {
  return v < 0.1 ? `$${v.toFixed(3)}` : `$${v.toFixed(2)}`;
}

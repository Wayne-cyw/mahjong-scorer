/**
 * Cache key for a Next.js RSC (client navigation) request. The `_rsc` query value
 * is a hash of the router state, so it differs between a soft navigation and the
 * same navigation after a reload; keying on it makes an offline tap miss the cache.
 */
export function rscCacheKey(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.delete('_rsc');
  return parsed.toString();
}

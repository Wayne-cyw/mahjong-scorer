/**
 * In one observed demand spike, gemini-3.5-flash-lite answered with this route's prompt and schema
 * while gemini-3.8-flash and the 3.5 and 3.6 Flash models returned 503s. Availability varies, so
 * check before changing it, and check its price: it is billed whenever the primary is overloaded.
 */
export const DEFAULT_FALLBACK_MODEL = 'gemini-3.5-flash-lite';

/**
 * Reads RECOGNITION_FALLBACK_MODEL. Unset, empty or whitespace means the default (so a copied
 * `.env.example` keeps the fallback on); `none` disables it, so the retry goes to the primary.
 */
export const resolveFallbackModel = (raw: string | undefined): string | undefined => {
  const configured = raw?.trim() || DEFAULT_FALLBACK_MODEL;
  return configured.toLowerCase() === 'none' ? undefined : configured;
};

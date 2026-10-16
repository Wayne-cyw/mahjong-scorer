/**
 * Stamped on every event the tile-based scoring engine produces so a replay can
 * tell which rules computed it. Distinct from `MANUAL_ENGINE_VERSION`
 * (lib/game/events.ts), which marks hands whose fan was typed in directly.
 * Bump when scoring behaviour changes; keep in step with package.json.
 */
export const ENGINE_VERSION = '0.1.0';

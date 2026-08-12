/**
 * Opviera platform constants.
 *
 * This CLI talks to exactly one place: the Opviera gateway. The base URL is compiled in and
 * overridable only by an env var, which exists for development and self-hosted deployments — it is
 * NOT a general "point me at any provider" switch. Everything else about provider selection is
 * removed elsewhere in the build (see the provider lock).
 */

/** Provider id used in the catalog, the config file, and as the auth.json key. */
export const PROVIDER_ID = "opviera"

/**
 * Production gateway, and the API host rather than the console host: `console.opviera.ai` serves
 * the dashboard single-page app, `api.opviera.ai` is the backend. Both hostnames currently route
 * to the same service, so either would work today — but pointing a CLI at the SPA's hostname only
 * holds for as long as that ingress rule does. This matches `GATEWAY_PUBLIC_URL` server-side, so
 * a developer who installs from a dashboard recipe and one who runs the CLI land on one endpoint.
 */
export const DEFAULT_GATEWAY_URL = "https://api.opviera.ai/gateway"

/**
 * The gateway a key was discovered to belong to: `/v1/whoami` reports the canonical URL of the
 * deployment that accepted the key, and the stored credential remembers it across runs. Held
 * here rather than passed around so that every caller — the whoami probe, the model catalog,
 * and the SDK client in provision.ts — resolves the same URL without threading it through.
 */
let discovered: string | undefined

export function setDiscoveredGatewayUrl(url: string | null | undefined): void {
  const trimmed = url?.trim()
  discovered = trimmed && trimmed.length > 0 ? stripTrailingSlash(trimmed) : undefined
}

/**
 * Base URL including the `/gateway` mount — the Anthropic SDK appends `/v1`, so the wire path
 * ends up `<base>/v1/messages`, matching how the platform's own config recipes are built.
 *
 * Precedence, highest first:
 *   1. OPVIERA_GATEWAY_URL — an explicit operator choice always wins, including over discovery.
 *   2. The URL discovered from the key (whoami, or the stored credential from a previous run).
 *   3. The compiled-in production default, which only ever bootstraps the first request.
 */
export function gatewayUrl(): string {
  const raw = process.env["OPVIERA_GATEWAY_URL"]?.trim()
  if (raw && raw.length > 0) return stripTrailingSlash(raw)
  return discovered ?? stripTrailingSlash(DEFAULT_GATEWAY_URL)
}

/** True when the operator pinned the gateway, so discovery must not override it. */
export function gatewayUrlIsPinned(): boolean {
  const raw = process.env["OPVIERA_GATEWAY_URL"]?.trim()
  return !!raw && raw.length > 0
}

export function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "")
}

/**
 * Keys are `vsk_` + 40 hex characters. Checked client-side purely to give instant feedback on an
 * obvious paste error; the gateway is always the authority (it applies the identical rule before
 * any database lookup).
 */
const KEY_PATTERN = /^vsk_[0-9a-f]{40}$/

export function looksLikeApiKey(value: string): boolean {
  return KEY_PATTERN.test(value.trim())
}

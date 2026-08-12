/**
 * Opviera platform constants.
 *
 * This CLI talks to exactly one place: the Opviera gateway. Which gateway is derived from the key
 * itself, with an env var available for development and self-hosted deployments — it is NOT a
 * general "point me at any provider" switch. Everything else about provider selection is removed
 * elsewhere in the build (see the provider lock).
 */

/** Provider id used in the catalog, the config file, and as the auth.json key. */
export const PROVIDER_ID = "opviera"

/** Every Opviera console lives under this zone; the marker in a key selects the subdomain. */
const CONSOLE_DOMAIN = "opviera.ai"

/**
 * Keys carry an optional environment marker: `vsk_<marker>_<40hex>`, with production unmarked as
 * `vsk_<40hex>`. That marker is the only thing a user has that says which deployment issued the
 * key, so it is what the CLI resolves the gateway from — nobody should have to set an env var to
 * sign in with a key they were handed.
 */
const KEY_PATTERN = /^vsk_(?:([a-z0-9]{1,8})_)?[0-9a-f]{40}$/

/**
 * Requests go to the console host, not the API host: the console is the address users are given,
 * it is the origin the dashboard's own setup recipes are built against, and its nginx already
 * proxies `/gateway/` to the backend. Production is `console.opviera.ai`; a marked key resolves
 * to `<marker>-console.opviera.ai`, e.g. a `qa` key to `qa-console.opviera.ai`.
 */
export function gatewayUrlForKey(apiKey: string): string | undefined {
  const match = KEY_PATTERN.exec(apiKey.trim())
  if (!match) return undefined
  const marker = match[1]
  const host = marker ? `${marker}-console.${CONSOLE_DOMAIN}` : `console.${CONSOLE_DOMAIN}`
  return `https://${host}/gateway`
}

/** Production gateway, used only until a key is in hand to resolve from. */
export const DEFAULT_GATEWAY_URL = `https://console.${CONSOLE_DOMAIN}/gateway`

/**
 * The gateway resolved for the key in play — from its marker, or from what `/v1/whoami` reported,
 * or from the stored credential of a previous run. Held here rather than passed around so every
 * caller (the whoami probe, the model catalog, the SDK client in provision.ts) agrees without
 * threading it through.
 */
let resolved: string | undefined

export function setResolvedGatewayUrl(url: string | null | undefined): void {
  const trimmed = url?.trim()
  resolved = trimmed && trimmed.length > 0 ? stripTrailingSlash(trimmed) : undefined
}

/**
 * Base URL including the `/gateway` mount — the Anthropic SDK appends `/v1`, so the wire path
 * ends up `<base>/v1/messages`, matching how the platform's own config recipes are built.
 *
 * Precedence, highest first:
 *   1. OPVIERA_GATEWAY_URL — an explicit operator choice always wins.
 *   2. The URL resolved for this key: its marker, then whatever whoami reported.
 *   3. The production default, which only applies before a key has been seen.
 */
export function gatewayUrl(): string {
  const raw = process.env["OPVIERA_GATEWAY_URL"]?.trim()
  if (raw && raw.length > 0) return stripTrailingSlash(raw)
  return resolved ?? stripTrailingSlash(DEFAULT_GATEWAY_URL)
}

/** True when the operator pinned the gateway, so resolution must not override it. */
export function gatewayUrlIsPinned(): boolean {
  const raw = process.env["OPVIERA_GATEWAY_URL"]?.trim()
  return !!raw && raw.length > 0
}

export function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "")
}

/**
 * Checked client-side purely to give instant feedback on an obvious paste error; the gateway is
 * always the authority (it applies the identical rule before any database lookup).
 */
export function looksLikeApiKey(value: string): boolean {
  return KEY_PATTERN.test(value.trim())
}

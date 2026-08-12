/**
 * Opviera platform constants.
 *
 * This CLI talks to exactly one place: the Opviera gateway for the environment that issued the
 * key in play. Which gateway that is, is a pure function of the key — there is deliberately NO
 * runtime override. A client that could repoint the CLI could route an organisation's traffic
 * (and its keys) somewhere the operator does not control, which is the whole thing the
 * gateway-locked build exists to prevent.
 */

declare global {
  const OPVIERA_ZONE: string
}

/** Provider id used in the catalog, the config file, and as the auth record key. */
export const PROVIDER_ID = "opviera"

/**
 * DNS zone every Opviera console lives under, fixed at build time (see the `define` block in
 * packages/opencode/script/build.ts). This is the seam for a self-hosted Enterprise deployment:
 * they get a build with their own zone compiled in, rather than an env var any process could set.
 */
export const ZONE = typeof OPVIERA_ZONE === "string" && OPVIERA_ZONE.length > 0 ? OPVIERA_ZONE : "opviera.ai"

/**
 * Keys carry an optional environment marker: `vsk_<marker>_<40hex>`, with production unmarked as
 * `vsk_<40hex>`. That marker is the only thing a user has that says which deployment issued the
 * key, so it is what the gateway is resolved from — nobody should have to configure anything to
 * sign in with a key they were handed.
 */
const KEY_PATTERN = /^vsk_(?:([a-z0-9]{1,8})_)?[0-9a-f]{40}$/

/**
 * Requests go to the CONSOLE host, never an internal API hostname: the console is the address
 * users are given, it is the origin the dashboard's own setup recipes are built against, and its
 * nginx proxies `/gateway/` onward. Production is `console.<zone>`; a marked key resolves to
 * `<marker>-console.<zone>`, so a `qa` key reaches `qa-console.<zone>`.
 */
export function gatewayUrlForKey(apiKey: string): string | undefined {
  const match = KEY_PATTERN.exec(apiKey.trim())
  if (!match) return undefined
  const marker = match[1]
  return `https://${marker ? `${marker}-console.${ZONE}` : `console.${ZONE}`}/gateway`
}

/** Production gateway, used only before a key is in hand to resolve from. */
export const DEFAULT_GATEWAY_URL = `https://console.${ZONE}/gateway`

/**
 * The gateway resolved for the key in play. Held here rather than passed around so that every
 * caller — the whoami probe, the model catalog, and the SDK client in provision.ts — agrees
 * without threading it through.
 */
let resolved: string | undefined

export function setResolvedGatewayUrl(url: string | null | undefined): void {
  const trimmed = url?.trim()
  resolved = trimmed && trimmed.length > 0 ? stripTrailingSlash(trimmed) : undefined
}

/**
 * Base URL including the `/gateway` mount — the Anthropic SDK appends `/v1`, so the wire path
 * ends up `<base>/v1/messages`, matching how the platform's own config recipes are built.
 */
export function gatewayUrl(): string {
  return resolved ?? stripTrailingSlash(DEFAULT_GATEWAY_URL)
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

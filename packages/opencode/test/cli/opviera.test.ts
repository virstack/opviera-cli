import { describe, expect, test, afterEach } from "bun:test"
import { resolveProject } from "@/cli/opviera/gate"
import { whoami, GatewayError } from "@/cli/opviera/client"
import { looksLikeApiKey, gatewayUrl, gatewayUrlForKey, DEFAULT_GATEWAY_URL, ZONE } from "@/cli/opviera/config"
import type { WhoAmI } from "@/cli/opviera/client"

const identity = (over: Partial<WhoAmI> = {}): WhoAmI => ({
  user: { id: "u1", name: "Ada" },
  organization: { id: "o1", name: "Virstack" },
  key: { prefix: "vsk_abc12345", upstream: "bedrock" },
  boundProjectId: null,
  projectRequired: false,
  projects: [
    { identifier: "acme-web", name: "Acme Web" },
    { identifier: "acme-web-2", name: "Acme Web" },
  ],
  models: [],
  forcedModel: null,
  ...over,
})

describe("api key format", () => {
  test("accepts a real key shape and rejects near-misses", () => {
    const valid = "vsk_" + "a".repeat(40)
    expect(looksLikeApiKey(valid)).toBe(true)
    expect(looksLikeApiKey(" " + valid + " ")).toBe(true)
    expect(looksLikeApiKey("vsk_" + "a".repeat(39))).toBe(false)
    expect(looksLikeApiKey("vsk_" + "z".repeat(40))).toBe(false)
    expect(looksLikeApiKey("sk-ant-abc")).toBe(false)
    expect(looksLikeApiKey("")).toBe(false)
  })
})

describe("project resolution", () => {
  // A user types the name they know; the gateway only ever accepts the slug.
  test("resolves by human name, case-insensitively", () => {
    expect(resolveProject(identity(), "acme web")?.identifier).toBe("acme-web")
    expect(resolveProject(identity(), "  ACME WEB  ")?.identifier).toBe("acme-web")
  })

  test("resolves by identifier too", () => {
    expect(resolveProject(identity(), "acme-web-2")?.identifier).toBe("acme-web-2")
  })

  test("returns nothing for an unknown or empty name, so the caller can offer the list", () => {
    expect(resolveProject(identity(), "typo")).toBeUndefined()
    expect(resolveProject(identity(), "")).toBeUndefined()
  })

  // A bound key's project is decided server-side; projectCheck ignores whatever the client sends.
  test("a bound key overrides whatever was typed", () => {
    const bound = identity({ boundProjectId: "acme-web-2" })
    expect(resolveProject(bound, "acme web")?.identifier).toBe("acme-web-2")
    expect(resolveProject(bound, "")?.identifier).toBe("acme-web-2")
  })

  test("a bound key not present in the visible list still resolves", () => {
    const bound = identity({ boundProjectId: "hidden", projects: [] })
    expect(resolveProject(bound, "")?.identifier).toBe("hidden")
  })
})

describe("gateway client", () => {
  const realFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  const respond = (status: number, body: unknown, headers: Record<string, string> = {}) => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json", ...headers },
      })) as unknown as typeof fetch
  }

  const anthropicError = (message: string) => ({ type: "error", error: { type: "permission_error", message } })

  test("returns the payload on success", async () => {
    respond(200, identity())
    const result = await whoami("vsk_test")
    expect(result.organization.name).toBe("Virstack")
    expect(result.projects).toHaveLength(2)
  })

  test("calls /v1/whoami on the configured gateway with x-api-key", async () => {
    const seen: { url?: string; key?: string | null } = {}
    globalThis.fetch = (async (...args: unknown[]) => {
      seen.url = String(args[0])
      seen.key = new Headers((args[1] as RequestInit | undefined)?.headers).get("x-api-key")
      return new Response(JSON.stringify(identity()), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }) as unknown as typeof fetch
    await whoami("vsk_secret")
    expect(seen.url).toBe(`${DEFAULT_GATEWAY_URL}/v1/whoami`)
    expect(seen.key).toBe("vsk_secret")
  })

  // A bad key is worth asking again for; a dead account is not.
  test("marks a 401 retryable so the CLI re-prompts", async () => {
    respond(401, anthropicError("Invalid or revoked API key."))
    const error = (await whoami("vsk_bad").catch((e) => e)) as GatewayError
    expect(error).toBeInstanceOf(GatewayError)
    expect(error.retryable).toBe(true)
    expect(error.message).toMatch(/invalid or revoked/i)
  })

  test("marks a suspended account non-retryable", async () => {
    respond(403, anthropicError("Your account is suspended. Contact your administrator."))
    const error = (await whoami("vsk_x").catch((e) => e)) as GatewayError
    expect(error.retryable).toBe(false)
  })

  // The reason /whoami is mounted above the billing gate: the key is valid, the org is not paying.
  test("surfaces inactive billing verbatim and does not re-prompt", async () => {
    respond(403, anthropicError("Billing is not active for this organization."))
    const error = (await whoami("vsk_x").catch((e) => e)) as GatewayError
    expect(error.retryable).toBe(false)
    expect(error.message).toMatch(/billing is not active/i)
  })

  test("explains an outdated gateway on 404", async () => {
    respond(404, {})
    const error = (await whoami("vsk_x").catch((e) => e)) as GatewayError
    expect(error.message).toMatch(/does not support this CLI/i)
  })

  test("carries the request id through for support", async () => {
    respond(401, anthropicError("Invalid or revoked API key."), { "request-id": "req_123" })
    const error = (await whoami("vsk_x").catch((e) => e)) as GatewayError
    expect(error.requestId).toBe("req_123")
  })

  test("reports an unreachable gateway rather than throwing a raw network error", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed")
    }) as unknown as typeof fetch
    const error = (await whoami("vsk_x").catch((e) => e)) as GatewayError
    expect(error).toBeInstanceOf(GatewayError)
    expect(error.message).toMatch(/could not reach/i)
    expect(error.retryable).toBe(false)
  })
})

describe("gateway url", () => {
  test("defaults to the production console", () => {
    expect(gatewayUrl()).toBe(DEFAULT_GATEWAY_URL)
    expect(DEFAULT_GATEWAY_URL).toBe(`https://console.${ZONE}/gateway`)
  })

  // There is deliberately no runtime override: a client that could repoint the CLI could route an
  // organisation's traffic, and its keys, somewhere the operator does not control.
  test("ignores OPVIERA_GATEWAY_URL", () => {
    process.env["OPVIERA_GATEWAY_URL"] = "http://evil.example.com/gateway"
    expect(gatewayUrl()).toBe(DEFAULT_GATEWAY_URL)
    delete process.env["OPVIERA_GATEWAY_URL"]
  })
})

describe("gateway url for key", () => {
  const hex = "b10bdec99fec5c6053179801f60de9d304cecd6e"

  test("an unmarked key is production", () => {
    expect(gatewayUrlForKey(`vsk_${hex}`)).toBe(`https://console.${ZONE}/gateway`)
  })

  test("a marked key resolves to that environment's console", () => {
    expect(gatewayUrlForKey(`vsk_qa_${hex}`)).toBe(`https://qa-console.${ZONE}/gateway`)
    expect(gatewayUrlForKey(`vsk_stg_${hex}`)).toBe(`https://stg-console.${ZONE}/gateway`)
  })

  test("never resolves to an api host", () => {
    for (const key of [`vsk_${hex}`, `vsk_qa_${hex}`]) {
      expect(gatewayUrlForKey(key)).not.toContain("api.")
    }
  })

  test("rejects anything that is not a well-formed key", () => {
    for (const bad of ["vsk_short", `vsk_QA_${hex}`, `vsk_toolongmarker_${hex}`, hex, ""]) {
      expect(gatewayUrlForKey(bad)).toBeUndefined()
    }
  })

  test("tolerates surrounding whitespace, as a paste would", () => {
    expect(gatewayUrlForKey(`  vsk_qa_${hex}\n`)).toBe(`https://qa-console.${ZONE}/gateway`)
  })
})

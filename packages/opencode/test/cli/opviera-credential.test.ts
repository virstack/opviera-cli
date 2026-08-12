import { describe, expect, test, afterAll } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import * as Credential from "@/cli/opviera/credential"

/**
 * Credentials are scoped to a directory. A machine routinely holds several projects, possibly in
 * different organisations or environments, and a shared credential silently bills one project's
 * work to another — so the isolation below is the actual product behaviour, not an implementation
 * detail.
 */

const made: string[] = []

async function tempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "opviera-cred-"))
  made.push(dir)
  // Resolve through the same call the store uses: on macOS os.tmpdir() is a symlink, and an
  // unresolved path would key differently from what currentDirectory() produces.
  return await fs.realpath(dir)
}

afterAll(async () => {
  for (const dir of made) await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
})

const cred = (directory: string, over: Partial<Credential.Credential> = {}): Credential.Credential => ({
  directory,
  key: "vsk_qa_b10bdec99fec5c6053179801f60de9d304cecd6e",
  projectId: "promt-studio",
  projectName: "Promt Studio",
  ...over,
})

describe("per-directory credentials", () => {
  test("round-trips a credential for its own directory", async () => {
    const dir = await tempDir()
    await Credential.write(cred(dir))
    const read = await Credential.read(dir)
    expect(read).toEqual(cred(dir))
  })

  test("a credential written for one directory is invisible from another", async () => {
    const a = await tempDir()
    const b = await tempDir()
    await Credential.write(cred(a, { key: "vsk_aaa1dec99fec5c6053179801f60de9d304cecd6e" }))
    expect(await Credential.read(a)).toBeDefined()
    expect(await Credential.read(b)).toBeUndefined()
  })

  test("two directories keep separate keys rather than overwriting each other", async () => {
    const a = await tempDir()
    const b = await tempDir()
    await Credential.write(cred(a, { key: "vsk_aaa1dec99fec5c6053179801f60de9d304cecd6e" }))
    await Credential.write(cred(b, { key: "vsk_qa_bbb1dec99fec5c6053179801f60de9d304cecd6e" }))
    expect((await Credential.read(a))!.key).toBe("vsk_aaa1dec99fec5c6053179801f60de9d304cecd6e")
    expect((await Credential.read(b))!.key).toBe("vsk_qa_bbb1dec99fec5c6053179801f60de9d304cecd6e")
  })

  test("clearing one directory leaves the other signed in", async () => {
    const a = await tempDir()
    const b = await tempDir()
    await Credential.write(cred(a))
    await Credential.write(cred(b))
    await Credential.clear(a)
    expect(await Credential.read(a)).toBeUndefined()
    expect(await Credential.read(b)).toBeDefined()
  })

  test("clearing a directory that was never signed in is a no-op", async () => {
    const dir = await tempDir()
    await Credential.clear(dir)
    expect(await Credential.read(dir)).toBeUndefined()
  })

  test("a record naming a different directory is refused, not reused", async () => {
    const a = await tempDir()
    const b = await tempDir()
    // Simulate a reused hash / moved path: the file exists but claims another directory.
    await Credential.write(cred(a, { directory: b }))
    expect(await Credential.read(a)).toBeUndefined()
  })

  test("the file is not readable by anyone else", async () => {
    const dir = await tempDir()
    await Credential.write(cred(dir))
    const { Global } = await import("@opencode-ai/core/global")
    const { Hash } = await import("@opencode-ai/core/util/hash")
    const file = path.join(Global.Path.data, "auth", `${Hash.fast(dir)}.json`)
    expect((await fs.stat(file)).mode & 0o777).toBe(0o600)
  })

  test("rewriting keeps 0600 even though the file already exists", async () => {
    const dir = await tempDir()
    await Credential.write(cred(dir))
    const { Global } = await import("@opencode-ai/core/global")
    const { Hash } = await import("@opencode-ai/core/util/hash")
    const file = path.join(Global.Path.data, "auth", `${Hash.fast(dir)}.json`)
    await fs.chmod(file, 0o644)
    await Credential.write(cred(dir, { projectName: "Renamed" }))
    expect((await fs.stat(file)).mode & 0o777).toBe(0o600)
  })

  test("currentDirectory is canonical, so it is stable as a key", () => {
    expect(Credential.currentDirectory()).toBe(Credential.currentDirectory())
    expect(path.isAbsolute(Credential.currentDirectory())).toBe(true)
  })
})

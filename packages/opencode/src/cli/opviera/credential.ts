import fs from "fs/promises"
import path from "path"
import { Global } from "@opencode-ai/core/global"
import { Hash } from "@opencode-ai/core/util/hash"
import { Filesystem } from "@/util/filesystem"

/**
 * Per-directory credential store.
 *
 * One record per project directory rather than a single global entry: a machine routinely has
 * several projects, and they may belong to different organisations, different Opviera projects, or
 * different environments entirely. A shared credential silently bills one project's work to
 * another, so a key is scoped to the directory it was entered in and is invisible everywhere else.
 *
 * This deliberately no longer writes the shared `auth.json` the upstream `Auth` service owns:
 * that file is a single provider->credential map with no room for per-directory records, and both
 * writers did an unlocked read-modify-write of it. The key reaches the worker (and therefore the
 * model client) through OPVIERA_API_KEY instead — see the gate, and the `env: ["OPVIERA_API_KEY"]`
 * declaration in provision.ts that exists for exactly that.
 *
 * Deliberately plain fs rather than the Auth service: the startup gate runs in the CLI's main
 * thread before any Effect runtime or instance exists, and standing one up to read one record
 * would invert that ordering.
 */

const dir = path.join(Global.Path.data, "auth")

export interface Credential {
  /** Canonical directory this credential is scoped to; stored so a stale record is detectable. */
  directory: string
  key: string
  projectId: string | null
  projectName: string | null
}

/**
 * The directory a credential belongs to. `Filesystem.resolve` resolves symlinks so the same
 * physical directory always produces the same key — it exists precisely to be used this way.
 * By the time the gate runs, tui.ts has already chdir'd to the opened directory.
 */
export function currentDirectory(): string {
  return Filesystem.resolve(process.cwd())
}

function fileFor(directory: string): string {
  return path.join(dir, `${Hash.fast(directory)}.json`)
}

export async function read(directory: string = currentDirectory()): Promise<Credential | undefined> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await fs.readFile(fileFor(directory), "utf8"))
  } catch {
    // Missing or unreadable simply means "not signed in here".
    return undefined
  }
  if (!parsed || typeof parsed !== "object") return undefined
  const record = parsed as Partial<Credential>
  if (typeof record.key !== "string" || record.key.length === 0) return undefined
  // A record written for a different directory means the hash was reused (a moved or recreated
  // path). Treat it as absent rather than authenticating against someone else's project.
  if (record.directory !== directory) return undefined
  return {
    directory,
    key: record.key,
    projectId: record.projectId ?? null,
    projectName: record.projectName ?? null,
  }
}

export async function write(credential: Credential): Promise<void> {
  const target = fileFor(credential.directory)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, JSON.stringify(credential, null, 2), { mode: 0o600 })
  // writeFile only applies `mode` when it creates the file, so an existing file keeps its old
  // permissions unless we set them explicitly.
  await fs.chmod(target, 0o600).catch(() => {})
}

export async function clear(directory: string = currentDirectory()): Promise<void> {
  await fs.rm(fileFor(directory), { force: true }).catch(() => {})
}

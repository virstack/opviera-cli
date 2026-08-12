import { cmd } from "./cmd"
import { UI } from "../ui"
import * as Credential from "../opviera/credential"

/**
 * `opviera login` / `opviera logout`.
 *
 * Login re-runs the SAME gate the TUI runs at startup rather than reimplementing the prompts, so
 * there is one sign-in flow and one place to change it.
 *
 * Credentials are scoped to a directory, and unlike `opviera` these commands never chdir — they
 * act on wherever the shell happens to be. Both therefore name the directory they operated on, so
 * "signed in" is never ambiguous when a machine holds several projects.
 */
export const LoginCommand = cmd({
  command: "login",
  describe: "sign in to Opviera with an API key for this directory",
  async handler() {
    const directory = Credential.currentDirectory()
    // Discard any stored key for THIS directory first, otherwise the gate would validate it and
    // skip the prompts — the opposite of what someone typing `login` wants.
    await Credential.clear(directory)
    const { ensureAuthenticated } = await import("../opviera/gate")
    await ensureAuthenticated()
    UI.println(`Signed in for ${directory}`)
  },
})

export const LogoutCommand = cmd({
  command: "logout",
  describe: "remove the stored Opviera API key for this directory",
  async handler() {
    const directory = Credential.currentDirectory()
    const existing = await Credential.read(directory)
    await Credential.clear(directory)
    UI.println(existing ? `Signed out of Opviera for ${directory}` : `You are not signed in for ${directory}`)
  },
})

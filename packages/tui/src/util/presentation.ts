import { logo, renderWordmark } from "../logo"

/**
 * The screen shown on exit.
 *
 * The wordmark art is imported, not copied. This file previously carried its own hand-maintained
 * duplicate, which is why it still spelled the upstream product name long after every other
 * surface had been renamed — a grep for that name found the art nowhere, because the letters only
 * exist as block glyphs.
 */

const reset = "\x1b[0m"
const bold = "\x1b[1m"
const dim = "\x1b[90m"

export function sessionEpilogue(input: { title: string; sessionID?: string }) {
  const weak = (text: string) => `${dim}${text.padEnd(10, " ")}${reset}`
  return [
    ...renderWordmark(logo, "  "),
    "",
    `  ${weak("Session")}${bold}${input.title}${reset}`,
    `  ${weak("Continue")}${bold}opviera -s ${input.sessionID}${reset}`,
    "",
  ].join("\n")
}

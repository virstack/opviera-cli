import { EOL } from "os"
import { Schema } from "effect"
import { logo as glyphs } from "./logo"

// The non-TTY wordmark. A SECOND, independent copy of the brand art (the shaded one lives in
// packages/tui/src/logo.ts) — it contains no "opviera" substring, so a grep-driven rename will
// miss it. Keep the two in sync by hand.
const wordmark = [
  `⠀                ▄                 `,
  `█▀▀█ █▀▀█ █  █   █  █▀▀█ █▀▀▄ ▄▀▀█`,
  `█  █ █  █ █  █   █  █▀▀▀ █    █▄▄█`,
  `▀▀▀▀ █▀▀▀ ▀▄▄▀   ▀  ▀▀▀▀ ▀    ▀▀▀▀`,
]

export class CancelledError extends Schema.TaggedErrorClass<CancelledError>()("UICancelledError", {}) {}

export const Style = {
  TEXT_HIGHLIGHT: "\x1b[96m",
  TEXT_HIGHLIGHT_BOLD: "\x1b[96m\x1b[1m",
  TEXT_DIM: "\x1b[90m",
  TEXT_DIM_BOLD: "\x1b[90m\x1b[1m",
  TEXT_NORMAL: "\x1b[0m",
  TEXT_NORMAL_BOLD: "\x1b[1m",
  TEXT_WARNING: "\x1b[93m",
  TEXT_WARNING_BOLD: "\x1b[93m\x1b[1m",
  TEXT_DANGER: "\x1b[91m",
  TEXT_DANGER_BOLD: "\x1b[91m\x1b[1m",
  TEXT_SUCCESS: "\x1b[92m",
  TEXT_SUCCESS_BOLD: "\x1b[92m\x1b[1m",
  TEXT_INFO: "\x1b[94m",
  TEXT_INFO_BOLD: "\x1b[94m\x1b[1m",
}

export function println(...message: string[]) {
  print(...message)
  process.stderr.write(EOL)
}

export function print(...message: string[]) {
  blank = false
  process.stderr.write(message.join(" "))
}

let blank = false
export function empty() {
  if (blank) return
  println("" + Style.TEXT_NORMAL)
  blank = true
}

/**
 * The brand gradient, sampled from the Opviera mark: cyan through deep blue to violet. A terminal
 * cannot show the logo artwork itself, so the wordmark carries the identity by wearing its colours
 * — swept left-to-right across the whole wordmark, the same direction the mark's orbit runs.
 */
const GRADIENT: [number, number, number][] = [
  [0x20, 0xe6, 0xc9], // #20E6C9 cyan
  [0x0e, 0x2b, 0xff], // #0E2BFF deep blue
  [0x7c, 0x3a, 0xed], // #7C3AED violet
]

/** Colour at 0..1 along the gradient. */
function gradientAt(t: number): [number, number, number] {
  const clamped = Math.min(1, Math.max(0, t))
  const span = 1 / (GRADIENT.length - 1)
  const index = Math.min(GRADIENT.length - 2, Math.floor(clamped / span))
  const local = (clamped - index * span) / span
  const from = GRADIENT[index]!
  const to = GRADIENT[index + 1]!
  return [0, 1, 2].map((c) => Math.round(from[c]! + (to[c]! - from[c]!) * local)) as [number, number, number]
}

/**
 * 24-bit colour is not universal — Terminal.app and older TERMs only do 256. Falling back to the
 * previous grey scheme is deliberate: a wordmark in the wrong colours reads worse than one in no
 * colour at all.
 */
function truecolor(): boolean {
  const flag = process.env["COLORTERM"] ?? ""
  return flag.includes("truecolor") || flag.includes("24bit")
}

export function logo(pad?: string) {
  if (!process.stdout.isTTY && !process.stderr.isTTY) {
    const result = []
    for (const row of wordmark) {
      if (pad) result.push(pad)
      result.push(row)
      result.push(EOL)
    }
    return result.join("").trimEnd()
  }

  const result: string[] = []
  const reset = "\x1b[0m"
  const gap = " "
  const color = truecolor()
  // The gradient runs across the wordmark as a whole, so both halves and the gap between them are
  // one continuous sweep rather than two independently-shaded blocks.
  const width = (glyphs.left[0]?.length ?? 0) + gap.length + (glyphs.right[0]?.length ?? 0)

  const fgAt = (column: number) => {
    if (!color) return column < (glyphs.left[0]?.length ?? 0) ? "\x1b[90m" : reset
    const [r, g, b] = gradientAt(width <= 1 ? 0 : column / (width - 1))
    return `\x1b[38;2;${r};${g};${b}m`
  }
  // Shading cells sit behind the glyphs, so they take the same hue heavily darkened.
  const shadeAt = (column: number, background: boolean) => {
    if (!color) {
      const dim = column < (glyphs.left[0]?.length ?? 0) ? "235" : "238"
      return background ? `\x1b[48;5;${dim}m` : `\x1b[38;5;${dim}m`
    }
    const [r, g, b] = gradientAt(width <= 1 ? 0 : column / (width - 1))
    const d = (v: number) => Math.round(v * 0.22)
    return `\x1b[${background ? 48 : 38};2;${d(r)};${d(g)};${d(b)}m`
  }

  const draw = (line: string, offset: number) => {
    const parts: string[] = []
    let column = offset
    for (const char of line) {
      if (char === "_") parts.push(shadeAt(column, true), " ", reset)
      else if (char === "^") parts.push(fgAt(column), shadeAt(column, true), "▀", reset)
      else if (char === "~") parts.push(shadeAt(column, false), "▀", reset)
      else if (char === " ") parts.push(" ")
      else parts.push(fgAt(column), char, reset)
      column++
    }
    return parts.join("")
  }

  const rightOffset = (glyphs.left[0]?.length ?? 0) + gap.length
  glyphs.left.forEach((row, index) => {
    if (pad) result.push(pad)
    result.push(draw(row, 0))
    result.push(gap)
    result.push(draw(glyphs.right[index] ?? "", rightOffset))
    result.push(EOL)
  })
  return result.join("").trimEnd()
}

export async function input(prompt: string): Promise<string> {
  const readline = require("readline")
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(prompt, (answer: string) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

export function error(message: string) {
  if (message.startsWith("Error: ")) {
    message = message.slice("Error: ".length)
  }
  println(Style.TEXT_DANGER_BOLD + "Error: " + Style.TEXT_NORMAL + message)
}

export function markdown(text: string): string {
  return text
}

export * as UI from "./ui"

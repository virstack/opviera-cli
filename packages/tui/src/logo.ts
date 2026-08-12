/**
 * The Opviera wordmark, split into two halves that are rendered in different shades.
 *
 * `marks` below are shading control characters, not glyphs: `_` and `~` render as blank shaded
 * cells and `^` as a shaded upper bar. Keep every row in a half the same width or the halves
 * will not line up.
 */
export const logo = {
  left: ["              ", "█▀▀█ █▀▀█ █__█", "█__█ █__█ █__█", "▀▀▀▀ █▀▀▀ ▀▄▄▀"],
  right: ["  ▄                ", "  █  █▀▀█ █▀▀▄ ▄▀▀█", "  █  █^^^ █___ █▄▄█", "  ▀  ▀▀▀▀ ▀___ ▀▀▀▀"],
}

export const go = {
  left: ["    ", "█▀▀▀", "█_^█", "▀▀▀▀"],
  right: ["    ", "█▀▀█", "█__█", "▀▀▀▀"],
}

export const marks = "_^~,"

/**
 * The brand gradient, sampled from the Opviera mark: cyan through deep blue to violet.
 *
 * The mark itself cannot be drawn in a terminal — at cell resolution its interlocking rings
 * collapse into an indistinct blob — so the wordmark carries the identity by wearing its colours,
 * swept left to right the way the orbit runs.
 */
const GRADIENT: [number, number, number][] = [
  [0x20, 0xe6, 0xc9], // #20E6C9 cyan
  [0x0e, 0x2b, 0xff], // #0E2BFF deep blue
  [0x7c, 0x3a, 0xed], // #7C3AED violet
]

/** Colour at 0..1 along the gradient. */
export function gradientAt(t: number): [number, number, number] {
  const clamped = Math.min(1, Math.max(0, t))
  const span = 1 / (GRADIENT.length - 1)
  const index = Math.min(GRADIENT.length - 2, Math.floor(clamped / span))
  const local = (clamped - index * span) / span
  const from = GRADIENT[index]!
  const to = GRADIENT[index + 1]!
  return [0, 1, 2].map((c) => Math.round(from[c]! + (to[c]! - from[c]!) * local)) as [number, number, number]
}

/**
 * 24-bit colour is not universal — Terminal.app and older TERMs only do 256. The callers fall back
 * to a grey scheme rather than approximating, because a wordmark in almost-right colours reads
 * worse than one in no colour.
 */
export function truecolor(): boolean {
  const flag = process.env["COLORTERM"] ?? ""
  return flag.includes("truecolor") || flag.includes("24bit")
}

/**
 * Render a two-half wordmark as ANSI rows, gradient-swept across its full width.
 *
 * Shared so the startup gate and the exit epilogue cannot drift apart — they were previously two
 * hand-maintained copies of the same art, which is how the exit screen kept the old product name
 * long after everything else was renamed.
 */
export function renderWordmark(art: { left: string[]; right: string[] }, pad = ""): string[] {
  const reset = "\x1b[0m"
  const gap = " "
  const color = truecolor()
  const leftWidth = art.left[0]?.length ?? 0
  const width = leftWidth + gap.length + (art.right[0]?.length ?? 0)
  const at = (column: number) => (width <= 1 ? 0 : column / (width - 1))

  const fg = (column: number) => {
    if (!color) return column < leftWidth ? "\x1b[90m" : reset
    const [r, g, b] = gradientAt(at(column))
    return `\x1b[38;2;${r};${g};${b}m`
  }
  // Shading cells sit behind the glyphs, so they take the same hue heavily darkened.
  const shade = (column: number, background: boolean) => {
    if (!color) {
      const dim = column < leftWidth ? "235" : "238"
      return background ? `\x1b[48;5;${dim}m` : `\x1b[38;5;${dim}m`
    }
    const [r, g, b] = gradientAt(at(column))
    const d = (v: number) => Math.round(v * 0.22)
    return `\x1b[${background ? 48 : 38};2;${d(r)};${d(g)};${d(b)}m`
  }

  const draw = (line: string, offset: number) => {
    const parts: string[] = []
    let column = offset
    for (const char of line) {
      if (char === "_") parts.push(shade(column, true), " ", reset)
      else if (char === "^") parts.push(fg(column), shade(column, true), "▀", reset)
      else if (char === "~") parts.push(shade(column, false), "▀", reset)
      else if (char === " ") parts.push(" ")
      else parts.push(fg(column), char, reset)
      column++
    }
    return parts.join("")
  }

  return art.left.map((row, index) => `${pad}${draw(row, 0)}${gap}${draw(art.right[index] ?? "", leftWidth + gap.length)}`)
}

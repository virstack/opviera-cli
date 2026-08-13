/**
 * The Opviera mark, as a colour raster.
 *
 * This replaces the block-glyph wordmark the fork inherited from upstream. The old art carried the
 * brand only by wearing its colours over relettered block capitals, on the assumption — written into
 * this file — that "the mark itself cannot be drawn in a terminal". Half-block cells disprove it:
 * `▀` with an independent foreground and background is two pixels per terminal row, and at 24×22
 * sub-pixels the interlocking rings survive intact. So the mark is now the logo, and the product
 * name is set as plain text beneath it rather than drawn.
 *
 * Downsampled from the icon in `landing_page/color_full_logo.svg` (the left 988px of
 * `full_color_logo.png`, 988×902), median-cut quantised to 12 colours. To regenerate at another
 * width: resize the icon crop to (w, round(w * 902 / 988)) rounded up to an even height, threshold
 * alpha at 0.45, quantise, re-emit. Do not hand-edit the grid — it will not survive.
 */
export const icon = {
  width: 24,
  palette: [
    "#01ebfd",
    "#02b9fb",
    "#157bf7",
    "#0081fd",
    "#732df3",
    "#4037ee",
    "#063af1",
    "#004bf8",
    "#002ce7",
    "#5e0ff5",
    "#0818d4",
    "#000cde",
  ],
  /**
   * SUB-PIXEL rows, two per terminal row. Each character indexes `palette`; `.` is transparent and
   * emits no background, so the mark sits on the terminal's own ground rather than a black box.
   */
  rows: [
    ".......13337............",
    "......11333776..........",
    ".....1111337778.........",
    ".....01113.76868........",
    "....0000....688887766...",
    "....0000..3778aaa676555.",
    "....00013337778aaa665599",
    "....001313337..aaa....99",
    "....1333333....aaaa...94",
    "....77333......aaaa...4.",
    "...66773........aaaa.44.",
    "..886631........aaaa.4..",
    ".b588710........aaaa4...",
    ".955b1001.......aaaa....",
    "9995..111.......aaaa....",
    "9999..111......68aaa....",
    "99994..111..556.a8aa....",
    ".994444211255...888a....",
    "...444442333....688.....",
    ".........3337.76868.....",
    "..........33377666......",
    "............77766.......",
  ],
}

/** The product name, set as text. It is deliberately not art — see the note on `icon`. */
export const wordmark = "Opviera CLI"

/** Terminal rows the icon occupies, two sub-pixel rows to each. */
export const iconHeight = icon.rows.length / 2

export const go = {
  left: ["    ", "█▀▀▀", "█_^█", "▀▀▀▀"],
  right: ["    ", "█▀▀█", "█__█", "▀▀▀▀"],
}

export type IconCell = {
  char: string
  /** Hex colour, or undefined for "leave the terminal's own colour alone". */
  fg?: string
  bg?: string
}

/**
 * One terminal row of the icon, pairing sub-pixel rows 2r and 2r+1.
 *
 * Shared by the Solid component and the ANSI renderer so the two cannot disagree about how a
 * half-transparent cell is drawn — the previous art had exactly that split, and the duplicate drifted.
 */
export function iconRow(row: number): IconCell[] {
  const top = icon.rows[row * 2] ?? ""
  const bottom = icon.rows[row * 2 + 1] ?? ""
  const cells: IconCell[] = []
  for (let column = 0; column < icon.width; column++) {
    const t = icon.palette[parseInt(top[column] ?? ".", 36)]
    const b = icon.palette[parseInt(bottom[column] ?? ".", 36)]
    if (!t && !b) cells.push({ char: " " })
    else if (!b) cells.push({ char: "▀", fg: t })
    else if (!t) cells.push({ char: "▄", fg: b })
    else cells.push({ char: "▀", fg: t, bg: b })
  }
  return cells
}

/**
 * 24-bit colour is not universal — Terminal.app and older TERMs only do 256.
 */
export function truecolor(): boolean {
  const flag = process.env["COLORTERM"] ?? ""
  return flag.includes("truecolor") || flag.includes("24bit")
}

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

/**
 * Nearest xterm-256 colour, via the 6×6×6 cube.
 *
 * The old wordmark renderer refused to approximate, falling back to grey instead, because a
 * near-miss hue on flat letterforms reads worse than no colour at all. A photographic mark is the
 * opposite case: it is already many colours, so a cube-quantised copy reads as the same picture.
 */
function xterm256(hex: string): number {
  const step = (v: number) => (v < 48 ? 0 : v < 114 ? 1 : Math.round((v - 35) / 40))
  const [r, g, b] = rgb(hex)
  return 16 + 36 * step(r) + 6 * step(g) + step(b)
}

function paint(hex: string, background: boolean, color: boolean): string {
  const layer = background ? 48 : 38
  if (!color) return `\x1b[${layer};5;${xterm256(hex)}m`
  const [r, g, b] = rgb(hex)
  return `\x1b[${layer};2;${r};${g};${b}m`
}

/**
 * The mark as ANSI rows, followed by a blank line and the centred wordmark.
 *
 * Shared by the startup gate, the CLI banners and the exit epilogue so they cannot drift apart —
 * they were previously three hand-maintained copies of the same art, which is how the exit screen
 * kept the old product name long after everything else had been renamed.
 */
export function renderIcon(pad = ""): string[] {
  const reset = "\x1b[0m"
  const color = truecolor()
  const rows: string[] = []
  for (let row = 0; row < iconHeight; row++) {
    const parts: string[] = [pad]
    for (const cell of iconRow(row)) {
      if (!cell.fg) {
        parts.push(cell.char)
        continue
      }
      // Reset after every cell: a run aborted mid-row must not bleed colour into scrollback.
      parts.push(cell.bg ? paint(cell.bg, true, color) : "", paint(cell.fg, false, color), cell.char, reset)
    }
    rows.push(parts.join("").trimEnd())
  }
  const indent = Math.max(0, Math.floor((icon.width - wordmark.length) / 2))
  rows.push("", `${pad}${" ".repeat(indent)}${wordmark}`)
  return rows
}

import { expect, test } from "bun:test"
import { icon, iconHeight, iconRow, renderIcon, wordmark } from "../src/logo"

test("the raster is well formed", () => {
  // Half-block cells pair two sub-pixel rows, so an odd row count would silently drop the last one.
  expect(icon.rows.length % 2).toBe(0)
  for (const row of icon.rows) {
    expect(row.length).toBe(icon.width)
    for (const char of row) {
      if (char === ".") continue
      const index = parseInt(char, 36)
      expect(index).toBeLessThan(icon.palette.length)
    }
  }
  for (const hex of icon.palette) expect(hex).toMatch(/^#[0-9a-f]{6}$/)
})

test("a cell's glyph follows its transparency", () => {
  const cells = Array.from({ length: iconHeight }, (_, row) => iconRow(row)).flat()
  expect(cells.length).toBe(icon.width * iconHeight)
  for (const cell of cells) {
    if (!cell.fg && !cell.bg) expect(cell.char).toBe(" ")
    // A background with no foreground would paint a block the glyph never covers.
    if (cell.bg) expect(cell.fg).toBeDefined()
  }
  // The mark is not blank in either half.
  expect(cells.some((cell) => cell.char === "▀")).toBe(true)
  expect(cells.some((cell) => cell.char === "▄")).toBe(true)
})

test("renderIcon ends with the wordmark", () => {
  const rows = renderIcon("  ")
  expect(rows.length).toBe(iconHeight + 2)
  expect(rows.at(-1)).toContain(wordmark)
  // Plain text, so the name survives a terminal that strips colour.
  expect(rows.at(-1)).not.toContain("\x1b[")
})

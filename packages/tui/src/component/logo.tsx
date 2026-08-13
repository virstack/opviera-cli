import { RGBA } from "@opentui/core"
import { For, type JSX } from "solid-js"
import { useTheme } from "../context/theme"
import { icon, iconHeight, iconRow, wordmark, type IconCell } from "../logo"

/**
 * The home screen mark.
 *
 * Colours come from the brand palette rather than the theme: this is artwork, not chrome, and the
 * previous two-tone `textMuted`/`text` split is why the logo read as generic after the rename. The
 * product name below it is plain theme text.
 */
export function Logo() {
  const { theme } = useTheme()
  const colors = new Map(icon.palette.map((hex) => [hex, RGBA.fromHex(hex)]))
  const color = (hex: string) => colors.get(hex)

  // Adjacent cells sharing a colour pair collapse into one <text>. The mark is 24×11 = 264 cells and
  // has long solid runs, so drawing one element per cell would cost far more than the old wordmark.
  const runs = (cells: IconCell[]): JSX.Element[] => {
    const out: JSX.Element[] = []
    let run: IconCell | undefined
    let text = ""
    const flush = () => {
      if (!run) return
      out.push(
        <text fg={run.fg ? color(run.fg) : undefined} bg={run.bg ? color(run.bg) : undefined} selectable={false}>
          {text}
        </text>,
      )
      text = ""
    }
    for (const cell of cells) {
      if (!run || run.fg !== cell.fg || run.bg !== cell.bg) {
        flush()
        run = cell
      }
      text += cell.char
    }
    flush()
    return out
  }

  const rows = Array.from({ length: iconHeight }, (_, index) => index)
  const indent = Math.max(0, Math.floor((icon.width - wordmark.length) / 2))

  return (
    <box>
      <For each={rows}>{(row) => <box flexDirection="row">{runs(iconRow(row))}</box>}</For>
      <box height={1} />
      <box flexDirection="row">
        <text fg={theme.text} selectable={false}>
          {" ".repeat(indent) + wordmark}
        </text>
      </box>
    </box>
  )
}

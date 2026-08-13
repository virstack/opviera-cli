import { expect, test } from "bun:test"
import { INPUT_UNDO_TIP, NO_MODELS_TIP, TERMINAL_SUSPEND_TIP, TIPS } from "../../src/feature-plugins/home/tips-view"

// Every shortcut resolves to a non-empty string so the `press(...)` tips return their text rather
// than undefined — otherwise the conditional ones would slip past the check unevaluated.
const shortcuts = new Proxy({} as never, { get: () => () => "ctrl+x" })

const rendered = () =>
  [...TIPS, INPUT_UNDO_TIP, TERMINAL_SUSPEND_TIP, NO_MODELS_TIP].flatMap((tip) => {
    const value = typeof tip === "string" ? tip : tip(shortcuts)
    return value ? [value] : []
  })

test("no tip mentions the upstream product", () => {
  // The list is long and append-friendly, which is exactly how it accumulated two dozen references
  // to the project this was forked from. Anything user-visible must say Opviera or say nothing.
  expect(rendered().filter((tip) => /opencode/i.test(tip))).toEqual([])
})

test("tips are unique and non-empty", () => {
  expect(rendered().length).toBe(new Set(rendered()).size)
  for (const tip of rendered()) expect(tip.trim()).not.toBe("")
})

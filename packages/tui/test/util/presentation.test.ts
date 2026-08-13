import { expect, test } from "bun:test"
import { sessionEpilogue } from "../../src/util/presentation"

test("formats session continuation summary", () => {
  const epilogue = sessionEpilogue({ title: "A session", sessionID: "ses_123" })
  expect(epilogue).toContain("A session")
  expect(epilogue).toContain("opviera -s ses_123")
})

test("carries the wordmark", () => {
  // The art is a colour raster with no letterforms in it, so the product name only reaches the exit
  // screen as this text line. Losing it is silent otherwise.
  expect(sessionEpilogue({ title: "A session", sessionID: "ses_123" })).toContain("Opviera CLI")
})

import { describe, expect, it } from "vitest"
import { boardHref } from "./navigation"

describe("boardHref", () => {
  it("preserves project scope when present", () => {
    expect(boardHref(" radial app ")).toBe("/?project=radial+app")
  })

  it("falls back to the board root without a project", () => {
    expect(boardHref("")).toBe("/")
    expect(boardHref(null)).toBe("/")
  })
})

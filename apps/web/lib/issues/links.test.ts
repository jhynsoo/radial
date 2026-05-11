import { describe, expect, it } from "vitest"
import { safeExternalHref } from "./links"

describe("safeExternalHref", () => {
  it("allows http and https URLs", () => {
    expect(safeExternalHref("https://example.com/path")).toBe(
      "https://example.com/path",
    )
    expect(safeExternalHref(" http://example.com ")).toBe(
      "http://example.com/",
    )
  })

  it("rejects unsafe or invalid URLs", () => {
    expect(safeExternalHref("data:text/plain,hello")).toBeNull()
    expect(safeExternalHref("file:///etc/passwd")).toBeNull()
    expect(safeExternalHref("javascript:alert(1)")).toBeNull()
    expect(safeExternalHref("not a url")).toBeNull()
    expect(safeExternalHref(null)).toBeNull()
  })
})

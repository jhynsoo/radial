import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { ProjectScopePicker } from "./project-scope-picker"

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

describe("ProjectScopePicker", () => {
  it("renders the current project and submit button", async () => {
    render(<ProjectScopePicker currentProject="radial" />)

    expect(screen.getByLabelText("Project")).toHaveValue("radial")
    await userEvent.clear(screen.getByLabelText("Project"))
    await userEvent.type(screen.getByLabelText("Project"), "symphony")
    expect(screen.getByRole("button", { name: "Open project" })).toBeEnabled()
  })
})

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ProjectScopePicker } from "./project-scope-picker"

const replaceMock = vi.fn()
let searchParams = new URLSearchParams()

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => searchParams,
}))

describe("ProjectScopePicker", () => {
  beforeEach(() => {
    replaceMock.mockClear()
    searchParams = new URLSearchParams()
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders the current project and submit button", async () => {
    render(<ProjectScopePicker currentProject="radial" />)

    expect(screen.getByLabelText("Project")).toHaveValue("radial")
    await userEvent.clear(screen.getByLabelText("Project"))
    await userEvent.type(screen.getByLabelText("Project"), "symphony")
    expect(screen.getByRole("button", { name: "Open project" })).toBeEnabled()
  })

  it("submits the changed project query", async () => {
    render(<ProjectScopePicker currentProject="radial" />)

    await userEvent.clear(screen.getByLabelText("Project"))
    await userEvent.type(screen.getByLabelText("Project"), "symphony")
    await userEvent.click(screen.getByRole("button", { name: "Open project" }))

    expect(replaceMock).toHaveBeenCalledWith("/?project=symphony")
  })

  it("preserves existing search params when changing projects", async () => {
    searchParams = new URLSearchParams("q=open&sort=priority")
    render(<ProjectScopePicker currentProject="radial" />)

    await userEvent.clear(screen.getByLabelText("Project"))
    await userEvent.type(screen.getByLabelText("Project"), "symphony")
    await userEvent.click(screen.getByRole("button", { name: "Open project" }))

    expect(replaceMock).toHaveBeenCalledWith(
      "/?q=open&sort=priority&project=symphony"
    )
  })

  it("writes valid projects to recent project storage", async () => {
    window.localStorage.setItem(
      "radial.recentProjects",
      JSON.stringify([" old ", "", "radial", "old", "api", "ops", "web"])
    )
    render(<ProjectScopePicker currentProject="radial" />)

    await userEvent.clear(screen.getByLabelText("Project"))
    await userEvent.type(screen.getByLabelText("Project"), " symphony ")
    await userEvent.click(screen.getByRole("button", { name: "Open project" }))

    expect(
      JSON.parse(window.localStorage.getItem("radial.recentProjects") ?? "[]")
    ).toEqual(["symphony", "old", "radial", "api", "ops"])
  })

  it("still navigates when recent project storage writes fail", async () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("Storage unavailable")
      })
    render(<ProjectScopePicker currentProject="radial" />)

    await userEvent.clear(screen.getByLabelText("Project"))
    await userEvent.type(screen.getByLabelText("Project"), "symphony")
    await userEvent.click(screen.getByRole("button", { name: "Open project" }))

    expect(replaceMock).toHaveBeenCalledWith("/?project=symphony")
    setItemSpy.mockRestore()
  })

  it("ignores invalid stored JSON without crashing", async () => {
    window.localStorage.setItem("radial.recentProjects", "{")

    expect(() =>
      render(<ProjectScopePicker currentProject="radial" />)
    ).not.toThrow()
    expect(screen.getByLabelText("Project")).toHaveValue("radial")
  })
})

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { BoardToolbar } from "./board-toolbar"

vi.mock("@/components/issues/project-scope-picker", () => ({
  ProjectScopePicker: ({ currentProject }: { currentProject: string }) => (
    <div data-testid="project-scope-picker">{currentProject}</div>
  ),
}))

describe("BoardToolbar", () => {
  it("preserves the selected team when submitting filters and creating issues", () => {
    render(
      <BoardToolbar
        assignee=""
        issueCount={2}
        label=""
        project="radial"
        query="auth"
        showEmptyStates
        sort="priority"
        team="RAD"
      />
    )

    const searchForm = screen
      .getByRole("button", { name: "Search" })
      .closest("form")

    expect(searchForm?.querySelector('input[name="team"]')).toHaveValue("RAD")
    expect(screen.getByRole("link", { name: "New issue" })).toHaveAttribute(
      "href",
      "/issues/new?project=radial&team=RAD"
    )
  })
})

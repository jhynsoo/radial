import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { IssueForm } from "./issue-form"

vi.mock("@/app/issues/actions", () => ({
  createIssueAction: vi.fn(),
}))

describe("IssueForm", () => {
  it("renders all create issue fields with project prefilled", () => {
    render(<IssueForm defaultProject="radial" />)

    expect(screen.getByLabelText("Project")).toHaveValue("radial")
    expect(screen.getByLabelText("Title")).toBeRequired()
    expect(screen.getByLabelText("Description")).toBeInTheDocument()
    expect(screen.getByLabelText("State")).toHaveValue("Todo")
    expect(screen.getByLabelText("Priority")).toHaveAttribute("type", "number")
    expect(screen.getByLabelText("Labels")).toHaveAttribute("name", "labels")
    expect(screen.getByLabelText("Assignee")).toHaveAttribute(
      "name",
      "assignee"
    )
    expect(screen.getByLabelText("Blocked by")).toHaveAttribute(
      "name",
      "blocked_by"
    )
    expect(screen.getByLabelText("Branch")).toHaveAttribute(
      "name",
      "branch_name"
    )
    expect(screen.getByLabelText("URL")).toHaveAttribute("type", "url")
    expect(screen.getByRole("button", { name: "Create issue" })).toHaveAttribute(
      "type",
      "submit"
    )
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/?project=radial"
    )
  })
})

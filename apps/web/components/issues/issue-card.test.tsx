import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { NormalizedIssue } from "@/lib/tracker/types"
import { IssueCard } from "./issue-card"

const issue: NormalizedIssue = {
  id: "issue-1",
  identifier: "RAD-1",
  title: "Build Kanban board",
  description: null,
  priority: 1,
  state: "Todo",
  branch_name: null,
  url: null,
  labels: ["ui"],
  blocked_by: [{ id: "issue-0", identifier: "RAD-0", state: "Todo" }],
  created_at: null,
  updated_at: "2026-05-12T00:00:00.000Z",
}

describe("IssueCard", () => {
  it("shows issue identity and blocker count", () => {
    render(<IssueCard issue={issue} />)

    expect(
      screen.getByRole("article", { name: "RAD-1 Build Kanban board" })
    ).toBeInTheDocument()
    expect(screen.getByText("RAD-1")).toBeInTheDocument()
    expect(screen.getByText("Build Kanban board")).toBeInTheDocument()
    expect(screen.getByText("P1")).toBeInTheDocument()
    expect(screen.getByText("ui")).toBeInTheDocument()
    expect(screen.getByText("1 blocker")).toBeInTheDocument()
  })

  it("renders a focused issue detail link without a drag handle", () => {
    render(<IssueCard issue={issue} />)

    const link = screen.getByRole("link", {
      name: "RAD-1 Build Kanban board",
    })

    expect(link).toHaveAttribute("href", "/issues/issue-1")
    expect(within(link).queryByText("P1")).not.toBeInTheDocument()
    expect(within(link).queryByText("ui")).not.toBeInTheDocument()
    expect(within(link).queryByText("1 blocker")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Drag issue RAD-1" })
    ).not.toBeInTheDocument()
  })
})

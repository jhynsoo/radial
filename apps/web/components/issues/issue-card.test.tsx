import { render, screen } from "@testing-library/react"
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
    render(<IssueCard issue={issue} draggable={false} />)

    expect(screen.getByText("RAD-1")).toBeInTheDocument()
    expect(screen.getByText("Build Kanban board")).toBeInTheDocument()
    expect(screen.getByText("1 blocker")).toBeInTheDocument()
  })
})

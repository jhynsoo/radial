import { describe, expect, it } from "vitest"
import { WORKFLOW_STATES } from "../tracker/constants"
import type { NormalizedIssue } from "../tracker/types"
import { filterIssues, groupIssuesByState, moveIssueState } from "./board"

function issue(overrides: Partial<NormalizedIssue>): NormalizedIssue {
  return {
    id: "issue-1",
    identifier: "RAD-1",
    title: "Build board",
    description: null,
    priority: null,
    state: "Todo",
    branch_name: null,
    url: null,
    labels: [],
    blocked_by: [],
    created_at: null,
    updated_at: null,
    ...overrides,
  }
}

describe("board model", () => {
  it("groups issues into every workflow column", () => {
    const grouped = groupIssuesByState([
      issue({ id: "issue-1", state: "Todo" }),
      issue({ id: "issue-2", state: "Done" }),
    ])

    expect(grouped.Todo).toHaveLength(1)
    expect(grouped.Done).toHaveLength(1)
    expect(Object.keys(grouped)).toEqual([...WORKFLOW_STATES])
    expect(grouped.Backlog).toEqual([])
    expect(grouped["In Progress"]).toEqual([])
    expect(grouped["Human Review"]).toEqual([])
    expect(grouped.Merging).toEqual([])
    expect(grouped.Rework).toEqual([])
  })

  it("filters by title, identifier, and labels", () => {
    const issues = [
      issue({ identifier: "RAD-1", title: "API console", labels: ["api"] }),
      issue({ identifier: "RAD-2", title: "Polish board", labels: ["ui"] }),
    ]

    expect(filterIssues(issues, "rad-1")).toHaveLength(1)
    expect(filterIssues(issues, "polish")).toHaveLength(1)
    expect(filterIssues(issues, "UI")).toHaveLength(1)
    expect(filterIssues(issues, "")).toHaveLength(2)
  })

  it("moves one issue to a new state without mutating the original list", () => {
    const issues = [issue({ id: "issue-1", state: "Todo" })]
    const moved = moveIssueState(issues, "issue-1", "In Progress")

    expect(moved[0]?.state).toBe("In Progress")
    expect(issues[0]?.state).toBe("Todo")
  })
})

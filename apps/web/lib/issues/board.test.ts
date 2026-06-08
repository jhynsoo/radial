import { describe, expect, it } from "vitest"
import { WORKFLOW_STATES } from "../tracker/constants"
import type { NormalizedIssue } from "../tracker/types"
import {
  filterIssues,
  findIssueColumn,
  groupIssuesByState,
  moveIssueState,
  restoreCanonicalColumnOrder,
  updateIssueStateInColumns,
} from "./board"

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

  it("groups issues into configured workflow columns", () => {
    const grouped = groupIssuesByState(
      [
        issue({ id: "issue-1", state: "Todo" }),
        issue({ id: "issue-2", state: "QA Review" }),
      ],
      ["Todo", "QA Review", "Done"]
    )

    expect(Object.keys(grouped)).toEqual(["Todo", "QA Review", "Done"])
    expect(grouped.Todo!.map((candidate) => candidate.id)).toEqual(["issue-1"])
    expect(grouped["QA Review"]!.map((candidate) => candidate.id)).toEqual([
      "issue-2",
    ])
    expect(grouped.Done).toEqual([])
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

  it("filters by assignee and label before applying display sort", () => {
    const issues = [
      issue({
        id: "issue-1",
        identifier: "RAD-1",
        title: "API console",
        assignee: "me",
        labels: ["api"],
        priority: 3,
        updated_at: "2026-06-01T00:00:00.000Z",
      }),
      issue({
        id: "issue-2",
        identifier: "RAD-2",
        title: "API worker",
        assignee: "me",
        labels: ["backend"],
        priority: 1,
        updated_at: "2026-06-03T00:00:00.000Z",
      }),
      issue({
        id: "issue-3",
        identifier: "RAD-3",
        title: "UI polish",
        assignee: null,
        labels: ["api"],
        priority: 2,
        updated_at: "2026-06-02T00:00:00.000Z",
      }),
    ]

    expect(
      filterIssues(issues, {
        query: "api",
        assignee: "me",
        sort: "priority",
      }).map((candidate) => candidate.id)
    ).toEqual(["issue-2", "issue-1"])
    expect(
      filterIssues(issues, {
        label: "API",
        sort: "updated_at",
      }).map((candidate) => candidate.id)
    ).toEqual(["issue-3", "issue-1"])
  })

  it("moves one issue to a new state without mutating the original list", () => {
    const issues = [issue({ id: "issue-1", state: "Todo" })]
    const moved = moveIssueState(issues, "issue-1", "In Progress")

    expect(moved[0]?.state).toBe("In Progress")
    expect(issues[0]?.state).toBe("Todo")
  })

  it("finds the workflow column containing an issue", () => {
    const grouped = groupIssuesByState([
      issue({ id: "issue-1", state: "Todo" }),
      issue({ id: "issue-2", state: "In Progress" }),
    ])

    expect(findIssueColumn(grouped, "issue-2")).toBe("In Progress")
    expect(findIssueColumn(grouped, "missing")).toBeNull()
  })

  it("finds and updates issues with configured workflow columns", () => {
    const workflowStates = ["Todo", "QA Review", "Done"]
    const grouped = groupIssuesByState(
      [
        issue({ id: "issue-1", state: "Todo" }),
        issue({ id: "issue-2", state: "QA Review" }),
      ],
      workflowStates
    )

    expect(findIssueColumn(grouped, "issue-2", workflowStates)).toBe(
      "QA Review"
    )

    const updated = updateIssueStateInColumns(
      grouped,
      "issue-1",
      "QA Review",
      workflowStates
    )

    expect(updated.Todo).toEqual([])
    expect(updated["QA Review"]!.map((candidate) => candidate.id)).toEqual([
      "issue-2",
      "issue-1",
    ])
  })

  it("updates the moved issue state inside grouped columns", () => {
    const grouped = groupIssuesByState([
      issue({ id: "issue-1", state: "Todo" }),
      issue({ id: "issue-2", state: "In Progress" }),
      issue({ id: "issue-3", state: "Done" }),
    ])

    const updated = updateIssueStateInColumns(grouped, "issue-1", "In Progress")

    expect(updated.Todo).toHaveLength(0)
    expect(updated["In Progress"]!.map((candidate) => candidate.id)).toEqual([
      "issue-2",
      "issue-1",
    ])
    expect(updated["In Progress"]![1]).toMatchObject({
      id: "issue-1",
      state: "In Progress",
    })
    expect(grouped.Todo![0]?.state).toBe("Todo")
  })

  it("restores canonical order from the source issue list", () => {
    const sourceIssues = [
      issue({ id: "issue-1", state: "Todo", title: "First" }),
      issue({ id: "issue-2", state: "Todo", title: "Second" }),
    ]
    const reordered = {
      ...groupIssuesByState(sourceIssues),
      Todo: [sourceIssues[1]!, sourceIssues[0]!],
    }

    const restored = restoreCanonicalColumnOrder(reordered, sourceIssues)

    expect(restored.Todo!.map((candidate) => candidate.id)).toEqual([
      "issue-1",
      "issue-2",
    ])
  })
})

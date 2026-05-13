import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NormalizedIssue } from "@/lib/tracker/types"
import Page from "./page"

const { searchIssuesMock } = vi.hoisted(() => ({
  searchIssuesMock: vi.fn(),
}))

vi.mock("@/components/issues/board-toolbar", () => ({
  BoardToolbar: ({
    issueCount,
    project,
    query,
  }: {
    issueCount: number
    project: string
    query: string
  }) => (
    <div data-testid="toolbar">
      {project}:{query}:{issueCount}
    </div>
  ),
}))

vi.mock("@/components/issues/issue-kanban-board", async () => {
  const React = await vi.importActual<typeof import("react")>("react")

  return {
    IssueKanbanBoard: ({ issues }: { issues: NormalizedIssue[] }) => {
      const [mountedIssues] = React.useState(issues)

      return (
        <div data-testid="board">
          {mountedIssues.map((issue) => issue.identifier).join(",")}
        </div>
      )
    },
  }
})

vi.mock("@/lib/tracker/client", () => ({
  searchIssues: searchIssuesMock,
}))

const issues: NormalizedIssue[] = [
  {
    id: "issue-1",
    identifier: "RAD-1",
    title: "Auth bug",
    description: null,
    priority: 1,
    state: "Todo",
    branch_name: null,
    url: null,
    labels: [],
    blocked_by: [],
    created_at: null,
    updated_at: null,
  },
  {
    id: "issue-2",
    identifier: "RAD-2",
    title: "Billing work",
    description: null,
    priority: 2,
    state: "In Progress",
    branch_name: null,
    url: null,
    labels: [],
    blocked_by: [],
    created_at: null,
    updated_at: null,
  },
]

describe("Page", () => {
  beforeEach(() => {
    searchIssuesMock.mockReset()
  })

  it("uses the first duplicate query param value", async () => {
    searchIssuesMock.mockResolvedValueOnce(issues)

    render(
      await Page({
        searchParams: Promise.resolve({
          project: [" radial ", "ignored"],
          q: [" auth ", "ignored"],
        }),
      })
    )

    expect(searchIssuesMock).toHaveBeenCalledWith({
      project: "radial",
      states: expect.any(Array),
    })
    expect(screen.getByTestId("toolbar")).toHaveTextContent("radial:auth:1")
    expect(screen.getByTestId("board")).toHaveTextContent("RAD-1")
    expect(screen.getByTestId("board")).not.toHaveTextContent("RAD-2")
  })

  it("renders the toolbar and error panel when loading issues fails", async () => {
    searchIssuesMock.mockRejectedValueOnce({
      category: "tracker_request_failed",
      message: "Tracker unavailable.",
    })

    render(
      await Page({
        searchParams: Promise.resolve({ project: "radial", q: "auth" }),
      })
    )

    expect(screen.getByTestId("toolbar")).toHaveTextContent("radial:auth:0")
    expect(
      screen.getByText("tracker_request_failed: Tracker unavailable.")
    ).toBeInTheDocument()
    expect(screen.getByTestId("board")).toHaveTextContent("")
  })

  it("remounts the board when the active scope changes", async () => {
    searchIssuesMock
      .mockResolvedValueOnce([issues[0]])
      .mockResolvedValueOnce([issues[1]])

    const { rerender } = render(
      await Page({
        searchParams: Promise.resolve({ project: "radial", q: "auth" }),
      })
    )
    expect(screen.getByTestId("board")).toHaveTextContent("RAD-1")

    rerender(
      await Page({
        searchParams: Promise.resolve({ project: "other", q: "billing" }),
      })
    )

    expect(screen.getByTestId("board")).toHaveTextContent("RAD-2")
    expect(screen.getByTestId("board")).not.toHaveTextContent("RAD-1")
  })
})

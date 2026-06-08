import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { IssueSortKey } from "@/lib/issues/board"
import type { NormalizedIssue } from "@/lib/tracker/types"
import Page from "./page"

const { listTeamsMock, listWorkflowStatesMock, searchIssuesMock } = vi.hoisted(
  () => ({
    listTeamsMock: vi.fn(),
    listWorkflowStatesMock: vi.fn(),
    searchIssuesMock: vi.fn(),
  })
)

const workflowState = {
  id: "workflow-state-1",
  team_key: "RAD",
  name: "QA Review",
  type: "started" as const,
  position: 1,
  created_at: "2026-05-12T00:00:00.000Z",
  updated_at: "2026-05-12T00:00:00.000Z",
}

const team = {
  key: "RAD",
  name: "Radial Team",
  description: null,
  workflow_states: [
    {
      ...workflowState,
      id: "workflow-state-0",
      name: "Todo",
      position: 0,
      type: "unstarted" as const,
    },
    workflowState,
  ],
  created_at: "2026-05-12T00:00:00.000Z",
  updated_at: "2026-05-12T00:00:00.000Z",
}

vi.mock("@/components/issues/board-toolbar", () => ({
  BoardToolbar: ({
    assignee,
    issueCount,
    label,
    project,
    query,
    showEmptyStates,
    sort,
  }: {
    assignee: string
    issueCount: number
    label: string
    project: string
    query: string
    showEmptyStates: boolean
    sort?: IssueSortKey
  }) => (
    <div data-testid="toolbar">
      {[
        project,
        query,
        assignee,
        label,
        sort ?? "",
        String(showEmptyStates),
        issueCount,
      ].join(":")}
    </div>
  ),
}))

vi.mock("@/components/issues/issue-kanban-board", async () => {
  const React = await vi.importActual<typeof import("react")>("react")

  return {
    IssueKanbanBoard: ({
      issues,
      showEmptyStates,
      workflowStates,
    }: {
      issues: NormalizedIssue[]
      showEmptyStates?: boolean
      workflowStates?: readonly string[]
    }) => {
      const [mountedIssues] = React.useState(issues)

      return (
        <div data-testid="board">
          {mountedIssues.map((issue) => issue.identifier).join(",")}
          <span data-testid="show-empty">{String(showEmptyStates)}</span>
          <span data-testid="workflow-states">
            {(workflowStates ?? []).join(",")}
          </span>
        </div>
      )
    },
  }
})

vi.mock("@/lib/tracker/client", () => ({
  listTeams: listTeamsMock,
  listWorkflowStates: listWorkflowStatesMock,
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
    assignee: "me",
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
    assignee: null,
    labels: [],
    blocked_by: [],
    created_at: null,
    updated_at: null,
  },
]

describe("Page", () => {
  beforeEach(() => {
    listTeamsMock.mockReset()
    listTeamsMock.mockResolvedValue([])
    listWorkflowStatesMock.mockReset()
    listWorkflowStatesMock.mockResolvedValue([])
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
    expect(screen.getByTestId("toolbar")).toHaveTextContent(
      "radial:auth::::true:1"
    )
    expect(screen.getByTestId("board")).toHaveTextContent("RAD-1")
    expect(screen.getByTestId("board")).not.toHaveTextContent("RAD-2")
  })

  it("loads configured workflow states for board searches", async () => {
    listTeamsMock.mockResolvedValueOnce([team])
    searchIssuesMock.mockResolvedValueOnce([
      {
        ...issues[0],
        state: "QA Review",
      },
    ])

    render(
      await Page({
        searchParams: Promise.resolve({
          project: "radial",
        }),
      })
    )

    expect(listTeamsMock).toHaveBeenCalledOnce()
    expect(listWorkflowStatesMock).not.toHaveBeenCalled()
    expect(searchIssuesMock).toHaveBeenCalledWith({
      project: "radial",
      states: ["Todo", "QA Review"],
    })
    expect(screen.getByTestId("workflow-states")).toHaveTextContent(
      "Todo,QA Review"
    )
    expect(screen.getByTestId("board")).toHaveTextContent("RAD-1")
  })

  it("loads team-specific workflow states when the team param is present", async () => {
    listWorkflowStatesMock.mockResolvedValueOnce(team.workflow_states)
    searchIssuesMock.mockResolvedValueOnce([
      {
        ...issues[0],
        state: "QA Review",
      },
    ])

    render(
      await Page({
        searchParams: Promise.resolve({
          project: "radial",
          team: "RAD",
        }),
      })
    )

    expect(listTeamsMock).not.toHaveBeenCalled()
    expect(listWorkflowStatesMock).toHaveBeenCalledWith("RAD")
    expect(searchIssuesMock).toHaveBeenCalledWith({
      project: "radial",
      states: ["Todo", "QA Review"],
    })
    expect(screen.getByTestId("workflow-states")).toHaveTextContent(
      "Todo,QA Review"
    )
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

    expect(screen.getByTestId("toolbar")).toHaveTextContent(
      "radial:auth::::true:0"
    )
    expect(
      screen.getByText("tracker_request_failed: Tracker unavailable.")
    ).toBeInTheDocument()
    expect(screen.getByTestId("board")).not.toHaveTextContent("RAD-")
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

  it("applies URL filters and display options to the board", async () => {
    searchIssuesMock.mockResolvedValueOnce([
      {
        ...issues[0],
        labels: ["backend"],
        priority: 2,
        updated_at: "2026-06-01T00:00:00.000Z",
      },
      {
        ...issues[1],
        assignee: "me",
        labels: ["backend"],
        priority: 1,
        updated_at: "2026-06-02T00:00:00.000Z",
      },
    ])

    render(
      await Page({
        searchParams: Promise.resolve({
          project: "radial",
          q: "work",
          assignee: "me",
          label: "backend",
          sort: "priority",
          show_empty: "false",
        }),
      })
    )

    expect(searchIssuesMock).toHaveBeenCalledWith({
      project: "radial",
      states: expect.any(Array),
      assignee: "me",
    })
    expect(screen.getByTestId("toolbar")).toHaveTextContent(
      "radial:work:me:backend:priority:false:1"
    )
    expect(screen.getByTestId("board")).toHaveTextContent("RAD-2")
    expect(screen.getByTestId("board")).not.toHaveTextContent("RAD-1")
    expect(screen.getByTestId("show-empty")).toHaveTextContent("false")
  })
})

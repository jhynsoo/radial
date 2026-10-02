import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { IssueDetail, IssueTeam } from "@/lib/tracker/types"
import Page from "./page"

const { getIssueMock, listTeamsMock, listWorkflowStatesMock } = vi.hoisted(
  () => ({
    getIssueMock: vi.fn(),
    listTeamsMock: vi.fn(),
    listWorkflowStatesMock: vi.fn(),
  })
)

vi.mock("@/components/issues/issue-form", () => ({
  IssueForm: ({
    issue,
    workflowStates,
  }: {
    issue: IssueDetail
    workflowStates?: readonly string[]
  }) => (
    <div data-testid="issue-form">
      {issue.identifier}:{(workflowStates ?? []).join(",")}
    </div>
  ),
}))

vi.mock("@/lib/tracker/client", () => ({
  getIssue: getIssueMock,
  listTeams: listTeamsMock,
  listWorkflowStates: listWorkflowStatesMock,
  TrackerClientError: class TrackerClientError extends Error {
    constructor(
      public readonly category: string,
      message: string
    ) {
      super(message)
    }
  },
}))

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("not found")
  }),
}))

describe("EditIssuePage", () => {
  beforeEach(() => {
    getIssueMock.mockReset()
    getIssueMock.mockResolvedValue(issueDetail())
    listTeamsMock.mockReset()
    listTeamsMock.mockResolvedValue([team()])
    listWorkflowStatesMock.mockReset()
    listWorkflowStatesMock.mockResolvedValue([])
  })

  it("passes configured workflow states to the edit form", async () => {
    render(
      await Page({
        params: Promise.resolve({ issueId: "issue-1" }),
        searchParams: Promise.resolve({}),
      })
    )

    expect(getIssueMock).toHaveBeenCalledWith("issue-1")
    expect(listTeamsMock).toHaveBeenCalledOnce()
    expect(listWorkflowStatesMock).not.toHaveBeenCalled()
    expect(screen.getByTestId("issue-form")).toHaveTextContent(
      "RAD-1:Todo,QA Review"
    )
  })

  it("loads team-specific workflow states when the team param is present", async () => {
    listWorkflowStatesMock.mockResolvedValueOnce(team().workflow_states)

    render(
      await Page({
        params: Promise.resolve({ issueId: "issue-1" }),
        searchParams: Promise.resolve({ team: "RAD" }),
      })
    )

    expect(listTeamsMock).not.toHaveBeenCalled()
    expect(listWorkflowStatesMock).toHaveBeenCalledWith("RAD")
    expect(screen.getByTestId("issue-form")).toHaveTextContent(
      "RAD-1:Todo,QA Review"
    )
  })
})

function issueDetail(): IssueDetail {
  return {
    id: "issue-1",
    identifier: "RAD-1",
    title: "Fix issue editing",
    description: "Original body",
    priority: 2,
    state: "Todo",
    branch_name: "feat/edit",
    url: "https://example.com",
    assignee: "me",
    labels: ["api", "web"],
    blocked_by: [],
    created_at: null,
    updated_at: null,
    project: "radial",
    comments: [],
    links: [],
    relations: [],
  }
}

function team(): IssueTeam {
  return {
    key: "RAD",
    name: "Radial Team",
    description: null,
    workflow_states: [
      {
        id: "workflow-state-0",
        team_key: "RAD",
        name: "Todo",
        type: "unstarted",
        position: 0,
        created_at: "2026-05-12T00:00:00.000Z",
        updated_at: "2026-05-12T00:00:00.000Z",
      },
      {
        id: "workflow-state-1",
        team_key: "RAD",
        name: "QA Review",
        type: "started",
        position: 1,
        created_at: "2026-05-12T00:00:00.000Z",
        updated_at: "2026-05-12T00:00:00.000Z",
      },
    ],
    created_at: "2026-05-12T00:00:00.000Z",
    updated_at: "2026-05-12T00:00:00.000Z",
  }
}

import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { IssueTeam } from "@/lib/tracker/types"
import Page from "./page"

const { listTeamsMock, listWorkflowStatesMock } = vi.hoisted(() => ({
  listTeamsMock: vi.fn(),
  listWorkflowStatesMock: vi.fn(),
}))

vi.mock("@/components/issues/issue-form", () => ({
  IssueForm: ({
    defaultProject,
    workflowStates,
  }: {
    defaultProject?: string
    workflowStates?: readonly string[]
  }) => (
    <div data-testid="issue-form">
      {defaultProject}:{(workflowStates ?? []).join(",")}
    </div>
  ),
}))

vi.mock("@/lib/tracker/client", () => ({
  listTeams: listTeamsMock,
  listWorkflowStates: listWorkflowStatesMock,
}))

describe("NewIssuePage", () => {
  beforeEach(() => {
    listTeamsMock.mockReset()
    listTeamsMock.mockResolvedValue([])
    listWorkflowStatesMock.mockReset()
    listWorkflowStatesMock.mockResolvedValue([])
  })

  it("prefills the issue form from the first project search param value", async () => {
    render(
      await Page({
        searchParams: Promise.resolve({
          project: [" radial ", "ignored"],
        }),
      })
    )

    expect(
      screen.getByRole("heading", { name: "Create issue" })
    ).toBeInTheDocument()
    expect(screen.getByTestId("issue-form")).toHaveTextContent("radial:")
  })

  it("passes team-specific workflow states to the issue form", async () => {
    listWorkflowStatesMock.mockResolvedValueOnce(team().workflow_states)

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
    expect(screen.getByTestId("issue-form")).toHaveTextContent(
      "radial:Todo,QA Review"
    )
  })
})

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

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { IssueDetail } from "@/lib/tracker/types"
import { StateChangeForm } from "./issue-mutation-forms"

vi.mock("@/app/issues/actions", () => ({
  attachLinkAction: vi.fn(),
  createCommentAction: vi.fn(),
  createRelationAction: vi.fn(),
  deactivateCommentAction: vi.fn(),
  updateCommentAction: vi.fn(),
  updateIssueStateAction: vi.fn(),
}))

const issue: IssueDetail = {
  id: "issue-1",
  identifier: "RAD-1",
  title: "Terminal issue",
  description: null,
  priority: null,
  state: "Closed",
  branch_name: null,
  url: null,
  labels: [],
  blocked_by: [],
  created_at: null,
  updated_at: null,
  project: "radial",
  comments: [],
  links: [],
  relations: [],
}

describe("StateChangeForm", () => {
  it("preserves the current state when it is outside workflow columns", () => {
    render(<StateChangeForm issue={issue} />)

    expect(screen.getByLabelText("State")).toHaveValue("Closed")
    expect(screen.getByRole("option", { name: "Closed (current)" }))
      .toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Backlog" })).toHaveValue(
      "Backlog",
    )
  })
})

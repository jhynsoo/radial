import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { IssueDetail } from "@/lib/tracker/types"
import { IssueDetailView } from "./issue-detail"

vi.mock("@/components/issues/issue-mutation-forms", () => ({
  CommentCreateForm: () => <div data-testid="comment-create-form" />,
  CommentItem: () => <div data-testid="comment-item" />,
  LinkAttachForm: () => <div data-testid="link-attach-form" />,
  RelationCreateForm: () => <div data-testid="relation-create-form" />,
  StateChangeForm: () => <div data-testid="state-change-form" />,
}))

const issue: IssueDetail = {
  id: "issue-1",
  identifier: "RAD-1",
  title: "Inspect unsafe links",
  description: null,
  priority: null,
  state: "Todo",
  branch_name: null,
  url: "data:text/plain,issue",
  labels: [],
  blocked_by: [],
  created_at: null,
  updated_at: null,
  project: "radial",
  comments: [],
  links: [
    {
      id: "link-1",
      issue_id: "issue-1",
      url: "https://example.com/spec",
      title: "Spec",
      type: "doc",
      created_at: "2026-05-12T00:00:00.000Z",
    },
    {
      id: "link-2",
      issue_id: "issue-1",
      url: "data:text/plain,link",
      title: "Unsafe",
      type: "doc",
      created_at: "2026-05-12T00:00:00.000Z",
    },
  ],
  relations: [],
}

describe("IssueDetailView", () => {
  it("does not render unsafe source or issue links as anchors", () => {
    render(<IssueDetailView issue={issue} />)

    expect(screen.queryByRole("link", { name: "Source issue" }))
      .not.toBeInTheDocument()
    expect(screen.getByText("Source: data:text/plain,issue")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Spec/ })).toHaveAttribute(
      "href",
      "https://example.com/spec",
    )
    expect(screen.getByText("Unsafe").closest("a")).toBeNull()
  })
})

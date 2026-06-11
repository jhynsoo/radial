import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { IssueDetail } from "@/lib/tracker/types"
import { IssueForm } from "./issue-form"

vi.mock("@/app/issues/actions", () => ({
  createIssueAction: vi.fn(),
}))

describe("IssueForm", () => {
  it("renders all create issue fields with project prefilled", () => {
    render(<IssueForm defaultProject="radial" />)

    expect(screen.getByLabelText("Project")).toHaveValue("radial")
    expect(screen.getByLabelText("Title")).toBeRequired()
    expect(screen.getByLabelText("Description")).toBeInTheDocument()
    expect(screen.getByLabelText("State")).toHaveValue("Todo")
    expect(screen.getByLabelText("Priority")).toHaveAttribute("type", "number")
    expect(screen.getByLabelText("Labels")).toHaveAttribute("name", "labels")
    expect(screen.getByLabelText("Assignee")).toHaveAttribute(
      "name",
      "assignee"
    )
    expect(screen.getByLabelText("Blocked by")).toHaveAttribute(
      "name",
      "blocked_by"
    )
    expect(screen.getByLabelText("Branch")).toHaveAttribute(
      "name",
      "branch_name"
    )
    expect(screen.getByLabelText("URL")).toHaveAttribute("type", "url")
    expect(
      screen.getByRole("button", { name: "Create issue" })
    ).toHaveAttribute("type", "submit")
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/?project=radial"
    )
  })

  it("renders editable issue fields with existing values", () => {
    const { container } = render(
      <IssueForm
        cancelHref="/issues/issue-1"
        issue={issueDetail()}
        submitLabel="Save issue"
      />
    )

    expect(screen.getByLabelText("Project")).toHaveValue("radial")
    expect(screen.getByLabelText("Project")).toHaveAttribute("readOnly")
    expect(screen.getByLabelText("Title")).toHaveValue("Fix issue editing")
    expect(screen.getByLabelText("Description")).toHaveValue("Original body")
    expect(screen.getByLabelText("State")).toHaveValue("Todo")
    expect(screen.getByLabelText("Priority")).toHaveValue(2)
    expect(screen.getByLabelText("Labels")).toHaveValue("api, web")
    expect(screen.getByLabelText("Assignee")).toHaveValue("me")
    expect(screen.getByLabelText("Blocked by")).toHaveValue(
      "issue-0, external-1"
    )
    expect(
      container.querySelector('input[name="blocked_by_metadata"]')
    ).toHaveValue(
      JSON.stringify([
        {
          id: "issue-0",
          identifier: "RAD-0",
          state: "Done",
        },
        {
          id: "external-1",
          identifier: "EXT-1",
          state: null,
        },
      ])
    )
    expect(screen.getByLabelText("Branch")).toHaveValue("feat/edit")
    expect(screen.getByLabelText("URL")).toHaveValue("https://example.com")
    expect(screen.getByRole("button", { name: "Save issue" })).toHaveAttribute(
      "type",
      "submit"
    )
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/issues/issue-1"
    )
  })

  it("renders configured workflow state options", () => {
    render(
      <IssueForm
        cancelHref="/issues/issue-1"
        issue={issueDetail()}
        submitLabel="Save issue"
        workflowStates={["Todo", "QA Review", "Done"]}
      />
    )

    expect(screen.getByRole("option", { name: "QA Review" })).toHaveValue(
      "QA Review"
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
    blocked_by: [
      {
        id: "issue-0",
        identifier: "RAD-0",
        state: "Done",
      },
      {
        id: "external-1",
        identifier: "EXT-1",
        state: null,
      },
    ],
    created_at: null,
    updated_at: null,
    project: "radial",
    comments: [],
    links: [],
    relations: [],
  }
}

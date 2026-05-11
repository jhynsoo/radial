import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import Page from "./page"

vi.mock("@/components/issues/issue-form", () => ({
  IssueForm: ({ defaultProject }: { defaultProject?: string }) => (
    <div data-testid="issue-form">{defaultProject}</div>
  ),
}))

describe("NewIssuePage", () => {
  it("prefills the issue form from the first project search param value", async () => {
    render(
      await Page({
        searchParams: Promise.resolve({
          project: [" radial ", "ignored"],
        }),
      }),
    )

    expect(
      screen.getByRole("heading", { name: "Create issue" }),
    ).toBeInTheDocument()
    expect(screen.getByTestId("issue-form")).toHaveTextContent("radial")
  })
})

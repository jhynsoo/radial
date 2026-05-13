import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { IssueColumn } from "./issue-column"

vi.mock("@dnd-kit/core", () => ({
  useDroppable: () => ({
    isOver: false,
    setNodeRef: vi.fn(),
  }),
}))

describe("IssueColumn", () => {
  it("renders a stable empty lane when no issues are present", () => {
    render(
      <IssueColumn count={0} state="Todo">
        {null}
      </IssueColumn>
    )

    expect(screen.getByText("Todo")).toBeInTheDocument()
    expect(screen.getByText("0")).toBeInTheDocument()
    expect(screen.getByText("No issues")).toBeInTheDocument()
  })
})

import { describe, expect, it } from "vitest"
import { isWorkflowState, stateKey, WORKFLOW_STATES } from "./constants"

describe("tracker constants", () => {
  it("keeps the default board states in workflow order", () => {
    expect(WORKFLOW_STATES).toEqual([
      "Backlog",
      "Todo",
      "In Progress",
      "Human Review",
      "Merging",
      "Rework",
      "Done",
    ])
  })

  it("matches states case-insensitively after trimming", () => {
    expect(isWorkflowState(" todo ")).toBe(true)
    expect(isWorkflowState(" HUMAN REVIEW ")).toBe(true)
    expect(isWorkflowState("Duplicate")).toBe(false)
  })

  it("normalizes state keys", () => {
    expect(stateKey(" Human Review ")).toBe("human review")
  })
})

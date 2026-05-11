export const WORKFLOW_STATES = [
  "Backlog",
  "Todo",
  "In Progress",
  "Human Review",
  "Merging",
  "Rework",
  "Done",
] as const

export type WorkflowState = (typeof WORKFLOW_STATES)[number]

const workflowStateKeys = new Set(
  WORKFLOW_STATES.map((state) => state.trim().toLowerCase())
)

export function isWorkflowState(value: string): value is WorkflowState {
  return workflowStateKeys.has(value.trim().toLowerCase())
}

export function stateKey(value: string): string {
  return value.trim().toLowerCase()
}

import {
  stateKey,
  WORKFLOW_STATES,
  type WorkflowState,
} from "../tracker/constants"
import type { NormalizedIssue } from "../tracker/types"

export type IssuesByState = Record<WorkflowState, NormalizedIssue[]>

export function groupIssuesByState(issues: NormalizedIssue[]): IssuesByState {
  const grouped = Object.fromEntries(
    WORKFLOW_STATES.map((state) => [state, [] as NormalizedIssue[]])
  ) as IssuesByState

  for (const issue of issues) {
    const matchedState = WORKFLOW_STATES.find(
      (state) => stateKey(state) === stateKey(issue.state)
    )
    if (matchedState) {
      grouped[matchedState].push(issue)
    }
  }

  return grouped
}

export function filterIssues(
  issues: NormalizedIssue[],
  query: string
): NormalizedIssue[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return issues
  }

  return issues.filter((issue) => {
    const searchable = [
      issue.identifier,
      issue.title,
      issue.description ?? "",
      ...issue.labels,
    ]
      .join(" ")
      .toLowerCase()

    return searchable.includes(normalizedQuery)
  })
}

export function moveIssueState(
  issues: NormalizedIssue[],
  issueId: string,
  state: WorkflowState
): NormalizedIssue[] {
  return issues.map((issue) =>
    issue.id === issueId ? { ...issue, state } : issue
  )
}

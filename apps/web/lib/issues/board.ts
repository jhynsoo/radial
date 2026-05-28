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

export function findIssueColumn(
  columns: IssuesByState,
  issueId: string
): WorkflowState | null {
  for (const state of WORKFLOW_STATES) {
    if (columns[state].some((issue) => issue.id === issueId)) {
      return state
    }
  }

  return null
}

export function updateIssueStateInColumns(
  columns: IssuesByState,
  issueId: string,
  nextState: WorkflowState
): IssuesByState {
  const updated = Object.fromEntries(
    WORKFLOW_STATES.map((state) => [state, [] as NormalizedIssue[]])
  ) as IssuesByState
  let movedIssue: NormalizedIssue | null = null

  for (const state of WORKFLOW_STATES) {
    for (const issue of columns[state]) {
      if (issue.id === issueId) {
        movedIssue = { ...issue, state: nextState }
      } else {
        updated[state].push({ ...issue })
      }
    }
  }

  if (movedIssue) {
    updated[nextState].push(movedIssue)
  }

  return updated
}

export function restoreCanonicalColumnOrder(
  columns: IssuesByState,
  sourceIssues: NormalizedIssue[]
): IssuesByState {
  const issueOrder = new Map(
    sourceIssues.map((issue, index) => [issue.id, index] as const)
  )

  return Object.fromEntries(
    WORKFLOW_STATES.map((state) => [
      state,
      [...columns[state]].sort(
        (left, right) =>
          (issueOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
          (issueOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER)
      ),
    ])
  ) as IssuesByState
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

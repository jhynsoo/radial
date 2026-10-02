import {
  stateKey,
  WORKFLOW_STATES,
} from "../tracker/constants"
import type { NormalizedIssue } from "../tracker/types"

export type IssuesByState = Record<string, NormalizedIssue[]>
export type IssueSortKey =
  | "created_at"
  | "updated_at"
  | "priority"
  | "identifier"

export type IssueFilterOptions = {
  query?: string
  assignee?: string
  label?: string
  sort?: IssueSortKey
}

export function normalizeWorkflowStates(
  workflowStates: readonly string[] = WORKFLOW_STATES
): string[] {
  const seen = new Set<string>()
  const normalizedStates: string[] = []

  for (const state of workflowStates) {
    const trimmed = state.trim()
    const key = stateKey(trimmed)

    if (!trimmed || seen.has(key)) {
      continue
    }

    seen.add(key)
    normalizedStates.push(trimmed)
  }

  return normalizedStates.length > 0 ? normalizedStates : [...WORKFLOW_STATES]
}

export function groupIssuesByState(
  issues: NormalizedIssue[],
  workflowStates: readonly string[] = WORKFLOW_STATES
): IssuesByState {
  const stateList = normalizeWorkflowStates(workflowStates)
  const grouped = Object.fromEntries(
    stateList.map((state) => [state, [] as NormalizedIssue[]])
  )

  for (const issue of issues) {
    const matchedState = stateList.find(
      (state) => stateKey(state) === stateKey(issue.state)
    )
    if (matchedState) {
      grouped[matchedState]?.push(issue)
    }
  }

  return grouped
}

export function filterIssues(
  issues: NormalizedIssue[],
  filters: string | IssueFilterOptions
): NormalizedIssue[] {
  const options = typeof filters === "string" ? { query: filters } : filters
  const normalizedQuery = options.query?.trim().toLowerCase() ?? ""
  const normalizedAssignee = options.assignee?.trim().toLowerCase() ?? ""
  const normalizedLabel = options.label?.trim().toLowerCase() ?? ""

  const filtered = issues.filter((issue) => {
    if (normalizedAssignee) {
      const assignee = issue.assignee?.trim().toLowerCase() ?? ""
      if (assignee !== normalizedAssignee) {
        return false
      }
    }

    if (normalizedLabel) {
      const hasLabel = issue.labels.some(
        (label) => label.trim().toLowerCase() === normalizedLabel
      )
      if (!hasLabel) {
        return false
      }
    }

    if (normalizedQuery) {
      const searchable = [
        issue.identifier,
        issue.title,
        issue.description ?? "",
        ...issue.labels,
      ]
        .join(" ")
        .toLowerCase()

      return searchable.includes(normalizedQuery)
    }

    return true
  })

  return sortIssues(filtered, options.sort)
}

function sortIssues(
  issues: NormalizedIssue[],
  sort: IssueSortKey | undefined
): NormalizedIssue[] {
  if (!sort) {
    return issues
  }

  return [...issues].sort((left, right) => {
    if (sort === "identifier") {
      return left.identifier.localeCompare(right.identifier, undefined, {
        numeric: true,
      })
    }

    if (sort === "priority") {
      return compareNullableNumber(left.priority, right.priority)
    }

    return compareNullableDateDesc(left[sort], right[sort])
  })
}

function compareNullableNumber(
  left: number | null,
  right: number | null
): number {
  if (left === null && right === null) {
    return 0
  }
  if (left === null) {
    return 1
  }
  if (right === null) {
    return -1
  }

  return left - right
}

function compareNullableDateDesc(
  left: string | null,
  right: string | null
): number {
  if (left === null && right === null) {
    return 0
  }
  if (left === null) {
    return 1
  }
  if (right === null) {
    return -1
  }

  return new Date(right).getTime() - new Date(left).getTime()
}

export function findIssueColumn(
  columns: IssuesByState,
  issueId: string,
  workflowStates: readonly string[] = WORKFLOW_STATES
): string | null {
  for (const state of normalizeWorkflowStates(workflowStates)) {
    if ((columns[state] ?? []).some((issue) => issue.id === issueId)) {
      return state
    }
  }

  return null
}

export function updateIssueStateInColumns(
  columns: IssuesByState,
  issueId: string,
  nextState: string,
  workflowStates: readonly string[] = WORKFLOW_STATES
): IssuesByState {
  const stateList = normalizeWorkflowStates(workflowStates)
  const updated = Object.fromEntries(
    stateList.map((state) => [state, [] as NormalizedIssue[]])
  )
  let movedIssue: NormalizedIssue | null = null

  for (const state of stateList) {
    for (const issue of columns[state] ?? []) {
      if (issue.id === issueId) {
        movedIssue = { ...issue, state: nextState }
      } else {
        updated[state]?.push({ ...issue })
      }
    }
  }

  const nextColumn = updated[nextState]
  if (movedIssue && nextColumn) {
    nextColumn.push(movedIssue)
  }

  return updated
}

export function restoreCanonicalColumnOrder(
  columns: IssuesByState,
  sourceIssues: NormalizedIssue[],
  workflowStates: readonly string[] = WORKFLOW_STATES
): IssuesByState {
  const issueOrder = new Map(
    sourceIssues.map((issue, index) => [issue.id, index] as const)
  )

  return Object.fromEntries(
    normalizeWorkflowStates(workflowStates).map((state) => [
      state,
      [...(columns[state] ?? [])].sort(
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
  state: string
): NormalizedIssue[] {
  return issues.map((issue) =>
    issue.id === issueId ? { ...issue, state } : issue
  )
}

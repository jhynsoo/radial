"use client"

import * as React from "react"
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanItem,
  KanbanOverlay,
  type KanbanProps,
} from "@workspace/ui/components/kanban"

import { updateIssueStateAction } from "@/app/issues/actions"
import { IssueCard } from "@/components/issues/issue-card"
import {
  findIssueColumn,
  groupIssuesByState,
  restoreCanonicalColumnOrder,
  updateIssueStateInColumns,
  type IssuesByState,
} from "@/lib/issues/board"
import { WORKFLOW_STATES, type WorkflowState } from "@/lib/tracker/constants"
import type { NormalizedIssue } from "@/lib/tracker/types"

type IssueKanbanBoardProps = {
  issues: NormalizedIssue[]
}

function cloneIssue(issue: NormalizedIssue): NormalizedIssue {
  return {
    ...issue,
    blocked_by: issue.blocked_by.map((blocker) => ({ ...blocker })),
    labels: [...issue.labels],
  }
}

function cloneColumns(columns: IssuesByState): IssuesByState {
  return Object.fromEntries(
    WORKFLOW_STATES.map((state) => [
      state,
      columns[state].map((issue) => cloneIssue(issue)),
    ])
  ) as IssuesByState
}

function normalizeColumns(
  columns: Partial<Record<WorkflowState, NormalizedIssue[]>>
): IssuesByState {
  return Object.fromEntries(
    WORKFLOW_STATES.map((state) => [state, columns[state] ?? []])
  ) as IssuesByState
}

function findIssueSnapshot(columns: IssuesByState, issueId: string) {
  for (const state of WORKFLOW_STATES) {
    const index = columns[state].findIndex((issue) => issue.id === issueId)
    const issue = columns[state][index]

    if (issue) {
      return { index, issue, state }
    }
  }

  return null
}

function restoreIssueFromSnapshot(
  currentColumns: IssuesByState,
  previousColumns: IssuesByState,
  issueId: string
): IssuesByState {
  const snapshot = findIssueSnapshot(previousColumns, issueId)
  const restoredColumns = Object.fromEntries(
    WORKFLOW_STATES.map((state) => [
      state,
      currentColumns[state]
        .filter((issue) => issue.id !== issueId)
        .map((issue) => cloneIssue(issue)),
    ])
  ) as IssuesByState

  if (!snapshot) {
    return restoredColumns
  }

  restoredColumns[snapshot.state].splice(
    Math.min(snapshot.index, restoredColumns[snapshot.state].length),
    0,
    cloneIssue(snapshot.issue)
  )

  return restoredColumns
}

function IssueKanbanBoard({ issues }: IssueKanbanBoardProps) {
  const [columns, setColumns] = React.useState<IssuesByState>(() =>
    groupIssuesByState(issues)
  )
  const [error, setError] = React.useState<string | null>(null)
  const [, startTransition] = React.useTransition()
  const latestColumnsRef = React.useRef(columns)
  const mutationTokensRef = React.useRef(new Map<string, symbol>())
  const previousColumnsRef = React.useRef<IssuesByState | null>(null)

  const updateColumns = React.useCallback((nextColumns: IssuesByState) => {
    latestColumnsRef.current = nextColumns
    setColumns(nextColumns)
  }, [])

  React.useEffect(() => {
    previousColumnsRef.current = null
    mutationTokensRef.current.clear()
    updateColumns(groupIssuesByState(issues))
  }, [issues, updateColumns])

  const handleValueChange = React.useCallback<
    NonNullable<KanbanProps<NormalizedIssue>["onValueChange"]>
  >(
    (nextColumns) => {
      updateColumns(normalizeColumns(nextColumns))
    },
    [updateColumns]
  )

  const handleDragStart = React.useCallback<
    NonNullable<KanbanProps<NormalizedIssue>["onDragStart"]>
  >(() => {
    previousColumnsRef.current = cloneColumns(latestColumnsRef.current)
    setError(null)
  }, [])

  const handleDragCancel = React.useCallback<
    NonNullable<KanbanProps<NormalizedIssue>["onDragCancel"]>
  >(() => {
    previousColumnsRef.current = null
  }, [])

  const handleDragEnd = React.useCallback<
    NonNullable<KanbanProps<NormalizedIssue>["onDragEnd"]>
  >(
    (event) => {
      const issueId = String(event.active.id)
      const previousColumns = previousColumnsRef.current
      previousColumnsRef.current = null

      if (!previousColumns) {
        return
      }

      queueMicrotask(() => {
        const nextColumns = latestColumnsRef.current
        const previousState = findIssueColumn(previousColumns, issueId)
        const nextState = findIssueColumn(nextColumns, issueId)

        if (!previousState || !nextState) {
          updateColumns(previousColumns)
          return
        }

        if (previousState === nextState) {
          updateColumns(restoreCanonicalColumnOrder(nextColumns, issues))
          return
        }

        updateColumns(
          updateIssueStateInColumns(nextColumns, issueId, nextState)
        )
        setError(null)

        const token = Symbol(issueId)
        mutationTokensRef.current.set(issueId, token)

        startTransition(async () => {
          try {
            await updateIssueStateAction(issueId, nextState)
            if (mutationTokensRef.current.get(issueId) !== token) {
              return
            }

            mutationTokensRef.current.delete(issueId)
          } catch {
            if (mutationTokensRef.current.get(issueId) !== token) {
              return
            }

            mutationTokensRef.current.delete(issueId)
            setColumns((currentColumns) => {
              const currentState = findIssueColumn(currentColumns, issueId)

              if (currentState !== nextState) {
                latestColumnsRef.current = currentColumns
                return currentColumns
              }

              const restoredColumns = restoreIssueFromSnapshot(
                currentColumns,
                previousColumns,
                issueId
              )
              latestColumnsRef.current = restoredColumns
              return restoredColumns
            })
            setError("Issue state update failed. The board was restored.")
          }
        })
      })
    },
    [issues, startTransition, updateColumns]
  )

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      {error ? (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <Kanban
        flatCursor
        getItemValue={(issue) => issue.id}
        id="issue-kanban-board"
        value={columns}
        onDragStart={handleDragStart}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
        onValueChange={handleValueChange}
      >
        <KanbanBoard className="flex min-h-[calc(100svh-12rem)] min-w-0 flex-1 items-stretch gap-3 overflow-x-auto rounded-md border border-border/80 bg-background/70 p-3 pb-4 shadow-xs">
          {WORKFLOW_STATES.map((state) => (
            <KanbanColumn
              aria-label={`${state} issue column`}
              className="flex w-72 shrink-0 flex-col gap-0 rounded-md border border-border bg-muted/35 p-0 shadow-xs transition-colors"
              key={state}
              role="region"
              value={state}
            >
              <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                <h2 className="truncate text-sm font-medium">{state}</h2>
                <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {columns[state].length}
                </span>
              </header>
              <div className="flex min-h-32 flex-1 flex-col gap-2 p-2">
                {columns[state].length > 0 ? (
                  columns[state].map((issue) => (
                    <KanbanItem
                      aria-label={`Drag issue ${issue.identifier}`}
                      asHandle
                      key={issue.id}
                      value={issue.id}
                    >
                      <IssueCard issue={issue} />
                    </KanbanItem>
                  ))
                ) : (
                  <div className="flex min-h-32 flex-1 items-center justify-center rounded-sm border border-dashed border-border bg-background/60 px-3 text-center text-xs text-muted-foreground">
                    No issues
                  </div>
                )}
              </div>
            </KanbanColumn>
          ))}
        </KanbanBoard>
        <KanbanOverlay />
      </Kanban>
    </div>
  )
}

export { IssueKanbanBoard }

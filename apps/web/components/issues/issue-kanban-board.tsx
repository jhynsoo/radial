"use client"

import * as React from "react"
import { DndContext, type DragEndEvent } from "@dnd-kit/core"

import { updateIssueStateAction } from "@/app/issues/actions"
import { IssueCard } from "@/components/issues/issue-card"
import { IssueColumn } from "@/components/issues/issue-column"
import { groupIssuesByState, moveIssueState } from "@/lib/issues/board"
import {
  stateKey,
  WORKFLOW_STATES,
  type WorkflowState,
} from "@/lib/tracker/constants"
import type { NormalizedIssue } from "@/lib/tracker/types"

type IssueKanbanBoardProps = {
  issues: NormalizedIssue[]
}

function isBoardState(value: string): value is WorkflowState {
  return WORKFLOW_STATES.some((state) => state === value)
}

function IssueKanbanBoard({ issues }: IssueKanbanBoardProps) {
  const [localIssues, setLocalIssues] = React.useState(issues)
  const [error, setError] = React.useState<string | null>(null)
  const [, startTransition] = React.useTransition()

  const groupedIssues = React.useMemo(
    () => groupIssuesByState(localIssues),
    [localIssues]
  )

  function handleDragEnd(event: DragEndEvent) {
    const issueId = String(event.active.id)
    const overId = event.over?.id

    if (typeof overId !== "string" || !isBoardState(overId)) {
      return
    }

    const issue = localIssues.find((candidate) => candidate.id === issueId)
    if (!issue || stateKey(issue.state) === stateKey(overId)) {
      return
    }

    const previousIssueState = issue.state
    const nextState = overId
    const nextIssues = moveIssueState(localIssues, issueId, nextState)
    setError(null)
    setLocalIssues(nextIssues)

    startTransition(async () => {
      try {
        await updateIssueStateAction(issueId, nextState)
      } catch {
        setLocalIssues((currentIssues) =>
          currentIssues.map((currentIssue) =>
            currentIssue.id === issueId && currentIssue.state === nextState
              ? { ...currentIssue, state: previousIssueState }
              : currentIssue
          )
        )
        setError("Issue state update failed. The board was restored.")
      }
    })
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {error ? (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex min-w-0 gap-3 overflow-x-auto pb-2">
          {WORKFLOW_STATES.map((state) => (
            <IssueColumn
              count={groupedIssues[state].length}
              key={state}
              state={state}
            >
              {groupedIssues[state].map((issue) => (
                <IssueCard issue={issue} key={issue.id} />
              ))}
            </IssueColumn>
          ))}
        </div>
      </DndContext>
    </div>
  )
}

export { IssueKanbanBoard }

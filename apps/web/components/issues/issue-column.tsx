"use client"

import { useDroppable } from "@dnd-kit/core"
import type { ReactNode } from "react"

import type { WorkflowState } from "@/lib/tracker/constants"

type IssueColumnProps = {
  state: WorkflowState
  count: number
  children: ReactNode
}

function IssueColumn({ state, count, children }: IssueColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: state })

  return (
    <section
      ref={setNodeRef}
      aria-label={`${state} issue column`}
      className="flex w-72 shrink-0 flex-col rounded-md border border-border bg-muted/35 shadow-xs transition-colors data-[over=true]:border-ring data-[over=true]:bg-accent"
      data-over={isOver ? "true" : "false"}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h2 className="truncate text-sm font-medium">{state}</h2>
        <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
          {count}
        </span>
      </header>
      <div className="flex min-h-32 flex-1 flex-col gap-2 p-2">
        {count > 0 ? (
          children
        ) : (
          <div className="flex min-h-32 flex-1 items-center justify-center rounded-sm border border-dashed border-border bg-background/60 px-3 text-center text-xs text-muted-foreground">
            No issues
          </div>
        )}
      </div>
    </section>
  )
}

export { IssueColumn }

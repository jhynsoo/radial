"use client"

import Link from "next/link"
import { useDraggable } from "@dnd-kit/core"
import { GripVertical } from "lucide-react"
import type { CSSProperties } from "react"

import type { NormalizedIssue } from "@/lib/tracker/types"

type IssueCardProps = {
  issue: NormalizedIssue
  draggable?: boolean
}

function IssueCard({ issue, draggable = true }: IssueCardProps) {
  const { attributes, isDragging, listeners, setNodeRef, transform } =
    useDraggable({
      id: issue.id,
      disabled: !draggable,
    })

  const blockerCount = issue.blocked_by.length
  const style: CSSProperties | undefined = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined

  return (
    <article
      ref={setNodeRef}
      className="rounded-md border border-border bg-card p-3 text-card-foreground shadow-xs transition data-[dragging=true]:opacity-60"
      data-dragging={isDragging ? "true" : "false"}
      style={style}
    >
      <div className="flex min-w-0 items-start gap-2">
        {draggable ? (
          <button
            className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded border border-border bg-background text-muted-foreground transition hover:border-ring hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            type="button"
            aria-label={`Drag issue ${issue.identifier}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden="true" className="size-3.5" />
          </button>
        ) : null}
        <Link
          className="flex min-w-0 flex-1 flex-col gap-2 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          href={`/issues/${issue.id}`}
        >
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="font-mono text-xs font-medium text-muted-foreground">
              {issue.identifier}
            </span>
            {issue.priority !== null ? (
              <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                P{issue.priority}
              </span>
            ) : null}
          </div>
          <h3 className="line-clamp-2 text-sm leading-snug font-medium">
            {issue.title}
          </h3>
          {issue.labels.length > 0 || blockerCount > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {issue.labels.map((label) => (
                <span
                  className="rounded border border-border bg-background px-1.5 py-0.5"
                  key={label}
                >
                  {label}
                </span>
              ))}
              {blockerCount > 0 ? (
                <span className="rounded border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-destructive">
                  {blockerCount} {blockerCount === 1 ? "blocker" : "blockers"}
                </span>
              ) : null}
            </div>
          ) : null}
        </Link>
      </div>
    </article>
  )
}

export { IssueCard }

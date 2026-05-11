"use client"

import Link from "next/link"
import { useDraggable } from "@dnd-kit/core"
import type { CSSProperties } from "react"

import type { NormalizedIssue } from "@/lib/tracker/types"

type IssueCardProps = {
  issue: NormalizedIssue
  draggable?: boolean
}

function IssueCard({ issue, draggable = true }: IssueCardProps) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
  } = useDraggable({
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
    <Link
      ref={setNodeRef}
      className="block rounded-md border border-border bg-card p-3 text-card-foreground shadow-xs transition hover:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[dragging=true]:opacity-60"
      data-dragging={isDragging ? "true" : "false"}
      href={`/issues/${issue.id}`}
      style={style}
      {...attributes}
      {...listeners}
    >
      <article className="flex min-w-0 flex-col gap-2">
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
        <h3 className="line-clamp-2 text-sm font-medium leading-snug">
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
      </article>
    </Link>
  )
}

export { IssueCard }

import Link from "next/link"

import type { NormalizedIssue } from "@/lib/tracker/types"

type IssueCardProps = {
  issue: NormalizedIssue
}

function IssueCard({ issue }: IssueCardProps) {
  const blockerCount = issue.blocked_by.length

  return (
    <article
      aria-label={`${issue.identifier} ${issue.title}`}
      className="flex flex-col gap-2 rounded-md border border-border bg-card p-3 text-card-foreground shadow-xs"
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <Link
          className="flex min-w-0 flex-1 flex-col gap-2 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          href={`/issues/${issue.id}`}
        >
          <span className="font-mono text-xs font-medium text-muted-foreground">
            {issue.identifier}
          </span>
          <h3 className="line-clamp-2 text-sm leading-snug font-medium">
            {issue.title}
          </h3>
        </Link>
        {issue.priority !== null ? (
          <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            P{issue.priority}
          </span>
        ) : null}
      </div>
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
  )
}

export { IssueCard }

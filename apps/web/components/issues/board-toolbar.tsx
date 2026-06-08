import Link from "next/link"
import { KanbanSquare, Plus, Search, SlidersHorizontal } from "lucide-react"

import { ProjectScopePicker } from "@/components/issues/project-scope-picker"
import type { IssueSortKey } from "@/lib/issues/board"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

type BoardToolbarProps = {
  assignee: string
  issueCount: number
  label: string
  project: string
  query: string
  showEmptyStates: boolean
  sort?: IssueSortKey
}

function newIssueHref(project: string) {
  const trimmedProject = project.trim()
  if (!trimmedProject) {
    return "/issues/new"
  }

  const params = new URLSearchParams({ project: trimmedProject })
  return `/issues/new?${params.toString()}`
}

function formatIssueCount(issueCount: number) {
  return `${issueCount} ${issueCount === 1 ? "issue" : "issues"}`
}

function BoardToolbar({
  assignee,
  issueCount,
  label,
  project,
  query,
  showEmptyStates,
  sort,
}: BoardToolbarProps) {
  const trimmedProject = project.trim()
  const hasFilters = Boolean(query || assignee || label)
  const hasDisplayOptions = Boolean(sort || !showEmptyStates)

  return (
    <header className="shrink-0 border-b border-border bg-background/95">
      <div className="flex flex-col gap-3 px-3 py-3 sm:px-4 lg:flex-row lg:items-start lg:justify-between lg:px-5">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
              <KanbanSquare aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="text-sm leading-tight font-semibold">
                Issue board
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                {trimmedProject || "No project selected"}
              </p>
            </div>
            <span className="rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
              {formatIssueCount(issueCount)}
            </span>
            {hasFilters ? (
              <span className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground">
                Filtered
              </span>
            ) : null}
            {hasDisplayOptions ? (
              <span className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground">
                Display
              </span>
            ) : null}
          </div>
          <ProjectScopePicker
            className="w-full max-w-2xl"
            currentProject={project}
          />
        </div>
        <div className="flex w-full flex-col gap-2 lg:w-auto">
          <form className="flex min-w-0 flex-1 flex-col gap-2" method="get">
            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(10rem,1fr)_minmax(8rem,0.7fr)_minmax(8rem,0.7fr)_9rem_auto] sm:items-end">
              <input type="hidden" name="project" value={project} />
              <div className="flex min-w-0 flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="issue-search">
                  Search
                </label>
                <input
                  className="h-8 min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  id="issue-search"
                  name="q"
                  defaultValue={query}
                  placeholder="Identifier, title, label"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="issue-assignee">
                  Assignee
                </label>
                <input
                  className="h-8 min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  id="issue-assignee"
                  name="assignee"
                  defaultValue={assignee}
                  placeholder="me"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="issue-label">
                  Label
                </label>
                <input
                  className="h-8 min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  id="issue-label"
                  name="label"
                  defaultValue={label}
                  placeholder="backend"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="issue-sort">
                  Sort
                </label>
                <select
                  className="h-8 min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  defaultValue={sort ?? ""}
                  id="issue-sort"
                  name="sort"
                >
                  <option value="">Default</option>
                  <option value="updated_at">Updated</option>
                  <option value="created_at">Created</option>
                  <option value="priority">Priority</option>
                  <option value="identifier">Identifier</option>
                </select>
              </div>
              <Button type="submit" variant="outline">
                <Search data-icon="inline-start" />
                Search
              </Button>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input
                className="size-4 rounded border-input"
                defaultChecked={showEmptyStates}
                name="show_empty"
                type="checkbox"
                value="true"
              />
              <SlidersHorizontal aria-hidden="true" className="size-4" />
              Show empty states
            </label>
            <input name="show_empty" type="hidden" value="false" />
          </form>
          <Link
            className={cn(buttonVariants(), "self-start")}
            href={newIssueHref(project)}
          >
            <Plus data-icon="inline-start" />
            New issue
          </Link>
        </div>
      </div>
    </header>
  )
}

export { BoardToolbar }

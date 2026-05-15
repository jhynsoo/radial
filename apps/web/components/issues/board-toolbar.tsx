import Link from "next/link"
import { KanbanSquare, Plus, Search } from "lucide-react"

import { ProjectScopePicker } from "@/components/issues/project-scope-picker"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

type BoardToolbarProps = {
  issueCount: number
  project: string
  query: string
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

function BoardToolbar({ issueCount, project, query }: BoardToolbarProps) {
  const trimmedProject = project.trim()

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
            {query ? (
              <span className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground">
                Filtered
              </span>
            ) : null}
          </div>
          <ProjectScopePicker
            className="w-full max-w-2xl"
            currentProject={project}
          />
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end lg:w-auto">
          <form className="flex min-w-0 flex-1 flex-col gap-1.5" method="get">
            <label className="text-sm font-medium" htmlFor="issue-search">
              Search
            </label>
            <div className="flex min-w-0 gap-2">
              <input type="hidden" name="project" value={project} />
              <input
                className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-72"
                id="issue-search"
                name="q"
                defaultValue={query}
                placeholder="Identifier, title, label"
              />
              <Button type="submit" variant="outline">
                <Search data-icon="inline-start" />
                Search
              </Button>
            </div>
          </form>
          <Link
            className={cn(buttonVariants(), "self-start sm:self-end")}
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

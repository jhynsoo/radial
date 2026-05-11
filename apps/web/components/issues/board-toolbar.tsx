import Link from "next/link"
import { Filter, Plus } from "lucide-react"

import { ProjectScopePicker } from "@/components/issues/project-scope-picker"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

type BoardToolbarProps = {
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

function BoardToolbar({ project, query }: BoardToolbarProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <ProjectScopePicker currentProject={project} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <form className="flex flex-col gap-1.5" method="get">
          <label className="text-sm font-medium" htmlFor="issue-search">
            Search
          </label>
          <div className="flex gap-2">
            <input type="hidden" name="project" value={project} />
            <input
              className="h-8 min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              id="issue-search"
              name="q"
              defaultValue={query}
            />
            <Button type="submit" variant="outline">
              <Filter data-icon="inline-start" />
              Filter
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
  )
}

export { BoardToolbar }

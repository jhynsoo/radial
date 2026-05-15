import { BoardToolbar } from "@/components/issues/board-toolbar"
import { IssueKanbanBoard } from "@/components/issues/issue-kanban-board"
import { filterIssues } from "@/lib/issues/board"
import { searchIssues } from "@/lib/tracker/client"
import { WORKFLOW_STATES } from "@/lib/tracker/constants"
import type { NormalizedIssue } from "@/lib/tracker/types"

type SearchParamValue = string | string[] | undefined

type PageProps = {
  searchParams?: Promise<{
    project?: SearchParamValue
    q?: SearchParamValue
  }>
}

function firstSearchParam(value: SearchParamValue): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ""
}

function loadErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "category" in error &&
    "message" in error &&
    typeof error.category === "string" &&
    typeof error.message === "string"
  ) {
    return `${error.category}: ${error.message}`
  }

  return "Failed to load issues."
}

function boardKey(
  project: string,
  query: string,
  issues: NormalizedIssue[]
): string {
  return [
    project,
    query,
    ...issues.map(
      (issue) => `${issue.id}:${issue.state}:${issue.updated_at ?? ""}`
    ),
  ].join("\u001f")
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams
  const project = firstSearchParam(params?.project)
  const query = firstSearchParam(params?.q)
  let issues: NormalizedIssue[] = []
  let loadError: string | null = null

  if (project) {
    try {
      issues = filterIssues(
        await searchIssues({ project, states: WORKFLOW_STATES }),
        query
      )
    } catch (error) {
      loadError = loadErrorMessage(error)
    }
  }

  return (
    <main className="flex min-h-svh flex-col bg-muted/25">
      <BoardToolbar
        issueCount={issues.length}
        project={project}
        query={query}
      />
      <section className="flex min-h-0 flex-1 flex-col gap-3 px-3 py-3 sm:px-4 lg:px-5">
        {loadError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {loadError}
          </div>
        ) : null}
        {project ? (
          <IssueKanbanBoard
            issues={issues}
            key={boardKey(project, query, issues)}
          />
        ) : (
          <div className="flex min-h-[calc(100svh-9rem)] items-center justify-center rounded-md border border-dashed border-border bg-background px-4 py-10 text-sm text-muted-foreground">
            Enter a project slug to load the issue board.
          </div>
        )}
      </section>
    </main>
  )
}

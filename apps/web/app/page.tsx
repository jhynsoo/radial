import { BoardToolbar } from "@/components/issues/board-toolbar"
import { IssueKanbanBoard } from "@/components/issues/issue-kanban-board"
import { filterIssues, type IssueSortKey } from "@/lib/issues/board"
import { searchIssues } from "@/lib/tracker/client"
import { WORKFLOW_STATES } from "@/lib/tracker/constants"
import type { NormalizedIssue } from "@/lib/tracker/types"

type SearchParamValue = string | string[] | undefined

type PageProps = {
  searchParams?: Promise<{
    project?: SearchParamValue
    q?: SearchParamValue
    assignee?: SearchParamValue
    label?: SearchParamValue
    sort?: SearchParamValue
    show_empty?: SearchParamValue
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
  assignee: string,
  label: string,
  sort: IssueSortKey | undefined,
  showEmptyStates: boolean,
  issues: NormalizedIssue[]
): string {
  return [
    project,
    query,
    assignee,
    label,
    sort ?? "",
    String(showEmptyStates),
    ...issues.map(
      (issue) => `${issue.id}:${issue.state}:${issue.updated_at ?? ""}`
    ),
  ].join("\u001f")
}

function parseSort(value: string): IssueSortKey | undefined {
  if (
    value === "created_at" ||
    value === "updated_at" ||
    value === "priority" ||
    value === "identifier"
  ) {
    return value
  }

  return undefined
}

function parseShowEmptyStates(value: string): boolean {
  return value !== "false"
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams
  const project = firstSearchParam(params?.project)
  const query = firstSearchParam(params?.q)
  const assignee = firstSearchParam(params?.assignee)
  const label = firstSearchParam(params?.label)
  const sort = parseSort(firstSearchParam(params?.sort))
  const showEmptyStates = parseShowEmptyStates(
    firstSearchParam(params?.show_empty)
  )
  let issues: NormalizedIssue[] = []
  let loadError: string | null = null

  if (project) {
    try {
      issues = filterIssues(
        await searchIssues({
          project,
          states: WORKFLOW_STATES,
          ...(assignee ? { assignee } : {}),
        }),
        {
          query,
          assignee,
          label,
          sort,
        }
      )
    } catch (error) {
      loadError = loadErrorMessage(error)
    }
  }

  return (
    <main className="flex min-h-svh flex-col bg-muted/25">
      <BoardToolbar
        issueCount={issues.length}
        assignee={assignee}
        label={label}
        project={project}
        query={query}
        showEmptyStates={showEmptyStates}
        sort={sort}
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
            key={boardKey(
              project,
              query,
              assignee,
              label,
              sort,
              showEmptyStates,
              issues
            )}
            showEmptyStates={showEmptyStates}
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

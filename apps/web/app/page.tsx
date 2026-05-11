import { BoardToolbar } from "@/components/issues/board-toolbar"
import { IssueKanbanBoard } from "@/components/issues/issue-kanban-board"
import { filterIssues } from "@/lib/issues/board"
import { searchIssues } from "@/lib/tracker/client"
import { WORKFLOW_STATES } from "@/lib/tracker/constants"

type PageProps = {
  searchParams?: Promise<{
    project?: string
    q?: string
  }>
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams
  const project = params?.project?.trim() ?? ""
  const query = params?.q?.trim() ?? ""
  const issues = project
    ? filterIssues(
        await searchIssues({ project, states: WORKFLOW_STATES }),
        query,
      )
    : []

  return (
    <main className="min-h-svh bg-background">
      <BoardToolbar project={project} query={query} />
      {project ? (
        <IssueKanbanBoard issues={issues} />
      ) : (
        <div className="px-4 py-10 text-sm text-muted-foreground">
          Enter a project slug to load the issue board.
        </div>
      )}
    </main>
  )
}
